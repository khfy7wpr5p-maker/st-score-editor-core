import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import {
  createKeyboardWorkstationStandaloneScoreEditorController,
  keyboardWorkstationBrowserAppProfile
} from '../dist/packages/score-editor-browser-app/src/keyboard-workstation.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const firstStandardMeasure = documentValue => {
  const staff = documentValue.session.history.present.score.parts[0]?.staves.find(candidate => candidate.role === 'standard');
  assert.ok(staff);
  const measure = staff.measures[0];
  assert.ok(measure);
  return measure;
};

const selectFirstEvent = controller => {
  const documentValue = controller.getDocument();
  assert.ok(documentValue);
  const event = firstStandardMeasure(documentValue).voices[0]?.events[0];
  assert.ok(event);
  const address = addressEntityV3(documentValue.session.history.present.score, event.id);
  assert.equal(address.kind, 'event');
  const snapshot = controller.select(address);
  assert.equal(snapshot.error, null);
};

const enterQuarterC = controller => {
  controller.dispatchKeyboardIntent({
    version: '1.0.0', type: 'SET_ENTRY_PITCH', pitch: { step: 'C', alter: 0, octave: 4 }
  });
  controller.dispatchKeyboardIntent({
    version: '1.0.0', type: 'SET_ENTRY_DURATION', duration: { numerator: 1, denominator: 4 }
  });
  controller.dispatchKeyboardIntent({ version: '1.0.0', type: 'ENTER_NOTE' });
};

test('P09-D workstation is a non-authoritative composition over the existing standalone controller', () => {
  assert.equal(keyboardWorkstationBrowserAppProfile.keyboardWorkstationBundled, true);
  assert.equal(keyboardWorkstationBrowserAppProfile.keyboardWorkstationCanonicalAuthority, false);
  assert.equal(keyboardWorkstationBrowserAppProfile.keyboardWorkstationHistoryAuthority, false);
  assert.equal(keyboardWorkstationBrowserAppProfile.keyboardWorkstationRendererAuthority, false);
  assert.equal(keyboardWorkstationBrowserAppProfile.keyboardWorkstationCursorAuthority, false);
  assert.equal(keyboardWorkstationBrowserAppProfile.keyboardWorkstationMutationRouting, 'existing-controller-session-authorities');

  const controller = createKeyboardWorkstationStandaloneScoreEditorController();
  assert.equal(controller.getKeyboardWorkstationState().intentVersion, '1.0.0');
  assert.equal(controller.getKeyboardWorkstationState().bindingCount, 6);
  assert.equal(controller.getAudioHostState().instrumentId, 'GRAND_PIANO');
});

test('P09-D newDocument initial anchor is one-shot and explicit selection clear remains null', () => {
  const controller = createKeyboardWorkstationStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });

  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(documentValue.session.selection?.kind, 'event');
  assert.equal(documentValue.session.history.past.length, 0);

  controller.select(null);

  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(documentValue.session.selection, null);
  assert.equal(documentValue.session.history.past.length, 0);
});

test('P09-D keyboard note entry reuses the explicit-rest authoring path and rebound selection', () => {
  const controller = createKeyboardWorkstationStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  selectFirstEvent(controller);

  const before = controller.getDocument();
  assert.ok(before);
  assert.equal(firstStandardMeasure(before).voices[0]?.events[0]?.kind, 'rest');

  enterQuarterC(controller);

  const after = controller.getDocument();
  assert.ok(after);
  const event = firstStandardMeasure(after).voices[0]?.events[0];
  assert.equal(event?.kind, 'note');
  assert.deepEqual(event?.note.pitch, { step: 'C', alter: 0, octave: 4 });
  assert.deepEqual(event?.duration, { numerator: 1, denominator: 4 });
  assert.equal(after.session.history.past.length, before.session.history.past.length + 1);
  assert.equal(after.session.selection?.kind, 'note');
  assert.equal(after.session.selection?.eventId, event?.id);
  assert.equal(after.session.selection?.revisionId, after.session.history.present.score.revision.id);
});

