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

export const TUPLET_RETIMING_ADMISSION_V4_VERSION = '1.0.0' as const;

export type TupletRetimingAdmissionReasonV4 =
  | 'ADMITTED_STRAIGHT_THREE_TO_TRIPLET'
  | 'BLOCKED_RANGE_NOT_EXACT'
  | 'BLOCKED_CURRENT_TIMING_INVALID'
  | 'BLOCKED_UNEQUAL_DURATIONS'
  | 'BLOCKED_WRITTEN_BASE_UNSUPPORTED'
  | 'BLOCKED_TIMING_COUPLED_NOTATION'
  | 'BLOCKED_CROSS_STAFF_TARGET';

export interface TupletRetimingEventPlanV4 {
  readonly eventId: string;
  readonly currentOnset: Rational;
  readonly currentDuration: Rational;
  readonly proposedOnset: Rational;
  readonly proposedDuration: Rational;
}

export interface TupletRetimingReleasedIntervalV4 {
  readonly onset: Rational;
  readonly duration: Rational;
  readonly end: Rational;
}

export interface TupletRetimingAdmissionV4 {
  readonly version: typeof TUPLET_RETIMING_ADMISSION_V4_VERSION;
  readonly documentId: string;
  readonly revisionId: string;
  readonly targetEventIds: readonly [string, string, string];
  readonly writtenBase: Rational | null;
  readonly canonicalTripletDuration: Rational | null;
  readonly currentGroupOnset: Rational | null;
  readonly currentGroupEnd: Rational | null;
  readonly proposedGroupEnd: Rational | null;
  readonly eventPlans: readonly TupletRetimingEventPlanV4[];
  readonly releasedInterval: TupletRetimingReleasedIntervalV4 | null;
  readonly nextEventId: string | null;
  readonly nextEventOnset: Rational | null;
  readonly couplingReasons: readonly string[];
  readonly balancePolicy: 'CREATE_OR_EXTEND_EXPLICIT_RESIDUAL_REST' | null;
  readonly atomicMutationRequired: true;
  readonly historyMutationAuthority: false;
  readonly rendererCoordinateAuthority: false;
  readonly admitted: boolean;
  readonly reason: TupletRetimingAdmissionReasonV4;
}

export type TupletRetimingAdmissionV4ErrorCode =
  | 'INVALID_RANGE'
  | 'STALE_TARGET'
  | 'TARGET_KIND_MISMATCH'
  | 'TARGET_PATH_INVALID'
  | 'ARITHMETIC';

