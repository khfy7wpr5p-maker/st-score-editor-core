import test from 'node:test';
import assert from 'node:assert/strict';

import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { addressEntity, createSelectionSnapshot } from '../dist/packages/addressing/src/index.js';
import { createNotationDocument, notationForEvent, notationForNote } from '../dist/packages/notation-structure/src/index.js';
import { serializeNotationMusicXml } from '../dist/packages/musicxml/src/index.js';
import { commitEditorHistory, createEditorHistory, undoEditorHistory } from '../dist/packages/editor-history/src/index.js';
import {
  EditorKeypadExecutionError,
  executeEditorKeypadAction,
  parseEditorKeypadCommitIdentity
} from '../dist/packages/editor-keypad-execution/src/index.js';

const score = ({ kind = 'note', duration = { numerator: 1, denominator: 4 } } = {}) => createScoreDocument({
  schemaVersion: '1.0.0',
  id: 'doc-1',
  revision: { id: 'rev-1', parentId: null },
  source: { sha256: 'a'.repeat(64), format: 'canonical', byteLength: null },
  parts: [{
    id: 'part-1',
    name: 'Part',
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
          events: [kind === 'rest'
            ? { id: 'event-1', kind: 'rest', onset: { numerator: 0, denominator: 1 }, duration }
            : { id: 'event-1', kind: 'note', onset: { numerator: 0, denominator: 1 }, duration, note: { id: 'note-1', pitch: { step: 'C', alter: 0, octave: 4 } } }
          ]
        }]
      }]
    }]
  }]
});

const notation = (s, { dots = 0, noteMetadata = true } = {}) => createNotationDocument(s, {
  contractVersion: '1.0.0',
  documentId: s.id,
  revisionId: s.revision.id,
  measures: [],
  events: [{
    target: addressEntity(s, 'event-1'),
    notation: { dots, beams: [], tuplet: null }
  }],
  notes: noteMetadata && s.parts[0].staves[0].measures[0].voices[0].events[0].kind !== 'rest' ? [{
    target: addressEntity(s, 'note-1'),
    notation: { accidental: 'natural', ties: [{ number: 1, type: 'start' }], slurs: [{ number: 1, type: 'start' }] }
  }] : []
});

const selectionFor = (s) => {
  const event = s.parts[0].staves[0].measures[0].voices[0].events[0];
  return createSelectionSnapshot(s, addressEntity(s, event.kind === 'rest' ? 'event-1' : 'note-1'));
};

const identity = (transactionId, nextRevisionId) => ({ version: '1.0.0', transactionId, nextRevisionId });
const action = (actionId) => ({ version: '1.0.0', actionId });
const eventOf = (s) => s.parts[0].staves[0].measures[0].voices[0].events[0];

const run = (s, n, selection, actionId, transactionId, nextRevisionId) =>
  executeEditorKeypadAction(s, n, selection, action(actionId), identity(transactionId, nextRevisionId));

test('SEC-KP-02 simple duration commits score plus undotted notation as one unified revision and undo is exact', () => {
  const s = score();
  const n = notation(s, { dots: 0 });
  const result = run(s, n, selectionFor(s), 'duration.eighth', 'kp-duration', 'rev-2');

  assert.deepEqual(eventOf(result.score).duration, { numerator: 1, denominator: 8 });
  assert.equal(notationForEvent(result.notation, 'event-1').dots, 0);
  assert.equal(result.score.revision.id, 'rev-2');
  assert.equal(result.notation.revisionId, 'rev-2');
  assert.equal(result.score.revision.parentId, 'rev-1');
  assert.equal(s.revision.id, 'rev-1');
  assert.equal(n.revisionId, 'rev-1');

  const committed = commitEditorHistory(createEditorHistory(s, n), result.score, result.notation);
  assert.equal(committed.past.length, 1);
  const undone = undoEditorHistory(committed);
  assert.deepEqual(undone.present.score, s);
  assert.deepEqual(undone.present.notation, n);
});

test('SEC-KP-02 note to requested rest duration is atomic and explicitly removes notation for deleted note identity only', () => {
  const s = score();
  const n = notation(s, { dots: 1, noteMetadata: true });
  const result = run(s, n, selectionFor(s), 'rest.eighth', 'kp-rest', 'rev-rest');

  assert.equal(eventOf(result.score).kind, 'rest');
  assert.deepEqual(eventOf(result.score).duration, { numerator: 1, denominator: 8 });
  assert.equal(notationForEvent(result.notation, 'event-1').dots, 0);
  assert.equal(notationForNote(result.notation, 'note-1'), null);
  assert.equal(result.score.revision.id, result.notation.revisionId);

  const history = commitEditorHistory(createEditorHistory(s, n), result.score, result.notation);
  const undone = undoEditorHistory(history);
  assert.deepEqual(undone.present.score, s);
  assert.deepEqual(undone.present.notation, n);
});

