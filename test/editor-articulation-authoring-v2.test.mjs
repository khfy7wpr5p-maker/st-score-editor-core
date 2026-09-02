import test from 'node:test';
import assert from 'node:assert/strict';
import { createScoreDocumentV2 } from '../dist/packages/score-model-v2/src/index.js';
import { emptyNotationDocumentV2 } from '../dist/packages/notation-structure-v2/src/index.js';
import { addressEntityV2 } from '../dist/packages/addressing-v2/src/index.js';
import { executeArticulationAuthoringV2, ArticulationAuthoringV2Error } from '../dist/packages/editor-articulation-authoring-v2/src/index.js';
import { createEditorSessionV2, commitSessionArticulationIntentV2, navigateSessionHistoryV2 } from '../dist/packages/editor-session-controller-v2/src/index.js';

const articulation = (kind = 'staccato', placement = 'auto', direction = null) => ({ kind, placement, direction });

const rawScore = (revision = 'rev-1', parentId = null) => ({
  schemaVersion: '2.0.0',
  id: 'doc-articulation',
  revision: { id: revision, parentId },
  source: { sha256: 'b'.repeat(64), format: 'synthetic', byteLength: null },
  parts: [{ id: 'part-1', name: 'Part', staves: [{ id: 'staff-1', ordinal: 1, measures: [{
    id: 'measure-1', ordinal: 1, displayNumber: '1', voices: [{
      id: 'voice-1', ordinal: 1,
      events: [
        { id: 'event-1', kind: 'note', onset: { numerator: 0, denominator: 1 }, duration: { numerator: 1, denominator: 4 }, note: { id: 'note-1', pitch: { step: 'C', alter: 0, octave: 4 } } },
        { id: 'event-2', kind: 'rest', onset: { numerator: 1, denominator: 4 }, duration: { numerator: 1, denominator: 4 } }
      ],
      graceGroups: [{
        id: 'grace-group-1', anchorEventId: 'event-1', placement: 'before',
        events: [{
          id: 'grace-event-1', kind: 'note', writtenDuration: { numerator: 1, denominator: 8 },
          playback: { stealTimePreviousPercent: null, stealTimeFollowingPercent: null, makeTime: null },
          note: { id: 'grace-note-1', pitch: { step: 'D', alter: 0, octave: 4 } }
        }]
      }]
    }]
  }]}]}]
});

const scoreMusicalFingerprint = (score) => JSON.stringify(score.parts);
const eventArticulations = (notation, id) => notation.events.find((entry) => entry.target.eventId === id)?.notation.articulations ?? [];
const graceArticulations = (notation, id) => notation.graceEvents.find((entry) => entry.target.graceEventId === id)?.notation.articulations ?? [];

test('SSE-04 sets typed articulations on a normal event without mutating canonical score content', () => {
  const score = createScoreDocumentV2(rawScore());
  const notation = emptyNotationDocumentV2(score);
  const before = scoreMusicalFingerprint(score);
  const result = executeArticulationAuthoringV2(score, notation, {
    version: '1.0.0', type: 'SET_ARTICULATIONS', target: addressEntityV2(score, 'event-1'),
    value: [articulation('staccato'), articulation('accent', 'above')]
  }, { nextRevisionId: 'rev-2' });
  assert.equal(scoreMusicalFingerprint(result.score), before);
  assert.deepEqual(eventArticulations(result.notation, 'event-1').map((item) => item.kind), ['staccato', 'accent']);
  assert.equal(result.score.revision.parentId, 'rev-1');
  assert.equal(result.selectionEntityId, 'event-1');
});

