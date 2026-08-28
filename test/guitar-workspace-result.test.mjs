import test from 'node:test';
import assert from 'node:assert/strict';
import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { addressEntity } from '../dist/packages/addressing/src/index.js';
import { createNotationDocument } from '../dist/packages/notation-structure/src/index.js';
import {
  createGuitarWorkspaceResult,
  guitarWorkspaceResultAuthorityProfile,
  GuitarWorkspaceResultError
} from '../dist/packages/guitar-workspace-result/src/index.js';

const scoreInput = (revisionId = 'rev-e8c-1', parentId = null) => ({
  schemaVersion: '1.0.0',
  id: 'doc-e8c-1',
  revision: { id: revisionId, parentId },
  source: { sha256: 'a'.repeat(64), format: 'synthetic', byteLength: null },
  parts: [{
    id: 'part-core-1',
    name: 'Guitar Result Fixture',
    staves: [{
      id: 'staff-core-1',
      ordinal: 1,
      measures: [{
        id: 'measure-core-1',
        ordinal: 1,
        displayNumber: '1',
        voices: [{
          id: 'voice-core-1',
          ordinal: 1,
          events: [{
            id: 'event-note-1',
            kind: 'note',
            onset: { numerator: 0, denominator: 1 },
            duration: { numerator: 1, denominator: 4 },
            note: { id: 'note-1', pitch: { step: 'E', alter: 0, octave: 4 } }
          }]
        }]
      }]
    }]
  }]
});

const notationFor = (score) => createNotationDocument(score, {
  contractVersion: '1.0.0',
  documentId: score.id,
  revisionId: score.revision.id,
  measures: [{
    target: addressEntity(score, 'measure-core-1'),
    notation: {
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: null,
      clef: null,
      barlines: []
    }
  }],
  events: [],
  notes: []
});

const tuning = [
  { number: 1, pitch: 'E4', midi: 64 },
  { number: 2, pitch: 'B3', midi: 59 },
  { number: 3, pitch: 'G3', midi: 55 },
  { number: 4, pitch: 'D3', midi: 50 },
  { number: 5, pitch: 'A2', midi: 45 },
  { number: 6, pitch: 'E2', midi: 40 }
];

const validCanonicalResult = () => ({
  documentType: 'CanonicalTabResult',
  schemaVersion: '2.0.0',
  engine: { name: 'musicxml-to-guitar-tab-engine', version: 'test-engine-version' },
  source: {
    documentType: 'PolyphonicSourceModel',
    contractVersion: '1.0.0',
    format: 'score-partwise',
    musicXmlVersion: '4.0',
    partId: 'P1'
  },
  review: { teacherReviewStatus: 'NOT_REVIEWED' },
  guitar: {
    contractVersion: '1.0.0',
    tuning,
    minimumFret: 0,
    maximumFret: 20
  },
  policyProvenance: {
    arrangement: { documentType: 'GuitarArrangementPlan', contractVersion: '1.0.0' },
    reduction: {
      documentType: 'DeterministicReductionPlan',
      contractVersion: '1.0.0',
      policy: 'STANDARD_GUITAR_REGISTER_20_FRET_1.0',
      octaveTieBreak: 'DOWNWARD_TIE_BREAK_1.0'
    },
    voicing: {
      documentType: 'GuitarVoicingCandidateModel',
      contractVersion: '1.0.0',
      policy: 'STANDARD_SIX_STRING_DISTINCT_STRING_1.0'
    },
    leftHand: {
      documentType: 'LeftHandShapeModel',
      contractVersion: '1.0.0',
      policy: 'ORDERED_FRET_FINGER_BARRE_1.0'
    },
    physicalValidation: {
      documentType: 'PhysicalPlayabilityValidation',
      contractVersion: '2.0.0',
      policy: 'CONSERVATIVE_STATIC_LEFT_HAND_2.0',
      configuration: { maximumStaticFretSpan: 4, maximumExtraFretReach: 1 }
    },
    finalSelection: {
      policyId: 'STATIC_ATTACK_PATH_LEXICOGRAPHIC_1.0',
      policyVersion: '1.0.0'
    }
  },
  measures: [{
    measureId: 'P1:measure:0',
    index: 0,
    number: '1',
    implicit: false,
    divisions: 1,
    timeSignature: { beats: 4, beatType: 4 },
    expectedDurationDivisions: 4,
    events: [{
      sourceEventId: 'P1:measure:0:note:0',
      sourceOrder: 0,
      type: 'note',
      voice: '1',
      staff: 1,
      onsetDivisions: 0,
      durationDivisions: 1,
      pitch: { step: 'E', alter: 0, octave: 4, midi: 64, written: 'E4' },
      tieStart: false,
      tieStop: false,
      source: {
        partId: 'P1',
        measureIndex: 0,
        measureNumber: '1',
        noteIndex: 0,
        chordWithPrevious: false
      }
    }]
  }],
  simultaneousGroups: [],
  arrangementDecisions: [{
    decisionId: 'P1:arrangement-decision:0',
    decisionType: 'PRESERVED',
    sourceEventIds: ['P1:measure:0:note:0'],
    sourceGroupId: null
  }],
  noteDispositions: [{
    sourceEventId: 'P1:measure:0:note:0',
    decisionId: 'P1:arrangement-decision:0',
    disposition: 'KEEP',
    targetPitch: { step: 'E', alter: 0, octave: 4, midi: 64, written: 'E4' },
    octaveShiftSemitones: 0,
    ruleId: 'PRESERVE_IN_REGISTER',
    selectedPosition: { string: 1, fret: 0 },
    selectedShapeId: null
  }],
  selectedShapes: []
});

