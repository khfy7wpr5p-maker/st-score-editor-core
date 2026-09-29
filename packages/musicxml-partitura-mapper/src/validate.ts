import {
  NORMALIZED_IMPORT_ENVELOPE_VERSION,
  validateNormalizedImportEnvelopeV1
} from '../../musicxml-import-contract/src/index.js';

export type PartituraMapperDiagnosticCodeV1 =
  | 'INVALID_ENVELOPE'
  | 'SOURCE_IDENTITY_MISMATCH'
  | 'UPSTREAM_DIAGNOSTIC'
  | 'UNSUPPORTED_SEMANTIC'
  | 'INVALID_TIMING'
  | 'INVALID_TOPOLOGY'
  | 'CANONICAL_VALIDATION_FAILED';

export class PartituraMapperValidationError extends Error {
  readonly code: PartituraMapperDiagnosticCodeV1;
  readonly path: string;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: PartituraMapperDiagnosticCodeV1,
    path: string,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'PartituraMapperValidationError';
    this.code = code;
    this.path = path;
    this.details = Object.freeze({ ...details });
  }
}

export interface ValidatedPartituraMeasureV1 {
  readonly number: string | number | null;
  readonly name: string | number | null;
  readonly startDiv: number;
  readonly endDiv: number;
}

export interface ValidatedPartituraTupletV1 {
  readonly actualNotes: number;
  readonly normalNotes: number;
}

export interface ValidatedPartituraNoteV1 {
  readonly sourceIndex: number;
  readonly sourceNoteId: string | null;
  readonly pitch: number;
  readonly step: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  readonly alter: number;
  readonly octave: number;
  readonly onsetBeat: number;
  readonly durationBeat: number;
  readonly onsetQuarter: number;
  readonly durationQuarter: number;
  readonly onsetDiv: number;
  readonly durationDiv: number;
  readonly voice: number | null;
  readonly staff: number | null;
  readonly divsPerQuarter: number;
  readonly keyFifths: number;
  readonly keyMode: number | null;
  readonly timeBeats: number;
  readonly timeBeatType: number;
  readonly ties: Readonly<{ start: boolean; stop: boolean }>;
  readonly tiePrevSourceNoteId: string | null;
  readonly tieNextSourceNoteId: string | null;
  readonly tuplet: Readonly<ValidatedPartituraTupletV1> | null;
  readonly fingerings: readonly string[];
  readonly articulations: readonly string[];
  readonly ornaments: readonly string[];
  readonly isGrace: boolean;
}

export interface ValidatedPartituraRestV1 {
  readonly sourceIndex: number;
  readonly sourceNoteId: string | null;
  readonly onsetDiv: number;
  readonly durationDiv: number;
  readonly voice: number | null;
  readonly staff: number | null;
  readonly divsPerQuarter: number;
  readonly symbolicDuration: unknown;
}

export interface ValidatedPartituraTimeSignatureV1 {
  readonly startDiv: number;
  readonly beats: number;
  readonly beatType: number;
}

export interface ValidatedPartituraKeySignatureV1 {
  readonly startDiv: number;
  readonly fifths: number;
  readonly mode: string | null;
}

export interface ValidatedPartituraClefV1 {
  readonly startDiv: number;
  readonly staff: number | null;
  readonly sign: 'G' | 'F' | 'C' | 'percussion' | 'TAB';
  readonly line: number;
  readonly octaveChange: number;
}

export interface ValidatedPartituraPartV1 {
  readonly id: string;
  readonly name: string | null;
  readonly staffCount: number;
  readonly measures: readonly ValidatedPartituraMeasureV1[];
  readonly notes: readonly ValidatedPartituraNoteV1[];
  readonly rests: readonly ValidatedPartituraRestV1[];
  readonly timeSignatures: readonly ValidatedPartituraTimeSignatureV1[];
  readonly keySignatures: readonly ValidatedPartituraKeySignatureV1[];
  readonly clefs: readonly ValidatedPartituraClefV1[];
}

