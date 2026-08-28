import { resolveSemanticAddress } from '../../addressing/src/index.js';
import type { EventAddress, NoteAddress, SemanticAddress } from '../../addressing/src/index.js';
import type { GuitarWorkspaceSourceMapEntry } from '../../guitar-workspace-contract/src/index.js';
import {
  createGuitarWorkspaceProjection,
  GUITAR_WORKSPACE_ENGINE_PART_ID,
  GUITAR_WORKSPACE_MUSICXML_VERSION,
  type GuitarWorkspaceProjection
} from '../../guitar-workspace-projection/src/index.js';
import {
  createNotationDocument,
  notationForMeasure,
  notationForNote,
  type NotationDocument,
  type TimeSignature
} from '../../notation-structure/src/index.js';
import type { NoteAtom, Rational, ScoreDocument, ScoreEvent, Voice } from '../../score-model/src/index.js';

export const GUITAR_WORKSPACE_RESULT_VERSION = '1.0.0' as const;
export const CANONICAL_TAB_RESULT_DOCUMENT_TYPE = 'CanonicalTabResult' as const;
export const CANONICAL_TAB_RESULT_SCHEMA_VERSION = '2.0.0' as const;
export const CANONICAL_TAB_ENGINE_NAME = 'musicxml-to-guitar-tab-engine' as const;
export const CANONICAL_TAB_SOURCE_DOCUMENT_TYPE = 'PolyphonicSourceModel' as const;
export const CANONICAL_TAB_SOURCE_CONTRACT_VERSION = '1.0.0' as const;
export const MAX_CANONICAL_TAB_RESULT_JSON_BYTES = 16 * 1024 * 1024;

const STANDARD_TUNING = Object.freeze([
  Object.freeze({ number: 1, pitch: 'E4', midi: 64 }),
  Object.freeze({ number: 2, pitch: 'B3', midi: 59 }),
  Object.freeze({ number: 3, pitch: 'G3', midi: 55 }),
  Object.freeze({ number: 4, pitch: 'D3', midi: 50 }),
  Object.freeze({ number: 5, pitch: 'A2', midi: 45 }),
  Object.freeze({ number: 6, pitch: 'E2', midi: 40 })
]);
const MINIMUM_FRET = 0;
const MAXIMUM_FRET = 20;
const REVIEW_STATES = new Set(['NOT_REVIEWED', 'APPROVED', 'REJECTED']);
const DECISION_TYPES = new Set(['PRESERVED', 'OMITTED', 'OCTAVE_DISPLACED', 'CHORD_REDUCED']);

export const guitarWorkspaceResultAuthorityProfile = Object.freeze({
  version: GUITAR_WORKSPACE_RESULT_VERSION,
  inputBoundary: 'BOUNDED_JSON_STRING',
  requiresCurrentProjection: true,
  rederivesProjectionBeforeAcceptance: true,
  sourceFactsMustMatchCurrentCanonicalRevision: true,
  resultStateDerivativeOnly: true,
  readOnly: true,
  engineInvocation: false,
  reverseCanonicalWriteAuthority: false,
  teacherReviewMutationAuthority: false,
  productionAuthority: false
});

export interface GuitarWorkspacePosition {
  readonly string: number;
  readonly fret: number;
}

export interface GuitarWorkspaceTargetPitch {
  readonly step: string;
  readonly alter: number;
  readonly octave: number;
  readonly midi: number;
  readonly written: string;
}

export interface GuitarWorkspaceResultEntry {
  readonly sourceEventId: string;
  readonly target: Readonly<NoteAddress>;
  readonly decisionId: string;
  readonly disposition: 'KEEP' | 'OMIT';
  readonly targetPitch: Readonly<GuitarWorkspaceTargetPitch> | null;
  readonly octaveShiftSemitones: number | null;
  readonly ruleId: string;
  readonly selectedPosition: Readonly<GuitarWorkspacePosition> | null;
  readonly selectedShapeId: string | null;
}

export interface GuitarWorkspaceFingerAssignment {
  readonly sourceEventId: string;
  readonly target: Readonly<NoteAddress>;
  readonly finger: number;
}

export interface GuitarWorkspaceBarre {
  readonly finger: number;
  readonly fret: number;
  readonly startString: number;
  readonly endString: number;
  readonly stringSpan: number;
  readonly kind: 'FULL_BARRE' | 'PARTIAL_BARRE';
}

export interface GuitarWorkspaceSelectedShape {
  readonly selectedShapeId: string;
  readonly sourceGroupId: string;
  readonly targets: readonly Readonly<NoteAddress>[];
  readonly fingerAssignments: readonly Readonly<GuitarWorkspaceFingerAssignment>[];
  readonly barres: readonly Readonly<GuitarWorkspaceBarre>[];
  readonly physicalStatus: 'PLAYABLE_WITHIN_POLICY';
}

export interface GuitarWorkspaceResult {
  readonly contractVersion: typeof GUITAR_WORKSPACE_RESULT_VERSION;
  readonly documentId: string;
  readonly revisionId: string;
  readonly engine: Readonly<{ readonly name: typeof CANONICAL_TAB_ENGINE_NAME; readonly version: string }>;
  readonly teacherReviewStatus: 'NOT_REVIEWED' | 'APPROVED' | 'REJECTED';
  readonly entries: readonly Readonly<GuitarWorkspaceResultEntry>[];
  readonly selectedShapes: readonly Readonly<GuitarWorkspaceSelectedShape>[];
}

export type GuitarWorkspaceResultErrorCode =
  | 'INVALID_JSON'
  | 'RESULT_SIZE_LIMIT'
  | 'INVALID_RESULT_SHAPE'
  | 'UNSUPPORTED_RESULT_CONTRACT'
  | 'STALE_PROJECTION'
  | 'PROJECTION_MISMATCH'
  | 'SOURCE_FACT_MISMATCH'
  | 'UNKNOWN_SOURCE_EVENT'
  | 'INVALID_GUITAR_RESULT'
  | 'INVALID_SELECTION_RESULT';

export class GuitarWorkspaceResultError extends Error {
  readonly code: GuitarWorkspaceResultErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, code: GuitarWorkspaceResultErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'GuitarWorkspaceResultError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

type RecordValue = Record<string, unknown>;

const fail = (message: string, code: GuitarWorkspaceResultErrorCode, details: Record<string, unknown> = {}): never => {
  throw new GuitarWorkspaceResultError(message, code, details);
};

const object = (value: unknown, keys: readonly string[], path: string): RecordValue => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return fail(`${path} must be an object.`, 'INVALID_RESULT_SHAPE', { path });
  }
  const record = value as RecordValue;
  const expected = [...keys].sort();
  const observed = Object.keys(record).sort();
  if (JSON.stringify(expected) !== JSON.stringify(observed)) {
    return fail(`${path} has an invalid field set.`, 'INVALID_RESULT_SHAPE', { path, expected, observed });
  }
  return record;
};