test('P09-D selected-note keypad edit is one history revision and exact Undo/Redo restores the canonical pair with selection cleared', () => {
  const controller = createKeyboardWorkstationStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  selectFirstEvent(controller);
  enterQuarterC(controller);

  const beforeEdit = controller.getDocument();
  assert.ok(beforeEdit);
  const beforePair = structuredClone(beforeEdit.session.history.present);
  const beforePast = beforeEdit.session.history.past.length;
  const beforeEvent = firstStandardMeasure(beforeEdit).voices[0]?.events[0];
  assert.equal(beforeEvent?.kind, 'note');

  controller.dispatchKeyboardIntent({ version: '1.0.0', type: 'KEYPAD_ACTION', actionId: 'duration.eighth' });
  const edited = controller.getDocument();
  assert.ok(edited);
  const editedPair = structuredClone(edited.session.history.present);
  const event = firstStandardMeasure(edited).voices[0]?.events[0];
  assert.equal(event?.kind, 'note');
  assert.deepEqual(event?.duration, { numerator: 1, denominator: 8 });
  assert.equal(edited.session.history.past.length, beforePast + 1);
  assert.equal(edited.session.selection?.kind, 'note');
  assert.equal(edited.session.selection?.eventId, event?.id);
  assert.equal(edited.session.selection?.revisionId, edited.session.history.present.score.revision.id);

  controller.dispatchKeyboardIntent({ version: '1.0.0', type: 'NAVIGATE_HISTORY', direction: 'UNDO' });
  const undone = controller.getDocument();
  assert.ok(undone);
  assert.deepEqual(undone.session.history.present, beforePair);
  const undoneEvent = firstStandardMeasure(undone).voices[0]?.events[0];
  assert.equal(undoneEvent?.kind, 'note');
  assert.equal(undone.session.selection, null);

  controller.dispatchKeyboardIntent({ version: '1.0.0', type: 'NAVIGATE_HISTORY', direction: 'REDO' });
  const redone = controller.getDocument();
  assert.ok(redone);
  assert.deepEqual(redone.session.history.present, editedPair);
  const redoneEvent = firstStandardMeasure(redone).voices[0]?.events[0];
  assert.equal(redoneEvent?.kind, 'note');
  assert.equal(redone.session.selection, null);
});

test('P09-D previous/next measure intents reuse semantic measure navigation without creating history', () => {
  const controller = createKeyboardWorkstationStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  controller.appendMeasure();

  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  const score = documentValue.session.history.present.score;
  assert.equal(score.measureFrames.length, 2);
  const staff = score.parts[0]?.staves.find(candidate => candidate.role === 'standard');
  assert.ok(staff);
  const secondEvent = staff.measures[1]?.voices[0]?.events[0];
  assert.ok(secondEvent);
  controller.select(addressEntityV3(score, secondEvent.id));
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  const pastBeforeNavigation = documentValue.session.history.past.length;

  controller.dispatchKeyboardIntent({ version: '1.0.0', type: 'NAVIGATE_MEASURE', direction: 'PREVIOUS' });
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(documentValue.session.selection?.frameId, score.measureFrames[0]?.id);
  assert.equal(documentValue.session.history.past.length, pastBeforeNavigation);

  controller.dispatchKeyboardIntent({ version: '1.0.0', type: 'NAVIGATE_MEASURE', direction: 'NEXT' });
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(documentValue.session.selection?.frameId, score.measureFrames[1]?.id);
  assert.equal(documentValue.session.history.past.length, pastBeforeNavigation);
});

test('P09-D rejected selected-score edit with no semantic selection does not mutate the canonical pair', () => {
  const controller = createKeyboardWorkstationStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  controller.select(null);
  const before = controller.getDocument();
  assert.ok(before);
  assert.equal(before.session.selection, null);
  const pair = structuredClone(before.session.history.present);
  const past = before.session.history.past.length;

  assert.throws(
    () => controller.dispatchKeyboardIntent({ version: '1.0.0', type: 'KEYPAD_ACTION', actionId: 'duration.eighth' }),
    error => error?.code === 'NO_SELECTION'
  );

  const after = controller.getDocument();
  assert.ok(after);
  assert.deepEqual(after.session.history.present, pair);
  assert.equal(after.session.history.past.length, past);
  assert.equal(after.session.selection, null);
});
