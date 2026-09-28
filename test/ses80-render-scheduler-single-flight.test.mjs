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

const manifest = () => ({
  schemaVersion: 1,
  rendererSourceRevision: APP09B_RENDERER_SOURCE_REVISION,
  scoreRendererContractVersion: APP09B_RENDERER_CONTRACT_VERSION,
  vendor: { opensheetmusicdisplay: { version: APP09B_OSMD_VERSION, license: 'BSD-3-Clause', licenseFile: 'licenses/opensheetmusicdisplay-BSD-3-Clause.txt' } },
  files: [
    { path: 'index.html', bytes: 1, sha256: '0'.repeat(64) },
    { path: 'workstation-bootstrap.mjs', bytes: 1, sha256: '0'.repeat(64) },
    { path: 'vendor/opensheetmusicdisplay.min.js', bytes: 1, sha256: '0'.repeat(64) },
    { path: 'modules/contracts.js', bytes: 1, sha256: '0'.repeat(64) }
  ]
});

const writeRuntime = async root => {
  await mkdir(path.join(root, 'vendor'), { recursive: true });
  await mkdir(path.join(root, 'modules'), { recursive: true });
  for (const file of ['index.html','workstation-bootstrap.mjs','vendor/opensheetmusicdisplay.min.js','modules/contracts.js']) {
    await writeFile(path.join(root, file), 'x');
  }
  await writeFile(path.join(root, 'runtime-manifest.json'), JSON.stringify(manifest()));
};

test('SES-80 stable APP-09B scheduler allows only one render in flight and catches up to latest revision', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'stse-ses80-'));
  try {
    const runtimeDir = path.join(temp, 'runtime');
    const outputDir = path.join(temp, 'out');
    await mkdir(runtimeDir, { recursive: true });
    await writeRuntime(runtimeDir);
    await assembleStableApp09BPreview({ runtimeDir, outputDir });
    const bootstrap = await readFile(path.join(outputDir, 'st-score-editor-app09b-bootstrap.js'), 'utf8');

    assert.match(bootstrap, /let renderInFlight = false;/);
    assert.match(bootstrap, /if \(renderInFlight\) return;/);
    assert.match(bootstrap, /renderInFlight = true;/);
    assert.match(bootstrap, /finally \{\s*renderInFlight = false;/);
    assert.match(bootstrap, /latestRevision !== currentRevision/);
    assert.match(bootstrap, /scheduleRenderCurrent\(\);/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
