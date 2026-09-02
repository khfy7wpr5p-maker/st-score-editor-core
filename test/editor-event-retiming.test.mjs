import test from 'node:test';
import assert from 'node:assert/strict';

import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { addressEntity } from '../dist/packages/addressing/src/index.js';
import { createNotationDocument } from '../dist/packages/notation-structure/src/index.js';
import {
  executeEventRetiming,
  EventRetimingError
} from '../dist/packages/editor-event-retiming/src/index.js';
import {
  createEditorHistory,
  commitEditorHistory,
  undoEditorHistory,
  redoEditorHistory
} from '../dist/packages/editor-history/src/index.js';

const score = ({ revisionId = 'rev-1', sourceFormat = 'synthetic' } = {}) => createScoreDocument({
  schemaVersion: '1.0.0',
  id: 'doc-retime',
  revision: { id: revisionId, parentId: revisionId === 'rev-1' ? null : 'rev-1' },
  source: { sha256: '5'.repeat(64), format: sourceFormat, byteLength: null },
  parts: [{
    id: 'part-1',
    name: 'Piano',
    staves: [{
      id: 'staff-1',
      ordinal: 1,
      measures: [{
        id: 'measure-1',
        ordinal: 1,
        displayNumber: '1',
        voices: [{
          id: 'voice-1',
          ordinal: 1,
          events: [
            { id: 'event-a', kind: 'note', onset: { numerator: 0, denominator: 1 }, duration: { numerator: 1, denominator: 8 }, note: { id: 'note-a', pitch: { step: 'C', alter: 0, octave: 4 } } },
            { id: 'event-b', kind: 'note', onset: { numerator: 1, denominator: 4 }, duration: { numerator: 1, denominator: 8 }, note: { id: 'note-b', pitch: { step: 'D', alter: 0, octave: 4 } } },
            { id: 'event-c', kind: 'note', onset: { numerator: 1, denominator: 2 }, duration: { numerator: 1, denominator: 8 }, note: { id: 'note-c', pitch: { step: 'E', alter: 0, octave: 4 } } }
          ]
        }]
      }]
    }]
  }]
});

const notation = (s, { eventEntries = [], noteEntries = [] } = {}) => createNotationDocument(s, {
  contractVersion: '1.0.0',
  documentId: s.id,
  revisionId: s.revision.id,
  measures: [{
    target: addressEntity(s, 'measure-1'),
    notation: {
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: null,
      clef: null,
      barlines: []
    }
  }],
  events: eventEntries,
  notes: noteEntries
});

const intent = (s, eventId, newOnset) => ({
  version: '1.0.0',
  type: 'MOVE_EVENT',
  target: addressEntity(s, eventId),
  newOnset
});

const identity = (nextRevisionId = 'rev-2') => ({
  version: '1.0.0',
  operationId: `move-${nextRevisionId}`,
  nextRevisionId
});

const events = (s) => s.parts[0].staves[0].measures[0].voices[0].events;

test('SEC-NE-05 moves an uncoupled event within one voice and deterministically reorders canonical events', () => {
  const base = score();
  const result = executeEventRetiming(
    base,
    notation(base),
    null,
    intent(base, 'event-a', { numerator: 3, denominator: 8 }),
    identity()
  );

  assert.equal(result.score.revision.id, 'rev-2');
  assert.equal(result.score.revision.parentId, 'rev-1');
  assert.deepEqual(events(result.score).map((event) => event.id), ['event-b', 'event-a', 'event-c']);
  assert.deepEqual(events(result.score).find((event) => event.id === 'event-a').onset, { numerator: 3, denominator: 8 });
  assert.equal(result.notation.revisionId, 'rev-2');
  assert.deepEqual(events(base).map((event) => event.id), ['event-a', 'event-b', 'event-c']);
});

test('independent timing veto rejects overlap after retiming', () => {
  const base = score();
  assert.throws(
    () => executeEventRetiming(
      base,
      notation(base),
      null,
      intent(base, 'event-a', { numerator: 1, denominator: 4 }),
      identity('rev-overlap')
    ),
    (error) => error instanceof EventRetimingError && error.code === 'TIMING_REJECTED'
  );
});