const clone = (value) => JSON.parse(JSON.stringify(value));
const expectError = (fn, code) => assert.throws(fn, (error) => error instanceof GuitarWorkspaceResultError && error.code === code);

test('E8-C authority profile keeps imported guitar results read-only and derivative', () => {
  assert.equal(guitarWorkspaceResultAuthorityProfile.inputBoundary, 'BOUNDED_JSON_STRING');
  assert.equal(guitarWorkspaceResultAuthorityProfile.projectionArgumentAccepted, false);
  assert.equal(guitarWorkspaceResultAuthorityProfile.rederivesProjectionBeforeAcceptance, true);
  assert.equal(guitarWorkspaceResultAuthorityProfile.sourceFactsMustMatchCurrentCanonicalRevision, true);
  assert.equal(guitarWorkspaceResultAuthorityProfile.resultStateDerivativeOnly, true);
  assert.equal(guitarWorkspaceResultAuthorityProfile.readOnly, true);
  assert.equal(guitarWorkspaceResultAuthorityProfile.engineInvocation, false);
  assert.equal(guitarWorkspaceResultAuthorityProfile.reverseCanonicalWriteAuthority, false);
  assert.equal(guitarWorkspaceResultAuthorityProfile.teacherReviewMutationAuthority, false);
  assert.equal(guitarWorkspaceResultAuthorityProfile.productionAuthority, false);
});

test('E8-C accepts exact current-revision source evidence and returns frozen canonical note targets', () => {
  const score = createScoreDocument(scoreInput());
  const notation = notationFor(score);
  const result = createGuitarWorkspaceResult(score, notation, JSON.stringify(validCanonicalResult()));

  assert.equal(result.documentId, score.id);
  assert.equal(result.revisionId, score.revision.id);
  assert.equal(result.teacherReviewStatus, 'NOT_REVIEWED');
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].sourceEventId, 'P1:measure:0:note:0');
  assert.equal(result.entries[0].target.kind, 'note');
  assert.equal(result.entries[0].target.noteId, 'note-1');
  assert.deepEqual(result.entries[0].selectedPosition, { string: 1, fret: 0 });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.entries), true);
  assert.equal(Object.isFrozen(result.entries[0]), true);
  assert.equal(Object.isFrozen(result.entries[0].target), true);
});

test('E8-C rejects malformed JSON and unknown root fields before semantic acceptance', () => {
  const score = createScoreDocument(scoreInput());
  const notation = notationFor(score);
  expectError(() => createGuitarWorkspaceResult(score, notation, '{'), 'INVALID_JSON');

  const extra = validCanonicalResult();
  extra.coordinates = { x: 1, y: 2 };
  expectError(() => createGuitarWorkspaceResult(score, notation, JSON.stringify(extra)), 'INVALID_RESULT_SHAPE');
});

test('E8-C rejects a result whose source pitch facts do not match the current canonical revision', () => {
  const score = createScoreDocument(scoreInput());
  const notation = notationFor(score);
  const tampered = clone(validCanonicalResult());
  tampered.measures[0].events[0].pitch = { step: 'F', alter: 0, octave: 4, midi: 65, written: 'F4' };
  expectError(() => createGuitarWorkspaceResult(score, notation, JSON.stringify(tampered)), 'SOURCE_FACT_MISMATCH');
});

test('E8-C rejects invalid guitar positions and final-selection policy drift', () => {
  const score = createScoreDocument(scoreInput());
  const notation = notationFor(score);

  const position = clone(validCanonicalResult());
  position.noteDispositions[0].selectedPosition.fret = 1;
  expectError(() => createGuitarWorkspaceResult(score, notation, JSON.stringify(position)), 'INVALID_SELECTION_RESULT');

  const policy = clone(validCanonicalResult());
  policy.policyProvenance.finalSelection.policyId = 'UNKNOWN_POLICY';
  expectError(() => createGuitarWorkspaceResult(score, notation, JSON.stringify(policy)), 'UNSUPPORTED_RESULT_CONTRACT');
});

test('E8-C rejects notation from a stale canonical revision', () => {
  const score = createScoreDocument(scoreInput());
  const staleNotation = notationFor(score);
  const nextScore = createScoreDocument(scoreInput('rev-e8c-2', 'rev-e8c-1'));
  expectError(() => createGuitarWorkspaceResult(nextScore, staleNotation, JSON.stringify(validCanonicalResult())), 'STALE_NOTATION');
});

test('E8-C does not grant mutation authority from teacher review state', () => {
  const score = createScoreDocument(scoreInput());
  const notation = notationFor(score);
  const reviewed = validCanonicalResult();
  reviewed.review.teacherReviewStatus = 'APPROVED';
  const result = createGuitarWorkspaceResult(score, notation, JSON.stringify(reviewed));
  assert.equal(result.teacherReviewStatus, 'APPROVED');
  assert.equal(guitarWorkspaceResultAuthorityProfile.teacherReviewMutationAuthority, false);
  assert.equal(guitarWorkspaceResultAuthorityProfile.reverseCanonicalWriteAuthority, false);
});
