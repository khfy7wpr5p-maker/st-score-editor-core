import { createScoreDocument } from '../../score-model/src/index.js';
import type { Rational, ScoreDocument, ScoreEvent } from '../../score-model/src/index.js';
import { addressEntity, resolveSemanticAddress } from '../../addressing/src/index.js';
import type { EventAddress } from '../../addressing/src/index.js';
import {
  createNotationDocument,
  notationForEvent,
  notationForNote
} from '../../notation-structure/src/index.js';
import type { NotationDocument, TimeSignature } from '../../notation-structure/src/index.js';
import { rebindNotationAfterScoreEdit } from '../../editor-history/src/index.js';
import { createInsertionPosition } from '../../editor-insertion-position/src/index.js';
import { analyzeMeasureTiming } from '../../editor-measure-timing/src/index.js';
import {
  createMusicXmlMeasureSemanticsDocument,
  semanticsForMeasure
} from '../../musicxml-measure-semantics/src/index.js';
import type { MusicXmlMeasureSemanticsDocument } from '../../musicxml-measure-semantics/src/index.js';

export const TRIPLET_RETIMING_VERSION = '1.0.0' as const;

export interface MoveTripletGroupIntent {
  readonly version: typeof TRIPLET_RETIMING_VERSION;
  readonly type: 'MOVE_TRIPLET_GROUP';
  readonly targets: readonly [EventAddress, EventAddress, EventAddress];
  readonly newStartOnset: Rational;
}

export interface TripletRetimingCommitIdentity {
  readonly version: typeof TRIPLET_RETIMING_VERSION;
  readonly operationId: string;
  readonly nextRevisionId: string;
}

export interface TripletRetimingResult {
  readonly score: Readonly<ScoreDocument>;
  readonly notation: Readonly<NotationDocument>;
}

export type TripletRetimingErrorCode =
  | 'INVALID_INTENT'
  | 'INVALID_IDENTITY'
  | 'STALE_TARGET'
  | 'RANGE_NOT_EXACT'
  | 'TUPLET_STATE_UNSUPPORTED'
  | 'COUPLED_NOTATION_UNSUPPORTED'
  | 'NO_OP'
  | 'MISSING_MEASURE_EVIDENCE'
  | 'INVALID_MEASURE_EVIDENCE'
  | 'UNSAFE_MEASURE_SEMANTICS'
  | 'TIME_SIGNATURE_MISMATCH'
  | 'TIMING_REJECTED'
  | 'RESULT_INVALID';

export class TripletRetimingError extends Error {
  readonly code: TripletRetimingErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: TripletRetimingErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'TripletRetimingError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

type UnknownRecord = Record<string, unknown>;

const exactRecord = (value: unknown, fields: readonly string[], label: string, code: TripletRetimingErrorCode): UnknownRecord => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TripletRetimingError(`${label} must be an object.`, code);
  const record = value as UnknownRecord;
  const observed = Object.keys(record).sort();
  const expected = [...fields].sort();
  if (JSON.stringify(observed) !== JSON.stringify(expected)) throw new TripletRetimingError(`${label} field set is invalid.`, code, { observed, expected });
  return record;
};

const gcd = (left: bigint, right: bigint): bigint => {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
};

const rational = (numerator: bigint, denominator: bigint): Readonly<Rational> => {
  if (numerator < 0n || denominator <= 0n) throw new TripletRetimingError('Timing arithmetic produced an invalid rational.', 'INVALID_INTENT');
  const divisor = gcd(numerator, denominator);
  const n = numerator / divisor;
  const d = denominator / divisor;
  if (n > BigInt(Number.MAX_SAFE_INTEGER) || d > BigInt(Number.MAX_SAFE_INTEGER)) throw new TripletRetimingError('Timing arithmetic exceeded safe bounds.', 'INVALID_INTENT');
  return Object.freeze({ numerator: Number(n), denominator: Number(d) });
};

const canonicalOnset = (value: unknown): Readonly<Rational> => {
  const record = exactRecord(value, ['numerator', 'denominator'], 'newStartOnset', 'INVALID_INTENT');
  if (
    typeof record.numerator !== 'number' || !Number.isSafeInteger(record.numerator) || record.numerator < 0 ||
    typeof record.denominator !== 'number' || !Number.isSafeInteger(record.denominator) || record.denominator <= 0 ||
    gcd(BigInt(record.numerator), BigInt(record.denominator)) !== 1n
  ) throw new TripletRetimingError('newStartOnset must be a canonical non-negative rational.', 'INVALID_INTENT');
  return Object.freeze({ numerator: record.numerator, denominator: record.denominator });
};

