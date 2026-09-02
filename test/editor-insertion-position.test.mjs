import test from 'node:test';
import assert from 'node:assert/strict';

import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { addressEntity } from '../dist/packages/addressing/src/index.js';
import {
  createInsertionPosition,
  parseInsertionPosition,
  resolveInsertionPosition,
  InsertionPositionError
} from '../dist/packages/editor-insertion-position/src/index.js';

const makeDocument = (revisionId = 'rev-1', parentId = null) => createScoreDocument({
  schemaVersion: '1.0.0',
  id: 'doc-insertion',
  revision: { id: revisionId, parentId },
  source: { sha256: 'd'.repeat(64), format: 'synthetic', byteLength: null },
  parts: [{
    id: 'part-1', name: 'Piano', staves: [{
      id: 'staff-1', ordinal: 1, measures: [{
        id: 'measure-1', ordinal: 1, displayNumber: '1', voices: [{
          id: 'voice-1', ordinal: 1, events: [
            {
              id: 'event-1', kind: 'rest',
              onset: { numerator: 0, denominator: 1 },
              duration: { numerator: 1, denominator: 1 }
            }
          ]
        }]
      }]
    }]
  }]
});

test('creates and resolves a canonical insertion position against an exact voice path', () => {
  const score = makeDocument();
  const voice = addressEntity(score, 'voice-1');
  assert.equal(voice.kind, 'voice');

  const position = createInsertionPosition(score, voice, { numerator: 3, denominator: 4 });

  assert.deepEqual(position, {
    contractVersion: '1.0.0',
    documentId: 'doc-insertion',
    revisionId: 'rev-1',
    partId: 'part-1',
    staffId: 'staff-1',
    measureId: 'measure-1',
    voiceId: 'voice-1',
    onset: { numerator: 3, denominator: 4 }
  });
  assert.equal(Object.isFrozen(position), true);
  assert.equal(Object.isFrozen(position.onset), true);

  const resolved = resolveInsertionPosition(score, position);
  assert.equal(resolved.voice.id, 'voice-1');
  assert.equal(resolved.position.onset.numerator, 3);
});

test('zero onset is admitted but non-canonical and negative rational values are rejected', () => {
  const score = makeDocument();
  const voice = addressEntity(score, 'voice-1');
  assert.equal(voice.kind, 'voice');
  assert.equal(createInsertionPosition(score, voice, { numerator: 0, denominator: 1 }).onset.numerator, 0);

  assert.throws(
    () => createInsertionPosition(score, voice, { numerator: 2, denominator: 4 }),
    (error) => error instanceof InsertionPositionError && error.code === 'INVALID_POSITION'
  );
  assert.throws(
    () => parseInsertionPosition({
      contractVersion: '1.0.0', documentId: score.id, revisionId: score.revision.id,
      partId: 'part-1', staffId: 'staff-1', measureId: 'measure-1', voiceId: 'voice-1',
      onset: { numerator: -1, denominator: 4 }
    }),
    (error) => error instanceof InsertionPositionError && error.code === 'INVALID_POSITION'
  );
});

test('an insertion position cannot be replayed onto a newer score revision', () => {
  const base = makeDocument();
  const voice = addressEntity(base, 'voice-1');
  assert.equal(voice.kind, 'voice');
  const position = createInsertionPosition(base, voice, { numerator: 1, denominator: 2 });
  const next = makeDocument('rev-2', 'rev-1');

  assert.throws(
    () => resolveInsertionPosition(next, position),
    (error) => error instanceof InsertionPositionError && error.code === 'STALE_POSITION'
  );
});

test('document and voice path mismatches fail closed', () => {
  const score = makeDocument();
  const foreign = {
    contractVersion: '1.0.0', documentId: 'other-document', revisionId: score.revision.id,
    partId: 'part-1', staffId: 'staff-1', measureId: 'measure-1', voiceId: 'voice-1',
    onset: { numerator: 1, denominator: 4 }
  };
  assert.throws(
    () => resolveInsertionPosition(score, foreign),
    (error) => error instanceof InsertionPositionError && error.code === 'DOCUMENT_MISMATCH'
  );

  const wrongVoice = {
    ...foreign,
    documentId: score.id,
    voiceId: 'missing-voice'
  };
  assert.throws(
    () => resolveInsertionPosition(score, wrongVoice),
    (error) => error instanceof InsertionPositionError && error.code === 'VOICE_PATH_MISMATCH'
  );
});

test('position contract does not infer gap safety or mutate score state', () => {
  const score = makeDocument();
  const voice = addressEntity(score, 'voice-1');
  assert.equal(voice.kind, 'voice');

  const position = createInsertionPosition(score, voice, { numerator: 9, denominator: 4 });
  assert.deepEqual(position.onset, { numerator: 9, denominator: 4 });
  assert.equal(score.revision.id, 'rev-1');
  assert.equal(score.parts[0].staves[0].measures[0].voices[0].events.length, 1);
});
