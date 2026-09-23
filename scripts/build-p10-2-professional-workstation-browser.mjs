import { buildBoundedWorkstationArtifact } from './lib/build-bounded-workstation-artifact.mjs';
import {
  professionalWorkstationManifestCapabilities,
  retainedProfessionalWorkstationBudgets
} from './lib/professional-workstation-stage-config.mjs';

await buildBoundedWorkstationArtifact({
  stageLabel: 'P10-2 workstation',
  outDir: 'dist/browser',
  entryPoint: 'packages/score-editor-browser-professional-workstation-p10-2-v1/src/global-entry.ts',
  artifact: 'st-score-editor-p10-2-workstation.js',
  manifestFile: 'st-score-editor-p10-2-workstation.manifest.json',
  entryHtml: 'st-score-editor-p10-2-workstation.html',
  globalName: 'STScoreEditorP10_2Workstation',
  controllerGlobalName: 'STScoreEditorP10_2WorkstationController',
  maxBytes: 624_640,
  budgetRevision: 'P10-2-UNRETIMING-1',
  retainedBudgets: retainedProfessionalWorkstationBudgets('p10_1Workstation'),
  contract: 'ST_SCORE_EDITOR_P10_2_PROFESSIONAL_WORKSTATION_BUNDLE',
  artifactClass: 'optional-p10-2-professional-workstation-composition',
  title: 'ST Score Editor P10-2 Workstation Qualification',
  rootId: 'st-score-editor-p10-2-workstation-root',
  manifestCapabilities: professionalWorkstationManifestCapabilities({
    p10_1QualifiedBasePreserved: true,
    tripletUnretimingBundled: true,
    replacesP10_1Artifact: false
  })
});