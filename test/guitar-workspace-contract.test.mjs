import test from 'node:test';
import assert from 'node:assert/strict';
import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { addressEntity } from '../dist/packages/addressing/src/index.js';
import {
  createGuitarWorkspaceSourceMap,
  guitarWorkspaceAuthorityProfile,
  GuitarWorkspaceContractError
} from '../dist/packages/guitar-workspace-contract/src/index.js';

const scoreInput = (revisionId = 'rev-e8a-1') => ({
  schemaVersion: '1.0.0',
  id: 'doc-e8a-1',
  revision: { id: revisionId, parentId: null },
  source: { sha256: '8'.repeat(64), format: 'synthetic', byteLength: null },
  parts: [{
    id: 'part-1',
    name: 'Guitar Workspace Fixture',
    staves: [{
      id: 'staff-1',
      ordinal: 1,
      measures: [{
        id: 'measure-1',
        ordinal: 1,
        displayNumber: '1',
        voices: [{
          id: 'voice-1',
          ordinal: 1,
          events: [
            {
              id: 'event-note-1',
              kind: 'note',
              onset: { numerator: 0, denominator: 1 },
              duration: { numerator: 1, denominator: 4 },
              note: { id: 'note-1', pitch: { step: 'E', alter: 0, octave: 4 } }
            },
            {
              id: 'event-chord-1',
              kind: 'chord',
              onset: { numerator: 1, denominator: 4 },
              duration: { numerator: 1, denominator: 4 },
              notes: [
                { id: 'note-2', pitch: { step: 'G', alter: 0, octave: 4 } },
                { id: 'note-3', pitch: { step: 'B', alter: 0, octave: 4 } }
              ]
            },
            {
              id: 'event-rest-1',
              kind: 'rest',
              onset: { numerator: 1, denominator: 2 },
              duration: { numerator: 1, denominator: 4 }
            }
          ]
        }]
      }]
    }]
  }]
});

const expectContractError = (fn, code) => {
  assert.throws(fn, (error) => error instanceof GuitarWorkspaceContractError && error.code === code);
};

test('E8-A authority profile keeps guitar state derivative and non-authoritative', () => {
  assert.equal(guitarWorkspaceAuthorityProfile.derivativeStateOnly, true);
  assert.equal(guitarWorkspaceAuthorityProfile.sourceRevisionRequired, true);
  assert.equal(guitarWorkspaceAuthorityProfile.sourceMapRequired, true);
  assert.equal(guitarWorkspaceAuthorityProfile.staleSourceFailsClosed, true);
  assert.equal(guitarWorkspaceAuthorityProfile.engineOutputCanonicalAuthority, false);
  assert.equal(guitarWorkspaceAuthorityProfile.engineOutputScoreMutationAuthority, false);
  assert.equal(guitarWorkspaceAuthorityProfile.reverseWriteToCanonicalAllowed, false);
  assert.equal(guitarWorkspaceAuthorityProfile.rendererStateAuthoritative, false);
  assert.equal(guitarWorkspaceAuthorityProfile.teacherReviewMayMutateCanonical, false);
  assert.equal(guitarWorkspaceAuthorityProfile.productionAuthority, false);
  assert.equal(Object.isFrozen(guitarWorkspaceAuthorityProfile), true);
});

test('E8-A creates a frozen one-to-one revision-bound engine source map', () => {
  const score = createScoreDocument(scoreInput());
  const sourceMap = createGuitarWorkspaceSourceMap(score, [
    { sourceEventId: 'P1:measure:0:note:0', target: addressEntity(score, 'note-1') },
    { sourceEventId: 'P1:measure:0:note:1', target: addressEntity(score, 'note-2') },
    { sourceEventId: 'P1:measure:0:note:2', target: addressEntity(score, 'note-3') },
    { sourceEventId: 'P1:measure:0:note:3', target: addressEntity(score, 'event-rest-1') }
  ]);

  assert.equal(sourceMap.contractVersion, '1.0.0');
  assert.equal(sourceMap.authority, 'DERIVATIVE_TRACEABILITY_ONLY');
  assert.equal(sourceMap.documentId, score.id);
  assert.equal(sourceMap.revisionId, score.revision.id);
  assert.deepEqual(sourceMap.entries.map((entry) => entry.target.kind), ['note', 'note', 'note', 'event']);
  assert.equal(Object.isFrozen(sourceMap), true);
  assert.equal(Object.isFrozen(sourceMap.entries), true);
  assert.equal(sourceMap.entries.every((entry) => Object.isFrozen(entry) && Object.isFrozen(entry.target)), true);
});

test('E8-A rejects duplicate engine identities and duplicate canonical targets', () => {
  const score = createScoreDocument(scoreInput());
  const note = addressEntity(score, 'note-1');

  expectContractError(() => createGuitarWorkspaceSourceMap(score, [
    { sourceEventId: 'P1:measure:0:note:0', target: note },
    { sourceEventId: 'P1:measure:0:note:0', target: addressEntity(score, 'note-2') }
  ]), 'DUPLICATE_SOURCE_EVENT_ID');

  expectContractError(() => createGuitarWorkspaceSourceMap(score, [
    { sourceEventId: 'P1:measure:0:note:0', target: note },
    { sourceEventId: 'P1:measure:0:note:1', target: note }
  ]), 'DUPLICATE_CANONICAL_TARGET');
});

test('E8-A rejects stale and unsupported semantic targets fail closed', () => {
  const score = createScoreDocument(scoreInput());
  const staleScore = createScoreDocument({
    ...scoreInput('rev-e8a-2'),
    revision: { id: 'rev-e8a-2', parentId: 'rev-e8a-1' }
  });

  expectContractError(() => createGuitarWorkspaceSourceMap(staleScore, [
    { sourceEventId: 'P1:measure:0:note:0', target: addressEntity(score, 'note-1') }
  ]), 'SOURCE_REVISION_MISMATCH');

  expectContractError(() => createGuitarWorkspaceSourceMap(score, [
    { sourceEventId: 'P1:measure:0:note:0', target: addressEntity(score, 'measure-1') }
  ]), 'INVALID_SOURCE_MAP_ENTRY');
});

test('E8-A rejects unknown source-map entry fields', () => {
  const score = createScoreDocument(scoreInput());
  expectContractError(() => createGuitarWorkspaceSourceMap(score, [{
    sourceEventId: 'P1:measure:0:note:0',
    target: addressEntity(score, 'note-1'),
    coordinates: { x: 1, y: 2 }
  }]), 'INVALID_SOURCE_MAP_ENTRY');
});
