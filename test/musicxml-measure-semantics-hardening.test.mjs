import test from 'node:test';
import assert from 'node:assert/strict';

import {
  importMusicXmlWithMeasureSemantics,
  MusicXmlError
} from '../dist/packages/musicxml/src/index.js';

const byteLength = (value) => new TextEncoder().encode(value).byteLength;
const sourceFor = (xml) => ({
  sha256: '1'.repeat(64),
  format: 'musicxml',
  byteLength: byteLength(xml)
});

const wrap = (timeBody) => `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>4</divisions><time>${timeBody}</time></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note>
    </measure>
  </part>
</score-partwise>`;

test('time-signature leaf elements cannot hide unsupported nested semantics', () => {
  const xml = wrap('<beats>4<hidden/></beats><beat-type>4</beat-type>');
  assert.throws(
    () => importMusicXmlWithMeasureSemantics(xml, { source: sourceFor(xml) }),
    (error) => error instanceof MusicXmlError && error.code === 'UNSUPPORTED_MUSICXML'
  );
});

test('beat-type leaf elements cannot hide unsupported nested semantics', () => {
  const xml = wrap('<beats>4</beats><beat-type>4<hidden/></beat-type>');
  assert.throws(
    () => importMusicXmlWithMeasureSemantics(xml, { source: sourceFor(xml) }),
    (error) => error instanceof MusicXmlError && error.code === 'UNSUPPORTED_MUSICXML'
  );
});
