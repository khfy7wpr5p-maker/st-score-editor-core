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

const tripletTimedMusicXml = (count = 3) => {
  const pitches = ['C', 'D', 'E', 'F'].slice(0, count);
  const noteXml = pitches.map(step => `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><type>eighth</type></note>`).join('');
  const restDuration = 12 - count;
  return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Part</part-name></score-part></part-list>
  <part id="P1"><measure number="1">
    <attributes><divisions>3</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
    ${noteXml}<note><rest/><duration>${restDuration}</duration><voice>1</voice></note>
  </measure></part>
</score-partwise>`;
};

const openTripletTimedNotes = async (count = 3) => {
  const controller = createTripletAuthoringStandaloneScoreEditorController();
  const xml = tripletTimedMusicXml(count);
  await controller.openLocalFile({
    name: 'app11f-triplet-fixture.musicxml',
    size: new TextEncoder().encode(xml).byteLength,
    type: 'application/vnd.recordare.musicxml+xml',
    text: async () => xml
  });
  const documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(notes(documentValue).length, count);
  assert.deepEqual(notes(documentValue).map(event => event.duration), Array.from({ length: count }, () => ({ numerator: 1, denominator: 12 })));
  return controller;
};

const selectNote = (controller, noteId) => {
  const documentValue = controller.getDocument();
  controller.select(addressEntityV3(documentValue.session.history.present.score, noteId));
};

test('APP-11F captures three exact contiguous note-parent events without history and applies existing 3:2 triplet metadata', async () => {
  const controller = await openTripletTimedNotes(3);
  let documentValue = controller.getDocument();
  const events = notes(documentValue);
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

test('APP-11F refuses a non-contiguous second capture before history mutation', async () => {
  const controller = await openTripletTimedNotes(4);
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

test('APP-11F pending explicit range clears on revision change', async () => {
  const controller = await openTripletTimedNotes(3);
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
