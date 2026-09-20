import { addressEntityV3, type EventAddressV3 } from '../../addressing-v3/src/index.js';
import type { TeacherOctaveDeltaV4 } from '../../editor-teacher-octave-transpose-admission-v4/src/index.js';
import {
  attachProfessionalWorkstationToBrowserControllerV1,
  type ScoreEditorBrowserProfessionalControllerV1
} from '../../score-editor-browser-professional-v1/src/index.js';
import {
  createMobileTeacherViewportStandaloneBrowserAppRuntime,
  createMobileTeacherViewportStandaloneScoreEditorController,
  mobileTeacherViewportBrowserAppProfile,
  type MobileTeacherViewportStandaloneScoreEditorController
} from '../../score-editor-browser-app/src/mobile-teacher-viewport.js';
import type { TeacherWorkflowControllerOptions } from '../../score-editor-browser-app/src/teacher-workflow.js';
import type {
  ScoreEditorBrowserAppSnapshot,
  StandaloneScoreEditorController
} from '../../score-editor-browser-app/src/index.js';

export const PROFESSIONAL_RANGE_TOOLBAR_V1_VERSION = '1.0.0' as const;
export const PROFESSIONAL_RANGE_TOOLBAR_MIN_TOUCH_TARGET_PX = 44 as const;

export const professionalRangeToolbarBrowserAppProfile = Object.freeze({
  ...mobileTeacherViewportBrowserAppProfile,
  professionalWorkstationIntegrated: true,
  professionalRangeToolbarAvailable: true,
  professionalRangeToolbarCanonicalAuthority: false,
  professionalRangeToolbarSelectionAuthority: 'SemanticAddressV3-current-revision' as const,
  professionalRangeToolbarMutationAuthority: 'P08-D-professional-workstation' as const,
  professionalRangeToolbarHistoryAuthority: 'EditorHistoryV4' as const,
  professionalRangeToolbarClearBehavior: 'pitched-events-to-rest-rhythm-preserving' as const,
  professionalRangeToolbarMinimumTouchTargetPx: PROFESSIONAL_RANGE_TOOLBAR_MIN_TOUCH_TARGET_PX,
  professionalRangeToolbarRendererCoordinateAuthority: false,
  professionalRangeToolbarDomAuthoringAuthority: false,
  professionalRangeToolbarNetworkAuthority: false
});

export interface ProfessionalRangeToolbarOptions extends TeacherWorkflowControllerOptions {
  readonly professionalRevisionIdFactory?: () => string;
}

export interface ProfessionalRangeToolbarStateV1 {
  readonly version: typeof PROFESSIONAL_RANGE_TOOLBAR_V1_VERSION;
  readonly mounted: boolean;
  readonly hasDocument: boolean;
  readonly rangeStartEventId: string | null;
  readonly rangeStopEventId: string | null;
  readonly rangeReady: boolean;
  readonly canClearToRest: boolean;
  readonly canTransposeRange: boolean;
  readonly professionalSelectionKind: 'EVENT_SPAN' | 'EVENT_SET' | null;
  readonly professionalSelectionCount: number;
  readonly lastError: Readonly<{ readonly code: string; readonly message: string }> | null;
}

export type ProfessionalRangeToolbarErrorCodeV1 =
  | 'NO_DOCUMENT'
  | 'RANGE_NOT_READY'
  | 'RANGE_TARGET_INVALID'
  | 'REVISION_ID_UNAVAILABLE';

export class ProfessionalRangeToolbarErrorV1 extends Error {
  readonly code: ProfessionalRangeToolbarErrorCodeV1;
  constructor(message: string, code: ProfessionalRangeToolbarErrorCodeV1) {
    super(message);
    this.name = 'ProfessionalRangeToolbarErrorV1';
    this.code = code;
    Object.freeze(this);
  }
}

