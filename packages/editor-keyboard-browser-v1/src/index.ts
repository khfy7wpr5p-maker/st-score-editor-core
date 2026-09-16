import {
  EDITOR_KEYBOARD_INTENT_VERSION,
  dispatchEditorKeyboardIntent,
  parseEditorKeyboardIntent,
  type EditorKeyboardIntent,
  type EditorKeyboardIntentSink
} from '../../editor-keyboard-intents-v1/src/index.js';

export const EDITOR_KEYBOARD_BROWSER_VERSION = '1.0.0' as const;

export interface EditorKeyboardGestureV1 {
  readonly key: string;
  readonly primaryModifier?: boolean;
  readonly shiftKey?: boolean;
  readonly altKey?: boolean;
}

export interface EditorKeyboardBindingV1 {
  readonly gesture: Readonly<EditorKeyboardGestureV1>;
  readonly intent: Readonly<EditorKeyboardIntent>;
}

export interface EditorKeyboardEventLikeV1 {
  readonly key: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly shiftKey?: boolean;
  readonly altKey?: boolean;
  readonly repeat?: boolean;
  readonly isComposing?: boolean;
  readonly defaultPrevented?: boolean;
}

export type EditorKeyboardBrowserErrorCode = 'INVALID_BINDING' | 'DUPLICATE_BINDING';

export class EditorKeyboardBrowserError extends Error {
  readonly code: EditorKeyboardBrowserErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, code: EditorKeyboardBrowserErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'EditorKeyboardBrowserError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const normalizeKey = (key: string): string => key.length === 1 ? key.toLowerCase() : key;
const bool = (value: boolean | undefined): boolean => value === true;

const gestureSignature = (gesture: Readonly<EditorKeyboardGestureV1>): string => [
  normalizeKey(gesture.key),
  bool(gesture.primaryModifier) ? 'P1' : 'P0',
  bool(gesture.shiftKey) ? 'S1' : 'S0',
  bool(gesture.altKey) ? 'A1' : 'A0'
].join('|');

const binding = (
  gesture: Readonly<EditorKeyboardGestureV1>,
  intent: Readonly<EditorKeyboardIntent>
): Readonly<EditorKeyboardBindingV1> => Object.freeze({
  gesture: Object.freeze({ ...gesture }),
  intent: parseEditorKeyboardIntent(intent)
});

export const DEFAULT_EDITOR_KEYBOARD_BINDINGS_V1: readonly Readonly<EditorKeyboardBindingV1>[] = Object.freeze([
  binding(
    { key: 'z', primaryModifier: true },
    { version: EDITOR_KEYBOARD_INTENT_VERSION, type: 'NAVIGATE_HISTORY', direction: 'UNDO' }
  ),
  binding(
    { key: 'z', primaryModifier: true, shiftKey: true },
    { version: EDITOR_KEYBOARD_INTENT_VERSION, type: 'NAVIGATE_HISTORY', direction: 'REDO' }
  ),
  binding(
    { key: 'y', primaryModifier: true },
    { version: EDITOR_KEYBOARD_INTENT_VERSION, type: 'NAVIGATE_HISTORY', direction: 'REDO' }
  ),
  binding(
    { key: '[' },
    { version: EDITOR_KEYBOARD_INTENT_VERSION, type: 'NAVIGATE_MEASURE', direction: 'PREVIOUS' }
  ),
  binding(
    { key: ']' },
    { version: EDITOR_KEYBOARD_INTENT_VERSION, type: 'NAVIGATE_MEASURE', direction: 'NEXT' }
  ),
  binding(
    { key: 'Enter' },
    { version: EDITOR_KEYBOARD_INTENT_VERSION, type: 'ENTER_NOTE' }
  )
]);

const validateGesture = (gesture: Readonly<EditorKeyboardGestureV1>): void => {
  if (typeof gesture.key !== 'string' || gesture.key.length === 0 || gesture.key.length > 32 || gesture.key !== gesture.key.trim()) {
    throw new EditorKeyboardBrowserError('Keyboard binding key is invalid.', 'INVALID_BINDING', { key: gesture.key });
  }
};

export const createEditorKeyboardBindingsV1 = (
  input: readonly Readonly<EditorKeyboardBindingV1>[] = DEFAULT_EDITOR_KEYBOARD_BINDINGS_V1
): readonly Readonly<EditorKeyboardBindingV1>[] => {
  const seen = new Set<string>();
  const result: Readonly<EditorKeyboardBindingV1>[] = [];
  for (const item of input) {
    validateGesture(item.gesture);
    const signature = gestureSignature(item.gesture);
    if (seen.has(signature)) {
      throw new EditorKeyboardBrowserError('Keyboard binding gesture is duplicated.', 'DUPLICATE_BINDING', { signature });
    }
    seen.add(signature);
    result.push(binding(item.gesture, item.intent));
  }
  return Object.freeze(result);
};

export const resolveEditorKeyboardIntentV1 = (
  event: Readonly<EditorKeyboardEventLikeV1>,
  bindings: readonly Readonly<EditorKeyboardBindingV1>[] = DEFAULT_EDITOR_KEYBOARD_BINDINGS_V1
): Readonly<EditorKeyboardIntent> | null => {
  if (event.defaultPrevented === true || event.isComposing === true || event.repeat === true) return null;
  const primary = bool(event.ctrlKey) || bool(event.metaKey);
  const key = normalizeKey(event.key);
  for (const item of bindings) {
    const gesture = item.gesture;
    if (normalizeKey(gesture.key) !== key) continue;
    if (bool(gesture.primaryModifier) !== primary) continue;
    if (bool(gesture.shiftKey) !== bool(event.shiftKey)) continue;
    if (bool(gesture.altKey) !== bool(event.altKey)) continue;
    return item.intent;
  }
  return null;
};

type EditableTargetLike = Readonly<{
  tagName?: unknown;
  isContentEditable?: unknown;
  closest?: unknown;
}>;

export const isEditorKeyboardEditableTargetV1 = (target: EventTarget | null): boolean => {
  if (target === null || typeof target !== 'object') return false;
  const value = target as EditableTargetLike;
  if (value.isContentEditable === true) return true;
  const tagName = typeof value.tagName === 'string' ? value.tagName.toUpperCase() : '';
  if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tagName)) return true;
  if (typeof value.closest === 'function') {
    const closest = value.closest as (selector: string) => unknown;
    if (closest.call(target, 'input,textarea,select,button,[contenteditable],[role="textbox"],[role="combobox"]') !== null) return true;
  }
  return false;
};

