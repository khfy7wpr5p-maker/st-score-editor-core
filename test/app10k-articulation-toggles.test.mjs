import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createArticulationTogglesStandaloneScoreEditorController } from '../dist/packages/score-editor-browser-app/src/articulation-toggles.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const firstStandardEvent = documentValue => documentValue.session.history.present.score.parts[0].staves
  .find(staff => staff.role === 'standard').measures[0].voices[0].events[0];
const eventArticulations = (documentValue, eventId) => documentValue.session.history.present.notation.events
  .find(entry => entry.target.eventId === eventId)?.notation.articulations ?? [];

test('APP-10K toggles bounded exact articulations on selected pitched event in unified history', () => {
  const controller = createArticulationTogglesStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  assert.equal(controller.getArticulationTogglesState().canToggleArticulation, false);
  assert.throws(() => controller.toggleSelectedArticulation('staccato'), error => error?.code === 'PITCHED_EVENT_SELECTION_REQUIRED');

  controller.setEntryPitch('C', 0, 4);
  controller.setEntryDuration({ numerator: 1, denominator: 4 });
  controller.enterNoteAtSelection();
  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  const event = firstStandardEvent(documentValue);
  assert.equal(event.kind, 'note');
  assert.deepEqual(controller.getArticulationTogglesState(), {
    version: '1.0.0',
    canToggleArticulation: true,
    selectedEventKind: 'note',
    activeKinds: [],
    ambiguousKinds: []
  });

  controller.toggleSelectedArticulation('staccato');
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.deepEqual(eventArticulations(documentValue, event.id), [
    { kind: 'staccato', placement: 'auto', direction: null }
  ]);
  assert.deepEqual(controller.getArticulationTogglesState().activeKinds, ['staccato']);
  assert.equal(documentValue.session.history.past.length, 2);

  controller.toggleSelectedArticulation('accent');
  controller.toggleSelectedArticulation('tenuto');
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.deepEqual(eventArticulations(documentValue, event.id), [
    { kind: 'staccato', placement: 'auto', direction: null },
    { kind: 'accent', placement: 'auto', direction: null },
    { kind: 'tenuto', placement: 'auto', direction: null }
  ]);
  assert.deepEqual(controller.getArticulationTogglesState().activeKinds, ['staccato', 'accent', 'tenuto']);
  assert.equal(documentValue.session.history.past.length, 4);

  controller.toggleSelectedArticulation('staccato');
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.deepEqual(eventArticulations(documentValue, event.id), [
    { kind: 'accent', placement: 'auto', direction: null },
    { kind: 'tenuto', placement: 'auto', direction: null }
  ]);
  assert.deepEqual(controller.getArticulationTogglesState().activeKinds, ['accent', 'tenuto']);
  assert.equal(documentValue.session.history.past.length, 5);
});

test('APP-10K articulation toggle survives undo and redo through EditorSessionV4', () => {
  const controller = createArticulationTogglesStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  controller.setEntryPitch('C', 0, 4);
  controller.setEntryDuration({ numerator: 1, denominator: 4 });
  controller.enterNoteAtSelection();
  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  const eventId = firstStandardEvent(documentValue).id;
  controller.toggleSelectedArticulation('staccato');
  documentValue = controller.getDocument();
  assert.equal(eventArticulations(documentValue, eventId)[0]?.kind, 'staccato');

  controller.undo();
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.deepEqual(eventArticulations(documentValue, eventId), []);

  controller.redo();
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(eventArticulations(documentValue, eventId)[0]?.kind, 'staccato');
});

