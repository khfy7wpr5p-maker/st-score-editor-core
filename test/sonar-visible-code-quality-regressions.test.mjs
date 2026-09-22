import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('MusicXML v2 importer uses Number.NaN instead of the global NaN alias', async () => {
  const source = await readFile('packages/musicxml-v2/src/importer.ts', 'utf8');
  assert.doesNotMatch(source, /\bNaN\b(?!\s*\.)/);
});

test('implicit-gap middle regression keeps assertions inside test cases', async () => {
  const source = await readFile('test/editor-implicit-gap-materialization-middle.test.mjs', 'utf8');
  const firstTest = source.indexOf("test('");
  assert.ok(firstTest > 0, 'expected at least one test case');
  assert.doesNotMatch(source.slice(0, firstTest), /\bassert\./);
});
