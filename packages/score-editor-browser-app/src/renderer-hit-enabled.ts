import type { ScoreEditorBrowserAppSnapshot } from './index.js';
import type { RecoveryEnabledControllerOptions } from './recovery-enabled.js';
import {
  createRendererEnabledStandaloneBrowserAppRuntime,
  createRendererEnabledStandaloneScoreEditorController,
  rendererEnabledBrowserAppProfile,
  type RendererEnabledStandaloneScoreEditorController
} from './renderer-enabled.js';
import {
  EDITOR_RENDERER_SELECTION_BRIDGE_V4_VERSION,
  createExternalRendererHitFromScoreNoteRefV4,
  resolveExternalRendererHitV4
} from '../../editor-renderer-selection-bridge-v4/src/index.js';

export const RENDERER_HIT_ENABLED_BROWSER_APP_VERSION = '1.0.0' as const;

export const rendererHitEnabledBrowserAppProfile = Object.freeze({
  ...rendererEnabledBrowserAppProfile,
  semanticRendererHitBridgeBundled: true,
  rendererHitCanonicalInput: 'opaque-renderer-request-v4-manifest-token' as const,
  rendererDomSvgCoordinateAuthority: false
});

export type RendererSemanticHitBridgeControllerErrorCode =
  | 'NO_CURRENT_RENDER_PRESENTATION'
  | 'RENDERER_PRESENTATION_MISMATCH'
  | 'RENDERED_NOTE_UNMAPPED'
  | 'SELECTION_REJECTED';

export class RendererSemanticHitBridgeControllerError extends Error {
  readonly code: RendererSemanticHitBridgeControllerErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: RendererSemanticHitBridgeControllerErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'RendererSemanticHitBridgeControllerError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

export interface RendererHitEnabledStandaloneScoreEditorController extends Omit<RendererEnabledStandaloneScoreEditorController, 'profile'> {
  readonly profile: typeof rendererHitEnabledBrowserAppProfile;
  readonly selectRendererHit: (rawHit: unknown) => Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly selectRenderedScoreNoteRef: (rawRef: unknown) => Readonly<ScoreEditorBrowserAppSnapshot>;
}

export const createRendererHitEnabledStandaloneScoreEditorController = (
  options: RecoveryEnabledControllerOptions = {}
): Readonly<RendererHitEnabledStandaloneScoreEditorController> => {
  const base = createRendererEnabledStandaloneScoreEditorController(options);

  const requireCurrentPresentation = () => {
    const document = base.getDocument();
    const presentation = base.getRendererState();
    if (document === null || presentation.renderedDocumentId === null || presentation.renderedRevisionId === null) {
      throw new RendererSemanticHitBridgeControllerError(
        'Renderer hit rejected because no current canonical revision has an accepted presentation.',
        'NO_CURRENT_RENDER_PRESENTATION'
      );
    }
    const score = document.session.history.present.score;
    const request = document.session.renderRequest;
    if (
      presentation.attached !== true ||
      presentation.family !== request.renderer.family ||
      presentation.renderedDocumentId !== score.id ||
      presentation.renderedRevisionId !== score.revision.id ||
      request.documentId !== score.id ||
      request.revisionId !== score.revision.id
    ) {
      throw new RendererSemanticHitBridgeControllerError(
        'Renderer hit rejected because presentation identity does not match the current V4 render request.',
        'RENDERER_PRESENTATION_MISMATCH',
        {
          presentationDocumentId: presentation.renderedDocumentId,
          presentationRevisionId: presentation.renderedRevisionId,
          requestDocumentId: request.documentId,
          requestRevisionId: request.revisionId
        }
      );
    }
    return Object.freeze({ document, score, request });
  };

  const selectRendererHit = (rawHit: unknown): Readonly<ScoreEditorBrowserAppSnapshot> => {
    const current = requireCurrentPresentation();
    const address = resolveExternalRendererHitV4(current.score, current.request, rawHit);
    const beforeRevisionId = current.score.revision.id;
    const beforePastLength = current.document.session.history.past.length;
    const beforeFutureLength = current.document.session.history.future.length;
    const result = base.select(address);
    const after = base.getDocument();
    if (
      result.error !== null ||
      after === null ||
      after.session.history.present.score.revision.id !== beforeRevisionId ||
      after.session.history.past.length !== beforePastLength ||
      after.session.history.future.length !== beforeFutureLength
    ) {
      throw new RendererSemanticHitBridgeControllerError(
        'Resolved renderer hit was not accepted as a selection-only operation.',
        'SELECTION_REJECTED',
        { errorCode: result.error?.code ?? null }
      );
    }
    return result;
  };

  const controller: RendererHitEnabledStandaloneScoreEditorController = Object.freeze({
    ...base,
    profile: rendererHitEnabledBrowserAppProfile,
    selectRendererHit,
    selectRenderedScoreNoteRef: (rawRef: unknown) => {
      const current = requireCurrentPresentation();
      const hit = createExternalRendererHitFromScoreNoteRefV4(current.score, current.request, rawRef);
      if (hit === null) {
        throw new RendererSemanticHitBridgeControllerError(
          'Rendered note locator did not resolve exactly to a current opaque renderer token.',
          'RENDERED_NOTE_UNMAPPED'
        );
      }
      return selectRendererHit(hit);
    }
  });
  return controller;
};

export const createRendererHitEnabledStandaloneBrowserAppRuntime = () => {
  const base = createRendererEnabledStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: rendererHitEnabledBrowserAppProfile,
    createController: createRendererHitEnabledStandaloneScoreEditorController,
    renderer: Object.freeze({
      ...base.renderer,
      semanticHitBridgeVersion: EDITOR_RENDERER_SELECTION_BRIDGE_V4_VERSION,
      hitCanonicalInput: 'opaque-renderer-request-v4-manifest-token' as const,
      domSvgCoordinateAuthority: false
    })
  });
};
