import { createScoreDocumentV3, type ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import type { Rational, ScoreEvent } from '../../score-model/src/index.js';
import {
  resolveSemanticAddressV3,
  type EventAddressV3
} from '../../addressing-v3/src/index.js';
import {
  createNotationDocumentV4,
  type NotationDocumentV4
} from '../../notation-structure-v4/src/index.js';
import type { TimeSignature } from '../../notation-structure/src/index.js';

export const RHYTHM_TIMING_ADMISSION_V4_VERSION = '1.0.0' as const;

export type RhythmTimingDirectionV4 = 'SHRINK' | 'GROW' | 'SAME';

export type RhythmTimingAdmissionReasonV4 =
  | 'NO_OP'
  | 'ADMITTED_CONTRACTION'
  | 'ADMITTED_WITH_NEXT_EVENT_BOUNDARY'
  | 'ADMITTED_SYNTHETIC_TRAILING_EXPANSION'
  | 'BLOCKED_EXISTING_TIMING_INVALID'
  | 'BLOCKED_TIMING_COUPLED_NOTATION'
  | 'BLOCKED_NEXT_EVENT_OVERLAP'
  | 'BLOCKED_SYNTHETIC_MEASURE_END'
  | 'BLOCKED_TRAILING_EXPANSION_SOURCE_UNPROVEN'
  | 'BLOCKED_TRAILING_EXPANSION_METER_UNKNOWN';

export interface RhythmTimingAdmissionV4Options {
  readonly allowDotRewrite?: boolean;
}

export interface RhythmTimingAdmissionV4 {
  readonly version: typeof RHYTHM_TIMING_ADMISSION_V4_VERSION;
  readonly documentId: string;
  readonly revisionId: string;
  readonly target: EventAddressV3;
  readonly currentDuration: Rational;
  readonly requestedDuration: Rational;
  readonly currentEnd: Rational;
  readonly requestedEnd: Rational;
  readonly direction: RhythmTimingDirectionV4;
  readonly nextEventId: string | null;
  readonly nextEventOnset: Rational | null;
  readonly effectiveTimeSignature: TimeSignature | null;
  readonly nominalMeasureDuration: Rational | null;
  readonly couplingReasons: readonly string[];
  readonly wouldCreateGap: boolean | null;
  readonly admitted: boolean;
  readonly reason: RhythmTimingAdmissionReasonV4;
}

export type RhythmTimingAdmissionV4ErrorCode =
  | 'INVALID_DURATION'
  | 'STALE_TARGET'
  | 'TARGET_KIND_MISMATCH'
  | 'TARGET_PATH_INVALID'
  | 'ARITHMETIC';

export class RhythmTimingAdmissionV4Error extends Error {
  readonly code: RhythmTimingAdmissionV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: RhythmTimingAdmissionV4ErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'RhythmTimingAdmissionV4Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const gcd = (left: bigint, right: bigint): bigint => {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
};

const rational = (numerator: bigint, denominator: bigint): Readonly<Rational> => {
  if (numerator < 0n || denominator <= 0n) {
    throw new RhythmTimingAdmissionV4Error(
      'Rhythm timing arithmetic produced an invalid rational.',
      'ARITHMETIC'
    );
  }
  const divisor = gcd(numerator, denominator);
  const n = numerator / divisor;
  const d = denominator / divisor;
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (n > max || d > max) {
    throw new RhythmTimingAdmissionV4Error(
      'Rhythm timing arithmetic exceeded safe integer bounds.',
      'ARITHMETIC'
    );
  }
  return Object.freeze({ numerator: Number(n), denominator: Number(d) });
};

const add = (left: Rational, right: Rational): Readonly<Rational> => rational(
  BigInt(left.numerator) * BigInt(right.denominator) +
    BigInt(right.numerator) * BigInt(left.denominator),
  BigInt(left.denominator) * BigInt(right.denominator)
);

const compare = (left: Rational, right: Rational): number => {
  const l = BigInt(left.numerator) * BigInt(right.denominator);
  const r = BigInt(right.numerator) * BigInt(left.denominator);
  return l < r ? -1 : l > r ? 1 : 0;
};

const canonicalDuration = (value: unknown): Readonly<Rational> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new RhythmTimingAdmissionV4Error(
      'Requested duration must be a canonical positive rational.',
      'INVALID_DURATION'
    );
  }
  const record = value as Record<string, unknown>;
  if (
    JSON.stringify(Object.keys(record).sort()) !== JSON.stringify(['denominator', 'numerator']) ||
    typeof record.numerator !== 'number' ||
    !Number.isSafeInteger(record.numerator) ||
    record.numerator <= 0 ||
    typeof record.denominator !== 'number' ||
    !Number.isSafeInteger(record.denominator) ||
    record.denominator <= 0 ||
    gcd(BigInt(record.numerator), BigInt(record.denominator)) !== 1n
  ) {
    throw new RhythmTimingAdmissionV4Error(
      'Requested duration must be a reduced positive rational.',
      'INVALID_DURATION'
    );
  }
  return Object.freeze({
    numerator: record.numerator,
    denominator: record.denominator
  });
};