const array = (value: unknown, path: string): unknown[] => {
  if (!Array.isArray(value)) return fail(`${path} must be an array.`, 'INVALID_RESULT_SHAPE', { path });
  return value;
};

const string = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || value.length === 0) return fail(`${path} must be a non-empty string.`, 'INVALID_RESULT_SHAPE', { path });
  return value;
};

const nullableString = (value: unknown, path: string): string | null => value === null ? null : string(value, path);

const integer = (value: unknown, path: string, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER): number => {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || (value as number) < min || (value as number) > max) {
    return fail(`${path} must be a safe integer in the admitted range.`, 'INVALID_RESULT_SHAPE', { path, min, max, value });
  }
  return value as number;
};

const boolean = (value: unknown, path: string): boolean => {
  if (typeof value !== 'boolean') return fail(`${path} must be boolean.`, 'INVALID_RESULT_SHAPE', { path });
  return value;
};

const same = (actual: unknown, expected: unknown, path: string, code: GuitarWorkspaceResultErrorCode = 'SOURCE_FACT_MISMATCH'): void => {
  if (!Object.is(actual, expected)) fail(`${path} does not match the current Guitar Workspace source projection.`, code, { path, expected, actual });
};

const absBig = (value: bigint): bigint => value < 0n ? -value : value;
const gcd = (left: bigint, right: bigint): bigint => {
  let a = absBig(left);
  let b = absBig(right);
  while (b !== 0n) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a;
};
const lcm = (left: bigint, right: bigint): bigint => left === 0n || right === 0n ? 0n : absBig((left / gcd(left, right)) * right);
const timingFactor = (value: Rational): bigint => BigInt(value.denominator) / gcd(BigInt(value.denominator), 4n);
const meterFactor = (time: TimeSignature): bigint => BigInt(time.beatType) / gcd(BigInt(time.beatType), 4n);
const units = (value: Rational, divisions: number, path: string): number => {
  const numerator = BigInt(value.numerator) * 4n * BigInt(divisions);
  const denominator = BigInt(value.denominator);
  if (numerator % denominator !== 0n) return fail(`${path} is not exactly representable.`, 'SOURCE_FACT_MISMATCH', { path });
  const result = numerator / denominator;
  if (result < 0n || result > BigInt(Number.MAX_SAFE_INTEGER)) return fail(`${path} exceeds safe integer timing.`, 'SOURCE_FACT_MISMATCH', { path });
  return Number(result);
};

const pitchMidi = (pitch: { readonly step: string; readonly alter: number; readonly octave: number }): number => {
  const offsets: Readonly<Record<string, number>> = Object.freeze({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 });
  const offset = offsets[pitch.step];
  if (offset === undefined) return fail('Pitch step is invalid.', 'SOURCE_FACT_MISMATCH', { step: pitch.step });
  const midi = (pitch.octave + 1) * 12 + offset + pitch.alter;
  if (!Number.isInteger(midi) || midi < 0 || midi > 127) return fail('Pitch is outside MIDI range.', 'SOURCE_FACT_MISMATCH', { pitch });
  return midi;
};

const writtenPitch = (pitch: { readonly step: string; readonly alter: number; readonly octave: number }): string => {
  const accidental = ({ '-2': 'bb', '-1': 'b', 0: '', 1: '#', 2: '##' } as const)[String(pitch.alter) as '-2' | '-1' | '0' | '1' | '2'];
  if (accidental === undefined) return fail('Pitch alter is invalid.', 'SOURCE_FACT_MISMATCH', { alter: pitch.alter });
  return `${pitch.step}${accidental}${pitch.octave}`;
};

const validatePitchShape = (value: unknown, path: string): GuitarWorkspaceTargetPitch => {
  const pitch = object(value, ['step', 'alter', 'octave', 'midi', 'written'], path);
  const step = string(pitch.step, `${path}.step`);
  if (!/^[A-G]$/.test(step)) fail(`${path}.step is invalid.`, 'INVALID_SELECTION_RESULT', { path });
  const alter = integer(pitch.alter, `${path}.alter`, -2, 2);
  const octave = integer(pitch.octave, `${path}.octave`, -1, 9);
  const midi = integer(pitch.midi, `${path}.midi`, 0, 127);
  const written = string(pitch.written, `${path}.written`);
  same(midi, pitchMidi({ step, alter, octave }), `${path}.midi`, 'INVALID_SELECTION_RESULT');
  same(written, writtenPitch({ step, alter, octave }), `${path}.written`, 'INVALID_SELECTION_RESULT');
  return Object.freeze({ step, alter, octave, midi, written });
};

const sorted = <T extends { readonly ordinal: number }>(values: readonly T[]): readonly T[] => [...values].sort((a, b) => a.ordinal - b.ordinal);

const sourceMapIdentity = (entry: GuitarWorkspaceSourceMapEntry): string => JSON.stringify(entry);

const ensureCurrentProjection = (
  score: ScoreDocument,
  notation: NotationDocument,
  projection: GuitarWorkspaceProjection
): Readonly<GuitarWorkspaceProjection> => {
  if (projection.documentId !== score.id || projection.revisionId !== score.revision.id) {
    return fail('Guitar Workspace projection belongs to another score revision.', 'STALE_PROJECTION', {
      expectedDocumentId: score.id,
      expectedRevisionId: score.revision.id,
      observedDocumentId: projection.documentId,
      observedRevisionId: projection.revisionId
    });
  }
  const expected = createGuitarWorkspaceProjection(score, notation);
  if (
    expected.musicXml !== projection.musicXml
    || expected.sourceMap.entries.length !== projection.sourceMap.entries.length
    || expected.sourceMap.entries.some((entry, index) => sourceMapIdentity(entry) !== sourceMapIdentity(projection.sourceMap.entries[index]!))
  ) {
    return fail('Guitar Workspace projection is not the deterministic projection for the current score revision.', 'PROJECTION_MISMATCH');
  }
  return expected;
};

interface CanonicalContext {
  readonly target: Readonly<SemanticAddress>;
  readonly event: ScoreEvent;
  readonly note: NoteAtom | null;
  readonly voice: Voice;
  readonly staffNumber: number;
  readonly measureIndex: number;
  readonly measureNumber: string;
  readonly chordWithPrevious: boolean;
}

