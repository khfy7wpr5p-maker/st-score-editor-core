import {
  createP10_2ProfessionalWorkstationStandaloneBrowserAppRuntimeV1
} from './index.js';

export const P10_2_PROFESSIONAL_WORKSTATION_GLOBAL =
  'STScoreEditorP10_2Workstation' as const;

const target = globalThis as typeof globalThis & {
  STScoreEditorP10_2Workstation?: ReturnType<
    typeof createP10_2ProfessionalWorkstationStandaloneBrowserAppRuntimeV1
  >;
};

if (Object.prototype.hasOwnProperty.call(target, P10_2_PROFESSIONAL_WORKSTATION_GLOBAL)) {
  throw new Error('ST_SCORE_EDITOR_P10_2_WORKSTATION_ALREADY_DEFINED');
}

Object.defineProperty(target, P10_2_PROFESSIONAL_WORKSTATION_GLOBAL, {
  value: createP10_2ProfessionalWorkstationStandaloneBrowserAppRuntimeV1(),
  writable: false,
  configurable: false,
  enumerable: true
});
