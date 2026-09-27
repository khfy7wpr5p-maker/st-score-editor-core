import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  SemanticParityReferenceError,
  analyzeSemanticParityMusicXmlProfileV1,
  validateSemanticParityReferenceV1
} from '../dist/packages/editor-semantic-parity-v1/src/index.js';

const fixtureDir = new URL('./fixtures/sem-04-semantic-parity/', import.meta.url);
const readJson = async (name) => JSON.parse(await readFile(new URL(name, fixtureDir), 'utf8'));

const bundle = async () => {
  const musicXml = await readFile(new URL('semantic-baseline.musicxml', fixtureDir), 'utf8');
  return {
    musicXml,
    observedSourceSha256: createHash('sha256').update(musicXml).digest('hex'),
    provenance: await readJson('provenance.json'),
    semanticSnapshot: await readJson('semantic-baseline.semantic-snapshot.json')
  };
};

const rejectReference = (input) => {
  assert.throws(
    () => validateSemanticParityReferenceV1(input),
    (error) => error instanceof SemanticParityReferenceError && error.code === 'INVALID_REFERENCE'
  );
};

test('SEM-04 validates the pinned semantic reference bundle', async () => {
  const input = await bundle();
  const reference = validateSemanticParityReferenceV1(input);

  assert.equal(reference.provenance.sourceSha256, input.observedSourceSha256);
  assert.equal(reference.provenance.semanticEngineCommit, 'ffc997b242fa862e180e698385cc0afb52de47a1');
  assert.equal(reference.semanticSnapshot.schema_version, 'st-semantic-snapshot-v1');
  assert.equal(reference.provenance.partituraVersion, '1.9.0');
  assert.equal(reference.provenance.divisionsPerQuarter, 4);
});

test('SEM-04 reference provenance fails closed when source SHA drifts', async () => {
  const input = await bundle();
  rejectReference({ ...input, observedSourceSha256: '0'.repeat(64) });
});

test('SEM-04 reference provenance fails closed when engine/schema/dependency pins drift', async () => {
  const input = await bundle();
  rejectReference({ ...input, provenance: { ...input.provenance, semanticEngineCommit: '1'.repeat(40) } });
  rejectReference({ ...input, provenance: { ...input.provenance, semanticSnapshotSchema: 'wrong-schema' } });
  rejectReference({ ...input, provenance: { ...input.provenance, partituraVersion: '9.9.9' } });
  rejectReference({ ...input, provenance: { ...input.provenance, divisionsPerQuarter: 0 } });
});

test('SEM-04 profile admits the pinned fixed-divisions MusicXML', async () => {
  const input = await bundle();
  const result = analyzeSemanticParityMusicXmlProfileV1(input.musicXml, 4);
  assert.deepEqual(result, { status: 'PASS' });
});

test('SEM-04 profile rejects a mid-score divisions change', async () => {
  const input = await bundle();
  const mixed = input.musicXml.replace(
    '<measure number="2">',
    '<measure number="2"><attributes><divisions>8</divisions></attributes>'
  );

  const result = analyzeSemanticParityMusicXmlProfileV1(mixed, 4);

  assert.equal(result.status, 'UNSUPPORTED');
  assert.equal(result.diagnostics[0]?.code, 'PROFILE_UNSUPPORTED');
});
