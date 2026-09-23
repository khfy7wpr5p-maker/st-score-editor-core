import { buildBoundedWorkstationArtifact } from './lib/build-bounded-workstation-artifact.mjs';
import {
  professionalWorkstationManifestCapabilities,
  retainedProfessionalWorkstationBudgets
} from './lib/professional-workstation-stage-config.mjs';

await buildBoundedWorkstationArtifact({
  stageLabel: 'P10-3B workstation',
  outDir: process.env.ST_SCORE_EDITOR_P10_3B_OUT_DIR ?? 'dist/browser',
  entryPoint: 'packages/score-editor-browser-professional-workstation-p10-3b-v1/src/global-entry.ts',
  artifact: 'st-score-editor-p10-3b-workstation.js',
  manifestFile: 'st-score-editor-p10-3b-workstation.manifest.json',
  entryHtml: 'st-score-editor-p10-3b-workstation.html',
  globalName: 'STScoreEditorP10_3BWorkstation',
  controllerGlobalName: 'STScoreEditorP10_3BWorkstationController',
  maxBytes: 675_840,
  budgetRevision: 'P10-3B-RANGE-REPLACE-1',
  retainedBudgets: retainedProfessionalWorkstationBudgets(
    'p10_1Workstation',
    'p10_2Workstation',
    'p10_3aWorkstation'
  ),
  contract: 'ST_SCORE_EDITOR_P10_3B_PROFESSIONAL_WORKSTATION_BUNDLE',
  artifactClass: 'optional-p10-3b-professional-range-replace-composition',
  title: 'ST Score Editor P10-3B Workstation Qualification',
  rootId: 'st-score-editor-p10-3b-workstation-root',
  manifestCapabilities: professionalWorkstationManifestCapabilities({
    p10_1QualifiedBasePreserved: true,
    p10_2QualifiedBasePreserved: true,
    p10_3aQualifiedBasePreserved: true,
    professionalRangeCopyBundled: true,
    professionalRangeReplaceBundled: true,
    replacesP10_1Artifact: false,
    replacesP10_2Artifact: false,
    replacesP10_3aArtifact: false
  })
});