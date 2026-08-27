import { createScoreDocument } from '../../score-model/src/index.js';
import { emptyNotationDocument } from '../../notation-structure/src/index.js';
import {
  createEditorSession,
  selectSessionRenderToken,
  commitSessionScoreIntent,
  commitSessionNotationIntent,
  navigateSessionHistory
} from '../../editor-session-controller/src/index.js';

export const BROWSER_RUNTIME_VERSION = '1.0.0' as const;

export const browserRuntimeProfile = Object.freeze({
  version: BROWSER_RUNTIME_VERSION,
  controllerVersion: '1.0.0',
  productionRuntime: false,
  networkCapable: false,
  persistenceCapable: false,
  rendererAuthority: false,
  browserMutationAuthority: false,
  serverRevisionAuthority: false,
  approvalAuthority: false,
  publicationAuthority: false
});

export const createBrowserRuntime = () => Object.freeze({
  runtimeVersion: BROWSER_RUNTIME_VERSION,
  profile: browserRuntimeProfile,
  createScoreDocument,
  emptyNotationDocument,
  createEditorSession,
  selectSessionRenderToken,
  commitSessionScoreIntent,
  commitSessionNotationIntent,
  navigateSessionHistory
});

export type ScoreEditorBrowserRuntime = ReturnType<typeof createBrowserRuntime>;
