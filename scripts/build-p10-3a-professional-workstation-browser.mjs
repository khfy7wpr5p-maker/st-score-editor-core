import { buildBoundedWorkstationArtifact } from './lib/build-bounded-workstation-artifact.mjs';

await buildBoundedWorkstationArtifact({
  stageLabel: 'P10-3A workstation',
  outDir: process.env.ST_SCORE_EDITOR_P10_3A_OUT_DIR ?? 'dist/browser',
  entryPoint: 'packages/score-editor-browser-professional-workstation-p10-3a-v1/src/global-entry.ts',
  artifact: 'st-score-editor-p10-3a-workstation.js',
  manifestFile: 'st-score-editor-p10-3a-workstation.manifest.json',
  entryHtml: 'st-score-editor-p10-3a-workstation.html',
  globalName: 'STScoreEditorP10_3AWorkstation',
  controllerGlobalName: 'STScoreEditorP10_3AWorkstationController',
  maxBytes: 655_360,
  budgetRevision: 'P10-3A-PITCH-TRANSPOSE-1',
  retainedBudgets: Object.freeze({
    p10_1Workstation: Object.freeze({
      file: 'st-score-editor-professional-workstation.manifest.json',
      maxBytes: 604_160,
      revision: 'P10-1-COMPOSITION-1'
    }),
    p10_2Workstation: Object.freeze({
      file: 'st-score-editor-p10-2-workstation.manifest.json',
      maxBytes: 624_640,
      revision: 'P10-2-UNRETIMING-1'
    })
  }),
  contract: 'ST_SCORE_EDITOR_P10_3A_PROFESSIONAL_WORKSTATION_BUNDLE',
  artifactClass: 'optional-p10-3a-professional-pitch-transpose-composition',
  title: 'ST Score Editor P10-3A Workstation Qualification',
  rootId: 'st-score-editor-p10-3a-workstation-root',
  manifestCapabilities: Object.freeze({
    p10_1QualifiedBasePreserved: true,
    p10_2QualifiedBasePreserved: true,
    semitoneTransposeBundled: true,
    diatonicTransposeBundled: true,
    canonicalAuthority: false,
    historyAuthority: 'EditorHistoryV4',
    semanticTargetAuthority: 'SemanticAddressV3-current-revision',
    rendererIntegrated: true,
    audioHostIntegrated: true,
    audioEngineBundled: false,
    externalAudioRuntimeRequired: true,
    rendererCoordinateAuthority: false,
    domAuthoringAuthority: false,
    productionDefault: false,
    replacesP10_1Artifact: false,
    replacesP10_2Artifact: false,
    productionReleaseAuthorized: false,
    seslitabCutoverAuthorized: false,
    physicalDeviceValidationRequired: true,
    physicalDeviceValidationPassed: false
  })
});