test('APP-10K imported MusicXML articulation add preserves lossless export and re-import', async () => {
  const source = createArticulationTogglesStandaloneScoreEditorController();
  source.newDocument({ preset: 'GUITAR_TREBLE' });
  source.setEntryPitch('C', 0, 4);
  source.setEntryDuration({ numerator: 1, denominator: 4 });
  source.enterNoteAtSelection();
  const xml = source.exportMusicXml();

  const controller = createArticulationTogglesStandaloneScoreEditorController();
  await controller.openMusicXml(xml, { sha256Hex: async () => 'a'.repeat(64) });
  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  const event = firstStandardEvent(documentValue);
  controller.select(addressEntityV3(documentValue.session.history.present.score, event.note.id));
  controller.toggleSelectedArticulation('staccato');
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(eventArticulations(documentValue, event.id)[0]?.kind, 'staccato');

  const articulatedXml = controller.exportMusicXml();
  const reopened = createArticulationTogglesStandaloneScoreEditorController();
  await reopened.openMusicXml(articulatedXml, { sha256Hex: async () => 'b'.repeat(64) });
  const reopenedDocument = reopened.getDocument();
  assert.ok(reopenedDocument);
  const reopenedEvent = firstStandardEvent(reopenedDocument);
  assert.deepEqual(eventArticulations(reopenedDocument, reopenedEvent.id), [
    { kind: 'staccato', placement: 'auto', direction: null }
  ]);
});

test('APP-10K removes one exact imported-style articulation spec instead of inventing placement semantics', () => {
  const controller = createArticulationTogglesStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  controller.setEntryPitch('C', 0, 4);
  controller.setEntryDuration({ numerator: 1, denominator: 4 });
  controller.enterNoteAtSelection();
  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  const event = firstStandardEvent(documentValue);
  const eventAddress = addressEntityV3(documentValue.session.history.present.score, event.id);
  assert.equal(eventAddress.kind, 'event');
  controller.commitArticulation({
    version: '1.0.0',
    type: 'TOGGLE_ARTICULATION',
    target: eventAddress,
    value: { kind: 'accent', placement: 'above', direction: null }
  }, { nextRevisionId: `rev:${crypto.randomUUID()}` });
  assert.deepEqual(controller.getArticulationTogglesState().activeKinds, ['accent']);

  controller.toggleSelectedArticulation('accent');
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.deepEqual(eventArticulations(documentValue, event.id), []);
});

test('APP-10K ambiguous same-kind articulation state and non-pitched selection fail closed', () => {
  const controller = createArticulationTogglesStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  controller.setEntryPitch('C', 0, 4);
  controller.setEntryDuration({ numerator: 1, denominator: 4 });
  controller.enterNoteAtSelection();
  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  const event = firstStandardEvent(documentValue);
  let eventAddress = addressEntityV3(documentValue.session.history.present.score, event.id);
  assert.equal(eventAddress.kind, 'event');
  controller.commitArticulation({ version: '1.0.0', type: 'TOGGLE_ARTICULATION', target: eventAddress, value: { kind: 'accent', placement: 'above', direction: null } }, { nextRevisionId: `rev:${crypto.randomUUID()}` });
  documentValue = controller.getDocument();
  eventAddress = addressEntityV3(documentValue.session.history.present.score, event.id);
  controller.commitArticulation({ version: '1.0.0', type: 'TOGGLE_ARTICULATION', target: eventAddress, value: { kind: 'accent', placement: 'below', direction: null } }, { nextRevisionId: `rev:${crypto.randomUUID()}` });
  assert.deepEqual(controller.getArticulationTogglesState().ambiguousKinds, ['accent']);
  assert.throws(() => controller.toggleSelectedArticulation('accent'), error => error?.code === 'ARTICULATION_KIND_AMBIGUOUS');
  assert.throws(() => controller.toggleSelectedArticulation('fermata'), error => error?.code === 'UNSUPPORTED_ARTICULATION_KIND');

  documentValue = controller.getDocument();
  const score = documentValue.session.history.present.score;
  controller.select(addressEntityV3(score, score.id));
  assert.equal(controller.getArticulationTogglesState().canToggleArticulation, false);
  assert.throws(() => controller.toggleSelectedArticulation('staccato'), error => error?.code === 'PITCHED_EVENT_SELECTION_REQUIRED');
  assert.equal(controller.profile.articulationRendererCoordinateAuthority, false);
  assert.equal(controller.profile.articulationTogglesCanonicalAuthority, false);
});
