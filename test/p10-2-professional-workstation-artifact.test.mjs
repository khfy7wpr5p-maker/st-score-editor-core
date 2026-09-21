import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';

const execFileAsync=promisify(execFile);
const readJson=async path=>JSON.parse(await readFile(path,'utf8'));

test('P10-2 optional workstation artifact is independently bounded and preserves the qualified P10-1 artifact',async()=>{
  for(const script of [
    'scripts/build-professional-browser.mjs',
    'scripts/build-p09d-keyboard-workstation-browser.mjs',
    'scripts/build-p10-1-professional-workstation-browser.mjs',
    'scripts/build-p10-2-professional-workstation-browser.mjs'
  ]){
    const result=await execFileAsync(process.execPath,[script],{
      cwd:process.cwd(),
      maxBuffer:1024*1024
    });
    if(result.stdout.length>0) process.stdout.write(result.stdout);
    if(result.stderr.length>0) process.stderr.write(result.stderr);
  }

  const manifest=await readJson('dist/browser/st-score-editor-p10-2-workstation.manifest.json');
  const bundle=await readFile('dist/browser/st-score-editor-p10-2-workstation.js');
  const html=await readFile('dist/browser/st-score-editor-p10-2-workstation.html','utf8');

  assert.equal(manifest.contract,'ST_SCORE_EDITOR_P10_2_PROFESSIONAL_WORKSTATION_BUNDLE');
  assert.equal(manifest.version,'1.0.0');
  assert.equal(manifest.artifactClass,'optional-p10-2-professional-workstation-composition');
  assert.equal(manifest.global,'STScoreEditorP10_2Workstation');
  assert.equal(manifest.bundleBudgetRevision,'P10-2-UNRETIMING-1');
  assert.equal(manifest.maxBytes,624640);
  assert.equal(manifest.bytes,bundle.byteLength);
  assert.ok(manifest.bytes<=manifest.maxBytes);
  assert.ok(manifest.maxBytes-manifest.bytes<=20000);
  assert.equal(createHash('sha256').update(bundle).digest('hex'),manifest.sha256);

  assert.deepEqual(manifest.retainedBudgets.p10_1Workstation,{
    maxBytes:604160,
    bundleBudgetRevision:'P10-1-COMPOSITION-1'
  });
  assert.equal(manifest.p10_1QualifiedBasePreserved,true);
  assert.equal(manifest.tripletUnretimingBundled,true);
  assert.equal(manifest.canonicalAuthority,false);
  assert.equal(manifest.rendererCoordinateAuthority,false);
  assert.equal(manifest.productionDefault,false);
  assert.equal(manifest.replacesP10_1Artifact,false);
  assert.equal(manifest.productionReleaseAuthorized,false);
  assert.equal(manifest.seslitabCutoverAuthorized,false);

  assert.match(bundle.toString('utf8'),/STScoreEditorP10_2Workstation/);
  assert.match(html,/STScoreEditorP10_2Workstation\.createController/);
});