const buildContexts = (
  score: ScoreDocument,
  projection: GuitarWorkspaceProjection
): ReadonlyMap<string, CanonicalContext> => {
  const part = score.parts[0]!;
  const staves = sorted(part.staves);
  const referenceMeasures = sorted(staves[0]!.measures);
  const contexts = new Map<string, CanonicalContext>();

  for (const entry of projection.sourceMap.entries) {
    const target = entry.target;
    const staffIndex = staves.findIndex((staff) => staff.id === target.staffId);
    if (staffIndex < 0) return fail('Source-map target staff is not present.', 'SOURCE_FACT_MISMATCH', { sourceEventId: entry.sourceEventId });
    const staff = staves[staffIndex]!;
    const measure = staff.measures.find((candidate) => candidate.id === target.measureId);
    if (measure === undefined) return fail('Source-map target measure is not present.', 'SOURCE_FACT_MISMATCH', { sourceEventId: entry.sourceEventId });
    const measureIndex = referenceMeasures.findIndex((candidate) => candidate.ordinal === measure.ordinal && candidate.displayNumber === measure.displayNumber);
    if (measureIndex < 0 || measure.displayNumber === null) return fail('Source-map target measure does not align with projected measures.', 'SOURCE_FACT_MISMATCH', { sourceEventId: entry.sourceEventId });
    const voice = measure.voices.find((candidate) => candidate.id === target.voiceId);
    if (voice === undefined) return fail('Source-map target voice is not present.', 'SOURCE_FACT_MISMATCH', { sourceEventId: entry.sourceEventId });
    const event = voice.events.find((candidate) => candidate.id === target.eventId);
    if (event === undefined) return fail('Source-map target event is not present.', 'SOURCE_FACT_MISMATCH', { sourceEventId: entry.sourceEventId });

    let note: NoteAtom | null = null;
    let chordWithPrevious = false;
    if (target.kind === 'note') {
      const resolved = resolveSemanticAddress(score, target);
      if (resolved.kind !== 'note') return fail('Source-map note target did not resolve as a note.', 'SOURCE_FACT_MISMATCH', { sourceEventId: entry.sourceEventId });
      note = resolved.value;
      if (event.kind === 'chord') {
        const index = event.notes.findIndex((candidate) => candidate.id === note!.id);
        if (index < 0) return fail('Source-map chord tone is not present.', 'SOURCE_FACT_MISMATCH', { sourceEventId: entry.sourceEventId });
        chordWithPrevious = index > 0;
      } else if (event.kind !== 'note') {
        return fail('Source-map note target belongs to a non-note event.', 'SOURCE_FACT_MISMATCH', { sourceEventId: entry.sourceEventId });
      }
    } else if (target.kind !== 'event' || event.kind !== 'rest') {
      return fail('Engine source-map event targets are admitted only for canonical rests.', 'SOURCE_FACT_MISMATCH', { sourceEventId: entry.sourceEventId });
    }

    contexts.set(entry.sourceEventId, Object.freeze({
      target,
      event,
      note,
      voice,
      staffNumber: staffIndex + 1,
      measureIndex,
      measureNumber: measure.displayNumber,
      chordWithPrevious
    }));
  }
  return contexts;
};

const resolveMeter = (
  notation: NotationDocument,
  measureIds: readonly string[],
  active: TimeSignature | null,
  measureIndex: number
): TimeSignature => {
  const direct = measureIds.map((measureId) => notationForMeasure(notation, measureId)?.timeSignature ?? null);
  const present = direct.filter((item): item is TimeSignature => item !== null);
  if (present.length === 0) {
    if (active === null) return fail('Current projection has no active meter.', 'SOURCE_FACT_MISMATCH', { measureIndex });
    return active;
  }
  if (present.length !== direct.length || present.some((item) => item.beats !== present[0]!.beats || item.beatType !== present[0]!.beatType)) {
    return fail('Current projection contains inconsistent aligned-staff meter.', 'SOURCE_FACT_MISMATCH', { measureIndex });
  }
  return present[0]!;
};

const expectedDivisions = (staffMeasures: readonly { readonly voices: readonly Voice[] }[], time: TimeSignature): number => {
  let divisions = meterFactor(time);
  for (const measure of staffMeasures) for (const voice of measure.voices) for (const event of voice.events) {
    divisions = lcm(divisions, timingFactor(event.onset));
    divisions = lcm(divisions, timingFactor(event.duration));
  }
  if (divisions > 16_384n) return fail('Current projection divisions exceed E8-B bounds.', 'SOURCE_FACT_MISMATCH');
  return Number(divisions);
};

