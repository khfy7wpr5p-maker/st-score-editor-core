import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  APP09B_CORRECTION_ENGINE_SOURCE_REVISION,
  assembleApp09BPreview
} from '../scripts/assemble-app09b-preview.mjs';

const rendererManifest = {
  schemaVersion: 1,
  rendererSourceRevision: 'effc13c82eb1e537773541e5a659f435ecb71583',
  scoreRendererContractVersion: '0.2.0',
  vendor: { opensheetmusicdisplay: { version: '2.1.2', license: 'BSD-3-Clause' } },
  files: [
    { path: 'index.html' },
    { path: 'workstation-bootstrap.mjs' },
    { path: 'vendor/opensheetmusicdisplay.min.js' }
  ]
};

async function writeRenderer(root) {
  await mkdir(path.join(root, 'vendor'), { recursive: true });
  await writeFile(path.join(root, 'index.html'), '<!doctype html>');
  await writeFile(path.join(root, 'workstation-bootstrap.mjs'), 'export {};');
  await writeFile(path.join(root, 'vendor/opensheetmusicdisplay.min.js'), '/* osmd */');
  await writeFile(path.join(root, 'runtime-manifest.json'), JSON.stringify(rendererManifest));
}

async function writeCorrection(root) {
  await mkdir(root, { recursive: true });
  const artifact = 'globalThis.STOmrCorrectionAnalysisRuntime={analyzeMusicXmlSuspiciousMeasures(){return {mode:"SHADOW_ONLY",partId:"P1",suspiciousMeasures:[],automaticApplyAuthority:false,musicXmlWriteBackAuthority:false}}};';
  await writeFile(path.join(root, 'ce-analysis-browser-runtime.js'), artifact);
  await writeFile(path.join(root, 'ce-analysis-browser-runtime.manifest.json'), JSON.stringify({
    contract: 'ST_OMR_CORRECTION_ENGINE_ANALYSIS_BROWSER',
    contractVersion: '1.0.0',
    runtimeVersion: '1.0.0',
    engineSourceRevision: APP09B_CORRECTION_ENGINE_SOURCE_REVISION,
    artifact: 'ce-analysis-browser-runtime.js',
    format: 'iife',
    target: 'es2022',
    global: 'STOmrCorrectionAnalysisRuntime',
    externalImports: 0,
    networkCapable: false,
    persistenceCapable: false,
    authenticationAuthority: false,
    automaticApplyAuthority: false,
    learningAuthority: false,
    musicXmlWriteBackAuthority: false,
    bytes: Buffer.byteLength(artifact),
    sha256: createHash('sha256').update(artifact).digest('hex')
  }));
}

test('APP-09B optionally embeds exact read-only Correction Engine analysis runtime', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'stse-ce-e2e-'));
  try {
    const rendererDir = path.join(temp, 'renderer');
    const correctionDir = path.join(temp, 'correction');
    const outputDir = path.join(temp, 'out');
    await writeRenderer(rendererDir);
    await writeCorrection(correctionDir);

    const result = await assembleApp09BPreview({
      runtimeDir: rendererDir,
      correctionRuntimeDir: correctionDir,
      outputDir
    });
    const html = await readFile(path.join(outputDir, 'st-score-editor-app09b.html'), 'utf8');
    const bootstrap = await readFile(path.join(outputDir, 'st-score-editor-app09b-bootstrap.js'), 'utf8');

    assert.equal(result.correctionAnalysis.enabled, true);
    assert.equal(result.correctionAnalysis.engineSourceRevision, APP09B_CORRECTION_ENGINE_SOURCE_REVISION);
    assert.match(html, /correction-runtime\/ce-analysis-browser-runtime\.js/);
    assert.match(bootstrap, /analyzeMusicXmlSuspiciousMeasures/);
    assert.match(bootstrap, /analyzeMusicXmlAndHighlight/);
    assert.match(bootstrap, /openMusicXmlWithCorrectionAnalysis/);
    assert.match(bootstrap, /analysis\.partId/);
    assert.match(bootstrap, /measureIndex/);
    assert.match(bootstrap, /automaticApplyAuthority !== false/);
    assert.match(bootstrap, /musicXmlWriteBackAuthority !== false/);
    assert.match(bootstrap, /APP09B_CORRECTION_ANALYSIS_FAILED/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('APP-09B remains correction-runtime optional', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'stse-ce-optional-'));
  try {
    const rendererDir = path.join(temp, 'renderer');
    const outputDir = path.join(temp, 'out');
    await writeRenderer(rendererDir);
    const result = await assembleApp09BPreview({ runtimeDir: rendererDir, outputDir });
    const html = await readFile(path.join(outputDir, 'st-score-editor-app09b.html'), 'utf8');
    assert.equal(result.correctionAnalysis.enabled, false);
    assert.doesNotMatch(html, /ce-analysis-browser-runtime\.js/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
