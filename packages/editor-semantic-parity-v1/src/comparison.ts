import type {
  EditorSemanticClefV1,
  EditorSemanticComparisonReportV1,
  EditorSemanticKeySignatureV1,
  EditorSemanticNoteV1,
  EditorSemanticParityDiagnosticCodeV1,
  EditorSemanticParityDiagnosticV1,
  EditorSemanticProjectionV1,
  EditorSemanticRationalV1,
  EditorSemanticTimeSignatureV1,
  SemanticParityReferenceV1,
  SemanticReferenceNoteV1
} from './types.js';

type SemanticComparableNote = Readonly<{
  partOrdinal: number;
  measureIndex: number;
  staffOrdinal: number;
  voiceOrdinal: number;
  onset: Readonly<EditorSemanticRationalV1>;
  duration: Readonly<EditorSemanticRationalV1>;
  pitchMidi: number;
  occurrenceOrdinal: number;
  tieStart: boolean;
  tieStop: boolean;
}>;

type NormalizedReference = Readonly<{
  notes: readonly SemanticComparableNote[];
  timeSignatures: readonly EditorSemanticTimeSignatureV1[];
  keySignatures: readonly Omit<EditorSemanticKeySignatureV1, 'staffOrdinal'>[];
  clefs: readonly EditorSemanticClefV1[];
}>;

const DIAGNOSTIC_ORDER: readonly EditorSemanticParityDiagnosticCodeV1[] = Object.freeze([
  'PROFILE_UNSUPPORTED',
  'PART_COUNT_MISMATCH',
  'MEASURE_COUNT_MISMATCH',
  'NOTE_COUNT_MISMATCH',
  'PITCH_MISMATCH',
  'ONSET_MISMATCH',
  'DURATION_MISMATCH',
  'VOICE_MISMATCH',
  'STAFF_MISMATCH',
  'TIE_ROLE_MISMATCH',
  'TIME_SIGNATURE_MISMATCH',
  'KEY_SIGNATURE_MISMATCH',
  'CLEF_MISMATCH'
]);

const diagnostic = (
  code: EditorSemanticParityDiagnosticCodeV1,
  message: string
): Readonly<EditorSemanticParityDiagnosticV1> => Object.freeze({ code, message });

const gcdBigInt = (left: bigint, right: bigint): bigint => {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a;
};

