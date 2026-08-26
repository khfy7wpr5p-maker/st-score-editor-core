import test from 'node:test';
import assert from 'node:assert/strict';

import {
  areMusicSemanticsEquivalent,
  importMusicXml,
  MusicXmlError,
  serializeMusicXml
} from '../dist/packages/musicxml/src/index.js';

const byteLength = (value) => new TextEncoder().encode(value).byteLength;
const sourceFor = (xml, fill = 'a') => ({
  sha256: fill.repeat(64),
  format: 'musicxml',
  byteLength: byteLength(xml)
});

const simplePolyphonic = `<?xml version="1.0" encoding="UTF-8"?>
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
      <note>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>4</duration><voice>1</voice>
      </note>
      <note>
        <chord/><pitch><step>G</step><octave>4</octave></pitch>
        <duration>4</duration><voice>1</voice>
      </note>
      <backup><duration>8</duration></backup>
      <note>
        <pitch><step>C</step><octave>3</octave></pitch>
        <duration>8</duration><voice>2</voice>
      </note>
    </measure>
  </part>
</score-partwise>`;

const twoStaff = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>8</divisions><staves>2</staves></attributes>
      <note>
        <pitch><step>F</step><alter>1</alter><octave>4</octave></pitch>
        <duration>8</duration><voice>1</voice><staff>1</staff>
      </note>
      <backup><duration>8</duration></backup>
      <note>
        <rest/><duration>8</duration><voice>1</voice><staff>2</staff>
      </note>
    </measure>
  </part>
</score-partwise>`;

test('imports bounded polyphony into immutable canonical voices and chord events', () => {
  const document = importMusicXml(simplePolyphonic, { source: sourceFor(simplePolyphonic) });
  assert.equal(Object.isFrozen(document), true);
  assert.equal(document.parts.length, 1);
  const measure = document.parts[0].staves[0].measures[0];
  assert.equal(measure.voices.length, 2);
  assert.equal(measure.voices[0].events[0].kind, 'note');
  assert.equal(measure.voices[0].events[1].kind, 'chord');
  assert.equal(measure.voices[0].events[1].notes.length, 2);
  assert.deepEqual(measure.voices[1].events[0].duration, { numerator: 1, denominator: 2 });
});

test('multi-staff score remains separated by stable staff hierarchy', () => {
  const document = importMusicXml(twoStaff, { source: sourceFor(twoStaff) });
  assert.equal(document.parts[0].staves.length, 2);
  assert.equal(document.parts[0].staves[0].measures[0].voices[0].events[0].kind, 'note');
  assert.equal(document.parts[0].staves[1].measures[0].voices[0].events[0].kind, 'rest');
});

test('canonical serialize and re-import preserves admitted music semantics', () => {
  const first = importMusicXml(twoStaff, { source: sourceFor(twoStaff) });
  const serialized = serializeMusicXml(first);
  const second = importMusicXml(serialized, { source: sourceFor(serialized, 'b') });
  assert.equal(areMusicSemanticsEquivalent(first, second), true);
});

test('entity declarations are rejected before SAX parsing', () => {
  const unsafe = `<!DOCTYPE score-partwise [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><score-partwise/>`;
  assert.throws(
    () => importMusicXml(unsafe, { source: sourceFor(unsafe) }),
    (error) => error instanceof MusicXmlError && error.code === 'UNSAFE_XML_DECLARATION'
  );
});

test('untrusted doctype is rejected', () => {
  const unsafe = `<!DOCTYPE score-partwise SYSTEM "https://example.invalid/a.dtd"><score-partwise/>`;
  assert.throws(
    () => importMusicXml(unsafe, { source: sourceFor(unsafe) }),
    (error) => error instanceof MusicXmlError && error.code === 'UNSAFE_XML_DECLARATION'
  );
});

test('trusted MusicXML 4.0.3 partwise doctype is normalized without network resolution', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0.3 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
${simplePolyphonic.slice(simplePolyphonic.indexOf('<score-partwise'))}`;
  const document = importMusicXml(xml, { source: sourceFor(xml) });
  assert.equal(document.parts[0].name, 'Piano');
});

test('source byte identity mismatch fails closed', () => {
  const source = { ...sourceFor(simplePolyphonic), byteLength: 1 };
  assert.throws(
    () => importMusicXml(simplePolyphonic, { source }),
    (error) => error instanceof MusicXmlError && error.code === 'SOURCE_IDENTITY_MISMATCH'
  );
});

test('unsupported time signatures are not silently discarded in E2', () => {
  const xml = simplePolyphonic.replace(
    '<attributes><divisions>4</divisions></attributes>',
    '<attributes><divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>'
  );
  assert.throws(
    () => importMusicXml(xml, { source: sourceFor(xml) }),
    (error) => error instanceof MusicXmlError && error.code === 'UNSUPPORTED_MUSICXML'
  );
});

test('depth budget stops hostile nesting without a partial document', () => {
  assert.throws(
    () => importMusicXml(simplePolyphonic, {
      source: sourceFor(simplePolyphonic),
      limits: { maxDepth: 2 }
    }),
    (error) => error instanceof MusicXmlError && error.code === 'XML_DEPTH_LIMIT_EXCEEDED'
  );
});

test('event budget is enforced on source note elements', () => {
  assert.throws(
    () => importMusicXml(simplePolyphonic, {
      source: sourceFor(simplePolyphonic),
      limits: { maxEvents: 2 }
    }),
    (error) => error instanceof MusicXmlError && error.code === 'EVENT_LIMIT_EXCEEDED'
  );
});

test('pre-aborted processing fails before semantic authority is created', () => {
  const controller = new AbortController();
  controller.abort();
  assert.throws(
    () => importMusicXml(simplePolyphonic, { source: sourceFor(simplePolyphonic), signal: controller.signal }),
    (error) => error instanceof MusicXmlError && error.code === 'PROCESSING_ABORTED'
  );
});

test('processing deadline is fail-closed', () => {
  let current = 0;
  assert.throws(
    () => importMusicXml(simplePolyphonic, {
      source: sourceFor(simplePolyphonic),
      limits: { maxProcessingMilliseconds: 50 },
      now: () => {
        current += 100;
        return current;
      }
    }),
    (error) => error instanceof MusicXmlError && error.code === 'PROCESSING_TIMEOUT'
  );
});
