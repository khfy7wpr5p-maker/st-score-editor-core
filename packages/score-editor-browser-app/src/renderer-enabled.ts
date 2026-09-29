import {
  createRecoveryEnabledStandaloneBrowserAppRuntime,
  createRecoveryEnabledStandaloneScoreEditorController,
  recoveryEnabledBrowserAppProfile,
  type RecoveryEnabledControllerOptions,
  type RecoveryEnabledStandaloneScoreEditorController
} from './recovery-enabled.js';
import {
  clearOsmdPresentation,
  renderWithOsmdV4,
  type OsmdRendererHost
} from '../../renderer-osmd/src/index.js';
import type { RendererRequestV4 } from '../../renderer-contract-v4/src/index.js';

export const RENDERER_ENABLED_BROWSER_APP_VERSION = '1.0.0' as const;

export const rendererEnabledBrowserAppProfile = Object.freeze({
  ...recoveryEnabledBrowserAppProfile,
  rendererLifecycleBundled: true,
  rendererImplementationBundled: false,
  rendererAuthority: false,
  rendererAutoRender: false
});

export interface BrowserRendererControllerState {
  readonly version: typeof RENDERER_ENABLED_BROWSER_APP_VERSION;
  readonly attached: boolean;
  readonly family: 'osmd' | null;
  readonly renderedDocumentId: string | null;
  readonly renderedRevisionId: string | null;
  readonly currentProjectionStatus: string | null;
  readonly status: { readonly code: string; readonly message: string };
}

export interface RendererEnabledStandaloneScoreEditorController extends Omit<RecoveryEnabledStandaloneScoreEditorController, 'profile' | 'unmount'> {
  readonly profile: typeof rendererEnabledBrowserAppProfile;
  readonly getRendererState: () => Readonly<BrowserRendererControllerState>;
  readonly attachOsmdRenderer: (host: OsmdRendererHost) => void;
  readonly detachRenderer: () => void;
  readonly renderCurrent: () => Promise<Readonly<BrowserRendererControllerState>>;
  readonly unmount: () => void;
}

export type RendererLifecycleErrorCode =
  | 'RENDERER_NOT_ATTACHED'
  | 'NO_RENDER_DOCUMENT'
  | 'RENDERER_STALE_RESULT'
  | 'RENDERER_RENDER_FAILED';

