import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analyzeSemanticParityMusicXmlProfileV1,
  compareEditorSemanticsV1
} from '../dist/packages/editor-semantic-parity-v1/src/index.js';

const twoMeasureXml = (extra = '') => `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1"><attributes><divisions>4</divisions></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration>${extra}<voice>1</voice><type>quarter</type></note>
    </measure>
    <measure number="2"><note><rest/><duration>4</duration><voice>1</voice><type>quarter</type></note></measure>
  </part>
</score-partwise>`;

test('SEM-04 profile rejects a one-measure fixture', () => {
  const xml = twoMeasureXml().replace(
    '<measure number="2"><note><rest/><duration>4</duration><voice>1</voice><type>quarter</type></note></measure>',
    ''
  );
  const result = analyzeSemanticParityMusicXmlProfileV1(xml, 4);
  assert.equal(result.status, 'UNSUPPORTED');
});

test('SEM-04 profile rejects time-modification-only tuplets', () => {
  const result = analyzeSemanticParityMusicXmlProfileV1(
    twoMeasureXml('<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>'),
    4
  );
  assert.equal(result.status, 'UNSUPPORTED');
});

test('SEM-04 comparator collapses identical multi-staff key contexts by measure', () => {
  const editor = {
    partCount: 1,
    measureCount: 2,
    notes: [],
    timeSignatures: [{ measureIndex: 0, beats: 4, beatType: 4 }],
    keySignatures: [
      { measureIndex: 0, staffOrdinal: 1, fifths: 0 },
      { measureIndex: 0, staffOrdinal: 2, fifths: 0 }
    ],
    clefs: []
  };
  const reference = {
    provenance: {
      schemaVersion: 'st-editor-semantic-parity-fixture-v1',
      sourceSha256: 'a'.repeat(64),
      semanticEngineCommit: 'ffc997b242fa862e180e698385cc0afb52de47a1',
      semanticSnapshotSchema: 'st-semantic-snapshot-v1',
      partituraVersion: '1.9.0',
      divisionsPerQuarter: 4
    },
    semanticSnapshot: {
      schema_version: 'st-semantic-snapshot-v1',
      source_kind: 'musicxml',
      part_count: 1,
      measure_count: 2,
      notes: [],
      time_signatures: [{ part_id: 'P1', onset_div: 0, beats: 4, beat_type: 4 }],
      key_signatures: [{ part_id: 'P1', onset_div: 0, fifths: 0, mode: null }],
      clefs: []
    }
  };

  assert.deepEqual(compareEditorSemanticsV1(editor, reference), { status: 'PASS', diagnostics: [] });
});