const validateSourceFacts = (
  result: RecordValue,
  score: ScoreDocument,
  notation: NotationDocument,
  projection: GuitarWorkspaceProjection,
  contexts: ReadonlyMap<string, CanonicalContext>
): readonly Readonly<NoteAddress>[] => {
  const part = score.parts[0]!;
  const staves = sorted(part.staves);
  const measuresByStaff = staves.map((staff) => sorted(staff.measures));
  const referenceMeasures = measuresByStaff[0]!;
  const expectedEntriesByMeasure = new Map<number, GuitarWorkspaceSourceMapEntry[]>();
  for (const entry of projection.sourceMap.entries) {
    const context = contexts.get(entry.sourceEventId)!;
    const bucket = expectedEntriesByMeasure.get(context.measureIndex) ?? [];
    bucket.push(entry);
    expectedEntriesByMeasure.set(context.measureIndex, bucket);
  }

  const measures = array(result.measures, 'canonicalTabResult.measures');
  same(measures.length, referenceMeasures.length, 'canonicalTabResult.measures.length');
  let activeTime: TimeSignature | null = null;
  const noteTargets: Readonly<NoteAddress>[] = [];

  measures.forEach((rawMeasure, measureIndex) => {
    const path = `canonicalTabResult.measures[${measureIndex}]`;
    const measure = object(rawMeasure, ['measureId', 'index', 'number', 'implicit', 'divisions', 'timeSignature', 'expectedDurationDivisions', 'events'], path);
    const staffMeasures = measuresByStaff.map((items) => items[measureIndex]!);
    const reference = staffMeasures[0]!;
    same(integer(measure.index, `${path}.index`, 0), measureIndex, `${path}.index`);
    same(string(measure.measureId, `${path}.measureId`), `${GUITAR_WORKSPACE_ENGINE_PART_ID}:measure:${measureIndex}`, `${path}.measureId`);
    same(string(measure.number, `${path}.number`), reference.displayNumber, `${path}.number`);
    same(boolean(measure.implicit, `${path}.implicit`), false, `${path}.implicit`);

    activeTime = resolveMeter(notation, staffMeasures.map((item) => item.id), activeTime, measureIndex);
    const time = object(measure.timeSignature, ['beats', 'beatType'], `${path}.timeSignature`);
    same(integer(time.beats, `${path}.timeSignature.beats`, 1), activeTime.beats, `${path}.timeSignature.beats`);
    same(integer(time.beatType, `${path}.timeSignature.beatType`, 1), activeTime.beatType, `${path}.timeSignature.beatType`);
    const divisions = integer(measure.divisions, `${path}.divisions`, 1, 16_384);
    same(divisions, expectedDivisions(staffMeasures, activeTime), `${path}.divisions`);
    const expectedDuration = divisions * activeTime.beats * 4 / activeTime.beatType;
    if (!Number.isSafeInteger(expectedDuration)) return fail('Expected measure duration is not integral.', 'SOURCE_FACT_MISMATCH', { measureIndex });
    same(integer(measure.expectedDurationDivisions, `${path}.expectedDurationDivisions`, 1), expectedDuration, `${path}.expectedDurationDivisions`);

    const events = array(measure.events, `${path}.events`);
    const expectedEntries = expectedEntriesByMeasure.get(measureIndex) ?? [];
    same(events.length, expectedEntries.length, `${path}.events.length`);
    events.forEach((rawEvent, eventIndex) => {
      const eventPath = `${path}.events[${eventIndex}]`;
      const expectedEntry = expectedEntries[eventIndex]!;
      const context = contexts.get(expectedEntry.sourceEventId)!;
      const rawRecord = rawEvent as RecordValue;
      const type = rawRecord?.type;
      const keys = type === 'note'
        ? ['sourceEventId', 'sourceOrder', 'type', 'voice', 'staff', 'onsetDivisions', 'durationDivisions', 'pitch', 'tieStart', 'tieStop', 'source']
        : ['sourceEventId', 'sourceOrder', 'type', 'voice', 'staff', 'onsetDivisions', 'durationDivisions', 'tieStart', 'tieStop', 'source'];
      const event = object(rawEvent, keys, eventPath);
      same(string(event.sourceEventId, `${eventPath}.sourceEventId`), expectedEntry.sourceEventId, `${eventPath}.sourceEventId`);
      same(integer(event.sourceOrder, `${eventPath}.sourceOrder`, 0), eventIndex, `${eventPath}.sourceOrder`);
      same(string(event.voice, `${eventPath}.voice`), String(context.voice.ordinal), `${eventPath}.voice`);
      same(integer(event.staff, `${eventPath}.staff`, 1, 2), context.staffNumber, `${eventPath}.staff`);
      same(integer(event.onsetDivisions, `${eventPath}.onsetDivisions`, 0), units(context.event.onset, divisions, `${eventPath}.onsetDivisions`), `${eventPath}.onsetDivisions`);
      same(integer(event.durationDivisions, `${eventPath}.durationDivisions`, 1), units(context.event.duration, divisions, `${eventPath}.durationDivisions`), `${eventPath}.durationDivisions`);

      const source = object(event.source, ['partId', 'measureIndex', 'measureNumber', 'noteIndex', 'chordWithPrevious'], `${eventPath}.source`);
      same(string(source.partId, `${eventPath}.source.partId`), GUITAR_WORKSPACE_ENGINE_PART_ID, `${eventPath}.source.partId`);
      same(integer(source.measureIndex, `${eventPath}.source.measureIndex`, 0), measureIndex, `${eventPath}.source.measureIndex`);
      same(string(source.measureNumber, `${eventPath}.source.measureNumber`), context.measureNumber, `${eventPath}.source.measureNumber`);
      same(integer(source.noteIndex, `${eventPath}.source.noteIndex`, 0), eventIndex, `${eventPath}.source.noteIndex`);
      same(boolean(source.chordWithPrevious, `${eventPath}.source.chordWithPrevious`), context.chordWithPrevious, `${eventPath}.source.chordWithPrevious`);

      if (context.note === null) {
        same(event.type, 'rest', `${eventPath}.type`);
        same(boolean(event.tieStart, `${eventPath}.tieStart`), false, `${eventPath}.tieStart`);
        same(boolean(event.tieStop, `${eventPath}.tieStop`), false, `${eventPath}.tieStop`);
      } else {
        same(event.type, 'note', `${eventPath}.type`);
        const pitch = validatePitchShape(event.pitch, `${eventPath}.pitch`);
        same(pitch.step, context.note.pitch.step, `${eventPath}.pitch.step`);
        same(pitch.alter, context.note.pitch.alter, `${eventPath}.pitch.alter`);
        same(pitch.octave, context.note.pitch.octave, `${eventPath}.pitch.octave`);
        const ties = notationForNote(notation, context.note.id)?.ties ?? [];
        same(boolean(event.tieStart, `${eventPath}.tieStart`), ties.some((tie) => tie.type === 'start'), `${eventPath}.tieStart`);
        same(boolean(event.tieStop, `${eventPath}.tieStop`), ties.some((tie) => tie.type === 'stop'), `${eventPath}.tieStop`);
        noteTargets.push(expectedEntry.target as NoteAddress);
      }
    });
  });
  return Object.freeze(noteTargets);
};

