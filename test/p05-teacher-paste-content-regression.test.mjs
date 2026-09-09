import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { openMusicXmlScoreEditorAppDocument, commitAppTeacherPasteOverwrite } from '../dist/packages/score-editor-app-document/src/index.js';
import { createTeacherEventSpanSelectionV4 } from '../dist/packages/editor-teacher-event-span-v4/src/index.js';
import { createTeacherCopySnapshotV4 } from '../dist/packages/editor-teacher-copy-snapshot-v4/src/index.js';
import { analyzeTeacherPasteDestinationV4 } from '../dist/packages/editor-teacher-paste-admission-v4/src/index.js';
import { planTeacherPasteIdentitiesV4 } from '../dist/packages/editor-teacher-paste-identity-plan-v4/src/index.js';

const fixturePath = 'corpus/fixtures/p05-synthetic-teacher-edit.musicxml';
const sha256 = async value => createHash('sha256').update(new TextEncoder().encode(value)).digest('hex');

const standardVoice = score => {
  const staff = score.parts[0]?.staves.find(candidate => candidate.role === 'standard');
  assert.ok(staff, 'expected a standard staff');
  const voice = staff.measures[0]?.voices[0];
  assert.ok(voice, 'expected the first standard voice');
  return voice;
};

test('P05-CORPUS02 teacher paste writes copied note semantics before undo', async () => {
  const xml = await readFile(fixturePath, 'utf8');
  const document = await openMusicXmlScoreEditorAppDocument(xml, {
    documentId: 'doc:p05-teacher-paste-content-regression',
    revisionId: 'rev:p05-teacher-paste-content-regression:saved',
    title: 'P05 teacher paste content regression',
    sha256Hex: sha256
  });

  const score = document.session.history.present.score;
  const notation = document.session.history.present.notation;
  const voice = standardVoice(score);
  assert.equal(voice.events.length, 3);

  const sourceFirst = voice.events[0];
  const sourceSecond = voice.events[1];
  const destinationRest = voice.events[2];
  assert.equal(sourceFirst?.kind, 'note');
  assert.equal(sourceSecond?.kind, 'note');
  assert.equal(destinationRest?.kind, 'rest');

  const selection = createTeacherEventSpanSelectionV4(
    score,
    addressEntityV3(score, sourceFirst.id),
    addressEntityV3(score, sourceSecond.id)
  );
  const snapshot = createTeacherCopySnapshotV4(score, notation, selection);
  const admission = analyzeTeacherPasteDestinationV4(
    score,
    notation,
    snapshot,
    addressEntityV3(score, destinationRest.id)
  );
  const identities = planTeacherPasteIdentitiesV4(
    score,
    notation,
    snapshot,
    admission,
    'rev:p05-teacher-paste-content-regression:pasted'
  );
  const pasted = commitAppTeacherPasteOverwrite(document, snapshot, admission, identities);

  assert.equal(pasted.session.history.past.length, 1, 'paste must remain one history revision');
  const pastedVoice = standardVoice(pasted.session.history.present.score);
  assert.equal(pastedVoice.events.length, 4, 'the trailing half-rest must be replaced by two copied quarter-note events');

  const pastedFirst = pastedVoice.events.find(event => event.id === identities.events[0]?.destinationEventId);
  const pastedSecond = pastedVoice.events.find(event => event.id === identities.events[1]?.destinationEventId);
  assert.ok(pastedFirst, 'first planned pasted event must exist');
  assert.ok(pastedSecond, 'second planned pasted event must exist');
  assert.equal(pastedFirst.kind, 'note');
  assert.equal(pastedSecond.kind, 'note');

  assert.deepEqual(pastedFirst.duration, sourceFirst.duration, 'first pasted duration must match copied source');
  assert.deepEqual(pastedSecond.duration, sourceSecond.duration, 'second pasted duration must match copied source');
  assert.deepEqual(pastedFirst.note.pitch, sourceFirst.note.pitch, 'first pasted pitch must match copied source');
  assert.deepEqual(pastedSecond.note.pitch, sourceSecond.note.pitch, 'second pasted pitch must match copied source');
  assert.equal(pastedFirst.note.id, identities.events[0]?.notes[0]?.destinationNoteId, 'first pasted note must use the deterministic planned identity');
  assert.equal(pastedSecond.note.id, identities.events[1]?.notes[0]?.destinationNoteId, 'second pasted note must use the deterministic planned identity');
});
