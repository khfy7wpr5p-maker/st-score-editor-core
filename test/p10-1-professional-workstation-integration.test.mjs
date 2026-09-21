import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { rendererProfileForIntegration } from '../dist/packages/renderer-contract/src/index.js';
import {
  createProfessionalWorkstationStandaloneScoreEditorControllerV1
} from '../dist/packages/score-editor-browser-professional-workstation-v1/src/index.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const standardMeasure = documentValue => {
  const staff = documentValue.session.history.present.score.parts[0]?.staves.find(candidate => candidate.role === 'standard');
  assert.ok(staff);
  const measure = staff.measures[0];
  assert.ok(measure);
  return measure;
};

const firstEvent = documentValue => {
  const event = standardMeasure(documentValue).voices[0]?.events[0];
  assert.ok(event);
  return event;
};

const selectFirstEvent = controller => {
  const documentValue = controller.getDocument();
  assert.ok(documentValue);
  const event = firstEvent(documentValue);
  const address = addressEntityV3(documentValue.session.history.present.score, event.id);
  assert.equal(address.kind, 'event');
  controller.select(address);
  return address;
};

const enterQuarterC = controller => {
  controller.dispatchKeyboardIntent({
    version: '1.0.0',
    type: 'SET_ENTRY_PITCH',
    pitch: { step: 'C', alter: 0, octave: 4 }
  });
  controller.dispatchKeyboardIntent({
    version: '1.0.0',
    type: 'SET_ENTRY_DURATION',
    duration: { numerator: 1, denominator: 4 }
  });
  controller.dispatchKeyboardIntent({ version: '1.0.0', type: 'ENTER_NOTE' });
};

const canonical = documentValue => JSON.stringify({
  score: documentValue.session.history.present.score,
  notation: documentValue.session.history.present.notation
});

const rendererHost = () => ({
  packageName: 'opensheetmusicdisplay',
  packageVersion: '2.1.2',
  license: 'BSD-3-Clause',
  instance: { async load() {}, render() {}, clear() {} }
});

const activeAudioRuntime = auditionResult => Object.freeze({
  supports: capability => capability === 'note-audition',
  unlockFromUserGesture: async () => Object.freeze({ ok: true }),
  setInstrument: async () => undefined,
  getInstrumentProfile: instrumentId => Object.freeze({
    instrumentId,
    displayName: instrumentId,
    lifecycle: 'ACTIVE',
    sampleReadiness: 'QUALIFIED'
  }),
  audition: async () => auditionResult
});

test('P10-1 mixed P09 then P08 edits share one ordered EditorHistoryV4 chain', () => {
  const controller = createProfessionalWorkstationStandaloneScoreEditorControllerV1({
    rendererProfile: rendererProfileForIntegration('st-score-rendering-layer')
  });
  controller.newDocument({ preset: 'GUITAR_TREBLE' });

  const r0Document = controller.getDocument();
  assert.ok(r0Document);
  const r0 = canonical(r0Document);
  assert.equal(r0Document.session.history.past.length, 0);

  selectFirstEvent(controller);
  enterQuarterC(controller);

  const r1Document = controller.getDocument();
  assert.ok(r1Document);
  const r1 = canonical(r1Document);
  assert.equal(r1Document.session.history.past.length, 1);
  assert.notEqual(r1, r0);

  const events = standardMeasure(r1Document).voices[0]?.events ?? [];
  assert.ok(events.length >= 2);
  const firstAddress = addressEntityV3(r1Document.session.history.present.score, events[0].id);
  const lastAddress = addressEntityV3(r1Document.session.history.present.score, events[events.length - 1].id);
  assert.equal(firstAddress.kind, 'event');
  assert.equal(lastAddress.kind, 'event');

  const beforeSelectionPast = r1Document.session.history.past.length;
  const selected = controller.professional.selectEventSpan(firstAddress, lastAddress);
  assert.equal(selected.error, null);
  assert.equal(controller.professional.getProfessionalSelection()?.kind, 'EVENT_SPAN');
  assert.equal(controller.getDocument().session.history.past.length, beforeSelectionPast);

  const cleared = controller.professional.clearToRest({ nextRevisionId: 'p10-1-professional-r2' });
  assert.equal(cleared.error, null);

  const r2Document = controller.getDocument();
  assert.ok(r2Document);
  const r2 = canonical(r2Document);
  assert.equal(r2Document.session.history.past.length, 2);
  assert.notEqual(r2, r1);

  controller.dispatchKeyboardIntent({ version: '1.0.0', type: 'NAVIGATE_HISTORY', direction: 'UNDO' });
  assert.equal(canonical(controller.getDocument()), r1);
  assert.equal(controller.professional.getProfessionalSelection(), null);

  controller.dispatchKeyboardIntent({ version: '1.0.0', type: 'NAVIGATE_HISTORY', direction: 'UNDO' });
  assert.equal(canonical(controller.getDocument()), r0);

  controller.dispatchKeyboardIntent({ version: '1.0.0', type: 'NAVIGATE_HISTORY', direction: 'REDO' });
  assert.equal(canonical(controller.getDocument()), r1);

  controller.dispatchKeyboardIntent({ version: '1.0.0', type: 'NAVIGATE_HISTORY', direction: 'REDO' });
  assert.equal(canonical(controller.getDocument()), r2);
});

