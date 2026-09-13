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

export const TUPLET_UNRETIMING_ADMISSION_V4_VERSION = '1.0.0' as const;

export type TupletUnretimingAdmissionReasonV4 =
  | 'ADMITTED_TRIPLET_TO_STRAIGHT_THREE'
  | 'BLOCKED_RANGE_NOT_EXACT'
  | 'BLOCKED_CURRENT_TIMING_INVALID'
  | 'BLOCKED_TRIPLET_NOTATION_INVALID'
  | 'BLOCKED_WRITTEN_BASE_UNSUPPORTED'
  | 'BLOCKED_TIMING_COUPLED_NOTATION'
  | 'BLOCKED_CROSS_STAFF_TARGET'
  | 'BLOCKED_ADJACENT_REST_REQUIRED'
  | 'BLOCKED_ADJACENT_REST_INSUFFICIENT'
  | 'BLOCKED_MEASURE_SEMANTICS_UNPROVEN';

export interface TupletUnretimingEventPlanV4 {
  readonly eventId: string;
  readonly currentOnset: Rational;
  readonly currentDuration: Rational;
  readonly proposedOnset: Rational;
  readonly proposedDuration: Rational;
}

export interface TupletUnretimingGrowthIntervalV4 {
  readonly onset: Rational;
  readonly duration: Rational;
  readonly end: Rational;
}

export type TupletUnretimingRestActionV4 =
  | 'REMOVE_ADJACENT_REST'
  | 'SHRINK_ADJACENT_REST_FORWARD';

export interface TupletUnretimingRestPlanV4 {
  readonly action: TupletUnretimingRestActionV4;
  readonly restEventId: string;
  readonly currentOnset: Rational;
  readonly currentDuration: Rational;
  readonly proposedOnset: Rational | null;
  readonly proposedDuration: Rational | null;
}

export interface TupletUnretimingAdmissionV4 {
  readonly version: typeof TUPLET_UNRETIMING_ADMISSION_V4_VERSION;
  readonly documentId: string;
  readonly revisionId: string;
  readonly targetEventIds: readonly [string, string, string];
  readonly currentTripletDuration: Rational | null;
  readonly restoredWrittenBase: Rational | null;
  readonly currentGroupOnset: Rational | null;
  readonly currentGroupEnd: Rational | null;
  readonly proposedGroupEnd: Rational | null;
  readonly eventPlans: readonly TupletUnretimingEventPlanV4[];
  readonly requiredGrowthInterval: TupletUnretimingGrowthIntervalV4 | null;
  readonly nextEventId: string | null;
  readonly nextEventOnset: Rational | null;
  readonly couplingReasons: readonly string[];
  readonly restPlan: TupletUnretimingRestPlanV4 | null;
  readonly balancePolicy: 'CONSUME_EXACT_ADJACENT_NEUTRAL_REST' | null;
  readonly atomicMutationRequired: true;
  readonly historyMutationAuthority: false;
  readonly rendererCoordinateAuthority: false;
  readonly admitted: boolean;
  readonly reason: TupletUnretimingAdmissionReasonV4;
}

export type TupletUnretimingAdmissionV4ErrorCode =
  | 'INVALID_RANGE'
  | 'STALE_TARGET'
  | 'TARGET_KIND_MISMATCH'
  | 'TARGET_PATH_INVALID'
  | 'ARITHMETIC';

export class TupletUnretimingAdmissionV4Error extends Error {
  readonly code: TupletUnretimingAdmissionV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: TupletUnretimingAdmissionV4ErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'TupletUnretimingAdmissionV4Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const SIMPLE_WRITTEN_BASES: readonly Readonly<Rational>[] = Object.freeze([
  Object.freeze({ numerator: 1, denominator: 1 }),
  Object.freeze({ numerator: 1, denominator: 2 }),
  Object.freeze({ numerator: 1, denominator: 4 }),
  Object.freeze({ numerator: 1, denominator: 8 }),
  Object.freeze({ numerator: 1, denominator: 16 }),
  Object.freeze({ numerator: 1, denominator: 32 })
]);

const gcd = (left: bigint, right: bigint): bigint => {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
};