export class TupletRetimingAdmissionV4Error extends Error {
  readonly code: TupletRetimingAdmissionV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: TupletRetimingAdmissionV4ErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'TupletRetimingAdmissionV4Error';
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
    throw new TupletRetimingAdmissionV4Error(
      'Tuplet retiming arithmetic produced an invalid rational.',
      'ARITHMETIC'
    );
  }
  const divisor = gcd(numerator, denominator);
  const n = numerator / divisor;
  const d = denominator / divisor;
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (n > max || d > max) {
    throw new TupletRetimingAdmissionV4Error(
      'Tuplet retiming arithmetic exceeded safe integer bounds.',
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
    throw new TupletRetimingAdmissionV4Error(
      'Tuplet retiming subtraction became negative.',
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

const noteIdsFor = (event: ScoreEvent): readonly string[] =>
  event.kind === 'note'
    ? Object.freeze([event.note.id])
    : event.kind === 'chord'
      ? Object.freeze(event.notes.map(note => note.id))
      : Object.freeze([]);

const couplingReasonsFor = (
  notation: NotationDocumentV4,
  event: ScoreEvent
): readonly string[] => {
  const reasons: string[] = [];
  const eventNotation = notation.events.find(entry => entry.target.eventId === event.id)?.notation;
  if ((eventNotation?.dots ?? 0) > 0) reasons.push(`dots:${event.id}`);
  if ((eventNotation?.beams.length ?? 0) > 0) reasons.push(`beams:${event.id}`);
  if ((eventNotation?.tuplet ?? null) !== null) reasons.push(`tuplet:${event.id}`);
  for (const noteId of noteIdsFor(event)) {
    const noteNotation = notation.notes.find(entry => entry.target.noteId === noteId)?.notation;
    if ((noteNotation?.ties.length ?? 0) > 0) reasons.push(`tie:${noteId}`);
  }
  return Object.freeze(reasons);
};

const frozenRational = (value: Rational): Readonly<Rational> => Object.freeze({ ...value });

const result = (
  score: ScoreDocumentV3,
  targets: readonly EventAddressV3[],
  values: Partial<Omit<TupletRetimingAdmissionV4,
    'version' | 'documentId' | 'revisionId' | 'targetEventIds' |
    'atomicMutationRequired' | 'historyMutationAuthority' | 'rendererCoordinateAuthority'>> &
    Pick<TupletRetimingAdmissionV4, 'admitted' | 'reason'>
): Readonly<TupletRetimingAdmissionV4> => {
  const [first, second, third] = targets;
  if (first === undefined || second === undefined || third === undefined) {
    throw new TupletRetimingAdmissionV4Error('Triplet retiming target must contain exactly three events.', 'INVALID_RANGE');
  }
  return Object.freeze({
    version: TUPLET_RETIMING_ADMISSION_V4_VERSION,
    documentId: score.id,
    revisionId: score.revision.id,
    targetEventIds: Object.freeze([first.eventId, second.eventId, third.eventId]) as readonly [string, string, string],
    writtenBase: values.writtenBase ?? null,
    canonicalTripletDuration: values.canonicalTripletDuration ?? null,
    currentGroupOnset: values.currentGroupOnset ?? null,
    currentGroupEnd: values.currentGroupEnd ?? null,
    proposedGroupEnd: values.proposedGroupEnd ?? null,
    eventPlans: Object.freeze([...(values.eventPlans ?? [])]),
    releasedInterval: values.releasedInterval ?? null,
    nextEventId: values.nextEventId ?? null,
    nextEventOnset: values.nextEventOnset ?? null,
    couplingReasons: Object.freeze([...(values.couplingReasons ?? [])]),
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
    throw new TupletRetimingAdmissionV4Error(
      'Triplet retiming requires exactly three explicit event addresses.',
      'INVALID_RANGE',
      { cardinality: Array.isArray(targetsInput) ? targetsInput.length : null }
    );
  }
  const targets = targetsInput.map((candidate, index) => {
    let resolved;
    try {
      resolved = resolveSemanticAddressV3(score, candidate);
    } catch (error) {
      throw new TupletRetimingAdmissionV4Error(
        'Triplet retiming target is stale or belongs to another revision.',
        'STALE_TARGET',
        { index, cause: error instanceof Error ? error.message : String(error) }
      );
    }
    if (resolved.kind !== 'event') {
      throw new TupletRetimingAdmissionV4Error(
        'Triplet retiming requires exact event targets.',
        'TARGET_KIND_MISMATCH',
        { index, observed: resolved.kind }
      );
    }
    return Object.freeze({ ...candidate });
  });
  if (new Set(targets.map(target => target.eventId)).size !== 3) {
    throw new TupletRetimingAdmissionV4Error('Triplet retiming targets must be distinct.', 'INVALID_RANGE');
  }
  return Object.freeze(targets);
};

export const analyzeStraightThreeToTripletRetimingV4 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  targetsInput: readonly EventAddressV3[]
): Readonly<TupletRetimingAdmissionV4> => {
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
    throw new TupletRetimingAdmissionV4Error(
      'Triplet retiming target path is invalid.',
      'TARGET_PATH_INVALID'
    );
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
    throw new TupletRetimingAdmissionV4Error('Triplet retiming target event disappeared.', 'STALE_TARGET');
  }

  const nextEvent = voice.events[thirdIndex + 1] ?? null;
  const previousEvent = firstIndex > 0 ? voice.events[firstIndex - 1] ?? null : null;
  const common = {
    currentGroupOnset: frozenRational(firstEvent.onset),
    currentGroupEnd: frozenRational(endOf(thirdEvent)),
    nextEventId: nextEvent?.id ?? null,
    nextEventOnset: nextEvent === null ? null : frozenRational(nextEvent.onset)
  } as const;

  if (!events.every(event => same(event.duration, firstEvent.duration))) {
    return result(score, targets, {
      ...common,
      admitted: false,
      reason: 'BLOCKED_UNEQUAL_DURATIONS'
    });
  }

  const writtenBase = frozenRational(firstEvent.duration);
  if (!SIMPLE_WRITTEN_BASES.some(value => same(value, writtenBase))) {
    return result(score, targets, {
      ...common,
      writtenBase,
      admitted: false,
      reason: 'BLOCKED_WRITTEN_BASE_UNSUPPORTED'
    });
  }

  const firstEnd = endOf(firstEvent);
  const secondEnd = endOf(secondEvent);
  const thirdEnd = endOf(thirdEvent);
  const precedingOverlap = previousEvent !== null && compare(endOf(previousEvent), firstEvent.onset) > 0;
  const selectedContiguous = same(firstEnd, secondEvent.onset) && same(secondEnd, thirdEvent.onset);
  const followingOverlap = nextEvent !== null && compare(nextEvent.onset, thirdEnd) < 0;
  if (precedingOverlap || !selectedContiguous || followingOverlap) {
    return result(score, targets, {
      ...common,
      writtenBase,
      admitted: false,
      reason: 'BLOCKED_CURRENT_TIMING_INVALID'
    });
  }

  const couplingReasons = Object.freeze(events.flatMap(event => couplingReasonsFor(notation, event)));
  if (couplingReasons.length > 0) {
    return result(score, targets, {
      ...common,
      writtenBase,
      couplingReasons,
      admitted: false,
      reason: 'BLOCKED_TIMING_COUPLED_NOTATION'
    });
  }

  const crossStaffEvent = targets.find(target =>
    notation.crossStaffPlacements.some(placement => placement.source.eventId === target.eventId)
  );
  if (crossStaffEvent !== undefined) {
    return result(score, targets, {
      ...common,
      writtenBase,
      admitted: false,
      reason: 'BLOCKED_CROSS_STAFF_TARGET'
    });
  }

  const canonicalTripletDuration = multiply(writtenBase, 2, 3);
  const proposedFirstOnset = frozenRational(firstEvent.onset);
  const proposedSecondOnset = add(proposedFirstOnset, canonicalTripletDuration);
  const proposedThirdOnset = add(proposedSecondOnset, canonicalTripletDuration);
  const proposedGroupEnd = add(proposedThirdOnset, canonicalTripletDuration);
  const currentGroupEnd = thirdEnd;
  if (compare(proposedGroupEnd, currentGroupEnd) >= 0) {
    throw new TupletRetimingAdmissionV4Error(
      'Straight-three triplet plan must contract the selected canonical span.',
      'ARITHMETIC',
      { proposedGroupEnd, currentGroupEnd }
    );
  }

  const releasedDuration = subtract(currentGroupEnd, proposedGroupEnd);
  const releasedInterval = Object.freeze({
    onset: frozenRational(proposedGroupEnd),
    duration: frozenRational(releasedDuration),
    end: frozenRational(currentGroupEnd)
  });
  const eventPlans: readonly TupletRetimingEventPlanV4[] = Object.freeze([
    Object.freeze({
      eventId: firstEvent.id,
      currentOnset: frozenRational(firstEvent.onset),
      currentDuration: frozenRational(firstEvent.duration),
      proposedOnset: proposedFirstOnset,
      proposedDuration: frozenRational(canonicalTripletDuration)
    }),
    Object.freeze({
      eventId: secondEvent.id,
      currentOnset: frozenRational(secondEvent.onset),
      currentDuration: frozenRational(secondEvent.duration),
      proposedOnset: frozenRational(proposedSecondOnset),
      proposedDuration: frozenRational(canonicalTripletDuration)
    }),
    Object.freeze({
      eventId: thirdEvent.id,
      currentOnset: frozenRational(thirdEvent.onset),
      currentDuration: frozenRational(thirdEvent.duration),
      proposedOnset: frozenRational(proposedThirdOnset),
      proposedDuration: frozenRational(canonicalTripletDuration)
    })
  ]);

  return result(score, targets, {
    ...common,
    writtenBase,
    canonicalTripletDuration: frozenRational(canonicalTripletDuration),
    proposedGroupEnd: frozenRational(proposedGroupEnd),
    eventPlans,
    releasedInterval,
    couplingReasons,
    balancePolicy: 'CREATE_OR_EXTEND_EXPLICIT_RESIDUAL_REST',
    admitted: true,
    reason: 'ADMITTED_STRAIGHT_THREE_TO_TRIPLET'
  });
};
