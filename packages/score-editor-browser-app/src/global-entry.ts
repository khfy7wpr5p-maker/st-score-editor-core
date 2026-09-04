import { createActiveStaffAuthoringStandaloneBrowserAppRuntime } from './active-staff-authoring.js';

export const SCORE_EDITOR_APP_GLOBAL = 'STScoreEditorApp' as const;

const target = globalThis as typeof globalThis & {
  STScoreEditorApp?: ReturnType<typeof createActiveStaffAuthoringStandaloneBrowserAppRuntime>;
};

if (Object.prototype.hasOwnProperty.call(target, SCORE_EDITOR_APP_GLOBAL)) {
  throw new Error('ST_SCORE_EDITOR_APP_ALREADY_DEFINED');
}

Object.defineProperty(target, SCORE_EDITOR_APP_GLOBAL, {
  value: createActiveStaffAuthoringStandaloneBrowserAppRuntime(),
  writable: false,
  configurable: false,
  enumerable: true
});