export interface ValidatedPartituraEnvelopeV1 {
  readonly sourceIdentity: string;
  readonly parts: readonly ValidatedPartituraPartV1[];
}

type R = Record<string, unknown>;

const record = (value: unknown, path: string): R => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new PartituraMapperValidationError(
      'Partitura normalized value must be an object.',
      'INVALID_ENVELOPE',
      path
    );
  }
  return value as R;
};

const exact = (value: unknown, keys: readonly string[], path: string): R => {
  const item = record(value, path);
  const observed = Object.keys(item).sort((left, right) => left.localeCompare(right));
  const expected = [...keys].sort((left, right) => left.localeCompare(right));
  if (JSON.stringify(observed) !== JSON.stringify(expected)) {
    throw new PartituraMapperValidationError(
      'Partitura normalized field set is invalid.',
      'INVALID_ENVELOPE',
      path,
      { observed, expected }
    );
  }
  return item;
};

const array = (value: unknown, path: string): readonly unknown[] => {
  if (!Array.isArray(value)) {
    throw new PartituraMapperValidationError(
      'Partitura normalized value must be an array.',
      'INVALID_ENVELOPE',
      path
    );
  }
  return value;
};

const integer = (value: unknown, min: number, max: number, path: string): number => {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new PartituraMapperValidationError(
      'Partitura normalized integer is outside the admitted range.',
      'INVALID_ENVELOPE',
      path,
      { value, min, max }
    );
  }
  return value;
};

const finite = (value: unknown, path: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new PartituraMapperValidationError(
      'Partitura normalized numeric value must be finite.',
      'INVALID_ENVELOPE',
      path,
      { value }
    );
  }
  return value;
};

const nonEmpty = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new PartituraMapperValidationError(
      'Partitura normalized string must be non-empty.',
      'INVALID_ENVELOPE',
      path
    );
  }
  return value;
};

const nullableString = (value: unknown, path: string): string | null => {
  if (value === null) return null;
  return nonEmpty(value, path);
};

const nullableScalarLabel = (value: unknown, path: string): string | number | null => {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  throw new PartituraMapperValidationError(
    'Partitura measure label must be string, number, or null.',
    'INVALID_ENVELOPE',
    path
  );
};

const nullablePositiveInteger = (
  value: unknown,
  max: number,
  path: string
): number | null => value === null ? null : integer(value, 1, max, path);

const strings = (value: unknown, path: string): readonly string[] =>
  Object.freeze(array(value, path).map((item, index) => nonEmpty(item, `${path}[${index}]`)));

const bool = (value: unknown, path: string): boolean => {
  if (typeof value !== 'boolean') {
    throw new PartituraMapperValidationError(
      'Partitura normalized boolean is invalid.',
      'INVALID_ENVELOPE',
      path
    );
  }
  return value;
};

const approx = (left: number, right: number): boolean =>
  Math.abs(left - right) <= 1e-9 * Math.max(1, Math.abs(left), Math.abs(right));

const pitchMidi = (
  step: ValidatedPartituraNoteV1['step'],
  alter: number,
  octave: number
): number => {
  const semitone: Readonly<Record<ValidatedPartituraNoteV1['step'], number>> = Object.freeze({
    C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11
  });
  return (octave + 1) * 12 + semitone[step] + alter;
};

const validateMeasure = (value: unknown, index: number): ValidatedPartituraMeasureV1 => {
  const path = `$.parts[].measures[${index}]`;
  const item = exact(value, ['number','name','startDiv','endDiv'], path);
  const startDiv = integer(item.startDiv, 0, Number.MAX_SAFE_INTEGER, `${path}.startDiv`);
  const endDiv = integer(item.endDiv, 1, Number.MAX_SAFE_INTEGER, `${path}.endDiv`);
  if (endDiv <= startDiv) {
    throw new PartituraMapperValidationError(
      'Partitura measure end must be after its start.',
      'INVALID_TIMING',
      path,
      { startDiv, endDiv }
    );
  }
  return Object.freeze({
    number: nullableScalarLabel(item.number, `${path}.number`),
    name: nullableScalarLabel(item.name, `${path}.name`),
    startDiv,
    endDiv
  });
};

