import test from 'node:test';
import assert from 'node:assert/strict';
import {
  importNotationMusicXmlV2,
  importNotationMusicXmlV2Legacy,
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

const generated = ['note-1-1-1-1-1-1', 'note-1-1-1-1-2-1'];

test('S06E canonical v2 import preserves unique bounded MusicXML note@id values', () => {
  const xml = xmlWithIds();
  const imported = importNotationMusicXmlV2(xml, {
    source: sourceFor(xml),
    documentId: 'doc:s06e',
    revisionId: 'rev:s06e'
  });
  assert.equal(MUSICXML_NOTE_IDENTITY_BRIDGE_VERSION, '0.3.0');
  assert.deepEqual(normalNoteIds(imported.score), ['src_note_a', 'src_note_b']);
});

test('S06E legacy importer remains available and keeps generated note identity behavior', () => {
  const xml = xmlWithIds();
  const imported = importNotationMusicXmlV2Legacy(xml, {
    source: sourceFor(xml),
    documentId: 'doc:s06e-legacy',
    revisionId: 'rev:s06e-legacy'
  });
  assert.deepEqual(normalNoteIds(imported.score), generated);
});

test('S06E duplicate source ids degrade to generated identities instead of blocking score import', () => {
  const xml = xmlWithIds('duplicate_note', 'duplicate_note');
  const imported = importNotationMusicXmlV2(xml, {
    source: sourceFor(xml),
    documentId: 'doc:s06e-duplicate',
    revisionId: 'rev:s06e-duplicate'
  });
  assert.deepEqual(normalNoteIds(imported.score), generated);
});

test('S06E invalid source ids are ignored while other safe source ids remain usable', () => {
  const xml = xmlWithIds('bad id', 'src_note_ok');
  const imported = importNotationMusicXmlV2(xml, {
    source: sourceFor(xml),
    documentId: 'doc:s06e-invalid',
    revisionId: 'rev:s06e-invalid'
  });
  assert.deepEqual(normalNoteIds(imported.score), ['note-1-1-1-1-1-1', 'src_note_ok']);
});

test('S06E canonical identity collision degrades the identity overlay rather than blocking score import', () => {
  const xml = xmlWithIds('event-1-1-1-1-1', 'src_note_safe');
  const imported = importNotationMusicXmlV2(xml, {
    source: sourceFor(xml),
    documentId: 'doc:s06e-collision',
    revisionId: 'rev:s06e-collision'
  });
  assert.deepEqual(normalNoteIds(imported.score), generated);
});
