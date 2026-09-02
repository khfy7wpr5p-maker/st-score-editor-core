import test from 'node:test';
import assert from 'node:assert/strict';
import { createScoreDocumentV2 } from '../dist/packages/score-model-v2/src/index.js';
import { emptyNotationDocumentV2 } from '../dist/packages/notation-structure-v2/src/index.js';
import { addressEntityV2 } from '../dist/packages/addressing-v2/src/index.js';
import { executeOrnamentAuthoringV2, OrnamentAuthoringV2Error } from '../dist/packages/editor-ornament-authoring-v2/src/index.js';
import { createEditorSessionV2, commitSessionOrnamentIntentV2, navigateSessionHistoryV2 } from '../dist/packages/editor-session-controller-v2/src/index.js';

const rawScore = () => ({
  schemaVersion: '2.0.0', id: 'doc-ornament', revision: { id: 'rev-1', parentId: null },
  source: { sha256: 'c'.repeat(64), format: 'synthetic', byteLength: null },
  parts: [{ id: 'part-1', name: 'Part', staves: [{ id: 'staff-1', ordinal: 1, measures: [{
    id: 'measure-1', ordinal: 1, displayNumber: '1', voices: [{ id: 'voice-1', ordinal: 1,
      events: [
        { id: 'event-1', kind: 'note', onset: { numerator: 0, denominator: 1 }, duration: { numerator: 1, denominator: 8 }, note: { id: 'note-1', pitch: { step: 'C', alter: 0, octave: 4 } } },
        { id: 'event-2', kind: 'note', onset: { numerator: 1, denominator: 8 }, duration: { numerator: 1, denominator: 8 }, note: { id: 'note-2', pitch: { step: 'D', alter: 0, octave: 4 } } },
        { id: 'event-3', kind: 'chord', onset: { numerator: 1, denominator: 4 }, duration: { numerator: 1, denominator: 8 }, notes: [
          { id: 'note-3a', pitch: { step: 'E', alter: 0, octave: 4 } }, { id: 'note-3b', pitch: { step: 'G', alter: 0, octave: 4 } }
        ] },
        { id: 'event-4', kind: 'rest', onset: { numerator: 3, denominator: 8 }, duration: { numerator: 1, denominator: 8 } }
      ],
      graceGroups: [{ id: 'grace-group-1', anchorEventId: 'event-1', placement: 'before', events: [{
        id: 'grace-event-1', kind: 'note', writtenDuration: { numerator: 1, denominator: 16 },
        playback: { stealTimePreviousPercent: null, stealTimeFollowingPercent: null, makeTime: null },
        note: { id: 'grace-note-1', pitch: { step: 'B', alter: 0, octave: 3 } }
      }] }]
    }]
  }]}]}]
});

const simple = (kind = 'trill-mark') => ({ kind, placement: 'above', accidentalMarks: [] });
const singleTremolo = () => ({ kind: 'tremolo', type: 'single', marks: 3, number: null, placement: 'auto' });
const eventOrnaments = (notation, id) => notation.events.find((entry) => entry.target.eventId === id)?.notation.ornaments ?? [];
const graceOrnaments = (notation, id) => notation.graceEvents.find((entry) => entry.target.graceEventId === id)?.notation.ornaments ?? [];

test('SSE-05 adds/removes simple ornaments and single-note tremolo on normal and grace events', () => {
  const score = createScoreDocumentV2(rawScore());
  let result = executeOrnamentAuthoringV2(score, emptyNotationDocumentV2(score), {
    version: '1.0.0', type: 'ADD_LOCAL_ORNAMENT', target: addressEntityV2(score, 'event-1'), value: simple('mordent')
  }, { nextRevisionId: 'rev-2' });
  assert.equal(eventOrnaments(result.notation, 'event-1')[0].kind, 'mordent');
  result = executeOrnamentAuthoringV2(result.score, result.notation, {
    version: '1.0.0', type: 'ADD_LOCAL_ORNAMENT', target: addressEntityV2(result.score, 'grace-event-1'), value: singleTremolo()
  }, { nextRevisionId: 'rev-3' });
  assert.equal(graceOrnaments(result.notation, 'grace-event-1')[0].kind, 'tremolo');
  assert.equal(graceOrnaments(result.notation, 'grace-event-1')[0].type, 'single');
  result = executeOrnamentAuthoringV2(result.score, result.notation, {
    version: '1.0.0', type: 'REMOVE_LOCAL_ORNAMENT', target: addressEntityV2(result.score, 'event-1'), value: simple('mordent')
  }, { nextRevisionId: 'rev-4' });
  assert.equal(eventOrnaments(result.notation, 'event-1').length, 0);
});

