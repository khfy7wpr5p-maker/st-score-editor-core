import test from 'node:test';
import assert from 'node:assert/strict';

import {
  importMusicXml,
  MusicXmlError,
  serializeMusicXml
} from '../dist/packages/musicxml/src/index.js';

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
