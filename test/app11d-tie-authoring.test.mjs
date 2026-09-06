import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { SemanticSelectionV4Error } from '../dist/packages/editor-semantic-selection-v4/src/index.js';
import { createTieAuthoringStandaloneScoreEditorController } from '../dist/packages/score-editor-browser-app/src/tie-authoring.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const standardVoice = documentValue => documentValue.session.history.present.score.parts[0].staves.find(staff => staff.role === 'standard').measures[0].voices[0];
const noteEvents = documentValue => standardVoice(documentValue).events.filter(event => event.kind === 'note');
const restEvents = documentValue => standardVoice(documentValue).events.filter(event => event.kind === 'rest');
const tiesFor = (documentValue, noteId) => documentValue.session.history.present.notation.notes.find(entry => entry.target.noteId === noteId)?.notation.ties ?? [];

const makeTwoHalfNotes = () => {
  const controller = createTieAuthoringStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  controller.setEntryPitch('G', 0, 4);
  controller.setEntryDuration({ numerator: 1, denominator: 2 });
  controller.enterNoteAtSelection();

  let documentValue = controller.getDocument();
  const residual = restEvents(documentValue)[0];
  assert.ok(residual);
  controller.select(addressEntityV3(documentValue.session.history.present.score, residual.id));
  controller.setEntryPitch('G', 0, 4);
  controller.setEntryDuration({ numerator: 1, denominator: 2 });
  controller.enterNoteAtSelection();

  documentValue = controller.getDocument();
  assert.equal(noteEvents(documentValue).length, 2);
  assert.equal(restEvents(documentValue).length, 0);
  return controller;
};

const selectNote = (controller, noteId) => {
  const documentValue = controller.getDocument();
  controller.select(addressEntityV3(documentValue.session.history.present.score, noteId));
};

test('APP-11D captures exact tie start without history and commits through existing tie primitive', () => {
  const controller = makeTwoHalfNotes();
  let documentValue = controller.getDocument();
  const [first, second] = noteEvents(documentValue);
  const beforeCaptureHistory = documentValue.session.history.past.length;

  selectNote(controller, first.note.id);
  const captured = controller.captureTieStart();
  assert.equal(captured.pendingStartNoteId, first.note.id);
  assert.equal(captured.canCaptureTieStart, true);
  assert.equal(controller.getDocument().session.history.past.length, beforeCaptureHistory);

  selectNote(controller, second.note.id);
  assert.equal(controller.getTieAuthoringState().canApplyTie, true);
  controller.toggleTieToSelectedNote();

  documentValue = controller.getDocument();
  assert.equal(documentValue.session.history.past.length, beforeCaptureHistory + 1);
  assert.deepEqual(tiesFor(documentValue, first.note.id), [{ number: 1, type: 'start' }]);
  assert.deepEqual(tiesFor(documentValue, second.note.id), [{ number: 1, type: 'stop' }]);
  assert.equal(controller.getTieAuthoringState().pendingStartNoteId, null);
  assert.equal(documentValue.session.selection.kind, 'note');
  assert.equal(documentValue.session.selection.noteId, first.note.id);
});

test('APP-11D same two-step gesture toggles an existing exact tie off and remains undoable', () => {
  const controller = makeTwoHalfNotes();
  let documentValue = controller.getDocument();
  const [first, second] = noteEvents(documentValue);

  selectNote(controller, first.note.id);
  controller.captureTieStart();
  selectNote(controller, second.note.id);
  controller.toggleTieToSelectedNote();
  assert.equal(tiesFor(controller.getDocument(), first.note.id)[0]?.type, 'start');

  selectNote(controller, first.note.id);
  controller.captureTieStart();
  selectNote(controller, second.note.id);
  controller.toggleTieToSelectedNote();
  documentValue = controller.getDocument();
  assert.deepEqual(tiesFor(documentValue, first.note.id), []);
  assert.deepEqual(tiesFor(documentValue, second.note.id), []);

  controller.undo();
  documentValue = controller.getDocument();
  assert.deepEqual(tiesFor(documentValue, first.note.id), [{ number: 1, type: 'start' }]);
  assert.deepEqual(tiesFor(documentValue, second.note.id), [{ number: 1, type: 'stop' }]);
});

test('APP-11D reversed note pair fails closed before history mutation', () => {
  const controller = makeTwoHalfNotes();
  const documentValue = controller.getDocument();
  const [first, second] = noteEvents(documentValue);
  const before = documentValue.session.history.past.length;

  selectNote(controller, second.note.id);
  controller.captureTieStart();
  selectNote(controller, first.note.id);
  assert.equal(controller.getTieAuthoringState().canApplyTie, false);
  assert.throws(
    () => controller.toggleTieToSelectedNote(),
    error => error instanceof SemanticSelectionV4Error && error.code === 'SELECTION_ORDER_INVALID'
  );
  assert.equal(controller.getDocument().session.history.past.length, before);
});

test('APP-11D pending tie start is presentation-only and clears when revision changes', () => {
  const controller = makeTwoHalfNotes();
  let documentValue = controller.getDocument();
  const [first] = noteEvents(documentValue);
  selectNote(controller, first.note.id);
  controller.captureTieStart();
  assert.equal(controller.getTieAuthoringState().pendingStartNoteId, first.note.id);

  controller.commitKeypad(
    { version: '1.0.0', actionId: 'accidental.sharp' },
    null,
    { nextRevisionId: `rev:${crypto.randomUUID()}` }
  );
  documentValue = controller.getDocument();
  assert.equal(documentValue.session.history.present.score.revision.id !== controller.getTieAuthoringState().pendingStartRevisionId, true);
  assert.equal(controller.getTieAuthoringState().pendingStartNoteId, null);
  assert.equal(controller.profile.tieAuthoringCaptureHistoryMutationAuthority, false);
  assert.equal(controller.profile.tieAuthoringRendererCoordinateAuthority, false);
  assert.equal(controller.profile.tieAuthoringNetworkAuthority, false);
});
