import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  openMusicXmlScoreEditorAppDocument,
  selectAppSemanticAddress
} from '../dist/packages/score-editor-app-document/src/index.js';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';

const fixturePath = new URL('../corpus/fixtures/p05-synthetic-teacher-edit.musicxml', import.meta.url);

test('P05 Task 2 fixture exposes exactly one canonical trailing rest and selecting it is presentation-only', async () => {
  const xml = await readFile(fixturePath, 'utf8');
  const document = await openMusicXmlScoreEditorAppDocument(xml, {
    title: 'P05 synthetic teacher edit',
    sha256Hex: async () => 'a'.repeat(64),
    documentId: 'doc:p05:task2:rest-selection',
    revisionId: 'rev:p05:task2:rest-selection'
  });

  const score = document.session.history.present.score;
  const rests = [];
  for (const part of score.parts) {
    for (const staff of part.staves ?? []) {
      if (staff.role === 'tablature-linked') continue;
      for (const measure of staff.measures ?? []) {
        for (const voice of measure.voices ?? []) {
          for (const event of voice.events ?? []) {
            if (event.kind === 'rest') rests.push(event.id);
          }
        }
      }
    }
  }

  assert.equal(rests.length, 1);
  const restAddress = addressEntityV3(score, rests[0]);
  assert.equal(restAddress.kind, 'event');

  const beforeRevision = document.session.history.present.score.revision.id;
  const beforePast = document.session.history.past.length;
  const beforeFuture = document.session.history.future.length;
  const selected = selectAppSemanticAddress(document, restAddress);

  assert.equal(selected.session.selection?.kind, 'event');
  assert.equal(selected.session.selection?.eventId, rests[0]);
  assert.equal(selected.session.history.present.score.revision.id, beforeRevision);
  assert.equal(selected.session.history.past.length, beforePast);
  assert.equal(selected.session.history.future.length, beforeFuture);
});
