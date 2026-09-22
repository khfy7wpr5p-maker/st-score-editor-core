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

export const GENERALIZED_TUPLET_ADMISSION_V4_VERSION = '1.0.0' as const;

export const FOUR_TO_THREE_TUPLET_PROFILE_V4 = Object.freeze({
  version: '1.0.0',
  actualNotes: 4,
  normalNotes: 3,
  targetCardinality: 4
} as const);

export type GeneralizedTupletAdmissionReasonV4 =
  | 'ADMITTED_4_TO_3_TO_STRAIGHT_FOUR'
  | 'BLOCKED_WRONG_CARDINALITY'
  | 'BLOCKED_STALE_TARGET'
  | 'BLOCKED_TARGET_KIND'
  | 'BLOCKED_DUPLICATE_TARGET'
  | 'BLOCKED_REORDERED_OR_NONCONSECUTIVE_TARGET'
  | 'BLOCKED_CROSS_SCOPE_TARGET'
  | 'BLOCKED_CURRENT_TIMING_INVALID'
  | 'BLOCKED_TUPLET_PROFILE_UNSUPPORTED'
  | 'BLOCKED_TUPLET_BOUNDARY_INVALID'
  | 'BLOCKED_NESTED_OR_OVERLAPPING_TUPLET'
  | 'BLOCKED_WRITTEN_BASE_UNSUPPORTED'
  | 'BLOCKED_TIMING_COUPLED_DOTS'
  | 'BLOCKED_TIMING_COUPLED_BEAMS'
  | 'BLOCKED_TIMING_COUPLED_TIES'
  | 'BLOCKED_CROSS_STAFF_TARGET'
  | 'BLOCKED_ADJACENT_REST_REQUIRED'
  | 'BLOCKED_ADJACENT_REST_INSUFFICIENT'
  | 'BLOCKED_ARITHMETIC';

export interface GeneralizedTupletProfileV4 {
  readonly version: '1.0.0';
  readonly actualNotes: 4;
  readonly normalNotes: 3;
  readonly targetCardinality: 4;
}

export interface GeneralizedTupletEventPlanV4 {
  readonly eventId: string;
  readonly currentOnset: Rational;
  readonly currentDuration: Rational;
  readonly proposedOnset: Rational;
  readonly proposedDuration: Rational;
}

export interface GeneralizedTupletGrowthIntervalV4 {
  readonly onset: Rational;
  readonly duration: Rational;
  readonly end: Rational;
}

export type GeneralizedTupletRestActionV4 =
  | 'REMOVE_ADJACENT_REST'
  | 'SHRINK_ADJACENT_REST_FORWARD';

export interface GeneralizedTupletRestPlanV4 {
  readonly action: GeneralizedTupletRestActionV4;
  readonly restEventId: string;
  readonly currentOnset: Rational;
  readonly currentDuration: Rational;
  readonly proposedOnset: Rational | null;
  readonly proposedDuration: Rational | null;
}

export interface GeneralizedTupletAdmissionV4 {
  readonly version: typeof GENERALIZED_TUPLET_ADMISSION_V4_VERSION;
  readonly documentId: string;
  readonly revisionId: string;
  readonly profile: Readonly<GeneralizedTupletProfileV4>;
  readonly targetEventIds: readonly string[];
  readonly currentTupletDuration: Rational | null;
  readonly restoredWrittenBase: Rational | null;
  readonly currentGroupOnset: Rational | null;
  readonly currentGroupEnd: Rational | null;
  readonly proposedGroupEnd: Rational | null;
  readonly eventPlans: readonly GeneralizedTupletEventPlanV4[];
  readonly requiredGrowthInterval: GeneralizedTupletGrowthIntervalV4 | null;
  readonly nextEventId: string | null;
  readonly nextEventOnset: Rational | null;
  readonly couplingReasons: readonly string[];
  readonly restPlan: GeneralizedTupletRestPlanV4 | null;
  readonly balancePolicy: 'CONSUME_EXACT_ADJACENT_NEUTRAL_REST' | null;
  readonly atomicMutationRequired: true;
  readonly canonicalMutationAuthority: false;
  readonly historyMutationAuthority: false;
  readonly rendererCoordinateAuthority: false;
  readonly admitted: boolean;
  readonly reason: GeneralizedTupletAdmissionReasonV4;
}

const gcd = (left: bigint, right: bigint): bigint => {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
};

const rational = (numerator: bigint, denominator: bigint): Readonly<Rational> => {
  if (numerator < 0n || denominator <= 0n) throw new Error('INVALID_RATIONAL');
  const divisor = gcd(numerator, denominator);
  const n = numerator / divisor;
  const d = denominator / divisor;
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (n > max || d > max) throw new Error('RATIONAL_OVERFLOW');
  return Object.freeze({ numerator: Number(n), denominator: Number(d) });
};