const validateEnvelope = (result: RecordValue): { readonly engineVersion: string; readonly review: 'NOT_REVIEWED' | 'APPROVED' | 'REJECTED' } => {
  same(result.documentType, CANONICAL_TAB_RESULT_DOCUMENT_TYPE, 'canonicalTabResult.documentType', 'UNSUPPORTED_RESULT_CONTRACT');
  same(result.schemaVersion, CANONICAL_TAB_RESULT_SCHEMA_VERSION, 'canonicalTabResult.schemaVersion', 'UNSUPPORTED_RESULT_CONTRACT');

  const engine = object(result.engine, ['name', 'version'], 'canonicalTabResult.engine');
  same(string(engine.name, 'canonicalTabResult.engine.name'), CANONICAL_TAB_ENGINE_NAME, 'canonicalTabResult.engine.name', 'UNSUPPORTED_RESULT_CONTRACT');
  const engineVersion = string(engine.version, 'canonicalTabResult.engine.version');

  const source = object(result.source, ['documentType', 'contractVersion', 'format', 'musicXmlVersion', 'partId'], 'canonicalTabResult.source');
  same(source.documentType, CANONICAL_TAB_SOURCE_DOCUMENT_TYPE, 'canonicalTabResult.source.documentType', 'UNSUPPORTED_RESULT_CONTRACT');
  same(source.contractVersion, CANONICAL_TAB_SOURCE_CONTRACT_VERSION, 'canonicalTabResult.source.contractVersion', 'UNSUPPORTED_RESULT_CONTRACT');
  same(source.format, 'score-partwise', 'canonicalTabResult.source.format', 'UNSUPPORTED_RESULT_CONTRACT');
  same(nullableString(source.musicXmlVersion, 'canonicalTabResult.source.musicXmlVersion'), GUITAR_WORKSPACE_MUSICXML_VERSION, 'canonicalTabResult.source.musicXmlVersion', 'UNSUPPORTED_RESULT_CONTRACT');
  same(string(source.partId, 'canonicalTabResult.source.partId'), GUITAR_WORKSPACE_ENGINE_PART_ID, 'canonicalTabResult.source.partId');

  const review = object(result.review, ['teacherReviewStatus'], 'canonicalTabResult.review');
  const reviewState = string(review.teacherReviewStatus, 'canonicalTabResult.review.teacherReviewStatus');
  if (!REVIEW_STATES.has(reviewState)) fail('Teacher review state is unsupported.', 'INVALID_RESULT_SHAPE', { reviewState });

  const guitar = object(result.guitar, ['contractVersion', 'tuning', 'minimumFret', 'maximumFret'], 'canonicalTabResult.guitar');
  same(guitar.contractVersion, '1.0.0', 'canonicalTabResult.guitar.contractVersion', 'INVALID_GUITAR_RESULT');
  same(integer(guitar.minimumFret, 'canonicalTabResult.guitar.minimumFret', 0), MINIMUM_FRET, 'canonicalTabResult.guitar.minimumFret', 'INVALID_GUITAR_RESULT');
  same(integer(guitar.maximumFret, 'canonicalTabResult.guitar.maximumFret', 0), MAXIMUM_FRET, 'canonicalTabResult.guitar.maximumFret', 'INVALID_GUITAR_RESULT');
  const tuning = array(guitar.tuning, 'canonicalTabResult.guitar.tuning');
  same(tuning.length, STANDARD_TUNING.length, 'canonicalTabResult.guitar.tuning.length', 'INVALID_GUITAR_RESULT');
  tuning.forEach((raw, index) => {
    const entry = object(raw, ['number', 'pitch', 'midi'], `canonicalTabResult.guitar.tuning[${index}]`);
    const expected = STANDARD_TUNING[index]!;
    same(integer(entry.number, `canonicalTabResult.guitar.tuning[${index}].number`, 1, 6), expected.number, `canonicalTabResult.guitar.tuning[${index}].number`, 'INVALID_GUITAR_RESULT');
    same(string(entry.pitch, `canonicalTabResult.guitar.tuning[${index}].pitch`), expected.pitch, `canonicalTabResult.guitar.tuning[${index}].pitch`, 'INVALID_GUITAR_RESULT');
    same(integer(entry.midi, `canonicalTabResult.guitar.tuning[${index}].midi`, 0, 127), expected.midi, `canonicalTabResult.guitar.tuning[${index}].midi`, 'INVALID_GUITAR_RESULT');
  });

  return Object.freeze({ engineVersion, review: reviewState as 'NOT_REVIEWED' | 'APPROVED' | 'REJECTED' });
};

const validatePolicyProvenanceShape = (value: unknown): void => {
  const root = object(value, ['arrangement', 'reduction', 'voicing', 'leftHand', 'physicalValidation', 'finalSelection'], 'canonicalTabResult.policyProvenance');
  const arrangement = object(root.arrangement, ['documentType', 'contractVersion'], 'canonicalTabResult.policyProvenance.arrangement');
  same(arrangement.documentType, 'GuitarArrangementPlan', 'canonicalTabResult.policyProvenance.arrangement.documentType', 'UNSUPPORTED_RESULT_CONTRACT');
  same(arrangement.contractVersion, '1.0.0', 'canonicalTabResult.policyProvenance.arrangement.contractVersion', 'UNSUPPORTED_RESULT_CONTRACT');
  const reduction = object(root.reduction, ['documentType', 'contractVersion', 'policy', 'octaveTieBreak'], 'canonicalTabResult.policyProvenance.reduction');
  same(reduction.documentType, 'DeterministicReductionPlan', 'canonicalTabResult.policyProvenance.reduction.documentType', 'UNSUPPORTED_RESULT_CONTRACT');
  same(reduction.contractVersion, '1.0.0', 'canonicalTabResult.policyProvenance.reduction.contractVersion', 'UNSUPPORTED_RESULT_CONTRACT');
  same(reduction.policy, 'STANDARD_GUITAR_REGISTER_20_FRET_1.0', 'canonicalTabResult.policyProvenance.reduction.policy', 'UNSUPPORTED_RESULT_CONTRACT');
  same(reduction.octaveTieBreak, 'DOWNWARD_TIE_BREAK_1.0', 'canonicalTabResult.policyProvenance.reduction.octaveTieBreak', 'UNSUPPORTED_RESULT_CONTRACT');
  const voicing = object(root.voicing, ['documentType', 'contractVersion', 'policy'], 'canonicalTabResult.policyProvenance.voicing');
  same(voicing.documentType, 'GuitarVoicingCandidateModel', 'canonicalTabResult.policyProvenance.voicing.documentType', 'UNSUPPORTED_RESULT_CONTRACT');
  same(voicing.contractVersion, '1.0.0', 'canonicalTabResult.policyProvenance.voicing.contractVersion', 'UNSUPPORTED_RESULT_CONTRACT');
  same(voicing.policy, 'STANDARD_SIX_STRING_DISTINCT_STRING_1.0', 'canonicalTabResult.policyProvenance.voicing.policy', 'UNSUPPORTED_RESULT_CONTRACT');
  const leftHand = object(root.leftHand, ['documentType', 'contractVersion', 'policy'], 'canonicalTabResult.policyProvenance.leftHand');
  same(leftHand.documentType, 'LeftHandShapeModel', 'canonicalTabResult.policyProvenance.leftHand.documentType', 'UNSUPPORTED_RESULT_CONTRACT');
  same(leftHand.contractVersion, '1.0.0', 'canonicalTabResult.policyProvenance.leftHand.contractVersion', 'UNSUPPORTED_RESULT_CONTRACT');
  same(leftHand.policy, 'ORDERED_FRET_FINGER_BARRE_1.0', 'canonicalTabResult.policyProvenance.leftHand.policy', 'UNSUPPORTED_RESULT_CONTRACT');
  const physical = object(root.physicalValidation, ['documentType', 'contractVersion', 'policy', 'configuration'], 'canonicalTabResult.policyProvenance.physicalValidation');
  same(physical.documentType, 'PhysicalPlayabilityValidation', 'canonicalTabResult.policyProvenance.physicalValidation.documentType', 'UNSUPPORTED_RESULT_CONTRACT');
  same(physical.contractVersion, '2.0.0', 'canonicalTabResult.policyProvenance.physicalValidation.contractVersion', 'UNSUPPORTED_RESULT_CONTRACT');
  same(physical.policy, 'CONSERVATIVE_STATIC_LEFT_HAND_2.0', 'canonicalTabResult.policyProvenance.physicalValidation.policy', 'UNSUPPORTED_RESULT_CONTRACT');
  const configuration = object(physical.configuration, ['maximumStaticFretSpan', 'maximumExtraFretReach'], 'canonicalTabResult.policyProvenance.physicalValidation.configuration');
  same(integer(configuration.maximumStaticFretSpan, 'canonicalTabResult.policyProvenance.physicalValidation.configuration.maximumStaticFretSpan', 0), 4, 'canonicalTabResult.policyProvenance.physicalValidation.configuration.maximumStaticFretSpan', 'UNSUPPORTED_RESULT_CONTRACT');
  same(integer(configuration.maximumExtraFretReach, 'canonicalTabResult.policyProvenance.physicalValidation.configuration.maximumExtraFretReach', 0), 1, 'canonicalTabResult.policyProvenance.physicalValidation.configuration.maximumExtraFretReach', 'UNSUPPORTED_RESULT_CONTRACT');
  const finalSelection = object(root.finalSelection, ['policyId', 'policyVersion'], 'canonicalTabResult.policyProvenance.finalSelection');
  string(finalSelection.policyId, 'canonicalTabResult.policyProvenance.finalSelection.policyId');
  string(finalSelection.policyVersion, 'canonicalTabResult.policyProvenance.finalSelection.policyVersion');
};

