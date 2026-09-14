import { createProfessionalStructureInspectorStandaloneBrowserAppRuntimeV1 } from '../../score-editor-browser-professional-structure-ui-v1/src/index.js';

export const SCORE_EDITOR_PROFESSIONAL_APP_GLOBAL = 'STScoreEditorProfessionalApp' as const;

const target = globalThis as typeof globalThis & {
  STScoreEditorProfessionalApp?: ReturnType<typeof createProfessionalStructureInspectorStandaloneBrowserAppRuntimeV1>;
};

if (Object.prototype.hasOwnProperty.call(target, SCORE_EDITOR_PROFESSIONAL_APP_GLOBAL)) {
  throw new Error('ST_SCORE_EDITOR_PROFESSIONAL_APP_ALREADY_DEFINED');
}

Object.defineProperty(target, SCORE_EDITOR_PROFESSIONAL_APP_GLOBAL, {
  value: createProfessionalStructureInspectorStandaloneBrowserAppRuntimeV1(),
  writable: false,
  configurable: false,
  enumerable: true
});
