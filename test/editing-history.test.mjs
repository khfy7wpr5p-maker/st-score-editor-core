import test from 'node:test';
import assert from 'node:assert/strict';

import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { addressEntity } from '../dist/packages/addressing/src/index.js';
import { applyEditTransaction, EditTransactionError } from '../dist/packages/commands/src/index.js';
import { commitHistory, createHistory, redoHistory, undoHistory } from '../dist/packages/history/src/index.js';

const makeDocument = () => createScoreDocument({
  schemaVersion: '1.0.0', id: 'doc-1', revision: { id: 'rev-1', parentId: null },
  source: { sha256: 'a'.repeat(64), format: 'canonical', byteLength: null },
  parts: [{ id: 'part-1', name: 'Piano', staves: [{ id: 'staff-1', ordinal: 1, measures: [{
    id: 'measure-1', ordinal: 1, displayNumber: '1', voices: [{ id: 'voice-1', ordinal: 1, events: [
      { id: 'event-1', kind: 'note', onset: { numerator: 0, denominator: 1 }, duration: { numerator: 1, denominator: 4 }, note: { id: 'note-1', pitch: { step: 'C', alter: 0, octave: 4 } } },
      { id: 'event-2', kind: 'chord', onset: { numerator: 1, denominator: 4 }, duration: { numerator: 1, denominator: 4 }, notes: [
        { id: 'note-2', pitch: { step: 'E', alter: 0, octave: 4 } }, { id: 'note-3', pitch: { step: 'G', alter: 0, octave: 4 } }
      ] },
      { id: 'event-3', kind: 'rest', onset: { numerator: 1, denominator: 2 }, duration: { numerator: 1, denominator: 4 } }
    ] }]
  }] }] }]
});

const tx = (document, nextRevisionId, commands, transactionId = 'tx-1') => ({
  contractVersion: '1.0.0', transactionId, documentId: document.id,
  baseRevisionId: document.revision.id, nextRevisionId, commands
});
const cmd = (commandId, type, target, extra = {}) => ({ commandVersion: '1.0.0', commandId, type, target, ...extra });

const eventById = (document, id) => document.parts[0].staves[0].measures[0].voices[0].events.find((event) => event.id === id);

test('multi-command transaction is atomic and creates a direct immutable revision', () => {
  const base = makeDocument();
  const transaction = tx(base, 'rev-2', [
    cmd('c1', 'SET_NOTE_PITCH', addressEntity(base, 'note-1'), { pitch: { step: 'D', alter: 1, octave: 4 } }),
    cmd('c2', 'SET_EVENT_DURATION', addressEntity(base, 'event-1'), { duration: { numerator: 1, denominator: 8 } })
  ]);
  const next = applyEditTransaction(base, transaction);
  assert.equal(next.revision.id, 'rev-2');
  assert.equal(next.revision.parentId, 'rev-1');
  assert.deepEqual(eventById(next, 'event-1').note.pitch, { step: 'D', alter: 1, octave: 4 });
  assert.deepEqual(eventById(next, 'event-1').duration, { numerator: 1, denominator: 8 });
  assert.deepEqual(eventById(base, 'event-1').note.pitch, { step: 'C', alter: 0, octave: 4 });
  assert.equal(Object.isFrozen(next), true);
});

test('stale transaction cannot be replayed onto a newer revision', () => {
  const base = makeDocument();
  const first = tx(base, 'rev-2', [cmd('c1', 'SET_EVENT_DURATION', addressEntity(base, 'event-1'), { duration: { numerator: 1, denominator: 8 } })]);
  const next = applyEditTransaction(base, first);
  assert.throws(() => applyEditTransaction(next, first), (error) => error instanceof EditTransactionError && error.code === 'STALE_TRANSACTION');
});

test('failed later command returns no partial authoritative result and leaves base unchanged', () => {
  const base = makeDocument();
  const transaction = tx(base, 'rev-bad', [
    cmd('c1', 'SET_NOTE_PITCH', addressEntity(base, 'note-1'), { pitch: { step: 'F', alter: 0, octave: 4 } }),
    cmd('c2', 'REPLACE_REST_WITH_NOTE', addressEntity(base, 'event-1'), { noteId: 'note-new', pitch: { step: 'A', alter: 0, octave: 4 } })
  ]);
  assert.throws(() => applyEditTransaction(base, transaction), (error) => error instanceof EditTransactionError && error.code === 'COMMAND_PRECONDITION');
  assert.equal(eventById(base, 'event-1').note.pitch.step, 'C');
  assert.equal(base.revision.id, 'rev-1');
});

test('note/rest replacement and chord-tone edits remain bounded by event kind', () => {
  const base = makeDocument();
  const restToNote = applyEditTransaction(base, tx(base, 'rev-2', [
    cmd('c1', 'REPLACE_REST_WITH_NOTE', addressEntity(base, 'event-3'), { noteId: 'note-4', pitch: { step: 'B', alter: -1, octave: 3 } })
  ]));
  assert.equal(eventById(restToNote, 'event-3').kind, 'note');
  const withTone = applyEditTransaction(base, tx(base, 'rev-alt', [
    cmd('c2', 'ADD_CHORD_TONE', addressEntity(base, 'event-1'), { noteId: 'note-4', pitch: { step: 'E', alter: 0, octave: 4 } })
  ], 'tx-alt'));
  assert.equal(eventById(withTone, 'event-1').kind, 'chord');
  assert.equal(eventById(withTone, 'event-1').notes.length, 2);
  const reduced = applyEditTransaction(base, tx(base, 'rev-reduce', [
    cmd('c3', 'REMOVE_CHORD_TONE', addressEntity(base, 'note-3'))
  ], 'tx-reduce'));
  assert.equal(eventById(reduced, 'event-2').kind, 'note');
  assert.equal(eventById(reduced, 'event-2').note.id, 'note-2');
});

test('history undo redo follows immutable direct-parent snapshots', () => {
  const base = makeDocument();
  const next = applyEditTransaction(base, tx(base, 'rev-2', [
    cmd('c1', 'REPLACE_EVENT_WITH_REST', addressEntity(base, 'event-1'))
  ]));
  const committed = commitHistory(createHistory(base), next);
  assert.equal(committed.present.revision.id, 'rev-2');
  const undone = undoHistory(committed);
  assert.equal(undone.present.revision.id, 'rev-1');
  assert.equal(eventById(undone.present, 'event-1').kind, 'note');
  const redone = redoHistory(undone);
  assert.equal(redone.present.revision.id, 'rev-2');
  assert.equal(eventById(redone.present, 'event-1').kind, 'rest');
  assert.equal(Object.isFrozen(redone), true);
});

test('a new commit after undo clears the previous redo branch', () => {
  const base = makeDocument();
  const rev2 = applyEditTransaction(base, tx(base, 'rev-2', [cmd('c1','SET_EVENT_DURATION',addressEntity(base,'event-1'),{duration:{numerator:1,denominator:8}})]));
  const undone = undoHistory(commitHistory(createHistory(base), rev2));
  const alternate = applyEditTransaction(base, tx(base, 'rev-2b', [cmd('c2','SET_NOTE_PITCH',addressEntity(base,'note-1'),{pitch:{step:'F',alter:0,octave:4}})], 'tx-2'));
  const branched = commitHistory(undone, alternate);
  assert.equal(branched.future.length, 0);
  assert.equal(branched.present.revision.id, 'rev-2b');
});