const validateGroups = (result: RecordValue, noteSourceIds: readonly string[]): ReadonlyMap<string, readonly string[]> => {
  const known = new Set(noteSourceIds);
  const groups = new Map<string, readonly string[]>();
  array(result.simultaneousGroups, 'canonicalTabResult.simultaneousGroups').forEach((raw, index) => {
    const path = `canonicalTabResult.simultaneousGroups[${index}]`;
    const group = object(raw, ['groupId', 'measureId', 'onsetDivisions', 'sourceEventIds'], path);
    const groupId = string(group.groupId, `${path}.groupId`);
    string(group.measureId, `${path}.measureId`);
    integer(group.onsetDivisions, `${path}.onsetDivisions`, 0);
    const ids = array(group.sourceEventIds, `${path}.sourceEventIds`).map((id, memberIndex) => string(id, `${path}.sourceEventIds[${memberIndex}]`));
    if (ids.length < 2 || ids.some((id) => !known.has(id)) || new Set(ids).size !== ids.length || groups.has(groupId)) {
      fail('Simultaneous group membership is invalid.', 'INVALID_SELECTION_RESULT', { groupId });
    }
    groups.set(groupId, Object.freeze(ids));
  });
  return groups;
};

const validateDecisions = (result: RecordValue, noteSourceIds: readonly string[], groups: ReadonlyMap<string, readonly string[]>): ReadonlyMap<string, RecordValue> => {
  const known = new Set(noteSourceIds);
  const covered = new Set<string>();
  const decisions = new Map<string, RecordValue>();
  array(result.arrangementDecisions, 'canonicalTabResult.arrangementDecisions').forEach((raw, index) => {
    const path = `canonicalTabResult.arrangementDecisions[${index}]`;
    const decision = object(raw, ['decisionId', 'decisionType', 'sourceEventIds', 'sourceGroupId'], path);
    const decisionId = string(decision.decisionId, `${path}.decisionId`);
    same(decisionId, `${GUITAR_WORKSPACE_ENGINE_PART_ID}:arrangement-decision:${index}`, `${path}.decisionId`, 'INVALID_SELECTION_RESULT');
    const decisionType = string(decision.decisionType, `${path}.decisionType`);
    if (!DECISION_TYPES.has(decisionType)) fail('Arrangement decision type is unsupported.', 'INVALID_SELECTION_RESULT', { decisionType });
    const ids = array(decision.sourceEventIds, `${path}.sourceEventIds`).map((id, memberIndex) => string(id, `${path}.sourceEventIds[${memberIndex}]`));
    if (ids.length === 0 || ids.some((id) => !known.has(id) || covered.has(id))) fail('Arrangement decision coverage is invalid.', 'INVALID_SELECTION_RESULT', { decisionId });
    ids.forEach((id) => covered.add(id));
    if (decisionType === 'CHORD_REDUCED') {
      const groupId = string(decision.sourceGroupId, `${path}.sourceGroupId`);
      const group = groups.get(groupId);
      if (group === undefined || JSON.stringify(group) !== JSON.stringify(ids)) fail('Chord reduction decision group is invalid.', 'INVALID_SELECTION_RESULT', { decisionId });
    } else {
      same(decision.sourceGroupId, null, `${path}.sourceGroupId`, 'INVALID_SELECTION_RESULT');
      same(ids.length, 1, `${path}.sourceEventIds.length`, 'INVALID_SELECTION_RESULT');
    }
    decisions.set(decisionId, decision);
  });
  same(covered.size, noteSourceIds.length, 'canonicalTabResult.arrangementDecisions.coverage', 'INVALID_SELECTION_RESULT');
  return decisions;
};

