import test from 'node:test';
import assert from 'node:assert/strict';

import { createPartituraNoteFixtureV1 } from '../scripts/lib/p-mxml-ref-03-envelope-fixture.mjs';
import { mapPartituraImportToCanonicalV1 } from '../dist/packages/musicxml-partitura-mapper/src/index.js';
import { joinPartituraGuitarTechnicalV1 } from '../dist/packages/musicxml-partitura-mapper/src/guitarTechnicalBridge.js';

const source = Object.freeze({
  sha256: 'b'.repeat(64),
  format: 'musicxml',
  byteLength: 1024
});

const note = ({
  sourceNoteId,
  pitch,
  step,
  octave,
  onsetDiv = 0,
  durationDiv = 4,
  voice = 1,
  staff = 1
}) => createPartituraNoteFixtureV1({
  sourceNoteId,
  pitch,
  step,
  octave,
  onsetDiv,
  durationDiv,
  voice,
  staff,
  onsetBeat: onsetDiv / 4,
  durationBeat: durationDiv / 4,
  onsetQuarter: onsetDiv / 4,
  durationQuarter: durationDiv / 4
});

const envelope = (notes) => ({
  version: '1.0.0',
  sourceIdentity: 'fixture:ses-88.musicxml',
  parts: [{
    id: 'P1',
    name: 'Guitar',
    staffCount: 1,
    measureCount: 1,
    noteCount: notes.length,
    restCount: 0,
    measures: [{ number: 1, name: '1', startDiv: 0, endDiv: 16 }],
    notes,
    rests: [],
    timeSignatures: [{ startDiv: 0, beats: 4, beatType: 4 }],
    keySignatures: [],
    clefs: []
  }],
  provenance: {
    parser: 'partitura',
    partituraVersion: '1.9.0',
    sourceIdentity: 'fixture:ses-88.musicxml'
  },
  preservedSymbols: [],
  diagnostics: []
});

const symbol = (element, text, {
  sourceNoteId = null,
  path = `score-partwise[0]/part[0]/measure[0]/note[0]/notations[0]/technical[0]/${element}[0]`,
  attributes = {}
} = {}) => ({
  version: '1.0.0',
  disposition: 'PRESERVED_RENDERABLE',
  element,
  sourcePath: path,
  measureNumber: '1',
  sourceNoteId,
  attributes,
  text,
  provenance: {
    sourceIdentity: 'fixture:ses-88.musicxml',
    parser: 'raw-musicxml-preservation-v1'
  }
});

const sidecar = (symbols = []) => ({
  version: '1.0.0',
  sourceIdentity: 'fixture:ses-88.musicxml',
  symbols
});

const canonical = (env, preserved) => {
  const mapped = mapPartituraImportToCanonicalV1(env, preserved, {
    source,
    documentId: 'doc-ses-88',
    revisionId: 'rev-ses-88'
  });
  assert.equal(mapped.ok, true);
  return mapped;
};

const engineTuning = [
  { number: 1, pitch: 'E4', midi: 64 },
  { number: 2, pitch: 'B3', midi: 59 },
  { number: 3, pitch: 'G3', midi: 55 },
  { number: 4, pitch: 'D3', midi: 50 },
  { number: 5, pitch: 'A2', midi: 45 },
  { number: 6, pitch: 'E2', midi: 40 }
];

const canonicalTabResult = (position = { string: 2, fret: 5 }) => ({
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
    tuning: engineTuning,
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
    selectedPosition: position,
    selectedShapeId: null
  }],
  selectedShapes: []
});

test('SES-88 preserves explicit source string/fret and binds it to the exact current V3 note target', () => {
  const env = envelope([note({ sourceNoteId: 'n1', pitch: 64, step: 'E', octave: 4 })]);
  const preserved = sidecar([
    symbol('string', '1', { sourceNoteId: 'n1' }),
    symbol('fret', '0', { sourceNoteId: 'n1' })
  ]);
  const mapped = canonical(env, preserved);

  const result = joinPartituraGuitarTechnicalV1(env, preserved, mapped);
  assert.equal(result.ok, true);
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].sourceNoteId, 'n1');
  assert.equal(result.entries[0].target.kind, 'note');
  assert.deepEqual(result.entries[0].sourcePosition, { string: 1, fret: 0 });
  assert.deepEqual(result.entries[0].effectivePosition, { string: 1, fret: 0 });
  assert.equal(result.entries[0].positionAuthority, 'SOURCE_EXPLICIT');
});