test('SSE-04 toggles and removes articulations on normal and grace events', () => {
  const score = createScoreDocumentV2(rawScore());
  let notation = emptyNotationDocumentV2(score);
  let result = executeArticulationAuthoringV2(score, notation, {
    version: '1.0.0', type: 'TOGGLE_ARTICULATION', target: addressEntityV2(score, 'grace-event-1'), value: articulation('tenuto', 'below')
  }, { nextRevisionId: 'rev-2' });
  assert.equal(graceArticulations(result.notation, 'grace-event-1')[0].kind, 'tenuto');
  result = executeArticulationAuthoringV2(result.score, result.notation, {
    version: '1.0.0', type: 'TOGGLE_ARTICULATION', target: addressEntityV2(result.score, 'grace-event-1'), value: articulation('tenuto', 'below')
  }, { nextRevisionId: 'rev-3' });
  assert.equal(graceArticulations(result.notation, 'grace-event-1').length, 0);
  result = executeArticulationAuthoringV2(result.score, result.notation, {
    version: '1.0.0', type: 'SET_ARTICULATIONS', target: addressEntityV2(result.score, 'event-1'), value: [articulation('accent'), articulation('staccato')]
  }, { nextRevisionId: 'rev-4' });
  result = executeArticulationAuthoringV2(result.score, result.notation, {
    version: '1.0.0', type: 'REMOVE_ARTICULATION', target: addressEntityV2(result.score, 'event-1'), value: articulation('accent')
  }, { nextRevisionId: 'rev-5' });
  assert.deepEqual(eventArticulations(result.notation, 'event-1').map((item) => item.kind), ['staccato']);
});

test('SSE-04 rejects invalid or duplicate articulation semantics through v2 notation validation', () => {
  const score = createScoreDocumentV2(rawScore());
  const notation = emptyNotationDocumentV2(score);
  assert.throws(() => executeArticulationAuthoringV2(score, notation, {
    version: '1.0.0', type: 'SET_ARTICULATIONS', target: addressEntityV2(score, 'event-1'), value: [articulation('staccato'), articulation('staccato')]
  }, { nextRevisionId: 'rev-2' }), (error) => error instanceof ArticulationAuthoringV2Error && error.code === 'RESULT_INVALID');
  assert.throws(() => executeArticulationAuthoringV2(score, notation, {
    version: '1.0.0', type: 'SET_ARTICULATIONS', target: addressEntityV2(score, 'event-1'), value: [articulation('staccato', 'auto', 'up')]
  }, { nextRevisionId: 'rev-2b' }), (error) => error instanceof ArticulationAuthoringV2Error && error.code === 'RESULT_INVALID');
});

test('SSE-04 stale articulation targets fail closed', () => {
  const score = createScoreDocumentV2(rawScore());
  const stale = addressEntityV2(score, 'event-1');
  const first = executeArticulationAuthoringV2(score, emptyNotationDocumentV2(score), {
    version: '1.0.0', type: 'TOGGLE_ARTICULATION', target: stale, value: articulation('accent')
  }, { nextRevisionId: 'rev-2' });
  assert.throws(() => executeArticulationAuthoringV2(first.score, first.notation, {
    version: '1.0.0', type: 'TOGGLE_ARTICULATION', target: stale, value: articulation('tenuto')
  }, { nextRevisionId: 'rev-3' }), (error) => error instanceof ArticulationAuthoringV2Error && error.code === 'STALE_TARGET');
});

test('SSE-04 session commits one atomic history revision and undo restores articulation-free notation', () => {
  const score = createScoreDocumentV2(rawScore());
  let session = createEditorSessionV2(score, emptyNotationDocumentV2(score));
  session = commitSessionArticulationIntentV2(session, {
    version: '1.0.0', type: 'TOGGLE_ARTICULATION', target: addressEntityV2(score, 'event-1'), value: articulation('strong-accent', 'above', 'up')
  }, { nextRevisionId: 'rev-2' });
  assert.equal(session.history.past.length, 1);
  assert.equal(session.history.present.score.revision.id, 'rev-2');
  assert.equal(session.selection.primary.kind, 'event');
  assert.equal(session.status.code, 'ARTICULATION_EDIT_COMMITTED');
  assert.equal(session.renderRequest.projectionStatus, 'V2_SEMANTIC_XML');
  assert.equal(typeof session.renderRequest.musicXml, 'string');
  assert.match(session.renderRequest.musicXml, /<articulations>/);
  assert.equal(eventArticulations(session.history.present.notation, 'event-1')[0].kind, 'strong-accent');
  session = navigateSessionHistoryV2(session, 'UNDO');
  assert.equal(session.history.present.score.revision.id, 'rev-1');
  assert.equal(eventArticulations(session.history.present.notation, 'event-1').length, 0);
});
