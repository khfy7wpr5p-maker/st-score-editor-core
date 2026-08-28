import { resolveSemanticAddress } from '../../addressing/src/index.js';
import type { NoteAddress } from '../../addressing/src/index.js';
import {
  createGuitarWorkspaceProjection,
  GUITAR_WORKSPACE_ENGINE_PART_ID,
  GUITAR_WORKSPACE_MUSICXML_VERSION
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
export const CANONICAL_TAB_FINAL_SELECTION_POLICY = 'STATIC_ATTACK_PATH_LEXICOGRAPHIC_1.0' as const;
export const CANONICAL_TAB_FINAL_SELECTION_VERSION = '1.0.0' as const;
export const MAX_CANONICAL_TAB_RESULT_JSON_BYTES = 16 * 1024 * 1024;

const MAX_DIVISIONS = 16_384;
const MAX_SOURCE_EVENTS = 50_000;
const STANDARD_TUNING = Object.freeze([
  Object.freeze({ number: 1, pitch: 'E4', midi: 64 }),
  Object.freeze({ number: 2, pitch: 'B3', midi: 59 }),
  Object.freeze({ number: 3, pitch: 'G3', midi: 55 }),
  Object.freeze({ number: 4, pitch: 'D3', midi: 50 }),
  Object.freeze({ number: 5, pitch: 'A2', midi: 45 }),
  Object.freeze({ number: 6, pitch: 'E2', midi: 40 })
]);
const REVIEW_STATES = new Set(['NOT_REVIEWED', 'APPROVED', 'REJECTED']);
const DECISION_TYPES = new Set(['PRESERVED', 'OMITTED', 'OCTAVE_DISPLACED', 'CHORD_REDUCED']);

export const guitarWorkspaceResultAuthorityProfile = Object.freeze({
  version: GUITAR_WORKSPACE_RESULT_VERSION,
  inputBoundary: 'BOUNDED_JSON_STRING',
  projectionArgumentAccepted: false,
  rederivesProjectionBeforeAcceptance: true,
  sourceFactsMustMatchCurrentCanonicalRevision: true,
  exactCanonicalTabResultContractRequired: true,
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
  | 'STALE_NOTATION'
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
const exactObject = (value: unknown, keys: readonly string[], path: string): RecordValue => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return fail(`${path} must be an object.`, 'INVALID_RESULT_SHAPE', { path });
  const record = value as RecordValue;
  const expected = [...keys].sort();
  const observed = Object.keys(record).sort();
  if (JSON.stringify(expected) !== JSON.stringify(observed)) return fail(`${path} has an invalid field set.`, 'INVALID_RESULT_SHAPE', { path, expected, observed });
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
const integer = (value: unknown, path: string, minimum = Number.MIN_SAFE_INTEGER, maximum = Number.MAX_SAFE_INTEGER): number => {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || (value as number) < minimum || (value as number) > maximum) {
    return fail(`${path} must be a safe integer in range.`, 'INVALID_RESULT_SHAPE', { path, minimum, maximum, value });
  }
  return value as number;
};
const boolean = (value: unknown, path: string): boolean => {
  if (typeof value !== 'boolean') return fail(`${path} must be boolean.`, 'INVALID_RESULT_SHAPE', { path });
  return value;
};
const equal = (actual: unknown, expected: unknown, path: string, code: GuitarWorkspaceResultErrorCode = 'SOURCE_FACT_MISMATCH'): void => {
  if (!Object.is(actual, expected)) fail(`${path} does not match the admitted result/source contract.`, code, { path, expected, actual });
};

const absBig = (value: bigint): bigint => value < 0n ? -value : value;
const gcd = (left: bigint, right: bigint): bigint => {
  let a = absBig(left);
  let b = absBig(right);
  while (b !== 0n) { const next = a % b; a = b; b = next; }
  return a;
};
const lcm = (left: bigint, right: bigint): bigint => left === 0n || right === 0n ? 0n : absBig((left / gcd(left, right)) * right);
const timingFactor = (value: Rational): bigint => BigInt(value.denominator) / gcd(BigInt(value.denominator), 4n);
const meterFactor = (value: TimeSignature): bigint => BigInt(value.beatType) / gcd(BigInt(value.beatType), 4n);
const timingUnits = (value: Rational, divisions: number, path: string): number => {
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
  if (offset === undefined) return fail('Pitch step is invalid.', 'INVALID_SELECTION_RESULT', { step: pitch.step });
  const midi = (pitch.octave + 1) * 12 + offset + pitch.alter;
  if (!Number.isSafeInteger(midi) || midi < 0 || midi > 127) return fail('Pitch is outside MIDI range.', 'INVALID_SELECTION_RESULT', { pitch });
  return midi;
};
const writtenPitch = (pitch: { readonly step: string; readonly alter: number; readonly octave: number }): string => {
  const accidental = ({ '-2': 'bb', '-1': 'b', 0: '', 1: '#', 2: '##' } as const)[String(pitch.alter) as '-2' | '-1' | '0' | '1' | '2'];
  if (accidental === undefined) return fail('Pitch alter is invalid.', 'INVALID_SELECTION_RESULT', { alter: pitch.alter });
  return `${pitch.step}${accidental}${pitch.octave}`;
};
const validatePitch = (value: unknown, path: string): Readonly<GuitarWorkspaceTargetPitch> => {
  const pitch = exactObject(value, ['step', 'alter', 'octave', 'midi', 'written'], path);
  const step = string(pitch.step, `${path}.step`);
  if (!/^[A-G]$/.test(step)) return fail(`${path}.step is invalid.`, 'INVALID_SELECTION_RESULT', { step });
  const alter = integer(pitch.alter, `${path}.alter`, -2, 2);
  const octave = integer(pitch.octave, `${path}.octave`, -1, 9);
  const midi = integer(pitch.midi, `${path}.midi`, 0, 127);
  const written = string(pitch.written, `${path}.written`);
  equal(midi, pitchMidi({ step, alter, octave }), `${path}.midi`, 'INVALID_SELECTION_RESULT');
  equal(written, writtenPitch({ step, alter, octave }), `${path}.written`, 'INVALID_SELECTION_RESULT');
  return Object.freeze({ step, alter, octave, midi, written });
};
const sorted = <T extends { readonly ordinal: number }>(values: readonly T[]): readonly T[] => [...values].sort((a, b) => a.ordinal - b.ordinal);

interface ExpectedSourceEvent {
  readonly sourceEventId: string;
  readonly measureId: string;
  readonly measureIndex: number;
  readonly measureNumber: string;
  readonly sourceOrder: number;
  readonly voice: string;
  readonly staff: number;
  readonly onsetDivisions: number;
  readonly durationDivisions: number;
  readonly type: 'note' | 'rest';
  readonly pitch: Readonly<GuitarWorkspaceTargetPitch> | null;
  readonly tieStart: boolean;
  readonly tieStop: boolean;
  readonly chordWithPrevious: boolean;
  readonly target: Readonly<NoteAddress> | null;
}
interface ExpectedMeasure {
  readonly measureId: string;
  readonly index: number;
  readonly number: string;
  readonly divisions: number;
  readonly timeSignature: Readonly<TimeSignature>;
  readonly expectedDurationDivisions: number;
  readonly events: readonly ExpectedSourceEvent[];
}
interface ExpectedGroup {
  readonly groupId: string;
  readonly measureId: string;
  readonly onsetDivisions: number;
  readonly sourceEventIds: readonly string[];
}

const resolveMeter = (notation: NotationDocument, measureIds: readonly string[], active: TimeSignature | null, measureIndex: number): TimeSignature => {
  const values = measureIds.map((id) => notationForMeasure(notation, id)?.timeSignature ?? null);
  const present = values.filter((value): value is TimeSignature => value !== null);
  if (present.length === 0) {
    if (active === null) return fail('No active meter exists for current projection.', 'SOURCE_FACT_MISMATCH', { measureIndex });
    return active;
  }
  if (present.length !== values.length || present.some((value) => value.beats !== present[0]!.beats || value.beatType !== present[0]!.beatType)) {
    return fail('Aligned staff meter is inconsistent.', 'SOURCE_FACT_MISMATCH', { measureIndex });
  }
  return present[0]!;
};
const chooseDivisions = (staffMeasures: readonly { readonly voices: readonly Voice[] }[], time: TimeSignature): number => {
  let divisions = meterFactor(time);
  for (const measure of staffMeasures) for (const voice of measure.voices) for (const event of voice.events) {
    divisions = lcm(divisions, timingFactor(event.onset));
    divisions = lcm(divisions, timingFactor(event.duration));
  }
  if (divisions > BigInt(MAX_DIVISIONS)) return fail('Current projection divisions exceed E8-B bounds.', 'SOURCE_FACT_MISMATCH');
  return Number(divisions);
};
const noteForTarget = (score: ScoreDocument, target: NoteAddress): NoteAtom => {
  const resolved = resolveSemanticAddress(score, target);
  if (resolved.kind !== 'note') return fail('Source-map note target no longer resolves.', 'UNKNOWN_SOURCE_EVENT', { noteId: target.noteId });
  return resolved.value;
};
const eventForTarget = (score: ScoreDocument, target: { readonly kind: 'event' | 'note'; readonly eventId: string } & Record<string, unknown>): ScoreEvent => {
  const eventAddress = target.kind === 'event'
    ? target
    : { ...target, kind: 'event', contractVersion: target.contractVersion, documentId: target.documentId, revisionId: target.revisionId, partId: target.partId, staffId: target.staffId, measureId: target.measureId, voiceId: target.voiceId, eventId: target.eventId };
  const resolved = resolveSemanticAddress(score, eventAddress as never);
  if (resolved.kind !== 'event') return fail('Source-map event target no longer resolves.', 'UNKNOWN_SOURCE_EVENT', { eventId: target.eventId });
  return resolved.value;
};

const deriveExpectedSource = (score: ScoreDocument, notation: NotationDocument): { readonly measures: readonly ExpectedMeasure[]; readonly groups: readonly ExpectedGroup[]; readonly noteEvents: readonly ExpectedSourceEvent[] } => {
  const projection = createGuitarWorkspaceProjection(score, notation);
  const part = score.parts[0]!;
  const staves = sorted(part.staves);
  const measuresByStaff = staves.map((staff) => sorted(staff.measures));
  const sourceMapById = new Map(projection.sourceMap.entries.map((entry) => [entry.sourceEventId, entry]));
  const resultMeasures: ExpectedMeasure[] = [];
  const noteEvents: ExpectedSourceEvent[] = [];
  let activeTime: TimeSignature | null = null;

  for (let measureIndex = 0; measureIndex < measuresByStaff[0]!.length; measureIndex += 1) {
    const staffMeasures = measuresByStaff.map((measures) => measures[measureIndex]!);
    const reference = staffMeasures[0]!;
    if (reference.displayNumber === null) return fail('Projected measure number is missing.', 'SOURCE_FACT_MISMATCH', { measureIndex });
    activeTime = resolveMeter(notation, staffMeasures.map((measure) => measure.id), activeTime, measureIndex);
    const divisions = chooseDivisions(staffMeasures, activeTime);
    const expectedDurationDivisions = divisions * activeTime.beats * 4 / activeTime.beatType;
    if (!Number.isSafeInteger(expectedDurationDivisions)) return fail('Expected duration is not integral.', 'SOURCE_FACT_MISMATCH', { measureIndex });

    const sourceEntries = projection.sourceMap.entries.filter((entry) => entry.sourceEventId.startsWith(`${GUITAR_WORKSPACE_ENGINE_PART_ID}:measure:${measureIndex}:note:`));
    const events: ExpectedSourceEvent[] = sourceEntries.map((entry, sourceOrder) => {
      const target = entry.target;
      const staffIndex = staves.findIndex((staff) => staff.id === target.staffId);
      if (staffIndex < 0) return fail('Source-map staff no longer exists.', 'UNKNOWN_SOURCE_EVENT', { sourceEventId: entry.sourceEventId });
      const measure = staffMeasures[staffIndex]!;
      if (measure.id !== target.measureId) return fail('Source-map measure no longer aligns.', 'UNKNOWN_SOURCE_EVENT', { sourceEventId: entry.sourceEventId });
      const voice = measure.voices.find((candidate) => candidate.id === target.voiceId);
      if (voice === undefined) return fail('Source-map voice no longer exists.', 'UNKNOWN_SOURCE_EVENT', { sourceEventId: entry.sourceEventId });
      const event = eventForTarget(score, target as never);
      const onsetDivisions = timingUnits(event.onset, divisions, `${entry.sourceEventId}.onset`);
      const durationDivisions = timingUnits(event.duration, divisions, `${entry.sourceEventId}.duration`);
      let pitch: Readonly<GuitarWorkspaceTargetPitch> | null = null;
      let tieStart = false;
      let tieStop = false;
      let chordWithPrevious = false;
      let noteTarget: Readonly<NoteAddress> | null = null;
      if (target.kind === 'note') {
        const note = noteForTarget(score, target);
        pitch = Object.freeze({ ...note.pitch, midi: pitchMidi(note.pitch), written: writtenPitch(note.pitch) });
        const ties = notationForNote(notation, note.id)?.ties ?? [];
        tieStart = ties.some((tie) => tie.type === 'start');
        tieStop = ties.some((tie) => tie.type === 'stop');
        noteTarget = Object.freeze({ ...target });
        if (event.kind === 'chord') {
          const toneIndex = event.notes.findIndex((candidate) => candidate.id === note.id);
          if (toneIndex < 0) return fail('Chord source-map target is invalid.', 'UNKNOWN_SOURCE_EVENT', { sourceEventId: entry.sourceEventId });
          chordWithPrevious = toneIndex > 0;
        } else if (event.kind !== 'note') {
          return fail('Note source-map target belongs to a non-note event.', 'UNKNOWN_SOURCE_EVENT', { sourceEventId: entry.sourceEventId });
        }
      } else if (event.kind !== 'rest') {
        return fail('Event source-map targets are admitted only for rests.', 'UNKNOWN_SOURCE_EVENT', { sourceEventId: entry.sourceEventId });
      }
      const expected: ExpectedSourceEvent = Object.freeze({
        sourceEventId: entry.sourceEventId,
        measureId: `${GUITAR_WORKSPACE_ENGINE_PART_ID}:measure:${measureIndex}`,
        measureIndex,
        measureNumber: reference.displayNumber!,
        sourceOrder,
        voice: String(voice.ordinal),
        staff: staffIndex + 1,
        onsetDivisions,
        durationDivisions,
        type: target.kind === 'note' ? 'note' : 'rest',
        pitch,
        tieStart,
        tieStop,
        chordWithPrevious,
        target: noteTarget
      });
      if (expected.type === 'note') noteEvents.push(expected);
      return expected;
    });
    for (const event of events) if (!sourceMapById.has(event.sourceEventId)) return fail('Derived source event is not in the projection map.', 'UNKNOWN_SOURCE_EVENT', { sourceEventId: event.sourceEventId });
    resultMeasures.push(Object.freeze({
      measureId: `${GUITAR_WORKSPACE_ENGINE_PART_ID}:measure:${measureIndex}`,
      index: measureIndex,
      number: reference.displayNumber,
      divisions,
      timeSignature: Object.freeze({ ...activeTime }),
      expectedDurationDivisions,
      events: Object.freeze(events)
    }));
  }

  const groups: ExpectedGroup[] = [];
  for (const measure of resultMeasures) {
    const byOnset = new Map<number, string[]>();
    for (const event of measure.events) {
      if (event.type !== 'note') continue;
      const ids = byOnset.get(event.onsetDivisions) ?? [];
      ids.push(event.sourceEventId);
      byOnset.set(event.onsetDivisions, ids);
    }
    for (const onset of [...byOnset.keys()].sort((a, b) => a - b)) {
      const ids = byOnset.get(onset)!;
      if (ids.length < 2) continue;
      groups.push(Object.freeze({
        groupId: `${measure.measureId}:simultaneous:${onset}`,
        measureId: measure.measureId,
        onsetDivisions: onset,
        sourceEventIds: Object.freeze([...ids])
      }));
    }
  }
  return Object.freeze({ measures: Object.freeze(resultMeasures), groups: Object.freeze(groups), noteEvents: Object.freeze(noteEvents) });
};

const validateEnvelope = (result: RecordValue): { readonly engineVersion: string; readonly reviewState: 'NOT_REVIEWED' | 'APPROVED' | 'REJECTED' } => {
  equal(result.documentType, CANONICAL_TAB_RESULT_DOCUMENT_TYPE, 'canonicalTabResult.documentType', 'UNSUPPORTED_RESULT_CONTRACT');
  equal(result.schemaVersion, CANONICAL_TAB_RESULT_SCHEMA_VERSION, 'canonicalTabResult.schemaVersion', 'UNSUPPORTED_RESULT_CONTRACT');
  const engine = exactObject(result.engine, ['name', 'version'], 'canonicalTabResult.engine');
  equal(string(engine.name, 'canonicalTabResult.engine.name'), CANONICAL_TAB_ENGINE_NAME, 'canonicalTabResult.engine.name', 'UNSUPPORTED_RESULT_CONTRACT');
  const engineVersion = string(engine.version, 'canonicalTabResult.engine.version');
  const source = exactObject(result.source, ['documentType', 'contractVersion', 'format', 'musicXmlVersion', 'partId'], 'canonicalTabResult.source');
  equal(source.documentType, CANONICAL_TAB_SOURCE_DOCUMENT_TYPE, 'canonicalTabResult.source.documentType', 'UNSUPPORTED_RESULT_CONTRACT');
  equal(source.contractVersion, CANONICAL_TAB_SOURCE_CONTRACT_VERSION, 'canonicalTabResult.source.contractVersion', 'UNSUPPORTED_RESULT_CONTRACT');
  equal(source.format, 'score-partwise', 'canonicalTabResult.source.format', 'UNSUPPORTED_RESULT_CONTRACT');
  equal(nullableString(source.musicXmlVersion, 'canonicalTabResult.source.musicXmlVersion'), GUITAR_WORKSPACE_MUSICXML_VERSION, 'canonicalTabResult.source.musicXmlVersion', 'UNSUPPORTED_RESULT_CONTRACT');
  equal(string(source.partId, 'canonicalTabResult.source.partId'), GUITAR_WORKSPACE_ENGINE_PART_ID, 'canonicalTabResult.source.partId');
  const review = exactObject(result.review, ['teacherReviewStatus'], 'canonicalTabResult.review');
  const reviewState = string(review.teacherReviewStatus, 'canonicalTabResult.review.teacherReviewStatus');
  if (!REVIEW_STATES.has(reviewState)) return fail('Teacher review state is unsupported.', 'INVALID_RESULT_SHAPE', { reviewState });

  const guitar = exactObject(result.guitar, ['contractVersion', 'tuning', 'minimumFret', 'maximumFret'], 'canonicalTabResult.guitar');
  equal(guitar.contractVersion, '1.0.0', 'canonicalTabResult.guitar.contractVersion', 'INVALID_GUITAR_RESULT');
  equal(integer(guitar.minimumFret, 'canonicalTabResult.guitar.minimumFret', 0), 0, 'canonicalTabResult.guitar.minimumFret', 'INVALID_GUITAR_RESULT');
  equal(integer(guitar.maximumFret, 'canonicalTabResult.guitar.maximumFret', 0), 20, 'canonicalTabResult.guitar.maximumFret', 'INVALID_GUITAR_RESULT');
  const tuning = array(guitar.tuning, 'canonicalTabResult.guitar.tuning');
  equal(tuning.length, STANDARD_TUNING.length, 'canonicalTabResult.guitar.tuning.length', 'INVALID_GUITAR_RESULT');
  tuning.forEach((raw, index) => {
    const entry = exactObject(raw, ['number', 'pitch', 'midi'], `canonicalTabResult.guitar.tuning[${index}]`);
    const expected = STANDARD_TUNING[index]!;
    equal(integer(entry.number, `canonicalTabResult.guitar.tuning[${index}].number`, 1, 6), expected.number, `canonicalTabResult.guitar.tuning[${index}].number`, 'INVALID_GUITAR_RESULT');
    equal(string(entry.pitch, `canonicalTabResult.guitar.tuning[${index}].pitch`), expected.pitch, `canonicalTabResult.guitar.tuning[${index}].pitch`, 'INVALID_GUITAR_RESULT');
    equal(integer(entry.midi, `canonicalTabResult.guitar.tuning[${index}].midi`, 0, 127), expected.midi, `canonicalTabResult.guitar.tuning[${index}].midi`, 'INVALID_GUITAR_RESULT');
  });
  return Object.freeze({ engineVersion, reviewState: reviewState as 'NOT_REVIEWED' | 'APPROVED' | 'REJECTED' });
};

const validatePolicyProvenance = (value: unknown): void => {
  const root = exactObject(value, ['arrangement', 'reduction', 'voicing', 'leftHand', 'physicalValidation', 'finalSelection'], 'canonicalTabResult.policyProvenance');
  const arrangement = exactObject(root.arrangement, ['documentType', 'contractVersion'], 'canonicalTabResult.policyProvenance.arrangement');
  equal(arrangement.documentType, 'GuitarArrangementPlan', 'canonicalTabResult.policyProvenance.arrangement.documentType', 'UNSUPPORTED_RESULT_CONTRACT');
  equal(arrangement.contractVersion, '1.0.0', 'canonicalTabResult.policyProvenance.arrangement.contractVersion', 'UNSUPPORTED_RESULT_CONTRACT');
  const reduction = exactObject(root.reduction, ['documentType', 'contractVersion', 'policy', 'octaveTieBreak'], 'canonicalTabResult.policyProvenance.reduction');
  equal(reduction.documentType, 'DeterministicReductionPlan', 'canonicalTabResult.policyProvenance.reduction.documentType', 'UNSUPPORTED_RESULT_CONTRACT');
  equal(reduction.contractVersion, '1.0.0', 'canonicalTabResult.policyProvenance.reduction.contractVersion', 'UNSUPPORTED_RESULT_CONTRACT');
  equal(reduction.policy, 'STANDARD_GUITAR_REGISTER_20_FRET_1.0', 'canonicalTabResult.policyProvenance.reduction.policy', 'UNSUPPORTED_RESULT_CONTRACT');
  equal(reduction.octaveTieBreak, 'DOWNWARD_TIE_BREAK_1.0', 'canonicalTabResult.policyProvenance.reduction.octaveTieBreak', 'UNSUPPORTED_RESULT_CONTRACT');
  const voicing = exactObject(root.voicing, ['documentType', 'contractVersion', 'policy'], 'canonicalTabResult.policyProvenance.voicing');
  equal(voicing.documentType, 'GuitarVoicingCandidateModel', 'canonicalTabResult.policyProvenance.voicing.documentType', 'UNSUPPORTED_RESULT_CONTRACT');
  equal(voicing.contractVersion, '1.0.0', 'canonicalTabResult.policyProvenance.voicing.contractVersion', 'UNSUPPORTED_RESULT_CONTRACT');
  equal(voicing.policy, 'STANDARD_SIX_STRING_DISTINCT_STRING_1.0', 'canonicalTabResult.policyProvenance.voicing.policy', 'UNSUPPORTED_RESULT_CONTRACT');
  const leftHand = exactObject(root.leftHand, ['documentType', 'contractVersion', 'policy'], 'canonicalTabResult.policyProvenance.leftHand');
  equal(leftHand.documentType, 'LeftHandShapeModel', 'canonicalTabResult.policyProvenance.leftHand.documentType', 'UNSUPPORTED_RESULT_CONTRACT');
  equal(leftHand.contractVersion, '1.0.0', 'canonicalTabResult.policyProvenance.leftHand.contractVersion', 'UNSUPPORTED_RESULT_CONTRACT');
  equal(leftHand.policy, 'ORDERED_FRET_FINGER_BARRE_1.0', 'canonicalTabResult.policyProvenance.leftHand.policy', 'UNSUPPORTED_RESULT_CONTRACT');
  const physical = exactObject(root.physicalValidation, ['documentType', 'contractVersion', 'policy', 'configuration'], 'canonicalTabResult.policyProvenance.physicalValidation');
  equal(physical.documentType, 'PhysicalPlayabilityValidation', 'canonicalTabResult.policyProvenance.physicalValidation.documentType', 'UNSUPPORTED_RESULT_CONTRACT');
  equal(physical.contractVersion, '2.0.0', 'canonicalTabResult.policyProvenance.physicalValidation.contractVersion', 'UNSUPPORTED_RESULT_CONTRACT');
  equal(physical.policy, 'CONSERVATIVE_STATIC_LEFT_HAND_2.0', 'canonicalTabResult.policyProvenance.physicalValidation.policy', 'UNSUPPORTED_RESULT_CONTRACT');
  const configuration = exactObject(physical.configuration, ['maximumStaticFretSpan', 'maximumExtraFretReach'], 'canonicalTabResult.policyProvenance.physicalValidation.configuration');
  equal(integer(configuration.maximumStaticFretSpan, 'canonicalTabResult.policyProvenance.physicalValidation.configuration.maximumStaticFretSpan', 0), 4, 'canonicalTabResult.policyProvenance.physicalValidation.configuration.maximumStaticFretSpan', 'UNSUPPORTED_RESULT_CONTRACT');
  equal(integer(configuration.maximumExtraFretReach, 'canonicalTabResult.policyProvenance.physicalValidation.configuration.maximumExtraFretReach', 0), 1, 'canonicalTabResult.policyProvenance.physicalValidation.configuration.maximumExtraFretReach', 'UNSUPPORTED_RESULT_CONTRACT');
  const finalSelection = exactObject(root.finalSelection, ['policyId', 'policyVersion'], 'canonicalTabResult.policyProvenance.finalSelection');
  equal(finalSelection.policyId, CANONICAL_TAB_FINAL_SELECTION_POLICY, 'canonicalTabResult.policyProvenance.finalSelection.policyId', 'UNSUPPORTED_RESULT_CONTRACT');
  equal(finalSelection.policyVersion, CANONICAL_TAB_FINAL_SELECTION_VERSION, 'canonicalTabResult.policyProvenance.finalSelection.policyVersion', 'UNSUPPORTED_RESULT_CONTRACT');
};

const validateSourceFacts = (result: RecordValue, expected: ReturnType<typeof deriveExpectedSource>): void => {
  const measures = array(result.measures, 'canonicalTabResult.measures');
  equal(measures.length, expected.measures.length, 'canonicalTabResult.measures.length');
  expected.measures.forEach((expectedMeasure, measureIndex) => {
    const path = `canonicalTabResult.measures[${measureIndex}]`;
    const measure = exactObject(measures[measureIndex], ['measureId', 'index', 'number', 'implicit', 'divisions', 'timeSignature', 'expectedDurationDivisions', 'events'], path);
    equal(string(measure.measureId, `${path}.measureId`), expectedMeasure.measureId, `${path}.measureId`);
    equal(integer(measure.index, `${path}.index`, 0), expectedMeasure.index, `${path}.index`);
    equal(string(measure.number, `${path}.number`), expectedMeasure.number, `${path}.number`);
    equal(boolean(measure.implicit, `${path}.implicit`), false, `${path}.implicit`);
    equal(integer(measure.divisions, `${path}.divisions`, 1, MAX_DIVISIONS), expectedMeasure.divisions, `${path}.divisions`);
    const time = exactObject(measure.timeSignature, ['beats', 'beatType'], `${path}.timeSignature`);
    equal(integer(time.beats, `${path}.timeSignature.beats`, 1), expectedMeasure.timeSignature.beats, `${path}.timeSignature.beats`);
    equal(integer(time.beatType, `${path}.timeSignature.beatType`, 1), expectedMeasure.timeSignature.beatType, `${path}.timeSignature.beatType`);
    equal(integer(measure.expectedDurationDivisions, `${path}.expectedDurationDivisions`, 1), expectedMeasure.expectedDurationDivisions, `${path}.expectedDurationDivisions`);
    const events = array(measure.events, `${path}.events`);
    equal(events.length, expectedMeasure.events.length, `${path}.events.length`);
    expectedMeasure.events.forEach((expectedEvent, eventIndex) => {
      const eventPath = `${path}.events[${eventIndex}]`;
      const keys = expectedEvent.type === 'note'
        ? ['sourceEventId', 'sourceOrder', 'type', 'voice', 'staff', 'onsetDivisions', 'durationDivisions', 'pitch', 'tieStart', 'tieStop', 'source']
        : ['sourceEventId', 'sourceOrder', 'type', 'voice', 'staff', 'onsetDivisions', 'durationDivisions', 'tieStart', 'tieStop', 'source'];
      const event = exactObject(events[eventIndex], keys, eventPath);
      equal(string(event.sourceEventId, `${eventPath}.sourceEventId`), expectedEvent.sourceEventId, `${eventPath}.sourceEventId`);
      equal(integer(event.sourceOrder, `${eventPath}.sourceOrder`, 0), expectedEvent.sourceOrder, `${eventPath}.sourceOrder`);
      equal(event.type, expectedEvent.type, `${eventPath}.type`);
      equal(string(event.voice, `${eventPath}.voice`), expectedEvent.voice, `${eventPath}.voice`);
      equal(integer(event.staff, `${eventPath}.staff`, 1, 2), expectedEvent.staff, `${eventPath}.staff`);
      equal(integer(event.onsetDivisions, `${eventPath}.onsetDivisions`, 0), expectedEvent.onsetDivisions, `${eventPath}.onsetDivisions`);
      equal(integer(event.durationDivisions, `${eventPath}.durationDivisions`, 1), expectedEvent.durationDivisions, `${eventPath}.durationDivisions`);
      equal(boolean(event.tieStart, `${eventPath}.tieStart`), expectedEvent.tieStart, `${eventPath}.tieStart`);
      equal(boolean(event.tieStop, `${eventPath}.tieStop`), expectedEvent.tieStop, `${eventPath}.tieStop`);
      const source = exactObject(event.source, ['partId', 'measureIndex', 'measureNumber', 'noteIndex', 'chordWithPrevious'], `${eventPath}.source`);
      equal(string(source.partId, `${eventPath}.source.partId`), GUITAR_WORKSPACE_ENGINE_PART_ID, `${eventPath}.source.partId`);
      equal(integer(source.measureIndex, `${eventPath}.source.measureIndex`, 0), expectedEvent.measureIndex, `${eventPath}.source.measureIndex`);
      equal(string(source.measureNumber, `${eventPath}.source.measureNumber`), expectedEvent.measureNumber, `${eventPath}.source.measureNumber`);
      equal(integer(source.noteIndex, `${eventPath}.source.noteIndex`, 0), expectedEvent.sourceOrder, `${eventPath}.source.noteIndex`);
      equal(boolean(source.chordWithPrevious, `${eventPath}.source.chordWithPrevious`), expectedEvent.chordWithPrevious, `${eventPath}.source.chordWithPrevious`);
      if (expectedEvent.type === 'note') {
        const pitch = validatePitch(event.pitch, `${eventPath}.pitch`);
        equal(pitch.step, expectedEvent.pitch!.step, `${eventPath}.pitch.step`);
        equal(pitch.alter, expectedEvent.pitch!.alter, `${eventPath}.pitch.alter`);
        equal(pitch.octave, expectedEvent.pitch!.octave, `${eventPath}.pitch.octave`);
      }
    });
  });
};

const validateGroups = (result: RecordValue, expectedGroups: readonly ExpectedGroup[]): ReadonlyMap<string, ExpectedGroup> => {
  const actual = array(result.simultaneousGroups, 'canonicalTabResult.simultaneousGroups');
  equal(actual.length, expectedGroups.length, 'canonicalTabResult.simultaneousGroups.length', 'INVALID_SELECTION_RESULT');
  const byId = new Map<string, ExpectedGroup>();
  expectedGroups.forEach((expected, index) => {
    const path = `canonicalTabResult.simultaneousGroups[${index}]`;
    const group = exactObject(actual[index], ['groupId', 'measureId', 'onsetDivisions', 'sourceEventIds'], path);
    equal(string(group.groupId, `${path}.groupId`), expected.groupId, `${path}.groupId`, 'INVALID_SELECTION_RESULT');
    equal(string(group.measureId, `${path}.measureId`), expected.measureId, `${path}.measureId`, 'INVALID_SELECTION_RESULT');
    equal(integer(group.onsetDivisions, `${path}.onsetDivisions`, 0), expected.onsetDivisions, `${path}.onsetDivisions`, 'INVALID_SELECTION_RESULT');
    const ids = array(group.sourceEventIds, `${path}.sourceEventIds`).map((id, memberIndex) => string(id, `${path}.sourceEventIds[${memberIndex}]`));
    if (JSON.stringify(ids) !== JSON.stringify(expected.sourceEventIds)) return fail('Simultaneous-group membership/order is invalid.', 'INVALID_SELECTION_RESULT', { groupId: expected.groupId });
    byId.set(expected.groupId, expected);
  });
  return byId;
};

interface DecisionInfo {
  readonly decisionId: string;
  readonly decisionType: 'PRESERVED' | 'OMITTED' | 'OCTAVE_DISPLACED' | 'CHORD_REDUCED';
  readonly sourceEventIds: readonly string[];
  readonly sourceGroupId: string | null;
}
const validateDecisions = (result: RecordValue, noteEvents: readonly ExpectedSourceEvent[], groups: ReadonlyMap<string, ExpectedGroup>): ReadonlyMap<string, DecisionInfo> => {
  const actual = array(result.arrangementDecisions, 'canonicalTabResult.arrangementDecisions');
  if (actual.length > noteEvents.length) return fail('Arrangement-decision count exceeds source-note count.', 'INVALID_SELECTION_RESULT');
  const orderById = new Map(noteEvents.map((event, index) => [event.sourceEventId, index]));
  const covered = new Set<string>();
  const byId = new Map<string, DecisionInfo>();
  let previousFirst = -1;
  actual.forEach((raw, index) => {
    const path = `canonicalTabResult.arrangementDecisions[${index}]`;
    const decision = exactObject(raw, ['decisionId', 'decisionType', 'sourceEventIds', 'sourceGroupId'], path);
    const decisionId = string(decision.decisionId, `${path}.decisionId`);
    equal(decisionId, `${GUITAR_WORKSPACE_ENGINE_PART_ID}:arrangement-decision:${index}`, `${path}.decisionId`, 'INVALID_SELECTION_RESULT');
    const decisionType = string(decision.decisionType, `${path}.decisionType`);
    if (!DECISION_TYPES.has(decisionType)) return fail('Arrangement decision type is unsupported.', 'INVALID_SELECTION_RESULT', { decisionType });
    const ids = array(decision.sourceEventIds, `${path}.sourceEventIds`).map((id, memberIndex) => string(id, `${path}.sourceEventIds[${memberIndex}]`));
    if (ids.length === 0) return fail('Arrangement decision cannot be empty.', 'INVALID_SELECTION_RESULT', { decisionId });
    let first = -1;
    ids.forEach((id, memberIndex) => {
      const sourceOrder = orderById.get(id);
      if (sourceOrder === undefined) return fail('Arrangement decision references an unknown source note.', 'UNKNOWN_SOURCE_EVENT', { decisionId, id });
      if (covered.has(id)) return fail('Source note has duplicate decision coverage.', 'INVALID_SELECTION_RESULT', { decisionId, id });
      if (memberIndex > 0 && sourceOrder <= orderById.get(ids[memberIndex - 1]!)!) return fail('Decision member order is invalid.', 'INVALID_SELECTION_RESULT', { decisionId });
      if (memberIndex === 0) first = sourceOrder;
      covered.add(id);
    });
    if (first <= previousFirst) return fail('Arrangement decisions are out of source order.', 'INVALID_SELECTION_RESULT', { decisionId });
    previousFirst = first;
    let sourceGroupId: string | null = null;
    if (decisionType === 'CHORD_REDUCED') {
      sourceGroupId = string(decision.sourceGroupId, `${path}.sourceGroupId`);
      const group = groups.get(sourceGroupId);
      if (group === undefined || JSON.stringify(ids) !== JSON.stringify(group.sourceEventIds)) return fail('Chord-reduction group membership is invalid.', 'INVALID_SELECTION_RESULT', { decisionId, sourceGroupId });
    } else {
      equal(decision.sourceGroupId, null, `${path}.sourceGroupId`, 'INVALID_SELECTION_RESULT');
      equal(ids.length, 1, `${path}.sourceEventIds.length`, 'INVALID_SELECTION_RESULT');
    }
    const info = Object.freeze({ decisionId, decisionType: decisionType as DecisionInfo['decisionType'], sourceEventIds: Object.freeze(ids), sourceGroupId });
    byId.set(decisionId, info);
  });
  equal(covered.size, noteEvents.length, 'canonicalTabResult.arrangementDecisions.coverage', 'INVALID_SELECTION_RESULT');
  return byId;
};

const validateDispositions = (
  result: RecordValue,
  noteEvents: readonly ExpectedSourceEvent[],
  decisions: ReadonlyMap<string, DecisionInfo>,
  groups: ReadonlyMap<string, ExpectedGroup>
): { readonly entries: readonly Readonly<GuitarWorkspaceResultEntry>[]; readonly bySourceId: ReadonlyMap<string, GuitarWorkspaceResultEntry> } => {
  const actual = array(result.noteDispositions, 'canonicalTabResult.noteDispositions');
  equal(actual.length, noteEvents.length, 'canonicalTabResult.noteDispositions.length', 'INVALID_SELECTION_RESULT');
  const output: Readonly<GuitarWorkspaceResultEntry>[] = [];
  const bySourceId = new Map<string, GuitarWorkspaceResultEntry>();
  actual.forEach((raw, index) => {
    const path = `canonicalTabResult.noteDispositions[${index}]`;
    const entry = exactObject(raw, ['sourceEventId', 'decisionId', 'disposition', 'targetPitch', 'octaveShiftSemitones', 'ruleId', 'selectedPosition', 'selectedShapeId'], path);
    const expected = noteEvents[index]!;
    const sourceEventId = string(entry.sourceEventId, `${path}.sourceEventId`);
    equal(sourceEventId, expected.sourceEventId, `${path}.sourceEventId`, 'UNKNOWN_SOURCE_EVENT');
    const decisionId = string(entry.decisionId, `${path}.decisionId`);
    const decision = decisions.get(decisionId);
    if (decision === undefined || !decision.sourceEventIds.includes(sourceEventId)) return fail('Disposition is not linked to its source decision.', 'INVALID_SELECTION_RESULT', { sourceEventId, decisionId });
    const disposition = string(entry.disposition, `${path}.disposition`);
    if (disposition !== 'KEEP' && disposition !== 'OMIT') return fail('Disposition must be KEEP or OMIT.', 'INVALID_SELECTION_RESULT', { sourceEventId });
    const ruleId = string(entry.ruleId, `${path}.ruleId`);
    const selectedShapeId = nullableString(entry.selectedShapeId, `${path}.selectedShapeId`);
    let targetPitch: Readonly<GuitarWorkspaceTargetPitch> | null = null;
    let shift: number | null = null;
    let selectedPosition: Readonly<GuitarWorkspacePosition> | null = null;
    if (disposition === 'OMIT') {
      equal(entry.targetPitch, null, `${path}.targetPitch`, 'INVALID_SELECTION_RESULT');
      equal(entry.octaveShiftSemitones, null, `${path}.octaveShiftSemitones`, 'INVALID_SELECTION_RESULT');
      equal(entry.selectedPosition, null, `${path}.selectedPosition`, 'INVALID_SELECTION_RESULT');
      equal(entry.selectedShapeId, null, `${path}.selectedShapeId`, 'INVALID_SELECTION_RESULT');
      if (decision.decisionType === 'OMITTED') equal(ruleId, 'OMIT_EXPLICIT', `${path}.ruleId`, 'INVALID_SELECTION_RESULT');
      else if (decision.decisionType === 'CHORD_REDUCED') equal(ruleId, 'CHORD_REDUCTION_OMIT_INNER', `${path}.ruleId`, 'INVALID_SELECTION_RESULT');
      else return fail('OMIT disposition conflicts with decision type.', 'INVALID_SELECTION_RESULT', { sourceEventId, decisionType: decision.decisionType });
    } else {
      shift = integer(entry.octaveShiftSemitones, `${path}.octaveShiftSemitones`);
      if (shift % 12 !== 0) return fail('Octave shift must be a multiple of 12.', 'INVALID_SELECTION_RESULT', { sourceEventId, shift });
      targetPitch = validatePitch(entry.targetPitch, `${path}.targetPitch`);
      equal(targetPitch.step, expected.pitch!.step, `${path}.targetPitch.step`, 'INVALID_SELECTION_RESULT');
      equal(targetPitch.alter, expected.pitch!.alter, `${path}.targetPitch.alter`, 'INVALID_SELECTION_RESULT');
      equal(targetPitch.midi, expected.pitch!.midi + shift, `${path}.targetPitch.midi`, 'INVALID_SELECTION_RESULT');
      equal(targetPitch.octave, expected.pitch!.octave + shift / 12, `${path}.targetPitch.octave`, 'INVALID_SELECTION_RESULT');
      const position = exactObject(entry.selectedPosition, ['string', 'fret'], `${path}.selectedPosition`);
      const stringNumber = integer(position.string, `${path}.selectedPosition.string`, 1, 6);
      const fret = integer(position.fret, `${path}.selectedPosition.fret`, 0, 20);
      const openMidi = STANDARD_TUNING.find((item) => item.number === stringNumber)!.midi;
      equal(openMidi + fret, targetPitch.midi, `${path}.selectedPosition`, 'INVALID_SELECTION_RESULT');
      selectedPosition = Object.freeze({ string: stringNumber, fret });
      if (decision.decisionType === 'PRESERVED') {
        equal(shift, 0, `${path}.octaveShiftSemitones`, 'INVALID_SELECTION_RESULT');
        equal(ruleId, 'PRESERVE_IN_REGISTER', `${path}.ruleId`, 'INVALID_SELECTION_RESULT');
      } else if (decision.decisionType === 'OCTAVE_DISPLACED') {
        if (shift === 0) return fail('Octave-displaced decision requires a non-zero shift.', 'INVALID_SELECTION_RESULT', { sourceEventId });
        equal(ruleId, 'OCTAVE_NEAREST_IN_REGISTER', `${path}.ruleId`, 'INVALID_SELECTION_RESULT');
      } else if (decision.decisionType === 'CHORD_REDUCED') {
        equal(shift, 0, `${path}.octaveShiftSemitones`, 'INVALID_SELECTION_RESULT');
        equal(ruleId, 'CHORD_REDUCTION_KEEP_OUTER', `${path}.ruleId`, 'INVALID_SELECTION_RESULT');
      } else {
        return fail('KEEP disposition conflicts with omitted decision.', 'INVALID_SELECTION_RESULT', { sourceEventId });
      }
    }
    const outputEntry = Object.freeze({
      sourceEventId,
      target: Object.freeze({ ...expected.target! }),
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

  for (const group of groups.values()) {
    const retained = group.sourceEventIds.map((id) => bySourceId.get(id)!).filter((entry) => entry.disposition === 'KEEP');
    const strings = new Set<number>();
    for (const entry of retained) {
      if (strings.has(entry.selectedPosition!.string)) return fail('Retained simultaneous notes select the same string.', 'INVALID_SELECTION_RESULT', { groupId: group.groupId, string: entry.selectedPosition!.string });
      strings.add(entry.selectedPosition!.string);
    }
    if (retained.length < 2) retained.forEach((entry) => equal(entry.selectedShapeId, null, 'canonicalTabResult.noteDispositions.selectedShapeId', 'INVALID_SELECTION_RESULT'));
  }
  return Object.freeze({ entries: Object.freeze(output), bySourceId });
};

const validateSelectedShapes = (
  result: RecordValue,
  groups: readonly ExpectedGroup[],
  dispositions: ReadonlyMap<string, GuitarWorkspaceResultEntry>
): readonly Readonly<GuitarWorkspaceSelectedShape>[] => {
  const expected = groups.map((group) => ({ group, retainedIds: group.sourceEventIds.filter((id) => dispositions.get(id)!.disposition === 'KEEP') })).filter((item) => item.retainedIds.length >= 2);
  const actual = array(result.selectedShapes, 'canonicalTabResult.selectedShapes');
  equal(actual.length, expected.length, 'canonicalTabResult.selectedShapes.length', 'INVALID_SELECTION_RESULT');
  const output: Readonly<GuitarWorkspaceSelectedShape>[] = [];
  expected.forEach(({ group, retainedIds }, index) => {
    const path = `canonicalTabResult.selectedShapes[${index}]`;
    const shape = exactObject(actual[index], ['selectedShapeId', 'sourceGroupId', 'sourceEventIds', 'voicingCandidateId', 'shapeCandidateId', 'fingerAssignments', 'barres', 'physicalValidation'], path);
    const selectedShapeId = string(shape.selectedShapeId, `${path}.selectedShapeId`);
    equal(string(shape.sourceGroupId, `${path}.sourceGroupId`), group.groupId, `${path}.sourceGroupId`, 'INVALID_SELECTION_RESULT');
    equal(selectedShapeId, `${group.groupId}:selected-shape`, `${path}.selectedShapeId`, 'INVALID_SELECTION_RESULT');
    string(shape.voicingCandidateId, `${path}.voicingCandidateId`);
    string(shape.shapeCandidateId, `${path}.shapeCandidateId`);
    const ids = array(shape.sourceEventIds, `${path}.sourceEventIds`).map((id, memberIndex) => string(id, `${path}.sourceEventIds[${memberIndex}]`));
    if (JSON.stringify(ids) !== JSON.stringify(retainedIds)) return fail('Selected-shape membership/order is invalid.', 'INVALID_SELECTION_RESULT', { groupId: group.groupId });
    const targets = ids.map((id) => {
      const entry = dispositions.get(id)!;
      equal(entry.selectedShapeId, selectedShapeId, 'canonicalTabResult.noteDispositions.selectedShapeId', 'INVALID_SELECTION_RESULT');
      return entry.target;
    });
    const assignments = array(shape.fingerAssignments, `${path}.fingerAssignments`);
    equal(assignments.length, ids.length, `${path}.fingerAssignments.length`, 'INVALID_SELECTION_RESULT');
    const fingerById = new Map<string, number>();
    const fingerAssignments = assignments.map((rawAssignment, assignmentIndex) => {
      const assignmentPath = `${path}.fingerAssignments[${assignmentIndex}]`;
      const assignment = exactObject(rawAssignment, ['sourceEventId', 'finger'], assignmentPath);
      const sourceEventId = string(assignment.sourceEventId, `${assignmentPath}.sourceEventId`);
      equal(sourceEventId, ids[assignmentIndex], `${assignmentPath}.sourceEventId`, 'INVALID_SELECTION_RESULT');
      const finger = integer(assignment.finger, `${assignmentPath}.finger`, 0, 4);
      const position = dispositions.get(sourceEventId)!.selectedPosition!;
      if (position.fret === 0) equal(finger, 0, `${assignmentPath}.finger`, 'INVALID_SELECTION_RESULT');
      else if (finger === 0) return fail('Fretted selected position requires finger 1..4.', 'INVALID_SELECTION_RESULT', { sourceEventId });
      fingerById.set(sourceEventId, finger);
      return Object.freeze({ sourceEventId, target: dispositions.get(sourceEventId)!.target, finger });
    });
    const barres = array(shape.barres, `${path}.barres`).map((rawBarre, barreIndex) => {
      const barrePath = `${path}.barres[${barreIndex}]`;
      const barre = exactObject(rawBarre, ['finger', 'fret', 'startString', 'endString', 'stringSpan', 'kind'], barrePath);
      const finger = integer(barre.finger, `${barrePath}.finger`, 1, 4);
      const fret = integer(barre.fret, `${barrePath}.fret`, 1, 20);
      const startString = integer(barre.startString, `${barrePath}.startString`, 1, 6);
      const endString = integer(barre.endString, `${barrePath}.endString`, 1, 6);
      if (startString > endString) return fail('Barre string order is invalid.', 'INVALID_SELECTION_RESULT', { groupId: group.groupId });
      const stringSpan = integer(barre.stringSpan, `${barrePath}.stringSpan`, 1, 6);
      equal(stringSpan, endString - startString + 1, `${barrePath}.stringSpan`, 'INVALID_SELECTION_RESULT');
      const kind = string(barre.kind, `${barrePath}.kind`);
      equal(kind, startString === 1 && endString === 6 ? 'FULL_BARRE' : 'PARTIAL_BARRE', `${barrePath}.kind`, 'INVALID_SELECTION_RESULT');
      let matching = 0;
      for (const id of ids) {
        const position = dispositions.get(id)!.selectedPosition!;
        if (position.string < startString || position.string > endString) continue;
        if (position.fret < fret) return fail('Barre is blocked by a lower fret.', 'INVALID_SELECTION_RESULT', { sourceEventId: id });
        if (position.fret === fret) {
          if (fingerById.get(id) !== finger) return fail('Barre finger does not match selected assignment.', 'INVALID_SELECTION_RESULT', { sourceEventId: id });
          matching += 1;
        }
      }
      if (matching < 2) return fail('Barre requires at least two matching assignments.', 'INVALID_SELECTION_RESULT', { groupId: group.groupId });
      return Object.freeze({ finger, fret, startString, endString, stringSpan, kind: kind as 'FULL_BARRE' | 'PARTIAL_BARRE' });
    });
    const physical = exactObject(shape.physicalValidation, ['status'], `${path}.physicalValidation`);
    equal(physical.status, 'PLAYABLE_WITHIN_POLICY', `${path}.physicalValidation.status`, 'INVALID_SELECTION_RESULT');
    output.push(Object.freeze({
      selectedShapeId,
      sourceGroupId: group.groupId,
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
  canonicalTabResultJson: string
): Readonly<GuitarWorkspaceResult> => {
  if (typeof canonicalTabResultJson !== 'string') return fail('CanonicalTabResult input must be a JSON string.', 'INVALID_JSON');
  const byteLength = new TextEncoder().encode(canonicalTabResultJson).byteLength;
  if (byteLength === 0 || byteLength > MAX_CANONICAL_TAB_RESULT_JSON_BYTES) return fail('CanonicalTabResult JSON exceeds the admitted input size.', 'RESULT_SIZE_LIMIT', { byteLength, maximum: MAX_CANONICAL_TAB_RESULT_JSON_BYTES });
  let parsed: unknown;
  try { parsed = JSON.parse(canonicalTabResultJson); } catch { return fail('CanonicalTabResult input is not valid JSON.', 'INVALID_JSON'); }
  const result = exactObject(parsed, ['documentType', 'schemaVersion', 'engine', 'source', 'review', 'guitar', 'policyProvenance', 'measures', 'simultaneousGroups', 'arrangementDecisions', 'noteDispositions', 'selectedShapes'], 'canonicalTabResult');
  let notation: Readonly<NotationDocument>;
  try { notation = createNotationDocument(score, notationInput); }
  catch (error) {
    const code = error instanceof Error && 'code' in error ? String((error as { code?: unknown }).code) : null;
    return fail('Guitar Workspace result requires current revision-bound notation.', code === 'STALE_NOTATION' ? 'STALE_NOTATION' : 'SOURCE_FACT_MISMATCH', { notationCode: code });
  }
  const envelope = validateEnvelope(result);
  validatePolicyProvenance(result.policyProvenance);
  const expected = deriveExpectedSource(score, notation);
  if (expected.noteEvents.length > MAX_SOURCE_EVENTS) return fail('Current projection exceeds the admitted source-event ceiling.', 'SOURCE_FACT_MISMATCH');
  validateSourceFacts(result, expected);
  const groups = validateGroups(result, expected.groups);
  const decisions = validateDecisions(result, expected.noteEvents, groups);
  const dispositions = validateDispositions(result, expected.noteEvents, decisions, groups);
  const selectedShapes = validateSelectedShapes(result, expected.groups, dispositions.bySourceId);
  return Object.freeze({
    contractVersion: GUITAR_WORKSPACE_RESULT_VERSION,
    documentId: score.id,
    revisionId: score.revision.id,
    engine: Object.freeze({ name: CANONICAL_TAB_ENGINE_NAME, version: envelope.engineVersion }),
    teacherReviewStatus: envelope.reviewState,
    entries: dispositions.entries,
    selectedShapes
  });
};