test('SSE-05 rejects duplicate local ornaments and spanning forms through local API', () => {
  const score = createScoreDocumentV2(rawScore());
  const first = executeOrnamentAuthoringV2(score, emptyNotationDocumentV2(score), {
    version: '1.0.0', type: 'ADD_LOCAL_ORNAMENT', target: addressEntityV2(score, 'event-1'), value: simple()
  }, { nextRevisionId: 'rev-2' });
  assert.throws(() => executeOrnamentAuthoringV2(first.score, first.notation, {
    version: '1.0.0', type: 'ADD_LOCAL_ORNAMENT', target: addressEntityV2(first.score, 'event-1'), value: simple()
  }, { nextRevisionId: 'rev-3' }), (error) => error instanceof OrnamentAuthoringV2Error && error.code === 'DUPLICATE_ORNAMENT');
  assert.throws(() => executeOrnamentAuthoringV2(score, emptyNotationDocumentV2(score), {
    version: '1.0.0', type: 'ADD_LOCAL_ORNAMENT', target: addressEntityV2(score, 'event-1'), value: { kind: 'wavy-line', type: 'start', number: 1, placement: 'auto' }
  }, { nextRevisionId: 'rev-x' }), (error) => error instanceof OrnamentAuthoringV2Error && error.code === 'INVALID_LOCAL_ORNAMENT');
});

test('SSE-05 creates and removes a two-note tremolo relation atomically', () => {
  const score = createScoreDocumentV2(rawScore());
  const start = addressEntityV2(score, 'event-1');
  const stop = addressEntityV2(score, 'event-3');
  const created = executeOrnamentAuthoringV2(score, emptyNotationDocumentV2(score), {
    version: '1.0.0', type: 'CREATE_TREMOLO_RELATION', start, stop, number: 4, marks: 3, placement: 'auto'
  }, { nextRevisionId: 'rev-2' });
  assert.deepEqual(eventOrnaments(created.notation, 'event-1').map((o) => [o.kind, o.type, o.number]), [['tremolo', 'start', 4]]);
  assert.deepEqual(eventOrnaments(created.notation, 'event-3').map((o) => [o.kind, o.type, o.number]), [['tremolo', 'stop', 4]]);
  const removed = executeOrnamentAuthoringV2(created.score, created.notation, {
    version: '1.0.0', type: 'REMOVE_TREMOLO_RELATION', start: addressEntityV2(created.score, 'event-1'), stop: addressEntityV2(created.score, 'event-3'), number: 4
  }, { nextRevisionId: 'rev-3' });
  assert.equal(eventOrnaments(removed.notation, 'event-1').length, 0);
  assert.equal(eventOrnaments(removed.notation, 'event-3').length, 0);
});

test('SSE-05 creates and removes ordered wavy-line start/continue/stop relation', () => {
  const score = createScoreDocumentV2(rawScore());
  const targets = ['event-1', 'event-2', 'event-3'].map((id) => addressEntityV2(score, id));
  const created = executeOrnamentAuthoringV2(score, emptyNotationDocumentV2(score), {
    version: '1.0.0', type: 'CREATE_WAVY_LINE_RELATION', targets, number: 7, placement: 'above'
  }, { nextRevisionId: 'rev-2' });
  assert.equal(eventOrnaments(created.notation, 'event-1')[0].type, 'start');
  assert.equal(eventOrnaments(created.notation, 'event-2')[0].type, 'continue');
  assert.equal(eventOrnaments(created.notation, 'event-3')[0].type, 'stop');
  const nextTargets = ['event-1', 'event-2', 'event-3'].map((id) => addressEntityV2(created.score, id));
  const removed = executeOrnamentAuthoringV2(created.score, created.notation, {
    version: '1.0.0', type: 'REMOVE_WAVY_LINE_RELATION', targets: nextTargets, number: 7
  }, { nextRevisionId: 'rev-3' });
  assert.equal(eventOrnaments(removed.notation, 'event-1').length, 0);
  assert.equal(eventOrnaments(removed.notation, 'event-2').length, 0);
  assert.equal(eventOrnaments(removed.notation, 'event-3').length, 0);
});

