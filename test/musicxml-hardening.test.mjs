import test from 'node:test';
import assert from 'node:assert/strict';

import {
  importMusicXml,
  MusicXmlError,
  serializeMusicXml
} from '../dist/packages/musicxml/src/index.js';
import { parseMusicXmlV2Tree } from '../dist/packages/musicxml-v2/src/index.js';

const byteLength = (value) => new TextEncoder().encode(value).byteLength;
const sourceFor = (xml, fill = 'c') => ({
  sha256: fill.repeat(64),
  format: 'musicxml',
  byteLength: byteLength(xml)
});

const baseXml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>4</divisions></attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>4</duration><voice>1</voice>
      </note>
    </measure>
  </part>
</score-partwise>`;

test('namespaced nested elements fail closed at the XML boundary', () => {
  const xml = baseXml.replace('<step>C</step>', '<x:step xmlns:x="urn:example">C</x:step>');
  assert.throws(
    () => importMusicXml(xml, { source: sourceFor(xml) }),
    (error) => error instanceof MusicXmlError && error.code === 'UNSUPPORTED_MUSICXML'
  );
});

test('attributes on admitted leaf elements are not silently discarded', () => {
  const xml = baseXml.replace('<step>C</step>', '<step data-extra="1">C</step>');
  assert.throws(
    () => importMusicXml(xml, { source: sourceFor(xml) }),
    (error) => error instanceof MusicXmlError && error.code === 'UNSUPPORTED_MUSICXML'
  );
});

test('child elements hidden inside admitted leaf elements are rejected', () => {
  const xml = baseXml.replace('<step>C</step>', '<step>C<unexpected/></step>');
  assert.throws(
    () => importMusicXml(xml, { source: sourceFor(xml) }),
    (error) => error instanceof MusicXmlError && error.code === 'UNSUPPORTED_MUSICXML'
  );
});

test('serializer refuses to invent a missing part name', () => {
  const imported = importMusicXml(baseXml, { source: sourceFor(baseXml) });
  const mutable = structuredClone(imported);
  mutable.parts[0].name = null;
  assert.throws(
    () => serializeMusicXml(mutable),
    (error) => error instanceof MusicXmlError && error.code === 'UNSUPPORTED_MUSICXML'
  );
});

test('serializer refuses to invent a missing measure display number', () => {
  const imported = importMusicXml(baseXml, { source: sourceFor(baseXml) });
  const mutable = structuredClone(imported);
  mutable.parts[0].staves[0].measures[0].displayNumber = null;
  assert.throws(
    () => serializeMusicXml(mutable),
    (error) => error instanceof MusicXmlError && error.code === 'UNSUPPORTED_MUSICXML'
  );
});


const v2WithIdentification = (identification) => `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  ${identification}
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1"><measure number="1"><attributes><divisions>4</divisions></attributes>
    <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note>
  </measure></part>
</score-partwise>`;

test('P-MXML-REF-01 ignored metadata still consumes the XML depth budget', () => {
  const xml = v2WithIdentification('<identification><a><b/></a></identification>');
  assert.throws(
    () => parseMusicXmlV2Tree(xml, { limits: { maxDepth: 3 } }),
    error => error instanceof MusicXmlError && error.code === 'XML_DEPTH_LIMIT_EXCEEDED'
  );
});

test('P-MXML-REF-01 ignored metadata still consumes the XML element budget', () => {
  const xml = v2WithIdentification('<identification><a/><b/><c/></identification>');
  assert.throws(
    () => parseMusicXmlV2Tree(xml, { limits: { maxElements: 3 } }),
    error => error instanceof MusicXmlError && error.code === 'XML_ELEMENT_LIMIT_EXCEEDED'
  );
});

test('P-MXML-REF-01 ignored metadata still consumes the XML attribute budget', () => {
  const xml = v2WithIdentification('<identification data-a="1" data-b="2"></identification>');
  assert.throws(
    () => parseMusicXmlV2Tree(xml, { limits: { maxAttributes: 2 } }),
    error => error instanceof MusicXmlError && error.code === 'XML_ATTRIBUTE_LIMIT_EXCEEDED'
  );
});

test('P-MXML-REF-01 ignored metadata still consumes the XML text budget', () => {
  const xml = v2WithIdentification('<identification>0123456789ABCDEF</identification>');
  assert.throws(
    () => parseMusicXmlV2Tree(xml, { limits: { maxTextBytes: 8 } }),
    error => error instanceof MusicXmlError && error.code === 'XML_TEXT_LIMIT_EXCEEDED'
  );
});