const validateNote = (value: unknown, index: number): ValidatedPartituraNoteV1 => {
  const path = `$.parts[].notes[${index}]`;
  const item = exact(value, [
    'sourceNoteId','pitch','step','alter','octave',
    'onsetBeat','durationBeat','onsetQuarter','durationQuarter',
    'onsetDiv','durationDiv','voice','staff','divsPerQuarter',
    'keyFifths','keyMode','timeBeats','timeBeatType','ties',
    'tiePrevSourceNoteId','tieNextSourceNoteId','tuplet',
    'fingerings','articulations','ornaments','isGrace'
  ], path);

  const stepRaw = nonEmpty(item.step, `${path}.step`);
  if (!['A','B','C','D','E','F','G'].includes(stepRaw)) {
    throw new PartituraMapperValidationError('Partitura pitch step is unsupported.', 'INVALID_ENVELOPE', `${path}.step`);
  }
  const step = stepRaw as ValidatedPartituraNoteV1['step'];
  const alter = integer(item.alter, -2, 2, `${path}.alter`);
  const octave = integer(item.octave, -1, 9, `${path}.octave`);
  const midi = integer(item.pitch, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, `${path}.pitch`);
  if (midi !== pitchMidi(step, alter, octave)) {
    throw new PartituraMapperValidationError(
      'Partitura MIDI pitch disagrees with spelled pitch.',
      'INVALID_ENVELOPE',
      path,
      { midi, step, alter, octave }
    );
  }

  const onsetDiv = integer(item.onsetDiv, 0, Number.MAX_SAFE_INTEGER, `${path}.onsetDiv`);
  const durationDiv = integer(item.durationDiv, 1, Number.MAX_SAFE_INTEGER, `${path}.durationDiv`);
  const divsPerQuarter = integer(item.divsPerQuarter, 1, Number.MAX_SAFE_INTEGER, `${path}.divsPerQuarter`);
  const onsetQuarter = finite(item.onsetQuarter, `${path}.onsetQuarter`);
  const durationQuarter = finite(item.durationQuarter, `${path}.durationQuarter`);
  if (
    !approx(onsetQuarter, onsetDiv / divsPerQuarter) ||
    !approx(durationQuarter, durationDiv / divsPerQuarter)
  ) {
    throw new PartituraMapperValidationError(
      'Partitura division and quarter timelines disagree.',
      'INVALID_TIMING',
      path,
      { onsetDiv, durationDiv, divsPerQuarter, onsetQuarter, durationQuarter }
    );
  }

  const ties = exact(item.ties, ['start','stop'], `${path}.ties`);
  let tuplet: Readonly<ValidatedPartituraTupletV1> | null = null;
  if (item.tuplet !== null) {
    const rawTuplet = exact(item.tuplet, ['actualNotes','normalNotes'], `${path}.tuplet`);
    tuplet = Object.freeze({
      actualNotes: integer(rawTuplet.actualNotes, 1, 32, `${path}.tuplet.actualNotes`),
      normalNotes: integer(rawTuplet.normalNotes, 1, 32, `${path}.tuplet.normalNotes`)
    });
  }

  return Object.freeze({
    sourceIndex: index,
    sourceNoteId: nullableString(item.sourceNoteId, `${path}.sourceNoteId`),
    pitch: midi,
    step,
    alter,
    octave,
    onsetBeat: finite(item.onsetBeat, `${path}.onsetBeat`),
    durationBeat: finite(item.durationBeat, `${path}.durationBeat`),
    onsetQuarter,
    durationQuarter,
    onsetDiv,
    durationDiv,
    voice: nullablePositiveInteger(item.voice, 1024, `${path}.voice`),
    staff: nullablePositiveInteger(item.staff, 128, `${path}.staff`),
    divsPerQuarter,
    keyFifths: integer(item.keyFifths, -7, 7, `${path}.keyFifths`),
    keyMode: item.keyMode === null
      ? null
      : integer(item.keyMode, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, `${path}.keyMode`),
    timeBeats: integer(item.timeBeats, 1, 32, `${path}.timeBeats`),
    timeBeatType: integer(item.timeBeatType, 1, 64, `${path}.timeBeatType`),
    ties: Object.freeze({
      start: bool(ties.start, `${path}.ties.start`),
      stop: bool(ties.stop, `${path}.ties.stop`)
    }),
    tiePrevSourceNoteId: nullableString(item.tiePrevSourceNoteId, `${path}.tiePrevSourceNoteId`),
    tieNextSourceNoteId: nullableString(item.tieNextSourceNoteId, `${path}.tieNextSourceNoteId`),
    tuplet,
    fingerings: strings(item.fingerings, `${path}.fingerings`),
    articulations: strings(item.articulations, `${path}.articulations`),
    ornaments: strings(item.ornaments, `${path}.ornaments`),
    isGrace: bool(item.isGrace, `${path}.isGrace`)
  });
};

