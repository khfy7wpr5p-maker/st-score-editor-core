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
import { assembleStableRestV2PreviewCli } from '../scripts/assemble-app09b-preview-stable-rest-v2.mjs';

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
    { path: 'vendor/opensheetmusicdisplay.min.js', bytes: 1, sha256: '0'.repeat(64) },
    { path: 'modules/contracts.js', bytes: 1, sha256: '0'.repeat(64) }
  ]
});

const writeRuntime = async (root) => {
  await mkdir(path.join(root, 'vendor'), { recursive: true });
  await mkdir(path.join(root, 'modules'), { recursive: true });
  await writeFile(path.join(root, 'index.html'), 'x');
  await writeFile(path.join(root, 'workstation-bootstrap.mjs'), 'x');
  await writeFile(path.join(root, 'vendor/opensheetmusicdisplay.min.js'), 'x');
  await writeFile(path.join(root, 'modules/contracts.js'), 'x');
  await writeFile(path.join(root, 'runtime-manifest.json'), `${JSON.stringify(runtimeManifest())}\n`);
};

test('APP-09B rest touch preserves outer and renderer-owned scroll across semantic rest selection', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'stse-app09b-rest-scroll-'));
  try {
    const runtimeDir = path.join(temp, 'runtime');
    const outputDir = path.join(temp, 'out');
    await mkdir(runtimeDir, { recursive: true });
    await writeRuntime(runtimeDir);

    await assembleStableRestV2PreviewCli({ runtimeDir, outputDir, includeIosDiagnostic: false });
    const bootstrap = await readFile(path.join(outputDir, 'st-score-editor-app09b-bootstrap.js'), 'utf8');

    assert.match(bootstrap, /const outerViewport = root\.querySelector\('\[data-st-score-editor-viewport\]'\)/);
    assert.match(bootstrap, /childDocument\.scrollingElement/);
    assert.match(bootstrap, /childDocument\.getElementById\('st-score-root'\)/);
    assert.match(bootstrap, /const presentationScroll = Object\.freeze/);
    assert.match(bootstrap, /Math\.max\(0, entry\.node\.scrollWidth - entry\.node\.clientWidth\)/);
    assert.match(bootstrap, /Math\.max\(0, entry\.node\.scrollHeight - entry\.node\.clientHeight\)/);
    assert.match(bootstrap, /restorePresentationScroll\(\);/);
    assert.match(bootstrap, /requestAnimationFrame\?\.\(\(\) => restorePresentationScroll\(\)\)/);
    assert.match(bootstrap, /app09bRestScrollPreserved/);
    assert.match(bootstrap, /mobile-scroll-preserved/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
