import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createNewScoreEditorAppDocument,
  exportMusicXmlScoreEditorAppDocument,
  openMusicXmlScoreEditorAppDocument,
  commitAppBasicAuthoringIntent
} from '../dist/packages/score-editor-app-document/src/index.js';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import {
  activeVoiceAvailabilityV4,
  createActiveVoiceInsertionPositionV4
} from '../dist/packages/editor-active-voice-v4/src/index.js';
import { commitScoreEditorAppVoiceMaterializationV4 } from '../dist/packages/score-editor-app-voice-materialization/src/index.js';
import { commitScoreEditorAppPositionNoteEntryV4 } from '../dist/packages/score-editor-app-position-note-entry/src/index.js';
import { VoiceMaterializationV4Error } from '../dist/packages/editor-voice-materialization-v4/src/index.js';

const deterministicIdFactory = () => {
  let index = 0;
  return () => `app10d${++index}`;
};

const measureContext = document => {
  const score = document.session.history.present.score;
  const staff = score.parts[0].staves[0];
  assert.notEqual(staff.role, 'tablature-linked');
  const measure = staff.measures[0];
  const target = addressEntityV3(score, measure.id);
  assert.equal(target.kind, 'measure');
  return { score, staff, measure, target };
};

const materialize = (document, ordinal, suffix) => {
  const { target } = measureContext(document);
  return commitScoreEditorAppVoiceMaterializationV4(document, {
    version: '1.0.0',
    type: 'MATERIALIZE_VOICE',
    target,
    voiceOrdinal: ordinal,
    voiceId: `voice:app10d:${suffix}`,
    restEventId: `event:app10d:rest:${suffix}`
  }, { nextRevisionId: `rev:app10d:${suffix}` });
};

test('APP-10D materializes a requested Voice only when synthetic full-measure coverage is proven', () => {
  const document = createNewScoreEditorAppDocument({
    preset: 'GUITAR_TREBLE',
    idFactory: deterministicIdFactory()
  });
  const committed = materialize(document, 5, 'voice5');
  assert.equal(committed.session.status.code, 'VOICE_MATERIALIZED');
  assert.equal(committed.session.history.past.length, 1);
  const { score, measure, target } = measureContext(committed);
  assert.deepEqual(activeVoiceAvailabilityV4(score, target), [1, 5]);
  const voice5 = measure.voices.find(voice => voice.ordinal === 5);
  assert.ok(voice5);
  assert.equal(voice5.events.length, 1);
  assert.equal(voice5.events[0].kind, 'rest');
  assert.deepEqual(voice5.events[0].onset, { numerator: 0, denominator: 1 });
  assert.deepEqual(voice5.events[0].duration, { numerator: 1, denominator: 1 });
});

test('APP-10D materialized Voice 5 accepts APP-10C note entry and remains Voice 5 after MusicXML round trip', async () => {
  let document = createNewScoreEditorAppDocument({
    preset: 'GUITAR_TREBLE',
    idFactory: deterministicIdFactory()
  });
  document = materialize(document, 5, 'voice5-roundtrip');
  let { score, target } = measureContext(document);
  const position = createActiveVoiceInsertionPositionV4(score, target, 5, { numerator: 0, denominator: 1 });
  document = commitScoreEditorAppPositionNoteEntryV4(document, position, {
    version: '1.0.0',
    type: 'ENTER_NOTE_AT_POSITION',
    noteId: 'note:app10d:voice5',
    pitch: { step: 'D', alter: 0, octave: 4 },
    duration: { numerator: 1, denominator: 4 },
    leadingRestEventId: null,
    trailingRestEventId: 'event:app10d:voice5:tail'
  }, { nextRevisionId: 'rev:app10d:voice5-note' });

  const xml = exportMusicXmlScoreEditorAppDocument(document);
  assert.match(xml, /<voice>5<\/voice>/);
  const reopened = await openMusicXmlScoreEditorAppDocument(xml, {
    sha256Hex: async () => 'b'.repeat(64),
    documentId: 'doc:app10d:reopened',
    revisionId: 'rev:app10d:reopened'
  });
  const reopenedContext = measureContext(reopened);
  assert.deepEqual(reopenedContext.measure.voices.map(voice => voice.ordinal), [1, 5]);
  const voice5 = reopenedContext.measure.voices.find(voice => voice.ordinal === 5);
  assert.ok(voice5);
  assert.equal(voice5.events[0].kind, 'note');
  assert.deepEqual(voice5.events[0].kind === 'note' ? voice5.events[0].note.pitch : null, { step: 'D', alter: 0, octave: 4 });

  assert.throws(
    () => materialize(reopened, 4, 'imported-block'),
    error => error instanceof VoiceMaterializationV4Error && error.code === 'SOURCE_SCOPE_UNSUPPORTED'
  );
});

test('APP-10D refuses Voice materialization when exact full-measure coverage is no longer proven', () => {
  let document = createNewScoreEditorAppDocument({
    preset: 'GUITAR_TREBLE',
    idFactory: deterministicIdFactory()
  });
  const before = measureContext(document);
  const rest = before.measure.voices[0].events[0];
  const restAddress = addressEntityV3(before.score, rest.id);
  assert.equal(restAddress.kind, 'event');
  document = commitAppBasicAuthoringIntent(document, {
    version: '1.0.0',
    type: 'SET_EVENT_DURATION',
    target: restAddress,
    duration: { numerator: 1, denominator: 4 }
  }, { nextRevisionId: 'rev:app10d:short-rest' });

  assert.throws(
    () => materialize(document, 2, 'coverage-block'),
    error => error instanceof VoiceMaterializationV4Error && error.code === 'MEASURE_COVERAGE_UNPROVEN'
  );
});
