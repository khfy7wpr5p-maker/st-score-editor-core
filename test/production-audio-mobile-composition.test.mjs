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
  assert.deepEqual(runtime.profile.qualifiedAuditionInstruments, ['GRAND_PIANO', 'VIOLIN']);
  assert.deepEqual(runtime.audioAudition.instruments, ['GRAND_PIANO', 'VIOLIN']);
  assert.deepEqual(runtime.audioAudition.suspendedInstruments, ['CLASSICAL_GUITAR']);
  assert.equal(runtime.audioAudition.canonicalMutationAuthority, false);
  assert.equal(runtime.audioAudition.historyMutationAuthority, false);
  assert.equal(runtime.audioAudition.rendererAudioAuthority, false);
});

test('production audio host exposes bounded noncanonical Piano/Violin switching only', async () => {
  const runtime = createAudioHostIntegratedStandaloneBrowserAppRuntime();
  const controller = runtime.createController();
  assert.equal(controller.getAudioHostState().instrumentId, 'GRAND_PIANO');
  assert.equal(typeof controller.setAuditionInstrument, 'function');
  const switched = await controller.setAuditionInstrument('VIOLIN');
  assert.equal(switched.instrumentId, 'VIOLIN');
  assert.equal(switched.attached, false);
  await assert.rejects(
    () => controller.setAuditionInstrument('CLASSICAL_GUITAR'),
    /Unsupported production audition instrument/
  );
  assert.equal(controller.getAudioHostState().instrumentId, 'VIOLIN');
});

test('production audio host consumes the official P06 v0.1.0 contract adapter and does not restore the old duplicate contract', async () => {
  const source = await readFile(new URL('../packages/score-editor-browser-app/src/audio-host-integrated.ts', import.meta.url), 'utf8');
  const globalEntry = await readFile(new URL('../packages/score-editor-browser-app/src/global-entry.ts', import.meta.url), 'utf8');
  assert.match(source, /score-editor-sdk-v1\/audio-v010\.js/);
  assert.match(source, /createMobileTeacherViewportStandaloneScoreEditorController/);
  assert.match(source, /QUALIFIED_AUDITION_INSTRUMENTS_V1/);
  assert.match(source, /setAuditionInstrument/);
  assert.doesNotMatch(source, /editor-audition-v1/);
  assert.doesNotMatch(source, /interface\s+AuditionRequest/);
  assert.doesNotMatch(source, /CLASSICAL_GUITAR.*qualified/);
  assert.match(globalEntry, /createAudioHostIntegratedStandaloneBrowserAppRuntime/);
});