export const PROFESSIONAL_RANGE_TOOLBAR_STYLE = `
.stse-professional-range-toolbar{display:flex;gap:6px;align-items:center;padding:8px 12px;border-top:1px solid #d7d7dc;background:#fff;overflow-x:auto}
.stse-professional-range-toolbar button,.stse-mobile-teacher-toolbar [data-st-professional-range-action]{min-width:44px;min-height:44px;flex:0 0 auto;font:inherit;border:1px solid #c9c9cf;background:#fff;border-radius:8px;padding:8px 10px;touch-action:manipulation}
.stse-professional-range-toolbar button:disabled,.stse-mobile-teacher-toolbar [data-st-professional-range-action]:disabled{opacity:.45}
.stse-professional-range-context{min-width:max-content;font-size:12px;color:#5f5f67;padding:0 4px}
@media(max-width:760px){
  .stse-professional-range-toolbar{display:none}
  .stse-mobile-teacher-toolbar [data-st-professional-range-action]{display:inline-block}
}
@media(min-width:761px){
  .stse-mobile-teacher-toolbar [data-st-professional-range-action]{display:none}
}
`;

const browserRevisionId = (): string => {
  const cryptoValue = globalThis.crypto as Crypto | undefined;
  if (cryptoValue === undefined || typeof cryptoValue.randomUUID !== 'function') {
    throw new ProfessionalRangeToolbarErrorV1(
      'Browser randomUUID support is required for professional range edit revisions.',
      'REVISION_ID_UNAVAILABLE'
    );
  }
  return `rev:${cryptoValue.randomUUID()}`;
};

const errorInfo = (error: unknown): Readonly<{ readonly code: string; readonly message: string }> => {
  const record = error !== null && typeof error === 'object'
    ? error as { readonly code?: unknown; readonly name?: unknown; readonly message?: unknown }
    : null;
  return Object.freeze({
    code: typeof record?.code === 'string'
      ? record.code
      : typeof record?.name === 'string'
        ? record.name
        : 'PROFESSIONAL_RANGE_OPERATION_FAILED',
    message: typeof record?.message === 'string'
      ? record.message
      : 'Professional range operation failed.'
  });
};

const eventAddressById = (
  base: MobileTeacherViewportStandaloneScoreEditorController,
  eventId: string
): EventAddressV3 => {
  const document = base.getDocument();
  if (document === null) {
    throw new ProfessionalRangeToolbarErrorV1(
      'Professional range operation requires an active score document.',
      'NO_DOCUMENT'
    );
  }
  const address = addressEntityV3(document.session.history.present.score, eventId);
  if (address.kind !== 'event') {
    throw new ProfessionalRangeToolbarErrorV1(
      'Professional range endpoint no longer resolves as a current-revision event.',
      'RANGE_TARGET_INVALID'
    );
  }
  return address;
};

export interface ProfessionalRangeToolbarStandaloneScoreEditorControllerV1 extends Omit<MobileTeacherViewportStandaloneScoreEditorController, 'profile' | 'mount' | 'unmount'> {
  readonly profile: typeof professionalRangeToolbarBrowserAppProfile;
  readonly professional: Readonly<ScoreEditorBrowserProfessionalControllerV1>;
  readonly getProfessionalRangeToolbarState: () => Readonly<ProfessionalRangeToolbarStateV1>;
  readonly clearProfessionalRangeToRest: () => Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly transposeProfessionalRangeByOctaves: (octaveDelta: TeacherOctaveDeltaV4) => Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly mount: (root: HTMLElement) => void;
  readonly unmount: () => void;
  readonly disposeProfessionalRangeToolbar: () => void;
}