export class RendererLifecycleError extends Error {
  readonly code: RendererLifecycleErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: RendererLifecycleErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'RendererLifecycleError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

export const createRendererEnabledStandaloneScoreEditorController = (
  options: RecoveryEnabledControllerOptions = {}
): Readonly<RendererEnabledStandaloneScoreEditorController> => {
  const base = createRecoveryEnabledStandaloneScoreEditorController(options);
  let host: OsmdRendererHost | null = null;
  let renderedDocumentId: string | null = null;
  let renderedRevisionId: string | null = null;
  let status: Readonly<{ code: string; message: string }> = Object.freeze({
    code: 'RENDERER_DETACHED',
    message: 'No renderer host is attached.'
  });

  const currentRequest = (): Readonly<RendererRequestV4> | null => base.getDocument()?.session.renderRequest ?? null;

  const state = (): Readonly<BrowserRendererControllerState> => Object.freeze({
    version: RENDERER_ENABLED_BROWSER_APP_VERSION,
    attached: host !== null,
    family: host === null ? null : 'osmd',
    renderedDocumentId,
    renderedRevisionId,
    currentProjectionStatus: currentRequest()?.projectionStatus ?? null,
    status
  });

  const clearRenderedIdentity = (): void => {
    renderedDocumentId = null;
    renderedRevisionId = null;
  };

  const unsubscribe = base.subscribe((snapshot) => {
    if (renderedRevisionId !== null && (snapshot.revisionId !== renderedRevisionId || base.getDocument()?.session.history.present.score.id !== renderedDocumentId)) {
      clearRenderedIdentity();
      if (host !== null) {
        try { clearOsmdPresentation(host); } catch { /* renderer cleanup is presentation-only */ }
      }
      status = Object.freeze({ code: 'RENDERER_STALE', message: 'Canonical revision changed; previous renderer presentation was cleared.' });
    }
  });

  const controller: RendererEnabledStandaloneScoreEditorController = Object.freeze({
    ...base,
    profile: rendererEnabledBrowserAppProfile,
    getRendererState: state,
    attachOsmdRenderer: (nextHost: OsmdRendererHost) => {
      if (host !== null) {
        try { clearOsmdPresentation(host); } catch { /* replacing presentation host remains noncanonical */ }
      }
      host = nextHost;
      clearRenderedIdentity();
      status = Object.freeze({ code: 'RENDERER_ATTACHED', message: 'Exact admitted OSMD host attached; render is explicit.' });
    },
    detachRenderer: () => {
      if (host !== null) {
        try { clearOsmdPresentation(host); } catch { /* detach must not affect canonical state */ }
      }
      host = null;
      clearRenderedIdentity();
      status = Object.freeze({ code: 'RENDERER_DETACHED', message: 'Renderer host detached.' });
    },
    renderCurrent: async () => {
      const activeHost = host;
      if (activeHost === null) throw new RendererLifecycleError('No renderer host is attached.', 'RENDERER_NOT_ATTACHED');
      const document = base.getDocument();
      if (document === null) throw new RendererLifecycleError('No canonical score document is available to render.', 'NO_RENDER_DOCUMENT');
      const request = document.session.renderRequest;
      const expectedDocumentId = request.documentId;
      const expectedRevisionId = request.revisionId;
      try {
        await renderWithOsmdV4(activeHost, request);
      } catch (error) {
        clearRenderedIdentity();
        try { clearOsmdPresentation(activeHost); } catch { /* presentation-only cleanup */ }
        const value = error as { readonly code?: unknown; readonly message?: unknown };
        status = Object.freeze({
          code: typeof value?.code === 'string' ? value.code : 'RENDERER_RENDER_FAILED',
          message: typeof value?.message === 'string' ? value.message : 'Renderer failed to render the current canonical projection.'
        });
        throw new RendererLifecycleError(status.message, 'RENDERER_RENDER_FAILED', { causeCode: status.code });
      }
      const current = base.getDocument();
      if (
        host !== activeHost || current === null ||
        current.session.history.present.score.id !== expectedDocumentId ||
        current.session.history.present.score.revision.id !== expectedRevisionId
      ) {
        clearRenderedIdentity();
        try { clearOsmdPresentation(activeHost); } catch { /* stale presentation cleanup */ }
        status = Object.freeze({ code: 'RENDERER_STALE_RESULT', message: 'Renderer completed for a stale canonical revision; presentation was rejected.' });
        throw new RendererLifecycleError(status.message, 'RENDERER_STALE_RESULT', { expectedDocumentId, expectedRevisionId });
      }
      renderedDocumentId = expectedDocumentId;
      renderedRevisionId = expectedRevisionId;
      status = Object.freeze({ code: 'RENDERED_CURRENT_REVISION', message: `Rendered canonical revision ${expectedRevisionId}.` });
      return state();
    },
    unmount: () => {
      unsubscribe();
      if (host !== null) {
        try { clearOsmdPresentation(host); } catch { /* unmount cleanup is noncanonical */ }
      }
      host = null;
      clearRenderedIdentity();
      base.unmount();
    }
  });
  return controller;
};

export const createRendererEnabledStandaloneBrowserAppRuntime = () => {
  const base = createRecoveryEnabledStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: rendererEnabledBrowserAppProfile,
    createController: createRendererEnabledStandaloneScoreEditorController,
    renderer: Object.freeze({
      lifecycleVersion: RENDERER_ENABLED_BROWSER_APP_VERSION,
      family: 'osmd' as const,
      implementationBundled: false,
      autoRender: false,
      canonicalAuthority: false
    })
  });
};
