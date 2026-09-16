import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EDITOR_KEYBOARD_INTENT_VERSION,
  EditorKeyboardIntentError,
  dispatchEditorKeyboardIntent,
  editorKeyboardIntentProfile,
  parseEditorKeyboardIntent
} from '../dist/packages/editor-keyboard-intents-v1/src/index.js';

test('P09-B keyboard intent contract is versioned, intent-only and non-authoritative', () => {
  assert.equal(EDITOR_KEYBOARD_INTENT_VERSION, '1.0.0');
  assert.equal(editorKeyboardIntentProfile.intentOnly, true);
  assert.equal(editorKeyboardIntentProfile.canonicalAuthority, false);
  assert.equal(editorKeyboardIntentProfile.historyAuthority, false);
  assert.equal(editorKeyboardIntentProfile.rendererAuthority, false);
  assert.equal(editorKeyboardIntentProfile.cursorAuthority, false);
  assert.equal(editorKeyboardIntentProfile.unknownIntentBehavior, 'REJECT');
});

test('P09-B parses only exact bounded keyboard intents', () => {
  assert.deepEqual(
    parseEditorKeyboardIntent({ version: '1.0.0', type: 'KEYPAD_ACTION', actionId: 'duration.quarter' }),
    { version: '1.0.0', type: 'KEYPAD_ACTION', actionId: 'duration.quarter' }
  );
  assert.deepEqual(
    parseEditorKeyboardIntent({ version: '1.0.0', type: 'SET_ENTRY_PITCH', pitch: { step: 'F', alter: 1, octave: 4 } }),
    { version: '1.0.0', type: 'SET_ENTRY_PITCH', pitch: { step: 'F', alter: 1, octave: 4 } }
  );
  assert.deepEqual(
    parseEditorKeyboardIntent({ version: '1.0.0', type: 'SET_ENTRY_DURATION', duration: { numerator: 1, denominator: 8 } }),
    { version: '1.0.0', type: 'SET_ENTRY_DURATION', duration: { numerator: 1, denominator: 8 } }
  );
  assert.deepEqual(
    parseEditorKeyboardIntent({ version: '1.0.0', type: 'SET_ACTIVE_VOICE', voice: 5 }),
    { version: '1.0.0', type: 'SET_ACTIVE_VOICE', voice: 5 }
  );
  assert.deepEqual(
    parseEditorKeyboardIntent({ version: '1.0.0', type: 'ENTER_NOTE' }),
    { version: '1.0.0', type: 'ENTER_NOTE' }
  );
  assert.deepEqual(
    parseEditorKeyboardIntent({ version: '1.0.0', type: 'NAVIGATE_MEASURE', direction: 'NEXT' }),
    { version: '1.0.0', type: 'NAVIGATE_MEASURE', direction: 'NEXT' }
  );
  assert.deepEqual(
    parseEditorKeyboardIntent({ version: '1.0.0', type: 'NAVIGATE_HISTORY', direction: 'UNDO' }),
    { version: '1.0.0', type: 'NAVIGATE_HISTORY', direction: 'UNDO' }
  );
});

test('P09-B rejects unknown versions, extra fields and out-of-bounds values', () => {
  const invalid = [
    { version: '2.0.0', type: 'ENTER_NOTE' },
    { version: '1.0.0', type: 'ENTER_NOTE', hiddenCursor: true },
    { version: '1.0.0', type: 'KEYPAD_ACTION', actionId: 'duration.128th' },
    { version: '1.0.0', type: 'SET_ENTRY_PITCH', pitch: { step: 'H', alter: 0, octave: 4 } },
    { version: '1.0.0', type: 'SET_ENTRY_DURATION', duration: { numerator: 2, denominator: 8 } },
    { version: '1.0.0', type: 'SET_ACTIVE_VOICE', voice: 6 },
    { version: '1.0.0', type: 'NAVIGATE_MEASURE', direction: 'LEFT' },
    { version: '1.0.0', type: 'NAVIGATE_HISTORY', direction: 'RESET' }
  ];

  for (const value of invalid) {
    assert.throws(() => parseEditorKeyboardIntent(value), error => {
      assert.ok(error instanceof EditorKeyboardIntentError);
      assert.equal(error.code, 'INVALID_INTENT');
      return true;
    });
  }
});

test('P09-B dispatcher only routes to supplied existing-authority sink methods', () => {
  const calls = [];
  const sink = {
    applyKeypadAction: action => calls.push(['keypad', action]),
    setEntryPitch: (step, alter, octave) => calls.push(['pitch', step, alter, octave]),
    setEntryDuration: duration => calls.push(['duration', duration]),
    setActiveVoice: voice => calls.push(['voice', voice]),
    enterNoteAtSelection: () => calls.push(['enter']),
    navigateMeasure: direction => calls.push(['measure', direction]),
    navigateHistory: direction => calls.push(['history', direction])
  };

  dispatchEditorKeyboardIntent({ version: '1.0.0', type: 'KEYPAD_ACTION', actionId: 'accidental.sharp' }, sink);
  dispatchEditorKeyboardIntent({ version: '1.0.0', type: 'SET_ENTRY_PITCH', pitch: { step: 'C', alter: 0, octave: 4 } }, sink);
  dispatchEditorKeyboardIntent({ version: '1.0.0', type: 'SET_ENTRY_DURATION', duration: { numerator: 1, denominator: 4 } }, sink);
  dispatchEditorKeyboardIntent({ version: '1.0.0', type: 'SET_ACTIVE_VOICE', voice: 2 }, sink);
  dispatchEditorKeyboardIntent({ version: '1.0.0', type: 'ENTER_NOTE' }, sink);
  dispatchEditorKeyboardIntent({ version: '1.0.0', type: 'NAVIGATE_MEASURE', direction: 'PREVIOUS' }, sink);
  dispatchEditorKeyboardIntent({ version: '1.0.0', type: 'NAVIGATE_HISTORY', direction: 'REDO' }, sink);

  assert.deepEqual(calls, [
    ['keypad', { version: '1.0.0', actionId: 'accidental.sharp' }],
    ['pitch', 'C', 0, 4],
    ['duration', { numerator: 1, denominator: 4 }],
    ['voice', 2],
    ['enter'],
    ['measure', 'PREVIOUS'],
    ['history', 'REDO']
  ]);
});

test('P09-B dispatcher rejects incomplete sink before routing', () => {
  assert.throws(
    () => dispatchEditorKeyboardIntent(
      { version: '1.0.0', type: 'ENTER_NOTE' },
      /** @type {any} */ ({ enterNoteAtSelection: () => {} })
    ),
    error => {
      assert.ok(error instanceof EditorKeyboardIntentError);
      assert.equal(error.code, 'INVALID_SINK');
      return true;
    }
  );
});
