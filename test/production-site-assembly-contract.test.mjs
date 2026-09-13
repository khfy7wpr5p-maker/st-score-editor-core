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
import {
  AUDIO_RELEASE_ASSET_SHA256,
  assembleProductionSite
} from '../scripts/assemble-production-site.mjs';

const source = await readFile(new URL('../scripts/assemble-production-site.mjs', import.meta.url), 'utf8');

const rendererManifest = () => ({
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

const writeRendererRuntime = async root => {
  await mkdir(path.join(root, 'vendor'), { recursive: true });
  await mkdir(path.join(root, 'modules'), { recursive: true });
  await writeFile(path.join(root, 'index.html'), 'x');
  await writeFile(path.join(root, 'workstation-bootstrap.mjs'), 'x');
  await writeFile(path.join(root, 'vendor/opensheetmusicdisplay.min.js'), 'x');
  await writeFile(path.join(root, 'modules/contracts.js'), 'x');
  await writeFile(path.join(root, 'runtime-manifest.json'), `${JSON.stringify(rendererManifest())}\n`);
};

test('production site pins the official Audio Engine v0.1.0 release identity', () => {
  assert.match(source, /AUDIO_RELEASE = 'v0\.1\.0'/);
  assert.match(source, /d11a2dd9141169ddfec5901f3cadc4cce0d7b345/);
  assert.equal(AUDIO_RELEASE_ASSET_SHA256, '0f25713f481c42d7a1909e15f968635202d3247203402d8f9f95c19a0a0fb99c');
});

test('production host attaches the complete official runtime and qualifies piano only', () => {
  assert.match(source, /controller\.attachAudioPort\(audioEngine\)/);
  assert.doesNotMatch(source, /attachAudioPort\(Object\.freeze/);
  assert.match(source, /defaultInstrument: 'GRAND_PIANO'/);
  assert.match(source, /qualifiedInstruments: Object\.freeze\(\['GRAND_PIANO'\]\)/);
  assert.match(source, /suspendedInstruments: Object\.freeze\(\['CLASSICAL_GUITAR'\]\)/);
  assert.doesNotMatch(source, /qualifiedInstruments:[^\n]*CLASSICAL_GUITAR/);
});

test('production deployment keeps authority and cutover boundaries explicit', () => {
  assert.match(source, /canonicalMutationAuthority: false/);
  assert.match(source, /historyMutationAuthority: false/);
  assert.match(source, /rendererAuthority: false/);
  assert.match(source, /staleRevision: 'fail-closed'/);
  assert.match(source, /seslitabCutoverAuthorized: false/);
  assert.match(source, /manualDeviceValidationRequired: true/);
});

test('production assembly emits a root index that wires exact renderer plus official piano audio host', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'stse-production-'));
  try {
    const runtimeDir = path.join(temp, 'renderer');
    const audioRuntimeDir = path.join(temp, 'audio');
    const outputDir = path.join(temp, 'out');
    await writeRendererRuntime(runtimeDir);
    await mkdir(audioRuntimeDir, { recursive: true });
    await writeFile(path.join(audioRuntimeDir, 'st-score-audio-engine.js'), 'globalThis.STScoreAudioEngine = {};');

    const manifest = await assembleProductionSite({
      runtimeDir,
      audioRuntimeDir,
      outputDir,
      refreshRendererRuntime: false
    });

    const html = await readFile(path.join(outputDir, 'index.html'), 'utf8');
    const bootstrap = await readFile(path.join(outputDir, 'st-score-editor-production-bootstrap.js'), 'utf8');
    const copiedAudio = await readFile(path.join(outputDir, 'audio-runtime/st-score-audio-engine.js'), 'utf8');

    assert.equal(manifest.contract, 'ST_SCORE_EDITOR_PRODUCTION_SITE');
    assert.equal(manifest.renderer.rendererSourceRevision, APP09B_RENDERER_SOURCE_REVISION);
    assert.deepEqual(manifest.audio.qualifiedInstruments, ['GRAND_PIANO']);
    assert.deepEqual(manifest.audio.suspendedInstruments, ['CLASSICAL_GUITAR']);
    assert.equal(manifest.seslitabCutoverAuthorized, false);
    assert.equal(manifest.manualDeviceValidationRequired, true);
    assert.match(html, /audio-runtime\/st-score-audio-engine\.js/);
    assert.match(html, /st-score-editor-production-bootstrap\.js/);
    assert.match(html, /connect-src https:\/\/raw\.githubusercontent\.com/);
    assert.match(bootstrap, /createAudioEngine\(\{ defaultInstrument: 'GRAND_PIANO' \}\)/);
    assert.match(bootstrap, /attachAudioPort\(audioEngine\)/);
    assert.match(bootstrap, /selectRenderedScoreNoteRefWithAudition/);
    assert.equal(copiedAudio, 'globalThis.STScoreAudioEngine = {};');
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
