import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import {
  MusicXmlError
} from '../dist/packages/musicxml/src/index.js';
import {
  routeMusicXmlImportV1,
  MusicXmlImportRouterError
} from '../dist/packages/musicxml-import-router/src/index.js';
import {
  createStandaloneScoreEditorController
} from '../dist/packages/score-editor-browser-app/src/index.js';
import {
  openMusicXmlScoreEditorAppDocument,
  commitAppTopologyIntent,
  navigateAppDocumentHistory
} from '../dist/packages/score-editor-app-document/src/index.js';

const sha256 = text => createHash('sha256').update(new TextEncoder().encode(text)).digest('hex');
const sourceFor = xml => ({
  sha256: sha256(xml),
  format: 'musicxml',
  byteLength: new TextEncoder().encode(xml).byteLength
});
const nodeSha256 = async text => sha256(text);

const baseXml = noteBody => `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
  <part id="P1"><measure number="1">
    <attributes>
      <divisions>4</divisions>
      <key><fifths>0</fifths></key>
      <time><beats>4</beats><beat-type>4</beat-type></time>
      <clef><sign>G</sign><line>2</line></clef>
    </attributes>
    ${noteBody}
  </measure></part>
</score-partwise>`;

const nativeXml = baseXml(`<note id="n1">
  <pitch><step>E</step><octave>4</octave></pitch>
  <duration>4</duration><voice>1</voice><staff>1</staff>
</note>`);

const technicalXml = baseXml(`<note id="n1">
  <pitch><step>E</step><octave>4</octave></pitch>
  <duration>4</duration><voice>1</voice><staff>1</staff>
  <notations><technical><string>1</string><fret>0</fret></technical></notations>
</note>`);

const unrepresentableXml = baseXml(`<direction><direction-type><words>rit.</words></direction-type></direction>
<note id="n1">
  <pitch><step>E</step><octave>4</octave></pitch>
  <duration>4</duration><voice>1</voice><staff>1</staff>
</note>`);

const envelopeFor = sourceIdentity => ({
  version: '1.0.0',
  sourceIdentity,
  parts: [{
    id: 'P1',
    name: 'Guitar',
    staffCount: 1,
    measureCount: 1,
    noteCount: 1,
    restCount: 0,
    measures: [{ number: 1, name: '1', startDiv: 0, endDiv: 4 }],
    notes: [{
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
      isGrace: false
    }],
    rests: [],
    timeSignatures: [{ startDiv: 0, beats: 4, beatType: 4 }],
    keySignatures: [{ startDiv: 0, fifths: 0, mode: null }],
    clefs: [{ startDiv: 0, staff: 1, sign: 'G', line: 2, octaveChange: 0 }]
  }],
  preservedSymbols: [],
  diagnostics: [],
  provenance: {
    parser: 'partitura',
    partituraVersion: '1.9.0',
    sourceIdentity
  }
});

test('SES-89 keeps native MusicXML import as the zero-fallback fast path', async () => {
  let calls = 0;
  const result = await routeMusicXmlImportV1(nativeXml, {
    source: sourceFor(nativeXml),
    partituraFallback: async () => {
      calls += 1;
      return envelopeFor('should-not-run');
    }
  });

  assert.equal(result.route, 'NATIVE');
  assert.equal(calls, 0);
  assert.equal(result.score.schemaVersion, '3.0.0');
  assert.equal(result.notation.contractVersion, '4.0.0');
  assert.deepEqual(result.preservedSymbols, []);
});

test('SES-89 routes reviewed guitar technical incompatibility to Partitura exactly once and preserves source TAB evidence', async () => {
  let calls = 0;
  const result = await routeMusicXmlImportV1(technicalXml, {
    source: sourceFor(technicalXml),
    documentId: 'doc-ses-89',
    revisionId: 'rev-ses-89',
    partituraFallback: async request => {
      calls += 1;
      assert.equal(request.contractVersion, '1.0.0');
      assert.equal(request.musicXml, technicalXml);
      assert.equal(request.sourceIdentity, `sha256:${sourceFor(technicalXml).sha256}`);
      return envelopeFor(request.sourceIdentity);
    }
  });

  assert.equal(calls, 1);
  assert.equal(result.route, 'PARTITURA_FALLBACK');
  assert.equal(result.score.id, 'doc-ses-89');
  assert.equal(result.score.revision.id, 'rev-ses-89');
  assert.deepEqual(
    result.preservedSymbols.filter(item => item.element === 'string' || item.element === 'fret').map(item => [item.element, item.text]),
    [['string', '1'], ['fret', '0']]
  );
});

