import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  createScoreEditorSdkV1WithSourceIdentity,
  SCORE_EDITOR_SOURCE_NOTE_IDENTITY_V1_VERSION
} from '../dist/packages/score-editor-sdk-v1/public.js';

const sha256Hex = async (text) => createHash('sha256').update(new TextEncoder().encode(text)).digest('hex');

const xmlWithIds = (firstId = 'sti_note_a', secondId = 'sti_note_b') => `<?xml version="1.0" encoding="UTF-8"?>
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

const open = async (sdk, xml, suffix) => {
  const result = await sdk.document.openMusicXml(xml, {
    title: `S06E ${suffix}`,
    documentId: `doc:s06e:${suffix}`,
    revisionId: `rev:s06e:${suffix}:open`,
    sha256Hex
  });
  assert.equal(result.ok, true, result.ok ? '' : `${result.error.code}: ${result.error.message}`);
  const guard = sdk.getRevisionGuard();
  assert.ok(guard);
  return guard;
};

test('S06E SDK maps standard MusicXML note@id to current semantic note targets across an edit revision', async () => {
  const sdk = createScoreEditorSdkV1WithSourceIdentity();
  assert.equal(sdk.sourceIdentity.version, SCORE_EDITOR_SOURCE_NOTE_IDENTITY_V1_VERSION);
  const guard = await open(sdk, xmlWithIds(), 'mapped');

  const mappings = sdk.sourceIdentity.listNoteMappings(guard);
  assert.equal(mappings.ok, true);
  assert.deepEqual(mappings.value.map((item) => item.sourceNoteId), ['sti_note_a', 'sti_note_b']);
  assert.deepEqual(mappings.value.map((item) => item.target.address.noteId), [
    'note-1-1-1-1-1-1',
    'note-1-1-1-1-2-1'
  ]);
  assert.ok(mappings.value.every((item) => item.target.entityKind === 'note'));

  const first = mappings.value[0];
  const selected = sdk.selection.select(first.target.address, guard);
  assert.equal(selected.ok, true);
  const edited = sdk.authoring.commitKeypad({
    expected: guard,
    action: Object.freeze({ version: '1.0.0', actionId: 'accidental.sharp' }),
    nextRevisionId: 'rev:s06e:mapped:edit'
  });
  assert.equal(edited.ok, true, edited.ok ? '' : `${edited.error.code}: ${edited.error.message}`);

  const editedGuard = sdk.getRevisionGuard();
  assert.ok(editedGuard);
  assert.equal(editedGuard.revisionId, 'rev:s06e:mapped:edit');
  const after = sdk.sourceIdentity.listNoteMappings(editedGuard);
  assert.equal(after.ok, true);
  assert.equal(after.value[0].sourceNoteId, 'sti_note_a');
  assert.equal(after.value[0].target.address.noteId, 'note-1-1-1-1-1-1');
  assert.equal(after.value[0].target.address.revisionId, editedGuard.revisionId);

  const stale = sdk.sourceIdentity.listNoteMappings(guard);
  assert.equal(stale.ok, false);
  assert.equal(stale.error.code, 'STALE_REQUEST');
});

test('S06E duplicate or invalid source note ids remain non-blocking evidence', async () => {
  const sdk = createScoreEditorSdkV1WithSourceIdentity();
  const duplicateGuard = await open(sdk, xmlWithIds('duplicate_note', 'duplicate_note'), 'duplicate');
  const duplicate = sdk.sourceIdentity.listNoteMappings(duplicateGuard);
  assert.equal(duplicate.ok, true);
  assert.deepEqual(duplicate.value, []);

  const invalidGuard = await open(sdk, xmlWithIds('bad id', 'sti_note_safe'), 'invalid');
  const invalid = sdk.sourceIdentity.listNoteMappings(invalidGuard);
  assert.equal(invalid.ok, true);
  assert.deepEqual(invalid.value.map((item) => item.sourceNoteId), ['sti_note_safe']);
  assert.equal(invalid.value[0].target.address.noteId, 'note-1-1-1-1-2-1');

  const fresh = sdk.document.newDocument({ title: 'S06E fresh', preset: 'GUITAR_TREBLE', idFactory: (() => { let n = 0; return () => `s06e-${++n}`; })() });
  assert.equal(fresh.ok, true);
  const freshGuard = sdk.getRevisionGuard();
  assert.ok(freshGuard);
  const cleared = sdk.sourceIdentity.listNoteMappings(freshGuard);
  assert.equal(cleared.ok, true);
  assert.deepEqual(cleared.value, []);
});