const rational = (numerator: bigint, denominator: bigint): Readonly<Rational> => {
  if (numerator < 0n || denominator <= 0n) {
    throw new TupletUnretimingAdmissionV4Error(
      'Tuplet unretiming arithmetic produced an invalid rational.',
      'ARITHMETIC'
    );
  }
  const divisor = gcd(numerator, denominator);
  const n = numerator / divisor;
  const d = denominator / divisor;
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (n > max || d > max) {
    throw new TupletUnretimingAdmissionV4Error(
      'Tuplet unretiming arithmetic exceeded safe integer bounds.',
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

const subtract = (left: Rational, right: Rational): Readonly<Rational> => {
  const numerator =
    BigInt(left.numerator) * BigInt(right.denominator) -
    BigInt(right.numerator) * BigInt(left.denominator);
  if (numerator < 0n) {
    throw new TupletUnretimingAdmissionV4Error(
      'Tuplet unretiming subtraction became negative.',
      'ARITHMETIC'
    );
  }
  return rational(numerator, BigInt(left.denominator) * BigInt(right.denominator));
};

const multiply = (value: Rational, numerator: number, denominator: number): Readonly<Rational> =>
  rational(BigInt(value.numerator) * BigInt(numerator), BigInt(value.denominator) * BigInt(denominator));

const compare = (left: Rational, right: Rational): number => {
  const l = BigInt(left.numerator) * BigInt(right.denominator);
  const r = BigInt(right.numerator) * BigInt(left.denominator);
  return l < r ? -1 : l > r ? 1 : 0;
};

const same = (left: Rational, right: Rational): boolean => compare(left, right) === 0;
const endOf = (event: ScoreEvent): Readonly<Rational> => add(event.onset, event.duration);
const frozenRational = (value: Rational): Readonly<Rational> => Object.freeze({ ...value });

const noteIdsFor = (event: ScoreEvent): readonly string[] =>
  event.kind === 'note'
    ? Object.freeze([event.note.id])
    : event.kind === 'chord'
      ? Object.freeze(event.notes.map(note => note.id))
      : Object.freeze([]);

const neutralRestNotation = (notation: NotationDocumentV4, eventId: string): boolean => {
  const value = notation.events.find(entry => entry.target.eventId === eventId)?.notation;
  return value === undefined || (
    value.dots === 0 &&
    value.beams.length === 0 &&
    value.tuplet === null &&
    value.articulations.length === 0 &&
    value.ornaments.length === 0
  );
};

const hasCrossStaff = (notation: NotationDocumentV4, eventId: string): boolean =>
  notation.crossStaffPlacements.some(item => item.source.eventId === eventId);

const couplingReasonsFor = (
  notation: NotationDocumentV4,
  event: ScoreEvent
): readonly string[] => {
  const reasons: string[] = [];
  const eventNotation = notation.events.find(entry => entry.target.eventId === event.id)?.notation;
  if ((eventNotation?.dots ?? 0) > 0) reasons.push(`dots:${event.id}`);
  if ((eventNotation?.beams.length ?? 0) > 0) reasons.push(`beams:${event.id}`);
  for (const noteId of noteIdsFor(event)) {
    const noteNotation = notation.notes.find(entry => entry.target.noteId === noteId)?.notation;
    if ((noteNotation?.ties.length ?? 0) > 0) reasons.push(`tie:${noteId}`);
  }
  return Object.freeze(reasons);
};

const result = (
  score: ScoreDocumentV3,
  targets: readonly EventAddressV3[],
  values: Partial<Omit<TupletUnretimingAdmissionV4,
    'version' | 'documentId' | 'revisionId' | 'targetEventIds' |
    'atomicMutationRequired' | 'historyMutationAuthority' | 'rendererCoordinateAuthority'>> &
    Pick<TupletUnretimingAdmissionV4, 'admitted' | 'reason'>
): Readonly<TupletUnretimingAdmissionV4> => {
  const [first, second, third] = targets;
  if (first === undefined || second === undefined || third === undefined) {
    throw new TupletUnretimingAdmissionV4Error(
      'Triplet unretiming target must contain exactly three events.',
      'INVALID_RANGE'
    );
  }
  return Object.freeze({
    version: TUPLET_UNRETIMING_ADMISSION_V4_VERSION,
    documentId: score.id,
    revisionId: score.revision.id,
    targetEventIds: Object.freeze([first.eventId, second.eventId, third.eventId]) as readonly [string, string, string],
    currentTripletDuration: values.currentTripletDuration ?? null,
    restoredWrittenBase: values.restoredWrittenBase ?? null,
    currentGroupOnset: values.currentGroupOnset ?? null,
    currentGroupEnd: values.currentGroupEnd ?? null,
    proposedGroupEnd: values.proposedGroupEnd ?? null,
    eventPlans: Object.freeze([...(values.eventPlans ?? [])]),
    requiredGrowthInterval: values.requiredGrowthInterval ?? null,
    nextEventId: values.nextEventId ?? null,
    nextEventOnset: values.nextEventOnset ?? null,
    couplingReasons: Object.freeze([...(values.couplingReasons ?? [])]),
    restPlan: values.restPlan ?? null,
    balancePolicy: values.balancePolicy ?? null,
    atomicMutationRequired: true,
    historyMutationAuthority: false,
    rendererCoordinateAuthority: false,
    admitted: values.admitted,
    reason: values.reason
  });
};

const validateTargets = (
  score: ScoreDocumentV3,
  targetsInput: readonly EventAddressV3[]
): readonly EventAddressV3[] => {
  if (!Array.isArray(targetsInput) || targetsInput.length !== 3) {
    throw new TupletUnretimingAdmissionV4Error(
      'Triplet unretiming requires exactly three explicit event addresses.',
      'INVALID_RANGE',
      { cardinality: Array.isArray(targetsInput) ? targetsInput.length : null }
    );
  }
  const targets = targetsInput.map((candidate, index) => {
    let resolved;
    try {
      resolved = resolveSemanticAddressV3(score, candidate);
    } catch (error) {
      throw new TupletUnretimingAdmissionV4Error(
        'Triplet unretiming target is stale or belongs to another revision.',
        'STALE_TARGET',
        { index, cause: error instanceof Error ? error.message : String(error) }
      );
    }
    if (resolved.kind !== 'event') {
      throw new TupletUnretimingAdmissionV4Error(
        'Triplet unretiming requires exact event targets.',
        'TARGET_KIND_MISMATCH',
        { index, observed: resolved.kind }
      );
    }
    return Object.freeze({ ...candidate });
  });
  if (new Set(targets.map(target => target.eventId)).size !== 3) {
    throw new TupletUnretimingAdmissionV4Error(
      'Triplet unretiming targets must be distinct.',
      'INVALID_RANGE'
    );
  }
  return Object.freeze(targets);
};

const exactTripletNotation = (
  notation: NotationDocumentV4,
  eventIds: readonly [string, string, string]
): boolean => {
  const [firstId, middleId, lastId] = eventIds;
  const first = notation.events.find(entry => entry.target.eventId === firstId)?.notation.tuplet ?? null;
  const middle = notation.events.find(entry => entry.target.eventId === middleId)?.notation.tuplet ?? null;
  const last = notation.events.find(entry => entry.target.eventId === lastId)?.notation.tuplet ?? null;
  if (first === null || middle === null || last === null) return false;
  if ([first, middle, last].some(value => value.actualNotes !== 3 || value.normalNotes !== 2)) return false;
  const firstMark = first.marks[0];
  const lastMark = last.marks[0];
  return first.marks.length === 1 &&
    firstMark?.type === 'start' &&
    middle.marks.length === 0 &&
    last.marks.length === 1 &&
    lastMark?.type === 'stop' &&
    firstMark.number === lastMark.number;
};

export const analyzeTripletToStraightThreeUnretimingV4 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  targetsInput: readonly EventAddressV3[]
): Readonly<TupletUnretimingAdmissionV4> => {
  const score = createScoreDocumentV3(scoreInput);
  const notation = createNotationDocumentV4(score, notationInput);
  const targets = validateTargets(score, targetsInput);
  const firstTarget = targets[0]!;

  const samePath = targets.every(target =>
    target.partId === firstTarget.partId &&
    target.staffId === firstTarget.staffId &&
    target.frameId === firstTarget.frameId &&
    target.measureId === firstTarget.measureId &&
    target.voiceId === firstTarget.voiceId
  );
  if (!samePath) {
    return result(score, targets, { admitted: false, reason: 'BLOCKED_RANGE_NOT_EXACT' });
  }

  const part = score.parts.find(item => item.id === firstTarget.partId);
  const staff = part?.staves.find(item => item.id === firstTarget.staffId);
  const measure = staff?.measures.find(item => item.id === firstTarget.measureId && item.frameId === firstTarget.frameId);
  const voice = measure?.voices.find(item => item.id === firstTarget.voiceId);
  if (part === undefined || staff === undefined || measure === undefined || voice === undefined || staff.role === 'tablature-linked') {
    throw new TupletUnretimingAdmissionV4Error(
      'Triplet unretiming target path is invalid.',
      'TARGET_PATH_INVALID'
    );
  }

  if (score.source.format === 'musicxml') {
    return result(score, targets, {
      admitted: false,
      reason: 'BLOCKED_MEASURE_SEMANTICS_UNPROVEN'
    });
  }

  const indices = targets.map(target => voice.events.findIndex(event => event.id === target.eventId));
  const [firstIndex, secondIndex, thirdIndex] = indices;
  if (
    firstIndex === undefined || secondIndex === undefined || thirdIndex === undefined ||
    firstIndex < 0 || secondIndex !== firstIndex + 1 || thirdIndex !== secondIndex + 1
  ) {
    return result(score, targets, { admitted: false, reason: 'BLOCKED_RANGE_NOT_EXACT' });
  }

  const events = targets.map(target => voice.events.find(event => event.id === target.eventId)!);
  const [firstEvent, secondEvent, thirdEvent] = events;
  if (firstEvent === undefined || secondEvent === undefined || thirdEvent === undefined) {
    throw new TupletUnretimingAdmissionV4Error(
      'Triplet unretiming target event disappeared.',
      'STALE_TARGET'
    );
  }

  const nextEvent = voice.events[thirdIndex + 1] ?? null;
  const previousEvent = firstIndex > 0 ? voice.events[firstIndex - 1] ?? null : null;
  const currentGroupEnd = endOf(thirdEvent);
  const common = {
    currentGroupOnset: frozenRational(firstEvent.onset),
    currentGroupEnd: frozenRational(currentGroupEnd),
    nextEventId: nextEvent?.id ?? null,
    nextEventOnset: nextEvent === null ? null : frozenRational(nextEvent.onset)
  } as const;

  if (!events.every(event => same(event.duration, firstEvent.duration))) {
    return result(score, targets, {
      ...common,
      admitted: false,
      reason: 'BLOCKED_CURRENT_TIMING_INVALID'
    });
  }

  const firstEnd = endOf(firstEvent);
  const secondEnd = endOf(secondEvent);
  const precedingOverlap = previousEvent !== null && compare(endOf(previousEvent), firstEvent.onset) > 0;
  const selectedContiguous = same(firstEnd, secondEvent.onset) && same(secondEnd, thirdEvent.onset);
  const followingOverlap = nextEvent !== null && compare(nextEvent.onset, currentGroupEnd) < 0;
  if (precedingOverlap || !selectedContiguous || followingOverlap) {
    return result(score, targets, {
      ...common,
      admitted: false,
      reason: 'BLOCKED_CURRENT_TIMING_INVALID'
    });
  }

  const targetIds = Object.freeze([firstEvent.id, secondEvent.id, thirdEvent.id]) as readonly [string, string, string];
  if (!exactTripletNotation(notation, targetIds)) {
    return result(score, targets, {
      ...common,
      currentTripletDuration: frozenRational(firstEvent.duration),
      admitted: false,
      reason: 'BLOCKED_TRIPLET_NOTATION_INVALID'
    });
  }

  const couplingReasons = Object.freeze(events.flatMap(event => couplingReasonsFor(notation, event)));
  if (couplingReasons.length > 0) {
    return result(score, targets, {
      ...common,
      currentTripletDuration: frozenRational(firstEvent.duration),
      couplingReasons,
      admitted: false,
      reason: 'BLOCKED_TIMING_COUPLED_NOTATION'
    });
  }

  if (targets.some(target => hasCrossStaff(notation, target.eventId))) {
    return result(score, targets, {
      ...common,
      currentTripletDuration: frozenRational(firstEvent.duration),
      admitted: false,
      reason: 'BLOCKED_CROSS_STAFF_TARGET'
    });
  }

  const restoredWrittenBase = multiply(firstEvent.duration, 3, 2);
  if (!SIMPLE_WRITTEN_BASES.some(value => same(value, restoredWrittenBase))) {
    return result(score, targets, {
      ...common,
      currentTripletDuration: frozenRational(firstEvent.duration),
      restoredWrittenBase: frozenRational(restoredWrittenBase),
      admitted: false,
      reason: 'BLOCKED_WRITTEN_BASE_UNSUPPORTED'
    });
  }

  const proposedFirstOnset = frozenRational(firstEvent.onset);
  const proposedSecondOnset = add(proposedFirstOnset, restoredWrittenBase);
  const proposedThirdOnset = add(proposedSecondOnset, restoredWrittenBase);
  const proposedGroupEnd = add(proposedThirdOnset, restoredWrittenBase);
  if (compare(proposedGroupEnd, currentGroupEnd) <= 0) {
    return result(score, targets, {
      ...common,
      currentTripletDuration: frozenRational(firstEvent.duration),
      restoredWrittenBase: frozenRational(restoredWrittenBase),
      proposedGroupEnd: frozenRational(proposedGroupEnd),
      admitted: false,
      reason: 'BLOCKED_CURRENT_TIMING_INVALID'
    });
  }

  const growthDuration = subtract(proposedGroupEnd, currentGroupEnd);
  const requiredGrowthInterval = Object.freeze({
    onset: frozenRational(currentGroupEnd),
    duration: frozenRational(growthDuration),
    end: frozenRational(proposedGroupEnd)
  });
  const eventPlans: readonly TupletUnretimingEventPlanV4[] = Object.freeze([
    Object.freeze({
      eventId: firstEvent.id,
      currentOnset: frozenRational(firstEvent.onset),
      currentDuration: frozenRational(firstEvent.duration),
      proposedOnset: proposedFirstOnset,
      proposedDuration: frozenRational(restoredWrittenBase)
    }),
    Object.freeze({
      eventId: secondEvent.id,
      currentOnset: frozenRational(secondEvent.onset),
      currentDuration: frozenRational(secondEvent.duration),
      proposedOnset: frozenRational(proposedSecondOnset),
      proposedDuration: frozenRational(restoredWrittenBase)
    }),
    Object.freeze({
      eventId: thirdEvent.id,
      currentOnset: frozenRational(thirdEvent.onset),
      currentDuration: frozenRational(thirdEvent.duration),
      proposedOnset: frozenRational(proposedThirdOnset),
      proposedDuration: frozenRational(restoredWrittenBase)
    })
  ]);

  const commonPlan = {
    ...common,
    currentTripletDuration: frozenRational(firstEvent.duration),
    restoredWrittenBase: frozenRational(restoredWrittenBase),
    proposedGroupEnd: frozenRational(proposedGroupEnd),
    requiredGrowthInterval,
    eventPlans,
    couplingReasons
  } as const;

  if (
    nextEvent === null ||
    nextEvent.kind !== 'rest' ||
    !same(nextEvent.onset, currentGroupEnd) ||
    !neutralRestNotation(notation, nextEvent.id) ||
    hasCrossStaff(notation, nextEvent.id)
  ) {
    return result(score, targets, {
      ...commonPlan,
      admitted: false,
      reason: 'BLOCKED_ADJACENT_REST_REQUIRED'
    });
  }

  const nextEnd = endOf(nextEvent);
  if (compare(nextEnd, proposedGroupEnd) < 0) {
    return result(score, targets, {
      ...commonPlan,
      admitted: false,
      reason: 'BLOCKED_ADJACENT_REST_INSUFFICIENT'
    });
  }

  const laterGrowthOverlap = voice.events.slice(thirdIndex + 2).some(event =>
    compare(event.onset, proposedGroupEnd) < 0 &&
    compare(endOf(event), currentGroupEnd) > 0
  );
  if (laterGrowthOverlap) {
    return result(score, targets, {
      ...commonPlan,
      admitted: false,
      reason: 'BLOCKED_CURRENT_TIMING_INVALID'
    });
  }

  const removeRest = same(nextEnd, proposedGroupEnd);
  const restPlan: Readonly<TupletUnretimingRestPlanV4> = removeRest
    ? Object.freeze({
        action: 'REMOVE_ADJACENT_REST',
        restEventId: nextEvent.id,
        currentOnset: frozenRational(nextEvent.onset),
        currentDuration: frozenRational(nextEvent.duration),
        proposedOnset: null,
        proposedDuration: null
      })
    : Object.freeze({
        action: 'SHRINK_ADJACENT_REST_FORWARD',
        restEventId: nextEvent.id,
        currentOnset: frozenRational(nextEvent.onset),
        currentDuration: frozenRational(nextEvent.duration),
        proposedOnset: frozenRational(proposedGroupEnd),
        proposedDuration: subtract(nextEnd, proposedGroupEnd)
      });

  return result(score, targets, {
    ...commonPlan,
    restPlan,
    balancePolicy: 'CONSUME_EXACT_ADJACENT_NEUTRAL_REST',
    admitted: true,
    reason: 'ADMITTED_TRIPLET_TO_STRAIGHT_THREE'
  });
};