test('SES-89 never falls back for malformed, resource-limit, or fundamentally unrepresentable semantic failures', async () => {
  let calls = 0;
  const fallback = async request => {
    calls += 1;
    return envelopeFor(request.sourceIdentity);
  };

  await assert.rejects(
    () => routeMusicXmlImportV1('<score-partwise><part>', {
      source: sourceFor('<score-partwise><part>'),
      partituraFallback: fallback
    }),
    error => error instanceof MusicXmlError && error.code === 'INVALID_XML'
  );

  await assert.rejects(
    () => routeMusicXmlImportV1(nativeXml, {
      source: sourceFor(nativeXml),
      limits: { maxDepth: 3 },
      partituraFallback: fallback
    }),
    error => error instanceof MusicXmlError && error.code === 'XML_DEPTH_LIMIT_EXCEEDED'
  );

  await assert.rejects(
    () => routeMusicXmlImportV1(unrepresentableXml, {
      source: sourceFor(unrepresentableXml),
      partituraFallback: fallback
    }),
    error => error instanceof MusicXmlError && error.code === 'UNSUPPORTED_MUSICXML'
  );

  assert.equal(calls, 0);
});

test('SES-89 rejects an invalid fallback result after one call and never retries', async () => {
  let calls = 0;
  await assert.rejects(
    () => routeMusicXmlImportV1(technicalXml, {
      source: sourceFor(technicalXml),
      partituraFallback: async request => {
        calls += 1;
        return { ...envelopeFor(request.sourceIdentity), parts: [] };
      }
    }),
    error => error instanceof MusicXmlImportRouterError && error.code === 'FALLBACK_VALIDATION_FAILED'
  );
  assert.equal(calls, 1);
});

test('SES-89 app open uses the router once; later canonical edit and Undo never call Partitura', async () => {
  let calls = 0;
  let document = await openMusicXmlScoreEditorAppDocument(technicalXml, {
    sha256Hex: nodeSha256,
    documentId: 'doc-app-ses-89',
    revisionId: 'rev-app-ses-89',
    musicXmlImportRouter: routeMusicXmlImportV1,
    partituraFallback: async request => {
      calls += 1;
      return envelopeFor(request.sourceIdentity);
    }
  });

  assert.equal(calls, 1);
  const score = document.session.history.present.score;
  const part = score.parts[0];
  assert.ok(part);
  document = commitAppTopologyIntent(document, {
    version: '1.0.0',
    type: 'RENAME_PART_OR_INSTRUMENT',
    target: addressEntityV3(score, part.id),
    partName: 'Imported Guitar',
    instrumentName: 'Imported Guitar',
    instrumentShortName: 'Gtr.'
  }, { nextRevisionId: 'rev-app-ses-89-edit' });
  document = navigateAppDocumentHistory(document, 'UNDO');

  assert.equal(calls, 1);
  assert.equal(document.session.history.present.score.revision.id, 'rev-app-ses-89');
});


test('SES-89 browser open seam injects the router/fallback only for file-open and keeps it out of later edits', async () => {
  let calls = 0;
  const controller = createStandaloneScoreEditorController();

  const opened = await controller.openMusicXml(technicalXml, {
    sha256Hex: nodeSha256,
    documentId: 'doc-browser-ses-89',
    revisionId: 'rev-browser-ses-89',
    musicXmlImportRouter: routeMusicXmlImportV1,
    partituraFallback: async request => {
      calls += 1;
      return envelopeFor(request.sourceIdentity);
    }
  });
  assert.equal(opened.error, null);
  assert.equal(calls, 1);

  const document = controller.getDocument();
  assert.ok(document);
  const score = document.session.history.present.score;
  const part = score.parts[0];
  assert.ok(part);
  controller.commitTopology({
    version: '1.0.0',
    type: 'RENAME_PART_OR_INSTRUMENT',
    target: addressEntityV3(score, part.id),
    partName: 'Browser Imported Guitar',
    instrumentName: 'Browser Imported Guitar',
    instrumentShortName: 'Gtr.'
  }, { nextRevisionId: 'rev-browser-ses-89-edit' });
  controller.undo();

  assert.equal(calls, 1);
});
