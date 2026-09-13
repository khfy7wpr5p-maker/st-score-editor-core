import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl = new URL('../packages/editor-teacher-event-span-v4/src/index.ts', import.meta.url);

test('P02 teacher span builds one semantic address index instead of rebuilding it per selected event', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  assert.match(source, /createSemanticAddressIndexV3\(score\)/);
  assert.doesNotMatch(source, /addressEntityV3\(score,\s*event\.id\)/);
  assert.match(source, /semanticAddressIndex\.byEntityId\.get\(event\.id\)/);
});
