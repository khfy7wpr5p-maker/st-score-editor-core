import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  APP09B_OSMD_VERSION,
  APP09B_RENDERER_CONTRACT_VERSION,
  APP09B_RENDERER_SOURCE_REVISION,
  assembleApp09BPreview
} from '../scripts/assemble-app09b-preview.mjs';

const manifest = {
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
};

async function writeRuntime(root) {
  await mkdir(path.join(root, 'vendor'), { recursive: true });
  await writeFile(path.join(root, 'index.html'), 'x');
  await writeFile(path.join(root, 'workstation-bootstrap.mjs'), 'x');
  await writeFile(path.join(root, 'vendor/opensheetmusicdisplay.min.js'), 'x');
  await writeFile(path.join(root, 'runtime-manifest.json'), `${JSON.stringify(manifest)}\n`);
}

test('APP-09B interactive renderer keeps OSMD autoResize disabled and delegates layout reflow to host', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'stse-app09b-controlled-rerender-'));
  try {
    const runtimeDir = path.join(temp, 'runtime');
    const outputDir = path.join(temp, 'out');
    await writeRuntime(runtimeDir);
    const result = await assembleApp09BPreview({ runtimeDir, outputDir });
    const bootstrap = await readFile(path.join(outputDir, 'st-score-editor-app09b-bootstrap.js'), 'utf8');

    assert.equal(result.interactiveRendererAutoResize, false);
    assert.equal(result.resizeOrientationControlledRendererRerender, true);
    assert.match(bootstrap, /autoResize: false,/);
    assert.doesNotMatch(bootstrap, /autoResize: true,/);
    assert.equal(result.standaloneReleaseGatePassed, false);
    assert.equal(result.seslitabCutoverAuthorized, false);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('APP-09 release hardening exposes controlled renderer rerender without authority expansion', async () => {
  const source = await readFile(new URL('../packages/score-editor-browser-app/src/release-hardened.ts', import.meta.url), 'utf8');
  assert.match(source, /resizeOrientationControlledRendererRerender: true/);
  assert.match(source, /requestControlledRendererRerender/);
  assert.match(source, /base\.getRendererState\(\)\.attached/);
  assert.match(source, /await base\.renderCurrent\(\)/);
  assert.match(source, /hardeningCanonicalAuthority: false/);
  assert.match(source, /hardeningHistoryMutationAuthority: false/);
  assert.match(source, /hardeningNetworkAuthority: false/);
  assert.match(source, /standaloneReleaseGatePassed: false/);
  assert.match(source, /seslitabCutoverAuthorized: false/);
});
