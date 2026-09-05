import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createLocalOrnamentTogglesStandaloneScoreEditorController } from '../dist/packages/score-editor-browser-app/src/local-ornament-toggles.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const firstStandardEvent = documentValue => documentValue.session.history.present.score.parts[0].staves
  .find(staff => staff.role === 'standard').measures[0].voices[0].events[0];
const eventOrnaments = (documentValue, eventId) => documentValue.session.history.present.notation.events
  .find(entry => entry.target.eventId === eventId)?.notation.ornaments ?? [];

const enterC = controller => {
  controller.setEntryPitch('C', 0, 4);
  controller.setEntryDuration({ numerator: 1, denominator: 4 });
  controller.enterNoteAtSelection();
};

test('APP-10L toggles bounded Trill/Turn/Mordent on exact pitched event in unified history', () => {
  const controller = createLocalOrnamentTogglesStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  assert.equal(controller.getLocalOrnamentTogglesState().canToggleLocalOrnament, false);
  assert.throws(() => controller.toggleSelectedLocalOrnament('trill-mark'), error => error?.code === 'PITCHED_EVENT_SELECTION_REQUIRED');

  enterC(controller);
  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  const event = firstStandardEvent(documentValue);
  assert.equal(event.kind, 'note');
  assert.deepEqual(controller.getLocalOrnamentTogglesState(), {
    version: '1.0.0',
    canToggleLocalOrnament: true,
    selectedEventKind: 'note',
    activeKinds: [],
    ambiguousKinds: []
  });

  controller.toggleSelectedLocalOrnament('trill-mark');
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.deepEqual(eventOrnaments(documentValue, event.id), [
    { kind: 'trill-mark', placement: 'auto', accidentalMarks: [] }
  ]);
  assert.deepEqual(controller.getLocalOrnamentTogglesState().activeKinds, ['trill-mark']);
  assert.equal(documentValue.session.history.past.length, 2);

  controller.toggleSelectedLocalOrnament('turn');
  controller.toggleSelectedLocalOrnament('mordent');
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.deepEqual(eventOrnaments(documentValue, event.id), [
    { kind: 'trill-mark', placement: 'auto', accidentalMarks: [] },
    { kind: 'turn', placement: 'auto', accidentalMarks: [] },
    { kind: 'mordent', placement: 'auto', accidentalMarks: [] }
  ]);
  assert.deepEqual(controller.getLocalOrnamentTogglesState().activeKinds, ['trill-mark', 'turn', 'mordent']);
  assert.equal(documentValue.session.history.past.length, 4);

  controller.toggleSelectedLocalOrnament('turn');
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.deepEqual(eventOrnaments(documentValue, event.id).map(item => item.kind), ['trill-mark', 'mordent']);
  assert.deepEqual(controller.getLocalOrnamentTogglesState().activeKinds, ['trill-mark', 'mordent']);
  assert.equal(documentValue.session.history.past.length, 5);
});

test('APP-10L local ornament toggle survives undo/redo through EditorSessionV4', () => {
  const controller = createLocalOrnamentTogglesStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  enterC(controller);
  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  const eventId = firstStandardEvent(documentValue).id;
  controller.toggleSelectedLocalOrnament('trill-mark');
  documentValue = controller.getDocument();
  assert.equal(eventOrnaments(documentValue, eventId)[0]?.kind, 'trill-mark');

  controller.undo();
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.deepEqual(eventOrnaments(documentValue, eventId), []);

  controller.redo();
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(eventOrnaments(documentValue, eventId)[0]?.kind, 'trill-mark');
});

