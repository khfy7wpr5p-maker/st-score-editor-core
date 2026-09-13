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
  APP09B_AUDIO_BUNDLE,
  assembleApp09BAudioPreview
} from '../scripts/assemble-app09b-audio-preview.mjs';

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

test('APP-09B audio preview composes stable renderer host with external Audio Engine runtime', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'stse-app09b-audio-'));
  try {
    const runtimeDir = path.join(temp, 'renderer');
    const audioRuntimeDir = path.join(temp, 'audio');
    const outputDir = path.join(temp, 'out');
    await writeRendererRuntime(runtimeDir);
    await mkdir(audioRuntimeDir, { recursive: true });
    await writeFile(path.join(audioRuntimeDir, APP09B_AUDIO_BUNDLE), 'globalThis.STScoreAudioEngine={createAudioEngine(){}};');

    const result = await assembleApp09BAudioPreview({ runtimeDir, audioRuntimeDir, outputDir });
    assert.equal(result.contract, 'ST_SCORE_EDITOR_APP09B_AUDIO_PREVIEW');
    assert.equal(result.audioEngineBundledIntoEditorCore, false);
    assert.equal(result.audioHostAttachedByPreview, true);
    assert.equal(result.noteTouchAudition, 'canonical-note-only');
    assert.equal(result.restAudition, 'no-request');
    assert.equal(result.auditionHistoryMutationAuthority, false);
    assert.equal(result.rendererAudioAuthority, false);
    assert.equal(result.rendererFrameStableAcrossEditorReconciliation, true);
    assert.equal(result.standaloneReleaseGatePassed, false);
    assert.equal(result.seslitabCutoverAuthorized, false);

    const html = await readFile(path.join(outputDir, 'st-score-editor-app09b-audio.html'), 'utf8');
    const bootstrap = await readFile(path.join(outputDir, 'st-score-editor-app09b-audio-bootstrap.js'), 'utf8');
    const baseBootstrap = await readFile(path.join(outputDir, 'st-score-editor-app09b-bootstrap.js'), 'utf8');
    const copiedAudio = await readFile(path.join(outputDir, 'audio-runtime', APP09B_AUDIO_BUNDLE), 'utf8');

    assert.match(html, /audio-runtime\/st-score-audio-engine\.js/);
    assert.match(html, /connect-src https:\/\/raw\.githubusercontent\.com/);
    assert.match(html, /st-score-editor-app09b-audio-bootstrap\.js/);
    assert.match(bootstrap, /STScoreAudioEngine/);
    assert.match(bootstrap, /attachAudioPort/);
    assert.match(bootstrap, /selectRenderedScoreNoteRefWithAudition/);
    assert.match(bootstrap, /app09bAudioStatus/);
    assert.match(bootstrap, /reconcileStableRendererShell/);
    assert.doesNotMatch(baseBootstrap, /STScoreAudioEngine/);
    assert.match(copiedAudio, /STScoreAudioEngine/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