test('SSE-05 spanning relations reject rest endpoints, reversed order, and relation-number reuse', () => {
  const score = createScoreDocumentV2(rawScore());
  const notation = emptyNotationDocumentV2(score);
  assert.throws(() => executeOrnamentAuthoringV2(score, notation, {
    version: '1.0.0', type: 'CREATE_TREMOLO_RELATION', start: addressEntityV2(score, 'event-1'), stop: addressEntityV2(score, 'event-4'), number: 1, marks: 2, placement: 'auto'
  }, { nextRevisionId: 'rev-a' }), (error) => error instanceof OrnamentAuthoringV2Error && error.code === 'RELATION_ENDPOINT_NOT_PITCHED');
  assert.throws(() => executeOrnamentAuthoringV2(score, notation, {
    version: '1.0.0', type: 'CREATE_WAVY_LINE_RELATION', targets: [addressEntityV2(score, 'event-3'), addressEntityV2(score, 'event-1')], number: 2, placement: 'auto'
  }, { nextRevisionId: 'rev-b' }), (error) => error instanceof OrnamentAuthoringV2Error && error.code === 'INVALID_RELATION_ORDER');
  const first = executeOrnamentAuthoringV2(score, notation, {
    version: '1.0.0', type: 'CREATE_TREMOLO_RELATION', start: addressEntityV2(score, 'event-1'), stop: addressEntityV2(score, 'event-2'), number: 3, marks: 2, placement: 'auto'
  }, { nextRevisionId: 'rev-2' });
  assert.throws(() => executeOrnamentAuthoringV2(first.score, first.notation, {
    version: '1.0.0', type: 'CREATE_TREMOLO_RELATION', start: addressEntityV2(first.score, 'event-2'), stop: addressEntityV2(first.score, 'event-3'), number: 3, marks: 2, placement: 'auto'
  }, { nextRevisionId: 'rev-3' }), (error) => error instanceof OrnamentAuthoringV2Error && error.code === 'RELATION_NUMBER_IN_USE');
});

test('SSE-05 stale targets fail closed and session undo restores relation-free notation', () => {
  const score = createScoreDocumentV2(rawScore());
  const stale = addressEntityV2(score, 'event-1');
  let session = createEditorSessionV2(score, emptyNotationDocumentV2(score));
  session = commitSessionOrnamentIntentV2(session, {
    version: '1.0.0', type: 'ADD_LOCAL_ORNAMENT', target: stale, value: simple('turn')
  }, { nextRevisionId: 'rev-2' });
  assert.equal(session.status.code, 'ORNAMENT_EDIT_COMMITTED');
  assert.equal(session.renderRequest.projectionStatus, 'V2_SEMANTIC_XML');
  assert.equal(typeof session.renderRequest.musicXml, 'string');
  assert.match(session.renderRequest.musicXml, /<ornaments>/);
  assert.throws(() => executeOrnamentAuthoringV2(session.history.present.score, session.history.present.notation, {
    version: '1.0.0', type: 'TOGGLE_LOCAL_ORNAMENT', target: stale, value: simple('turn')
  }, { nextRevisionId: 'rev-3' }), (error) => error instanceof OrnamentAuthoringV2Error && error.code === 'STALE_TARGET');
  session = navigateSessionHistoryV2(session, 'UNDO');
  assert.equal(session.history.present.score.revision.id, 'rev-1');
  assert.equal(eventOrnaments(session.history.present.notation, 'event-1').length, 0);
});