test('SES-88 keeps chord-tone string/fret identity separate by source note id', () => {
  const env = envelope([
    note({ sourceNoteId: 'n1', pitch: 64, step: 'E', octave: 4 }),
    note({ sourceNoteId: 'n2', pitch: 60, step: 'C', octave: 4 })
  ]);
  const preserved = sidecar([
    symbol('string', '1', { sourceNoteId: 'n1', path: 'score-partwise[0]/part[0]/measure[0]/note[0]/notations[0]/technical[0]/string[0]' }),
    symbol('fret', '0', { sourceNoteId: 'n1', path: 'score-partwise[0]/part[0]/measure[0]/note[0]/notations[0]/technical[0]/fret[0]' }),
    symbol('string', '2', { sourceNoteId: 'n2', path: 'score-partwise[0]/part[0]/measure[0]/note[1]/notations[0]/technical[0]/string[0]' }),
    symbol('fret', '1', { sourceNoteId: 'n2', path: 'score-partwise[0]/part[0]/measure[0]/note[1]/notations[0]/technical[0]/fret[0]' })
  ]);
  const mapped = canonical(env, preserved);
  const result = joinPartituraGuitarTechnicalV1(env, preserved, mapped);

  assert.equal(result.ok, true);
  assert.deepEqual(result.entries.map(entry => [
    entry.sourceNoteId,
    entry.target.noteId,
    entry.effectivePosition
  ]), [
    ['n1', 'note-1-1-1-1-1-1', { string: 1, fret: 0 }],
    ['n2', 'note-1-1-1-1-1-2', { string: 2, fret: 1 }]
  ]);
});

test('SES-88 fails closed on incomplete explicit source string/fret pairs', () => {
  const env = envelope([note({ sourceNoteId: 'n1', pitch: 64, step: 'E', octave: 4 })]);
  const preserved = sidecar([symbol('string', '1', { sourceNoteId: 'n1' })]);
  const mapped = canonical(env, preserved);
  const result = joinPartituraGuitarTechnicalV1(env, preserved, mapped);

  assert.equal(result.ok, false);
  assert.equal(result.diagnostics[0].code, 'INCOMPLETE_SOURCE_POSITION');
  assert.equal('entries' in result, false);
});

test('SES-88 fails closed when explicit string/fret contradicts preserved source tuning and canonical pitch', () => {
  const env = envelope([note({ sourceNoteId: 'n1', pitch: 64, step: 'E', octave: 4 })]);
  const tuningPath = 'score-partwise[0]/part[0]/measure[0]/attributes[0]/staff-details[0]/staff-tuning[0]';
  const preserved = sidecar([
    symbol('staff-tuning', null, { path: tuningPath, attributes: { line: '1' } }),
    symbol('tuning-step', 'E', { path: `${tuningPath}/tuning-step[0]` }),
    symbol('tuning-octave', '4', { path: `${tuningPath}/tuning-octave[0]` }),
    symbol('string', '1', { sourceNoteId: 'n1' }),
    symbol('fret', '1', { sourceNoteId: 'n1' })
  ]);
  const mapped = canonical(env, preserved);
  const result = joinPartituraGuitarTechnicalV1(env, preserved, mapped);

  assert.equal(result.ok, false);
  assert.equal(result.diagnostics[0].code, 'SOURCE_POSITION_PITCH_CONFLICT');
});

test('SES-88 retains unjoinable note-local technical evidence with explicit diagnostic instead of dropping it', () => {
  const env = envelope([note({ sourceNoteId: 'n1', pitch: 64, step: 'E', octave: 4 })]);
  const unjoined = symbol('pluck', 'p', { sourceNoteId: null });
  const preserved = sidecar([unjoined]);
  const mapped = canonical(env, preserved);
  const result = joinPartituraGuitarTechnicalV1(env, preserved, mapped);

  assert.equal(result.ok, true);
  assert.deepEqual(result.unjoinedSymbols, [unjoined]);
  assert.equal(result.diagnostics.some(item => item.code === 'UNJOINED_SOURCE_SYMBOL'), true);
});

test('SES-88 may fill missing TAB from validated Guitar Workspace evidence without overwriting explicit source TAB', () => {
  const env = envelope([note({ sourceNoteId: 'n1', pitch: 64, step: 'E', octave: 4 })]);

  const noSourceTab = sidecar([]);
  const mappedMissing = canonical(env, noSourceTab);
  const generated = joinPartituraGuitarTechnicalV1(env, noSourceTab, mappedMissing, {
    canonicalTabResultJson: JSON.stringify(canonicalTabResult({ string: 2, fret: 5 }))
  });
  assert.equal(generated.ok, true);
  assert.deepEqual(generated.entries[0].enginePosition, { string: 2, fret: 5 });
  assert.deepEqual(generated.entries[0].effectivePosition, { string: 2, fret: 5 });
  assert.equal(generated.entries[0].positionAuthority, 'ENGINE_GENERATED');

  const explicit = sidecar([
    symbol('string', '1', { sourceNoteId: 'n1' }),
    symbol('fret', '0', { sourceNoteId: 'n1' })
  ]);
  const mappedExplicit = canonical(env, explicit);
  const sourceWins = joinPartituraGuitarTechnicalV1(env, explicit, mappedExplicit, {
    canonicalTabResultJson: JSON.stringify(canonicalTabResult({ string: 2, fret: 5 }))
  });
  assert.equal(sourceWins.ok, true);
  assert.deepEqual(sourceWins.entries[0].sourcePosition, { string: 1, fret: 0 });
  assert.deepEqual(sourceWins.entries[0].enginePosition, { string: 2, fret: 5 });
  assert.deepEqual(sourceWins.entries[0].effectivePosition, { string: 1, fret: 0 });
  assert.equal(sourceWins.entries[0].positionAuthority, 'SOURCE_EXPLICIT');
});
