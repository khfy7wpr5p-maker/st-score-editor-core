import { createKeyboardWorkstationStandaloneBrowserAppRuntime } from './keyboard-workstation.js';

export const SCORE_EDITOR_KEYBOARD_WORKSTATION_GLOBAL = 'STScoreEditorKeyboardWorkstation' as const;

const target = globalThis as typeof globalThis & {
  STScoreEditorKeyboardWorkstation?: ReturnType<typeof createKeyboardWorkstationStandaloneBrowserAppRuntime>;
};

if (Object.prototype.hasOwnProperty.call(target, SCORE_EDITOR_KEYBOARD_WORKSTATION_GLOBAL)) {
  throw new Error('ST_SCORE_EDITOR_KEYBOARD_WORKSTATION_ALREADY_DEFINED');
}

Object.defineProperty(target, SCORE_EDITOR_KEYBOARD_WORKSTATION_GLOBAL, {
  value: createKeyboardWorkstationStandaloneBrowserAppRuntime(),
  writable: false,
  configurable: false,
  enumerable: true
});
