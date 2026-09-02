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

export const EVENT_RETIMING_VERSION = '1.0.0' as const;

export interface MoveEventIntent {
  readonly version: typeof EVENT_RETIMING_VERSION;
  readonly type: 'MOVE_EVENT';
  readonly target: EventAddress;
  readonly newOnset: Rational;
}

export interface EventRetimingCommitIdentity {
  readonly version: typeof EVENT_RETIMING_VERSION;
  readonly operationId: string;
  readonly nextRevisionId: string;
}

export interface EventRetimingResult {
  readonly score: Readonly<ScoreDocument>;
  readonly notation: Readonly<NotationDocument>;
}

export type EventRetimingErrorCode =
  | 'INVALID_INTENT'
  | 'INVALID_IDENTITY'
  | 'STALE_TARGET'
  | 'NO_OP'
  | 'COUPLED_NOTATION'
  | 'CROSSES_COUPLED_EVENT'
  | 'MISSING_MEASURE_EVIDENCE'
  | 'INVALID_MEASURE_EVIDENCE'
  | 'UNSAFE_MEASURE_SEMANTICS'
  | 'TIME_SIGNATURE_MISMATCH'
  | 'TIMING_REJECTED'
  | 'RESULT_INVALID';

export class EventRetimingError extends Error {
  readonly code: EventRetimingErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, code: EventRetimingErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'EventRetimingError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

type UnknownRecord = Record<string, unknown>;

const exactRecord = (value: unknown, fields: readonly string[], label: string, code: EventRetimingErrorCode): UnknownRecord => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new EventRetimingError(`${label} must be an object.`, code);
  }
  const record = value as UnknownRecord;
  const observed = Object.keys(record).sort();
  const expected = [...fields].sort();
  if (JSON.stringify(observed) !== JSON.stringify(expected)) {
    throw new EventRetimingError(`${label} field set is invalid.`, code, { observed, expected });
  }
  return record;
};

const gcd = (left: bigint, right: bigint): bigint => {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
};

const canonicalOnset = (value: unknown): Readonly<Rational> => {
  const record = exactRecord(value, ['numerator', 'denominator'], 'newOnset', 'INVALID_INTENT');
  if (
    typeof record.numerator !== 'number' || !Number.isSafeInteger(record.numerator) || record.numerator < 0 ||
    typeof record.denominator !== 'number' || !Number.isSafeInteger(record.denominator) || record.denominator <= 0
  ) {
    throw new EventRetimingError('newOnset must be a non-negative canonical rational.', 'INVALID_INTENT');
  }
  if (gcd(BigInt(record.numerator), BigInt(record.denominator)) !== 1n) {
    throw new EventRetimingError('newOnset must be reduced to canonical form.', 'INVALID_INTENT');
  }
  return Object.freeze({ numerator: record.numerator, denominator: record.denominator });
};

const compare = (left: Rational, right: Rational): number => {
  const l = BigInt(left.numerator) * BigInt(right.denominator);
  const r = BigInt(right.numerator) * BigInt(left.denominator);
  return l < r ? -1 : l > r ? 1 : 0;
};

const sameTime = (left: TimeSignature, right: TimeSignature): boolean =>
  left.beats === right.beats && left.beatType === right.beatType;

const validId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);

const parseIdentity = (score: ScoreDocument, value: unknown): Readonly<EventRetimingCommitIdentity> => {
  const record = exactRecord(value, ['version', 'operationId', 'nextRevisionId'], 'EventRetimingCommitIdentity', 'INVALID_IDENTITY');
  if (record.version !== EVENT_RETIMING_VERSION || !validId(record.operationId) || !validId(record.nextRevisionId)) {
    throw new EventRetimingError('Event retiming identity is invalid.', 'INVALID_IDENTITY');
  }
  if (record.nextRevisionId === score.revision.id || record.nextRevisionId === score.revision.parentId) {
    throw new EventRetimingError('Next revision id conflicts with current revision lineage.', 'INVALID_IDENTITY');
  }
  return Object.freeze({
    version: EVENT_RETIMING_VERSION,
    operationId: record.operationId,
    nextRevisionId: record.nextRevisionId
  });
};

