import { addressEntityV3, type EventAddressV3 } from '../../addressing-v3/src/index.js';
import type { ProfessionalPitchTransposeOptionsV1 } from '../../editor-professional-pitch-transpose-v1/src/index.js';
import { createEventSpanProfessionalSelectionV1 } from '../../editor-professional-selection-v1/src/index.js';
import {
  commitProfessionalPitchWorkstationDiatonicTransposeV1,
  commitProfessionalPitchWorkstationSemitoneTransposeV1
} from '../../score-editor-professional-pitch-transpose-workstation-v1/src/index.js';
import {
  SCORE_EDITOR_PROFESSIONAL_WORKSTATION_V1_VERSION,
  type ScoreEditorProfessionalWorkstationV1
} from '../../score-editor-professional-workstation-v1/src/index.js';
import type { ScoreEditorBrowserAppSnapshot } from '../../score-editor-browser-app/src/index.js';
import type { ProfessionalWorkstationControllerOptionsV1 } from '../../score-editor-browser-professional-workstation-v1/src/index.js';
import {
  createP10_2ProfessionalWorkstationStandaloneScoreEditorControllerV1,
  p10_2ProfessionalWorkstationBrowserAppProfile,
  type P10_2ProfessionalWorkstationStandaloneScoreEditorControllerV1
} from '../../score-editor-browser-professional-workstation-p10-2-v1/src/index.js';

export const P10_3A_PROFESSIONAL_WORKSTATION_V1_VERSION = '1.0.0' as const;
export const P10_3A_PITCH_CONTROL_MIN_TOUCH_TARGET_PX = 44 as const;

export const P10_3A_PITCH_CONTROL_DEFINITIONS = Object.freeze([
  Object.freeze({ action: 'transpose-down-semitone', label: '−½', mode: 'SEMITONE' as const, interval: -1 as const }),
  Object.freeze({ action: 'transpose-up-semitone', label: '+½', mode: 'SEMITONE' as const, interval: 1 as const }),
  Object.freeze({ action: 'transpose-down-step', label: '−Step', mode: 'DIATONIC' as const, interval: -1 as const }),
  Object.freeze({ action: 'transpose-up-step', label: '+Step', mode: 'DIATONIC' as const, interval: 1 as const })
]);

export const P10_3A_PITCH_CONTROL_STYLE = `
[data-st-p10-3a-pitch-control]{min-width:44px;min-height:44px;flex:0 0 auto;font:inherit;border:1px solid #c9c9cf;background:#fff;border-radius:8px;padding:8px 10px;touch-action:manipulation}
[data-st-p10-3a-pitch-control]:disabled{opacity:.45}
`;

export const p10_3aProfessionalWorkstationBrowserAppProfile = Object.freeze({
  ...p10_2ProfessionalWorkstationBrowserAppProfile,
  p10_3aWorkstationComposition: true,
  p10_3aWorkstationVersion: P10_3A_PROFESSIONAL_WORKSTATION_V1_VERSION,
  p10_2QualifiedBasePreserved: true,
  professionalSemitoneTransposeAvailable: true,
  professionalDiatonicTransposeAvailable: true,
  professionalPitchTransposeCanonicalAuthority: false,
  professionalPitchTransposeHistoryAuthority: 'EditorHistoryV4' as const,
  professionalPitchTransposeRendererCoordinateAuthority: false,
  professionalPitchTransposeDomAuthoringAuthority: false,
  productionDefault: false,
  productionReleaseAuthorized: false,
  seslitabCutoverAuthorized: false
});

export interface P10_3APitchTransposeStateV1 {
  readonly version: typeof P10_3A_PROFESSIONAL_WORKSTATION_V1_VERSION;
  readonly lastError: Readonly<{ readonly code: string; readonly message: string }> | null;
}

export type P10_3AProfessionalWorkstationStandaloneScoreEditorControllerV1 =
  Omit<P10_2ProfessionalWorkstationStandaloneScoreEditorControllerV1, 'profile' | 'mount' | 'unmount'> & {
    readonly profile: typeof p10_3aProfessionalWorkstationBrowserAppProfile;
    readonly getP10_3APitchTransposeState: () => Readonly<P10_3APitchTransposeStateV1>;
    readonly transposeProfessionalRangeBySemitones: (
      delta: number,
      options?: ProfessionalPitchTransposeOptionsV1
    ) => Readonly<ScoreEditorBrowserAppSnapshot>;
    readonly transposeProfessionalRangeDiatonically: (
      steps: number,
      options?: ProfessionalPitchTransposeOptionsV1
    ) => Readonly<ScoreEditorBrowserAppSnapshot>;
    readonly mount: (root: HTMLElement) => void;
    readonly unmount: () => void;
  };

