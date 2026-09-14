import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { SCORE_AUDIO_ENGINE_V010 } from '../dist/packages/score-editor-sdk-v1/audio-v010.js';

const productionSource = fs.readFileSync('scripts/assemble-production-site.mjs', 'utf8');

test('P07 public contract boundary remains stable after later runtime releases', () => {
  assert.equal(SCORE_AUDIO_ENGINE_V010.release, 'v0.1.0');
  assert.equal(SCORE_AUDIO_ENGINE_V010.contractsPackage, '@st/score-audio-contracts@0.1.0');
  assert.match(productionSource, /audioApi\.version !== '0\.1\.2'/);
  assert.match(productionSource, /suspendedInstruments: Object\.freeze\(\['CLASSICAL_GUITAR'\]\)/);
  assert.match(productionSource, /seslitabCutoverAuthorized: false/);
  assert.match(productionSource, /manualDeviceValidationRequired: true/);
});

test('P07 latency-hardening invariants survive P08 runtime advancement', () => {
  assert.match(productionSource, /selectionCriticalPath: 'non-blocking-audio'/);
  assert.match(productionSource, /inflightDedupe: 'raw-fetch-and-audio-decode'/);
  assert.match(productionSource, /rapidTapStatusPolicy: 'latest-request-wins'/);
  assert.match(productionSource, /canonicalMutationAuthority: false/);
  assert.match(productionSource, /historyMutationAuthority: false/);
  assert.match(productionSource, /rendererAuthority: false/);
  assert.match(productionSource, /staleRevision: 'fail-closed'/);
});
