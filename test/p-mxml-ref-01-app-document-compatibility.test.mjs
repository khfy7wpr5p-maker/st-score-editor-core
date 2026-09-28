import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { importNotationMusicXmlV2 } from '../dist/packages/musicxml-v2/src/index.js';
import { openMusicXmlScoreEditorAppDocument } from '../dist/packages/score-editor-app-document/src/index.js';

const fullFixture = new URL('../corpus/fixtures/musicxml-compatibility/p-mxml-ref-01-sorf-surrogate.musicxml', import.meta.url);
const semanticOnlyFixture = new URL('../corpus/fixtures/musicxml-compatibility/p-mxml-ref-01-sorf-surrogate-semantic-only.musicxml', import.meta.url);
const bytes = value => new TextEncoder().encode(value).byteLength;
const sha = async value => createHash('sha256').update(new TextEncoder().encode(value)).digest('hex');
const sourceFor = value => Object.freeze({ sha256: '9'.repeat(64), format: 'musicxml', byteLength: bytes(value) });

const normalizedCanonical = document => {
  const score = structuredClone(document.session.history.present.score);
  score.source = { sha256: '<source>', format: score.source.format, byteLength: 0 };
  return {
    score,
    notation: structuredClone(document.session.history.present.notation)
  };
};

const firstPitch = xml => xml.indexOf('</pitch>');

const insertAfterFirstPitch = (xml, value) => {
  const at = firstPitch(xml);
  assert.notEqual(at, -1);
  const end = at + '</pitch>'.length;
  return xml.slice(0, end) + value + xml.slice(end);
};

test('P-MXML-REF-01 v2 importer carries bounded compatibility evidence additively', async () => {
  const xml = await readFile(fullFixture, 'utf8');
  const result = importNotationMusicXmlV2(xml, {
    source: sourceFor(xml),
    documentId: 'doc:p-mxml-ref-01',
    revisionId: 'rev:p-mxml-ref-01'
  });

  assert.equal(result.score.id, 'doc:p-mxml-ref-01');
  assert.ok(result.compatibility.diagnostics.length > 0);
  assert.equal(result.compatibility.truncated, false);
  assert.ok(result.compatibility.diagnostics.some(item => item.element === 'identification'));
  assert.ok(result.compatibility.diagnostics.some(item => item.element === 'note' && item.attribute === 'default-x'));
  assert.equal(Object.isFrozen(result.compatibility), true);
});

test('P-MXML-REF-01 app-document seam produces canonical-equivalent V3/V4 meaning for full and semantic-only twins', async () => {
  const [fullXml, semanticXml] = await Promise.all([
    readFile(fullFixture, 'utf8'),
    readFile(semanticOnlyFixture, 'utf8')
  ]);
  const options = {
    title: 'P-MXML-REF-01',
    documentId: 'doc:p-mxml-ref-01',
    revisionId: 'rev:p-mxml-ref-01',
    sha256Hex: sha
  };

  const full = await openMusicXmlScoreEditorAppDocument(fullXml, options);
  const semanticOnly = await openMusicXmlScoreEditorAppDocument(semanticXml, options);

  assert.equal(full.origin, 'MUSICXML');
  assert.equal(semanticOnly.origin, 'MUSICXML');
  assert.deepEqual(normalizedCanonical(full), normalizedCanonical(semanticOnly));

  const measures = full.session.history.present.score.parts[0]?.staves[0]?.measures ?? [];
  assert.equal(measures.length, 2);
  assert.deepEqual(measures[0]?.voices.map(voice => voice.ordinal), [1, 2]);

  const voice1 = measures[0]?.voices[0]?.events ?? [];
  const voice2 = measures[0]?.voices[1]?.events ?? [];
  assert.deepEqual(
    voice1.map(event => [event.onset, event.duration, event.kind === 'note' ? event.note.pitch : null]),
    [
      [{ numerator: 0, denominator: 1 }, { numerator: 1, denominator: 4 }, { step: 'C', alter: 0, octave: 5 }],
      [{ numerator: 1, denominator: 4 }, { numerator: 1, denominator: 4 }, { step: 'C', alter: 0, octave: 4 }],
      [{ numerator: 1, denominator: 2 }, { numerator: 1, denominator: 4 }, { step: 'E', alter: 0, octave: 4 }],
      [{ numerator: 3, denominator: 4 }, { numerator: 1, denominator: 4 }, { step: 'G', alter: 0, octave: 4 }]
    ]
  );
  assert.deepEqual(
    voice2.map(event => [event.onset, event.duration, event.kind === 'note' ? event.note.pitch : null]),
    [
      [{ numerator: 1, denominator: 4 }, { numerator: 1, denominator: 2 }, { step: 'C', alter: 0, octave: 3 }],
      [{ numerator: 3, denominator: 4 }, { numerator: 1, denominator: 4 }, { step: 'G', alter: 0, octave: 3 }]
    ]
  );
});

test('P-MXML-REF-01 app-document seam preserves original accepted source identity', async () => {
  const xml = await readFile(fullFixture, 'utf8');
  const expectedSha = await sha(xml);
  const document = await openMusicXmlScoreEditorAppDocument(xml, {
    documentId: 'doc:p-mxml-ref-01-source',
    revisionId: 'rev:p-mxml-ref-01-source',
    sha256Hex: sha
  });
  const source = document.session.history.present.score.source;
  assert.equal(source.format, 'musicxml');
  assert.equal(source.byteLength, bytes(xml));
  assert.equal(source.sha256, expectedSha);
});

test('P-MXML-REF-01 app-document seam remains fail-closed for nearby unsupported musical semantics', async () => {
  const xml = await readFile(semanticOnlyFixture, 'utf8');
  const cases = [
    ['direction', xml.replace('<measure number="1">', '<measure number="1"><direction><direction-type/></direction>')],
    ['sound', xml.replace('<measure number="1">', '<measure number="1"><sound tempo="120"/>')],
    ['semantic staff-details', xml.replace('<divisions>4</divisions>', '<divisions>4</divisions><staff-details print-object="yes"><staff-lines>6</staff-lines></staff-details>')],
    ['non-neutral notehead', insertAfterFirstPitch(xml, '<notehead filled="no">diamond</notehead>')],
    ['foreign namespace', xml.replace('<measure number="1">', '<measure number="1"><x:direction xmlns:x="urn:foreign"/>')]
  ];

  for (const [label, candidate] of cases) {
    await assert.rejects(
      () => openMusicXmlScoreEditorAppDocument(candidate, {
        documentId: 'doc:p-mxml-ref-01-negative',
        revisionId: 'rev:p-mxml-ref-01-negative',
        sha256Hex: sha
      }),
      error => error?.code === 'UNSUPPORTED_MUSICXML',
      label
    );
  }
});
