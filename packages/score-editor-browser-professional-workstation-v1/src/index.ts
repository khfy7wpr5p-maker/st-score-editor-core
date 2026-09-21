import {
  createAudioHostIntegratedStandaloneScoreEditorController,
  type AudioHostIntegratedStandaloneScoreEditorController
} from '../../score-editor-browser-app/src/audio-host-integrated.js';
import {
  attachKeyboardWorkstationToBrowserControllerV1,
  keyboardWorkstationBrowserAppProfile,
  type KeyboardWorkstationControllerOptions,
  type KeyboardWorkstationStandaloneScoreEditorController
} from '../../score-editor-browser-app/src/keyboard-workstation.js';
import {
  attachProfessionalRangeToolbarToBrowserControllerV1,
  type ProfessionalRangeToolbarStandaloneScoreEditorControllerV1
} from '../../score-editor-browser-professional-ui-v1/src/index.js';
import {
  attachProfessionalStructureInspectorToRangeControllerV1,
  professionalStructureInspectorBrowserAppProfile,
  type ProfessionalStructureInspectorOptionsV1,
  type ProfessionalStructureInspectorStandaloneScoreEditorControllerV1
} from '../../score-editor-browser-professional-structure-ui-v1/src/index.js';

export const PROFESSIONAL_WORKSTATION_V1_VERSION = '1.0.0' as const;

export const professionalWorkstationBrowserAppProfile = Object.freeze({
  ...professionalStructureInspectorBrowserAppProfile,
  ...keyboardWorkstationBrowserAppProfile,
  professionalWorkstationComposition: true,
  professionalWorkstationVersion: PROFESSIONAL_WORKSTATION_V1_VERSION,
  canonicalAuthority: false,
  historyAuthority: 'EditorHistoryV4' as const,
  semanticTargetAuthority: 'SemanticAddressV3-current-revision' as const,
  keyboardCursorAuthority: false,
  professionalSelectionCanonicalAuthority: false,
  rendererCoordinateAuthority: false,
  domAuthoringAuthority: false,
  audioHostIntegrated: true,
  audioEngineBundled: false,
  externalAudioRuntimeRequired: true,
  productionDefault: false,
  productionReleaseAuthorized: false,
  seslitabCutoverAuthorized: false
});

export type ProfessionalWorkstationControllerOptionsV1 =
  KeyboardWorkstationControllerOptions & ProfessionalStructureInspectorOptionsV1;

type KeyboardSurface = Pick<
  KeyboardWorkstationStandaloneScoreEditorController,
  'getKeyboardWorkstationState' | 'dispatchKeyboardIntent'
>;

type AudioSurface = Pick<
  AudioHostIntegratedStandaloneScoreEditorController,
  'attachAudioPort' |
  'detachAudioPort' |
  'getAudioHostState' |
  'setAuditionInstrument' |
  'selectRenderedScoreNoteRefWithAudition'
>;

export type ProfessionalWorkstationStandaloneScoreEditorControllerV1 =
  Omit<ProfessionalStructureInspectorStandaloneScoreEditorControllerV1, 'profile'> &
  KeyboardSurface &
  AudioSurface & {
    readonly profile: typeof professionalWorkstationBrowserAppProfile;
  };

export const createProfessionalWorkstationStandaloneScoreEditorControllerV1 = (
  options: ProfessionalWorkstationControllerOptionsV1 = {}
): Readonly<ProfessionalWorkstationStandaloneScoreEditorControllerV1> => {
  const audio = createAudioHostIntegratedStandaloneScoreEditorController(options);
  const keyboard = attachKeyboardWorkstationToBrowserControllerV1(
    audio,
    options.keyboardBindings
  );
  const range = attachProfessionalRangeToolbarToBrowserControllerV1(
    keyboard as unknown as Parameters<typeof attachProfessionalRangeToolbarToBrowserControllerV1>[0],
    options
  );
  const structure = attachProfessionalStructureInspectorToRangeControllerV1(
    range as ProfessionalRangeToolbarStandaloneScoreEditorControllerV1,
    options
  );

  return Object.freeze({
    ...structure,
    profile: professionalWorkstationBrowserAppProfile
  }) as Readonly<ProfessionalWorkstationStandaloneScoreEditorControllerV1>;
};

export const createProfessionalWorkstationStandaloneBrowserAppRuntimeV1 = () => Object.freeze({
  runtimeVersion: PROFESSIONAL_WORKSTATION_V1_VERSION,
  profile: professionalWorkstationBrowserAppProfile,
  createController: createProfessionalWorkstationStandaloneScoreEditorControllerV1,
  professionalWorkstation: Object.freeze({
    version: PROFESSIONAL_WORKSTATION_V1_VERSION,
    canonicalAuthority: false,
    historyAuthority: 'EditorHistoryV4',
    semanticTargetAuthority: 'SemanticAddressV3-current-revision',
    p08ProfessionalBundled: true,
    p09KeyboardBundled: true,
    audioHostIntegrated: true,
    audioEngineBundled: false,
    externalAudioRuntimeRequired: true,
    productionDefault: false,
    productionReleaseAuthorized: false,
    seslitabCutoverAuthorized: false
  })
});
