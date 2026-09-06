import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { SemanticSelectionV4Error } from '../dist/packages/editor-semantic-selection-v4/src/index.js';
import { createSlurAuthoringStandaloneScoreEditorController } from '../dist/packages/score-editor-browser-app/src/slur-authoring.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const standardVoice = documentValue => documentValue.session.history.present.score.parts[0].staves.find(staff => staff.role === 'standard').measures[0].voices[0];
const noteEvents = documentValue => standardVoice(documentValue).events.filter(event => event.kind === 'note');
const restEvents = documentValue => standardVoice(documentValue).events.filter(event => event.kind === 'rest');
const slursFor = (documentValue, noteId) => documentValue.session.history.present.notation.notes.find(entry => entry.target.noteId === noteId)?.notation.slurs ?? [];

const makeFourQuarterNotes = () => {
  const controller = createSlurAuthoringStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  controller.setEntryDuration({ numerator: 1, denominator: 4 });
  const pitches = ['C', 'D', 'E', 'F'];
  for (let index = 0; index < pitches.length; index += 1) {
    if (index > 0) {
      const documentValue = controller.getDocument();
      const residual = restEvents(documentValue)[0];
      assert.ok(residual);
      controller.select(addressEntityV3(documentValue.session.history.present.score, residual.id));
    }
    controller.setEntryPitch(pitches[index], 0, 4);
    controller.enterNoteAtSelection();
  }
  const documentValue = controller.getDocument();
  assert.equal(noteEvents(documentValue).length, 4);
  assert.equal(restEvents(documentValue).length, 0);
  return controller;
};

const selectNote = (controller, noteId) => {
  const documentValue = controller.getDocument();
  controller.select(addressEntityV3(documentValue.session.history.present.score, noteId));
};

test('APP-11E captures exact slur start without history and admits a different-pitch non-consecutive forward pair', () => {
  const controller = makeFourQuarterNotes();
  let documentValue = controller.getDocument();
  const [first, , third] = noteEvents(documentValue);
  const beforeCaptureHistory = documentValue.session.history.past.length;

  selectNote(controller, first.note.id);
  const captured = controller.captureSlurStart();
  assert.equal(captured.pendingStartNoteId, first.note.id);
  assert.equal(controller.getDocument().session.history.past.length, beforeCaptureHistory);

  selectNote(controller, third.note.id);
  assert.equal(controller.getSlurAuthoringState().canApplySlur, true);
  controller.toggleSlurToSelectedNote();

  documentValue = controller.getDocument();
  assert.equal(documentValue.session.history.past.length, beforeCaptureHistory + 1);
  assert.deepEqual(slursFor(documentValue, first.note.id), [{ number: 1, type: 'start' }]);
  assert.deepEqual(slursFor(documentValue, third.note.id), [{ number: 1, type: 'stop' }]);
  assert.equal(controller.getSlurAuthoringState().pendingStartNoteId, null);
  assert.equal(documentValue.session.selection.kind, 'note');
  assert.equal(documentValue.session.selection.noteId, first.note.id);
  assert.equal(controller.profile.tieAuthoringBundled, true);
  assert.equal(controller.profile.slurAuthoringSamePitchRequired, false);
  assert.equal(controller.profile.slurAuthoringConsecutiveEventsRequired, false);
});

test('APP-11E same two-step gesture toggles an existing exact slur off and remains undoable', () => {
  const controller = makeFourQuarterNotes();
  let documentValue = controller.getDocument();
  const [first, , third] = noteEvents(documentValue);

  selectNote(controller, first.note.id);
  controller.captureSlurStart();
  selectNote(controller, third.note.id);
  controller.toggleSlurToSelectedNote();
  assert.equal(slursFor(controller.getDocument(), first.note.id)[0]?.type, 'start');

  selectNote(controller, first.note.id);
  controller.captureSlurStart();
  selectNote(controller, third.note.id);
  controller.toggleSlurToSelectedNote();
  documentValue = controller.getDocument();
  assert.deepEqual(slursFor(documentValue, first.note.id), []);
  assert.deepEqual(slursFor(documentValue, third.note.id), []);

  controller.undo();
  documentValue = controller.getDocument();
  assert.deepEqual(slursFor(documentValue, first.note.id), [{ number: 1, type: 'start' }]);
  assert.deepEqual(slursFor(documentValue, third.note.id), [{ number: 1, type: 'stop' }]);
});

test('APP-11E reversed note pair fails closed before history mutation', () => {
  const controller = makeFourQuarterNotes();
  const documentValue = controller.getDocument();
  const [first, , third] = noteEvents(documentValue);
  const before = documentValue.session.history.past.length;

  selectNote(controller, third.note.id);
  controller.captureSlurStart();
  selectNote(controller, first.note.id);
  assert.equal(controller.getSlurAuthoringState().canApplySlur, false);
  assert.throws(
    () => controller.toggleSlurToSelectedNote(),
    error => error instanceof SemanticSelectionV4Error && error.code === 'SELECTION_ORDER_INVALID'
  );
  assert.equal(controller.getDocument().session.history.past.length, before);
});

test('APP-11E pending slur start is presentation-only and clears when revision changes', () => {
  const controller = makeFourQuarterNotes();
  let documentValue = controller.getDocument();
  const [first] = noteEvents(documentValue);
  selectNote(controller, first.note.id);
  controller.captureSlurStart();
  assert.equal(controller.getSlurAuthoringState().pendingStartNoteId, first.note.id);

  controller.commitKeypad(
    { version: '1.0.0', actionId: 'accidental.sharp' },
    null,
    { nextRevisionId: `rev:${crypto.randomUUID()}` }
  );
  documentValue = controller.getDocument();
  assert.equal(documentValue.session.history.present.score.revision.id !== controller.getSlurAuthoringState().pendingStartRevisionId, true);
  assert.equal(controller.getSlurAuthoringState().pendingStartNoteId, null);
  assert.equal(controller.profile.slurAuthoringCaptureHistoryMutationAuthority, false);
  assert.equal(controller.profile.slurAuthoringRendererCoordinateAuthority, false);
  assert.equal(controller.profile.slurAuthoringNetworkAuthority, false);
});