const add = (left: Rational, right: Rational): Readonly<Rational> => rational(
  BigInt(left.numerator) * BigInt(right.denominator) + BigInt(right.numerator) * BigInt(left.denominator),
  BigInt(left.denominator) * BigInt(right.denominator)
);

const compare = (left: Rational, right: Rational): number => {
  const l = BigInt(left.numerator) * BigInt(right.denominator);
  const r = BigInt(right.numerator) * BigInt(left.denominator);
  return l < r ? -1 : l > r ? 1 : 0;
};

const sameRational = (left: Rational, right: Rational): boolean => compare(left, right) === 0;
const sameTime = (left: TimeSignature, right: TimeSignature): boolean => left.beats === right.beats && left.beatType === right.beatType;
const validId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);

const noteIdsFor = (event: ScoreEvent): readonly string[] => event.kind === 'note' ? [event.note.id] : event.kind === 'chord' ? event.notes.map((note) => note.id) : [];

const parseIdentity = (score: ScoreDocument, value: unknown): Readonly<TripletRetimingCommitIdentity> => {
  const record = exactRecord(value, ['version', 'operationId', 'nextRevisionId'], 'TripletRetimingCommitIdentity', 'INVALID_IDENTITY');
  if (record.version !== TRIPLET_RETIMING_VERSION || !validId(record.operationId) || !validId(record.nextRevisionId)) throw new TripletRetimingError('Triplet retiming identity is invalid.', 'INVALID_IDENTITY');
  if (record.nextRevisionId === score.revision.id || record.nextRevisionId === score.revision.parentId) throw new TripletRetimingError('Next revision id conflicts with current lineage.', 'INVALID_IDENTITY');
  return Object.freeze({ version: TRIPLET_RETIMING_VERSION, operationId: record.operationId, nextRevisionId: record.nextRevisionId });
};

const parseIntent = (score: ScoreDocument, value: unknown): Readonly<MoveTripletGroupIntent> => {
  const record = exactRecord(value, ['version', 'type', 'targets', 'newStartOnset'], 'MoveTripletGroupIntent', 'INVALID_INTENT');
  if (record.version !== TRIPLET_RETIMING_VERSION || record.type !== 'MOVE_TRIPLET_GROUP' || !Array.isArray(record.targets) || record.targets.length !== 3) {
    throw new TripletRetimingError('Triplet retiming requires exactly three explicit event targets.', 'INVALID_INTENT');
  }
  const targets = record.targets.map((raw, index) => {
    try {
      const target = raw as EventAddress;
      const resolved = resolveSemanticAddress(score, target);
      if (resolved.kind !== 'event') throw new Error(`observed ${resolved.kind}`);
      return target;
    } catch (error) {
      throw new TripletRetimingError(`Triplet target ${index} is stale or invalid.`, 'STALE_TARGET', { cause: error instanceof Error ? error.message : String(error) });
    }
  });
  if (new Set(targets.map((target) => target.eventId)).size !== 3) throw new TripletRetimingError('Triplet targets must be distinct.', 'INVALID_INTENT');
  return Object.freeze({
    version: TRIPLET_RETIMING_VERSION,
    type: 'MOVE_TRIPLET_GROUP',
    targets: Object.freeze(targets) as unknown as readonly [EventAddress, EventAddress, EventAddress],
    newStartOnset: canonicalOnset(record.newStartOnset)
  });
};

