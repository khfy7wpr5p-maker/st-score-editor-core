import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createExplicitAccidentalsStandaloneScoreEditorController } from '../dist/packages/score-editor-browser-app/src/explicit-accidentals.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const firstStandardEvent = documentValue => documentValue.session.history.present.score.parts[0].staves
  .find(staff => staff.role === 'standard').measures[0].voices[0].events[0];
const noteNotation = (documentValue, noteId) => documentValue.session.history.present.notation.notes
  .find(entry => entry.target.noteId === noteId)?.notation ?? null;

const enterC = controller => {
  controller.setEntryPitch('C', 0, 4);
  controller.setEntryDuration({ numerator: 1, denominator: 4 });
  controller.enterNoteAtSelection();
};

test('APP-10M sets Flat/Natural/Sharp atomically on exact selected note through unified history', () => {
  const controller = createExplicitAccidentalsStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  assert.equal(controller.getExplicitAccidentalsState().canSetExplicitAccidental, false);
  assert.throws(() => controller.setSelectedExplicitAccidental('sharp'), error => error?.code === 'EXACT_NOTE_SELECTION_REQUIRED');

  enterC(controller);
  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  let event = firstStandardEvent(documentValue);
  assert.equal(event.kind, 'note');
  assert.deepEqual(controller.getExplicitAccidentalsState(), {
    version: '1.0.0',
    canSetExplicitAccidental: true,
    selectedPitch: { step: 'C', alter: 0, octave: 4 },
    explicitAccidental: null
  });

  controller.setSelectedExplicitAccidental('sharp');
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  event = firstStandardEvent(documentValue);
  assert.equal(event.kind, 'note');
  assert.deepEqual(event.note.pitch, { step: 'C', alter: 1, octave: 4 });
  assert.equal(noteNotation(documentValue, event.note.id)?.accidental, 'sharp');
  assert.equal(controller.getExplicitAccidentalsState().explicitAccidental, 'sharp');
  assert.equal(documentValue.session.history.past.length, 2);

  controller.setSelectedExplicitAccidental('natural');
  documentValue = controller.getDocument();
  event = firstStandardEvent(documentValue);
  assert.deepEqual(event.note.pitch, { step: 'C', alter: 0, octave: 4 });
  assert.equal(noteNotation(documentValue, event.note.id)?.accidental, 'natural');
  assert.equal(documentValue.session.history.past.length, 3);

  controller.setSelectedExplicitAccidental('flat');
  documentValue = controller.getDocument();
  event = firstStandardEvent(documentValue);
  assert.deepEqual(event.note.pitch, { step: 'C', alter: -1, octave: 4 });
  assert.equal(noteNotation(documentValue, event.note.id)?.accidental, 'flat');
  assert.equal(documentValue.session.history.past.length, 4);
});

test('APP-10M explicit accidental survives undo/redo and preserves note step/octave', () => {
  const controller = createExplicitAccidentalsStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  enterC(controller);
  controller.setSelectedExplicitAccidental('sharp');
  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  let event = firstStandardEvent(documentValue);
  assert.deepEqual(event.note.pitch, { step: 'C', alter: 1, octave: 4 });

  controller.undo();
  documentValue = controller.getDocument();
  event = firstStandardEvent(documentValue);
  assert.deepEqual(event.note.pitch, { step: 'C', alter: 0, octave: 4 });
  assert.equal(noteNotation(documentValue, event.note.id), null);

  controller.redo();
  documentValue = controller.getDocument();
  event = firstStandardEvent(documentValue);
  assert.deepEqual(event.note.pitch, { step: 'C', alter: 1, octave: 4 });
  assert.equal(noteNotation(documentValue, event.note.id)?.accidental, 'sharp');
});

