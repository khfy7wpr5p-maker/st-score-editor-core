import {
  validateScoreDocument,
  type Rational,
  type ScoreDocument,
  type ScoreEvent
} from '../../score-model/src/index.js';
import {
  createNotationDocument,
  notationForMeasure,
  type NotationDocument,
  type TimeSignature
} from '../../notation-structure/src/index.js';
import {
  resolveInsertionPosition,
  type InsertionPosition
} from '../../editor-insertion-position/src/index.js';

export const MEASURE_TIMING_ANALYSIS_VERSION = '1.0.0' as const;

export interface TimingInterval {
  readonly eventId: string;
  readonly kind: 'pitched' | 'rest';
  readonly start: Rational;
  readonly end: Rational;
}

export interface ImplicitGap {
  readonly start: Rational;
  readonly end: Rational;
}

export interface MeasureTimingAnalysis {
  readonly contractVersion: typeof MEASURE_TIMING_ANALYSIS_VERSION;
  readonly documentId: string;
  readonly revisionId: string;
  readonly partId: string;
  readonly staffId: string;
  readonly measureId: string;
  readonly voiceId: string;
  readonly timeSignature: TimeSignature;
  readonly measureDuration: Rational;
  readonly intervals: readonly TimingInterval[];
  readonly implicitGaps: readonly ImplicitGap[];
  readonly pickupSemanticsKnown: false;
  readonly implicitGapAuthoringAllowed: false;
}

export type InsertionWindowClassification =
  | {
      readonly kind: 'EXPLICIT_REST_SLOT';
      readonly safeToAuthor: true;
      readonly restEventId: string;
      readonly start: Rational;
      readonly end: Rational;
    }
  | {
      readonly kind: 'BLOCKED_PITCHED';
      readonly safeToAuthor: false;
      readonly blockingEventIds: readonly string[];
      readonly start: Rational;
      readonly end: Rational;
    }
  | {
      readonly kind: 'OUTSIDE_MEASURE';
      readonly safeToAuthor: false;
      readonly start: Rational;
      readonly end: Rational;
    }
  | {
      readonly kind: 'IMPLICIT_GAP_UNADMITTED';
      readonly safeToAuthor: false;
      readonly start: Rational;
      readonly end: Rational;
    }
  | {
      readonly kind: 'MIXED_UNADMITTED';
      readonly safeToAuthor: false;
      readonly overlappingEventIds: readonly string[];
      readonly start: Rational;
      readonly end: Rational;
    };

export type MeasureTimingErrorCode =
  | 'INVALID_SCORE'
  | 'INVALID_NOTATION'
  | 'MISSING_TIME_SIGNATURE'
  | 'EVENT_OUTSIDE_MEASURE'
  | 'OVERLAPPING_EVENTS'
  | 'INVALID_DURATION'
  | 'TIMING_ARITHMETIC';

export class MeasureTimingError extends Error {
  readonly code: MeasureTimingErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, code: MeasureTimingErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'MeasureTimingError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const absBig = (value: bigint): bigint => value < 0n ? -value : value;
const gcdBig = (left: bigint, right: bigint): bigint => {
  let a = absBig(left);
  let b = absBig(right);
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
};

const rational = (numerator: bigint, denominator: bigint): Rational => {
  if (numerator < 0n || denominator <= 0n) {
    throw new MeasureTimingError('Timing arithmetic produced an invalid rational.', 'TIMING_ARITHMETIC');
  }
  const divisor = gcdBig(numerator, denominator);
  const reducedNumerator = numerator / divisor;
  const reducedDenominator = denominator / divisor;
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (reducedNumerator > max || reducedDenominator > max) {
    throw new MeasureTimingError('Timing arithmetic exceeded safe integer bounds.', 'TIMING_ARITHMETIC');
  }
  return Object.freeze({ numerator: Number(reducedNumerator), denominator: Number(reducedDenominator) });
};

const compare = (left: Rational, right: Rational): number => {
  const l = BigInt(left.numerator) * BigInt(right.denominator);
  const r = BigInt(right.numerator) * BigInt(left.denominator);
  return l < r ? -1 : l > r ? 1 : 0;
};

const add = (left: Rational, right: Rational): Rational => rational(
  BigInt(left.numerator) * BigInt(right.denominator) + BigInt(right.numerator) * BigInt(left.denominator),
  BigInt(left.denominator) * BigInt(right.denominator)
);

const canonicalPositiveDuration = (value: unknown): value is Rational => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (JSON.stringify(Object.keys(record).sort()) !== JSON.stringify(['denominator', 'numerator'])) return false;
  if (typeof record.numerator !== 'number' || !Number.isSafeInteger(record.numerator) || record.numerator <= 0) return false;
  if (typeof record.denominator !== 'number' || !Number.isSafeInteger(record.denominator) || record.denominator <= 0) return false;
  return gcdBig(BigInt(record.numerator), BigInt(record.denominator)) === 1n;
};

const measureDurationFor = (time: TimeSignature): Rational =>
  rational(BigInt(time.beats), BigInt(time.beatType));

const freezeInterval = (event: ScoreEvent, end: Rational): TimingInterval => Object.freeze({
  eventId: event.id,
  kind: event.kind === 'rest' ? 'rest' : 'pitched',
  start: Object.freeze({ ...event.onset }),
  end
});

