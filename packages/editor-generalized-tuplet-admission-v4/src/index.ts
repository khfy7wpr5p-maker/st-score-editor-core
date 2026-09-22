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

const SIMPLE_WRITTEN_BASES: readonly Readonly<Rational>[] = Object.freeze([
  Object.freeze({ numerator: 1, denominator: 1 }),
  Object.freeze({ numerator: 1, denominator: 2 }),
  Object.freeze({ numerator: 1, denominator: 4 }),
  Object.freeze({ numerator: 1, denominator: 8 }),
  Object.freeze({ numerator: 1, denominator: 16 }),
  Object.freeze({ numerator: 1, denominator: 32 })
]);

const noteIdsFor = (event: ScoreEvent): readonly string[] =>
  event.kind === 'note'
    ? Object.freeze([event.note.id])
    : event.kind === 'chord'
      ? Object.freeze(event.notes.map(note => note.id))
      : Object.freeze([]);

const hasCrossStaff = (notation: NotationDocumentV4, eventId: string): boolean =>
  notation.crossStaffPlacements.some(item => item.source.eventId === eventId);

const tupletBoundaryReason = (
  notation: NotationDocumentV4,
  eventIds: readonly string[]
): GeneralizedTupletAdmissionReasonV4 | null => {
  if (eventIds.length !== 4) return 'BLOCKED_WRONG_CARDINALITY';
  const tuplets = eventIds.map(eventId =>
    notation.events.find(entry => entry.target.eventId === eventId)?.notation.tuplet ?? null
  );
  if (tuplets.some(value => value === null)) return 'BLOCKED_TUPLET_BOUNDARY_INVALID';
  if (tuplets.some(value => value?.actualNotes !== 4 || value.normalNotes !== 3)) {
    return 'BLOCKED_TUPLET_PROFILE_UNSUPPORTED';
  }
  const first = tuplets[0]!;
  const second = tuplets[1]!;
  const third = tuplets[2]!;
  const fourth = tuplets[3]!;
  if (
    first.marks.length > 1 ||
    second.marks.length > 0 ||
    third.marks.length > 0 ||
    fourth.marks.length > 1
  ) {
    return 'BLOCKED_NESTED_OR_OVERLAPPING_TUPLET';
  }
  const firstMark = first.marks[0];
  const fourthMark = fourth.marks[0];
  if (
    first.marks.length !== 1 ||
    firstMark?.type !== 'start' ||
    fourth.marks.length !== 1 ||
    fourthMark?.type !== 'stop' ||
    firstMark.number !== fourthMark.number
  ) {
    return 'BLOCKED_TUPLET_BOUNDARY_INVALID';
  }
  return null;
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

  if (
    profile.version !== FOUR_TO_THREE_TUPLET_PROFILE_V4.version ||
    profile.actualNotes !== FOUR_TO_THREE_TUPLET_PROFILE_V4.actualNotes ||
    profile.normalNotes !== FOUR_TO_THREE_TUPLET_PROFILE_V4.normalNotes ||
    profile.targetCardinality !== FOUR_TO_THREE_TUPLET_PROFILE_V4.targetCardinality
  ) {
    return result(score, FOUR_TO_THREE_TUPLET_PROFILE_V4, [], {
      admitted: false,
      reason: 'BLOCKED_TUPLET_PROFILE_UNSUPPORTED'
    });
  }

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
  const previousEvent = firstIndex > 0 ? voice.events[firstIndex - 1] ?? null : null;
  const nextEvent = voice.events[fourthIndex + 1] ?? null;

  if (!events.every(event => same(event.duration, firstEvent.duration))) {
    return result(score, profile, targets.map(target => target.eventId), {
      admitted: false,
      reason: 'BLOCKED_CURRENT_TIMING_INVALID'
    });
  }

  let currentGroupEnd: Readonly<Rational>;
  try {
    const firstEnd = endOf(events[0]!);
    const secondEnd = endOf(events[1]!);
    const thirdEnd = endOf(events[2]!);
    currentGroupEnd = endOf(fourthEvent);
    const selectedContiguous =
      same(firstEnd, events[1]!.onset) &&
      same(secondEnd, events[2]!.onset) &&
      same(thirdEnd, events[3]!.onset);
    const precedingOverlap = previousEvent !== null && compare(endOf(previousEvent), firstEvent.onset) > 0;
    const followingOverlap = nextEvent !== null && compare(nextEvent.onset, currentGroupEnd) < 0;
    if (!selectedContiguous || precedingOverlap || followingOverlap) {
      return result(score, profile, targets.map(target => target.eventId), {
        currentGroupOnset: frozenRational(firstEvent.onset),
        currentGroupEnd: frozenRational(currentGroupEnd),
        nextEventId: nextEvent?.id ?? null,
        nextEventOnset: nextEvent === null ? null : frozenRational(nextEvent.onset),
        admitted: false,
        reason: 'BLOCKED_CURRENT_TIMING_INVALID'
      });
    }
  } catch {
    return result(score, profile, targets.map(target => target.eventId), {
      admitted: false,
      reason: 'BLOCKED_ARITHMETIC'
    });
  }

  const boundaryReason = tupletBoundaryReason(notation, targets.map(target => target.eventId));
  if (boundaryReason !== null) {
    return result(score, profile, targets.map(target => target.eventId), {
      currentTupletDuration: frozenRational(firstEvent.duration),
      currentGroupOnset: frozenRational(firstEvent.onset),
      currentGroupEnd: frozenRational(currentGroupEnd),
      nextEventId: nextEvent?.id ?? null,
      nextEventOnset: nextEvent === null ? null : frozenRational(nextEvent.onset),
      admitted: false,
      reason: boundaryReason
    });
  }

  const dotReasons = events.flatMap(event => {
    const eventNotation = notation.events.find(entry => entry.target.eventId === event.id)?.notation;
    return (eventNotation?.dots ?? 0) > 0 ? [`dots:${event.id}`] : [];
  });
  if (dotReasons.length > 0) {
    return result(score, profile, targets.map(target => target.eventId), {
      currentTupletDuration: frozenRational(firstEvent.duration),
      currentGroupOnset: frozenRational(firstEvent.onset),
      currentGroupEnd: frozenRational(currentGroupEnd),
      nextEventId: nextEvent?.id ?? null,
      nextEventOnset: nextEvent === null ? null : frozenRational(nextEvent.onset),
      couplingReasons: Object.freeze(dotReasons),
      admitted: false,
      reason: 'BLOCKED_TIMING_COUPLED_DOTS'
    });
  }

  const beamReasons = events.flatMap(event => {
    const eventNotation = notation.events.find(entry => entry.target.eventId === event.id)?.notation;
    return (eventNotation?.beams.length ?? 0) > 0 ? [`beams:${event.id}`] : [];
  });
  if (beamReasons.length > 0) {
    return result(score, profile, targets.map(target => target.eventId), {
      currentTupletDuration: frozenRational(firstEvent.duration),
      currentGroupOnset: frozenRational(firstEvent.onset),
      currentGroupEnd: frozenRational(currentGroupEnd),
      nextEventId: nextEvent?.id ?? null,
      nextEventOnset: nextEvent === null ? null : frozenRational(nextEvent.onset),
      couplingReasons: Object.freeze(beamReasons),
      admitted: false,
      reason: 'BLOCKED_TIMING_COUPLED_BEAMS'
    });
  }

  const tieReasons = events.flatMap(event =>
    noteIdsFor(event).flatMap(noteId => {
      const noteNotation = notation.notes.find(entry => entry.target.noteId === noteId)?.notation;
      return (noteNotation?.ties.length ?? 0) > 0 ? [`tie:${noteId}`] : [];
    })
  );
  if (tieReasons.length > 0) {
    return result(score, profile, targets.map(target => target.eventId), {
      currentTupletDuration: frozenRational(firstEvent.duration),
      currentGroupOnset: frozenRational(firstEvent.onset),
      currentGroupEnd: frozenRational(currentGroupEnd),
      nextEventId: nextEvent?.id ?? null,
      nextEventOnset: nextEvent === null ? null : frozenRational(nextEvent.onset),
      couplingReasons: Object.freeze(tieReasons),
      admitted: false,
      reason: 'BLOCKED_TIMING_COUPLED_TIES'
    });
  }

  if (targets.some(target => hasCrossStaff(notation, target.eventId))) {
    return result(score, profile, targets.map(target => target.eventId), {
      currentTupletDuration: frozenRational(firstEvent.duration),
      currentGroupOnset: frozenRational(firstEvent.onset),
      currentGroupEnd: frozenRational(currentGroupEnd),
      nextEventId: nextEvent?.id ?? null,
      nextEventOnset: nextEvent === null ? null : frozenRational(nextEvent.onset),
      admitted: false,
      reason: 'BLOCKED_CROSS_STAFF_TARGET'
    });
  }

  let restoredWrittenBase: Readonly<Rational>;
  let proposedOnsets: readonly Readonly<Rational>[];
  let proposedGroupEnd: Readonly<Rational>;
  let growthDuration: Readonly<Rational>;
  try {
    restoredWrittenBase = multiply(firstEvent.duration, 4, 3);
    if (!SIMPLE_WRITTEN_BASES.some(value => same(value, restoredWrittenBase))) {
      return result(score, profile, targets.map(target => target.eventId), {
        currentTupletDuration: frozenRational(firstEvent.duration),
        restoredWrittenBase: frozenRational(restoredWrittenBase),
        currentGroupOnset: frozenRational(firstEvent.onset),
        currentGroupEnd: frozenRational(currentGroupEnd),
        nextEventId: nextEvent?.id ?? null,
        nextEventOnset: nextEvent === null ? null : frozenRational(nextEvent.onset),
        admitted: false,
        reason: 'BLOCKED_WRITTEN_BASE_UNSUPPORTED'
      });
    }
    proposedOnsets = Object.freeze([
      frozenRational(firstEvent.onset),
      add(firstEvent.onset, restoredWrittenBase),
      add(add(firstEvent.onset, restoredWrittenBase), restoredWrittenBase),
      add(add(add(firstEvent.onset, restoredWrittenBase), restoredWrittenBase), restoredWrittenBase)
    ]);
    proposedGroupEnd = add(proposedOnsets[3]!, restoredWrittenBase);
    growthDuration = subtract(proposedGroupEnd, currentGroupEnd);
  } catch {
    return result(score, profile, targets.map(target => target.eventId), {
      currentTupletDuration: frozenRational(firstEvent.duration),
      currentGroupOnset: frozenRational(firstEvent.onset),
      currentGroupEnd: frozenRational(currentGroupEnd),
      nextEventId: nextEvent?.id ?? null,
      nextEventOnset: nextEvent === null ? null : frozenRational(nextEvent.onset),
      admitted: false,
      reason: 'BLOCKED_ARITHMETIC'
    });
  }

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
