import { buildBoundedWorkstationArtifact } from './lib/build-bounded-workstation-artifact.mjs';

await buildBoundedWorkstationArtifact({
  stageLabel: 'P10-3B workstation measurement',
  outDir: process.env.ST_SCORE_EDITOR_P10_3B_OUT_DIR ?? 'dist/browser',
  entryPoint: 'packages/score-editor-browser-professional-workstation-p10-3b-v1/src/global-entry.ts',
  artifact: 'st-score-editor-p10-3b-workstation.js',
  manifestFile: 'st-score-editor-p10-3b-workstation.manifest.json',
  entryHtml: 'st-score-editor-p10-3b-workstation.html',
  globalName: 'STScoreEditorP10_3BWorkstation',
  controllerGlobalName: 'STScoreEditorP10_3BWorkstationController',
  maxBytes: 1_048_576,
  budgetRevision: 'MEASUREMENT_ONLY_NOT_QUALIFIED',
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
    }),
    p10_3aWorkstation: Object.freeze({
      file: 'st-score-editor-p10-3a-workstation.manifest.json',
      maxBytes: 655_360,
      revision: 'P10-3A-PITCH-TRANSPOSE-1'
    })
  }),
  contract: 'ST_SCORE_EDITOR_P10_3B_PROFESSIONAL_WORKSTATION_BUNDLE',
  artifactClass: 'optional-p10-3b-professional-range-replace-composition',
  title: 'ST Score Editor P10-3B Workstation Qualification',
  rootId: 'st-score-editor-p10-3b-workstation-root',
  manifestCapabilities: Object.freeze({
    p10_1QualifiedBasePreserved: true,
    p10_2QualifiedBasePreserved: true,
    p10_3aQualifiedBasePreserved: true,
    professionalRangeCopyBundled: true,
    professionalRangeReplaceBundled: true,
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
    replacesP10_3aArtifact: false,
    productionReleaseAuthorized: false,
    seslitabCutoverAuthorized: false,
    physicalDeviceValidationRequired: true,
    physicalDeviceValidationPassed: false
  })
});
