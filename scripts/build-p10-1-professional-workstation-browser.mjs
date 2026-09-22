import { buildBoundedWorkstationArtifact } from './lib/build-bounded-workstation-artifact.mjs';

await buildBoundedWorkstationArtifact({
  stageLabel: 'P10-1 professional workstation',
  outDir: 'dist/browser',
  entryPoint: 'packages/score-editor-browser-professional-workstation-v1/src/global-entry.ts',
  artifact: 'st-score-editor-professional-workstation.js',
  manifestFile: 'st-score-editor-professional-workstation.manifest.json',
  entryHtml: 'st-score-editor-professional-workstation.html',
  globalName: 'STScoreEditorProfessionalWorkstation',
  controllerGlobalName: 'STScoreEditorProfessionalWorkstationController',
  maxBytes: 604_160,
  budgetRevision: 'P10-1-COMPOSITION-1',
  retainedBudgets: Object.freeze({
    defaultApp: Object.freeze({
      file: 'st-score-editor-app.manifest.json',
      maxBytes: 542_720,
      revision: 'P06-AUDIO-V010-1'
    }),
    p08Professional: Object.freeze({
      file: 'st-score-editor-professional.manifest.json',
      maxBytes: 615_000,
      revision: 'P08-E4-QUALIFIED-1'
    }),
    p09Keyboard: Object.freeze({
      file: 'st-score-editor-keyboard-workstation.manifest.json',
      maxBytes: 552_960,
      revision: 'P09-D-QUALIFIED-1'
    })
  }),
  contract: 'ST_SCORE_EDITOR_P10_1_PROFESSIONAL_WORKSTATION_BUNDLE',
  artifactClass: 'optional-professional-workstation-composition',
  title: 'ST Score Editor Professional Workstation Qualification',
  rootId: 'st-score-editor-professional-workstation-root',
  manifestCapabilities: Object.freeze({
    canonicalAuthority: false,
    historyAuthority: 'EditorHistoryV4',
    semanticTargetAuthority: 'SemanticAddressV3-current-revision',
    p08ProfessionalBundled: true,
    p09KeyboardBundled: true,
    app10AuthoringAvailable: true,
    app11AuthoringAvailable: true,
    rendererIntegrated: true,
    audioHostIntegrated: true,
    audioEngineBundled: false,
    externalAudioRuntimeRequired: true,
    rendererCoordinateAuthority: false,
    domAuthoringAuthority: false,
    keyboardCursorAuthority: false,
    professionalSelectionCanonicalAuthority: false,
    productionDefault: false,
    replacesDefaultApp: false,
    productionReleaseAuthorized: false,
    seslitabCutoverAuthorized: false,
    physicalDeviceValidationRequired: true,
    physicalDeviceValidationPassed: false
  })
});