const validateMeasureEvidence = (score: ScoreDocument, target: EventAddress, raw: MusicXmlMeasureSemanticsDocument | null) => {
  if (raw === null) {
    if (score.source.format === 'musicxml') throw new TripletRetimingError('MusicXML-derived triplet retiming requires current 04B1 evidence.', 'MISSING_MEASURE_EVIDENCE');
    return null;
  }
  let evidence: Readonly<MusicXmlMeasureSemanticsDocument>;
  try { evidence = createMusicXmlMeasureSemanticsDocument(score, raw); }
  catch (error) { throw new TripletRetimingError('Measure evidence is stale or invalid.', 'INVALID_MEASURE_EVIDENCE', { cause: error instanceof Error ? error.message : String(error) }); }
  const entry = semanticsForMeasure(evidence, target.measureId);
  if (entry === null || entry.target.partId !== target.partId || entry.target.staffId !== target.staffId) throw new TripletRetimingError('Exact measure evidence is missing.', 'INVALID_MEASURE_EVIDENCE');
  if (entry.implicit === 'yes' || entry.nonControlling === 'yes' || entry.effectiveTimeSignature === null) throw new TripletRetimingError('Triplet retiming is not admitted for pickup/incomplete, non-controlling or unknown-meter measures.', 'UNSAFE_MEASURE_SEMANTICS');
  return entry;
};

const eventFor = (score: ScoreDocument, target: EventAddress): ScoreEvent => {
  const resolved = resolveSemanticAddress(score, target);
  if (resolved.kind !== 'event') throw new TripletRetimingError('Triplet event target changed kind.', 'STALE_TARGET');
  return resolved.value;
};

const assertExactTriplet = (score: ScoreDocument, notation: NotationDocument, targets: readonly [EventAddress, EventAddress, EventAddress]) => {
  const first = targets[0];
  if (!targets.every((target) => target.partId === first.partId && target.staffId === first.staffId && target.measureId === first.measureId && target.voiceId === first.voiceId)) {
    throw new TripletRetimingError('Triplet targets must stay inside one exact measure voice.', 'RANGE_NOT_EXACT');
  }
  const voiceAddress = addressEntity(score, first.voiceId);
  const voiceResolved = resolveSemanticAddress(score, voiceAddress);
  if (voiceResolved.kind !== 'voice') throw new TripletRetimingError('Triplet voice could not be resolved.', 'RANGE_NOT_EXACT');
  const indices = targets.map((target) => voiceResolved.value.events.findIndex((event) => event.id === target.eventId));
  if (indices[0] < 0 || indices[1] !== indices[0] + 1 || indices[2] !== indices[1] + 1) throw new TripletRetimingError('Triplet targets must be three consecutive current voice events.', 'RANGE_NOT_EXACT', { indices });

  const events = targets.map((target) => eventFor(score, target));
  if (!events.every((event) => sameRational(event.duration, events[0].duration))) throw new TripletRetimingError('Supported triplet retiming requires equal canonical durations.', 'TUPLET_STATE_UNSUPPORTED');
  if (!sameRational(add(events[0].onset, events[0].duration), events[1].onset) || !sameRational(add(events[1].onset, events[1].duration), events[2].onset)) {
    throw new TripletRetimingError('Supported triplet events must already be canonically contiguous.', 'TUPLET_STATE_UNSUPPORTED');
  }

  const notationEntries = events.map((event) => notationForEvent(notation, event.id));
  if (notationEntries.some((entry) => entry === null || entry.tuplet === null)) throw new TripletRetimingError('All three events must carry explicit current triplet notation.', 'TUPLET_STATE_UNSUPPORTED');
  if (notationEntries.some((entry) => entry!.beams.length > 0)) throw new TripletRetimingError('Triplet retiming with beam coupling is not admitted in v1.', 'COUPLED_NOTATION_UNSUPPORTED');
  if (notationEntries.some((entry) => entry!.tuplet!.actualNotes !== 3 || entry!.tuplet!.normalNotes !== 2)) throw new TripletRetimingError('Only current 3:2 triplets are admitted.', 'TUPLET_STATE_UNSUPPORTED');

  const firstMarks = notationEntries[0]!.tuplet!.marks;
  const middleMarks = notationEntries[1]!.tuplet!.marks;
  const lastMarks = notationEntries[2]!.tuplet!.marks;
  if (firstMarks.length !== 1 || firstMarks[0]!.type !== 'start' || middleMarks.length !== 0 || lastMarks.length !== 1 || lastMarks[0]!.type !== 'stop' || firstMarks[0]!.number !== lastMarks[0]!.number) {
    throw new TripletRetimingError('Triplet boundary marks do not form one exact atomic 3-event range.', 'TUPLET_STATE_UNSUPPORTED');
  }

  for (const event of events) for (const noteId of noteIdsFor(event)) {
    const noteNotation = notationForNote(notation, noteId);
    if ((noteNotation?.ties.length ?? 0) > 0 || (noteNotation?.slurs.length ?? 0) > 0) {
      throw new TripletRetimingError('Triplet retiming with tie/slur coupling is not admitted in v1.', 'COUPLED_NOTATION_UNSUPPORTED', { noteId });
    }
  }
  return { events, voice: voiceResolved.value, indices };
};