const validateRest = (value: unknown, index: number): ValidatedPartituraRestV1 => {
  const path = `$.parts[].rests[${index}]`;
  const item = exact(value, [
    'sourceNoteId','onsetDiv','durationDiv','voice','staff','divsPerQuarter','symbolicDuration'
  ], path);
  return Object.freeze({
    sourceIndex: index,
    sourceNoteId: nullableString(item.sourceNoteId, `${path}.sourceNoteId`),
    onsetDiv: integer(item.onsetDiv, 0, Number.MAX_SAFE_INTEGER, `${path}.onsetDiv`),
    durationDiv: integer(item.durationDiv, 1, Number.MAX_SAFE_INTEGER, `${path}.durationDiv`),
    voice: nullablePositiveInteger(item.voice, 1024, `${path}.voice`),
    staff: nullablePositiveInteger(item.staff, 128, `${path}.staff`),
    divsPerQuarter: integer(item.divsPerQuarter, 1, Number.MAX_SAFE_INTEGER, `${path}.divsPerQuarter`),
    symbolicDuration: item.symbolicDuration
  });
};

const validateTimeSignature = (value: unknown, index: number): ValidatedPartituraTimeSignatureV1 => {
  const path = `$.parts[].timeSignatures[${index}]`;
  const item = exact(value, ['startDiv','beats','beatType'], path);
  const beatType = integer(item.beatType, 1, 64, `${path}.beatType`);
  if (![1,2,4,8,16,32,64].includes(beatType)) {
    throw new PartituraMapperValidationError(
      'Partitura time-signature denominator is unsupported.',
      'UNSUPPORTED_SEMANTIC',
      `${path}.beatType`
    );
  }
  return Object.freeze({
    startDiv: integer(item.startDiv, 0, Number.MAX_SAFE_INTEGER, `${path}.startDiv`),
    beats: integer(item.beats, 1, 32, `${path}.beats`),
    beatType
  });
};

const validateKeySignature = (value: unknown, index: number): ValidatedPartituraKeySignatureV1 => {
  const path = `$.parts[].keySignatures[${index}]`;
  const item = exact(value, ['startDiv','fifths','mode'], path);
  const mode = item.mode === null ? null : nonEmpty(item.mode, `${path}.mode`);
  if (mode !== null) {
    throw new PartituraMapperValidationError(
      'Key mode has no lossless canonical owner in the current notation contract.',
      'UNSUPPORTED_SEMANTIC',
      `${path}.mode`,
      { mode }
    );
  }
  return Object.freeze({
    startDiv: integer(item.startDiv, 0, Number.MAX_SAFE_INTEGER, `${path}.startDiv`),
    fifths: integer(item.fifths, -7, 7, `${path}.fifths`),
    mode
  });
};