const effectiveTimeSignature = (
  notation: NotationDocument,
  measures: readonly { readonly id: string; readonly ordinal: number }[],
  targetOrdinal: number
): TimeSignature => {
  let active: TimeSignature | null = null;
  for (const measure of [...measures].sort((a, b) => a.ordinal - b.ordinal)) {
    if (measure.ordinal > targetOrdinal) break;
    const direct = notationForMeasure(notation, measure.id)?.timeSignature ?? null;
    if (direct !== null) active = direct;
  }
  if (active === null) {
    throw new MeasureTimingError(
      'A time signature must be established before measure timing can authorize editor insertion.',
      'MISSING_TIME_SIGNATURE',
      { targetOrdinal }
    );
  }
  return active;
};

export const analyzeMeasureTiming = (
  score: ScoreDocument,
  notationInput: NotationDocument,
  rawPosition: unknown
): Readonly<MeasureTimingAnalysis> => {
  const scoreValidation = validateScoreDocument(score);
  if (!scoreValidation.ok) {
    throw new MeasureTimingError('Measure timing requires a valid canonical score.', 'INVALID_SCORE', {
      issueCount: scoreValidation.issues.length
    });
  }

  let notation: Readonly<NotationDocument>;
  try {
    notation = createNotationDocument(score, notationInput);
  } catch (error) {
    throw new MeasureTimingError('Measure timing requires notation bound to the same valid score revision.', 'INVALID_NOTATION', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  const resolvedPosition = resolveInsertionPosition(score, rawPosition);
  const position = resolvedPosition.position;
  const part = score.parts.find((item) => item.id === position.partId)!;
  const staff = part.staves.find((item) => item.id === position.staffId)!;
  const measure = staff.measures.find((item) => item.id === position.measureId)!;
  const voice = measure.voices.find((item) => item.id === position.voiceId)!;

  const timeSignature = effectiveTimeSignature(notation, staff.measures, measure.ordinal);
  const measureDuration = measureDurationFor(timeSignature);
  const intervals: TimingInterval[] = [];
  const implicitGaps: ImplicitGap[] = [];
  let cursor: Rational = Object.freeze({ numerator: 0, denominator: 1 });

  for (const [eventIndex, event] of voice.events.entries()) {
    if (compare(event.onset, cursor) < 0) {
      throw new MeasureTimingError('Canonical voice events overlap and cannot authorize insertion.', 'OVERLAPPING_EVENTS', {
        eventIndex,
        eventId: event.id,
        voiceId: voice.id
      });
    }
    if (compare(event.onset, cursor) > 0) {
      implicitGaps.push(Object.freeze({ start: cursor, end: Object.freeze({ ...event.onset }) }));
    }
    const end = add(event.onset, event.duration);
    if (compare(end, measureDuration) > 0) {
      throw new MeasureTimingError('A canonical event extends beyond the active measure duration.', 'EVENT_OUTSIDE_MEASURE', {
        eventIndex,
        eventId: event.id,
        voiceId: voice.id,
        timeSignature
      });
    }
    intervals.push(freezeInterval(event, end));
    cursor = end;
  }

  if (compare(cursor, measureDuration) < 0) {
    implicitGaps.push(Object.freeze({ start: cursor, end: measureDuration }));
  }

  return Object.freeze({
    contractVersion: MEASURE_TIMING_ANALYSIS_VERSION,
    documentId: score.id,
    revisionId: score.revision.id,
    partId: position.partId,
    staffId: position.staffId,
    measureId: position.measureId,
    voiceId: position.voiceId,
    timeSignature: Object.freeze({ ...timeSignature }),
    measureDuration,
    intervals: Object.freeze(intervals),
    implicitGaps: Object.freeze(implicitGaps),
    pickupSemanticsKnown: false,
    implicitGapAuthoringAllowed: false
  });
};

const overlaps = (start: Rational, end: Rational, interval: TimingInterval): boolean =>
  compare(start, interval.end) < 0 && compare(end, interval.start) > 0;

export const classifyInsertionWindow = (
  score: ScoreDocument,
  notation: NotationDocument,
  rawPosition: unknown,
  rawDuration: unknown
): Readonly<InsertionWindowClassification> => {
  if (!canonicalPositiveDuration(rawDuration)) {
    throw new MeasureTimingError('Insertion duration must be a canonical positive rational.', 'INVALID_DURATION');
  }
  const duration = rawDuration;
  const analysis = analyzeMeasureTiming(score, notation, rawPosition);
  const position = rawPosition as InsertionPosition;
  const start = Object.freeze({ ...position.onset });
  const end = add(start, duration);

  if (compare(start, analysis.measureDuration) >= 0 || compare(end, analysis.measureDuration) > 0) {
    return Object.freeze({ kind: 'OUTSIDE_MEASURE', safeToAuthor: false, start, end });
  }

  const intersecting = analysis.intervals.filter((interval) => overlaps(start, end, interval));
  const pitched = intersecting.filter((interval) => interval.kind === 'pitched');
  if (pitched.length > 0) {
    return Object.freeze({
      kind: 'BLOCKED_PITCHED',
      safeToAuthor: false,
      blockingEventIds: Object.freeze(pitched.map((interval) => interval.eventId)),
      start,
      end
    });
  }

  if (intersecting.length === 1 && intersecting[0]!.kind === 'rest' &&
      compare(start, intersecting[0]!.start) >= 0 && compare(end, intersecting[0]!.end) <= 0) {
    return Object.freeze({
      kind: 'EXPLICIT_REST_SLOT',
      safeToAuthor: true,
      restEventId: intersecting[0]!.eventId,
      start,
      end
    });
  }

  if (intersecting.length === 0) {
    return Object.freeze({ kind: 'IMPLICIT_GAP_UNADMITTED', safeToAuthor: false, start, end });
  }

  return Object.freeze({
    kind: 'MIXED_UNADMITTED',
    safeToAuthor: false,
    overlappingEventIds: Object.freeze(intersecting.map((interval) => interval.eventId)),
    start,
    end
  });
};
