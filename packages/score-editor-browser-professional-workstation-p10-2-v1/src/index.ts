import {
  createProfessionalWorkstationStandaloneScoreEditorControllerV1,
  professionalWorkstationBrowserAppProfile,
  type ProfessionalWorkstationControllerOptionsV1,
  type ProfessionalWorkstationStandaloneScoreEditorControllerV1
} from '../../score-editor-browser-professional-workstation-v1/src/index.js';
import {
  attachTripletUnretimingToBrowserControllerV1,
  tripletUnretimingBrowserAppProfile,
  type TripletUnretimingStandaloneScoreEditorControllerV1
} from '../../score-editor-browser-app/src/triplet-unretiming-authoring.js';
import type {
  TripletRetimingStandaloneScoreEditorController
} from '../../score-editor-browser-app/src/triplet-retiming-authoring.js';

export const P10_2_PROFESSIONAL_WORKSTATION_V1_VERSION = '1.0.0' as const;

export const p10_2ProfessionalWorkstationBrowserAppProfile = Object.freeze({
  ...professionalWorkstationBrowserAppProfile,
  p10_2WorkstationComposition: true,
  p10_2WorkstationVersion: P10_2_PROFESSIONAL_WORKSTATION_V1_VERSION,
  p10_1QualifiedBasePreserved: true,
  tripletUnretimingAuthoringBundled:
    tripletUnretimingBrowserAppProfile.tripletUnretimingAuthoringBundled,
  tripletUnretimingCanonicalAuthority:
    tripletUnretimingBrowserAppProfile.tripletUnretimingCanonicalAuthority,
  tripletUnretimingSelection:
    tripletUnretimingBrowserAppProfile.tripletUnretimingSelection,
  tripletUnretimingAdmission:
    tripletUnretimingBrowserAppProfile.tripletUnretimingAdmission,
  tripletUnretimingMutation:
    tripletUnretimingBrowserAppProfile.tripletUnretimingMutation,
  tripletUnretimingHistory:
    tripletUnretimingBrowserAppProfile.tripletUnretimingHistory,
  tripletUnretimingRendererCoordinateAuthority:
    tripletUnretimingBrowserAppProfile.tripletUnretimingRendererCoordinateAuthority,
  tripletUnretimingDomAuthoringAuthority:
    tripletUnretimingBrowserAppProfile.tripletUnretimingDomAuthoringAuthority,
  productionDefault: false,
  productionReleaseAuthorized: false,
  seslitabCutoverAuthorized: false
});

type TripletUnretimingSurface = Pick<
  TripletUnretimingStandaloneScoreEditorControllerV1,
  'getTripletUnretimingState' | 'removeTripletFromCapturedEvents'
>;

export type P10_2ProfessionalWorkstationStandaloneScoreEditorControllerV1 =
  Omit<ProfessionalWorkstationStandaloneScoreEditorControllerV1, 'profile'> &
  TripletUnretimingSurface & {
    readonly profile: typeof p10_2ProfessionalWorkstationBrowserAppProfile;
  };

export const createP10_2ProfessionalWorkstationStandaloneScoreEditorControllerV1 = (
  options: ProfessionalWorkstationControllerOptionsV1 = {}
): Readonly<P10_2ProfessionalWorkstationStandaloneScoreEditorControllerV1> => {
  const base = createProfessionalWorkstationStandaloneScoreEditorControllerV1(options);
  const unretiming = attachTripletUnretimingToBrowserControllerV1(
    base as unknown as TripletRetimingStandaloneScoreEditorController,
    options.revisionIdFactory === undefined
      ? {}
      : { revisionIdFactory: options.revisionIdFactory }
  );

  return Object.freeze({
    ...unretiming,
    profile: p10_2ProfessionalWorkstationBrowserAppProfile
  }) as Readonly<P10_2ProfessionalWorkstationStandaloneScoreEditorControllerV1>;
};


export const createP10_2ProfessionalWorkstationStandaloneBrowserAppRuntimeV1 = () => Object.freeze({
  runtimeVersion: P10_2_PROFESSIONAL_WORKSTATION_V1_VERSION,
  profile: p10_2ProfessionalWorkstationBrowserAppProfile,
  createController: createP10_2ProfessionalWorkstationStandaloneScoreEditorControllerV1,
  p10_2Workstation: Object.freeze({
    version: P10_2_PROFESSIONAL_WORKSTATION_V1_VERSION,
    p10_1QualifiedBasePreserved: true,
    tripletUnretimingBundled: true,
    canonicalAuthority: false,
    historyAuthority: 'EditorHistoryV4',
    rendererCoordinateAuthority: false,
    productionDefault: false,
    productionReleaseAuthorized: false,
    seslitabCutoverAuthorized: false
  })
});