const validateClef = (value: unknown, index: number): ValidatedPartituraClefV1 => {
  const path = `$.parts[].clefs[${index}]`;
  const item = exact(value, ['startDiv','staff','sign','line','octaveChange'], path);
  const signRaw = nonEmpty(item.sign, `${path}.sign`);
  if (!['G','F','C','percussion','TAB'].includes(signRaw)) {
    throw new PartituraMapperValidationError(
      'Partitura clef sign is unsupported.',
      'UNSUPPORTED_SEMANTIC',
      `${path}.sign`,
      { sign: signRaw }
    );
  }
  return Object.freeze({
    startDiv: integer(item.startDiv, 0, Number.MAX_SAFE_INTEGER, `${path}.startDiv`),
    staff: nullablePositiveInteger(item.staff, 128, `${path}.staff`),
    sign: signRaw as ValidatedPartituraClefV1['sign'],
    line: integer(item.line, 1, 5, `${path}.line`),
    octaveChange: item.octaveChange === null
      ? 0
      : integer(item.octaveChange, -2, 2, `${path}.octaveChange`)
  });
};

const validatePart = (value: unknown, index: number): ValidatedPartituraPartV1 => {
  const path = `$.parts[${index}]`;
  const item = exact(value, [
    'id','name','staffCount','measureCount','noteCount','restCount',
    'measures','notes','rests','timeSignatures','keySignatures','clefs'
  ], path);

  const measures = array(item.measures, `${path}.measures`).map((item, index) => validateMeasure(item, index));
  const notes = array(item.notes, `${path}.notes`).map((item, index) => validateNote(item, index));
  const rests = array(item.rests, `${path}.rests`).map((item, index) => validateRest(item, index));
  const staffCount = integer(item.staffCount, 1, 128, `${path}.staffCount`);

  if (integer(item.measureCount, 1, 2000, `${path}.measureCount`) !== measures.length) {
    throw new PartituraMapperValidationError('Partitura measureCount disagrees with measures.', 'INVALID_ENVELOPE', `${path}.measureCount`);
  }
  if (integer(item.noteCount, 0, 50000, `${path}.noteCount`) !== notes.length) {
    throw new PartituraMapperValidationError('Partitura noteCount disagrees with notes.', 'INVALID_ENVELOPE', `${path}.noteCount`);
  }
  if (integer(item.restCount, 0, 50000, `${path}.restCount`) !== rests.length) {
    throw new PartituraMapperValidationError('Partitura restCount disagrees with rests.', 'INVALID_ENVELOPE', `${path}.restCount`);
  }

  if (measures.length === 0 || measures[0]?.startDiv !== 0) {
    throw new PartituraMapperValidationError(
      'Partitura measure timeline must start at division zero.',
      'INVALID_TOPOLOGY',
      `${path}.measures`
    );
  }
  for (let measureIndex = 1; measureIndex < measures.length; measureIndex += 1) {
    const previous = measures[measureIndex - 1];
    const current = measures[measureIndex];
    if (previous === undefined || current === undefined || previous.endDiv !== current.startDiv) {
      throw new PartituraMapperValidationError(
        'Partitura measure timeline must be contiguous.',
        'INVALID_TOPOLOGY',
        `${path}.measures[${measureIndex}]`
      );
    }
  }

  for (const note of notes) {
    const staff = note.staff ?? 1;
    if (staff > staffCount) {
      throw new PartituraMapperValidationError('Partitura note staff exceeds staffCount.', 'INVALID_TOPOLOGY', `${path}.notes[${note.sourceIndex}].staff`);
    }
  }
  for (const rest of rests) {
    const staff = rest.staff ?? 1;
    if (staff > staffCount) {
      throw new PartituraMapperValidationError('Partitura rest staff exceeds staffCount.', 'INVALID_TOPOLOGY', `${path}.rests[${rest.sourceIndex}].staff`);
    }
  }

  return Object.freeze({
    id: nonEmpty(item.id, `${path}.id`),
    name: item.name === null ? null : nonEmpty(item.name, `${path}.name`),
    staffCount,
    measures: Object.freeze(measures),
    notes: Object.freeze(notes),
    rests: Object.freeze(rests),
    timeSignatures: Object.freeze(array(item.timeSignatures, `${path}.timeSignatures`).map((item, index) => validateTimeSignature(item, index))),
    keySignatures: Object.freeze(array(item.keySignatures, `${path}.keySignatures`).map((item, index) => validateKeySignature(item, index))),
    clefs: Object.freeze(array(item.clefs, `${path}.clefs`).map((item, index) => validateClef(item, index)))
  });
};

