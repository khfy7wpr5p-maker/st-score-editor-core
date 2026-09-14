import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  AUDIO_RELEASE,
  AUDIO_RELEASE_ASSET_SHA256,
  AUDIO_RELEASE_COMMIT,
  PRODUCTION_SITE_VERSION
} from '../scripts/assemble-production-site.mjs';
import { SCORE_AUDIO_ENGINE_V010 } from '../dist/packages/score-editor-sdk-v1/audio-v010.js';

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const productionSource = fs.readFileSync('scripts/assemble-production-site.mjs', 'utf8');

test('P07 operational admission pins the official Audio Engine v0.1.1 release assets', () => {
  assert.equal(AUDIO_RELEASE, 'v0.1.1');
  assert.equal(AUDIO_RELEASE_COMMIT, '61d2b0a161d949588bb1bbd3c01caf819f03ec72');
  assert.equal(AUDIO_RELEASE_ASSET_SHA256, 'd997c6de77436ac3d7463e079904e5d29e52a06a30460330a6f1444ac0469092');
  assert.equal(PRODUCTION_SITE_VERSION, '1.2.0');
  assert.match(packageJson.optionalDependencies['@st/score-audio-contracts'], /releases\/download\/v0\.1\.1\/st-score-audio-contracts-0\.1\.0\.tgz$/);
  assert.match(packageJson.optionalDependencies['@st/score-audio-web'], /releases\/download\/v0\.1\.1\/st-score-audio-web-0\.1\.1\.tgz$/);
});

test('P07 keeps the public contract on v0.1.0 while advancing only the runtime release', () => {
  assert.equal(SCORE_AUDIO_ENGINE_V010.contractsPackage, '@st/score-audio-contracts@0.1.0');
  assert.match(productionSource, /audioApi\.version !== '0\.1\.1'/);
  assert.match(productionSource, /qualifiedInstruments: Object\.freeze\(\['GRAND_PIANO'\]\)/);
  assert.match(productionSource, /suspendedInstruments: Object\.freeze\(\['CLASSICAL_GUITAR'\]\)/);
  assert.match(productionSource, /seslitabCutoverAuthorized: false/);
  assert.match(productionSource, /manualDeviceValidationRequired: true/);
});

test('P07 production pin records the latency-hardening capabilities without authority escalation', () => {
  assert.match(productionSource, /selectionCriticalPath: 'non-blocking-audio'/);
  assert.match(productionSource, /decodedWarmCache: 'audio-engine-v0\.1\.1-after-unlock'/);
  assert.match(productionSource, /inflightDedupe: 'raw-fetch-and-audio-decode'/);
  assert.match(productionSource, /canonicalMutationAuthority: false/);
  assert.match(productionSource, /historyMutationAuthority: false/);
  assert.match(productionSource, /rendererAuthority: false/);
  assert.match(productionSource, /staleRevision: 'fail-closed'/);
});