test('SEC-KP-02 selected rest changes duration without inventing a note identity', () => {
  const s = score({ kind: 'rest', duration: { numerator: 1, denominator: 4 } });
  const n = notation(s, { dots: 0, noteMetadata: false });
  const result = run(s, n, selectionFor(s), 'rest.16th', 'kp-existing-rest', 'rev-rest-2');

  assert.equal(eventOf(result.score).kind, 'rest');
  assert.deepEqual(eventOf(result.score).duration, { numerator: 1, denominator: 16 });
  assert.equal(result.notation.notes.length, 0);
  assert.equal(result.score.revision.id, result.notation.revisionId);
});

test('SEC-KP-03 accidental actions change canonical alter and display metadata together without respelling step or octave', () => {
  for (const [actionId, alter, display] of [
    ['accidental.flat', -1, 'flat'],
    ['accidental.natural', 0, 'natural'],
    ['accidental.sharp', 1, 'sharp']
  ]) {
    const s = score();
    const n = notation(s);
    const result = run(s, n, selectionFor(s), actionId, `kp-${display}`, `rev-${display}`);
    const note = eventOf(result.score).note;
    assert.equal(note.pitch.step, 'C');
    assert.equal(note.pitch.octave, 4);
    assert.equal(note.pitch.alter, alter);
    assert.equal(notationForNote(result.notation, 'note-1').accidental, display);
    assert.equal(result.score.revision.id, result.notation.revisionId);
  }
});

test('SEC-KP-04 dot actions preserve the admitted base value while changing exact canonical timing and notation metadata', () => {
  const s = score();
  const n = notation(s, { dots: 0 });
  const first = run(s, n, selectionFor(s), 'dot.set.1', 'kp-dot-1', 'rev-dot-1');
  assert.deepEqual(eventOf(first.score).duration, { numerator: 3, denominator: 8 });
  assert.equal(notationForEvent(first.notation, 'event-1').dots, 1);

  const freshSelection = createSelectionSnapshot(first.score, addressEntity(first.score, 'note-1'));
  const second = run(first.score, first.notation, freshSelection, 'dot.set.2', 'kp-dot-2', 'rev-dot-2');
  assert.deepEqual(eventOf(second.score).duration, { numerator: 7, denominator: 16 });
  assert.equal(notationForEvent(second.notation, 'event-1').dots, 2);

  const xml = serializeNotationMusicXml(second.score, second.notation);
  assert.equal((xml.match(/<dot\/>/g) ?? []).length, 2);
  assert.ok(xml.includes('<duration>7</duration>'));
});

test('SEC-KP-04 dot removal restores the base duration', () => {
  const s = score({ duration: { numerator: 3, denominator: 8 } });
  const n = notation(s, { dots: 1 });
  const result = run(s, n, selectionFor(s), 'dot.set.0', 'kp-dot-remove', 'rev-dot-remove');
  assert.deepEqual(eventOf(result.score).duration, { numerator: 1, denominator: 4 });
  assert.equal(notationForEvent(result.notation, 'event-1').dots, 0);
});

test('inconsistent duration and dot metadata fail closed instead of guessing a base value', () => {
  const s = score({ duration: { numerator: 1, denominator: 4 } });
  const n = notation(s, { dots: 1 });
  assert.throws(
    () => run(s, n, selectionFor(s), 'dot.set.2', 'kp-bad-dot', 'rev-bad-dot'),
    (error) => error instanceof EditorKeypadExecutionError && error.code === 'DURATION_DOT_INCONSISTENCY'
  );
  assert.equal(s.revision.id, 'rev-1');
  assert.equal(n.revisionId, 'rev-1');
});

test('stale selection is rejected and no automatic retargeting occurs', () => {
  const s = score();
  const n = notation(s);
  const oldSelection = selectionFor(s);
  const first = run(s, n, oldSelection, 'duration.eighth', 'kp-first', 'rev-2');
  assert.throws(
    () => run(first.score, first.notation, oldSelection, 'duration.16th', 'kp-stale', 'rev-3'),
    (error) => error instanceof EditorKeypadExecutionError && error.code === 'STALE_SELECTION'
  );
});

test('tuplet tie and slur remain admitted descriptors but execution fails closed until their explicit target contracts are implemented', () => {
  const s = score();
  const n = notation(s);
  for (const actionId of ['tuplet.triplet', 'tie.edit', 'slur.edit']) {
    assert.throws(
      () => run(s, n, selectionFor(s), actionId, `kp-${actionId}`, `rev-${actionId}`),
      (error) => error instanceof EditorKeypadExecutionError && error.code === 'ACTION_NOT_IMPLEMENTED'
    );
  }
});

test('commit identity uses exact bounded fields', () => {
  assert.deepEqual(parseEditorKeypadCommitIdentity(identity('kp-ok', 'rev-ok')), identity('kp-ok', 'rev-ok'));
  assert.throws(
    () => parseEditorKeypadCommitIdentity({ ...identity('kp', 'rev'), extra: true }),
    (error) => error instanceof EditorKeypadExecutionError && error.code === 'INVALID_COMMIT_IDENTITY'
  );
  assert.throws(
    () => parseEditorKeypadCommitIdentity(identity('x'.repeat(97), 'rev')),
    (error) => error instanceof EditorKeypadExecutionError && error.code === 'INVALID_COMMIT_IDENTITY'
  );
});
