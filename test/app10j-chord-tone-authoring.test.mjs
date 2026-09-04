import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createChordToneAuthoringStandaloneScoreEditorController } from '../dist/packages/score-editor-browser-app/src/chord-tone-authoring.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const firstStandardEvent = documentValue => documentValue.session.history.present.score.parts[0].staves
  .find(staff => staff.role === 'standard').measures[0].voices[0].events[0];

test('APP-10J exact selected pitched event adds one palette chord tone per action in unified history', () => {
  const controller = createChordToneAuthoringStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  assert.equal(controller.getChordToneAuthoringState().canAddChordTone, false);
  assert.throws(() => controller.addPalettePitchAsChordTone(), error => error?.code === 'PITCHED_EVENT_SELECTION_REQUIRED');

  controller.setEntryPitch('C', 0, 4);
  controller.setEntryDuration({ numerator: 1, denominator: 4 });
  controller.enterNoteAtSelection();
  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  let event = firstStandardEvent(documentValue);
  assert.equal(event.kind, 'note');
  assert.equal(documentValue.session.history.past.length, 1);
  assert.deepEqual(controller.getChordToneAuthoringState(), {
    version: '1.0.0',
    canAddChordTone: true,
    selectedEventKind: 'note',
    selectedToneCount: 1
  });

  controller.setEntryPitch('E', 0, 4);
  controller.addPalettePitchAsChordTone();
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  event = firstStandardEvent(documentValue);
  assert.equal(event.kind, 'chord');
  assert.deepEqual(event.notes.map(note => note.pitch), [
    { step: 'C', alter: 0, octave: 4 },
    { step: 'E', alter: 0, octave: 4 }
  ]);
  assert.equal(documentValue.session.selection?.kind, 'note');
  assert.equal(documentValue.session.selection?.noteId, event.notes[1].id);
  assert.equal(documentValue.session.history.past.length, 2);
  assert.equal(controller.getChordToneAuthoringState().selectedToneCount, 2);

  controller.setEntryPitch('G', 0, 4);
  controller.addPalettePitchAsChordTone();
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  event = firstStandardEvent(documentValue);
  assert.equal(event.kind, 'chord');
  assert.deepEqual(event.notes.map(note => note.pitch), [
    { step: 'C', alter: 0, octave: 4 },
    { step: 'E', alter: 0, octave: 4 },
    { step: 'G', alter: 0, octave: 4 }
  ]);
  assert.equal(documentValue.session.selection?.noteId, event.notes[2].id);
  assert.equal(documentValue.session.history.past.length, 3);

  controller.deleteSelectedPitchedContent();
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  event = firstStandardEvent(documentValue);
  assert.equal(event.kind, 'chord');
  assert.deepEqual(event.notes.map(note => note.pitch), [
    { step: 'C', alter: 0, octave: 4 },
    { step: 'E', alter: 0, octave: 4 }
  ]);
  assert.equal(documentValue.session.history.past.length, 4);
});

test('APP-10J chord-tone add survives undo and redo through the same EditorSessionV4 history', () => {
  const controller = createChordToneAuthoringStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  controller.setEntryPitch('C', 0, 4);
  controller.setEntryDuration({ numerator: 1, denominator: 4 });
  controller.enterNoteAtSelection();
  controller.setEntryPitch('E', 0, 4);
  controller.addPalettePitchAsChordTone();
  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(firstStandardEvent(documentValue).kind, 'chord');

  controller.undo();
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(firstStandardEvent(documentValue).kind, 'note');

  controller.redo();
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  const event = firstStandardEvent(documentValue);
  assert.equal(event.kind, 'chord');
  assert.equal(event.notes.length, 2);
});

test('APP-10J imported MusicXML admits exact chord-tone add and lossless export/re-import', async () => {
  const source = createChordToneAuthoringStandaloneScoreEditorController();
  source.newDocument({ preset: 'GUITAR_TREBLE' });
  source.setEntryPitch('C', 0, 4);
  source.setEntryDuration({ numerator: 1, denominator: 4 });
  source.enterNoteAtSelection();
  const xml = source.exportMusicXml();

  const controller = createChordToneAuthoringStandaloneScoreEditorController();
  await controller.openMusicXml(xml, { sha256Hex: async () => '8'.repeat(64) });
  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(documentValue.origin, 'MUSICXML');
  let event = firstStandardEvent(documentValue);
  assert.equal(event.kind, 'note');
  controller.select(addressEntityV3(documentValue.session.history.present.score, event.note.id));
  controller.setEntryPitch('E', 0, 4);
  controller.addPalettePitchAsChordTone();
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  event = firstStandardEvent(documentValue);
  assert.equal(event.kind, 'chord');
  assert.equal(event.notes.length, 2);

  const chordXml = controller.exportMusicXml();
  const reopened = createChordToneAuthoringStandaloneScoreEditorController();
  await reopened.openMusicXml(chordXml, { sha256Hex: async () => '9'.repeat(64) });
  const reopenedDocument = reopened.getDocument();
  assert.ok(reopenedDocument);
  const reopenedEvent = firstStandardEvent(reopenedDocument);
  assert.equal(reopenedEvent.kind, 'chord');
  assert.deepEqual(reopenedEvent.notes.map(note => note.pitch), [
    { step: 'C', alter: 0, octave: 4 },
    { step: 'E', alter: 0, octave: 4 }
  ]);
});

test('APP-10J non-pitched and non-event semantic selection fails closed without coordinate inference', () => {
  const controller = createChordToneAuthoringStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  const documentValue = controller.getDocument();
  assert.ok(documentValue);
  const score = documentValue.session.history.present.score;
  controller.select(addressEntityV3(score, score.id));
  assert.equal(controller.getChordToneAuthoringState().canAddChordTone, false);
  assert.throws(() => controller.addPalettePitchAsChordTone(), error => error?.code === 'PITCHED_EVENT_SELECTION_REQUIRED');
  assert.equal(controller.profile.chordToneRendererCoordinateAuthority, false);
  assert.equal(controller.profile.chordToneAuthoringCanonicalAuthority, false);
});