export const validatePartituraEnvelopeV1 = (value: unknown): Readonly<ValidatedPartituraEnvelopeV1> => {
  const root = exact(value, ['version','sourceIdentity','parts','preservedSymbols','diagnostics','provenance'], '$');
  let base: ReturnType<typeof validateNormalizedImportEnvelopeV1>;
  try {
    base = validateNormalizedImportEnvelopeV1(value);
  } catch (error) {
    throw new PartituraMapperValidationError(
      `Normalized import envelope contract validation failed: ${error instanceof Error ? error.message : String(error)}`,
      'INVALID_ENVELOPE',
      '$'
    );
  }

  const sourceIdentity = nonEmpty(root.sourceIdentity, '$.sourceIdentity');
  if (base.version !== NORMALIZED_IMPORT_ENVELOPE_VERSION) {
    throw new PartituraMapperValidationError('Normalized import envelope version is unsupported.', 'INVALID_ENVELOPE', '$.version');
  }
  if (base.preservedSymbols.length !== 0) {
    throw new PartituraMapperValidationError(
      'Partitura service envelope must not carry raw preserved-symbol authority.',
      'INVALID_ENVELOPE',
      '$.preservedSymbols'
    );
  }
  if (base.diagnostics.length !== 0) {
    throw new PartituraMapperValidationError(
      'Unclassified upstream diagnostics require fail-closed review.',
      'UPSTREAM_DIAGNOSTIC',
      '$.diagnostics',
      { count: base.diagnostics.length }
    );
  }

  const provenance = exact(root.provenance, ['parser','partituraVersion','sourceIdentity'], '$.provenance');
  if (provenance.parser !== 'partitura') {
    throw new PartituraMapperValidationError(
      'Normalized import parser provenance is not Partitura.',
      'INVALID_ENVELOPE',
      '$.provenance.parser'
    );
  }
  nonEmpty(provenance.partituraVersion, '$.provenance.partituraVersion');
  if (provenance.sourceIdentity !== sourceIdentity) {
    throw new PartituraMapperValidationError(
      'Partitura provenance source identity does not match the envelope.',
      'SOURCE_IDENTITY_MISMATCH',
      '$.provenance.sourceIdentity'
    );
  }

  const parts = array(root.parts, '$.parts').map((item, index) => validatePart(item, index));
  if (parts.length === 0) {
    throw new PartituraMapperValidationError(
      'Partitura envelope must contain at least one part.',
      'INVALID_TOPOLOGY',
      '$.parts'
    );
  }
  const measures = parts[0]?.measures.length ?? 0;
  if (parts.some(part => part.measures.length !== measures)) {
    throw new PartituraMapperValidationError(
      'All Partitura parts must have the same measure count for canonical V3 topology.',
      'INVALID_TOPOLOGY',
      '$.parts'
    );
  }

  return Object.freeze({ sourceIdentity, parts: Object.freeze(parts) });
};
