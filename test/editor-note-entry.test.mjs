import test from 'node:test';
import assert from 'node:assert/strict';

import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { addressEntity } from '../dist/packages/addressing/src/index.js';
import { executeRestNoteEntry, NoteEntryError } from '../dist/packages/editor-note-entry/src/index.js';

const makeDocument = () => createScoreDocument({
  schemaVersion: '1.0.0',
  id: 'doc-note-entry',
  revision: { id: 'rev-1', parentId: null },
  source: { sha256: 'b'.repeat(64), format: 'synthetic', byteLength: null },
  parts: [{
    id: 'part-1', name: 'Piano', staves: [{
      id: 'staff-1', ordinal: 1, measures: [{
        id: 'measure-1', ordinal: 1, displayNumber: '1', voices: [{
          id: 'voice-1', ordinal: 1, events: [
            { id: 'event-note', kind: 'note', onset: { numerator: 0, denominator: 1 }, duration: { numerator: 1, denominator: 2 }, note: { id: 'note-existing', pitch: { step: 'C', alter: 0, octave: 4 } } },
            { id: 'event-rest', kind: 'rest', onset: { numerator: 1, denominator: 2 }, duration: { numerator: 1, denominator: 2 } }
          ]
        }]
      }]
    }]
  }]
});

const entry = (duration, remainderEventId = null, noteId = 'note-new') => ({
  version: '1.0.0',
  type: 'ENTER_NOTE_IN_REST',
  noteId,
  pitch: { step: 'G', alter: 1, octave: 4 },
  duration,
  remainderEventId
});

const identity = (nextRevisionId) => ({ operationId: `op-${nextRevisionId}`, nextRevisionId });
const events = (document) => document.parts[0].staves[0].measures[0].voices[0].events;

test('exact rest-slot note entry preserves event identity and creates a new immutable revision', () => {
  const base = makeDocument();
  const target = addressEntity(base, 'event-rest');
  assert.equal(target.kind, 'event');
  const next = executeRestNoteEntry(base, target, entry({ numerator: 1, denominator: 2 }), identity('rev-2'));
  const inserted = events(next)[1];
  assert.equal(inserted.id, 'event-rest');
  assert.equal(inserted.kind, 'note');
  assert.equal(inserted.note.id, 'note-new');
  assert.deepEqual(inserted.note.pitch, { step: 'G', alter: 1, octave: 4 });
  assert.deepEqual(inserted.onset, { numerator: 1, denominator: 2 });
  assert.deepEqual(inserted.duration, { numerator: 1, denominator: 2 });
  assert.equal(next.revision.id, 'rev-2');
  assert.equal(next.revision.parentId, 'rev-1');
  assert.equal(events(base)[1].kind, 'rest');
  assert.equal(Object.isFrozen(next), true);
});

test('shorter note entry atomically splits the selected rest and preserves total timing', () => {
  const base = makeDocument();
  const target = addressEntity(base, 'event-rest');
  assert.equal(target.kind, 'event');
  const next = executeRestNoteEntry(
    base,
    target,
    entry({ numerator: 1, denominator: 4 }, 'event-tail'),
    identity('rev-split')
  );
  const result = events(next);
  assert.equal(result.length, 3);
  assert.equal(result[1].id, 'event-rest');
  assert.equal(result[1].kind, 'note');
  assert.deepEqual(result[1].onset, { numerator: 1, denominator: 2 });
  assert.deepEqual(result[1].duration, { numerator: 1, denominator: 4 });
  assert.equal(result[2].id, 'event-tail');
  assert.equal(result[2].kind, 'rest');
  assert.deepEqual(result[2].onset, { numerator: 3, denominator: 4 });
  assert.deepEqual(result[2].duration, { numerator: 1, denominator: 4 });
});

test('entry cannot consume more time than the selected rest', () => {
  const base = makeDocument();
  const target = addressEntity(base, 'event-rest');
  assert.equal(target.kind, 'event');
  assert.throws(
    () => executeRestNoteEntry(base, target, entry({ numerator: 3, denominator: 4 }, 'event-tail'), identity('rev-bad')),
    (error) => error instanceof NoteEntryError && error.code === 'DURATION_EXCEEDS_REST'
  );
  assert.equal(events(base)[1].kind, 'rest');
  assert.equal(base.revision.id, 'rev-1');
});

test('split entry requires a fresh unique remainder id', () => {
  const base = makeDocument();
  const target = addressEntity(base, 'event-rest');
  assert.equal(target.kind, 'event');
  assert.throws(
    () => executeRestNoteEntry(base, target, entry({ numerator: 1, denominator: 4 }, null), identity('rev-no-tail')),
    (error) => error instanceof NoteEntryError && error.code === 'REMAINDER_ID_REQUIRED'
  );
  assert.throws(
    () => executeRestNoteEntry(base, target, entry({ numerator: 1, denominator: 4 }, 'event-note'), identity('rev-collision')),
    (error) => error instanceof NoteEntryError && error.code === 'ID_CONFLICT'
  );
});

test('stale event addresses cannot authorize note entry on a newer revision', () => {
  const base = makeDocument();
  const staleTarget = addressEntity(base, 'event-rest');
  assert.equal(staleTarget.kind, 'event');
  const next = executeRestNoteEntry(base, staleTarget, entry({ numerator: 1, denominator: 2 }), identity('rev-2'));
  assert.throws(
    () => executeRestNoteEntry(next, staleTarget, entry({ numerator: 1, denominator: 2 }, null, 'note-other'), identity('rev-3')),
    (error) => error instanceof NoteEntryError && error.code === 'STALE_TARGET'
  );
});