test('APP-10L imported MusicXML local ornament add preserves lossless export and re-import', async () => {
  const source = createLocalOrnamentTogglesStandaloneScoreEditorController();
  source.newDocument({ preset: 'GUITAR_TREBLE' });
  enterC(source);
  const xml = source.exportMusicXml();

  const controller = createLocalOrnamentTogglesStandaloneScoreEditorController();
  await controller.openMusicXml(xml, { sha256Hex: async () => 'c'.repeat(64) });
  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  const event = firstStandardEvent(documentValue);
  controller.select(addressEntityV3(documentValue.session.history.present.score, event.note.id));
  controller.toggleSelectedLocalOrnament('trill-mark');
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.deepEqual(eventOrnaments(documentValue, event.id), [
    { kind: 'trill-mark', placement: 'auto', accidentalMarks: [] }
  ]);

  const ornamentedXml = controller.exportMusicXml();
  const reopened = createLocalOrnamentTogglesStandaloneScoreEditorController();
  await reopened.openMusicXml(ornamentedXml, { sha256Hex: async () => 'd'.repeat(64) });
  const reopenedDocument = reopened.getDocument();
  assert.ok(reopenedDocument);
  const reopenedEvent = firstStandardEvent(reopenedDocument);
  assert.deepEqual(eventOrnaments(reopenedDocument, reopenedEvent.id), [
    { kind: 'trill-mark', placement: 'auto', accidentalMarks: [] }
  ]);
});

test('APP-10L removes exact existing local ornament spec including imported placement/accidental semantics', () => {
  const controller = createLocalOrnamentTogglesStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  enterC(controller);
  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  const event = firstStandardEvent(documentValue);
  const eventAddress = addressEntityV3(documentValue.session.history.present.score, event.id);
  assert.equal(eventAddress.kind, 'event');
  controller.commitOrnament({
    version: '1.0.0',
    type: 'ADD_LOCAL_ORNAMENT',
    target: eventAddress,
    value: { kind: 'trill-mark', placement: 'above', accidentalMarks: [{ accidental: 'sharp', placement: 'above' }] }
  }, { nextRevisionId: `rev:${crypto.randomUUID()}` });
  assert.deepEqual(controller.getLocalOrnamentTogglesState().activeKinds, ['trill-mark']);

  controller.toggleSelectedLocalOrnament('trill-mark');
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.deepEqual(eventOrnaments(documentValue, event.id), []);
});

test('APP-10L ambiguous same-kind local ornament and unsupported/non-pitched targets fail closed', () => {
  const controller = createLocalOrnamentTogglesStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  enterC(controller);
  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  const event = firstStandardEvent(documentValue);
  let eventAddress = addressEntityV3(documentValue.session.history.present.score, event.id);
  assert.equal(eventAddress.kind, 'event');
  controller.commitOrnament({ version: '1.0.0', type: 'ADD_LOCAL_ORNAMENT', target: eventAddress, value: { kind: 'turn', placement: 'above', accidentalMarks: [] } }, { nextRevisionId: `rev:${crypto.randomUUID()}` });
  documentValue = controller.getDocument();
  eventAddress = addressEntityV3(documentValue.session.history.present.score, event.id);
  controller.commitOrnament({ version: '1.0.0', type: 'ADD_LOCAL_ORNAMENT', target: eventAddress, value: { kind: 'turn', placement: 'below', accidentalMarks: [] } }, { nextRevisionId: `rev:${crypto.randomUUID()}` });
  assert.deepEqual(controller.getLocalOrnamentTogglesState().ambiguousKinds, ['turn']);
  assert.throws(() => controller.toggleSelectedLocalOrnament('turn'), error => error?.code === 'LOCAL_ORNAMENT_KIND_AMBIGUOUS');
  assert.throws(() => controller.toggleSelectedLocalOrnament('shake'), error => error?.code === 'UNSUPPORTED_LOCAL_ORNAMENT_KIND');

  documentValue = controller.getDocument();
  const score = documentValue.session.history.present.score;
  controller.select(addressEntityV3(score, score.id));
  assert.equal(controller.getLocalOrnamentTogglesState().canToggleLocalOrnament, false);
  assert.throws(() => controller.toggleSelectedLocalOrnament('trill-mark'), error => error?.code === 'PITCHED_EVENT_SELECTION_REQUIRED');
  assert.equal(controller.profile.localOrnamentSpanningRelationAuthority, false);
  assert.equal(controller.profile.localOrnamentGraceTargetAuthority, false);
  assert.equal(controller.profile.localOrnamentRendererCoordinateAuthority, false);
  assert.equal(controller.profile.localOrnamentTogglesCanonicalAuthority, false);
});
