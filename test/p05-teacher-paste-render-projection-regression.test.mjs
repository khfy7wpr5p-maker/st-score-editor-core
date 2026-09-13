import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createTeacherCopySnapshotV4 } from '../dist/packages/editor-teacher-copy-snapshot-v4/src/index.js';
import { createTeacherEventSpanSelectionV4 } from '../dist/packages/editor-teacher-event-span-v4/src/index.js';
import { planTeacherPasteIdentitiesV4 } from '../dist/packages/editor-teacher-paste-identity-plan-v4/src/index.js';
import { analyzeTeacherPasteDestinationV4 } from '../dist/packages/editor-teacher-paste-admission-v4/src/index.js';
import { importNotationMusicXmlV2 } from '../dist/packages/musicxml-v2/src/index.js';
import {
  commitAppTeacherPasteOverwrite,
  navigateAppDocumentHistory,
  openMusicXmlScoreEditorAppDocument
} from '../dist/packages/score-editor-app-document/src/index.js';

const fixturePath = 'corpus/fixtures/p05-synthetic-teacher-edit.musicxml';
const sha256 = async value => createHash('sha256').update(new TextEncoder().encode(value)).digest('hex');

const standardVoice = score => {
  const staves = score.parts[0]?.staves ?? [];
  const staff = staves.find(candidate => candidate.role === 'standard') ?? staves[0];
  assert.ok(staff, 'expected a standard staff');
  const voice = staff.measures[0]?.voices[0];
  assert.ok(voice, 'expected the first standard voice');
  return voice;
};

const projectVoice = musicXml => {
  assert.equal(typeof musicXml, 'string');
  const bytes = new TextEncoder().encode(musicXml);
  const parsed = importNotationMusicXmlV2(musicXml, {
    source: {
      sha256: 'b'.repeat(64),
      format: 'musicxml',
      byteLength: bytes.byteLength
    },
    documentId: 'doc:p05-render-projection-reimport',
    revisionId: 'rev:p05-render-projection-reimport'
  });
  return standardVoice(parsed.score).events.map(event => event.kind === 'rest'
    ? { kind: 'rest', duration: event.duration }
    : { kind: event.kind, pitch: event.kind === 'note' ? event.note.pitch : null, duration: event.duration });
};

const assertRenderableRequest = (request, expectedRevisionId) => {
  assert.equal(request.revisionId, expectedRevisionId);
  assert.equal(request.projectionStatus, 'V3_COMPATIBLE_XML');
  assert.equal(request.sourceProjectionStatus, 'V2_COMPATIBLE_XML');
  assert.equal(typeof request.musicXml, 'string');
};

test('P05 teacher paste and undo preserve renderable ORIGINAL -> C-D-C-D -> ORIGINAL MusicXML', async () => {
  const xml = await readFile(fixturePath, 'utf8');
  const original = await openMusicXmlScoreEditorAppDocument(xml, {
    documentId: 'doc:p05-teacher-paste-render-projection',
    revisionId: 'rev:p05-teacher-paste-render-projection:saved',
    title: 'P05 teacher paste render projection regression',
    sha256Hex: sha256
  });
  const originalPresent = original.session.history.present;
  const originalVoice = standardVoice(originalPresent.score);
  const [sourceFirst, sourceSecond, destinationRest] = originalVoice.events;
  assert.equal(sourceFirst?.kind, 'note');
  assert.equal(sourceSecond?.kind, 'note');
  assert.equal(destinationRest?.kind, 'rest');

  assertRenderableRequest(original.session.renderRequest, originalPresent.score.revision.id);
  assert.deepEqual(projectVoice(original.session.renderRequest.musicXml), [
    { kind: 'note', pitch: { step: 'C', alter: 0, octave: 4 }, duration: { numerator: 1, denominator: 4 } },
    { kind: 'note', pitch: { step: 'D', alter: 0, octave: 4 }, duration: { numerator: 1, denominator: 4 } },
    { kind: 'rest', duration: { numerator: 1, denominator: 2 } }
  ]);

  const selection = createTeacherEventSpanSelectionV4(
    originalPresent.score,
    addressEntityV3(originalPresent.score, sourceFirst.id),
    addressEntityV3(originalPresent.score, sourceSecond.id)
  );
  const snapshot = createTeacherCopySnapshotV4(originalPresent.score, originalPresent.notation, selection);
  const admission = analyzeTeacherPasteDestinationV4(
    originalPresent.score,
    originalPresent.notation,
    snapshot,
    addressEntityV3(originalPresent.score, destinationRest.id)
  );
  const pastedRevisionId = 'rev:p05-teacher-paste-render-projection:pasted';
  const identities = planTeacherPasteIdentitiesV4(
    originalPresent.score,
    originalPresent.notation,
    snapshot,
    admission,
    pastedRevisionId
  );
  const pasted = commitAppTeacherPasteOverwrite(original, snapshot, admission, identities);

  assertRenderableRequest(pasted.session.renderRequest, pastedRevisionId);
  assert.deepEqual(projectVoice(pasted.session.renderRequest.musicXml), [
    { kind: 'note', pitch: { step: 'C', alter: 0, octave: 4 }, duration: { numerator: 1, denominator: 4 } },
    { kind: 'note', pitch: { step: 'D', alter: 0, octave: 4 }, duration: { numerator: 1, denominator: 4 } },
    { kind: 'note', pitch: { step: 'C', alter: 0, octave: 4 }, duration: { numerator: 1, denominator: 4 } },
    { kind: 'note', pitch: { step: 'D', alter: 0, octave: 4 }, duration: { numerator: 1, denominator: 4 } }
  ]);

  const undone = navigateAppDocumentHistory(pasted, 'UNDO');
  assert.deepEqual(undone.session.history.present, originalPresent, 'Undo must restore the exact original score and notation snapshot');
  assertRenderableRequest(undone.session.renderRequest, originalPresent.score.revision.id);
  assert.deepEqual(projectVoice(undone.session.renderRequest.musicXml), [
    { kind: 'note', pitch: { step: 'C', alter: 0, octave: 4 }, duration: { numerator: 1, denominator: 4 } },
    { kind: 'note', pitch: { step: 'D', alter: 0, octave: 4 }, duration: { numerator: 1, denominator: 4 } },
    { kind: 'rest', duration: { numerator: 1, denominator: 2 } }
  ]);
});
