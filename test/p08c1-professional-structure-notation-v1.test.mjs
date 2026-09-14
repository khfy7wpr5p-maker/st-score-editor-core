import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { emptyNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import {
  ProfessionalStructureNotationV1Error,
  executeProfessionalStructureNotationV1
} from '../dist/packages/editor-professional-structure-notation-v1/src/index.js';
import {
  commitSessionProfessionalStructureNotationV1
} from '../dist/packages/editor-session-professional-structure-notation-v1/src/index.js';
import {
  createEditorSessionV4,
  navigateSessionHistoryV4
} from '../dist/packages/editor-session-controller-v4/src/index.js';

const q = (n, d) => ({ numerator: n, denominator: d });
const scoreFixture = () => createScoreDocumentV3({
  schemaVersion: '3.0.0',
  id: 'p08c1-score',
  revision: { id: 'p08c1-rev-1', parentId: null },
  source: { sha256: 'd'.repeat(64), format: 'synthetic', byteLength: null },
  measureFrames: [
    { id: 'frame-1', ordinal: 1, displayNumber: '1' },
    { id: 'frame-2', ordinal: 2, displayNumber: '2' }
  ],
  parts: [{
    id: 'part-1',
    ordinal: 1,
    name: 'Piano',
    instrument: { id: 'instrument-1', name: 'Piano', shortName: 'Pno.' },
    staves: [{
      id: 'staff-1',
      ordinal: 1,
      role: 'standard',
      measures: [
        {
          id: 'measure-1',
          frameId: 'frame-1',
          voices: [{
            id: 'voice-1',
            ordinal: 1,
            graceGroups: [],
            events: [{
              id: 'event-1',
              kind: 'note',
              onset: q(0, 1),
              duration: q(1, 1),
              note: { id: 'note-1', pitch: { step: 'C', alter: 0, octave: 4 } }
            }]
          }]
        },
        {
          id: 'measure-2',
          frameId: 'frame-2',
          voices: [{
            id: 'voice-2',
            ordinal: 1,
            graceGroups: [],
            events: [{
              id: 'event-2',
              kind: 'rest',
              onset: q(0, 1),
              duration: q(1, 1)
            }]
          }]
        }
      ]
    }]
  }]
});

const measureAddress = (score, id) => {
  const address = addressEntityV3(score, id);
  assert.equal(address.kind, 'measure');
  return address;
};

const measureNotation = (notation, id) => notation.measures.find(entry => entry.target.measureId === id)?.notation ?? null;

test('P08-C1 SET_KEY_SIGNATURE creates one notation-only history revision and Undo restores exact snapshot', () => {
  const score = scoreFixture();
  const notation = emptyNotationDocumentV4(score);
  const originalScore = structuredClone(score);
  const originalNotation = structuredClone(notation);
  const session = createEditorSessionV4(score, notation);
  const result = commitSessionProfessionalStructureNotationV1(
    session,
    {
      version: '1.0.0',
      type: 'SET_KEY_SIGNATURE',
      target: measureAddress(score, 'measure-1'),
      value: { fifths: 3 }
    },
    { nextRevisionId: 'p08c1-rev-key' }
  );

  assert.equal(result.historyCommitCount, 1);
  assert.equal(result.historyAuthority, 'EditorHistoryV4');
  assert.equal(result.session.history.present.score.revision.id, 'p08c1-rev-key');
  assert.equal(result.session.history.present.score.revision.parentId, 'p08c1-rev-1');
  assert.deepEqual(result.session.history.present.score.parts, originalScore.parts);
  assert.deepEqual(result.session.history.present.score.measureFrames, originalScore.measureFrames);
  assert.deepEqual(measureNotation(result.session.history.present.notation, 'measure-1'), {
    keySignature: { fifths: 3 },
    clef: null
  });
  assert.equal(result.session.selection.kind, 'measure');
  assert.equal(result.session.selection.measureId, 'measure-1');
  assert.equal(result.session.selection.revisionId, 'p08c1-rev-key');

  const undone = navigateSessionHistoryV4(result.session, 'UNDO');
  assert.deepEqual(undone.history.present.score, originalScore);
  assert.deepEqual(undone.history.present.notation, originalNotation);
  const redone = navigateSessionHistoryV4(undone, 'REDO');
  assert.deepEqual(redone.history.present.score, result.session.history.present.score);
  assert.deepEqual(redone.history.present.notation, result.session.history.present.notation);
});

test('P08-C1 SET_CLEF preserves the existing key signature and creates the next direct-child revision', () => {
  const score = scoreFixture();
  const notation = emptyNotationDocumentV4(score);
  const first = commitSessionProfessionalStructureNotationV1(
    createEditorSessionV4(score, notation),
    {
      version: '1.0.0',
      type: 'SET_KEY_SIGNATURE',
      target: measureAddress(score, 'measure-1'),
      value: { fifths: -2 }
    },
    { nextRevisionId: 'p08c1-rev-key-first' }
  );
  const currentScore = first.session.history.present.score;
  const second = commitSessionProfessionalStructureNotationV1(
    first.session,
    {
      version: '1.0.0',
      type: 'SET_CLEF',
      target: measureAddress(currentScore, 'measure-1'),
      value: { sign: 'F', line: 4, octaveChange: 0 }
    },
    { nextRevisionId: 'p08c1-rev-clef-second' }
  );

  assert.equal(second.session.history.past.length, 2);
  assert.equal(second.session.history.present.score.revision.parentId, 'p08c1-rev-key-first');
  assert.deepEqual(measureNotation(second.session.history.present.notation, 'measure-1'), {
    keySignature: { fifths: -2 },
    clef: { sign: 'F', line: 4, octaveChange: 0 }
  });
});

test('P08-C1 rejects no-op key/clef edits instead of polluting history', () => {
  const score = scoreFixture();
  const notation = emptyNotationDocumentV4(score);
  const first = executeProfessionalStructureNotationV1(
    score,
    notation,
    {
      version: '1.0.0',
      type: 'SET_CLEF',
      target: measureAddress(score, 'measure-1'),
      value: { sign: 'G', line: 2, octaveChange: 0 }
    },
    { nextRevisionId: 'p08c1-noop-base' }
  );

  assert.throws(
    () => executeProfessionalStructureNotationV1(
      first.score,
      first.notation,
      {
        version: '1.0.0',
        type: 'SET_CLEF',
        target: measureAddress(first.score, 'measure-1'),
        value: { sign: 'G', line: 2, octaveChange: 0 }
      },
      { nextRevisionId: 'p08c1-noop-rejected' }
    ),
    error => error instanceof ProfessionalStructureNotationV1Error && error.code === 'NO_CHANGE'
  );
});

test('P08-C1 fails closed when a measure target belongs to an older revision', () => {
  const score = scoreFixture();
  const notation = emptyNotationDocumentV4(score);
  const stale = measureAddress(score, 'measure-1');
  const raw = structuredClone(score);
  raw.revision = { id: 'p08c1-newer', parentId: score.revision.id };
  const newer = createScoreDocumentV3(raw);
  const newerNotation = emptyNotationDocumentV4(newer);

  assert.throws(
    () => executeProfessionalStructureNotationV1(
      newer,
      newerNotation,
      { version: '1.0.0', type: 'SET_KEY_SIGNATURE', target: stale, value: { fifths: 1 } },
      { nextRevisionId: 'p08c1-after-stale' }
    ),
    error => error instanceof ProfessionalStructureNotationV1Error && error.code === 'STALE_TARGET'
  );
});
