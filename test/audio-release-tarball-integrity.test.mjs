import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Audio release tarballs expose stable npm sha512 integrity metadata', () => {
  const hiddenLock = JSON.parse(fs.readFileSync('node_modules/.package-lock.json', 'utf8'));
  const contracts = hiddenLock.packages?.['node_modules/@st/score-audio-contracts'];
  const web = hiddenLock.packages?.['node_modules/@st/score-audio-web'];

  assert.ok(contracts, 'missing @st/score-audio-contracts install metadata');
  assert.ok(web, 'missing @st/score-audio-web install metadata');
  assert.match(contracts.integrity ?? '', /^sha512-[A-Za-z0-9+/=]+$/);
  assert.match(web.integrity ?? '', /^sha512-[A-Za-z0-9+/=]+$/);

  console.log('AUDIO_CONTRACTS_RESOLVED=' + contracts.resolved);
  console.log('AUDIO_CONTRACTS_INTEGRITY=' + contracts.integrity);
  console.log('AUDIO_WEB_RESOLVED=' + web.resolved);
  console.log('AUDIO_WEB_INTEGRITY=' + web.integrity);
});
