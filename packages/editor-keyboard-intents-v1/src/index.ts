import type { Pitch, Rational } from '../../score-model/src/index.js';
import {
  EDITOR_KEYPAD_CONTRACT_VERSION,
  parseEditorKeypadAction,
  type EditorKeypadAction,
  type EditorKeypadActionId
} from '../../editor-keypad/src/index.js';

export const EDITOR_KEYBOARD_INTENT_VERSION = '1.0.0' as const;
export const EDITOR_KEYBOARD_INTENT_CANONICAL_AUTHORITY = false as const;
export const EDITOR_KEYBOARD_INTENT_HISTORY_AUTHORITY = false as const;
export const EDITOR_KEYBOARD_INTENT_RENDERER_AUTHORITY = false as const;
export const EDITOR_KEYBOARD_INTENT_CURSOR_AUTHORITY = false as const;

export type EditorKeyboardVoiceOrdinal = 1 | 2 | 3 | 4 | 5;
export type EditorKeyboardMeasureDirection = 'PREVIOUS' | 'NEXT';
export type EditorKeyboardHistoryDirection = 'UNDO' | 'REDO';

export type EditorKeyboardIntent =
  | {
      readonly version: typeof EDITOR_KEYBOARD_INTENT_VERSION;
      readonly type: 'KEYPAD_ACTION';
      readonly actionId: EditorKeypadActionId;
    }
  | {
      readonly version: typeof EDITOR_KEYBOARD_INTENT_VERSION;
      readonly type: 'SET_ENTRY_PITCH';
      readonly pitch: Pitch;
    }
  | {
      readonly version: typeof EDITOR_KEYBOARD_INTENT_VERSION;
      readonly type: 'SET_ENTRY_DURATION';
      readonly duration: Rational;
    }
  | {
      readonly version: typeof EDITOR_KEYBOARD_INTENT_VERSION;
      readonly type: 'SET_ACTIVE_VOICE';
      readonly voice: EditorKeyboardVoiceOrdinal;
    }
  | {
      readonly version: typeof EDITOR_KEYBOARD_INTENT_VERSION;
      readonly type: 'ENTER_NOTE';
    }
  | {
      readonly version: typeof EDITOR_KEYBOARD_INTENT_VERSION;
      readonly type: 'NAVIGATE_MEASURE';
      readonly direction: EditorKeyboardMeasureDirection;
    }
  | {
      readonly version: typeof EDITOR_KEYBOARD_INTENT_VERSION;
      readonly type: 'NAVIGATE_HISTORY';
      readonly direction: EditorKeyboardHistoryDirection;
    };

export type EditorKeyboardIntentErrorCode = 'INVALID_INTENT' | 'INVALID_SINK';

export class EditorKeyboardIntentError extends Error {
  readonly code: EditorKeyboardIntentErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, code: EditorKeyboardIntentErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'EditorKeyboardIntentError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

export interface EditorKeyboardIntentSink {
  readonly applyKeypadAction: (action: Readonly<EditorKeypadAction>) => void;
  readonly setEntryPitch: (step: Pitch['step'], alter: number, octave: number) => void;
  readonly setEntryDuration: (duration: Readonly<Rational>) => void;
  readonly setActiveVoice: (voice: EditorKeyboardVoiceOrdinal) => void;
  readonly enterNoteAtSelection: () => void;
  readonly navigateMeasure: (direction: EditorKeyboardMeasureDirection) => void;
  readonly navigateHistory: (direction: EditorKeyboardHistoryDirection) => void;
}

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactFields = (value: UnknownRecord, expected: readonly string[]): boolean =>
  JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());

const validPitch = (value: unknown): value is Pitch => {
  if (!isRecord(value) || !exactFields(value, ['step', 'alter', 'octave'])) return false;
  return typeof value.step === 'string' && ['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(value.step) &&
    typeof value.alter === 'number' && Number.isInteger(value.alter) && value.alter >= -2 && value.alter <= 2 &&
    typeof value.octave === 'number' && Number.isInteger(value.octave) && value.octave >= -1 && value.octave <= 9;
};

const gcd = (left: number, right: number): number => {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) [a, b] = [b, a % b];
  return a;
};

const validDuration = (value: unknown): value is Rational => {
  if (!isRecord(value) || !exactFields(value, ['numerator', 'denominator'])) return false;
  return typeof value.numerator === 'number' && Number.isSafeInteger(value.numerator) && value.numerator > 0 &&
    typeof value.denominator === 'number' && Number.isSafeInteger(value.denominator) && value.denominator > 0 &&
    gcd(value.numerator, value.denominator) === 1;
};

const validVoice = (value: unknown): value is EditorKeyboardVoiceOrdinal =>
  value === 1 || value === 2 || value === 3 || value === 4 || value === 5;

const freezePitch = (pitch: Pitch): Readonly<Pitch> => Object.freeze({
  step: pitch.step,
  alter: pitch.alter,
  octave: pitch.octave
});

const freezeDuration = (duration: Rational): Readonly<Rational> => Object.freeze({
  numerator: duration.numerator,
  denominator: duration.denominator
});

