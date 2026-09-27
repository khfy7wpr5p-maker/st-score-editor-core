import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compareEditorSemanticsV1
} from '../dist/packages/editor-semantic-parity-v1/src/index.js';

const rational = (numerator, denominator) => ({ numerator, denominator });

const editorBaseline = () => ({
  partCount: 1,
  measureCount: 2,
  notes: [
    { partOrdinal: 1, measureIndex: 0, staffOrdinal: 1, voiceOrdinal: 1, onset: rational(0, 1), duration: rational(1, 2), pitchMidi: 60, occurrenceOrdinal: 1, tieStart: false, tieStop: false },
    { partOrdinal: 1, measureIndex: 0, staffOrdinal: 1, voiceOrdinal: 1, onset: rational(1, 2), duration: rational(1, 2), pitchMidi: 62, occurrenceOrdinal: 1, tieStart: true, tieStop: false },
    { partOrdinal: 1, measureIndex: 0, staffOrdinal: 1, voiceOrdinal: 2, onset: rational(0, 1), duration: rational(1, 1), pitchMidi: 55, occurrenceOrdinal: 1, tieStart: false, tieStop: false },
    { partOrdinal: 1, measureIndex: 1, staffOrdinal: 1, voiceOrdinal: 1, onset: rational(0, 1), duration: rational(1, 4), pitchMidi: 62, occurrenceOrdinal: 1, tieStart: false, tieStop: true },
    { partOrdinal: 1, measureIndex: 1, staffOrdinal: 1, voiceOrdinal: 1, onset: rational(1, 4), duration: rational(3, 4), pitchMidi: 64, occurrenceOrdinal: 1, tieStart: false, tieStop: false },
    { partOrdinal: 1, measureIndex: 1, staffOrdinal: 1, voiceOrdinal: 2, onset: rational(0, 1), duration: rational(1, 1), pitchMidi: 57, occurrenceOrdinal: 1, tieStart: false, tieStop: false }
  ],
  timeSignatures: [{ measureIndex: 0, beats: 4, beatType: 4 }],
  keySignatures: [{ measureIndex: 0, staffOrdinal: 1, fifths: 0 }],
  clefs: [{ measureIndex: 0, staffOrdinal: 1, sign: 'G', line: 2, octaveChange: 0 }]
});

const referenceBaseline = () => ({
  provenance: {
    schemaVersion: 'st-editor-semantic-parity-fixture-v1',
    sourceSha256: 'a'.repeat(64),
    semanticEngineCommit: 'ffc997b242fa862e180e698385cc0afb52de47a1',
    semanticSnapshotSchema: 'st-semantic-snapshot-v1',
    partituraVersion: '1.9.0',
    divisionsPerQuarter: 4
  },
  semanticSnapshot: {
    schema_version: 'st-semantic-snapshot-v1',
    source_kind: 'musicxml',
    part_count: 1,
    measure_count: 2,
    notes: [
      { source_id: 'n1', part_id: 'P1', measure_index: 0, pitch_midi: 60, onset_div: 0, duration_div: 8, voice: 1, staff: 1, tie_prev: null, tie_next: null, is_grace: false },
      { source_id: 'n3', part_id: 'P1', measure_index: 0, pitch_midi: 55, onset_div: 0, duration_div: 16, voice: 2, staff: 1, tie_prev: null, tie_next: null, is_grace: false },
      { source_id: 'n2', part_id: 'P1', measure_index: 0, pitch_midi: 62, onset_div: 8, duration_div: 8, voice: 1, staff: 1, tie_prev: null, tie_next: 'n4', is_grace: false },
      { source_id: 'n4', part_id: 'P1', measure_index: 1, pitch_midi: 62, onset_div: 16, duration_div: 4, voice: 1, staff: 1, tie_prev: 'n2', tie_next: null, is_grace: false },
      { source_id: 'n6', part_id: 'P1', measure_index: 1, pitch_midi: 57, onset_div: 16, duration_div: 16, voice: 2, staff: 1, tie_prev: null, tie_next: null, is_grace: false },
      { source_id: 'n5', part_id: 'P1', measure_index: 1, pitch_midi: 64, onset_div: 20, duration_div: 12, voice: 1, staff: 1, tie_prev: null, tie_next: null, is_grace: false }
    ],
    time_signatures: [{ part_id: 'P1', onset_div: 0, beats: 4, beat_type: 4 }],
    key_signatures: [{ part_id: 'P1', onset_div: 0, fifths: 0, mode: null }],
    clefs: [{ part_id: 'P1', onset_div: 0, staff: 1, sign: 'G', line: 2, octave_change: 0 }]
  }
});

const clone = (value) => structuredClone(value);
const codes = (report) => report.diagnostics.map((item) => item.code);

test('SEM-04 comparator matches local Editor timing to absolute semantic timeline deterministically', () => {
  const first = compareEditorSemanticsV1(editorBaseline(), referenceBaseline());
  const second = compareEditorSemanticsV1(editorBaseline(), referenceBaseline());

  assert.deepEqual(first, { status: 'PASS', diagnostics: [] });
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

for (const [name, mutate, expected] of [
  ['part count', (editor) => { editor.partCount = 2; }, 'PART_COUNT_MISMATCH'],
  ['measure count', (editor) => { editor.measureCount = 3; }, 'MEASURE_COUNT_MISMATCH'],
  ['note count', (editor) => { editor.notes.pop(); }, 'NOTE_COUNT_MISMATCH'],
  ['pitch', (editor) => { editor.notes[0].pitchMidi = 61; }, 'PITCH_MISMATCH'],
  ['onset', (editor) => { editor.notes[0].onset = rational(1, 8); }, 'ONSET_MISMATCH'],
  ['duration', (editor) => { editor.notes[0].duration = rational(1, 4); }, 'DURATION_MISMATCH'],
  ['voice', (editor) => { editor.notes[0].voiceOrdinal = 3; }, 'VOICE_MISMATCH'],
  ['staff', (editor) => { editor.notes[0].staffOrdinal = 2; }, 'STAFF_MISMATCH'],
  ['tie role', (editor) => { editor.notes[1].tieStart = false; }, 'TIE_ROLE_MISMATCH'],
  ['time signature', (editor) => { editor.timeSignatures[0].beats = 3; }, 'TIME_SIGNATURE_MISMATCH'],
  ['key signature', (editor) => { editor.keySignatures[0].fifths = 1; }, 'KEY_SIGNATURE_MISMATCH'],
  ['clef', (editor) => { editor.clefs[0].line = 1; }, 'CLEF_MISMATCH']
]) {
  test(`SEM-04 comparator reports ${name} mismatch`, () => {
    const editor = clone(editorBaseline());
    mutate(editor);
    const report = compareEditorSemanticsV1(editor, referenceBaseline());

    assert.equal(report.status, 'MISMATCH');
    assert.equal(codes(report).includes(expected), true);
  });
}

test('SEM-04 comparator fails closed when one-field fallback is ambiguous', () => {
  const editor = clone(editorBaseline());
  editor.notes[0].pitchMidi = 61;
  const reference = clone(referenceBaseline());
  reference.semanticSnapshot.notes.push({
    ...reference.semanticSnapshot.notes[0],
    source_id: 'n1-alt',
    pitch_midi: 59
  });

  const report = compareEditorSemanticsV1(editor, reference);

  assert.equal(report.status, 'UNSUPPORTED');
  assert.equal(codes(report).includes('PROFILE_UNSUPPORTED'), true);
});
