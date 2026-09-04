import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createSelectedNoteEditingStandaloneScoreEditorController } from '../dist/packages/score-editor-browser-app/src/selected-note-editing.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const firstStandardMeasure = (documentValue) => {
  const staff = documentValue.session.history.present.score.parts[0]?.staves[0];
  assert.ok(staff && staff.role !== 'tablature-linked');
  const measure = staff.measures[0];
  assert.ok(measure);
  return measure;
};

const selectFirstEvent = (controller) => {
  const documentValue = controller.getDocument();
  assert.ok(documentValue);
  const event = firstStandardMeasure(documentValue).voices[0]?.events[0];
  assert.ok(event);
  const address = addressEntityV3(documentValue.session.history.present.score, event.id);
  assert.equal(address.kind, 'event');
  controller.select(address);
};

test('APP-10F exact selected note supports independent pitch, duration, delete and unified undo', () => {
  const controller = createSelectedNoteEditingStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  selectFirstEvent(controller);

  controller.setEntryPitch('C', 0, 4);
  controller.setEntryDuration({ numerator: 1, denominator: 4 });
  controller.enterNoteAtSelection();

  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(documentValue.session.history.past.length, 1);
  assert.equal(documentValue.session.selection?.kind, 'note');
  assert.deepEqual(controller.getSelectedNoteEditingState(), {
    version: '1.0.0', canApplyPitch: true, canApplyDuration: true, canDelete: true,
    selectedEventKind: 'note', deleteScope: 'NOTE_EVENT'
  });

  controller.setEntryPitch('G', 1, 5);
  controller.applyPalettePitchToSelection();
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(documentValue.session.history.past.length, 2);
  let event = firstStandardMeasure(documentValue).voices[0]?.events[0];
  assert.equal(event?.kind, 'note');
  assert.deepEqual(event.note.pitch, { step: 'G', alter: 1, octave: 5 });

  controller.setEntryDuration({ numerator: 1, denominator: 8 });
  controller.applyPaletteDurationToSelection();
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(documentValue.session.history.past.length, 3);
  event = firstStandardMeasure(documentValue).voices[0]?.events[0];
  assert.deepEqual(event?.duration, { numerator: 1, denominator: 8 });

  controller.deleteSelectedPitchedContent();
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(documentValue.session.history.past.length, 4);
  event = firstStandardMeasure(documentValue).voices[0]?.events[0];
  assert.equal(event?.kind, 'rest');
  assert.equal(controller.getSelectedNoteEditingState().canDelete, false);

  controller.undo();
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  event = firstStandardMeasure(documentValue).voices[0]?.events[0];
  assert.equal(event?.kind, 'note');
  assert.deepEqual(event?.duration, { numerator: 1, denominator: 8 });
  assert.deepEqual(event?.note.pitch, { step: 'G', alter: 1, octave: 5 });
});

test('APP-10F deleting an exact selected chord tone preserves the other tone instead of deleting the chord event', () => {
  const controller = createSelectedNoteEditingStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  selectFirstEvent(controller);
  controller.setEntryPitch('C', 0, 4);
  controller.setEntryDuration({ numerator: 1, denominator: 4 });
  controller.enterNoteAtSelection();

  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  const selected = documentValue.session.selection;
  assert.equal(selected?.kind, 'note');
  const eventAddress = addressEntityV3(documentValue.session.history.present.score, selected.eventId);
  assert.equal(eventAddress.kind, 'event');
  const chordToneId = `note:app10f-chord-tone`;
  const result = controller.commitBasic({
    version: '1.0.0',
    type: 'ADD_CHORD_TONE',
    target: eventAddress,
    noteId: chordToneId,
    pitch: { step: 'E', alter: 0, octave: 4 }
  }, { nextRevisionId: 'rev:app10f-chord' });
  assert.equal(result.error, null);

  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(documentValue.session.selection?.kind, 'note');
  assert.equal(documentValue.session.selection?.noteId, chordToneId);
  assert.equal(controller.getSelectedNoteEditingState().deleteScope, 'CHORD_TONE');

  controller.deleteSelectedPitchedContent();
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  const event = firstStandardMeasure(documentValue).voices[0]?.events[0];
  assert.equal(event?.kind, 'note');
  assert.deepEqual(event.note.pitch, { step: 'C', alter: 0, octave: 4 });
  assert.equal(documentValue.session.selection?.kind, 'note');
  assert.notEqual(documentValue.session.selection?.noteId, chordToneId);
});

test('APP-10F refuses pitch editing without an exact note target and keeps renderer coordinates non-authoritative', () => {
  const controller = createSelectedNoteEditingStandaloneScoreEditorController();
  assert.equal(controller.profile.selectedNoteEditingCanonicalAuthority, false);
  assert.equal(controller.profile.selectedEditingRendererCoordinateAuthority, false);
  assert.equal(controller.profile.selectedEditingNetworkAuthority, false);
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  selectFirstEvent(controller);
  assert.equal(controller.getSelectedNoteEditingState().canApplyPitch, false);
  assert.throws(() => controller.applyPalettePitchToSelection(), error => error?.code === 'PITCHED_EVENT_SELECTION_REQUIRED');
});