const validateDispositions = (
  result: RecordValue,
  score: ScoreDocument,
  noteTargets: readonly Readonly<NoteAddress>[],
  projection: GuitarWorkspaceProjection,
  decisions: ReadonlyMap<string, RecordValue>
): { readonly entries: readonly Readonly<GuitarWorkspaceResultEntry>[]; readonly bySourceId: ReadonlyMap<string, GuitarWorkspaceResultEntry> } => {
  const noteMapEntries = projection.sourceMap.entries.filter((entry) => entry.target.kind === 'note');
  same(noteMapEntries.length, noteTargets.length, 'projection.noteSourceMap');
  const rawEntries = array(result.noteDispositions, 'canonicalTabResult.noteDispositions');
  same(rawEntries.length, noteTargets.length, 'canonicalTabResult.noteDispositions.length', 'INVALID_SELECTION_RESULT');
  const output: Readonly<GuitarWorkspaceResultEntry>[] = [];
  const bySourceId = new Map<string, GuitarWorkspaceResultEntry>();

  rawEntries.forEach((raw, index) => {
    const path = `canonicalTabResult.noteDispositions[${index}]`;
    const entry = object(raw, ['sourceEventId', 'decisionId', 'disposition', 'targetPitch', 'octaveShiftSemitones', 'ruleId', 'selectedPosition', 'selectedShapeId'], path);
    const mapEntry = noteMapEntries[index]!;
    const sourceEventId = string(entry.sourceEventId, `${path}.sourceEventId`);
    same(sourceEventId, mapEntry.sourceEventId, `${path}.sourceEventId`, 'UNKNOWN_SOURCE_EVENT');
    const target = mapEntry.target as NoteAddress;
    const resolved = resolveSemanticAddress(score, target);
    if (resolved.kind !== 'note') return fail('Disposition target is not a current canonical note.', 'UNKNOWN_SOURCE_EVENT', { sourceEventId });
    const sourcePitch = resolved.value.pitch;
    const sourceMidi = pitchMidi(sourcePitch);
    const decisionId = string(entry.decisionId, `${path}.decisionId`);
    const decision = decisions.get(decisionId);
    if (decision === undefined || !array(decision.sourceEventIds, `${path}.decision.sourceEventIds`).includes(sourceEventId)) {
      return fail('Disposition is not linked to a covering arrangement decision.', 'INVALID_SELECTION_RESULT', { sourceEventId, decisionId });
    }
    const disposition = string(entry.disposition, `${path}.disposition`);
    if (disposition !== 'KEEP' && disposition !== 'OMIT') return fail('Disposition must be KEEP or OMIT.', 'INVALID_SELECTION_RESULT', { sourceEventId });
    const ruleId = string(entry.ruleId, `${path}.ruleId`);
    const selectedShapeId = nullableString(entry.selectedShapeId, `${path}.selectedShapeId`);

    let targetPitch: GuitarWorkspaceTargetPitch | null = null;
    let shift: number | null = null;
    let selectedPosition: GuitarWorkspacePosition | null = null;
    if (disposition === 'OMIT') {
      same(entry.targetPitch, null, `${path}.targetPitch`, 'INVALID_SELECTION_RESULT');
      same(entry.octaveShiftSemitones, null, `${path}.octaveShiftSemitones`, 'INVALID_SELECTION_RESULT');
      same(entry.selectedPosition, null, `${path}.selectedPosition`, 'INVALID_SELECTION_RESULT');
      same(entry.selectedShapeId, null, `${path}.selectedShapeId`, 'INVALID_SELECTION_RESULT');
      if (decision.decisionType !== 'OMITTED' && decision.decisionType !== 'CHORD_REDUCED') return fail('OMIT disposition conflicts with arrangement decision.', 'INVALID_SELECTION_RESULT', { sourceEventId });
    } else {
      shift = integer(entry.octaveShiftSemitones, `${path}.octaveShiftSemitones`);
      if (shift % 12 !== 0) return fail('Octave shift must be a multiple of 12.', 'INVALID_SELECTION_RESULT', { sourceEventId, shift });
      targetPitch = validatePitchShape(entry.targetPitch, `${path}.targetPitch`);
      same(targetPitch.step, sourcePitch.step, `${path}.targetPitch.step`, 'INVALID_SELECTION_RESULT');
      same(targetPitch.alter, sourcePitch.alter, `${path}.targetPitch.alter`, 'INVALID_SELECTION_RESULT');
      same(targetPitch.midi, sourceMidi + shift, `${path}.targetPitch.midi`, 'INVALID_SELECTION_RESULT');
      same(targetPitch.octave, sourcePitch.octave + shift / 12, `${path}.targetPitch.octave`, 'INVALID_SELECTION_RESULT');
      const position = object(entry.selectedPosition, ['string', 'fret'], `${path}.selectedPosition`);
      const stringNumber = integer(position.string, `${path}.selectedPosition.string`, 1, 6);
      const fret = integer(position.fret, `${path}.selectedPosition.fret`, MINIMUM_FRET, MAXIMUM_FRET);
      const openMidi = STANDARD_TUNING.find((tuning) => tuning.number === stringNumber)!.midi;
      same(openMidi + fret, targetPitch.midi, `${path}.selectedPosition`, 'INVALID_SELECTION_RESULT');
      selectedPosition = Object.freeze({ string: stringNumber, fret });
      if (decision.decisionType === 'PRESERVED') same(shift, 0, `${path}.octaveShiftSemitones`, 'INVALID_SELECTION_RESULT');
      if (decision.decisionType === 'OCTAVE_DISPLACED' && shift === 0) return fail('Octave-displaced decision requires non-zero shift.', 'INVALID_SELECTION_RESULT', { sourceEventId });
      if (decision.decisionType === 'OMITTED') return fail('KEEP disposition conflicts with omitted arrangement decision.', 'INVALID_SELECTION_RESULT', { sourceEventId });
    }

    const outputEntry = Object.freeze({
      sourceEventId,
      target: Object.freeze({ ...target }),
      decisionId,
      disposition: disposition as 'KEEP' | 'OMIT',
      targetPitch,
      octaveShiftSemitones: shift,
      ruleId,
      selectedPosition,
      selectedShapeId
    });
    output.push(outputEntry);
    bySourceId.set(sourceEventId, outputEntry);
  });
  return Object.freeze({ entries: Object.freeze(output), bySourceId });
};

