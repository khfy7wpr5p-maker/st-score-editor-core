import test from 'node:test';
import assert from 'node:assert/strict';

import { importNotationMusicXmlV2 } from '../dist/packages/musicxml-v2/src/index.js';
import { migrateScoreNotationV2ToV3 } from '../dist/packages/schema-migration-v2-v3/src/index.js';
import { migrateNotationV3ToV4 } from '../dist/packages/schema-migration-v3-v4/src/index.js';
import {
  mapPartituraImportToCanonicalV1
} from '../dist/packages/musicxml-partitura-mapper/src/index.js';

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <note id="n1">
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>4</duration><voice>1</voice><staff>1</staff>
      </note>
      <note id="r1">
        <rest/><duration>4</duration><voice>1</voice><staff>1</staff>
      </note>
    </measure>
  </part>
</score-partwise>`;

const source = Object.freeze({
  sha256: 'a'.repeat(64),
  format: 'musicxml',
  byteLength: new TextEncoder().encode(xml).byteLength
});

const note = (overrides = {}) => ({
  sourceNoteId: 'n1',
  pitch: 64,
  step: 'E',
  alter: 0,
  octave: 4,
  onsetBeat: 0,
  durationBeat: 1,
  onsetQuarter: 0,
  durationQuarter: 1,
  onsetDiv: 0,
  durationDiv: 4,
  voice: 1,
  staff: 1,
  divsPerQuarter: 4,
  keyFifths: 0,
  keyMode: null,
  timeBeats: 4,
  timeBeatType: 4,
  ties: { start: false, stop: false },
  tiePrevSourceNoteId: null,
  tieNextSourceNoteId: null,
  tuplet: null,
  fingerings: [],
  articulations: [],
  ornaments: [],
  isGrace: false,
  ...overrides
});

const envelope = (partOverrides = {}) => ({
  version: '1.0.0',
  sourceIdentity: 'fixture:supported.musicxml',
  parts: [{
    id: 'P1',
    name: 'Guitar',
    staffCount: 1,
    measureCount: 1,
    noteCount: 1,
    restCount: 1,
    measures: [{ number: 1, name: '1', startDiv: 0, endDiv: 16 }],
    notes: [note()],
    rests: [{
      sourceNoteId: 'r1',
      onsetDiv: 4,
      durationDiv: 4,
      voice: 1,
      staff: 1,
      divsPerQuarter: 4,
      symbolicDuration: null
    }],
    timeSignatures: [{ startDiv: 0, beats: 4, beatType: 4 }],
    keySignatures: [],
    clefs: [],
    ...partOverrides
  }],
   provenance: {
    parser: 'partitura',
    partituraVersion: '1.9.0',
    sourceIdentity: 'fixture:supported.musicxml'
  },
  preservedSymbols: [],
  diagnostics: []
});

const sidecar = (symbols = [], sourceIdentity = 'fixture:supported.musicxml') => ({
  version: '1.0.0',
  sourceIdentity,
  symbols
});

const options = Object.freeze({
  source,
  documentId: 'doc-supported',
  revisionId: 'rev-supported'
});

test('SES-87 maps a supported Partitura envelope through canonical V3/V4 validation with deterministic ids', () => {
  const first = mapPartituraImportToCanonicalV1(envelope(), sidecar(), options);
  const second = mapPartituraImportToCanonicalV1(envelope(), sidecar(), options);

  assert.equal(first.ok, true);
  assert.deepEqual(first, second);
  assert.equal(first.score.schemaVersion, '3.0.0');
  assert.equal(first.notation.contractVersion, '4.0.0');
  assert.equal(first.score.id, 'doc-supported');
  assert.equal(first.score.revision.id, 'rev-supported');
  assert.equal(first.score.parts[0].id, 'part-1');
  assert.equal(first.score.parts[0].staves[0].id, 'staff-1-1');
  assert.equal(first.score.parts[0].staves[0].measures[0].voices[0].events[0].id, 'event-1-1-1-1-1');
  assert.equal(first.score.parts[0].staves[0].measures[0].voices[0].events[0].note.id, 'note-1-1-1-1-1-1');
});

test('SES-87 supported fallback semantics equal the native canonical V3/V4 layer', () => {
  const nativeV2 = importNotationMusicXmlV2(xml, options);
  const nativeV3 = migrateScoreNotationV2ToV3(nativeV2.score, nativeV2.notation);
  const nativeV4 = migrateNotationV3ToV4(nativeV3.score, nativeV3.notation);

  const fallback = mapPartituraImportToCanonicalV1(envelope(), sidecar(), options);
  assert.equal(fallback.ok, true);
  assert.deepEqual(fallback.score, nativeV3.score);
  assert.deepEqual(fallback.notation, nativeV4);
});

test('SES-87 preserves reviewed sidecar evidence without promoting it into canonical authority', () => {
  const preserved = {
    version: '1.0.0',
    disposition: 'PRESERVED_RENDERABLE',
    element: 'fret',
    sourcePath: 'score-partwise[0]/part[0]/measure[0]/note[0]/notations[0]/technical[0]/fret[0]',
    measureNumber: '1',
    sourceNoteId: 'n1',
    attributes: {},
    text: '7',
    provenance: {
      sourceIdentity: 'fixture:supported.musicxml',
      parser: 'raw-musicxml-preservation-v1'
    }
  };
  const result = mapPartituraImportToCanonicalV1(envelope(), sidecar([preserved]), options);

  assert.equal(result.ok, true);
  assert.deepEqual(result.preservedSymbols, [preserved]);
  assert.equal(JSON.stringify(result.score).includes('"fret"'), false);
  assert.equal(JSON.stringify(result.notation).includes('"fret"'), false);
});

test('SES-87 fails closed when the preservation sidecar belongs to another source', () => {
  const result = mapPartituraImportToCanonicalV1(
    envelope(),
    sidecar([], 'fixture:other.musicxml'),
    options
  );

  assert.equal(result.ok, false);
  assert.equal(result.diagnostics[0].code, 'SOURCE_IDENTITY_MISMATCH');
  assert.equal('score' in result, false);
});

test('SES-87 fails closed on normalized semantics with no lossless canonical owner', () => {
  const result = mapPartituraImportToCanonicalV1(
    envelope({ notes: [note({ fingerings: ['1'] })] }),
    sidecar(),
    options
  );

  assert.equal(result.ok, false);
  assert.equal(result.diagnostics[0].code, 'UNSUPPORTED_SEMANTIC');
  assert.match(result.diagnostics[0].message, /fingering/i);
  assert.equal('score' in result, false);
});

test('SES-87 does not return a partial canonical pair for invalid overlapping voice timing', () => {
  const result = mapPartituraImportToCanonicalV1(
    envelope({
      noteCount: 2,
      restCount: 0,
      notes: [
        note({ sourceNoteId: 'n1', onsetDiv: 0, durationDiv: 8, durationQuarter: 2 }),
        note({ sourceNoteId: 'n2', onsetDiv: 4, durationDiv: 4, onsetQuarter: 1, durationQuarter: 1 })
      ],
      rests: []
    }),
    sidecar(),
    options
  );

  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.some(item => item.code === 'CANONICAL_VALIDATION_FAILED'), true);
  assert.equal('score' in result, false);
  assert.equal('notation' in result, false);
});