const errorInfo = (error: unknown): Readonly<{ readonly code: string; readonly message: string }> => {
  const value = error !== null && typeof error === 'object'
    ? error as { readonly code?: unknown; readonly message?: unknown; readonly name?: unknown }
    : null;
  return Object.freeze({
    code: typeof value?.code === 'string' && value.code.length > 0
      ? value.code
      : typeof value?.name === 'string' && value.name.length > 0
        ? value.name
        : 'PROFESSIONAL_PITCH_TRANSPOSE_FAILED',
    message: typeof value?.message === 'string' && value.message.length > 0
      ? value.message
      : 'Professional pitch transpose failed.'
  });
};

const eventAddress = (
  controller: P10_2ProfessionalWorkstationStandaloneScoreEditorControllerV1,
  eventId: string
): EventAddressV3 => {
  const documentValue = controller.getDocument();
  if (documentValue === null) throw new Error('NO_DOCUMENT');
  const address = addressEntityV3(documentValue.session.history.present.score, eventId);
  if (address.kind !== 'event') throw new Error('RANGE_TARGET_INVALID');
  return address;
};

const prepareSelection = (
  controller: P10_2ProfessionalWorkstationStandaloneScoreEditorControllerV1
) => {
  const existing = controller.professional.getProfessionalSelection();
  if (existing !== null) return existing;

  const range = controller.getProfessionalRangeToolbarState();
  if (!range.rangeReady || range.rangeStartEventId === null || range.rangeStopEventId === null) {
    throw Object.assign(new Error('Capture a complete professional range first.'), { code: 'RANGE_NOT_READY' });
  }
  const documentValue = controller.getDocument();
  if (documentValue === null) throw Object.assign(new Error('No active score document.'), { code: 'NO_DOCUMENT' });
  return createEventSpanProfessionalSelectionV1(
    documentValue.session.history.present.score,
    eventAddress(controller, range.rangeStartEventId),
    eventAddress(controller, range.rangeStopEventId)
  );
};

const currentWorkstation = (
  controller: P10_2ProfessionalWorkstationStandaloneScoreEditorControllerV1
): Readonly<ScoreEditorProfessionalWorkstationV1> => {
  const documentValue = controller.getDocument();
  if (documentValue === null) throw Object.assign(new Error('No active score document.'), { code: 'NO_DOCUMENT' });
  return Object.freeze({
    version: SCORE_EDITOR_PROFESSIONAL_WORKSTATION_V1_VERSION,
    document: documentValue,
    professionalSelection: prepareSelection(controller)
  });
};