const buildCandidate = (
  score: ScoreDocument,
  targetIds: readonly string[],
  newOnsets: ReadonlyMap<string, Rational>,
  nextRevisionId: string
): Readonly<ScoreDocument> => {
  const originalOrder = new Map<string, number>();
  for (const part of score.parts) for (const staff of part.staves) for (const measure of staff.measures) for (const voice of measure.voices) {
    voice.events.forEach((event, index) => originalOrder.set(event.id, index));
  }
  try {
    return createScoreDocument({
      ...score,
      revision: { id: nextRevisionId, parentId: score.revision.id },
      parts: score.parts.map((part) => ({
        ...part,
        staves: part.staves.map((staff) => ({
          ...staff,
          measures: staff.measures.map((measure) => ({
            ...measure,
            voices: measure.voices.map((voice) => ({
              ...voice,
              events: voice.events.map((event) => targetIds.includes(event.id) ? ({ ...event, onset: newOnsets.get(event.id)! }) : event)
                .sort((left, right) => compare(left.onset, right.onset) || (originalOrder.get(left.id) ?? 0) - (originalOrder.get(right.id) ?? 0))
            }))
          }))
        }))
      }))
    });
  } catch (error) {
    throw new TripletRetimingError('Triplet retiming candidate failed canonical validation.', 'RESULT_INVALID', { cause: error instanceof Error ? error.message : String(error) });
  }
};

export const executeTripletRetiming = (
  score: ScoreDocument,
  notationInput: NotationDocument,
  measureSemantics: MusicXmlMeasureSemanticsDocument | null,
  rawIntent: unknown,
  rawIdentity: unknown
): Readonly<TripletRetimingResult> => {
  let notation: Readonly<NotationDocument>;
  try { notation = createNotationDocument(score, notationInput); }
  catch (error) { throw new TripletRetimingError('Triplet retiming requires current notation.', 'STALE_TARGET', { cause: error instanceof Error ? error.message : String(error) }); }

  const intent = parseIntent(score, rawIntent);
  const identity = parseIdentity(score, rawIdentity);
  const exact = assertExactTriplet(score, notation, intent.targets);
  if (sameRational(exact.events[0].onset, intent.newStartOnset)) throw new TripletRetimingError('Triplet group retiming must change the start onset.', 'NO_OP');
  const sourceEvidence = validateMeasureEvidence(score, intent.targets[0], measureSemantics);

  const secondOnset = add(intent.newStartOnset, exact.events[0].duration);
  const thirdOnset = add(secondOnset, exact.events[1].duration);
  const onsets = new Map<string, Rational>([
    [intent.targets[0].eventId, intent.newStartOnset],
    [intent.targets[1].eventId, secondOnset],
    [intent.targets[2].eventId, thirdOnset]
  ]);
  const candidate = buildCandidate(score, intent.targets.map((target) => target.eventId), onsets, identity.nextRevisionId);
  const nextNotation = rebindNotationAfterScoreEdit(score, notation, candidate);

  try {
    const voiceAddress = addressEntity(candidate, intent.targets[0].voiceId);
    if (voiceAddress.kind !== 'voice') throw new Error(`observed ${voiceAddress.kind}`);
    const position = createInsertionPosition(candidate, voiceAddress, intent.newStartOnset);
    const analysis = analyzeMeasureTiming(candidate, nextNotation, position);
    if (sourceEvidence !== null && !sameTime(sourceEvidence.effectiveTimeSignature!, analysis.timeSignature)) {
      throw new TripletRetimingError('04B1 meter disagrees with independent 04A timing.', 'TIME_SIGNATURE_MISMATCH');
    }
  } catch (error) {
    if (error instanceof TripletRetimingError) throw error;
    throw new TripletRetimingError('Atomic triplet retiming was rejected by independent measure timing/occupancy validation.', 'TIMING_REJECTED', { cause: error instanceof Error ? error.message : String(error) });
  }

  return Object.freeze({ score: candidate, notation: nextNotation });
};
