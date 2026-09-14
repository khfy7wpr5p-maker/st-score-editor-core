import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  AUDIO_RELEASE,
  AUDIO_RELEASE_ASSET_SHA256,
  AUDIO_RELEASE_COMMIT,
  AUDIO_RELEASE_URL,
  PRODUCTION_SITE_VERSION
} from '../scripts/assemble-production-site.mjs';
import { SCORE_AUDIO_ENGINE_V010 } from '../dist/packages/score-editor-sdk-v1/audio-v010.js';

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const productionSource = fs.readFileSync('scripts/assemble-production-site.mjs', 'utf8');
const hostSource = fs.readFileSync('packages/score-editor-browser-app/src/audio-host-integrated.ts', 'utf8');

test('P08 pins the official Audio Engine v0.1.2 Violin-qualified release assets', () => {
  assert.equal(AUDIO_RELEASE, 'v0.1.2');
  assert.equal(AUDIO_RELEASE_COMMIT, '26117ae90f213e208e06fb5c084fc0fad9f4ca86');
  assert.equal(AUDIO_RELEASE_ASSET_SHA256, '18f4e039ffe6e766916bd11f61d60b2496095aadbc61828ecd88545b8408504d');
  assert.equal(AUDIO_RELEASE_URL, 'https://github.com/khfy7wpr5p-maker/st-score-audio-engine/releases/download/v0.1.2/st-score-audio-engine.browser.v0.1.2.js');
  assert.equal(PRODUCTION_SITE_VERSION, '1.3.0');
  assert.match(packageJson.optionalDependencies['@st/score-audio-contracts'], /releases\/download\/v0\.1\.2\/st-score-audio-contracts-0\.1\.0\.tgz$/);
  assert.match(packageJson.optionalDependencies['@st/score-audio-web'], /releases\/download\/v0\.1\.2\/st-score-audio-web-0\.1\.2\.tgz$/);
});

test('P08 advances runtime qualification without changing the public audio contract', () => {
  assert.equal(SCORE_AUDIO_ENGINE_V010.contractsPackage, '@st/score-audio-contracts@0.1.0');
  assert.match(productionSource, /qualifiedInstruments: Object\.freeze\(\['GRAND_PIANO', 'VIOLIN'\]\)/);
  assert.match(productionSource, /suspendedInstruments: Object\.freeze\(\['CLASSICAL_GUITAR'\]\)/);
  assert.match(hostSource, /QUALIFIED_AUDITION_INSTRUMENTS_V1 = Object\.freeze\(\['GRAND_PIANO', 'VIOLIN'\] as const\)/);
  assert.match(hostSource, /setAuditionInstrument/);
  assert.doesNotMatch(hostSource, /QUALIFIED_AUDITION_INSTRUMENTS_V1[^\n]*CLASSICAL_GUITAR/);
});

test('P08 instrument choice is host UI state only and preserves score authority boundaries', () => {
  assert.match(productionSource, /instrumentSelection: 'host-ui-noncanonical'/);
  assert.match(productionSource, /canonicalMutationAuthority: false/);
  assert.match(productionSource, /historyMutationAuthority: false/);
  assert.match(productionSource, /rendererAuthority: false/);
  assert.match(productionSource, /staleRevision: 'fail-closed'/);
  assert.match(productionSource, /seslitabCutoverAuthorized: false/);
});
