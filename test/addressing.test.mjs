import test from 'node:test';
import assert from 'node:assert/strict';

import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import {
  AddressingError,
  addressEntity,
  createSelectionSnapshot,
  createSemanticAddressIndex,
  resolveSemanticAddress
} from '../dist/packages/addressing/src/index.js';

const makeDocument = (revisionId = 'rev-1') => createScoreDocument({
  schemaVersion: '1.0.0',
  id: 'doc-1',
  revision: { id: revisionId, parentId: revisionId === 'rev-1' ? null : 'rev-1' },
  source: { sha256: 'a'.repeat(64), format: 'canonical', byteLength: null },
  parts: [{
    id: 'part-1',
    name: 'Piano',
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
          events: [{
            id: 'event-1',
            kind: 'chord',
            onset: { numerator: 0, denominator: 1 },
            duration: { numerator: 1, denominator: 4 },
            notes: [
              { id: 'note-1', pitch: { step: 'C', alter: 0, octave: 4 } },
              { id: 'note-2', pitch: { step: 'E', alter: 0, octave: 4 } }
            ]
          }]
        }]
      }]
    }]
  }]
});

test('entity index produces ancestry-complete revision-bound note address', () => {
  const document = makeDocument();
  const address = addressEntity(document, 'note-2');
  assert.deepEqual(address, {
    contractVersion: '1.0.0',
    kind: 'note',
    documentId: 'doc-1',
    revisionId: 'rev-1',
    partId: 'part-1',
    staffId: 'staff-1',
    measureId: 'measure-1',
    voiceId: 'voice-1',
    eventId: 'event-1',
    noteId: 'note-2'
  });
  assert.equal(Object.isFrozen(address), true);
  const resolved = resolveSemanticAddress(document, address);
  assert.equal(resolved.kind, 'note');
  assert.equal(resolved.value.id, 'note-2');
});

test('address index covers document and every stable entity id exactly once', () => {
  const index = createSemanticAddressIndex(makeDocument());
  assert.deepEqual([...index.byEntityId.keys()].sort(), [
    'doc-1','event-1','measure-1','note-1','note-2','part-1','staff-1','voice-1'
  ]);
});

test('stale revision selection fails closed before target resolution', () => {
  const oldDocument = makeDocument('rev-1');
  const newDocument = makeDocument('rev-2');
  const oldAddress = addressEntity(oldDocument, 'event-1');
  assert.throws(
    () => resolveSemanticAddress(newDocument, oldAddress),
    (error) => error instanceof AddressingError && error.code === 'STALE_REVISION'
  );
});

test('wrong ancestry cannot redirect a valid event id', () => {
  const document = makeDocument();
  const valid = addressEntity(document, 'event-1');
  const forged = { ...valid, staffId: 'staff-other' };
  assert.throws(
    () => resolveSemanticAddress(document, forged),
    (error) => error instanceof AddressingError && error.code === 'ADDRESS_PATH_MISMATCH'
  );
});

test('selection snapshot is immutable and revision-bound', () => {
  const document = makeDocument();
  const selection = createSelectionSnapshot(document, addressEntity(document, 'note-1'));
  assert.equal(selection.documentId, 'doc-1');
  assert.equal(selection.revisionId, 'rev-1');
  assert.equal(selection.primary.noteId, 'note-1');
  assert.equal(Object.isFrozen(selection), true);
});
