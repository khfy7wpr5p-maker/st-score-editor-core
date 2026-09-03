import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  APP09B_OSMD_VERSION,
  APP09B_RENDERER_CONTRACT_VERSION,
  APP09B_RENDERER_SOURCE_REVISION,
  assembleApp09BPreview,
  validateRendererRuntimeManifest
} from '../scripts/assemble-app09b-preview.mjs';

const manifest = (overrides = {}) => ({
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
  ],
  ...overrides
});

const writeRuntime = async (root, value = manifest()) => {
  await mkdir(path.join(root, 'vendor'), { recursive: true });
  await mkdir(path.join(root, 'modules'), { recursive: true });
  await writeFile(path.join(root, 'index.html'), 'x');
  await writeFile(path.join(root, 'workstation-bootstrap.mjs'), 'x');
  await writeFile(path.join(root, 'vendor/opensheetmusicdisplay.min.js'), 'x');
  await writeFile(path.join(root, 'modules/contracts.js'), 'x');
  await writeFile(path.join(root, 'runtime-manifest.json'), `${JSON.stringify(value)}\n`);
};

test('APP-09B preview admits only exact renderer revision, contract and OSMD vendor profile', () => {
  assert.deepEqual(validateRendererRuntimeManifest(manifest()), {
    rendererSourceRevision: APP09B_RENDERER_SOURCE_REVISION,
    scoreRendererContractVersion: APP09B_RENDERER_CONTRACT_VERSION,
    osmdVersion: APP09B_OSMD_VERSION,
    osmdLicense: 'BSD-3-Clause'
  });
  assert.throws(
    () => validateRendererRuntimeManifest(manifest({ rendererSourceRevision: '0'.repeat(40) })),
    /revision mismatch/
  );
  assert.throws(
    () => validateRendererRuntimeManifest(manifest({ scoreRendererContractVersion: '0.1.0' })),
    /contract mismatch/
  );
  assert.throws(
    () => validateRendererRuntimeManifest(manifest({ vendor: { opensheetmusicdisplay: { version: '2.1.1', license: 'BSD-3-Clause' } } })),
    /exact OSMD 2\.1\.2/
  );
});

test('APP-09B preview assembly keeps renderer separate and release gates false', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'stse-app09b-'));
  try {
    const runtimeDir = path.join(temp, 'runtime');
    const outputDir = path.join(temp, 'out');
    await mkdir(runtimeDir, { recursive: true });
    await writeRuntime(runtimeDir);
    const result = await assembleApp09BPreview({ runtimeDir, outputDir });
    assert.equal(result.rendererImplementationBundledIntoEditorCore, false);
    assert.equal(result.rendererRuntimeSameOriginIsolated, true);
    assert.equal(result.rendererHitRequiresExactRenderEpoch, true);
    assert.equal(result.rendererHitRequiresExactSourceId, true);
    assert.equal(result.standaloneReleaseGatePassed, false);
    assert.equal(result.seslitabCutoverAuthorized, false);
    assert.equal(result.rendererProfileOverride.packageVersion, '2.1.2');

    const html = await readFile(path.join(outputDir, 'st-score-editor-app09b.html'), 'utf8');
    const bootstrap = await readFile(path.join(outputDir, 'st-score-editor-app09b-bootstrap.js'), 'utf8');
    const copiedManifest = JSON.parse(await readFile(path.join(outputDir, 'renderer-runtime/runtime-manifest.json'), 'utf8'));
    assert.match(html, /renderer-runtime|st-score-editor-app09b-bootstrap/);
    assert.match(html, /viewport-fit=cover/);
    assert.match(bootstrap, /hitTestNoteDetailed/);
    assert.match(bootstrap, /renderEpoch/);
    assert.match(bootstrap, /sourceId/);
    assert.match(bootstrap, /selectRenderedScoreNoteRef/);
    assert.match(bootstrap, /rendererProfile/);
    assert.equal(copiedManifest.rendererSourceRevision, APP09B_RENDERER_SOURCE_REVISION);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