export const parseEditorKeyboardIntent = (input: unknown): Readonly<EditorKeyboardIntent> => {
  if (!isRecord(input) || input.version !== EDITOR_KEYBOARD_INTENT_VERSION || typeof input.type !== 'string') {
    throw new EditorKeyboardIntentError('Editor keyboard intent envelope is invalid.', 'INVALID_INTENT');
  }

  if (input.type === 'KEYPAD_ACTION' && exactFields(input, ['version', 'type', 'actionId']) && typeof input.actionId === 'string') {
    try {
      const action = parseEditorKeypadAction({ version: EDITOR_KEYPAD_CONTRACT_VERSION, actionId: input.actionId });
      return Object.freeze({ version: EDITOR_KEYBOARD_INTENT_VERSION, type: 'KEYPAD_ACTION', actionId: action.actionId });
    } catch {
      throw new EditorKeyboardIntentError('Editor keyboard keypad action is invalid.', 'INVALID_INTENT', { actionId: input.actionId });
    }
  }

  if (input.type === 'SET_ENTRY_PITCH' && exactFields(input, ['version', 'type', 'pitch']) && validPitch(input.pitch)) {
    return Object.freeze({ version: EDITOR_KEYBOARD_INTENT_VERSION, type: 'SET_ENTRY_PITCH', pitch: freezePitch(input.pitch) });
  }

  if (input.type === 'SET_ENTRY_DURATION' && exactFields(input, ['version', 'type', 'duration']) && validDuration(input.duration)) {
    return Object.freeze({ version: EDITOR_KEYBOARD_INTENT_VERSION, type: 'SET_ENTRY_DURATION', duration: freezeDuration(input.duration) });
  }

  if (input.type === 'SET_ACTIVE_VOICE' && exactFields(input, ['version', 'type', 'voice']) && validVoice(input.voice)) {
    return Object.freeze({ version: EDITOR_KEYBOARD_INTENT_VERSION, type: 'SET_ACTIVE_VOICE', voice: input.voice });
  }

  if (input.type === 'ENTER_NOTE' && exactFields(input, ['version', 'type'])) {
    return Object.freeze({ version: EDITOR_KEYBOARD_INTENT_VERSION, type: 'ENTER_NOTE' });
  }

  if (input.type === 'NAVIGATE_MEASURE' && exactFields(input, ['version', 'type', 'direction']) &&
      (input.direction === 'PREVIOUS' || input.direction === 'NEXT')) {
    return Object.freeze({ version: EDITOR_KEYBOARD_INTENT_VERSION, type: 'NAVIGATE_MEASURE', direction: input.direction });
  }

  if (input.type === 'NAVIGATE_HISTORY' && exactFields(input, ['version', 'type', 'direction']) &&
      (input.direction === 'UNDO' || input.direction === 'REDO')) {
    return Object.freeze({ version: EDITOR_KEYBOARD_INTENT_VERSION, type: 'NAVIGATE_HISTORY', direction: input.direction });
  }

  throw new EditorKeyboardIntentError('Editor keyboard intent fields or values are invalid.', 'INVALID_INTENT', { type: input.type });
};

const assertSink = (sink: EditorKeyboardIntentSink): void => {
  const methods: readonly (keyof EditorKeyboardIntentSink)[] = Object.freeze([
    'applyKeypadAction',
    'setEntryPitch',
    'setEntryDuration',
    'setActiveVoice',
    'enterNoteAtSelection',
    'navigateMeasure',
    'navigateHistory'
  ]);
  for (const method of methods) {
    if (typeof sink[method] !== 'function') {
      throw new EditorKeyboardIntentError('Editor keyboard intent sink is incomplete.', 'INVALID_SINK', { method });
    }
  }
};

export const dispatchEditorKeyboardIntent = (
  rawIntent: unknown,
  sink: EditorKeyboardIntentSink
): Readonly<EditorKeyboardIntent> => {
  assertSink(sink);
  const intent = parseEditorKeyboardIntent(rawIntent);

  switch (intent.type) {
    case 'KEYPAD_ACTION': {
      sink.applyKeypadAction(parseEditorKeypadAction({ version: EDITOR_KEYPAD_CONTRACT_VERSION, actionId: intent.actionId }));
      break;
    }
    case 'SET_ENTRY_PITCH': {
      sink.setEntryPitch(intent.pitch.step, intent.pitch.alter, intent.pitch.octave);
      break;
    }
    case 'SET_ENTRY_DURATION': {
      sink.setEntryDuration(intent.duration);
      break;
    }
    case 'SET_ACTIVE_VOICE': {
      sink.setActiveVoice(intent.voice);
      break;
    }
    case 'ENTER_NOTE': {
      sink.enterNoteAtSelection();
      break;
    }
    case 'NAVIGATE_MEASURE': {
      sink.navigateMeasure(intent.direction);
      break;
    }
    case 'NAVIGATE_HISTORY': {
      sink.navigateHistory(intent.direction);
      break;
    }
  }

  return intent;
};

export const editorKeyboardIntentProfile = Object.freeze({
  version: EDITOR_KEYBOARD_INTENT_VERSION,
  intentOnly: true,
  canonicalAuthority: EDITOR_KEYBOARD_INTENT_CANONICAL_AUTHORITY,
  historyAuthority: EDITOR_KEYBOARD_INTENT_HISTORY_AUTHORITY,
  rendererAuthority: EDITOR_KEYBOARD_INTENT_RENDERER_AUTHORITY,
  cursorAuthority: EDITOR_KEYBOARD_INTENT_CURSOR_AUTHORITY,
  keypadContractVersion: EDITOR_KEYPAD_CONTRACT_VERSION,
  unknownIntentBehavior: 'REJECT' as const
});