test('P10-1 revision-changing keyboard edit clears stale professional selection', () => {
  const controller = createProfessionalWorkstationStandaloneScoreEditorControllerV1();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  selectFirstEvent(controller);
  enterQuarterC(controller);

  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  const events = standardMeasure(documentValue).voices[0]?.events ?? [];
  assert.ok(events.length >= 2);
  const firstAddress = addressEntityV3(documentValue.session.history.present.score, events[0].id);
  const lastAddress = addressEntityV3(documentValue.session.history.present.score, events[events.length - 1].id);
  assert.equal(firstAddress.kind, 'event');
  assert.equal(lastAddress.kind, 'event');

  controller.professional.selectEventSpan(firstAddress, lastAddress);
  assert.equal(controller.professional.getProfessionalSelection()?.kind, 'EVENT_SPAN');

  controller.dispatchKeyboardIntent({
    version: '1.0.0',
    type: 'KEYPAD_ACTION',
    actionId: 'duration.eighth'
  });

  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(documentValue.session.history.past.length, 2);
  assert.equal(controller.professional.getProfessionalSelection(), null);
});

test('P10-1 audio attach/audition/failure is history-neutral and later canonical edit still works', async () => {
  const controller = createProfessionalWorkstationStandaloneScoreEditorControllerV1({
    rendererProfile: rendererProfileForIntegration('st-score-rendering-layer')
  });
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  selectFirstEvent(controller);
  enterQuarterC(controller);

  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  controller.attachOsmdRenderer(rendererHost());
  await controller.renderCurrent();
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  const noteAddress = documentValue.session.renderRequest.manifest.entries.find(entry => entry.address.kind === 'note')?.address;
  assert.ok(noteAddress && noteAddress.kind === 'note');
  const noteRef = controller.resolveRenderedScoreNoteRef(noteAddress);
  assert.ok(noteRef);

  const pastBeforeAudio = documentValue.session.history.past.length;
  controller.attachAudioPort(activeAudioRuntime(Object.freeze({ ok: true })));
  assert.equal(controller.getDocument().session.history.past.length, pastBeforeAudio);

  const played = await controller.selectRenderedScoreNoteRefWithAudition(noteRef);
  assert.equal(played.audioStatus, 'PLAYED');
  assert.equal(controller.getDocument().session.history.past.length, pastBeforeAudio);

  controller.attachAudioPort(activeAudioRuntime(Object.freeze({
    ok: false,
    error: Object.freeze({ code: 'AUDIO_TEST_FAILURE', message: 'synthetic failure' })
  })));
  const failed = await controller.selectRenderedScoreNoteRefWithAudition(noteRef);
  assert.equal(failed.audioStatus, 'FAILED');
  assert.equal(failed.audioError?.code, 'AUDIO_TEST_FAILURE');
  assert.equal(controller.getDocument().session.history.past.length, pastBeforeAudio);

  controller.dispatchKeyboardIntent({
    version: '1.0.0',
    type: 'KEYPAD_ACTION',
    actionId: 'duration.eighth'
  });
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(documentValue.session.history.past.length, pastBeforeAudio + 1);
});