export const createP10_3AProfessionalWorkstationStandaloneScoreEditorControllerV1 = (
  options: ProfessionalWorkstationControllerOptionsV1 = {}
): Readonly<P10_3AProfessionalWorkstationStandaloneScoreEditorControllerV1> => {
  const base = createP10_2ProfessionalWorkstationStandaloneScoreEditorControllerV1(options);
  const revisionIdFactory = options.professionalRevisionIdFactory ?? options.revisionIdFactory ?? (() => {
    const cryptoValue = globalThis.crypto as Crypto | undefined;
    if (cryptoValue === undefined || typeof cryptoValue.randomUUID !== 'function') {
      throw Object.assign(
        new Error('Browser randomUUID support is required for a P10-3A pitch transpose revision.'),
        { code: 'REVISION_ID_UNAVAILABLE' }
      );
    }
    return `p10-3a:${cryptoValue.randomUUID()}`;
  });
  let lastError: Readonly<{ readonly code: string; readonly message: string }> | null = null;
  let root: HTMLElement | null = null;
  let disposed = false;

  const state = (): Readonly<P10_3APitchTransposeStateV1> => Object.freeze({
    version: P10_3A_PROFESSIONAL_WORKSTATION_V1_VERSION,
    lastError
  });

  const nextOptions = (
    provided?: ProfessionalPitchTransposeOptionsV1
  ): ProfessionalPitchTransposeOptionsV1 =>
    provided ?? Object.freeze({ nextRevisionId: revisionIdFactory() });

  const addPitchButton = (
    owner: Document,
    parent: HTMLElement,
    action: string,
    label: string,
    ariaLabel: string,
    disabled: boolean,
    handler: () => void
  ): void => {
    const button = owner.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.setAttribute('aria-label', ariaLabel);
    button.setAttribute('data-st-p10-3a-pitch-control', action);
    button.disabled = disabled;
    button.addEventListener('click', handler);
    parent.append(button);
  };

  const decoratePitchControls = (): void => {
    if (root === null || disposed) return;
    const app = root.querySelector<HTMLElement>('[data-st-score-editor-app]');
    if (app === null) return;

    app.querySelectorAll('[data-st-p10-3a-pitch-control]').forEach(node => node.remove());
    if (app.querySelector('[data-st-p10-3a-pitch-control-style]') === null) {
      const style = app.ownerDocument.createElement('style');
      style.setAttribute('data-st-p10-3a-pitch-control-style', P10_3A_PROFESSIONAL_WORKSTATION_V1_VERSION);
      style.textContent = P10_3A_PITCH_CONTROL_STYLE;
      app.append(style);
    }

    const toolbar = app.querySelector<HTMLElement>('[data-st-professional-range-toolbar]');
    if (toolbar === null) return;
    const current = base.getProfessionalRangeToolbarState();
    const owner = app.ownerDocument;
    const disabled = !current.canTransposeRange;

    addPitchButton(owner, toolbar, 'transpose-down-semitone', '−½', 'Transpose professional range down one semitone', disabled, () => {
      controller.transposeProfessionalRangeBySemitones(-1);
    });
    addPitchButton(owner, toolbar, 'transpose-up-semitone', '+½', 'Transpose professional range up one semitone', disabled, () => {
      controller.transposeProfessionalRangeBySemitones(1);
    });
    addPitchButton(owner, toolbar, 'transpose-down-step', '−Step', 'Transpose professional range down one diatonic step', disabled, () => {
      controller.transposeProfessionalRangeDiatonically(-1);
    });
    addPitchButton(owner, toolbar, 'transpose-up-step', '+Step', 'Transpose professional range up one diatonic step', disabled, () => {
      controller.transposeProfessionalRangeDiatonically(1);
    });

    const mobile = app.querySelector<HTMLElement>('[data-st-mobile-teacher-toolbar]');
    if (mobile !== null) {
      addPitchButton(owner, mobile, 'transpose-down-semitone-mobile', '−½', 'Transpose professional range down one semitone', disabled, () => {
        controller.transposeProfessionalRangeBySemitones(-1);
      });
      addPitchButton(owner, mobile, 'transpose-up-semitone-mobile', '+½', 'Transpose professional range up one semitone', disabled, () => {
        controller.transposeProfessionalRangeBySemitones(1);
      });
      addPitchButton(owner, mobile, 'transpose-down-step-mobile', '−Step', 'Transpose professional range down one diatonic step', disabled, () => {
        controller.transposeProfessionalRangeDiatonically(-1);
      });
      addPitchButton(owner, mobile, 'transpose-up-step-mobile', '+Step', 'Transpose professional range up one diatonic step', disabled, () => {
        controller.transposeProfessionalRangeDiatonically(1);
      });
    }
  };

  const run = (
    operation: (workstation: Readonly<ScoreEditorProfessionalWorkstationV1>) => Readonly<ScoreEditorProfessionalWorkstationV1>
  ): Readonly<ScoreEditorBrowserAppSnapshot> => {
    try {
      const result = operation(currentWorkstation(base));
      const adopted = base.adoptValidatedSnapshot(result.document);
      lastError = adopted.error === null ? null : Object.freeze({ ...adopted.error });
      return adopted;
    } catch (error) {
      lastError = errorInfo(error);
      return Object.freeze({ ...base.getSnapshot(), error: lastError });
    }
  };

  const unsubscribeBase = base.subscribe(() => {
    if (!disposed) decoratePitchControls();
  });

  const controller: P10_3AProfessionalWorkstationStandaloneScoreEditorControllerV1 = {
    ...base,
    profile: p10_3aProfessionalWorkstationBrowserAppProfile,
    getP10_3APitchTransposeState: state,
    transposeProfessionalRangeBySemitones: (delta, transposeOptions) => run((workstation) =>
      commitProfessionalPitchWorkstationSemitoneTransposeV1(workstation, delta, nextOptions(transposeOptions))
    ),
    transposeProfessionalRangeDiatonically: (steps, transposeOptions) => run((workstation) =>
      commitProfessionalPitchWorkstationDiatonicTransposeV1(workstation, steps, nextOptions(transposeOptions))
    ),
    mount: (nextRoot) => {
      if (disposed) throw Object.assign(new Error('P10-3A controller is disposed.'), { code: 'CONTROLLER_DISPOSED' });
      base.mount(nextRoot);
      root = nextRoot;
      decoratePitchControls();
    },
    unmount: () => {
      root = null;
      base.unmount();
    }
  };

  const originalDispose = base.dispose;
  return Object.freeze({
    ...controller,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      root = null;
      unsubscribeBase();
      originalDispose();
    }
  }) as Readonly<P10_3AProfessionalWorkstationStandaloneScoreEditorControllerV1>;
};

export const createP10_3AProfessionalWorkstationStandaloneBrowserAppRuntimeV1 = () => Object.freeze({
  runtimeVersion: P10_3A_PROFESSIONAL_WORKSTATION_V1_VERSION,
  profile: p10_3aProfessionalWorkstationBrowserAppProfile,
  createController: createP10_3AProfessionalWorkstationStandaloneScoreEditorControllerV1,
  p10_3aWorkstation: Object.freeze({
    version: P10_3A_PROFESSIONAL_WORKSTATION_V1_VERSION,
    p10_2QualifiedBasePreserved: true,
    semitoneTransposeAvailable: true,
    diatonicTransposeAvailable: true,
    canonicalAuthority: false,
    historyAuthority: 'EditorHistoryV4',
    rendererCoordinateAuthority: false,
    domAuthoringAuthority: false,
    productionDefault: false,
    productionReleaseAuthorized: false,
    seslitabCutoverAuthorized: false
  })
});
