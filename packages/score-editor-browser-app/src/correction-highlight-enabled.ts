import type { RecoveryEnabledControllerOptions } from './recovery-enabled.js';
import {
  createRendererHitEnabledStandaloneBrowserAppRuntime,
  createRendererHitEnabledStandaloneScoreEditorController,
  rendererHitEnabledBrowserAppProfile,
  type RendererHitEnabledStandaloneScoreEditorController
} from './renderer-hit-enabled.js';
import {
  createSuspiciousMeasureHighlightStateV1,
  SUSPICIOUS_MEASURE_HIGHLIGHT_STATE_VERSION,
  type SuspiciousMeasureFindingEvidenceV1,
  type SuspiciousMeasureHighlightStateV1,
  type SuspiciousMeasureRenderIdentityV1
} from './correction-measure-highlight-state.js';

export const CORRECTION_HIGHLIGHT_ENABLED_BROWSER_APP_VERSION = '1.0.0' as const;

export const correctionHighlightEnabledBrowserAppProfile = Object.freeze({
  ...rendererHitEnabledBrowserAppProfile,
  suspiciousMeasureHighlightStateBundled: true,
  suspiciousMeasureHighlightStateVersion: SUSPICIOUS_MEASURE_HIGHLIGHT_STATE_VERSION,
  suspiciousMeasureHighlightPresentationOnly: true,
  suspiciousMeasureHighlightCanonicalAuthority: false,
  suspiciousMeasureHighlightNoteColoring: false,
  suspiciousMeasureHighlightVisibleErrorText: false
});

export type CorrectionMeasureHighlightControllerErrorCode =
  | 'NO_CURRENT_RENDER_PRESENTATION'
  | 'PRESENTATION_IDENTITY_MISMATCH';

export class CorrectionMeasureHighlightControllerError extends Error {
  readonly code: CorrectionMeasureHighlightControllerErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: CorrectionMeasureHighlightControllerErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'CorrectionMeasureHighlightControllerError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

export interface CorrectionHighlightEnabledStandaloneScoreEditorController
  extends Omit<RendererHitEnabledStandaloneScoreEditorController, 'profile' | 'unmount'> {
  readonly profile: typeof correctionHighlightEnabledBrowserAppProfile;
  readonly getSuspiciousMeasureHighlightState: () => Readonly<SuspiciousMeasureHighlightStateV1> | null;
  readonly setSuspiciousMeasureFindings: (input: Readonly<{
    current: SuspiciousMeasureRenderIdentityV1;
    findings: readonly SuspiciousMeasureFindingEvidenceV1[];
  }>) => Readonly<SuspiciousMeasureHighlightStateV1>;
  readonly clearSuspiciousMeasureHighlights: () => void;
  readonly unmount: () => void;
}

export const createCorrectionHighlightEnabledStandaloneScoreEditorController = (
  options: RecoveryEnabledControllerOptions = {}
): Readonly<CorrectionHighlightEnabledStandaloneScoreEditorController> => {
  const base = createRendererHitEnabledStandaloneScoreEditorController(options);
  let highlightState: Readonly<SuspiciousMeasureHighlightStateV1> | null = null;

  const clear = (): void => {
    highlightState = null;
  };

  const assertCurrentPresentation = (identity: SuspiciousMeasureRenderIdentityV1): void => {
    const document = base.getDocument();
    const presentation = base.getRendererState();
    if (
      document === null ||
      presentation.renderedDocumentId === null ||
      presentation.renderedRevisionId === null
    ) {
      throw new CorrectionMeasureHighlightControllerError(
        'Suspicious measure findings require an accepted current renderer presentation.',
        'NO_CURRENT_RENDER_PRESENTATION'
      );
    }
    const score = document.session.history.present.score;
    if (
      presentation.renderedDocumentId !== score.id ||
      presentation.renderedRevisionId !== score.revision.id ||
      identity.documentId !== score.id ||
      identity.revisionId !== score.revision.id
    ) {
      throw new CorrectionMeasureHighlightControllerError(
        'Suspicious measure findings do not match the current accepted renderer presentation.',
        'PRESENTATION_IDENTITY_MISMATCH',
        {
          presentationDocumentId: presentation.renderedDocumentId,
          presentationRevisionId: presentation.renderedRevisionId,
          scoreDocumentId: score.id,
          scoreRevisionId: score.revision.id,
          evidenceDocumentId: identity.documentId,
          evidenceRevisionId: identity.revisionId
        }
      );
    }
  };

  const unsubscribe = base.subscribe((snapshot) => {
    const currentDocumentId = base.getDocument()?.session.history.present.score.id ?? null;
    if (
      highlightState !== null &&
      (
        currentDocumentId !== highlightState.documentId ||
        snapshot.revisionId !== highlightState.revisionId
      )
    ) {
      clear();
    }
  });

  const controller: CorrectionHighlightEnabledStandaloneScoreEditorController = Object.freeze({
    ...base,
    profile: correctionHighlightEnabledBrowserAppProfile,
    getSuspiciousMeasureHighlightState: () => highlightState,
    setSuspiciousMeasureFindings: (input: Readonly<{
      current: SuspiciousMeasureRenderIdentityV1;
      findings: readonly SuspiciousMeasureFindingEvidenceV1[];
    }>) => {
      assertCurrentPresentation(input.current);
      highlightState = createSuspiciousMeasureHighlightStateV1(input);
      return highlightState;
    },
    clearSuspiciousMeasureHighlights: clear,
    unmount: () => {
      unsubscribe();
      clear();
      base.unmount();
    }
  });

  return controller;
};

export const createCorrectionHighlightEnabledStandaloneBrowserAppRuntime = () => {
  const base = createRendererHitEnabledStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: correctionHighlightEnabledBrowserAppProfile,
    createController: createCorrectionHighlightEnabledStandaloneScoreEditorController,
    correctionHighlights: Object.freeze({
      version: CORRECTION_HIGHLIGHT_ENABLED_BROWSER_APP_VERSION,
      stateVersion: SUSPICIOUS_MEASURE_HIGHLIGHT_STATE_VERSION,
      presentationOnly: true,
      canonicalAuthority: false,
      noteLevelColoring: false,
      visibleErrorText: false
    })
  });
};
