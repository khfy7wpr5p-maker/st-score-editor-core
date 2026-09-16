import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_EDITOR_KEYBOARD_BINDINGS_V1,
  EditorKeyboardBrowserError,
  createEditorKeyboardBindingsV1,
  createEditorKeyboardBrowserAdapterV1,
  editorKeyboardBrowserProfileV1,
  isEditorKeyboardEditableTargetV1,
  resolveEditorKeyboardIntentV1
} from '../dist/packages/editor-keyboard-browser-v1/src/index.js';

const sinkWithCalls = calls => ({
  applyKeypadAction: action => calls.push(['keypad', action.actionId]),
  setEntryPitch: (step, alter, octave) => calls.push(['pitch', step, alter, octave]),
  setEntryDuration: duration => calls.push(['duration', duration.numerator, duration.denominator]),
  setActiveVoice: voice => calls.push(['voice', voice]),
  enterNoteAtSelection: () => calls.push(['enter']),
  navigateMeasure: direction => calls.push(['measure', direction]),
  navigateHistory: direction => calls.push(['history', direction])
});

const rootHarness = () => {
  const listeners = new Map();
  return {
    root: {
      addEventListener(type, listener) { listeners.set(type, listener); },
      removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); }
    },
    keydown(event) {
      const listener = listeners.get('keydown');
      if (listener) listener(event);
    },
    listenerCount: () => listeners.size
  };
};

const target = (tagName = 'DIV', options = {}) => ({
  tagName,
  isContentEditable: options.isContentEditable === true,
  closest: () => options.closestMatch === true ? {} : null
});

const keyboardEvent = (key, options = {}) => {
  let prevented = false;
  return {
    key,
    ctrlKey: options.ctrlKey === true,
    metaKey: options.metaKey === true,
    shiftKey: options.shiftKey === true,
    altKey: options.altKey === true,
    repeat: options.repeat === true,
    isComposing: options.isComposing === true,
    defaultPrevented: options.defaultPrevented === true,
    target: options.target ?? target(),
    preventDefault() { prevented = true; },
    get prevented() { return prevented; }
  };
};

test('P09-C profile remains a non-authoritative desktop progressive enhancement', () => {
  assert.equal(editorKeyboardBrowserProfileV1.desktopProgressiveEnhancement, true);
  assert.equal(editorKeyboardBrowserProfileV1.canonicalAuthority, false);
  assert.equal(editorKeyboardBrowserProfileV1.historyAuthority, false);
  assert.equal(editorKeyboardBrowserProfileV1.rendererAuthority, false);
  assert.equal(editorKeyboardBrowserProfileV1.cursorAuthority, false);
  assert.equal(editorKeyboardBrowserProfileV1.editableTargetsIgnored, true);
  assert.equal(editorKeyboardBrowserProfileV1.preventDefaultOnlyAfterDispatch, true);
});

test('P09-C default bindings avoid existing viewport arrow/page/zoom gestures', () => {
  const previous = resolveEditorKeyboardIntentV1({ key: '[' });
  const next = resolveEditorKeyboardIntentV1({ key: ']' });
  const undo = resolveEditorKeyboardIntentV1({ key: 'z', ctrlKey: true });
  const redoMac = resolveEditorKeyboardIntentV1({ key: 'z', metaKey: true, shiftKey: true });
  const redoWindows = resolveEditorKeyboardIntentV1({ key: 'y', ctrlKey: true });
  const enter = resolveEditorKeyboardIntentV1({ key: 'Enter' });

  assert.deepEqual(previous, { version: '1.0.0', type: 'NAVIGATE_MEASURE', direction: 'PREVIOUS' });
  assert.deepEqual(next, { version: '1.0.0', type: 'NAVIGATE_MEASURE', direction: 'NEXT' });
  assert.deepEqual(undo, { version: '1.0.0', type: 'NAVIGATE_HISTORY', direction: 'UNDO' });
  assert.deepEqual(redoMac, { version: '1.0.0', type: 'NAVIGATE_HISTORY', direction: 'REDO' });
  assert.deepEqual(redoWindows, { version: '1.0.0', type: 'NAVIGATE_HISTORY', direction: 'REDO' });
  assert.deepEqual(enter, { version: '1.0.0', type: 'ENTER_NOTE' });

  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End']) {
    assert.equal(resolveEditorKeyboardIntentV1({ key }), null);
  }
  assert.equal(resolveEditorKeyboardIntentV1({ key: '+', ctrlKey: true }), null);
  assert.equal(resolveEditorKeyboardIntentV1({ key: '-', metaKey: true }), null);
  assert.equal(resolveEditorKeyboardIntentV1({ key: '0', ctrlKey: true }), null);
});