test('APP-10M chord accidental mutates only exact selected tone', () => {
  const controller = createExplicitAccidentalsStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  enterC(controller);
  controller.setEntryPitch('E', 0, 4);
  controller.addPalettePitchAsChordTone();
  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  let event = firstStandardEvent(documentValue);
  assert.equal(event.kind, 'chord');
  assert.equal(documentValue.session.selection?.kind, 'note');
  assert.equal(documentValue.session.selection?.noteId, event.notes[1].id);

  controller.setSelectedExplicitAccidental('sharp');
  documentValue = controller.getDocument();
  event = firstStandardEvent(documentValue);
  assert.equal(event.kind, 'chord');
  assert.deepEqual(event.notes.map(note => note.pitch), [
    { step: 'C', alter: 0, octave: 4 },
    { step: 'E', alter: 1, octave: 4 }
  ]);
  assert.equal(noteNotation(documentValue, event.notes[0].id), null);
  assert.equal(noteNotation(documentValue, event.notes[1].id)?.accidental, 'sharp');

  controller.select(addressEntityV3(documentValue.session.history.present.score, event.notes[0].id));
  controller.setSelectedExplicitAccidental('flat');
  documentValue = controller.getDocument();
  event = firstStandardEvent(documentValue);
  assert.deepEqual(event.notes.map(note => note.pitch), [
    { step: 'C', alter: -1, octave: 4 },
    { step: 'E', alter: 1, octave: 4 }
  ]);
  assert.equal(noteNotation(documentValue, event.notes[0].id)?.accidental, 'flat');
  assert.equal(noteNotation(documentValue, event.notes[1].id)?.accidental, 'sharp');
});

test('APP-10M imported MusicXML explicit accidental survives lossless export/re-import', async () => {
  const source = createExplicitAccidentalsStandaloneScoreEditorController();
  source.newDocument({ preset: 'GUITAR_TREBLE' });
  enterC(source);
  source.setSelectedExplicitAccidental('sharp');
  const xml = source.exportMusicXml();

  const controller = createExplicitAccidentalsStandaloneScoreEditorController();
  await controller.openMusicXml(xml, { sha256Hex: async () => 'e'.repeat(64) });
  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  let event = firstStandardEvent(documentValue);
  assert.equal(event.kind, 'note');
  assert.deepEqual(event.note.pitch, { step: 'C', alter: 1, octave: 4 });
  assert.equal(noteNotation(documentValue, event.note.id)?.accidental, 'sharp');

  controller.select(addressEntityV3(documentValue.session.history.present.score, event.note.id));
  controller.setSelectedExplicitAccidental('natural');
  documentValue = controller.getDocument();
  event = firstStandardEvent(documentValue);
  assert.deepEqual(event.note.pitch, { step: 'C', alter: 0, octave: 4 });
  assert.equal(noteNotation(documentValue, event.note.id)?.accidental, 'natural');

  const naturalXml = controller.exportMusicXml();
  const reopened = createExplicitAccidentalsStandaloneScoreEditorController();
  await reopened.openMusicXml(naturalXml, { sha256Hex: async () => 'f'.repeat(64) });
  const reopenedDocument = reopened.getDocument();
  assert.ok(reopenedDocument);
  const reopenedEvent = firstStandardEvent(reopenedDocument);
  assert.deepEqual(reopenedEvent.note.pitch, { step: 'C', alter: 0, octave: 4 });
  assert.equal(noteNotation(reopenedDocument, reopenedEvent.note.id)?.accidental, 'natural');
});

test('APP-10M non-note and unsupported targets fail closed without advanced keypad or renderer inference', () => {
  const controller = createExplicitAccidentalsStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  enterC(controller);
  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  const event = firstStandardEvent(documentValue);
  controller.select(addressEntityV3(documentValue.session.history.present.score, event.id));
  assert.equal(controller.getExplicitAccidentalsState().canSetExplicitAccidental, false);
  assert.throws(() => controller.setSelectedExplicitAccidental('sharp'), error => error?.code === 'EXACT_NOTE_SELECTION_REQUIRED');
  assert.throws(() => controller.setSelectedExplicitAccidental('double-sharp'), error => error?.code === 'UNSUPPORTED_EXPLICIT_ACCIDENTAL_KIND');
  assert.equal(controller.profile.explicitAccidentalAdvancedKeypadTargetAuthority, false);
  assert.equal(controller.profile.explicitAccidentalStepOctaveMutationAuthority, false);
  assert.equal(controller.profile.explicitAccidentalRendererCoordinateAuthority, false);
  assert.equal(controller.profile.explicitAccidentalsCanonicalAuthority, false);
});