const eventEnd = (event: ScoreEvent): Readonly<Rational> => add(event.onset, event.duration);

const directionFor = (current: Rational, requested: Rational): RhythmTimingDirectionV4 => {
  const order = compare(requested, current);
  return order < 0 ? 'SHRINK' : order > 0 ? 'GROW' : 'SAME';
};

const eventNoteIds = (event: ScoreEvent): readonly string[] =>
  event.kind === 'note'
    ? Object.freeze([event.note.id])
    : event.kind === 'chord'
      ? Object.freeze(event.notes.map(note => note.id))
      : Object.freeze([]);

const couplingReasonsFor = (
  notation: NotationDocumentV4,
  event: ScoreEvent,
  allowDotRewrite: boolean
): readonly string[] => {
  const reasons: string[] = [];
  const eventNotation = notation.events.find(entry => entry.target.eventId === event.id)?.notation;
  if (!allowDotRewrite && (eventNotation?.dots ?? 0) > 0) reasons.push('dots');
  if ((eventNotation?.beams.length ?? 0) > 0) reasons.push('beams');
  if ((eventNotation?.tuplet ?? null) !== null) reasons.push('tuplet');

  for (const noteId of eventNoteIds(event)) {
    const noteNotation = notation.notes.find(entry => entry.target.noteId === noteId)?.notation;
    if ((noteNotation?.ties.length ?? 0) > 0) reasons.push(`tie:${noteId}`);
  }
  return Object.freeze(reasons);
};

const effectiveTimeSignatureFor = (
  score: ScoreDocumentV3,
  notation: NotationDocumentV4,
  frameId: string
): Readonly<TimeSignature> | null => {
  const targetIndex = score.measureFrames.findIndex(frame => frame.id === frameId);
  if (targetIndex < 0) {
    throw new RhythmTimingAdmissionV4Error(
      'Duration target frame is missing from the canonical frame sequence.',
      'TARGET_PATH_INVALID',
      { frameId }
    );
  }
  const byFrame = new Map(notation.frames.map(entry => [entry.target.frameId, entry.notation] as const));
  let active: Readonly<TimeSignature> | null = null;
  for (let index = 0; index <= targetIndex; index += 1) {
    const frame = score.measureFrames[index];
    if (frame === undefined) break;
    const direct = byFrame.get(frame.id)?.timeSignature ?? null;
    if (direct !== null) active = Object.freeze({ ...direct });
  }
  return active;
};

const measureDurationFor = (time: TimeSignature | null): Readonly<Rational> | null =>
  time === null ? null : rational(BigInt(time.beats), BigInt(time.beatType));

const admission = (
  score: ScoreDocumentV3,
  target: EventAddressV3,
  current: ScoreEvent,
  requestedDuration: Rational,
  currentEnd: Rational,
  requestedEnd: Rational,
  direction: RhythmTimingDirectionV4,
  nextEvent: ScoreEvent | null,
  timeSignature: TimeSignature | null,
  measureDuration: Rational | null,
  couplingReasons: readonly string[],
  existingTimingInvalid: boolean
): Readonly<RhythmTimingAdmissionV4> => {
  const common = {
    version: RHYTHM_TIMING_ADMISSION_V4_VERSION,
    documentId: score.id,
    revisionId: score.revision.id,
    target: Object.freeze({ ...target }),
    currentDuration: Object.freeze({ ...current.duration }),
    requestedDuration: Object.freeze({ ...requestedDuration }),
    currentEnd: Object.freeze({ ...currentEnd }),
    requestedEnd: Object.freeze({ ...requestedEnd }),
    direction,
    nextEventId: nextEvent?.id ?? null,
    nextEventOnset: nextEvent === null ? null : Object.freeze({ ...nextEvent.onset }),
    effectiveTimeSignature: timeSignature === null ? null : Object.freeze({ ...timeSignature }),
    nominalMeasureDuration: measureDuration === null ? null : Object.freeze({ ...measureDuration }),
    couplingReasons: Object.freeze([...couplingReasons])
  } as const;

  if (existingTimingInvalid) {
    return Object.freeze({
      ...common,
      wouldCreateGap: null,
      admitted: false,
      reason: 'BLOCKED_EXISTING_TIMING_INVALID'
    });
  }

  if (direction === 'SAME') {
    return Object.freeze({ ...common, wouldCreateGap: false, admitted: false, reason: 'NO_OP' });
  }

  if (couplingReasons.length > 0) {
    return Object.freeze({
      ...common,
      wouldCreateGap: null,
      admitted: false,
      reason: 'BLOCKED_TIMING_COUPLED_NOTATION'
    });
  }

  if (nextEvent !== null) {
    if (compare(requestedEnd, nextEvent.onset) > 0) {
      return Object.freeze({
        ...common,
        wouldCreateGap: false,
        admitted: false,
        reason: 'BLOCKED_NEXT_EVENT_OVERLAP'
      });
    }
    return Object.freeze({
      ...common,
      wouldCreateGap: compare(requestedEnd, nextEvent.onset) < 0,
      admitted: true,
      reason: direction === 'SHRINK'
        ? 'ADMITTED_CONTRACTION'
        : 'ADMITTED_WITH_NEXT_EVENT_BOUNDARY'
    });
  }

  if (direction === 'SHRINK') {
    return Object.freeze({
      ...common,
      wouldCreateGap: true,
      admitted: true,
      reason: 'ADMITTED_CONTRACTION'
    });
  }

  if (score.source.format !== 'synthetic') {
    return Object.freeze({
      ...common,
      wouldCreateGap: null,
      admitted: false,
      reason: 'BLOCKED_TRAILING_EXPANSION_SOURCE_UNPROVEN'
    });
  }

  if (measureDuration === null) {
    return Object.freeze({
      ...common,
      wouldCreateGap: null,
      admitted: false,
      reason: 'BLOCKED_TRAILING_EXPANSION_METER_UNKNOWN'
    });
  }

  if (compare(requestedEnd, measureDuration) > 0) {
    return Object.freeze({
      ...common,
      wouldCreateGap: false,
      admitted: false,
      reason: 'BLOCKED_SYNTHETIC_MEASURE_END'
    });
  }

  return Object.freeze({
    ...common,
    wouldCreateGap: compare(requestedEnd, measureDuration) < 0,
    admitted: true,
    reason: 'ADMITTED_SYNTHETIC_TRAILING_EXPANSION'
  });
};

