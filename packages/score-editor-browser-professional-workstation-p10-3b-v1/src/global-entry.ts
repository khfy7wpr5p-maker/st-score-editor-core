import {
  createP10_3BProfessionalWorkstationStandaloneBrowserAppRuntimeV1
} from './index.js';

export const P10_3B_PROFESSIONAL_WORKSTATION_GLOBAL =
  'STScoreEditorP10_3BWorkstation' as const;

const target = globalThis as typeof globalThis & {
  STScoreEditorP10_3BWorkstation?: ReturnType<
    typeof createP10_3BProfessionalWorkstationStandaloneBrowserAppRuntimeV1
  >;
};

if (Object.prototype.hasOwnProperty.call(target, P10_3B_PROFESSIONAL_WORKSTATION_GLOBAL)) {
  throw new Error('ST_SCORE_EDITOR_P10_3B_WORKSTATION_ALREADY_DEFINED');
}

Object.defineProperty(target, P10_3B_PROFESSIONAL_WORKSTATION_GLOBAL, {
  value: createP10_3BProfessionalWorkstationStandaloneBrowserAppRuntimeV1(),
  writable: false,
  configurable: false,
  enumerable: true
});
