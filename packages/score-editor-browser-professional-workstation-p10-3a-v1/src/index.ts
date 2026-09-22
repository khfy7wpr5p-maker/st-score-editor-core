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
  Omit<P10_2ProfessionalWorkstationStandaloneScoreEditorControllerV1, 'profile'> & {
    readonly profile: typeof p10_3aProfessionalWorkstationBrowserAppProfile;
    readonly getP10_3APitchTransposeState: () => Readonly<P10_3APitchTransposeStateV1>;
    readonly transposeProfessionalRangeBySemitones: (
      delta: number,
      options: ProfessionalPitchTransposeOptionsV1
    ) => Readonly<ScoreEditorBrowserAppSnapshot>;
    readonly transposeProfessionalRangeDiatonically: (
      steps: number,
      options: ProfessionalPitchTransposeOptionsV1
    ) => Readonly<ScoreEditorBrowserAppSnapshot>;
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
  let lastError: Readonly<{ readonly code: string; readonly message: string }> | null = null;

  const state = (): Readonly<P10_3APitchTransposeStateV1> => Object.freeze({
    version: P10_3A_PROFESSIONAL_WORKSTATION_V1_VERSION,
    lastError
  });

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

  return Object.freeze({
    ...base,
    profile: p10_3aProfessionalWorkstationBrowserAppProfile,
    getP10_3APitchTransposeState: state,
    transposeProfessionalRangeBySemitones: (delta, transposeOptions) => run((workstation) =>
      commitProfessionalPitchWorkstationSemitoneTransposeV1(workstation, delta, transposeOptions)
    ),
    transposeProfessionalRangeDiatonically: (steps, transposeOptions) => run((workstation) =>
      commitProfessionalPitchWorkstationDiatonicTransposeV1(workstation, steps, transposeOptions)
    )
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