test('target event carrying beam or tuplet coupling cannot be moved independently', () => {
  for (const [eventNotation, label] of [
    [{ dots: 0, beams: [{ number: 1, value: 'begin' }], tuplet: null }, 'beam'],
    [{ dots: 0, beams: [], tuplet: { actualNotes: 3, normalNotes: 2, marks: [{ number: 1, type: 'start' }] } }, 'tuplet']
  ]) {
    const base = score();
    const eventAddress = addressEntity(base, 'event-a');
    const n = notation(base, { eventEntries: [{ target: eventAddress, notation: eventNotation }] });
    assert.throws(
      () => executeEventRetiming(base, n, null, intent(base, 'event-a', { numerator: 3, denominator: 8 }), identity(`rev-${label}`)),
      (error) => error instanceof EventRetimingError && error.code === 'COUPLED_NOTATION'
    );
  }
});

test('target note carrying tie or slur coupling cannot be moved independently', () => {
  for (const [field, revision] of [['ties', 'rev-tie'], ['slurs', 'rev-slur']]) {
    const base = score();
    const noteAddress = addressEntity(base, 'note-a');
    const noteNotation = { accidental: null, ties: [], slurs: [] };
    noteNotation[field] = [{ number: 1, type: 'start' }];
    const n = notation(base, { noteEntries: [{ target: noteAddress, notation: noteNotation }] });
    assert.throws(
      () => executeEventRetiming(base, n, null, intent(base, 'event-a', { numerator: 3, denominator: 8 }), identity(revision)),
      (error) => error instanceof EventRetimingError && error.code === 'COUPLED_NOTATION'
    );
  }
});

test('an uncoupled event may not cross another event that carries relation-sensitive notation', () => {
  const base = score();
  const eventB = addressEntity(base, 'event-b');
  const n = notation(base, {
    eventEntries: [{ target: eventB, notation: { dots: 0, beams: [{ number: 1, value: 'begin' }], tuplet: null } }]
  });
  assert.throws(
    () => executeEventRetiming(base, n, null, intent(base, 'event-a', { numerator: 3, denominator: 8 }), identity('rev-cross')), 
    (error) => error instanceof EventRetimingError && error.code === 'CROSSES_COUPLED_EVENT'
  );
});

test('no-op and stale target requests fail closed', () => {
  const base = score();
  assert.throws(
    () => executeEventRetiming(base, notation(base), null, intent(base, 'event-a', { numerator: 0, denominator: 1 }), identity('rev-noop')),
    (error) => error instanceof EventRetimingError && error.code === 'NO_OP'
  );

  const stale = intent(base, 'event-a', { numerator: 3, denominator: 8 });
  stale.target = { ...stale.target, revisionId: 'stale-revision' };
  assert.throws(
    () => executeEventRetiming(base, notation(base), null, stale, identity('rev-stale')),
    (error) => error instanceof EventRetimingError && error.code === 'STALE_TARGET'
  );
});

test('MusicXML-derived retiming requires current 04B1 measure evidence', () => {
  const base = score({ sourceFormat: 'musicxml' });
  assert.throws(
    () => executeEventRetiming(base, notation(base), null, intent(base, 'event-a', { numerator: 3, denominator: 8 }), identity('rev-mxml')),
    (error) => error instanceof EventRetimingError && error.code === 'MISSING_MEASURE_EVIDENCE'
  );
});

test('retiming result composes atomically with unified history undo/redo', () => {
  const base = score();
  const baseNotation = notation(base);
  const result = executeEventRetiming(
    base,
    baseNotation,
    null,
    intent(base, 'event-a', { numerator: 3, denominator: 8 }),
    identity('rev-history')
  );
  const committed = commitEditorHistory(createEditorHistory(base, baseNotation), result.score, result.notation);
  assert.equal(committed.present.score.revision.id, 'rev-history');
  assert.deepEqual(events(committed.present.score).map((event) => event.id), ['event-b', 'event-a', 'event-c']);

  const undone = undoEditorHistory(committed);
  assert.equal(undone.present.score.revision.id, 'rev-1');
  assert.deepEqual(events(undone.present.score).map((event) => event.id), ['event-a', 'event-b', 'event-c']);

  const redone = redoEditorHistory(undone);
  assert.equal(redone.present.score.revision.id, 'rev-history');
  assert.deepEqual(events(redone.present.score).map((event) => event.id), ['event-b', 'event-a', 'event-c']);
});
