import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAudioHostIntegratedStandaloneBrowserAppRuntime } from '../dist/packages/score-editor-browser-app/src/audio-host-integrated.js';

test('production audio host preserves the P03 mobile teacher viewport runtime', () => {
  const runtime = createAudioHostIntegratedStandaloneBrowserAppRuntime();
  assert.equal(runtime.profile.mobileTeacherViewportBundled, true);
  assert.equal(runtime.profile.mobileTeacherViewportSingleCanonicalController, true);
  assert.equal(runtime.profile.noteAuditionAdapterAvailable, true);
  assert.equal(runtime.profile.qualifiedAuditionInstrument, 'GRAND_PIANO');
  assert.deepEqual(runtime.audioAudition.instruments, ['GRAND_PIANO']);
  assert.deepEqual(runtime.audioAudition.suspendedInstruments, ['CLASSICAL_GUITAR']);
  assert.equal(runtime.audioAudition.canonicalMutationAuthority, false);
  assert.equal(runtime.audioAudition.historyMutationAuthority, false);
  assert.equal(runtime.audioAudition.rendererAudioAuthority, false);
});

test('production audio host consumes the official P06 v0.1.0 adapter and does not restore the old duplicate contract', async () => {
  const source = await readFile(new URL('../packages/score-editor-browser-app/src/audio-host-integrated.ts', import.meta.url), 'utf8');
  const globalEntry = await readFile(new URL('../packages/score-editor-browser-app/src/global-entry.ts', import.meta.url), 'utf8');
  assert.match(source, /score-editor-sdk-v1\/audio-v010\.js/);
  assert.match(source, /createMobileTeacherViewportStandaloneScoreEditorController/);
  assert.doesNotMatch(source, /editor-audition-v1/);
  assert.doesNotMatch(source, /interface\s+AuditionRequest/);
  assert.doesNotMatch(source, /CLASSICAL_GUITAR.*option/);
  assert.match(globalEntry, /createAudioHostIntegratedStandaloneBrowserAppRuntime/);
});
