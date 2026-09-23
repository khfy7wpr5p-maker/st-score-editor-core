import test from 'node:test';
import assert from 'node:assert/strict';
import {
  expectedRetainedBudget,
  withIsolatedWorkstationArtifact
} from './helpers/professional-workstation-artifact-fixture.mjs';

test('P10-3A optional workstation artifact is independently bounded and preserves P10-1/P10-2 budget contracts',async()=>{
  await withIsolatedWorkstationArtifact({
    tempPrefix:'stse-p10-3a-artifact-',
    outputEnv:'ST_SCORE_EDITOR_P10_3A_OUT_DIR',
    buildScript:'scripts/build-p10-3a-professional-workstation-browser.mjs',
    artifactBase:'st-score-editor-p10-3a-workstation',
    retained:['p10_1Workstation','p10_2Workstation']
  },async({manifest,bundle,html})=>{
    assert.equal(manifest.contract,'ST_SCORE_EDITOR_P10_3A_PROFESSIONAL_WORKSTATION_BUNDLE');
    assert.equal(manifest.version,'1.0.0');
    assert.equal(manifest.artifactClass,'optional-p10-3a-professional-pitch-transpose-composition');
    assert.equal(manifest.global,'STScoreEditorP10_3AWorkstation');
    assert.equal(manifest.bundleBudgetRevision,'P10-3A-PITCH-TRANSPOSE-1');
    assert.equal(manifest.maxBytes,655360);

    assert.deepEqual(
      manifest.retainedBudgets.p10_1Workstation,
      expectedRetainedBudget('p10_1Workstation')
    );
    assert.deepEqual(
      manifest.retainedBudgets.p10_2Workstation,
      expectedRetainedBudget('p10_2Workstation')
    );
    assert.equal(manifest.p10_1QualifiedBasePreserved,true);
    assert.equal(manifest.p10_2QualifiedBasePreserved,true);
    assert.equal(manifest.semitoneTransposeBundled,true);
    assert.equal(manifest.diatonicTransposeBundled,true);
    assert.equal(manifest.canonicalAuthority,false);
    assert.equal(manifest.rendererCoordinateAuthority,false);
    assert.equal(manifest.domAuthoringAuthority,false);
    assert.equal(manifest.productionDefault,false);
    assert.equal(manifest.replacesP10_1Artifact,false);
    assert.equal(manifest.replacesP10_2Artifact,false);
    assert.equal(manifest.productionReleaseAuthorized,false);
    assert.equal(manifest.seslitabCutoverAuthorized,false);

    assert.match(bundle.toString('utf8'),/STScoreEditorP10_3AWorkstation/);
    assert.match(html,/STScoreEditorP10_3AWorkstation\.createController/);
  });
});