export interface EditorKeyboardBrowserAdapterV1 {
  readonly version: typeof EDITOR_KEYBOARD_BROWSER_VERSION;
  readonly canonicalAuthority: false;
  readonly historyAuthority: false;
  readonly rendererAuthority: false;
  readonly cursorAuthority: false;
  readonly getMounted: () => boolean;
  readonly mount: (root: HTMLElement) => void;
  readonly unmount: () => void;
}

export const createEditorKeyboardBrowserAdapterV1 = (
  sink: EditorKeyboardIntentSink,
  bindingsInput: readonly Readonly<EditorKeyboardBindingV1>[] = DEFAULT_EDITOR_KEYBOARD_BINDINGS_V1
): Readonly<EditorKeyboardBrowserAdapterV1> => {
  const bindings = createEditorKeyboardBindingsV1(bindingsInput);
  let root: HTMLElement | null = null;

  const onKeydown = (event: KeyboardEvent): void => {
    if (isEditorKeyboardEditableTargetV1(event.target)) return;
    const intent = resolveEditorKeyboardIntentV1(event, bindings);
    if (intent === null) return;
    dispatchEditorKeyboardIntent(intent, sink);
    event.preventDefault();
  };

  const unmount = (): void => {
    if (root !== null) root.removeEventListener('keydown', onKeydown);
    root = null;
  };

  const mount = (nextRoot: HTMLElement): void => {
    if (root === nextRoot) return;
    unmount();
    root = nextRoot;
    root.addEventListener('keydown', onKeydown);
  };

  return Object.freeze({
    version: EDITOR_KEYBOARD_BROWSER_VERSION,
    canonicalAuthority: false,
    historyAuthority: false,
    rendererAuthority: false,
    cursorAuthority: false,
    getMounted: () => root !== null,
    mount,
    unmount
  });
};

export const editorKeyboardBrowserProfileV1 = Object.freeze({
  version: EDITOR_KEYBOARD_BROWSER_VERSION,
  desktopProgressiveEnhancement: true,
  canonicalAuthority: false,
  historyAuthority: false,
  rendererAuthority: false,
  cursorAuthority: false,
  editableTargetsIgnored: true,
  composingEventsIgnored: true,
  repeatedKeydownIgnored: true,
  preventDefaultOnlyAfterDispatch: true,
  viewportConflictPolicy: 'DEFAULT_BINDINGS_AVOID_VIEWPORT_GESTURES' as const,
  defaultBindings: Object.freeze(['primary+z', 'primary+shift+z', 'primary+y', '[', ']', 'Enter'] as const)
});
