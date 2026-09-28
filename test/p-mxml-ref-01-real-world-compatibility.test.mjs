import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  importNotationMusicXmlV2,
  parseMusicXmlV2Tree
} from '../dist/packages/musicxml-v2/src/index.js';

const fixture = new URL('../corpus/fixtures/musicxml-compatibility/p-mxml-ref-01-sorf-surrogate.musicxml', import.meta.url);
const semanticOnlyFixture = new URL('../corpus/fixtures/musicxml-compatibility/p-mxml-ref-01-sorf-surrogate-semantic-only.musicxml', import.meta.url);

const sourceFor = (xml) => Object.freeze({
  sha256: 'f'.repeat(64),
  format: 'musicxml',
  byteLength: new TextEncoder().encode(xml).byteLength
});

const children = (node, name) => node.children.filter(child => child.name === name);
const first = (node, name) => children(node, name)[0] ?? null;

test('P-MXML-REF-01 compatible presentation envelope is stripped from the semantic tree with bounded diagnostics', async () => {
  const xml = await readFile(fixture, 'utf8');
  const parsed = parseMusicXmlV2Tree(xml);

  assert.equal(parsed.root.name, 'score-partwise');
  assert.deepEqual(parsed.root.children.map(child => child.name), ['part-list', 'part']);

  const part = first(parsed.root, 'part');
  assert.ok(part);
  const measure = first(part, 'measure');
  assert.ok(measure);
  assert.equal(first(measure, 'print'), null);

  const attributes = first(measure, 'attributes');
  assert.ok(attributes);
  assert.equal(first(attributes, 'staff-details'), null);

  const notes = children(measure, 'note');
  assert.ok(notes.length > 0);
  assert.equal(notes.some(note => note.attributes.some(attribute => attribute.name === 'default-x')), false);
  assert.equal(notes.some(note => first(note, 'stem') !== null), false);
  assert.equal(notes.some(note => first(note, 'notehead') !== null), false);

  const staccato = first(first(first(notes[1], 'notations'), 'articulations'), 'staccato');
  assert.ok(staccato);
  assert.deepEqual(staccato.attributes.map(attribute => attribute.name), ['placement']);

  const evidence = parsed.compatibility;
  assert.equal(evidence.truncated, false);
  assert.ok(evidence.diagnostics.some(item => item.element === 'identification' && item.attribute === null));
  assert.ok(evidence.diagnostics.some(item => item.element === 'defaults' && item.attribute === null));
  assert.ok(evidence.diagnostics.some(item => item.element === 'print' && item.attribute === null));
  assert.ok(evidence.diagnostics.some(item => item.element === 'staff-details' && item.attribute === null));
  assert.ok(evidence.diagnostics.some(item => item.element === 'notehead' && item.attribute === null));
  assert.ok(evidence.diagnostics.some(item => item.element === 'note' && item.attribute === 'default-x'));
  assert.ok(evidence.diagnostics.some(item => item.element === 'stem' && item.attribute === 'default-y'));
  assert.ok(evidence.diagnostics.some(item => item.element === 'staccato' && item.attribute === 'default-y'));
});

test('P-MXML-REF-01 full compatible envelope imports while preserving the two-voice score semantics', async () => {
  const xml = await readFile(fixture, 'utf8');
  const imported = importNotationMusicXmlV2(xml, {
    source: sourceFor(xml),
    documentId: 'p-mxml-ref-01-synthetic',
    revisionId: 'rev-compatible'
  });

  assert.equal(imported.score.parts.length, 1);
  assert.equal(imported.score.parts[0]?.staves.length, 1);
  assert.equal(imported.score.parts[0]?.staves[0]?.measures.length, 2);
  const firstMeasureVoices = imported.score.parts[0]?.staves[0]?.measures[0]?.voices ?? [];
  const secondMeasureVoices = imported.score.parts[0]?.staves[0]?.measures[1]?.voices ?? [];
  assert.deepEqual(firstMeasureVoices.map(voice => voice.ordinal), [1, 2]);
  assert.deepEqual(secondMeasureVoices.map(voice => voice.ordinal), [1, 2]);
});

test('P-MXML-REF-01 semantic-only twin still imports under the bounded profile without compatibility diagnostics', async () => {
  const xml = await readFile(semanticOnlyFixture, 'utf8');
  const parsed = parseMusicXmlV2Tree(xml);
  assert.deepEqual(parsed.compatibility, { diagnostics: [], truncated: false });

  const imported = importNotationMusicXmlV2(xml, {
    source: sourceFor(xml),
    documentId: 'p-mxml-ref-01-synthetic',
    revisionId: 'rev-semantic-only'
  });

  assert.equal(imported.score.parts.length, 1);
  assert.equal(imported.score.parts[0]?.staves.length, 1);
  assert.equal(imported.score.parts[0]?.staves[0]?.measures.length, 2);
});
