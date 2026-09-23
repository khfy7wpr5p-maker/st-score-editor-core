import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const execFileAsync=promisify(execFile);
const readJson=async file=>JSON.parse(await readFile(file,'utf8'));

test('P10-3B optional workstation artifact is independently bounded and preserves P10-1/P10-2/P10-3A budget contracts',async()=>{
  const outDir=await mkdtemp(path.join(os.tmpdir(),'stse-p10-3b-artifact-'));
  try{
    await writeFile(
      path.join(outDir,'st-score-editor-professional-workstation.manifest.json'),
      JSON.stringify({maxBytes:604160,bundleBudgetRevision:'P10-1-COMPOSITION-1'}),
      'utf8'
    );
    await writeFile(
      path.join(outDir,'st-score-editor-p10-2-workstation.manifest.json'),
      JSON.stringify({maxBytes:624640,bundleBudgetRevision:'P10-2-UNRETIMING-1'}),
      'utf8'
    );
    await writeFile(
      path.join(outDir,'st-score-editor-p10-3a-workstation.manifest.json'),
      JSON.stringify({maxBytes:655360,bundleBudgetRevision:'P10-3A-PITCH-TRANSPOSE-1'}),
      'utf8'
    );

    const result=await execFileAsync(
      process.execPath,
      ['scripts/build-p10-3b-professional-workstation-browser.mjs'],
      {
        cwd:process.cwd(),
        env:{...process.env,ST_SCORE_EDITOR_P10_3B_OUT_DIR:outDir},
        maxBuffer:1024*1024
      }
    );
    if(result.stdout.length>0) process.stdout.write(result.stdout);
    if(result.stderr.length>0) process.stderr.write(result.stderr);

    const manifest=await readJson(path.join(outDir,'st-score-editor-p10-3b-workstation.manifest.json'));
    const bundle=await readFile(path.join(outDir,'st-score-editor-p10-3b-workstation.js'));
    const html=await readFile(path.join(outDir,'st-score-editor-p10-3b-workstation.html'),'utf8');

    assert.equal(manifest.contract,'ST_SCORE_EDITOR_P10_3B_PROFESSIONAL_WORKSTATION_BUNDLE');
    assert.equal(manifest.version,'1.0.0');
    assert.equal(manifest.artifactClass,'optional-p10-3b-professional-range-replace-composition');
    assert.equal(manifest.global,'STScoreEditorP10_3BWorkstation');
    assert.notEqual(manifest.bundleBudgetRevision,'MEASUREMENT_ONLY_NOT_QUALIFIED');
    assert.equal(typeof manifest.maxBytes,'number');
    assert.equal(manifest.bytes,bundle.byteLength);
    assert.ok(manifest.bytes<=manifest.maxBytes);
    assert.ok(manifest.maxBytes-manifest.bytes>=0);
    assert.ok(manifest.maxBytes-manifest.bytes<=20000);
    assert.equal(createHash('sha256').update(bundle).digest('hex'),manifest.sha256);

    assert.deepEqual(manifest.retainedBudgets.p10_1Workstation,{
      maxBytes:604160,
      bundleBudgetRevision:'P10-1-COMPOSITION-1'
    });
    assert.deepEqual(manifest.retainedBudgets.p10_2Workstation,{
      maxBytes:624640,
      bundleBudgetRevision:'P10-2-UNRETIMING-1'
    });
    assert.deepEqual(manifest.retainedBudgets.p10_3aWorkstation,{
      maxBytes:655360,
      bundleBudgetRevision:'P10-3A-PITCH-TRANSPOSE-1'
    });

    assert.equal(manifest.p10_1QualifiedBasePreserved,true);
    assert.equal(manifest.p10_2QualifiedBasePreserved,true);
    assert.equal(manifest.p10_3aQualifiedBasePreserved,true);
    assert.equal(manifest.professionalRangeCopyBundled,true);
    assert.equal(manifest.professionalRangeReplaceBundled,true);
    assert.equal(manifest.canonicalAuthority,false);
    assert.equal(manifest.historyAuthority,'EditorHistoryV4');
    assert.equal(manifest.rendererCoordinateAuthority,false);
    assert.equal(manifest.domAuthoringAuthority,false);
    assert.equal(manifest.productionDefault,false);
    assert.equal(manifest.replacesP10_1Artifact,false);
    assert.equal(manifest.replacesP10_2Artifact,false);
    assert.equal(manifest.replacesP10_3aArtifact,false);
    assert.equal(manifest.productionReleaseAuthorized,false);
    assert.equal(manifest.seslitabCutoverAuthorized,false);
    assert.equal(manifest.physicalDeviceValidationRequired,true);
    assert.equal(manifest.physicalDeviceValidationPassed,false);

    assert.match(bundle.toString('utf8'),/STScoreEditorP10_3BWorkstation/);
    assert.match(html,/STScoreEditorP10_3BWorkstation\.createController/);
  }finally{
    await rm(outDir,{recursive:true,force:true});
  }
});
