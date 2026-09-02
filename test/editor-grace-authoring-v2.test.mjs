import test from 'node:test';
import assert from 'node:assert/strict';
import { createScoreDocumentV2 } from '../dist/packages/score-model-v2/src/index.js';
import { createNotationDocumentV2, emptyNotationDocumentV2 } from '../dist/packages/notation-structure-v2/src/index.js';
import { addressEntityV2 } from '../dist/packages/addressing-v2/src/index.js';
import { executeGraceAuthoringV2, GraceAuthoringV2Error } from '../dist/packages/editor-grace-authoring-v2/src/index.js';
import { createEditorSessionV2, commitSessionGraceIntentV2, navigateSessionHistoryV2 } from '../dist/packages/editor-session-controller-v2/src/index.js';

const scoreRaw = (revision = 'rev-1', parentId = null) => ({
  schemaVersion: '2.0.0',
  id: 'doc-grace',
  revision: { id: revision, parentId },
  source: { sha256: 'a'.repeat(64), format: 'synthetic', byteLength: null },
  parts: [{
    id: 'part-1', name: 'Part', staves: [{
      id: 'staff-1', ordinal: 1, measures: [{
        id: 'measure-1', ordinal: 1, displayNumber: '1', voices: [{
          id: 'voice-1', ordinal: 1,
          events: [
            { id: 'event-1', kind: 'note', onset: { numerator: 0, denominator: 1 }, duration: { numerator: 1, denominator: 4 }, note: { id: 'note-1', pitch: { step: 'C', alter: 0, octave: 4 } } },
            { id: 'event-2', kind: 'rest', onset: { numerator: 1, denominator: 4 }, duration: { numerator: 1, denominator: 4 } }
          ],
          graceGroups: []
        }]
      }]
    }]
  }]
});

const noteGrace = (eventId = 'grace-event-1', noteId = 'grace-note-1', step = 'D') => ({
  id: eventId,
  kind: 'note',
  writtenDuration: { numerator: 1, denominator: 8 },
  playback: { stealTimePreviousPercent: null, stealTimeFollowingPercent: null, makeTime: null },
  note: { id: noteId, pitch: { step, alter: 0, octave: 4 } }
});

const restGrace = (eventId = 'grace-rest-1') => ({
  id: eventId,
  kind: 'rest',
  writtenDuration: { numerator: 1, denominator: 16 },
  playback: { stealTimePreviousPercent: null, stealTimeFollowingPercent: null, makeTime: null }
});

const chordGrace = (eventId = 'grace-chord-1') => ({
  id: eventId,
  kind: 'chord',
  writtenDuration: { numerator: 1, denominator: 8 },
  playback: { stealTimePreviousPercent: null, stealTimeFollowingPercent: null, makeTime: null },
  notes: [
    { id: `${eventId}-n1`, pitch: { step: 'E', alter: 0, octave: 4 } },
    { id: `${eventId}-n2`, pitch: { step: 'G', alter: 0, octave: 4 } }
  ]
});

const occupancy = (score) => score.parts[0].staves[0].measures[0].voices[0].events.map((event) => ({
  id: event.id, kind: event.kind, onset: event.onset, duration: event.duration
}));

const createGroupIntent = (score, firstEvent = noteGrace()) => ({
  version: '1.0.0',
  type: 'CREATE_GRACE_GROUP',
  target: addressEntityV2(score, 'event-1'),
  placement: 'before',
  groupId: 'grace-group-1',
  firstEvent
});

test('SSE-03 creates a canonical grace group without changing normal measure occupancy', () => {
  const score = createScoreDocumentV2(scoreRaw());
  const notation = emptyNotationDocumentV2(score);
  const before = occupancy(score);
  const result = executeGraceAuthoringV2(score, notation, createGroupIntent(score), { nextRevisionId: 'rev-2' });
  const voice = result.score.parts[0].staves[0].measures[0].voices[0];
  assert.deepEqual(occupancy(result.score), before);
  assert.equal(voice.graceGroups.length, 1);
  assert.equal(voice.graceGroups[0].anchorEventId, 'event-1');
  assert.equal(voice.graceGroups[0].events[0].id, 'grace-event-1');
  assert.equal(result.score.revision.parentId, 'rev-1');
  assert.equal(result.selectionEntityId, 'grace-group-1');
});

test('SSE-03 session commits grace edits through unified v2 history and undo restores the exact prior pair', () => {
  const score = createScoreDocumentV2(scoreRaw());
  let session = createEditorSessionV2(score, emptyNotationDocumentV2(score));
  session = commitSessionGraceIntentV2(session, createGroupIntent(score), { nextRevisionId: 'rev-2' });
  assert.equal(session.history.past.length, 1);
  assert.equal(session.history.present.score.revision.id, 'rev-2');
  assert.equal(session.selection.primary.kind, 'grace-group');
  assert.equal(session.renderRequest.projectionStatus, 'V2_SEMANTIC_XML');
  assert.equal(typeof session.renderRequest.musicXml, 'string');
  assert.match(session.renderRequest.musicXml, /<grace/);
  session = navigateSessionHistoryV2(session, 'UNDO');
  assert.equal(session.history.present.score.revision.id, 'rev-1');
  assert.equal(session.history.present.score.parts[0].staves[0].measures[0].voices[0].graceGroups.length, 0);
});