test('P09-C ignores repeated, composing and previously prevented keydown events', () => {
  assert.equal(resolveEditorKeyboardIntentV1({ key: 'Enter', repeat: true }), null);
  assert.equal(resolveEditorKeyboardIntentV1({ key: 'Enter', isComposing: true }), null);
  assert.equal(resolveEditorKeyboardIntentV1({ key: 'Enter', defaultPrevented: true }), null);
});

test('P09-C editable-target policy protects text and interactive browser controls', () => {
  assert.equal(isEditorKeyboardEditableTargetV1(/** @type {any} */ (target('INPUT'))), true);
  assert.equal(isEditorKeyboardEditableTargetV1(/** @type {any} */ (target('TEXTAREA'))), true);
  assert.equal(isEditorKeyboardEditableTargetV1(/** @type {any} */ (target('SELECT'))), true);
  assert.equal(isEditorKeyboardEditableTargetV1(/** @type {any} */ (target('BUTTON'))), true);
  assert.equal(isEditorKeyboardEditableTargetV1(/** @type {any} */ (target('DIV', { isContentEditable: true }))), true);
  assert.equal(isEditorKeyboardEditableTargetV1(/** @type {any} */ (target('SPAN', { closestMatch: true }))), true);
  assert.equal(isEditorKeyboardEditableTargetV1(/** @type {any} */ (target('DIV'))), false);
});

test('P09-C mounted adapter dispatches once and prevents default only after accepted dispatch', () => {
  const calls = [];
  const harness = rootHarness();
  const adapter = createEditorKeyboardBrowserAdapterV1(sinkWithCalls(calls));

  adapter.mount(/** @type {any} */ (harness.root));
  assert.equal(adapter.getMounted(), true);
  assert.equal(harness.listenerCount(), 1);

  const enter = keyboardEvent('Enter');
  harness.keydown(enter);
  assert.deepEqual(calls, [['enter']]);
  assert.equal(enter.prevented, true);

  const arrow = keyboardEvent('ArrowRight');
  harness.keydown(arrow);
  assert.deepEqual(calls, [['enter']]);
  assert.equal(arrow.prevented, false);

  const editable = keyboardEvent('Enter', { target: target('INPUT') });
  harness.keydown(editable);
  assert.deepEqual(calls, [['enter']]);
  assert.equal(editable.prevented, false);

  adapter.mount(/** @type {any} */ (harness.root));
  assert.equal(harness.listenerCount(), 1);
  adapter.unmount();
  assert.equal(adapter.getMounted(), false);
  assert.equal(harness.listenerCount(), 0);
});

test('P09-C custom bindings are versioned and duplicate gestures fail closed', () => {
  const custom = createEditorKeyboardBindingsV1([
    {
      gesture: { key: '1', altKey: true },
      intent: { version: '1.0.0', type: 'SET_ACTIVE_VOICE', voice: 1 }
    }
  ]);
  assert.deepEqual(resolveEditorKeyboardIntentV1({ key: '1', altKey: true }, custom), {
    version: '1.0.0', type: 'SET_ACTIVE_VOICE', voice: 1
  });
  assert.equal(resolveEditorKeyboardIntentV1({ key: '1' }, custom), null);

  assert.throws(() => createEditorKeyboardBindingsV1([
    DEFAULT_EDITOR_KEYBOARD_BINDINGS_V1[0],
    DEFAULT_EDITOR_KEYBOARD_BINDINGS_V1[0]
  ]), error => {
    assert.ok(error instanceof EditorKeyboardBrowserError);
    assert.equal(error.code, 'DUPLICATE_BINDING');
    return true;
  });
});