export const attachProfessionalRangeToolbarToBrowserControllerV1 = (
  base: MobileTeacherViewportStandaloneScoreEditorController,
  options: ProfessionalRangeToolbarOptions = {}
): Readonly<ProfessionalRangeToolbarStandaloneScoreEditorControllerV1> => {
  // Higher browser layers widen only the literal profile while preserving the complete
  // StandaloneScoreEditorController document/adoption/subscription contract consumed by E1.
  const professional = attachProfessionalWorkstationToBrowserControllerV1(
    base as unknown as StandaloneScoreEditorController
  );
  const revisionIdFactory = options.professionalRevisionIdFactory ?? options.revisionIdFactory ?? browserRevisionId;
  let root: HTMLElement | null = null;
  let disposed = false;
  let lastError: Readonly<{ readonly code: string; readonly message: string }> | null = null;

  const rangeIds = (): Readonly<{ readonly start: string; readonly stop: string }> | null => {
    const mobile = base.getMobileTeacherToolbarState();
    if (!mobile.rangeStartCurrent || !mobile.canCompleteRange || mobile.rangeStartEventId === null || mobile.selectedEventId === null) {
      return null;
    }
    return Object.freeze({ start: mobile.rangeStartEventId, stop: mobile.selectedEventId });
  };

  const state = (): Readonly<ProfessionalRangeToolbarStateV1> => {
    const baseSnapshot = base.getSnapshot();
    const ids = rangeIds();
    const professionalSnapshot = professional.getSnapshot();
    return Object.freeze({
      version: PROFESSIONAL_RANGE_TOOLBAR_V1_VERSION,
      mounted: root !== null,
      hasDocument: baseSnapshot.hasDocument,
      rangeStartEventId: ids?.start ?? base.getMobileTeacherToolbarState().rangeStartEventId,
      rangeStopEventId: ids?.stop ?? null,
      rangeReady: ids !== null,
      canClearToRest: ids !== null,
      canTransposeRange: ids !== null,
      professionalSelectionKind: professionalSnapshot.professionalSelectionKind,
      professionalSelectionCount: professionalSnapshot.professionalSelectionCount,
      lastError: lastError ?? professionalSnapshot.error
    });
  };

  const requireRange = (): Readonly<{ readonly start: EventAddressV3; readonly stop: EventAddressV3 }> => {
    const ids = rangeIds();
    if (ids === null) {
      throw new ProfessionalRangeToolbarErrorV1(
        'Capture a range start and select a different current-revision range end first.',
        'RANGE_NOT_READY'
      );
    }
    return Object.freeze({
      start: eventAddressById(base, ids.start),
      stop: eventAddressById(base, ids.stop)
    });
  };

  const prepareProfessionalRange = (): void => {
    const range = requireRange();
    const selected = professional.selectEventSpan(range.start, range.stop);
    if (selected.error !== null) {
      throw new ProfessionalRangeToolbarErrorV1(
        selected.error.message,
        'RANGE_TARGET_INVALID'
      );
    }
  };

  const perform = (
    operation: () => Readonly<ScoreEditorBrowserAppSnapshot>
  ): Readonly<ScoreEditorBrowserAppSnapshot> => {
    try {
      const result = operation();
      lastError = result.error === null ? null : Object.freeze({ ...result.error });
      decorate();
      return result;
    } catch (error) {
      lastError = errorInfo(error);
      decorate();
      return base.getSnapshot();
    }
  };

  const clearToRest = (): Readonly<ScoreEditorBrowserAppSnapshot> => perform(() => {
    prepareProfessionalRange();
    const result = professional.clearToRest({ nextRevisionId: revisionIdFactory() });
    if (result.error !== null) {
      lastError = Object.freeze({ ...result.error });
      return result.base;
    }
    professional.clearProfessionalSelection();
    return result.base;
  });

  const transpose = (octaveDelta: TeacherOctaveDeltaV4): Readonly<ScoreEditorBrowserAppSnapshot> => perform(() => {
    prepareProfessionalRange();
    const result = professional.transposeOctaves(octaveDelta, { nextRevisionId: revisionIdFactory() });
    if (result.error !== null) {
      lastError = Object.freeze({ ...result.error });
      return result.base;
    }
    professional.clearProfessionalSelection();
    return result.base;
  });

  const addButton = (
    owner: Document,
    parent: HTMLElement,
    label: string,
    ariaLabel: string,
    actionName: string,
    disabled: boolean,
    action: () => void
  ): void => {
    const button = owner.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.setAttribute('aria-label', ariaLabel);
    button.setAttribute('data-st-professional-range-action', actionName);
    button.disabled = disabled;
    button.addEventListener('click', action);
    parent.append(button);
  };

  const decorate = (): void => {
    if (root === null || disposed) return;
    const app = root.querySelector<HTMLElement>('[data-st-score-editor-app]');
    if (app === null) return;
    if (app.querySelector('[data-st-professional-range-toolbar-style]') === null) {
      const style = app.ownerDocument.createElement('style');
      style.setAttribute('data-st-professional-range-toolbar-style', PROFESSIONAL_RANGE_TOOLBAR_V1_VERSION);
      style.textContent = PROFESSIONAL_RANGE_TOOLBAR_STYLE;
      app.append(style);
    }

    app.querySelector('[data-st-professional-range-toolbar]')?.remove();
    const current = state();
    const owner = app.ownerDocument;
    const toolbar = owner.createElement('nav');
    toolbar.className = 'stse-professional-range-toolbar';
    toolbar.setAttribute('data-st-professional-range-toolbar', PROFESSIONAL_RANGE_TOOLBAR_V1_VERSION);
    toolbar.setAttribute('aria-label', 'Professional range editing');

    const context = owner.createElement('span');
    context.className = 'stse-professional-range-context';
    context.textContent = current.rangeReady
      ? 'Professional range ready'
      : current.rangeStartEventId === null
        ? 'Capture range start'
        : 'Select range end';
    toolbar.append(context);
    addButton(owner, toolbar, 'Clear', 'Clear professional range to rests', 'clear-to-rest', !current.canClearToRest, () => { controller.clearProfessionalRangeToRest(); });
    addButton(owner, toolbar, '−8', 'Transpose professional range down one octave', 'transpose-down-octave', !current.canTransposeRange, () => { controller.transposeProfessionalRangeByOctaves(-1); });
    addButton(owner, toolbar, '+8', 'Transpose professional range up one octave', 'transpose-up-octave', !current.canTransposeRange, () => { controller.transposeProfessionalRangeByOctaves(1); });

    const status = app.querySelector('.stse-status');
    if (status === null) app.append(toolbar);
    else app.insertBefore(toolbar, status);

    const mobileToolbar = app.querySelector<HTMLElement>('[data-st-mobile-teacher-toolbar]');
    if (mobileToolbar !== null) {
      addButton(owner, mobileToolbar, 'Clear', 'Clear professional range to rests', 'clear-to-rest-mobile', !current.canClearToRest, () => { controller.clearProfessionalRangeToRest(); });
    }
  };

  const unsubscribeBase = base.subscribe(() => {
    if (disposed) return;
    if (professional.getSnapshot().professionalSelectionKind !== null && !rangeIds()) {
      professional.clearProfessionalSelection();
    }
    decorate();
  });

  const controller: ProfessionalRangeToolbarStandaloneScoreEditorControllerV1 = {
    ...base,
    profile: professionalRangeToolbarBrowserAppProfile,
    professional,
    getProfessionalRangeToolbarState: state,
    clearProfessionalRangeToRest: clearToRest,
    transposeProfessionalRangeByOctaves: transpose,
    mount: (nextRoot) => {
      if (disposed) throw new ProfessionalRangeToolbarErrorV1('Professional range toolbar has been disposed.', 'RANGE_TARGET_INVALID');
      base.mount(nextRoot);
      root = nextRoot;
      decorate();
    },
    unmount: () => {
      if (professional.getSnapshot().professionalSelectionKind !== null) professional.clearProfessionalSelection();
      lastError = null;
      root = null;
      base.unmount();
    },
    disposeProfessionalRangeToolbar: () => {
      if (disposed) return;
      disposed = true;
      root = null;
      unsubscribeBase();
      professional.dispose();
    }
  };

  return Object.freeze(controller);
};