const rational = (numerator: bigint, denominator: bigint): Readonly<EditorSemanticRationalV1> | null => {
  if (denominator <= 0n) return null;
  const divisor = gcdBigInt(numerator, denominator);
  const n = numerator / divisor;
  const d = denominator / divisor;
  if (n < BigInt(Number.MIN_SAFE_INTEGER) || n > BigInt(Number.MAX_SAFE_INTEGER)
    || d > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Object.freeze({ numerator: Number(n), denominator: Number(d) });
};

const compareRational = (
  left: EditorSemanticRationalV1,
  right: EditorSemanticRationalV1
): number => {
  const lhs = BigInt(left.numerator) * BigInt(right.denominator);
  const rhs = BigInt(right.numerator) * BigInt(left.denominator);
  return lhs < rhs ? -1 : lhs > rhs ? 1 : 0;
};

const equalRational = (
  left: EditorSemanticRationalV1,
  right: EditorSemanticRationalV1
): boolean => compareRational(left, right) === 0;

const noteOrder = (
  left: Pick<EditorSemanticNoteV1, 'partOrdinal'|'measureIndex'|'staffOrdinal'|'voiceOrdinal'|'onset'|'pitchMidi'|'occurrenceOrdinal'>,
  right: Pick<EditorSemanticNoteV1, 'partOrdinal'|'measureIndex'|'staffOrdinal'|'voiceOrdinal'|'onset'|'pitchMidi'|'occurrenceOrdinal'>
): number =>
  left.partOrdinal - right.partOrdinal
  || left.measureIndex - right.measureIndex
  || left.staffOrdinal - right.staffOrdinal
  || left.voiceOrdinal - right.voiceOrdinal
  || compareRational(left.onset, right.onset)
  || left.pitchMidi - right.pitchMidi
  || left.occurrenceOrdinal - right.occurrenceOrdinal;

const exactKey = (
  note: Pick<EditorSemanticNoteV1, 'partOrdinal'|'measureIndex'|'staffOrdinal'|'voiceOrdinal'|'onset'|'pitchMidi'|'occurrenceOrdinal'>
): string => [
  note.partOrdinal,
  note.measureIndex,
  note.staffOrdinal,
  note.voiceOrdinal,
  `${note.onset.numerator}/${note.onset.denominator}`,
  note.pitchMidi,
  note.occurrenceOrdinal
].join(':');

const unsupportedReport = (message: string): Readonly<EditorSemanticComparisonReportV1> =>
  Object.freeze({
    status: 'UNSUPPORTED',
    diagnostics: Object.freeze([diagnostic('PROFILE_UNSUPPORTED', message)])
  });

const measureStarts = (
  reference: SemanticParityReferenceV1
): readonly number[] | null => {
  const { semanticSnapshot, provenance } = reference;
  if (semanticSnapshot.measure_count <= 0) return null;
  const contexts = [...semanticSnapshot.time_signatures].sort(
    (left, right) => left.onset_div - right.onset_div
  );
  const firstContext = contexts[0];
  if (firstContext === undefined || firstContext.onset_div !== 0
    || firstContext.beats <= 0 || firstContext.beat_type <= 0) return null;
  if (contexts[1]?.onset_div === 0) return null;

  const starts: number[] = [];
  let start = 0;
  let current: { readonly beats: number; readonly beat_type: number } =
    Object.freeze({ beats: firstContext.beats, beat_type: firstContext.beat_type });
  let contextIndex = 1;

  for (let measureIndex = 0; measureIndex < semanticSnapshot.measure_count; measureIndex += 1) {
    const upcoming = contexts[contextIndex];
    if (upcoming !== undefined && upcoming.onset_div < start) return null;
    if (upcoming !== undefined && upcoming.onset_div === start) {
      if (upcoming.beats <= 0 || upcoming.beat_type <= 0) return null;
      current = Object.freeze({ beats: upcoming.beats, beat_type: upcoming.beat_type });
      contextIndex += 1;
      if (contexts[contextIndex]?.onset_div === start) return null;
    }

    starts.push(start);
    const durationNumerator =
      BigInt(current.beats) * 4n * BigInt(provenance.divisionsPerQuarter);
    const denominator = BigInt(current.beat_type);
    if (durationNumerator % denominator !== 0n) return null;
    const duration = durationNumerator / denominator;
    if (duration <= 0n || duration > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    start += Number(duration);
  }

  if (contextIndex !== contexts.length) return null;
  return Object.freeze(starts);
};

const measureIndexAtStart = (starts: readonly number[], onsetDiv: number): number =>
  starts.findIndex((value) => value === onsetDiv);

const semanticNote = (
  note: SemanticReferenceNoteV1,
  starts: readonly number[],
  divisionsPerQuarter: number
): SemanticComparableNote | null => {
  if (note.is_grace || note.voice === null || note.staff === null
    || note.voice <= 0 || note.staff <= 0
    || note.measure_index < 0 || note.measure_index >= starts.length
    || note.duration_div <= 0) return null;
  const measureStart = starts[note.measure_index] as number;
  const nextMeasureStart = starts[note.measure_index + 1];
  if (note.onset_div < measureStart) return null;
  if (nextMeasureStart !== undefined
    && (note.onset_div >= nextMeasureStart || note.onset_div + note.duration_div > nextMeasureStart)) {
    return null;
  }
  const onset = rational(
    BigInt(note.onset_div - measureStart),
    4n * BigInt(divisionsPerQuarter)
  );
  const duration = rational(
    BigInt(note.duration_div),
    4n * BigInt(divisionsPerQuarter)
  );
  if (onset === null || duration === null) return null;
  return Object.freeze({
    partOrdinal: 1,
    measureIndex: note.measure_index,
    staffOrdinal: note.staff,
    voiceOrdinal: note.voice,
    onset,
    duration,
    pitchMidi: note.pitch_midi,
    occurrenceOrdinal: 1,
    tieStart: note.tie_next !== null,
    tieStop: note.tie_prev !== null
  });
};

const normalizeReference = (
  reference: SemanticParityReferenceV1
): NormalizedReference | null => {
  const starts = measureStarts(reference);
  if (starts === null) return null;

  const notes: SemanticComparableNote[] = [];
  const seen = new Set<string>();
  for (const source of reference.semanticSnapshot.notes) {
    const item = semanticNote(source, starts, reference.provenance.divisionsPerQuarter);
    if (item === null) return null;
    const key = exactKey(item);
    if (seen.has(key)) return null;
    seen.add(key);
    notes.push(item);
  }
  notes.sort(noteOrder);

  const timeSignatures: EditorSemanticTimeSignatureV1[] = [];
  for (const item of reference.semanticSnapshot.time_signatures) {
    const measureIndex = measureIndexAtStart(starts, item.onset_div);
    if (measureIndex < 0) return null;
    timeSignatures.push(Object.freeze({
      measureIndex,
      beats: item.beats,
      beatType: item.beat_type
    }));
  }
  timeSignatures.sort((left, right) => left.measureIndex - right.measureIndex);

  const keySignatures: Omit<EditorSemanticKeySignatureV1, 'staffOrdinal'>[] = [];
  for (const item of reference.semanticSnapshot.key_signatures) {
    const measureIndex = measureIndexAtStart(starts, item.onset_div);
    if (measureIndex < 0) return null;
    keySignatures.push(Object.freeze({ measureIndex, fifths: item.fifths }));
  }
  keySignatures.sort((left, right) => left.measureIndex - right.measureIndex);

  const clefs: EditorSemanticClefV1[] = [];
  for (const item of reference.semanticSnapshot.clefs) {
    const measureIndex = measureIndexAtStart(starts, item.onset_div);
    if (measureIndex < 0 || item.line === null) return null;
    clefs.push(Object.freeze({
      measureIndex,
      staffOrdinal: item.staff,
      sign: item.sign,
      line: item.line,
      octaveChange: item.octave_change
    }));
  }
  clefs.sort((left, right) =>
    left.measureIndex - right.measureIndex || left.staffOrdinal - right.staffOrdinal
  );

  return Object.freeze({
    notes: Object.freeze(notes),
    timeSignatures: Object.freeze(timeSignatures),
    keySignatures: Object.freeze(keySignatures),
    clefs: Object.freeze(clefs)
  });
};

type Pair = Readonly<{
  editor: EditorSemanticNoteV1;
  semantic: SemanticComparableNote;
  structuralMismatch: null | 'PITCH_MISMATCH' | 'ONSET_MISMATCH' | 'VOICE_MISMATCH' | 'STAFF_MISMATCH';
}>;

type StructuralMismatch = Exclude<Pair['structuralMismatch'], null>;

const singleFieldDifference = (
  editor: EditorSemanticNoteV1,
  semantic: SemanticComparableNote
): StructuralMismatch | 'MULTIPLE' => {
  if (editor.partOrdinal !== semantic.partOrdinal
    || editor.measureIndex !== semantic.measureIndex
    || editor.occurrenceOrdinal !== semantic.occurrenceOrdinal) return 'MULTIPLE';

  const differences: StructuralMismatch[] = [];
  if (editor.staffOrdinal !== semantic.staffOrdinal) differences.push('STAFF_MISMATCH');
  if (editor.voiceOrdinal !== semantic.voiceOrdinal) differences.push('VOICE_MISMATCH');
  if (!equalRational(editor.onset, semantic.onset)) differences.push('ONSET_MISMATCH');
  if (editor.pitchMidi !== semantic.pitchMidi) differences.push('PITCH_MISMATCH');
  if (differences.length !== 1) return 'MULTIPLE';
  return differences[0] as StructuralMismatch;
};

const pairNotes = (
  editorNotes: readonly EditorSemanticNoteV1[],
  semanticNotes: readonly SemanticComparableNote[]
): Readonly<{ pairs: readonly Pair[]; unpairedEditor: number; unpairedSemantic: number }> | null => {
  const semanticByKey = new Map<string, number>();
  semanticNotes.forEach((note, index) => semanticByKey.set(exactKey(note), index));
  const usedSemantic = new Set<number>();
  const usedEditor = new Set<number>();
  const pairs: Pair[] = [];

  editorNotes.forEach((editor, editorIndex) => {
    const semanticIndex = semanticByKey.get(exactKey(editor));
    if (semanticIndex === undefined || usedSemantic.has(semanticIndex)) return;
    usedEditor.add(editorIndex);
    usedSemantic.add(semanticIndex);
    pairs.push(Object.freeze({
      editor,
      semantic: semanticNotes[semanticIndex] as SemanticComparableNote,
      structuralMismatch: null
    }));
  });

  for (const [editorIndex, editor] of editorNotes.entries()) {
    if (usedEditor.has(editorIndex)) continue;
    const candidates: Array<{ index: number; mismatch: StructuralMismatch }> = [];
    for (const [semanticIndex, semantic] of semanticNotes.entries()) {
      if (usedSemantic.has(semanticIndex)) continue;
      const mismatch = singleFieldDifference(editor, semantic);
      if (mismatch !== 'MULTIPLE') {
        candidates.push({ index: semanticIndex, mismatch });
      }
    }
    if (candidates.length > 1) return null;
    const candidate = candidates[0];
    if (candidate === undefined) continue;
    usedEditor.add(editorIndex);
    usedSemantic.add(candidate.index);
    pairs.push(Object.freeze({
      editor,
      semantic: semanticNotes[candidate.index] as SemanticComparableNote,
      structuralMismatch: candidate.mismatch
    }));
  }

  return Object.freeze({
    pairs: Object.freeze(pairs),
    unpairedEditor: editorNotes.length - usedEditor.size,
    unpairedSemantic: semanticNotes.length - usedSemantic.size
  });
};

const sameJson = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

const sortedDiagnostics = (
  items: readonly EditorSemanticParityDiagnosticV1[]
): readonly EditorSemanticParityDiagnosticV1[] => Object.freeze(
  [...items].sort((left, right) =>
    DIAGNOSTIC_ORDER.indexOf(left.code) - DIAGNOSTIC_ORDER.indexOf(right.code)
    || left.message.localeCompare(right.message)
  )
);

export const compareEditorSemanticsV1 = (
  editor: EditorSemanticProjectionV1,
  reference: SemanticParityReferenceV1
): Readonly<EditorSemanticComparisonReportV1> => {
  const semantic = normalizeReference(reference);
  if (semantic === null) {
    return unsupportedReport('Semantic reference cannot be normalized inside the SEM-04 full-measure profile.');
  }

  const diagnostics: EditorSemanticParityDiagnosticV1[] = [];
  if (editor.partCount !== reference.semanticSnapshot.part_count) {
    diagnostics.push(diagnostic(
      'PART_COUNT_MISMATCH',
      `Part count differs: editor=${editor.partCount}, semantic=${reference.semanticSnapshot.part_count}.`
    ));
  }
  if (editor.measureCount !== reference.semanticSnapshot.measure_count) {
    diagnostics.push(diagnostic(
      'MEASURE_COUNT_MISMATCH',
      `Measure count differs: editor=${editor.measureCount}, semantic=${reference.semanticSnapshot.measure_count}.`
    ));
  }

  const pairs = pairNotes(editor.notes, semantic.notes);
  if (pairs === null) {
    return unsupportedReport('Structural note fallback is ambiguous in the SEM-04 comparison profile.');
  }
  if (editor.notes.length !== semantic.notes.length
    || pairs.unpairedEditor > 0 || pairs.unpairedSemantic > 0) {
    diagnostics.push(diagnostic(
      'NOTE_COUNT_MISMATCH',
      `Comparable note structure differs: editor=${editor.notes.length}, semantic=${semantic.notes.length}, unpairedEditor=${pairs.unpairedEditor}, unpairedSemantic=${pairs.unpairedSemantic}.`
    ));
  }

  for (const pair of pairs.pairs) {
    if (pair.structuralMismatch !== null) {
      diagnostics.push(diagnostic(
        pair.structuralMismatch,
        `Structural note field differs at measure ${pair.editor.measureIndex}, occurrence ${pair.editor.occurrenceOrdinal}.`
      ));
    }
    if (!equalRational(pair.editor.duration, pair.semantic.duration)) {
      diagnostics.push(diagnostic(
        'DURATION_MISMATCH',
        `Note duration differs at measure ${pair.editor.measureIndex}, pitch ${pair.editor.pitchMidi}.`
      ));
    }
    if (pair.editor.tieStart !== pair.semantic.tieStart || pair.editor.tieStop !== pair.semantic.tieStop) {
      diagnostics.push(diagnostic(
        'TIE_ROLE_MISMATCH',
        `Tie boundary role differs at measure ${pair.editor.measureIndex}, pitch ${pair.editor.pitchMidi}.`
      ));
    }
  }

  if (!sameJson(editor.timeSignatures, semantic.timeSignatures)) {
    diagnostics.push(diagnostic('TIME_SIGNATURE_MISMATCH', 'Time-signature contexts differ.'));
  }

  const semanticKeyByMeasure = new Map(semantic.keySignatures.map((item) => [item.measureIndex, item.fifths]));
  const editorKeyByMeasure = new Map<number, number>();
  let conflictingEditorKey = false;
  for (const item of editor.keySignatures) {
    const existing = editorKeyByMeasure.get(item.measureIndex);
    if (existing !== undefined && existing !== item.fifths) conflictingEditorKey = true;
    editorKeyByMeasure.set(item.measureIndex, item.fifths);
  }
  const editorKeyComparable = [...editorKeyByMeasure.entries()]
    .map(([measureIndex, fifths]) => ({ measureIndex, fifths }))
    .sort((left, right) => left.measureIndex - right.measureIndex);
  const semanticKeyComparable = [...semanticKeyByMeasure.entries()]
    .map(([measureIndex, fifths]) => ({ measureIndex, fifths }))
    .sort((left, right) => left.measureIndex - right.measureIndex);
  if (conflictingEditorKey || !sameJson(editorKeyComparable, semanticKeyComparable)) {
    diagnostics.push(diagnostic('KEY_SIGNATURE_MISMATCH', 'Key-signature fifths contexts differ.'));
  }

  if (!sameJson(editor.clefs, semantic.clefs)) {
    diagnostics.push(diagnostic('CLEF_MISMATCH', 'Clef contexts differ.'));
  }

  const ordered = sortedDiagnostics(diagnostics);
  return Object.freeze({
    status: ordered.length === 0 ? 'PASS' : 'MISMATCH',
    diagnostics: ordered
  });
};
