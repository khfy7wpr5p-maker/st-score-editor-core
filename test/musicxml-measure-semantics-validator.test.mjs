import test from 'node:test';
import assert from 'node:assert/strict';

import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { addressEntity } from '../dist/packages/addressing/src/index.js';
import {
  createMusicXmlMeasureSemanticsDocument,
  MusicXmlMeasureSemanticsError
} from '../dist/packages/musicxml-measure-semantics/src/index.js';

const score = createScoreDocument({
  schemaVersion: '1.0.0',
  id: 'doc-measure-evidence-validator',
  revision: { id: 'rev-1', parentId: null },
  source: { sha256: '2'.repeat(64), format: 'synthetic', byteLength: null },
  parts: [{
    id: 'part-1',
    name: 'Piano',
    staves: [{
      id: 'staff-1',
      ordinal: 1,
      measures: [
        { id: 'measure-1', ordinal: 1, displayNumber: '1', voices: [{ id: 'voice-1', ordinal: 1, events: [] }] },
        { id: 'measure-2', ordinal: 2, displayNumber: '2', voices: [{ id: 'voice-2', ordinal: 1, events: [] }] }
      ]
    }]
  }]
});

const target = (id) => {
  const address = addressEntity(score, id);
  assert.equal(address.kind, 'measure');
  return address;
};

const entry = (measureId, sourceMeasureIndex, overrides = {}) => ({
  target: target(measureId),
  sourcePartId: 'P1',
  sourceMeasureIndex,
  sourceStaffOrdinal: 1,
  sourceMeasureNumber: String(sourceMeasureIndex + 1),
  implicit: null,
  nonControlling: null,
  declaredTimeSignature: sourceMeasureIndex === 0 ? { beats: 4, beatType: 4 } : null,
  effectiveTimeSignature: { beats: 4, beatType: 4 },
  timeSignatureSource: sourceMeasureIndex === 0 ? 'DECLARED_HERE' : 'INHERITED',
  cursorOperations: [],
  ...overrides
});

const document = (measures) => ({
  contractVersion: '1.0.0',
  documentId: score.id,
  revisionId: score.revision.id,
  measures
});

test('measure evidence validator independently accepts a consistent declared/inherited meter chain', () => {
  const result = createMusicXmlMeasureSemanticsDocument(score, document([
    entry('measure-1', 0),
    entry('measure-2', 1)
  ]));
  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(result.measures[1].effectiveTimeSignature, { beats: 4, beatType: 4 });
});

test('measure evidence validator rejects forged forward and backup cursor arithmetic', () => {
  for (const operation of [
    {
      sourceOrder: 1,
      kind: 'forward',
      duration: { numerator: 1, denominator: 4 },
      cursorBefore: { numerator: 0, denominator: 1 },
      cursorAfter: { numerator: 1, denominator: 2 }
    },
    {
      sourceOrder: 1,
      kind: 'backup',
      duration: { numerator: 1, denominator: 4 },
      cursorBefore: { numerator: 1, denominator: 2 },
      cursorAfter: { numerator: 1, denominator: 2 }
    }
  ]) {
    assert.throws(
      () => createMusicXmlMeasureSemanticsDocument(score, document([
        entry('measure-1', 0, { cursorOperations: [operation] }),
        entry('measure-2', 1)
      ])),
      (error) => error instanceof MusicXmlMeasureSemanticsError && error.code === 'INVALID_EVIDENCE' && /arithmetic/.test(error.message)
    );
  }
});

test('backup cursor evidence cannot move before measure start', () => {
  assert.throws(
    () => createMusicXmlMeasureSemanticsDocument(score, document([
      entry('measure-1', 0, {
        cursorOperations: [{
          sourceOrder: 1,
          kind: 'backup',
          duration: { numerator: 1, denominator: 2 },
          cursorBefore: { numerator: 1, denominator: 4 },
          cursorAfter: { numerator: 0, denominator: 1 }
        }]
      }),
      entry('measure-2', 1)
    ])),
    (error) => error instanceof MusicXmlMeasureSemanticsError && error.code === 'INVALID_EVIDENCE'
  );
});

test('inherited meter must equal the active declared meter for the same source part and staff', () => {
  assert.throws(
    () => createMusicXmlMeasureSemanticsDocument(score, document([
      entry('measure-1', 0),
      entry('measure-2', 1, { effectiveTimeSignature: { beats: 3, beatType: 4 } })
    ])),
    (error) => error instanceof MusicXmlMeasureSemanticsError && error.code === 'INVALID_EVIDENCE' && /active source meter/.test(error.message)
  );
});

test('unknown meter cannot follow a known active meter in the same source part and staff', () => {
  assert.throws(
    () => createMusicXmlMeasureSemanticsDocument(score, document([
      entry('measure-1', 0),
      entry('measure-2', 1, {
        declaredTimeSignature: null,
        effectiveTimeSignature: null,
        timeSignatureSource: 'UNKNOWN'
      })
    ])),
    (error) => error instanceof MusicXmlMeasureSemanticsError && error.code === 'INVALID_EVIDENCE' && /known active source meter/.test(error.message)
  );
});

test('two canonical targets cannot claim the same source part/staff/measure identity', () => {
  assert.throws(
    () => createMusicXmlMeasureSemanticsDocument(score, document([
      entry('measure-1', 0),
      entry('measure-2', 0)
    ])),
    (error) => error instanceof MusicXmlMeasureSemanticsError && error.code === 'INVALID_EVIDENCE' && /duplicate source measure/.test(error.message)
  );
});