test('SSE-03 adds note/rest/chord grace content, reorders it, and edits a grace chord pitch by exact note identity', () => {
  const base = createScoreDocumentV2(scoreRaw());
  let session = createEditorSessionV2(base, emptyNotationDocumentV2(base));
  session = commitSessionGraceIntentV2(session, createGroupIntent(base), { nextRevisionId: 'rev-2' });

  let score = session.history.present.score;
  session = commitSessionGraceIntentV2(session, {
    version: '1.0.0', type: 'ADD_GRACE_EVENT', target: addressEntityV2(score, 'grace-group-1'), index: 1, event: restGrace()
  }, { nextRevisionId: 'rev-3' });

  score = session.history.present.score;
  session = commitSessionGraceIntentV2(session, {
    version: '1.0.0', type: 'ADD_GRACE_EVENT', target: addressEntityV2(score, 'grace-group-1'), index: 2, event: chordGrace()
  }, { nextRevisionId: 'rev-4' });

  score = session.history.present.score;
  session = commitSessionGraceIntentV2(session, {
    version: '1.0.0', type: 'MOVE_GRACE_EVENT', target: addressEntityV2(score, 'grace-chord-1'), toIndex: 0
  }, { nextRevisionId: 'rev-5' });

  score = session.history.present.score;
  session = commitSessionGraceIntentV2(session, {
    version: '1.0.0', type: 'SET_GRACE_NOTE_PITCH', target: addressEntityV2(score, 'grace-chord-1-n2'), pitch: { step: 'A', alter: 0, octave: 4 }
  }, { nextRevisionId: 'rev-6' });

  const events = session.history.present.score.parts[0].staves[0].measures[0].voices[0].graceGroups[0].events;
  assert.deepEqual(events.map((event) => event.kind), ['chord', 'note', 'rest']);
  assert.equal(events[0].notes[1].pitch.step, 'A');
  assert.equal(session.selection.primary.kind, 'grace-note');
  assert.equal(session.selection.primary.graceNoteId, 'grace-chord-1-n2');
});

test('SSE-03 removes events without allowing an empty group and removes a group explicitly', () => {
  const score = createScoreDocumentV2(scoreRaw());
  let first = executeGraceAuthoringV2(score, emptyNotationDocumentV2(score), createGroupIntent(score), { nextRevisionId: 'rev-2' });
  const groupTarget = addressEntityV2(first.score, 'grace-group-1');
  const second = executeGraceAuthoringV2(first.score, first.notation, {
    version: '1.0.0', type: 'ADD_GRACE_EVENT', target: groupTarget, index: 1, event: restGrace()
  }, { nextRevisionId: 'rev-3' });
  const removed = executeGraceAuthoringV2(second.score, second.notation, {
    version: '1.0.0', type: 'REMOVE_GRACE_EVENT', target: addressEntityV2(second.score, 'grace-rest-1')
  }, { nextRevisionId: 'rev-4' });
  assert.equal(removed.score.parts[0].staves[0].measures[0].voices[0].graceGroups[0].events.length, 1);
  assert.throws(() => executeGraceAuthoringV2(removed.score, removed.notation, {
    version: '1.0.0', type: 'REMOVE_GRACE_EVENT', target: addressEntityV2(removed.score, 'grace-event-1')
  }, { nextRevisionId: 'rev-5' }), (error) => error instanceof GraceAuthoringV2Error && error.code === 'EMPTY_GROUP_FORBIDDEN');
  const deleted = executeGraceAuthoringV2(removed.score, removed.notation, {
    version: '1.0.0', type: 'REMOVE_GRACE_GROUP', target: addressEntityV2(removed.score, 'grace-group-1')
  }, { nextRevisionId: 'rev-5' });
  assert.equal(deleted.score.parts[0].staves[0].measures[0].voices[0].graceGroups.length, 0);
  assert.equal(deleted.selectionEntityId, 'event-1');
});

test('SSE-03 stale targets and duplicate IDs fail closed', () => {
  const score = createScoreDocumentV2(scoreRaw());
  const notation = emptyNotationDocumentV2(score);
  const staleAnchor = addressEntityV2(score, 'event-1');
  const first = executeGraceAuthoringV2(score, notation, createGroupIntent(score), { nextRevisionId: 'rev-2' });
  assert.throws(() => executeGraceAuthoringV2(first.score, first.notation, {
    version: '1.0.0', type: 'CREATE_GRACE_GROUP', target: staleAnchor, placement: 'after', groupId: 'grace-group-stale', firstEvent: noteGrace('grace-event-stale','grace-note-stale')
  }, { nextRevisionId: 'rev-3' }), (error) => error instanceof GraceAuthoringV2Error && error.code === 'STALE_TARGET');
  assert.throws(() => executeGraceAuthoringV2(score, notation, createGroupIntent(score, noteGrace('grace-event-dup','note-1')), { nextRevisionId: 'rev-dup' }), (error) => error instanceof GraceAuthoringV2Error && error.code === 'EDIT_REJECTED');
});

test('SSE-03 refuses a replacement that would orphan existing grace-note notation', () => {
  const score = createScoreDocumentV2(scoreRaw());
  const first = executeGraceAuthoringV2(score, emptyNotationDocumentV2(score), createGroupIntent(score), { nextRevisionId: 'rev-2' });
  const notation = createNotationDocumentV2(first.score, {
    contractVersion: '2.0.0', documentId: first.score.id, revisionId: first.score.revision.id,
    measures: [], events: [], notes: [], graceEvents: [],
    graceNotes: [{ target: addressEntityV2(first.score, 'grace-note-1'), notation: { accidental: 'natural', ties: [], slurs: [] } }]
  });
  assert.throws(() => executeGraceAuthoringV2(first.score, notation, {
    version: '1.0.0', type: 'REPLACE_GRACE_EVENT', target: addressEntityV2(first.score, 'grace-event-1'), replacement: restGrace('grace-event-1')
  }, { nextRevisionId: 'rev-3' }), (error) => error instanceof GraceAuthoringV2Error && error.code === 'NOTATION_ORPHAN_RISK');
});