export const analyzeEventDurationMutationV4 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  targetInput: EventAddressV3,
  requestedDurationInput: unknown,
  options: RhythmTimingAdmissionV4Options = {}
): Readonly<RhythmTimingAdmissionV4> => {
  const score = createScoreDocumentV3(scoreInput);
  const notation = createNotationDocumentV4(score, notationInput);
  const requestedDuration = canonicalDuration(requestedDurationInput);

  let resolved;
  try {
    resolved = resolveSemanticAddressV3(score, targetInput);
  } catch (error) {
    throw new RhythmTimingAdmissionV4Error(
      'Duration target is stale or belongs to another canonical revision.',
      'STALE_TARGET',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  if (resolved.kind !== 'event') {
    throw new RhythmTimingAdmissionV4Error(
      'Rhythm timing admission requires an exact event target.',
      'TARGET_KIND_MISMATCH',
      { observed: resolved.kind }
    );
  }

  const target = targetInput;
  const part = score.parts.find(item => item.id === target.partId);
  const staff = part?.staves.find(item => item.id === target.staffId);
  if (staff === undefined || staff.role === 'tablature-linked') {
    throw new RhythmTimingAdmissionV4Error('Duration target staff is invalid.', 'TARGET_PATH_INVALID');
  }
  const measure = staff.measures.find(item => item.id === target.measureId && item.frameId === target.frameId);
  const voice = measure?.voices.find(item => item.id === target.voiceId);
  if (measure === undefined || voice === undefined) {
    throw new RhythmTimingAdmissionV4Error('Duration target voice path is invalid.', 'TARGET_PATH_INVALID');
  }

  const originalOrder = new Map(voice.events.map((event, index) => [event.id, index] as const));
  const ordered = [...voice.events].sort((left, right) =>
    compare(left.onset, right.onset) ||
    (originalOrder.get(left.id) ?? 0) - (originalOrder.get(right.id) ?? 0)
  );
  const targetIndex = ordered.findIndex(event => event.id === target.eventId);
  if (targetIndex < 0) {
    throw new RhythmTimingAdmissionV4Error('Duration target event disappeared.', 'TARGET_PATH_INVALID');
  }

  const current = ordered[targetIndex]!;
  const nextEvent = ordered[targetIndex + 1] ?? null;
  const timeSignature = effectiveTimeSignatureFor(score, notation, target.frameId);
  const measureDuration = measureDurationFor(timeSignature);

  let existingTimingInvalid = false;
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const left = ordered[index]!;
    const right = ordered[index + 1]!;
    if (compare(eventEnd(left), right.onset) > 0) {
      existingTimingInvalid = true;
      break;
    }
  }
  if (!existingTimingInvalid && score.source.format === 'synthetic' && measureDuration !== null) {
    existingTimingInvalid = ordered.some(event => compare(eventEnd(event), measureDuration) > 0);
  }

  const currentEnd = eventEnd(current);
  const requestedEnd = add(current.onset, requestedDuration);
  const direction = directionFor(current.duration, requestedDuration);
  const couplingReasons = couplingReasonsFor(
    notation,
    current,
    options.allowDotRewrite === true
  );

  return admission(
    score,
    target,
    current,
    requestedDuration,
    currentEnd,
    requestedEnd,
    direction,
    nextEvent,
    timeSignature,
    measureDuration,
    couplingReasons,
    existingTimingInvalid
  );
};
