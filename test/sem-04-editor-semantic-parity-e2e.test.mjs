import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  analyzeSemanticParityMusicXmlProfileV1,
  compareEditorSemanticsV1,
  projectEditorSemanticsV1,
  validateSemanticParityReferenceV1
} from '../dist/packages/editor-semantic-parity-v1/src/index.js';
import {
  openMusicXmlScoreEditorAppDocument
} from '../dist/packages/score-editor-app-document/src/index.js';

const fixtureDir = new URL('./fixtures/sem-04-semantic-parity/', import.meta.url);
const readJson = async (name) => JSON.parse(await readFile(new URL(name, fixtureDir), 'utf8'));
const sha256 = (text) => createHash('sha256').update(text).digest('hex');

const referenceBundle = async () => {
  const musicXml = await readFile(new URL('semantic-baseline.musicxml', fixtureDir), 'utf8');
  const observedSourceSha256 = sha256(musicXml);
  const provenance = await readJson('provenance.json');
  const semanticSnapshot = await readJson('semantic-baseline.semantic-snapshot.json');
  return {
    musicXml,
    reference: validateSemanticParityReferenceV1({
      provenance,
      semanticSnapshot,
      observedSourceSha256
    })
  };
};

test('SEM-04 real Editor Core MusicXML import matches the pinned Semantic Engine reference without history mutation', async () => {
  const { musicXml, reference } = await referenceBundle();
  assert.deepEqual(
    analyzeSemanticParityMusicXmlProfileV1(musicXml, reference.provenance.divisionsPerQuarter),
    { status: 'PASS' }
  );

  const document = await openMusicXmlScoreEditorAppDocument(musicXml, {
    documentId: 'sem04-doc',
    revisionId: 'sem04-rev',
    sha256Hex: async () => reference.provenance.sourceSha256
  });
  const before = JSON.stringify(document.session.history);

  const current = document.session.history.present;
  const projection = projectEditorSemanticsV1(current.score, current.notation);
  assert.equal(projection.status, 'PASS');

  const report = compareEditorSemanticsV1(projection.projection, reference);

  assert.deepEqual(report, { status: 'PASS', diagnostics: [] });
  assert.equal(JSON.stringify(document.session.history), before);
  assert.equal(document.session.history.present.score.revision.id, 'sem04-rev');
});

test('SEM-04 rejects mixed divisions before semantic parity comparison', async () => {
  const { musicXml, reference } = await referenceBundle();
  const mixed = musicXml.replace(
    '<measure number="2">',
    '<measure number="2"><attributes><divisions>8</divisions></attributes>'
  );

  const result = analyzeSemanticParityMusicXmlProfileV1(
    mixed,
    reference.provenance.divisionsPerQuarter
  );

  assert.equal(result.status, 'UNSUPPORTED');
  assert.equal(result.diagnostics[0]?.code, 'PROFILE_UNSUPPORTED');
});

test('SEM-04 package has no browser, renderer, session-mutation, network or Python runtime dependency', async () => {
  const files = ['index.ts', 'types.ts', 'reference.ts', 'projection.ts', 'comparison.ts'];
  for (const name of files) {
    const source = await readFile(
      new URL(`../packages/editor-semantic-parity-v1/src/${name}`, import.meta.url),
      'utf8'
    );
    const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
    assert.equal(imports.some((value) => /browser|renderer|editor-session|history|network/i.test(value)), false);
    assert.equal(imports.some((value) => /partitura|python/i.test(value)), false);
    assert.equal(/\bfetch\s*\(/.test(source), false);
  }

  const packageJson = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8')
  );
  assert.deepEqual(packageJson.dependencies, {
    saxes: '6.0.0',
    xmlchars: '2.2.0'
  });
});
