import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4, emptyNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import {
  ProfessionalTimeSignatureV1Error,
  analyzeProfessionalTimeSignatureV1
} from '../dist/packages/editor-professional-time-signature-v1/src/index.js';
import {
  commitSessionProfessionalTimeSignatureV1
} from '../dist/packages/editor-session-professional-time-signature-v1/src/index.js';
import {
  createEditorSessionV4,
  navigateSessionHistoryV4
} from '../dist/packages/editor-session-controller-v4/src/index.js';

const q = (numerator, denominator) => ({ numerator, denominator });
const rest = (id, onset, duration) => ({ id, kind: 'rest', onset, duration });
const note = (id, noteId, onset, duration, step = 'C') => ({
  id,
  kind: 'note',
  onset,
  duration,
  note: { id: noteId, pitch: { step, alter: 0, octave: 4 } }
});

const measure = (id, frameId, voiceId, events) => ({
  id,
  frameId,
  voices: [{ id: voiceId, ordinal: 1, events, graceGroups: [] }]
});

const scoreFixture = () => createScoreDocumentV3({
  schemaVersion: '3.0.0',
  id: 'p08c2-score',
  revision: { id: 'p08c2-rev-1', parentId: null },
  source: { sha256: 'e'.repeat(64), format: 'synthetic', byteLength: null },
  measureFrames: [
    { id: 'frame-1', ordinal: 1, displayNumber: '1' },
    { id: 'frame-2', ordinal: 2, displayNumber: '2' },
    { id: 'frame-3', ordinal: 3, displayNumber: '3' }
  ],
  parts: [{
    id: 'part-1',
    ordinal: 1,
    name: 'Piano',
    instrument: { id: 'instrument-1', name: 'Piano', shortName: 'Pno.' },
    staves: [
      {
        id: 'staff-1',
        ordinal: 1,
        role: 'standard',
        measures: [
          measure('s1-m1', 'frame-1', 's1-v1', [
            note('s1-e1', 's1-n1', q(0, 1), q(1, 2), 'C'),
            rest('s1-r1', q(1, 2), q(1, 4))
          ]),
          measure('s1-m2', 'frame-2', 's1-v2', [
            note('s1-e2', 's1-n2', q(0, 1), q(3, 4), 'D')
          ]),
          measure('s1-m3', 'frame-3', 's1-v3', [
            note('s1-e3', 's1-n3', q(0, 1), q(1, 1), 'E')
          ])
        ]
      },
      {
        id: 'staff-2',
        ordinal: 2,
        role: 'standard',
        measures: [
          measure('s2-m1', 'frame-1', 's2-v1', [
            rest('s2-r1', q(0, 1), q(3, 4))
          ]),
          measure('s2-m2', 'frame-2', 's2-v2', [
            note('s2-e2', 's2-n2', q(0, 1), q(1, 2), 'F')
          ]),
          measure('s2-m3', 'frame-3', 's2-v3', [
            rest('s2-r3', q(0, 1), q(1, 1))
          ])
        ]
      }
    ]
  }]
});

const frameAddress = (score, id) => {
  const address = addressEntityV3(score, id);
  assert.equal(address.kind, 'measure-frame');
  return address;
};

const notationFixture = score => {
  const empty = emptyNotationDocumentV4(score);
  return createNotationDocumentV4(score, {
    ...empty,
    frames: [
      {
        target: frameAddress(score, 'frame-1'),
        notation: {
          timeSignature: { beats: 4, beatType: 4 },
          barlines: [{ location: 'right', style: 'regular', repeat: null }]
        }
      },
      {
        target: frameAddress(score, 'frame-3'),
        notation: {
          timeSignature: { beats: 4, beatType: 4 },
          barlines: []
        }
      }
    ]
  });
};

const frameNotation = (notation, id) => notation.frames.find(entry => entry.target.frameId === id)?.notation ?? null;

