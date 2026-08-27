import { createBrowserRuntime } from './index.js';

export const BROWSER_RUNTIME_GLOBAL = 'STScoreEditorCoreRuntime' as const;

const target = globalThis as typeof globalThis & {
  STScoreEditorCoreRuntime?: ReturnType<typeof createBrowserRuntime>;
};

if (Object.prototype.hasOwnProperty.call(target, BROWSER_RUNTIME_GLOBAL)) {
  throw new Error('ST_SCORE_EDITOR_CORE_RUNTIME_ALREADY_DEFINED');
}

Object.defineProperty(target, BROWSER_RUNTIME_GLOBAL, {
  value: createBrowserRuntime(),
  writable: false,
  configurable: false,
  enumerable: true
});
