import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createNewScoreEditorAppDocument,
  exportMusicXmlScoreEditorAppDocument,
  openMusicXmlScoreEditorAppDocument
} from '../dist/packages/score-editor-app-document/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createEditorSessionV4WithRendererProfile } from '../dist/packages/editor-session-controller-v4/src/index.js';
import { rendererProfile } from '../dist/packages/renderer-contract/src/index.js';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import {
  ACTIVE_VOICE_ORDINALS_V4,
  activeVoiceAvailabilityV4,
  createActiveVoiceInsertionPositionV4,
  resolveActiveVoiceAddressV4,
  ActiveVoiceV4Error
} from '../dist/packages/editor-active-voice-v4/src/index.js';
import { resolveInsertionPositionV3, InsertionPositionV3Error } from '../dist/packages/editor-insertion-position-v3/src/index.js';
import { commitScoreEditorAppPositionNoteEntryV4 } from '../dist/packages/score-editor-app-position-note-entry/src/index.js';

const deterministicIdFactory = () => {
  let index = 0;
  return () => `app10c${++index}`;
};

const fiveVoiceDocument = () => {
  const base = createNewScoreEditorAppDocument({
    preset: 'GUITAR_TREBLE',
    idFactory: deterministicIdFactory(),
    title: 'APP-10C Five Voice'
  });
  const originalScore = base.session.history.present.score;
  const candidate = structuredClone(originalScore);
  const staff = candidate.parts[0].staves[0];
  assert.notEqual(staff.role, 'tablature-linked');
  const measure = staff.measures[0];
  for (let ordinal = 2; ordinal <= 5; ordinal += 1) {
    measure.voices.push({
      id: `voice:app10c:${ordinal}`,
      ordinal,
      events: [{
        id: `event:app10c:rest:${ordinal}`,
        kind: 'rest',
        onset: { numerator: 0, denominator: 1 },
        duration: { numerator: 1, denominator: 1 }
      }],
      graceGroups: []
    });
  }
  const score = createScoreDocumentV3(candidate);
  const currentNotation = base.session.history.present.notation;
  const notation = createNotationDocumentV4(score, structuredClone(currentNotation));
  const session = createEditorSessionV4WithRendererProfile(score, notation, rendererProfile('osmd'));
  return Object.freeze({ ...base, session });
};

test('APP-10C bounds the presentation Voice choice to 1..5 and does not invent missing voices', () => {
  assert.deepEqual(ACTIVE_VOICE_ORDINALS_V4, [1, 2, 3, 4, 5]);
  const document = createNewScoreEditorAppDocument({ preset: 'GUITAR_TREBLE', idFactory: deterministicIdFactory() });
  const score = document.session.history.present.score;
  const staff = score.parts[0].staves[0];
  assert.notEqual(staff.role, 'tablature-linked');
  const measure = staff.measures[0];
  const context = addressEntityV3(score, measure.id);
  assert.deepEqual(activeVoiceAvailabilityV4(score, context), [1]);
  assert.throws(
    () => resolveActiveVoiceAddressV4(score, context, 2),
    error => error instanceof ActiveVoiceV4Error && error.code === 'VOICE_NOT_PRESENT'
  );
});

