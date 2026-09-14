import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4, emptyNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import {
  ProfessionalFrameBarlinesV1Error,
  executeProfessionalFrameBarlinesV1
} from '../dist/packages/editor-professional-frame-barlines-v1/src/index.js';
import { commitSessionProfessionalFrameBarlinesV1 } from '../dist/packages/editor-session-professional-frame-barlines-v1/src/index.js';
import { createEditorSessionV4, navigateSessionHistoryV4 } from '../dist/packages/editor-session-controller-v4/src/index.js';

const scoreFixture = () => createScoreDocumentV3({
  schemaVersion: '3.0.0',
  id: 'p08c3-score',
  revision: { id: 'p08c3-rev-1', parentId: null },
  source: { sha256: 'f'.repeat(64), format: 'synthetic', byteLength: null },
  measureFrames: [{ id: 'frame-1', ordinal: 1, displayNumber: '1' }],
  parts: [{
    id: 'part-1',
    ordinal: 1,
    name: 'Piano',
    instrument: { id: 'instrument-1', name: 'Piano', shortName: 'Pno.' },
    staves: [{
      id: 'staff-1',
      ordinal: 1,
      role: 'standard',
      measures: [{
        id: 'measure-1',
        frameId: 'frame-1',
        voices: [{
          id: 'voice-1', ordinal: 1, graceGroups: [],
          events: [{
            id: 'event-1', kind: 'rest',
            onset: { numerator: 0, denominator: 1 },
            duration: { numerator: 1, denominator: 1 }
          }]
        }]
      }]
    }]
  }]
});

const frameAddress = score => {
  const address = addressEntityV3(score, 'frame-1');
  assert.equal(address.kind, 'measure-frame');
  return address;
};

const notationFixture = score => {
  const empty = emptyNotationDocumentV4(score);
  return createNotationDocumentV4(score, {
    ...empty,
    frames: [{
      target: frameAddress(score),
      notation: { timeSignature: { beats: 4, beatType: 4 }, barlines: [] }
    }]
  });
};

const frameNotation = notation => notation.frames.find(entry => entry.target.frameId === 'frame-1')?.notation ?? null;

test('P08-C3 sets left/right repeat barlines while preserving meter and commits one exact history step', () => {
  const score = scoreFixture();
  const notation = notationFixture(score);
  const originalScore = structuredClone(score);
  const originalNotation = structuredClone(notation);
  const requested = [
    { location: 'right', style: 'light-heavy', repeat: 'backward' },
    { location: 'left', style: 'heavy-light', repeat: 'forward' }
  ];
  const result = commitSessionProfessionalFrameBarlinesV1(
    createEditorSessionV4(score, notation),
    frameAddress(score),
    requested,
    { nextRevisionId: 'p08c3-rev-2' }
  );

  assert.equal(result.historyCommitCount, 1);
  assert.equal(result.historyAuthority, 'EditorHistoryV4');
  assert.equal(result.session.history.past.length, 1);
  assert.deepEqual(result.session.history.present.score.parts, originalScore.parts);
  assert.deepEqual(result.session.history.present.score.measureFrames, originalScore.measureFrames);
  assert.deepEqual(frameNotation(result.session.history.present.notation), {
    timeSignature: { beats: 4, beatType: 4 },
    barlines: [
      { location: 'left', style: 'heavy-light', repeat: 'forward' },
      { location: 'right', style: 'light-heavy', repeat: 'backward' }
    ]
  });
  assert.equal(result.session.selection.kind, 'measure-frame');
  assert.equal(result.session.selection.frameId, 'frame-1');
  assert.equal(result.session.selection.revisionId, 'p08c3-rev-2');

  const undone = navigateSessionHistoryV4(result.session, 'UNDO');
  assert.deepEqual(undone.history.present.score, originalScore);
  assert.deepEqual(undone.history.present.notation, originalNotation);
  const redone = navigateSessionHistoryV4(undone, 'REDO');
  assert.deepEqual(redone.history.present.notation, result.session.history.present.notation);
});

test('P08-C3 clears explicit barlines without touching the frame time signature', () => {
  const score = scoreFixture();
  const empty = emptyNotationDocumentV4(score);
  const notation = createNotationDocumentV4(score, {
    ...empty,
    frames: [{
      target: frameAddress(score),
      notation: {
        timeSignature: { beats: 3, beatType: 4 },
        barlines: [{ location: 'right', style: 'light-heavy', repeat: 'backward' }]
      }
    }]
  });
  const result = executeProfessionalFrameBarlinesV1(
    score,
    notation,
    frameAddress(score),
    [],
    { nextRevisionId: 'p08c3-clear' }
  );
  assert.deepEqual(frameNotation(result.notation), {
    timeSignature: { beats: 3, beatType: 4 },
    barlines: []
  });
});

test('P08-C3 rejects duplicate barline locations and no-op edits', () => {
  const score = scoreFixture();
  const notation = notationFixture(score);
  assert.throws(
    () => executeProfessionalFrameBarlinesV1(
      score,
      notation,
      frameAddress(score),
      [
        { location: 'right', style: 'regular', repeat: null },
        { location: 'right', style: 'light-heavy', repeat: 'backward' }
      ],
      { nextRevisionId: 'p08c3-invalid' }
    ),
    error => error instanceof ProfessionalFrameBarlinesV1Error && error.code === 'INVALID_BARLINES'
  );
  assert.throws(
    () => executeProfessionalFrameBarlinesV1(
      score,
      notation,
      frameAddress(score),
      [],
      { nextRevisionId: 'p08c3-noop' }
    ),
    error => error instanceof ProfessionalFrameBarlinesV1Error && error.code === 'NO_CHANGE'
  );
});

test('P08-C3 rejects stale frame targets', () => {
  const score = scoreFixture();
  const target = frameAddress(score);
  const raw = structuredClone(score);
  raw.revision = { id: 'p08c3-newer', parentId: score.revision.id };
  const newer = createScoreDocumentV3(raw);
  const notation = emptyNotationDocumentV4(newer);
  assert.throws(
    () => executeProfessionalFrameBarlinesV1(
      newer,
      notation,
      target,
      [{ location: 'right', style: 'regular', repeat: null }],
      { nextRevisionId: 'p08c3-after-stale' }
    ),
    error => error instanceof ProfessionalFrameBarlinesV1Error && error.code === 'STALE_TARGET'
  );
});
