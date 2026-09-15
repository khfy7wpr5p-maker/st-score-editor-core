import test from 'node:test';
import assert from 'node:assert/strict';
import {
  importNotationMusicXmlV2,
  importNotationMusicXmlV2Legacy,
  serializeNotationMusicXmlV2,
  MUSICXML_NOTE_IDENTITY_BRIDGE_VERSION
} from '../dist/packages/musicxml-v2/src/index.js';

const sourceFor = (xml) => ({
  sha256: '6'.repeat(64),
  format: 'musicxml',
  byteLength: new TextEncoder().encode(xml).byteLength
});

const xmlWithIds = (firstId = 'src_note_a', secondId = 'src_note_b') => `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Identity</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <note id="${firstId}"><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
      <note id="${secondId}"><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>
`;

const normalNoteIds = (score) => score.parts.flatMap((part) =>
  part.staves.flatMap((staff) => staff.measures.flatMap((measure) =>
    measure.voices.flatMap((voice) => voice.events.flatMap((event) =>
      event.kind === 'note' ? [event.note.id] : event.kind === 'chord' ? event.notes.map((note) => note.id) : []
    ))
  ))
);

test('S06E canonical v2 import preserves unique bounded MusicXML note@id values and serializer emits them again', () => {
  const xml = xmlWithIds();
  const imported = importNotationMusicXmlV2(xml, {
    source: sourceFor(xml),
    documentId: 'doc:s06e',
    revisionId: 'rev:s06e'
  });
  assert.equal(MUSICXML_NOTE_IDENTITY_BRIDGE_VERSION, '0.2.0');
  assert.deepEqual(normalNoteIds(imported.score), ['src_note_a', 'src_note_b']);
  const serialized = serializeNotationMusicXmlV2(imported.score, imported.notation);
  assert.match(serialized, /<note id="src_note_a">/);
  assert.match(serialized, /<note id="src_note_b">/);
});

test('S06E legacy importer remains available and keeps generated note identity behavior', () => {
  const xml = xmlWithIds();
  const imported = importNotationMusicXmlV2Legacy(xml, {
    source: sourceFor(xml),
    documentId: 'doc:s06e-legacy',
    revisionId: 'rev:s06e-legacy'
  });
  assert.deepEqual(normalNoteIds(imported.score), [
    'note-1-1-1-1-1-1',
    'note-1-1-1-1-2-1'
  ]);
});

test('S06E duplicate source ids degrade to generated identities instead of blocking score import', () => {
  const xml = xmlWithIds('duplicate_note', 'duplicate_note');
  const imported = importNotationMusicXmlV2(xml, {
    source: sourceFor(xml),
    documentId: 'doc:s06e-duplicate',
    revisionId: 'rev:s06e-duplicate'
  });
  assert.deepEqual(normalNoteIds(imported.score), [
    'note-1-1-1-1-1-1',
    'note-1-1-1-1-2-1'
  ]);
});

test('S06E invalid or colliding source ids do not replace canonical editor identities', () => {
  const invalidXml = xmlWithIds('bad id', 'src_note_ok');
  const invalidImported = importNotationMusicXmlV2(invalidXml, {
    source: sourceFor(invalidXml),
    documentId: 'doc:s06e-invalid',
    revisionId: 'rev:s06e-invalid'
  });
  assert.deepEqual(normalNoteIds(invalidImported.score), ['note-1-1-1-1-1-1', 'src_note_ok']);

  const collisionXml = xmlWithIds('event-1-1-1-1-1', 'src_note_safe');
  const collisionImported = importNotationMusicXmlV2(collisionXml, {
    source: sourceFor(collisionXml),
    documentId: 'doc:s06e-collision',
    revisionId: 'rev:s06e-collision'
  });
  assert.deepEqual(normalNoteIds(collisionImported.score), ['note-1-1-1-1-1-1', 'src_note_safe']);
});
