import {
  createProfessionalWorkstationStandaloneBrowserAppRuntimeV1
} from './index.js';

export const PROFESSIONAL_WORKSTATION_GLOBAL =
  'STScoreEditorProfessionalWorkstation' as const;

const target = globalThis as typeof globalThis & {
  STScoreEditorProfessionalWorkstation?: ReturnType<
    typeof createProfessionalWorkstationStandaloneBrowserAppRuntimeV1
  >;
};

if (Object.prototype.hasOwnProperty.call(target, PROFESSIONAL_WORKSTATION_GLOBAL)) {
  throw new Error('ST_SCORE_EDITOR_PROFESSIONAL_WORKSTATION_ALREADY_DEFINED');
}

Object.defineProperty(target, PROFESSIONAL_WORKSTATION_GLOBAL, {
  value: createProfessionalWorkstationStandaloneBrowserAppRuntimeV1(),
  writable: false,
  configurable: false,
  enumerable: true
});