const parseIntent = (score: ScoreDocument, value: unknown): Readonly<MoveEventIntent> => {
  const record = exactRecord(value, ['version', 'type', 'target', 'newOnset'], 'MoveEventIntent', 'INVALID_INTENT');
  if (record.version !== EVENT_RETIMING_VERSION || record.type !== 'MOVE_EVENT') {
    throw new EventRetimingError('Event retiming intent is unsupported.', 'INVALID_INTENT');
  }
  let target: EventAddress;
  try {
    const candidate = record.target as EventAddress;
    const resolved = resolveSemanticAddress(score, candidate);
    if (resolved.kind !== 'event') throw new Error(`observed ${resolved.kind}`);
    target = candidate;
  } catch (error) {
    throw new EventRetimingError('MOVE_EVENT target is stale or invalid for the current score revision.', 'STALE_TARGET', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
  return Object.freeze({
    version: EVENT_RETIMING_VERSION,
    type: 'MOVE_EVENT',
    target,
    newOnset: canonicalOnset(record.newOnset)
  });
};

const noteIdsFor = (event: ScoreEvent): readonly string[] =>
  event.kind === 'note' ? [event.note.id] : event.kind === 'chord' ? event.notes.map((note) => note.id) : [];

const couplingReasons = (notation: NotationDocument, event: ScoreEvent): readonly string[] => {
  const reasons: string[] = [];
  const eventNotation = notationForEvent(notation, event.id);
  if ((eventNotation?.beams.length ?? 0) > 0) reasons.push('beam');
  if ((eventNotation?.tuplet ?? null) !== null) reasons.push('tuplet');
  for (const noteId of noteIdsFor(event)) {
    const noteNotation = notationForNote(notation, noteId);
    if ((noteNotation?.ties.length ?? 0) > 0) reasons.push(`tie:${noteId}`);
    if ((noteNotation?.slurs.length ?? 0) > 0) reasons.push(`slur:${noteId}`);
  }
  return Object.freeze(reasons);
};

const eventById = (score: ScoreDocument, eventId: string): ScoreEvent => {
  for (const part of score.parts) for (const staff of part.staves) for (const measure of staff.measures) {
    for (const voice of measure.voices) {
      const event = voice.events.find((item) => item.id === eventId);
      if (event !== undefined) return event;
    }
  }
  throw new EventRetimingError('Event target disappeared.', 'STALE_TARGET', { eventId });
};

const validateMeasureEvidence = (
  score: ScoreDocument,
  target: EventAddress,
  rawEvidence: MusicXmlMeasureSemanticsDocument | null
) => {
  if (rawEvidence === null) {
    if (score.source.format === 'musicxml') {
      throw new EventRetimingError('MusicXML-derived retiming requires current measure-semantics evidence.', 'MISSING_MEASURE_EVIDENCE');
    }
    return null;
  }
  let evidence: Readonly<MusicXmlMeasureSemanticsDocument>;
  try {
    evidence = createMusicXmlMeasureSemanticsDocument(score, rawEvidence);
  } catch (error) {
    throw new EventRetimingError('Measure-semantics evidence is stale or invalid.', 'INVALID_MEASURE_EVIDENCE', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
  const entry = semanticsForMeasure(evidence, target.measureId);
  if (entry === null || entry.target.partId !== target.partId || entry.target.staffId !== target.staffId) {
    throw new EventRetimingError('Exact measure-semantics evidence is missing for the retiming target.', 'INVALID_MEASURE_EVIDENCE');
  }
  if (entry.implicit === 'yes' || entry.nonControlling === 'yes' || entry.effectiveTimeSignature === null) {
    throw new EventRetimingError('Retiming is not admitted for pickup/incomplete, non-controlling, or unknown-meter measures.', 'UNSAFE_MEASURE_SEMANTICS', {
      implicit: entry.implicit,
      nonControlling: entry.nonControlling,
      effectiveTimeSignature: entry.effectiveTimeSignature
    });
  }
  return entry;
};

const replaceTargetOnset = (
  score: ScoreDocument,
  target: EventAddress,
  newOnset: Rational,
  nextRevisionId: string
): Readonly<ScoreDocument> => {
  const originalVoice = score.parts
    .find((part) => part.id === target.partId)?.staves
    .find((staff) => staff.id === target.staffId)?.measures
    .find((measure) => measure.id === target.measureId)?.voices
    .find((voice) => voice.id === target.voiceId);
  if (originalVoice === undefined) throw new EventRetimingError('Retiming target voice disappeared.', 'STALE_TARGET');
  const originalOrder = new Map(originalVoice.events.map((event, index) => [event.id, index] as const));

  try {
    return createScoreDocument({
      ...score,
      revision: { id: nextRevisionId, parentId: score.revision.id },
      parts: score.parts.map((part) => part.id !== target.partId ? part : ({
        ...part,
        staves: part.staves.map((staff) => staff.id !== target.staffId ? staff : ({
          ...staff,
          measures: staff.measures.map((measure) => measure.id !== target.measureId ? measure : ({
            ...measure,
            voices: measure.voices.map((voice) => voice.id !== target.voiceId ? voice : ({
              ...voice,
              events: voice.events
                .map((event) => event.id === target.eventId ? ({ ...event, onset: newOnset }) : event)
                .sort((left, right) => compare(left.onset, right.onset) ||
                  (originalOrder.get(left.id) ?? 0) - (originalOrder.get(right.id) ?? 0))
            }))
          }))
        }))
      }))
    });
  } catch (error) {
    throw new EventRetimingError('Retiming candidate failed canonical score validation.', 'RESULT_INVALID', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
};

const crossedEvents = (
  score: ScoreDocument,
  target: EventAddress,
  oldOnset: Rational,
  newOnset: Rational
): readonly ScoreEvent[] => {
  const voice = score.parts.find((part) => part.id === target.partId)?.staves
    .find((staff) => staff.id === target.staffId)?.measures
    .find((measure) => measure.id === target.measureId)?.voices
    .find((item) => item.id === target.voiceId);
  if (voice === undefined) throw new EventRetimingError('Retiming target voice disappeared.', 'STALE_TARGET');
  const lower = compare(oldOnset, newOnset) < 0 ? oldOnset : newOnset;
  const upper = compare(oldOnset, newOnset) < 0 ? newOnset : oldOnset;
  return Object.freeze(voice.events.filter((event) =>
    event.id !== target.eventId && compare(event.onset, lower) > 0 && compare(event.onset, upper) <= 0
  ));
};

export const executeEventRetiming = (
  score: ScoreDocument,
  notationInput: NotationDocument,
  measureSemantics: MusicXmlMeasureSemanticsDocument | null,
  rawIntent: unknown,
  rawIdentity: unknown
): Readonly<EventRetimingResult> => {
  let notation: Readonly<NotationDocument>;
  try {
    notation = createNotationDocument(score, notationInput);
  } catch (error) {
    throw new EventRetimingError('Retiming requires notation bound to the current score revision.', 'STALE_TARGET', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  const intent = parseIntent(score, rawIntent);
  const identity = parseIdentity(score, rawIdentity);
  const currentEvent = eventById(score, intent.target.eventId);
  if (compare(currentEvent.onset, intent.newOnset) === 0) {
    throw new EventRetimingError('MOVE_EVENT must change the canonical onset.', 'NO_OP');
  }

  const ownCoupling = couplingReasons(notation, currentEvent);
  if (ownCoupling.length > 0) {
    throw new EventRetimingError('A notation-coupled event cannot be retimed independently.', 'COUPLED_NOTATION', {
      eventId: currentEvent.id,
      coupling: ownCoupling
    });
  }

  for (const crossed of crossedEvents(score, intent.target, currentEvent.onset, intent.newOnset)) {
    const coupling = couplingReasons(notation, crossed);
    if (coupling.length > 0) {
      throw new EventRetimingError('MOVE_EVENT may not cross a notation-coupled event without an atomic group-retiming contract.', 'CROSSES_COUPLED_EVENT', {
        crossedEventId: crossed.id,
        coupling
      });
    }
  }

  const sourceMeasureEvidence = validateMeasureEvidence(score, intent.target, measureSemantics);
  const candidate = replaceTargetOnset(score, intent.target, intent.newOnset, identity.nextRevisionId);
  const nextNotation = rebindNotationAfterScoreEdit(score, notation, candidate);

  try {
    const voiceAddress = addressEntity(candidate, intent.target.voiceId);
    if (voiceAddress.kind !== 'voice') throw new Error(`observed ${voiceAddress.kind}`);
    const position = createInsertionPosition(candidate, voiceAddress, intent.newOnset);
    const analysis = analyzeMeasureTiming(candidate, nextNotation, position);
    if (sourceMeasureEvidence !== null && !sameTime(sourceMeasureEvidence.effectiveTimeSignature!, analysis.timeSignature)) {
      throw new EventRetimingError('04B1 measure meter disagrees with independent 04A timing after retiming.', 'TIME_SIGNATURE_MISMATCH', {
        evidence: sourceMeasureEvidence.effectiveTimeSignature,
        timing: analysis.timeSignature
      });
    }
  } catch (error) {
    if (error instanceof EventRetimingError) throw error;
    throw new EventRetimingError('Retiming candidate was rejected by independent measure timing/occupancy validation.', 'TIMING_REJECTED', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  return Object.freeze({ score: candidate, notation: nextNotation });
};