test('P08-C2 admits a frame-global 3/4 change only through the next explicit meter and commits exactly once', () => {
  const score = scoreFixture();
  const notation = notationFixture(score);
  const originalScore = structuredClone(score);
  const originalNotation = structuredClone(notation);
  const target = frameAddress(score, 'frame-1');
  const admission = analyzeProfessionalTimeSignatureV1(score, notation, target, { beats: 3, beatType: 4 });

  assert.deepEqual(admission.affectedFrameIds, ['frame-1', 'frame-2']);
  assert.equal(admission.nextExplicitFrameId, 'frame-3');
  assert.deepEqual(admission.nominalMeasureDuration, q(3, 4));
  assert.equal(admission.auditedMeasureIds.length, 4);
  assert.equal(admission.auditedVoiceCount, 4);

  const result = commitSessionProfessionalTimeSignatureV1(
    createEditorSessionV4(score, notation),
    target,
    { beats: 3, beatType: 4 },
    admission,
    { nextRevisionId: 'p08c2-rev-2' }
  );

  assert.equal(result.historyCommitCount, 1);
  assert.equal(result.historyAuthority, 'EditorHistoryV4');
  assert.equal(result.session.history.past.length, 1);
  assert.equal(result.session.history.present.score.revision.id, 'p08c2-rev-2');
  assert.equal(result.session.history.present.score.revision.parentId, 'p08c2-rev-1');
  assert.deepEqual(result.session.history.present.score.parts, originalScore.parts);
  assert.deepEqual(result.session.history.present.score.measureFrames, originalScore.measureFrames);
  assert.deepEqual(frameNotation(result.session.history.present.notation, 'frame-1'), {
    timeSignature: { beats: 3, beatType: 4 },
    barlines: [{ location: 'right', style: 'regular', repeat: null }]
  });
  assert.deepEqual(frameNotation(result.session.history.present.notation, 'frame-3'), {
    timeSignature: { beats: 4, beatType: 4 },
    barlines: []
  });
  assert.equal(result.session.selection.kind, 'measure-frame');
  assert.equal(result.session.selection.frameId, 'frame-1');
  assert.equal(result.session.selection.revisionId, 'p08c2-rev-2');

  const undone = navigateSessionHistoryV4(result.session, 'UNDO');
  assert.deepEqual(undone.history.present.score, originalScore);
  assert.deepEqual(undone.history.present.notation, originalNotation);
  const redone = navigateSessionHistoryV4(undone, 'REDO');
  assert.deepEqual(redone.history.present.score, result.session.history.present.score);
  assert.deepEqual(redone.history.present.notation, result.session.history.present.notation);
});

test('P08-C2 rejects a meter shorter than timed content anywhere in the propagation segment', () => {
  const score = scoreFixture();
  const notation = notationFixture(score);
  const target = frameAddress(score, 'frame-1');

  assert.throws(
    () => analyzeProfessionalTimeSignatureV1(score, notation, target, { beats: 2, beatType: 4 }),
    error => error instanceof ProfessionalTimeSignatureV1Error && error.code === 'METER_TOO_SHORT'
  );
});

test('P08-C2 rejects pre-existing overlap instead of using a meter edit to mask invalid timing', () => {
  const score = scoreFixture();
  const raw = structuredClone(score);
  raw.parts[0].staves[0].measures[1].voices[0].events = [
    note('overlap-a', 'overlap-na', q(0, 1), q(1, 2), 'C'),
    note('overlap-b', 'overlap-nb', q(1, 4), q(1, 4), 'D')
  ];
  const overlapping = createScoreDocumentV3(raw);
  const notation = notationFixture(overlapping);

  assert.throws(
    () => analyzeProfessionalTimeSignatureV1(
      overlapping,
      notation,
      frameAddress(overlapping, 'frame-1'),
      { beats: 3, beatType: 4 }
    ),
    error => error instanceof ProfessionalTimeSignatureV1Error && error.code === 'EXISTING_TIMING_INVALID'
  );
});

test('P08-C2 rejects an explicit no-op meter and a stale frame target', () => {
  const score = scoreFixture();
  const notation = notationFixture(score);
  const target = frameAddress(score, 'frame-1');

  assert.throws(
    () => analyzeProfessionalTimeSignatureV1(score, notation, target, { beats: 4, beatType: 4 }),
    error => error instanceof ProfessionalTimeSignatureV1Error && error.code === 'NO_CHANGE'
  );

  const raw = structuredClone(score);
  raw.revision = { id: 'p08c2-newer', parentId: score.revision.id };
  const newer = createScoreDocumentV3(raw);
  const newerNotation = emptyNotationDocumentV4(newer);
  assert.throws(
    () => analyzeProfessionalTimeSignatureV1(newer, newerNotation, target, { beats: 3, beatType: 4 }),
    error => error instanceof ProfessionalTimeSignatureV1Error && error.code === 'STALE_TARGET'
  );
});

test('P08-C2 rejects a tampered admission before creating a history revision', () => {
  const score = scoreFixture();
  const notation = notationFixture(score);
  const target = frameAddress(score, 'frame-1');
  const admission = analyzeProfessionalTimeSignatureV1(score, notation, target, { beats: 3, beatType: 4 });
  const tampered = structuredClone(admission);
  tampered.affectedFrameIds.pop();
  const session = createEditorSessionV4(score, notation);

  assert.throws(
    () => commitSessionProfessionalTimeSignatureV1(
      session,
      target,
      { beats: 3, beatType: 4 },
      tampered,
      { nextRevisionId: 'p08c2-tampered' }
    ),
    error => error instanceof ProfessionalTimeSignatureV1Error && error.code === 'ADMISSION_STALE_OR_TAMPERED'
  );
  assert.deepEqual(session.history.present.score, score);
  assert.deepEqual(session.history.present.notation, notation);
});
