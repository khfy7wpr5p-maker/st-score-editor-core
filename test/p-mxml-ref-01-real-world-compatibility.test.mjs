import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  importNotationMusicXmlV2
} from '../dist/packages/musicxml-v2/src/index.js';

const fixture = new URL('../corpus/fixtures/musicxml-compatibility/p-mxml-ref-01-sorf-surrogate.musicxml', import.meta.url);
const semanticOnlyFixture = new URL('../corpus/fixtures/musicxml-compatibility/p-mxml-ref-01-sorf-surrogate-semantic-only.musicxml', import.meta.url);

const sourceFor = (xml) => Object.freeze({
  sha256: 'f'.repeat(64),
  format: 'musicxml',
  byteLength: new TextEncoder().encode(xml).byteLength
});

test('P-MXML-REF-01 baseline rejects the real-world presentation envelope before compatibility policy', async () => {
  const xml = await readFile(fixture, 'utf8');
  assert.throws(
    () => importNotationMusicXmlV2(xml, {
      source: sourceFor(xml),
      documentId: 'p-mxml-ref-01-synthetic',
      revisionId: 'rev-baseline'
    }),
    error => error?.code === 'UNSUPPORTED_MUSICXML' && error?.details?.element === 'identification'
  );
});

test('P-MXML-REF-01 semantic-only twin imports under the current bounded profile', async () => {
  const xml = await readFile(semanticOnlyFixture, 'utf8');
  const imported = importNotationMusicXmlV2(xml, {
    source: sourceFor(xml),
    documentId: 'p-mxml-ref-01-synthetic',
    revisionId: 'rev-semantic-only'
  });

  assert.equal(imported.score.parts.length, 1);
  assert.equal(imported.score.parts[0]?.staves.length, 1);
  assert.equal(imported.score.parts[0]?.staves[0]?.measures.length, 2);

  const firstMeasureVoices = imported.score.parts[0]?.staves[0]?.measures[0]?.voices ?? [];
  const secondMeasureVoices = imported.score.parts[0]?.staves[0]?.measures[1]?.voices ?? [];
  assert.deepEqual(firstMeasureVoices.map(voice => voice.ordinal), [1, 2]);
  assert.deepEqual(secondMeasureVoices.map(voice => voice.ordinal), [1, 2]);
});
