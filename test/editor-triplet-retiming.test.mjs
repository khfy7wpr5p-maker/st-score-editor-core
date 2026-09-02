import test from 'node:test';
import assert from 'node:assert/strict';

import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { addressEntity } from '../dist/packages/addressing/src/index.js';
import { createNotationDocument, notationForEvent } from '../dist/packages/notation-structure/src/index.js';
import { executeTripletRetiming, TripletRetimingError } from '../dist/packages/editor-triplet-retiming/src/index.js';
import { createEditorHistory, commitEditorHistory, undoEditorHistory, redoEditorHistory } from '../dist/packages/editor-history/src/index.js';

const score = () => createScoreDocument({
  schemaVersion: '1.0.0',
  id: 'doc-triplet-move',
  revision: { id: 'rev-1', parentId: null },
  source: { sha256: '6'.repeat(64), format: 'synthetic', byteLength: null },
  parts: [{ id: 'part-1', name: 'Piano', staves: [{ id: 'staff-1', ordinal: 1, measures: [{
    id: 'measure-1', ordinal: 1, displayNumber: '1', voices: [{ id: 'voice-1', ordinal: 1, events: [
      { id: 'event-1', kind: 'note', onset: { numerator: 0, denominator: 1 }, duration: { numerator: 1, denominator: 6 }, note: { id: 'note-1', pitch: { step: 'C', alter: 0, octave: 4 } } },
      { id: 'event-2', kind: 'note', onset: { numerator: 1, denominator: 6 }, duration: { numerator: 1, denominator: 6 }, note: { id: 'note-2', pitch: { step: 'D', alter: 0, octave: 4 } } },
      { id: 'event-3', kind: 'note', onset: { numerator: 1, denominator: 3 }, duration: { numerator: 1, denominator: 6 }, note: { id: 'note-3', pitch: { step: 'E', alter: 0, octave: 4 } } },
      { id: 'event-4', kind: 'note', onset: { numerator: 3, denominator: 4 }, duration: { numerator: 1, denominator: 8 }, note: { id: 'note-4', pitch: { step: 'G', alter: 0, octave: 4 } } }
    ] }]
  }] }] }]
});

const tripletNotation = (s, { beams = false, ties = false } = {}) => createNotationDocument(s, {
  contractVersion: '1.0.0', documentId: s.id, revisionId: s.revision.id,
  measures: [{ target: addressEntity(s, 'measure-1'), notation: { timeSignature: { beats: 4, beatType: 4 }, keySignature: null, clef: null, barlines: [] } }],
  events: [
    { target: addressEntity(s, 'event-1'), notation: { dots: 0, beams: beams ? [{ number: 1, value: 'begin' }] : [], tuplet: { actualNotes: 3, normalNotes: 2, marks: [{ number: 1, type: 'start' }] } } },
    { target: addressEntity(s, 'event-2'), notation: { dots: 0, beams: beams ? [{ number: 1, value: 'continue' }] : [], tuplet: { actualNotes: 3, normalNotes: 2, marks: [] } } },
    { target: addressEntity(s, 'event-3'), notation: { dots: 0, beams: beams ? [{ number: 1, value: 'end' }] : [], tuplet: { actualNotes: 3, normalNotes: 2, marks: [{ number: 1, type: 'stop' }] } } }
  ],
  notes: ties ? [
    { target: addressEntity(s, 'note-1'), notation: { accidental: null, ties: [{ number: 1, type: 'start' }], slurs: [] } }
  ] : []
});

const targets = (s) => ['event-1', 'event-2', 'event-3'].map((id) => addressEntity(s, id));
const intent = (s, onset = { numerator: 1, denominator: 4 }) => ({ version: '1.0.0', type: 'MOVE_TRIPLET_GROUP', targets: targets(s), newStartOnset: onset });
const identity = (nextRevisionId = 'rev-2') => ({ version: '1.0.0', operationId: `triplet-${nextRevisionId}`, nextRevisionId });
const events = (s) => s.parts[0].staves[0].measures[0].voices[0].events;

test('SEC-NE-05 atomically retimes the exact supported 3:2 triplet group', () => {
  const base = score();
  const result = executeTripletRetiming(base, tripletNotation(base), null, intent(base), identity());
  assert.equal(result.score.revision.id, 'rev-2');
  assert.deepEqual(events(result.score).slice(0, 3).map((event) => [event.id, event.onset]), [
    ['event-1', { numerator: 1, denominator: 4 }],
    ['event-2', { numerator: 5, denominator: 12 }],
    ['event-3', { numerator: 7, denominator: 12 }]
  ]);
  assert.equal(notationForEvent(result.notation, 'event-1').tuplet.actualNotes, 3);
  assert.deepEqual(events(base).slice(0, 3).map((event) => event.onset), [
    { numerator: 0, denominator: 1 }, { numerator: 1, denominator: 6 }, { numerator: 1, denominator: 3 }
  ]);
});

test('atomic triplet retiming rejects overlap with an unrelated event', () => {
  const base = score();
  assert.throws(
    () => executeTripletRetiming(base, tripletNotation(base), null, intent(base, { numerator: 1, denominator: 2 }), identity('rev-overlap')),
    (error) => error instanceof TripletRetimingError && error.code === 'TIMING_REJECTED'
  );
});

test('triplet group must be exact, consecutive and complete', () => {
  const base = score();
  const invalid = intent(base);
  invalid.targets = [addressEntity(base, 'event-1'), addressEntity(base, 'event-2'), addressEntity(base, 'event-4')];
  assert.throws(
    () => executeTripletRetiming(base, tripletNotation(base), null, invalid, identity('rev-range')),
    (error) => error instanceof TripletRetimingError && error.code === 'RANGE_NOT_EXACT'
  );
});

test('beam or tie/slur coupling keeps triplet retiming fail-closed in v1', () => {
  for (const [n, revision] of [[tripletNotation(score(), { beams: true }), 'rev-beam'], [tripletNotation(score(), { ties: true }), 'rev-tie']]) {
    const base = score();
    const rebound = createNotationDocument(base, {
      ...n,
      documentId: base.id,
      revisionId: base.revision.id,
      measures: n.measures.map((entry) => ({ target: addressEntity(base, entry.target.measureId), notation: entry.notation })),
      events: n.events.map((entry) => ({ target: addressEntity(base, entry.target.eventId), notation: entry.notation })),
      notes: n.notes.map((entry) => ({ target: addressEntity(base, entry.target.noteId), notation: entry.notation }))
    });
    assert.throws(
      () => executeTripletRetiming(base, rebound, null, intent(base), identity(revision)),
      (error) => error instanceof TripletRetimingError && error.code === 'COUPLED_NOTATION_UNSUPPORTED'
    );
  }
});

test('triplet retiming commits and restores as one unified history revision', () => {
  const base = score();
  const n = tripletNotation(base);
  const result = executeTripletRetiming(base, n, null, intent(base), identity('rev-history'));
  const committed = commitEditorHistory(createEditorHistory(base, n), result.score, result.notation);
  assert.equal(committed.present.score.revision.id, 'rev-history');
  const undone = undoEditorHistory(committed);
  assert.equal(undone.present.score.revision.id, 'rev-1');
  const redone = redoEditorHistory(undone);
  assert.equal(redone.present.score.revision.id, 'rev-history');
  assert.deepEqual(events(redone.present.score)[0].onset, { numerator: 1, denominator: 4 });
});
