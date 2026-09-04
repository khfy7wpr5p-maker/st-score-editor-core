import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createActiveStaffAuthoringStandaloneScoreEditorController } from '../dist/packages/score-editor-browser-app/src/active-staff-authoring.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const standardStaves = (documentValue) => documentValue.session.history.present.score.parts[0].staves.filter(staff => staff.role === 'standard');

test('APP-10G new Piano score starts on an exact semantic upper-staff rest without creating history', () => {
  const controller = createActiveStaffAuthoringStandaloneScoreEditorController();
  controller.newDocument({ preset: 'PIANO_GRAND_STAFF' });
  const documentValue = controller.getDocument();
  assert.ok(documentValue);
  const staves = standardStaves(documentValue);
  assert.equal(staves.length, 2);
  assert.equal(documentValue.session.history.past.length, 0);
  assert.equal(documentValue.session.selection?.kind, 'event');
  assert.equal(documentValue.session.selection?.staffId, staves[0].id);
  assert.equal(documentValue.session.selection?.frameId, staves[0].measures[0].frameId);
  assert.deepEqual(controller.getActiveStaffState(), {
    version: '1.0.0',
    activeStaffId: staves[0].id,
    activeStaffOrdinal: 1,
    availableStaffs: [
      { staffId: staves[0].id, ordinal: 1 },
      { staffId: staves[1].id, ordinal: 2 }
    ],
    hasFrameContext: true
  });
  assert.equal(controller.profile.activeStaffCanonicalAuthority, false);
  assert.equal(controller.profile.activeStaffHistoryMutationAuthority, false);
  assert.equal(controller.profile.activeStaffVoiceMaterializationAuthority, false);
  assert.equal(controller.profile.activeStaffRendererCoordinateAuthority, false);
  assert.equal(controller.profile.activeStaffNetworkAuthority, false);
});

test('APP-10G switches Piano staff by same-part same-frame semantic selection and keeps history unchanged', () => {
  const controller = createActiveStaffAuthoringStandaloneScoreEditorController();
  controller.newDocument({ preset: 'PIANO_GRAND_STAFF' });
  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  const [upper, lower] = standardStaves(documentValue);
  assert.ok(upper && lower);
  const frameId = upper.measures[0].frameId;

  controller.setActiveStaff(lower.id);
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(documentValue.session.history.past.length, 0);
  assert.equal(documentValue.session.selection?.kind, 'event');
  assert.equal(documentValue.session.selection?.staffId, lower.id);
  assert.equal(documentValue.session.selection?.frameId, frameId);
  assert.equal(controller.getActiveStaffState().activeStaffOrdinal, 2);

  controller.setActiveStaff(upper.id);
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(documentValue.session.history.past.length, 0);
  assert.equal(documentValue.session.selection?.staffId, upper.id);
  assert.equal(documentValue.session.selection?.frameId, frameId);
});

test('APP-10G explicit lower staff plus Voice 5 authoring stays isolated and staff switching never materializes a missing voice', () => {
  const controller = createActiveStaffAuthoringStandaloneScoreEditorController();
  controller.newDocument({ preset: 'PIANO_GRAND_STAFF' });
  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  const [upper, lower] = standardStaves(documentValue);
  assert.ok(upper && lower);

  controller.setActiveStaff(lower.id);
  controller.setActiveVoice(5);
  controller.setEntryPitch('C', 0, 4);
  controller.setEntryDuration({ numerator: 1, denominator: 4 });
  controller.enterNoteAtSelection();

  documentValue = controller.getDocument();
  assert.ok(documentValue);
  let lowerNow = standardStaves(documentValue)[1];
  let upperNow = standardStaves(documentValue)[0];
  assert.ok(lowerNow && upperNow);
  const lowerVoice5 = lowerNow.measures[0].voices.find(voice => voice.ordinal === 5);
  assert.ok(lowerVoice5);
  assert.equal(lowerVoice5.events.some(event => event.kind === 'note'), true);
  assert.equal(upperNow.measures[0].voices.length, 1);
  assert.equal(documentValue.session.history.past.length, 2);

  controller.setActiveStaff(upperNow.id);
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  upperNow = standardStaves(documentValue)[0];
  lowerNow = standardStaves(documentValue)[1];
  assert.ok(upperNow && lowerNow);
  assert.equal(documentValue.session.history.past.length, 2);
  assert.equal(upperNow.measures[0].voices.length, 1);
  assert.equal(documentValue.session.selection?.kind, 'measure');
  assert.equal(documentValue.session.selection?.staffId, upperNow.id);
  assert.equal(controller.getAuthoringState().activeVoiceOrdinal, 5);
  assert.equal(lowerNow.measures[0].voices.find(voice => voice.ordinal === 5)?.events.some(event => event.kind === 'note'), true);
});

test('APP-10G fails closed without frame context or for a staff outside the selected part', () => {
  const controller = createActiveStaffAuthoringStandaloneScoreEditorController();
  controller.newDocument({ preset: 'PIANO_GRAND_STAFF' });
  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  const part = documentValue.session.history.present.score.parts[0];
  const lower = part.staves.find(staff => staff.role === 'standard' && staff.ordinal === 2);
  assert.ok(lower);
  const historyBefore = documentValue.session.history.past.length;

  controller.select(addressEntityV3(documentValue.session.history.present.score, part.id));
  assert.throws(() => controller.setActiveStaff(lower.id), error => error?.code === 'STAFF_CONTEXT_REQUIRED');

  documentValue = controller.getDocument();
  assert.ok(documentValue);
  const firstEvent = standardStaves(documentValue)[0].measures[0].voices[0].events[0];
  controller.select(addressEntityV3(documentValue.session.history.present.score, firstEvent.id));
  assert.throws(() => controller.setActiveStaff('staff:not-in-part'), error => error?.code === 'STAFF_NOT_AVAILABLE');
  assert.equal(controller.getDocument()?.session.history.past.length, historyBefore);
});
