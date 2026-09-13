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

test('APP-09B rest-touch v2 admits UNMAPPED_ELEMENT only on a rendered vf-stavenote and keeps unique-rest fail closed', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'stse-app09b-rest-v2-'));
  try {
    const runtimeDir = path.join(temp, 'runtime');
    const outputDir = path.join(temp, 'out');
    await mkdir(runtimeDir, { recursive: true });
    await writeRuntime(runtimeDir);

    await assembleStableRestV2PreviewCli({ runtimeDir, outputDir, includeIosDiagnostic: false });
    const bootstrap = await readFile(path.join(outputDir, 'st-score-editor-app09b-bootstrap.js'), 'utf8');

    assert.match(bootstrap, /hit\.reason === 'UNMAPPED_ELEMENT' && renderedStaveEntry/);
    assert.match(bootstrap, /classList\?\.contains\('vf-stavenote'\)/);
    assert.match(bootstrap, /hit\.reason !== 'NO_NOTE_OWNER' && !boundedUnmappedRestEvidence/);
    assert.match(bootstrap, /uniqueCanonicalRestAddress/);
    assert.match(bootstrap, /if \(rests\.length > 1\) return null/);
    assert.match(bootstrap, /controller\.select\(restAddress\)/);
    assert.match(bootstrap, /APP09B_UNIQUE_REST_SELECTION_MUTATED_HISTORY/);
    assert.match(bootstrap, /selected-rest-/);
    assert.doesNotMatch(bootstrap, /hit\.reason !== 'NO_NOTE_OWNER'\) \{\n          mark\('app09bLastHit', 'miss'\)/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