test('APP-10C targets Voice 5 semantically, enters a quarter note into its explicit rest, and preserves unified app history', () => {
  const document = fiveVoiceDocument();
  const score = document.session.history.present.score;
  const staff = score.parts[0].staves[0];
  assert.notEqual(staff.role, 'tablature-linked');
  const measure = staff.measures[0];
  const context = addressEntityV3(score, measure.id);
  assert.deepEqual(activeVoiceAvailabilityV4(score, context), [1, 2, 3, 4, 5]);

  const voice5 = resolveActiveVoiceAddressV4(score, context, 5);
  assert.equal(voice5.kind, 'voice');
  assert.equal(voice5.voiceId, 'voice:app10c:5');
  const position = createActiveVoiceInsertionPositionV4(score, context, 5, { numerator: 0, denominator: 1 });
  const committed = commitScoreEditorAppPositionNoteEntryV4(
    document,
    position,
    {
      version: '1.0.0',
      type: 'ENTER_NOTE_AT_POSITION',
      noteId: 'note:app10c:voice5',
      pitch: { step: 'E', alter: 0, octave: 4 },
      duration: { numerator: 1, denominator: 4 },
      leadingRestEventId: null,
      trailingRestEventId: 'event:app10c:voice5:tail'
    },
    { nextRevisionId: 'rev:app10c:voice5-entry' }
  );

  assert.equal(committed.session.status.code, 'POSITION_NOTE_ENTRY_COMMITTED');
  assert.equal(committed.session.history.past.length, 1);
  assert.equal(committed.session.history.present.score.revision.id, 'rev:app10c:voice5-entry');
  assert.equal(committed.session.selection?.kind, 'note');
  assert.equal(committed.session.selection?.kind === 'note' ? committed.session.selection.noteId : null, 'note:app10c:voice5');
  const nextStaff = committed.session.history.present.score.parts[0].staves[0];
  assert.notEqual(nextStaff.role, 'tablature-linked');
  const nextVoice5 = nextStaff.measures[0].voices.find(voice => voice.ordinal === 5);
  assert.ok(nextVoice5);
  assert.equal(nextVoice5.events.length, 2);
  assert.equal(nextVoice5.events[0].kind, 'note');
  assert.deepEqual(nextVoice5.events[0].duration, { numerator: 1, denominator: 4 });
  assert.equal(nextVoice5.events[1].kind, 'rest');
  assert.deepEqual(nextVoice5.events[1].onset, { numerator: 1, denominator: 4 });
  assert.deepEqual(nextVoice5.events[1].duration, { numerator: 3, denominator: 4 });
});

test('APP-10C five-Voice score and Voice-5 note entry survive MusicXML export and re-import', async () => {
  const document = fiveVoiceDocument();
  const score = document.session.history.present.score;
  const staff = score.parts[0].staves[0];
  assert.notEqual(staff.role, 'tablature-linked');
  const context = addressEntityV3(score, staff.measures[0].id);
  const position = createActiveVoiceInsertionPositionV4(score, context, 5, { numerator: 0, denominator: 1 });
  const committed = commitScoreEditorAppPositionNoteEntryV4(document, position, {
    version: '1.0.0',
    type: 'ENTER_NOTE_AT_POSITION',
    noteId: 'note:app10c:roundtrip',
    pitch: { step: 'G', alter: 1, octave: 4 },
    duration: { numerator: 1, denominator: 4 },
    leadingRestEventId: null,
    trailingRestEventId: 'event:app10c:roundtrip:tail'
  }, { nextRevisionId: 'rev:app10c:roundtrip' });

  const xml = exportMusicXmlScoreEditorAppDocument(committed);
  assert.match(xml, /<voice>5<\/voice>/);
  const reopened = await openMusicXmlScoreEditorAppDocument(xml, {
    sha256Hex: async () => 'a'.repeat(64),
    documentId: 'doc:app10c:reopened',
    revisionId: 'rev:app10c:reopened'
  });
  const reopenedStaff = reopened.session.history.present.score.parts[0].staves[0];
  assert.notEqual(reopenedStaff.role, 'tablature-linked');
  const reopenedMeasure = reopenedStaff.measures[0];
  assert.deepEqual(reopenedMeasure.voices.map(voice => voice.ordinal), [1, 2, 3, 4, 5]);
  const voice5 = reopenedMeasure.voices.find(voice => voice.ordinal === 5);
  assert.ok(voice5);
  assert.equal(voice5.events[0].kind, 'note');
  assert.deepEqual(voice5.events[0].kind === 'note' ? voice5.events[0].note.pitch : null, { step: 'G', alter: 1, octave: 4 });
});

test('APP-10C insertion positions are revision-bound and stale positions fail closed', () => {
  const document = fiveVoiceDocument();
  const score = document.session.history.present.score;
  const staff = score.parts[0].staves[0];
  assert.notEqual(staff.role, 'tablature-linked');
  const context = addressEntityV3(score, staff.measures[0].id);
  const position = createActiveVoiceInsertionPositionV4(score, context, 1, { numerator: 0, denominator: 1 });
  const staleScore = createScoreDocumentV3({
    ...structuredClone(score),
    revision: { id: 'rev:app10c:later', parentId: score.revision.id }
  });
  assert.throws(
    () => resolveInsertionPositionV3(staleScore, position),
    error => error instanceof InsertionPositionV3Error && error.code === 'STALE_POSITION'
  );
});
