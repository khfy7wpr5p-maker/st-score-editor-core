import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { SemanticSelectionV4Error } from '../dist/packages/editor-semantic-selection-v4/src/index.js';
import { createTripletAuthoringStandaloneScoreEditorController } from '../dist/packages/score-editor-browser-app/src/triplet-authoring.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const voice = documentValue => documentValue.session.history.present.score.parts[0].staves.find(staff => staff.role === 'standard').measures[0].voices[0];
const notes = documentValue => voice(documentValue).events.filter(event => event.kind === 'note');
const rests = documentValue => voice(documentValue).events.filter(event => event.kind === 'rest');
const tupletFor = (documentValue, eventId) => documentValue.session.history.present.notation.events.find(entry => entry.target.eventId === eventId)?.notation.tuplet ?? null;

const makeTripletTimedNotes = (count = 3) => {
  const controller = createTripletAuthoringStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  controller.setEntryDuration({ numerator: 1, denominator: 12 });
  const pitches = ['C', 'D', 'E', 'F'];
  for (let index = 0; index < count; index += 1) {
    if (index > 0) {
      const documentValue = controller.getDocument();
      const rest = rests(documentValue)[0];
      assert.ok(rest);
      controller.select(addressEntityV3(documentValue.session.history.present.score, rest.id));
    }
    controller.setEntryPitch(pitches[index], 0, 4);
    controller.enterNoteAtSelection();
  }
  return controller;
};

const selectNote = (controller, noteId) => {
  const documentValue = controller.getDocument();
  controller.select(addressEntityV3(documentValue.session.history.present.score, noteId));
};

test('APP-11F captures three exact contiguous note-parent events without history and applies existing 3:2 triplet metadata', () => {
  const controller = makeTripletTimedNotes(3);
  let documentValue = controller.getDocument();
  const events = notes(documentValue);
  assert.equal(events.length, 3);
  const beforeCaptureHistory = documentValue.session.history.past.length;

  for (const event of events) {
    selectNote(controller, event.note.id);
    controller.captureTripletEvent();
  }
  assert.deepEqual(controller.getTripletAuthoringState().capturedEventIds, events.map(event => event.id));
  assert.equal(controller.getDocument().session.history.past.length, beforeCaptureHistory);
  assert.equal(controller.getTripletAuthoringState().canApplyTriplet, true);

  controller.applyTripletToCapturedEvents();
  documentValue = controller.getDocument();
  assert.equal(documentValue.session.history.past.length, beforeCaptureHistory + 1);
  assert.deepEqual(tupletFor(documentValue, events[0].id), { actualNotes: 3, normalNotes: 2, marks: [{ number: 1, type: 'start' }] });
  assert.deepEqual(tupletFor(documentValue, events[1].id), { actualNotes: 3, normalNotes: 2, marks: [] });
  assert.deepEqual(tupletFor(documentValue, events[2].id), { actualNotes: 3, normalNotes: 2, marks: [{ number: 1, type: 'stop' }] });
  assert.deepEqual(controller.getTripletAuthoringState().capturedEventIds, []);
  assert.equal(controller.profile.tripletAuthoringRetimingAuthority, false);
  assert.equal(controller.profile.tripletAuthoringRemovalAuthority, false);
  assert.equal(controller.profile.slurAuthoringBundled, true);
});

test('APP-11F refuses a non-contiguous second capture before history mutation', () => {
  const controller = makeTripletTimedNotes(4);
  const documentValue = controller.getDocument();
  const events = notes(documentValue);
  const before = documentValue.session.history.past.length;
  selectNote(controller, events[0].note.id);
  controller.captureTripletEvent();
  selectNote(controller, events[2].note.id);
  assert.equal(controller.getTripletAuthoringState().canCaptureEvent, false);
  assert.throws(
    () => controller.captureTripletEvent(),
    error => error instanceof SemanticSelectionV4Error && error.code === 'RANGE_NOT_CONTIGUOUS'
  );
  assert.equal(controller.getDocument().session.history.past.length, before);
  assert.deepEqual(controller.getTripletAuthoringState().capturedEventIds, [events[0].id]);
});

test('APP-11F ordinary straight eighth-note timing fails closed because controller has no retiming authority', () => {
  const controller = createTripletAuthoringStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  controller.setEntryDuration({ numerator: 1, denominator: 8 });
  for (const pitch of ['C', 'D', 'E']) {
    if (pitch !== 'C') {
      const documentValue = controller.getDocument();
      controller.select(addressEntityV3(documentValue.session.history.present.score, rests(documentValue)[0].id));
    }
    controller.setEntryPitch(pitch, 0, 4);
    controller.enterNoteAtSelection();
  }
  const documentValue = controller.getDocument();
  const events = notes(documentValue);
  const before = documentValue.session.history.past.length;
  for (const event of events) {
    selectNote(controller, event.note.id);
    controller.captureTripletEvent();
  }
  assert.throws(() => controller.applyTripletToCapturedEvents(), error => error?.code === 'TUPLET_TIMING_INCONSISTENT');
  assert.equal(controller.getDocument().session.history.past.length, before);
  assert.equal(controller.profile.tripletAuthoringCreationPolicy, 'existing-canonical-3-in-the-time-of-2-only');
});

test('APP-11F pending explicit range clears on revision change', () => {
  const controller = makeTripletTimedNotes(3);
  let documentValue = controller.getDocument();
  const first = notes(documentValue)[0];
  selectNote(controller, first.note.id);
  controller.captureTripletEvent();
  assert.deepEqual(controller.getTripletAuthoringState().capturedEventIds, [first.id]);

  controller.commitKeypad(
    { version: '1.0.0', actionId: 'accidental.sharp' },
    null,
    { nextRevisionId: `rev:${crypto.randomUUID()}` }
  );
  assert.deepEqual(controller.getTripletAuthoringState().capturedEventIds, []);
  assert.equal(controller.profile.tripletAuthoringCaptureHistoryMutationAuthority, false);
  assert.equal(controller.profile.tripletAuthoringRendererCoordinateAuthority, false);
  assert.equal(controller.profile.tripletAuthoringNetworkAuthority, false);
});