export const createProfessionalRangeToolbarStandaloneScoreEditorControllerV1 = (
  options: ProfessionalRangeToolbarOptions = {}
): Readonly<ProfessionalRangeToolbarStandaloneScoreEditorControllerV1> =>
  attachProfessionalRangeToolbarToBrowserControllerV1(
    createMobileTeacherViewportStandaloneScoreEditorController(options),
    options
  );

export const createProfessionalRangeToolbarStandaloneBrowserAppRuntimeV1 = () => {
  const base = createMobileTeacherViewportStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: professionalRangeToolbarBrowserAppProfile,
    createController: createProfessionalRangeToolbarStandaloneScoreEditorControllerV1,
    professionalRangeToolbar: Object.freeze({
      version: PROFESSIONAL_RANGE_TOOLBAR_V1_VERSION,
      available: true,
      canonicalAuthority: false,
      semanticSelectionOnly: true,
      mutationAuthority: 'P08-D-professional-workstation',
      historyAuthority: 'EditorHistoryV4',
      clearBehavior: 'pitched-events-to-rest-rhythm-preserving',
      minimumTouchTargetPx: PROFESSIONAL_RANGE_TOOLBAR_MIN_TOUCH_TARGET_PX,
      rendererCoordinateAuthority: false,
      domAuthoringAuthority: false,
      networkAuthority: false
    })
  });
};
