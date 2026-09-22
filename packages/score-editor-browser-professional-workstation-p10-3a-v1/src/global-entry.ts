import {
  createP10_3AProfessionalWorkstationStandaloneBrowserAppRuntimeV1
} from './index.js';

export const P10_3A_PROFESSIONAL_WORKSTATION_GLOBAL =
  'STScoreEditorP10_3AWorkstation' as const;

const target = globalThis as typeof globalThis & {
  STScoreEditorP10_3AWorkstation?: ReturnType<
    typeof createP10_3AProfessionalWorkstationStandaloneBrowserAppRuntimeV1
  >;
};

if (Object.prototype.hasOwnProperty.call(target, P10_3A_PROFESSIONAL_WORKSTATION_GLOBAL)) {
  throw new Error('ST_SCORE_EDITOR_P10_3A_WORKSTATION_ALREADY_DEFINED');
}

Object.defineProperty(target, P10_3A_PROFESSIONAL_WORKSTATION_GLOBAL, {
  value: createP10_3AProfessionalWorkstationStandaloneBrowserAppRuntimeV1(),
  writable: false,
  configurable: false,
  enumerable: true
});
