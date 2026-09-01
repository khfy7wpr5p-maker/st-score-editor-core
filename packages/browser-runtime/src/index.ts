import { createScoreDocument } from '../../score-model/src/index.js';
import { emptyNotationDocument } from '../../notation-structure/src/index.js';
import { getEditorKeypadManifest } from '../../editor-keypad/src/index.js';
import {
  createEditorSession,
  createEditorSessionWithRendererProfile,
  selectSessionRenderToken,
  selectSessionExternalRendererHit,
  commitSessionScoreIntent,
  commitSessionNotationIntent,
  commitSessionKeypadAction,
  navigateSessionHistory
} from '../../editor-session-controller/src/index.js';
import type { EditorSessionState } from '../../editor-session-controller/src/index.js';

export const BROWSER_RUNTIME_VERSION = '1.0.0' as const;
export const BROWSER_KEYPAD_RESULT_VERSION = '1.0.0' as const;

export interface BrowserKeypadError {
  readonly version: typeof BROWSER_KEYPAD_RESULT_VERSION;
  readonly code: string;
  readonly message: string;
}

export type BrowserKeypadCommitResult =
  | { readonly ok: true; readonly session: Readonly<EditorSessionState> }
  | { readonly ok: false; readonly error: Readonly<BrowserKeypadError> };

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
  publicationAuthority: false,
  keypadManifestAvailable: true,
  keypadLocalCommitAvailable: true,
  keypadExplicitTargetAvailable: true,
  rendererHitBridgeAvailable: true
});

const browserKeypadError = (error: unknown): Readonly<BrowserKeypadError> => {
  const record = error !== null && typeof error === 'object' ? error as { readonly code?: unknown; readonly message?: unknown } : null;
  const code = typeof record?.code === 'string' && record.code.length > 0 ? record.code : 'KEYPAD_COMMIT_FAILED';
  const message = typeof record?.message === 'string' && record.message.length > 0 ? record.message : 'Keypad commit failed.';
  return Object.freeze({ version: BROWSER_KEYPAD_RESULT_VERSION, code, message });
};

export const commitBrowserKeypadAction = (
  session: EditorSessionState,
  rawAction: unknown,
  rawIdentity: unknown,
  rawTarget: unknown = null
): Readonly<BrowserKeypadCommitResult> => {
  try {
    return Object.freeze({ ok: true, session: commitSessionKeypadAction(session, rawAction, rawIdentity, rawTarget) });
  } catch (error) {
    return Object.freeze({ ok: false, error: browserKeypadError(error) });
  }
};

export const createBrowserRuntime = () => Object.freeze({
  runtimeVersion: BROWSER_RUNTIME_VERSION,
  profile: browserRuntimeProfile,
  createScoreDocument,
  emptyNotationDocument,
  createEditorSession,
  createEditorSessionWithRendererProfile,
  selectSessionRenderToken,
  selectRendererHit: selectSessionExternalRendererHit,
  commitSessionScoreIntent,
  commitSessionNotationIntent,
  navigateSessionHistory,
  getEditorKeypadManifest,
  commitKeypadAction: commitBrowserKeypadAction
});

export type ScoreEditorBrowserRuntime = ReturnType<typeof createBrowserRuntime>;