const validateSelectedShapes = (
  result: RecordValue,
  groups: ReadonlyMap<string, readonly string[]>,
  dispositions: ReadonlyMap<string, GuitarWorkspaceResultEntry>
): readonly Readonly<GuitarWorkspaceSelectedShape>[] => {
  const output: Readonly<GuitarWorkspaceSelectedShape>[] = [];
  array(result.selectedShapes, 'canonicalTabResult.selectedShapes').forEach((raw, index) => {
    const path = `canonicalTabResult.selectedShapes[${index}]`;
    const shape = object(raw, ['selectedShapeId', 'sourceGroupId', 'sourceEventIds', 'voicingCandidateId', 'shapeCandidateId', 'fingerAssignments', 'barres', 'physicalValidation'], path);
    const selectedShapeId = string(shape.selectedShapeId, `${path}.selectedShapeId`);
    const sourceGroupId = string(shape.sourceGroupId, `${path}.sourceGroupId`);
    same(selectedShapeId, `${sourceGroupId}:selected-shape`, `${path}.selectedShapeId`, 'INVALID_SELECTION_RESULT');
    string(shape.voicingCandidateId, `${path}.voicingCandidateId`);
    string(shape.shapeCandidateId, `${path}.shapeCandidateId`);
    const group = groups.get(sourceGroupId);
    if (group === undefined) return fail('Selected shape references an unknown simultaneous group.', 'INVALID_SELECTION_RESULT', { sourceGroupId });
    const ids = array(shape.sourceEventIds, `${path}.sourceEventIds`).map((id, memberIndex) => string(id, `${path}.sourceEventIds[${memberIndex}]`));
    const expectedIds = group.filter((id) => dispositions.get(id)?.disposition === 'KEEP');
    if (expectedIds.length < 2 || JSON.stringify(ids) !== JSON.stringify(expectedIds)) return fail('Selected shape membership is invalid.', 'INVALID_SELECTION_RESULT', { sourceGroupId });

    const targets = ids.map((id) => {
      const disposition = dispositions.get(id);
      if (disposition === undefined || disposition.selectedShapeId !== selectedShapeId || disposition.selectedPosition === null) return fail('Selected shape is not linked by its dispositions.', 'INVALID_SELECTION_RESULT', { sourceEventId: id });
      return disposition.target;
    });

    const fingerAssignments = array(shape.fingerAssignments, `${path}.fingerAssignments`).map((rawAssignment, assignmentIndex) => {
      const assignmentPath = `${path}.fingerAssignments[${assignmentIndex}]`;
      const assignment = object(rawAssignment, ['sourceEventId', 'finger'], assignmentPath);
      const sourceEventId = string(assignment.sourceEventId, `${assignmentPath}.sourceEventId`);
      same(sourceEventId, ids[assignmentIndex], `${assignmentPath}.sourceEventId`, 'INVALID_SELECTION_RESULT');
      const disposition = dispositions.get(sourceEventId)!;
      const finger = integer(assignment.finger, `${assignmentPath}.finger`, 0, 4);
      if (disposition.selectedPosition!.fret === 0) same(finger, 0, `${assignmentPath}.finger`, 'INVALID_SELECTION_RESULT');
      else if (finger === 0) return fail('Fretted selected position requires finger 1..4.', 'INVALID_SELECTION_RESULT', { sourceEventId });
      return Object.freeze({ sourceEventId, target: disposition.target, finger });
    });

    const barres = array(shape.barres, `${path}.barres`).map((rawBarre, barreIndex) => {
      const barrePath = `${path}.barres[${barreIndex}]`;
      const barre = object(rawBarre, ['finger', 'fret', 'startString', 'endString', 'stringSpan', 'kind'], barrePath);
      const finger = integer(barre.finger, `${barrePath}.finger`, 1, 4);
      const fret = integer(barre.fret, `${barrePath}.fret`, 1, MAXIMUM_FRET);
      const startString = integer(barre.startString, `${barrePath}.startString`, 1, 6);
      const endString = integer(barre.endString, `${barrePath}.endString`, 1, 6);
      if (startString > endString) return fail('Barre string order is invalid.', 'INVALID_SELECTION_RESULT', { sourceGroupId });
      const stringSpan = integer(barre.stringSpan, `${barrePath}.stringSpan`, 1, 6);
      same(stringSpan, endString - startString + 1, `${barrePath}.stringSpan`, 'INVALID_SELECTION_RESULT');
      const kind = string(barre.kind, `${barrePath}.kind`);
      const expectedKind = startString === 1 && endString === 6 ? 'FULL_BARRE' : 'PARTIAL_BARRE';
      same(kind, expectedKind, `${barrePath}.kind`, 'INVALID_SELECTION_RESULT');
      return Object.freeze({ finger, fret, startString, endString, stringSpan, kind: kind as 'FULL_BARRE' | 'PARTIAL_BARRE' });
    });

    const physical = object(shape.physicalValidation, ['status'], `${path}.physicalValidation`);
    same(physical.status, 'PLAYABLE_WITHIN_POLICY', `${path}.physicalValidation.status`, 'INVALID_SELECTION_RESULT');
    output.push(Object.freeze({
      selectedShapeId,
      sourceGroupId,
      targets: Object.freeze(targets.map((target) => Object.freeze({ ...target }))),
      fingerAssignments: Object.freeze(fingerAssignments),
      barres: Object.freeze(barres),
      physicalStatus: 'PLAYABLE_WITHIN_POLICY' as const
    }));
  });
  return Object.freeze(output);
};

export const createGuitarWorkspaceResult = (
  score: ScoreDocument,
  notationInput: NotationDocument,
  projectionInput: GuitarWorkspaceProjection,
  canonicalTabResultJson: string
): Readonly<GuitarWorkspaceResult> => {
  if (typeof canonicalTabResultJson !== 'string') return fail('CanonicalTabResult input must be a JSON string.', 'INVALID_JSON');
  const byteLength = new TextEncoder().encode(canonicalTabResultJson).byteLength;
  if (byteLength === 0 || byteLength > MAX_CANONICAL_TAB_RESULT_JSON_BYTES) {
    return fail('CanonicalTabResult JSON exceeds the admitted input size.', 'RESULT_SIZE_LIMIT', { byteLength, maximum: MAX_CANONICAL_TAB_RESULT_JSON_BYTES });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(canonicalTabResultJson);
  } catch {
    return fail('CanonicalTabResult input is not valid JSON.', 'INVALID_JSON');
  }
  const result = object(parsed, [
    'documentType', 'schemaVersion', 'engine', 'source', 'review', 'guitar', 'policyProvenance',
    'measures', 'simultaneousGroups', 'arrangementDecisions', 'noteDispositions', 'selectedShapes'
  ], 'canonicalTabResult');

  let notation: Readonly<NotationDocument>;
  try {
    notation = createNotationDocument(score, notationInput);
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? String((error as { code?: unknown }).code) : null;
    return fail('Guitar Workspace result requires notation bound to the current score revision.', code === 'STALE_NOTATION' ? 'STALE_PROJECTION' : 'PROJECTION_MISMATCH', { notationCode: code });
  }
  const projection = ensureCurrentProjection(score, notation, projectionInput);
  const envelope = validateEnvelope(result);
  validatePolicyProvenanceShape(result.policyProvenance);
  const contexts = buildContexts(score, projection);
  const noteTargets = validateSourceFacts(result, score, notation, projection, contexts);
  const noteSourceIds = projection.sourceMap.entries.filter((entry) => entry.target.kind === 'note').map((entry) => entry.sourceEventId);
  const groups = validateGroups(result, noteSourceIds);
  const decisions = validateDecisions(result, noteSourceIds, groups);
  const dispositionResult = validateDispositions(result, score, noteTargets, projection, decisions);
  const selectedShapes = validateSelectedShapes(result, groups, dispositionResult.bySourceId);

  return Object.freeze({
    contractVersion: GUITAR_WORKSPACE_RESULT_VERSION,
    documentId: score.id,
    revisionId: score.revision.id,
    engine: Object.freeze({ name: CANONICAL_TAB_ENGINE_NAME, version: envelope.engineVersion }),
    teacherReviewStatus: envelope.review,
    entries: dispositionResult.entries,
    selectedShapes
  });
};
