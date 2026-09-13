import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../scripts/assemble-production-site.mjs', import.meta.url), 'utf8');

test('production site pins the official Audio Engine v0.1.0 release identity', () => {
  assert.match(source, /AUDIO_RELEASE = 'v0\.1\.0'/);
  assert.match(source, /d11a2dd9141169ddfec5901f3cadc4cce0d7b345/);
  assert.match(source, /0f25713f481c42d7a1909e15f968635202d3247203402d8f9f95c19a0a0fb99c/);
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
  assert.match(source, /writeFile\(path\.join\(outputDir, 'index\.html'\)/);
});