const add = (left: Rational, right: Rational): Readonly<Rational> => rational(
  BigInt(left.numerator) * BigInt(right.denominator) +
    BigInt(right.numerator) * BigInt(left.denominator),
  BigInt(left.denominator) * BigInt(right.denominator)
);

const subtract = (left: Rational, right: Rational): Readonly<Rational> => rational(
  BigInt(left.numerator) * BigInt(right.denominator) -
    BigInt(right.numerator) * BigInt(left.denominator),
  BigInt(left.denominator) * BigInt(right.denominator)
);

const multiply = (value: Rational, numerator: number, denominator: number): Readonly<Rational> =>
  rational(
    BigInt(value.numerator) * BigInt(numerator),
    BigInt(value.denominator) * BigInt(denominator)
  );

const compare = (left: Rational, right: Rational): number => {
  const l = BigInt(left.numerator) * BigInt(right.denominator);
  const r = BigInt(right.numerator) * BigInt(left.denominator);
  return l < r ? -1 : l > r ? 1 : 0;
};

const same = (left: Rational, right: Rational): boolean => compare(left, right) === 0;
const endOf = (event: ScoreEvent): Readonly<Rational> => add(event.onset, event.duration);
const frozenRational = (value: Rational): Readonly<Rational> => Object.freeze({ ...value });

const exactFourToThreeNotation = (
  notation: NotationDocumentV4,
  eventIds: readonly string[]
): boolean => {
  if (eventIds.length !== 4) return false;
  const tuplets = eventIds.map(eventId =>
    notation.events.find(entry => entry.target.eventId === eventId)?.notation.tuplet ?? null
  );
  if (tuplets.some(value => value === null)) return false;
  if (tuplets.some(value => value?.actualNotes !== 4 || value.normalNotes !== 3)) return false;
  const first = tuplets[0]!;
  const second = tuplets[1]!;
  const third = tuplets[2]!;
  const fourth = tuplets[3]!;
  const firstMark = first.marks[0];
  const fourthMark = fourth.marks[0];
  return first.marks.length === 1 &&
    firstMark?.type === 'start' &&
    second.marks.length === 0 &&
    third.marks.length === 0 &&
    fourth.marks.length === 1 &&
    fourthMark?.type === 'stop' &&
    firstMark.number === fourthMark.number;
};

const result = (
  score: ScoreDocumentV3,
  profile: GeneralizedTupletProfileV4,
  targetEventIds: readonly string[],
  values: Partial<Omit<GeneralizedTupletAdmissionV4,
    'version' | 'documentId' | 'revisionId' | 'profile' | 'targetEventIds' |
    'atomicMutationRequired' | 'canonicalMutationAuthority' |
    'historyMutationAuthority' | 'rendererCoordinateAuthority'>> &
    Pick<GeneralizedTupletAdmissionV4, 'admitted' | 'reason'>
): Readonly<GeneralizedTupletAdmissionV4> => Object.freeze({
  version: GENERALIZED_TUPLET_ADMISSION_V4_VERSION,
  documentId: score.id,
  revisionId: score.revision.id,
  profile: Object.freeze({ ...profile }),
  targetEventIds: Object.freeze([...targetEventIds]),
  currentTupletDuration: values.currentTupletDuration ?? null,
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
  canonicalMutationAuthority: false,
  historyMutationAuthority: false,
  rendererCoordinateAuthority: false,
  admitted: values.admitted,
  reason: values.reason
});

