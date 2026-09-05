import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createExtendedArticulationTogglesStandaloneScoreEditorController } from '../dist/packages/score-editor-browser-app/src/extended-articulation-toggles.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const firstStandardEvent = documentValue => documentValue.session.history.present.score.parts[0].staves
  .find(staff => staff.role === 'standard').measures[0].voices[0].events[0];
const eventArticulations = (documentValue, eventId) => documentValue.session.history.present.notation.events
  .find(entry => entry.target.eventId === eventId)?.notation.articulations ?? [];
const enterC = controller => {
  controller.setEntryPitch('C', 0, 4);
  controller.setEntryDuration({ numerator: 1, denominator: 4 });
  controller.enterNoteAtSelection();
};

test('APP-10N toggles Strong Accent/Staccatissimo/Spiccato through unified V4 history', () => {
  const controller = createExtendedArticulationTogglesStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  assert.equal(controller.getExtendedArticulationTogglesState().canToggleExtendedArticulation, false);
  assert.throws(() => controller.toggleSelectedExtendedArticulation('strong-accent'), error => error?.code === 'PITCHED_EVENT_SELECTION_REQUIRED');

  enterC(controller);
  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  const event = firstStandardEvent(documentValue);
  controller.toggleSelectedExtendedArticulation('strong-accent');
  controller.toggleSelectedExtendedArticulation('staccatissimo');
  controller.toggleSelectedExtendedArticulation('spiccato');
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.deepEqual(eventArticulations(documentValue, event.id), [
    { kind: 'strong-accent', placement: 'auto', direction: null },
    { kind: 'staccatissimo', placement: 'auto', direction: null },
    { kind: 'spiccato', placement: 'auto', direction: null }
  ]);
  assert.deepEqual(controller.getExtendedArticulationTogglesState().activeKinds, ['strong-accent', 'staccatissimo', 'spiccato']);
  assert.equal(documentValue.session.history.past.length, 4);

  controller.toggleSelectedExtendedArticulation('staccatissimo');
  documentValue = controller.getDocument();
  assert.deepEqual(eventArticulations(documentValue, event.id).map(item => item.kind), ['strong-accent', 'spiccato']);
  assert.equal(documentValue.session.history.past.length, 5);
});

test('APP-10N extended articulation participates in EditorSessionV4 undo/redo', () => {
  const controller = createExtendedArticulationTogglesStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  enterC(controller);
  let documentValue = controller.getDocument();
  const eventId = firstStandardEvent(documentValue).id;
  controller.toggleSelectedExtendedArticulation('spiccato');
  assert.equal(eventArticulations(controller.getDocument(), eventId)[0]?.kind, 'spiccato');
  controller.undo();
  assert.deepEqual(eventArticulations(controller.getDocument(), eventId), []);
  controller.redo();
  assert.equal(eventArticulations(controller.getDocument(), eventId)[0]?.kind, 'spiccato');
});

test('APP-10N imported MusicXML strong accent survives lossless export and re-import', async () => {
  const source = createExtendedArticulationTogglesStandaloneScoreEditorController();
  source.newDocument({ preset: 'GUITAR_TREBLE' });
  enterC(source);
  const xml = source.exportMusicXml();

  const controller = createExtendedArticulationTogglesStandaloneScoreEditorController();
  await controller.openMusicXml(xml, { sha256Hex: async () => 'e'.repeat(64) });
  let documentValue = controller.getDocument();
  const event = firstStandardEvent(documentValue);
  controller.select(addressEntityV3(documentValue.session.history.present.score, event.note.id));
  controller.toggleSelectedExtendedArticulation('strong-accent');
  documentValue = controller.getDocument();
  assert.deepEqual(eventArticulations(documentValue, event.id), [
    { kind: 'strong-accent', placement: 'auto', direction: null }
  ]);

  const articulatedXml = controller.exportMusicXml();
  assert.match(articulatedXml, /<strong-accent\/>/);
  const reopened = createExtendedArticulationTogglesStandaloneScoreEditorController();
  await reopened.openMusicXml(articulatedXml, { sha256Hex: async () => 'f'.repeat(64) });
  const reopenedDocument = reopened.getDocument();
  const reopenedEvent = firstStandardEvent(reopenedDocument);
  assert.deepEqual(eventArticulations(reopenedDocument, reopenedEvent.id), [
    { kind: 'strong-accent', placement: 'auto', direction: null }
  ]);
});

test('APP-10N removes one exact imported-style strong accent including direction semantics', () => {
  const controller = createExtendedArticulationTogglesStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  enterC(controller);
  let documentValue = controller.getDocument();
  const event = firstStandardEvent(documentValue);
  const eventAddress = addressEntityV3(documentValue.session.history.present.score, event.id);
  controller.commitArticulation({
    version: '1.0.0',
    type: 'TOGGLE_ARTICULATION',
    target: eventAddress,
    value: { kind: 'strong-accent', placement: 'above', direction: 'up' }
  }, { nextRevisionId: `rev:${crypto.randomUUID()}` });
  assert.deepEqual(controller.getExtendedArticulationTogglesState().activeKinds, ['strong-accent']);
  controller.toggleSelectedExtendedArticulation('strong-accent');
  documentValue = controller.getDocument();
  assert.deepEqual(eventArticulations(documentValue, event.id), []);
});

test('APP-10N ambiguous/unsupported/non-pitched targets fail closed and no extra authority is exposed', () => {
  const controller = createExtendedArticulationTogglesStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  enterC(controller);
  let documentValue = controller.getDocument();
  const event = firstStandardEvent(documentValue);
  let eventAddress = addressEntityV3(documentValue.session.history.present.score, event.id);
  controller.commitArticulation({ version: '1.0.0', type: 'TOGGLE_ARTICULATION', target: eventAddress, value: { kind: 'spiccato', placement: 'above', direction: null } }, { nextRevisionId: `rev:${crypto.randomUUID()}` });
  documentValue = controller.getDocument();
  eventAddress = addressEntityV3(documentValue.session.history.present.score, event.id);
  controller.commitArticulation({ version: '1.0.0', type: 'TOGGLE_ARTICULATION', target: eventAddress, value: { kind: 'spiccato', placement: 'below', direction: null } }, { nextRevisionId: `rev:${crypto.randomUUID()}` });
  assert.deepEqual(controller.getExtendedArticulationTogglesState().ambiguousKinds, ['spiccato']);
  assert.throws(() => controller.toggleSelectedExtendedArticulation('spiccato'), error => error?.code === 'EXTENDED_ARTICULATION_KIND_AMBIGUOUS');
  assert.throws(() => controller.toggleSelectedExtendedArticulation('detached-legato'), error => error?.code === 'UNSUPPORTED_EXTENDED_ARTICULATION_KIND');

  documentValue = controller.getDocument();
  controller.select(addressEntityV3(documentValue.session.history.present.score, documentValue.session.history.present.score.id));
  assert.equal(controller.getExtendedArticulationTogglesState().canToggleExtendedArticulation, false);
  assert.throws(() => controller.toggleSelectedExtendedArticulation('strong-accent'), error => error?.code === 'PITCHED_EVENT_SELECTION_REQUIRED');
  assert.equal(controller.profile.extendedArticulationGraceTargetAuthority, false);
  assert.equal(controller.profile.extendedArticulationRendererCoordinateAuthority, false);
  assert.equal(controller.profile.extendedArticulationTogglesCanonicalAuthority, false);
});
