import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  APP09B_OSMD_VERSION,
  APP09B_RENDERER_CONTRACT_VERSION,
  APP09B_RENDERER_SOURCE_REVISION
} from '../scripts/assemble-app09b-preview.mjs';
import { assembleStableApp09BPreview } from '../scripts/assemble-app09b-preview-stable.mjs';

const runtimeManifest = () => ({
  schemaVersion: 1,
  rendererSourceRevision: APP09B_RENDERER_SOURCE_REVISION,
  scoreRendererContractVersion: APP09B_RENDERER_CONTRACT_VERSION,
  vendor: {
    opensheetmusicdisplay: {
      version: APP09B_OSMD_VERSION,
      license: 'BSD-3-Clause',
      licenseFile: 'licenses/opensheetmusicdisplay-BSD-3-Clause.txt'
    }
  },
  files: [
    { path: 'index.html', bytes: 1, sha256: '0'.repeat(64) },
    { path: 'workstation-bootstrap.mjs', bytes: 1, sha256: '0'.repeat(64) },
    { path: 'vendor/opensheetmusicdisplay.min.js', bytes: 1, sha256: '0'.repeat(64) }
  ]
});

const writeRuntime = async (root) => {
  await mkdir(path.join(root, 'vendor'), { recursive: true });
  await writeFile(path.join(root, 'index.html'), 'x');
  await writeFile(path.join(root, 'workstation-bootstrap.mjs'), 'x');
  await writeFile(path.join(root, 'vendor/opensheetmusicdisplay.min.js'), 'x');
  await writeFile(path.join(root, 'runtime-manifest.json'), `${JSON.stringify(runtimeManifest())}\n`);
};

test('APP-09B stable preview seeds its sample before mounting interactive file controls and never reseeds after renderer readiness', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'stse-app09b-seed-race-'));
  try {
    const runtimeDir = path.join(temp, 'runtime');
    const outputDir = path.join(temp, 'out');
    await mkdir(runtimeDir, { recursive: true });
    await writeRuntime(runtimeDir);

    await assembleStableApp09BPreview({ runtimeDir, outputDir });
    const bootstrap = await readFile(path.join(outputDir, 'st-score-editor-app09b-bootstrap.js'), 'utf8');

    assert.match(bootstrap, /const initialSampleReady = controller\.openMusicXml\(/);
    assert.match(bootstrap, /\.then\(\(\) => \{ controller\.mount\(root\); \}\);/);
    assert.match(
      bootstrap,
      /waitForRendererHost\(\)\.then\(async \(api\) => \{\n    await initialSampleReady;\n    rendererApi = api;/
    );
    assert.doesNotMatch(
      bootstrap,
      /mark\('app09bRendererReady', 'true'\);\n    await controller\.openMusicXml\(/
    );

    const sampleSeed = bootstrap.indexOf('const initialSampleReady = controller.openMusicXml(');
    const interactiveMount = bootstrap.indexOf('controller.mount(root);');
    const rendererWait = bootstrap.indexOf('waitForRendererHost().then(async (api) => {');
    assert.ok(sampleSeed >= 0 && interactiveMount > sampleSeed && rendererWait > interactiveMount);
    assert.equal((bootstrap.match(/title: 'APP-09B Touch Test'/g) ?? []).length, 1);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