export const analyzeGeneralizedTupletToStraightV4 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  targetsInput: readonly EventAddressV3[],
  profileInput: GeneralizedTupletProfileV4
): Readonly<GeneralizedTupletAdmissionV4> => {
  const score = createScoreDocumentV3(scoreInput);
  const notation = createNotationDocumentV4(score, notationInput);
  const profile = Object.freeze({ ...profileInput });

  const targetEventIds = targetsInput.flatMap(target => {
    const candidate = target as EventAddressV3 & { readonly eventId?: unknown };
    return typeof candidate.eventId === 'string' ? [candidate.eventId] : [];
  });

  if (targetsInput.length !== 4) {
    return result(score, profile, targetEventIds, {
      admitted: false,
      reason: 'BLOCKED_WRONG_CARDINALITY'
    });
  }

  const targets: EventAddressV3[] = [];
  for (const target of targetsInput) {
    let resolved;
    try {
      resolved = resolveSemanticAddressV3(score, target);
    } catch {
      return result(score, profile, targetEventIds, {
        admitted: false,
        reason: 'BLOCKED_STALE_TARGET'
      });
    }
    if (resolved.kind !== 'event') {
      return result(score, profile, targetEventIds, {
        admitted: false,
        reason: 'BLOCKED_TARGET_KIND'
      });
    }
    targets.push(Object.freeze({ ...target }));
  }

  if (new Set(targets.map(target => target.eventId)).size !== 4) {
    return result(score, profile, targets.map(target => target.eventId), {
      admitted: false,
      reason: 'BLOCKED_DUPLICATE_TARGET'
    });
  }

  const firstTarget = targets[0]!;
  const samePath = targets.every(target =>
    target.partId === firstTarget.partId &&
    target.staffId === firstTarget.staffId &&
    target.frameId === firstTarget.frameId &&
    target.measureId === firstTarget.measureId &&
    target.voiceId === firstTarget.voiceId
  );
  if (!samePath) {
    return result(score, profile, targets.map(target => target.eventId), {
      admitted: false,
      reason: 'BLOCKED_CROSS_SCOPE_TARGET'
    });
  }

  const part = score.parts.find(item => item.id === firstTarget.partId);
  const staff = part?.staves.find(item => item.id === firstTarget.staffId);
  const measure = staff?.measures.find(item =>
    item.id === firstTarget.measureId && item.frameId === firstTarget.frameId
  );
  const voice = measure?.voices.find(item => item.id === firstTarget.voiceId);
  if (part === undefined || staff === undefined || measure === undefined || voice === undefined) {
    return result(score, profile, targets.map(target => target.eventId), {
      admitted: false,
      reason: 'BLOCKED_STALE_TARGET'
    });
  }

  const indices = targets.map(target => voice.events.findIndex(event => event.id === target.eventId));
  const [firstIndex, secondIndex, thirdIndex, fourthIndex] = indices;
  if (
    firstIndex === undefined || secondIndex === undefined ||
    thirdIndex === undefined || fourthIndex === undefined ||
    firstIndex < 0 ||
    secondIndex !== firstIndex + 1 ||
    thirdIndex !== secondIndex + 1 ||
    fourthIndex !== thirdIndex + 1
  ) {
    return result(score, profile, targets.map(target => target.eventId), {
      admitted: false,
      reason: 'BLOCKED_REORDERED_OR_NONCONSECUTIVE_TARGET'
    });
  }

  const events = indices.map(index => voice.events[index]!);
  const firstEvent = events[0]!;
  const fourthEvent = events[3]!;

  if (!events.every(event => same(event.duration, firstEvent.duration))) {
    return result(score, profile, targets.map(target => target.eventId), {
      admitted: false,
      reason: 'BLOCKED_CURRENT_TIMING_INVALID'
    });
  }
  if (!exactFourToThreeNotation(notation, targets.map(target => target.eventId))) {
    return result(score, profile, targets.map(target => target.eventId), {
      admitted: false,
      reason: 'BLOCKED_TUPLET_BOUNDARY_INVALID'
    });
  }

  const restoredWrittenBase = multiply(firstEvent.duration, 4, 3);
  const proposedOnsets = [
    frozenRational(firstEvent.onset),
    add(firstEvent.onset, restoredWrittenBase),
    add(add(firstEvent.onset, restoredWrittenBase), restoredWrittenBase),
    add(add(add(firstEvent.onset, restoredWrittenBase), restoredWrittenBase), restoredWrittenBase)
  ] as const;
  const proposedGroupEnd = add(proposedOnsets[3], restoredWrittenBase);
  const currentGroupEnd = endOf(fourthEvent);
  const growthDuration = subtract(proposedGroupEnd, currentGroupEnd);
  const eventPlans = Object.freeze(events.map((event, index) => Object.freeze({
    eventId: event.id,
    currentOnset: frozenRational(event.onset),
    currentDuration: frozenRational(event.duration),
    proposedOnset: frozenRational(proposedOnsets[index]!),
    proposedDuration: frozenRational(restoredWrittenBase)
  })));
  const requiredGrowthInterval = Object.freeze({
    onset: frozenRational(currentGroupEnd),
    duration: frozenRational(growthDuration),
    end: frozenRational(proposedGroupEnd)
  });

  const nextEvent = voice.events[fourthIndex + 1] ?? null;

  return result(score, profile, targets.map(target => target.eventId), {
    currentTupletDuration: frozenRational(firstEvent.duration),
    restoredWrittenBase: frozenRational(restoredWrittenBase),
    currentGroupOnset: frozenRational(firstEvent.onset),
    currentGroupEnd: frozenRational(currentGroupEnd),
    proposedGroupEnd: frozenRational(proposedGroupEnd),
    eventPlans,
    requiredGrowthInterval,
    nextEventId: nextEvent?.id ?? null,
    nextEventOnset: nextEvent === null ? null : frozenRational(nextEvent.onset),
    admitted: true,
    reason: 'ADMITTED_4_TO_3_TO_STRAIGHT_FOUR'
  });
};
