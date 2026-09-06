import { createScoreDocumentV3, type ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import type { Rational, ScoreEvent } from '../../score-model/src/index.js';
import {
  addressEntityV3,
  type EventAddressV3,
  type SemanticAddressV3
} from '../../addressing-v3/src/index.js';
import {
  createNotationDocumentV4,
  type NotationDocumentV4
} from '../../notation-structure-v4/src/index.js';
import type { EventNotationV2 } from '../../notation-structure-v2/src/index.js';
import {
  analyzeStraightThreeToTripletRetimingV4,
  type TupletRetimingAdmissionV4
} from '../../editor-tuplet-retiming-admission-v4/src/index.js';
import { analyzeEventDurationMutationV4 } from '../../editor-rhythm-timing-v4/src/index.js';

export const TUPLET_RETIMING_AUTHORING_V4_VERSION = '1.0.0' as const;

export interface RetimingStraightThreeToTripletIntentV4 {
  readonly version: typeof TUPLET_RETIMING_AUTHORING_V4_VERSION;
  readonly type: 'RETIMING_STRAIGHT_THREE_TO_TRIPLET';
  readonly targets: readonly EventAddressV3[];
}

export interface TupletRetimingAuthoringV4Options {
  readonly nextRevisionId: string;
}

export type TupletRetimingRestBalanceKindV4 =
  | 'CREATED_RESIDUAL_REST'
  | 'EXTENDED_ADJACENT_REST';

export interface TupletRetimingRestBalanceV4 {
  readonly kind: TupletRetimingRestBalanceKindV4;
  readonly restEventId: string;
}

export interface TupletRetimingAuthoringV4Result {
  readonly version: typeof TUPLET_RETIMING_AUTHORING_V4_VERSION;
  readonly score: Readonly<ScoreDocumentV3>;
  readonly notation: Readonly<NotationDocumentV4>;
  readonly selection: EventAddressV3;
  readonly admission: Readonly<TupletRetimingAdmissionV4>;
  readonly restBalance: Readonly<TupletRetimingRestBalanceV4>;
}

export type TupletRetimingAuthoringV4ErrorCode =
  | 'INVALID_INTENT'
  | 'INVALID_REVISION_ID'
  | 'TIMING_NOT_ADMITTED'
  | 'TARGET_PATH_INVALID'
  | 'REST_ID_COLLISION'
  | 'RESULT_INVALID';

export class TupletRetimingAuthoringV4Error extends Error {
  readonly code: TupletRetimingAuthoringV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: TupletRetimingAuthoringV4ErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'TupletRetimingAuthoringV4Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

type RecordValue = Record<string, unknown>;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MASK_64 = (1n << 64n) - 1n;
const FNV_OFFSET_64 = 14695981039346656037n;
const FNV_PRIME_64 = 1099511628211n;

const isRecord = (value: unknown): value is RecordValue =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const exact = (value: unknown, keys: readonly string[]): value is RecordValue =>
  isRecord(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());

const gcd = (left: bigint, right: bigint): bigint => {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
};

const rational = (numerator: bigint, denominator: bigint): Readonly<Rational> => {
  if (numerator < 0n || denominator <= 0n) {
    throw new TupletRetimingAuthoringV4Error('Tuplet retiming arithmetic produced an invalid rational.', 'RESULT_INVALID');
  }
  const divisor = gcd(numerator, denominator);
  const n = numerator / divisor;
  const d = denominator / divisor;
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (n > max || d > max) {
    throw new TupletRetimingAuthoringV4Error('Tuplet retiming arithmetic exceeded safe integer bounds.', 'RESULT_INVALID');
  }
  return Object.freeze({ numerator: Number(n), denominator: Number(d) });
};

const subtract = (left: Rational, right: Rational): Readonly<Rational> => rational(
  BigInt(left.numerator) * BigInt(right.denominator) -
    BigInt(right.numerator) * BigInt(left.denominator),
  BigInt(left.denominator) * BigInt(right.denominator)
);

const compare = (left: Rational, right: Rational): number => {
  const l = BigInt(left.numerator) * BigInt(right.denominator);
  const r = BigInt(right.numerator) * BigInt(left.denominator);
  return l < r ? -1 : l > r ? 1 : 0;
};

const eventEnd = (event: ScoreEvent): Readonly<Rational> => rational(
  BigInt(event.onset.numerator) * BigInt(event.duration.denominator) +
    BigInt(event.duration.numerator) * BigInt(event.onset.denominator),
  BigInt(event.onset.denominator) * BigInt(event.duration.denominator)
);

const parseIntent = (raw: unknown): Readonly<RetimingStraightThreeToTripletIntentV4> => {
  if (!exact(raw, ['version', 'type', 'targets']) ||
      raw.version !== TUPLET_RETIMING_AUTHORING_V4_VERSION ||
      raw.type !== 'RETIMING_STRAIGHT_THREE_TO_TRIPLET' ||
      !Array.isArray(raw.targets) || raw.targets.length !== 3) {
    throw new TupletRetimingAuthoringV4Error(
      'Straight-three triplet retiming intent is invalid.',
      'INVALID_INTENT'
    );
  }
  return Object.freeze({
    version: TUPLET_RETIMING_AUTHORING_V4_VERSION,
    type: 'RETIMING_STRAIGHT_THREE_TO_TRIPLET',
    targets: Object.freeze(raw.targets.map(target => Object.freeze({ ...(target as EventAddressV3) })))
  });
};

const assertRevision = (score: ScoreDocumentV3, nextRevisionId: string): void => {
  if (!ID.test(nextRevisionId) ||
      nextRevisionId === score.revision.id ||
      nextRevisionId === score.revision.parentId) {
    throw new TupletRetimingAuthoringV4Error(
      'A fresh stable next revision id is required.',
      'INVALID_REVISION_ID'
    );
  }
};

const targetId = (address: SemanticAddressV3): string => {
  switch (address.kind) {
    case 'document': return address.documentId;
    case 'measure-frame': return address.frameId;
    case 'part': return address.partId;
    case 'staff': return address.staffId;
    case 'measure': return address.measureId;
    case 'voice': return address.voiceId;
    case 'event': return address.eventId;
    case 'note': return address.noteId;
    case 'grace-group': return address.graceGroupId;
    case 'grace-event': return address.graceEventId;
    case 'grace-note': return address.graceNoteId;
  }
};

const rebind = (score: ScoreDocumentV3, address: SemanticAddressV3): SemanticAddressV3 => {
  const rebound = addressEntityV3(score, targetId(address));
  if (rebound.kind !== address.kind) {
    throw new TupletRetimingAuthoringV4Error(
      'Tuplet retiming changed semantic target kind.',
      'RESULT_INVALID',
      { expected: address.kind, observed: rebound.kind }
    );
  }
  return rebound;
};

const defaultEventNotation = (): EventNotationV2 => ({
  dots: 0,
  beams: [],
  tuplet: null,
  articulations: [],
  ornaments: []
});

const eventNotationFor = (notation: NotationDocumentV4, eventId: string): EventNotationV2 =>
  notation.events.find(entry => entry.target.eventId === eventId)?.notation ?? defaultEventNotation();

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

const allIds = (score: ScoreDocumentV3): ReadonlySet<string> => {
  const ids = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!isRecord(value)) return;
    for (const [key, item] of Object.entries(value)) {
      if (key === 'id' && typeof item === 'string') ids.add(item);
      visit(item);
    }
  };
  visit(score);
  return ids;
};

const fnv1a64 = (value: string): string => {
  let hash = FNV_OFFSET_64;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = (hash * FNV_PRIME_64) & MASK_64;
  }
  return hash.toString(16).padStart(16, '0');
};

const residualRestId = (
  score: ScoreDocumentV3,
  targetIds: readonly [string, string, string],
  nextRevisionId: string
): string => {
  const id = `tuplet-rest:${fnv1a64(`${score.id}|${score.revision.id}|${targetIds.join('|')}|${nextRevisionId}`)}`;
  if (allIds(score).has(id)) {
    throw new TupletRetimingAuthoringV4Error(
      'Deterministic tuplet residual rest identity collides with current canonical identity.',
      'REST_ID_COLLISION',
      { id }
    );
  }
  return id;
};

const tupletNotation = (
  current: EventNotationV2,
  position: 'start' | 'middle' | 'stop'
): EventNotationV2 => ({
  ...current,
  tuplet: {
    actualNotes: 3,
    normalNotes: 2,
    marks: position === 'middle'
      ? []
      : [{ number: 1, type: position }]
  }
});

const buildNotation = (
  score: ScoreDocumentV3,
  base: NotationDocumentV4,
  eventMap: ReadonlyMap<string, EventNotationV2>
): Readonly<NotationDocumentV4> => {
  try {
    return createNotationDocumentV4(score, {
      contractVersion: '4.0.0',
      documentId: score.id,
      revisionId: score.revision.id,
      frames: base.frames.map(entry => ({
        target: rebind(score, entry.target) as typeof entry.target,
        notation: entry.notation
      })),
      measures: base.measures.map(entry => ({
        target: rebind(score, entry.target) as typeof entry.target,
        notation: entry.notation
      })),
      events: [...eventMap].map(([eventId, value]) => ({
        target: addressEntityV3(score, eventId) as EventAddressV3,
        notation: value
      })),
      notes: base.notes.map(entry => ({
        target: rebind(score, entry.target) as typeof entry.target,
        notation: entry.notation
      })),
      graceEvents: base.graceEvents.map(entry => ({
        target: rebind(score, entry.target) as typeof entry.target,
        notation: entry.notation
      })),
      graceNotes: base.graceNotes.map(entry => ({
        target: rebind(score, entry.target) as typeof entry.target,
        notation: entry.notation
      })),
      crossStaffPlacements: base.crossStaffPlacements.map(item => ({
        source: rebind(score, item.source) as EventAddressV3,
        displayStaffId: item.displayStaffId
      }))
    });
  } catch (error) {
    if (error instanceof TupletRetimingAuthoringV4Error) throw error;
    throw new TupletRetimingAuthoringV4Error(
      'Tuplet retiming notation candidate failed validation.',
      'RESULT_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

const mutate = (
  score: ScoreDocumentV3,
  notation: NotationDocumentV4,
  admission: TupletRetimingAdmissionV4,
  nextRevisionId: string
): Readonly<{
  score: Readonly<ScoreDocumentV3>;
  notation: Readonly<NotationDocumentV4>;
  balance: Readonly<TupletRetimingRestBalanceV4>;
}> => {
  const firstTarget = addressEntityV3(score, admission.targetEventIds[0]);
  if (firstTarget.kind !== 'event') {
    throw new TupletRetimingAuthoringV4Error('First retiming target disappeared.', 'TARGET_PATH_INVALID');
  }
  const candidate = structuredClone(score) as ScoreDocumentV3;
  const part = candidate.parts.find(item => item.id === firstTarget.partId);
  const staff = part?.staves.find(item => item.id === firstTarget.staffId);
  const measure = staff?.measures.find(item => item.id === firstTarget.measureId && item.frameId === firstTarget.frameId);
  const voice = measure?.voices.find(item => item.id === firstTarget.voiceId);
  if (part === undefined || staff === undefined || staff.role === 'tablature-linked' || measure === undefined || voice === undefined) {
    throw new TupletRetimingAuthoringV4Error('Tuplet retiming target voice disappeared during mutation.', 'TARGET_PATH_INVALID');
  }

  const events = [...voice.events] as ScoreEvent[];
  const indices = admission.targetEventIds.map(eventId => events.findIndex(event => event.id === eventId));
  const [firstIndex, secondIndex, thirdIndex] = indices;
  if (firstIndex === undefined || secondIndex !== firstIndex + 1 || thirdIndex !== secondIndex + 1 || firstIndex < 0) {
    throw new TupletRetimingAuthoringV4Error('Tuplet retiming exact range changed before mutation.', 'TARGET_PATH_INVALID');
  }
  if (admission.eventPlans.length !== 3 || admission.releasedInterval === null) {
    throw new TupletRetimingAuthoringV4Error('Admitted tuple retiming plan is incomplete.', 'RESULT_INVALID');
  }

  for (const plan of admission.eventPlans) {
    const index = events.findIndex(event => event.id === plan.eventId);
    if (index < 0) {
      throw new TupletRetimingAuthoringV4Error('Planned tuple retiming event disappeared.', 'TARGET_PATH_INVALID', { eventId: plan.eventId });
    }
    const current = events[index]!;
    events[index] = {
      ...current,
      onset: Object.freeze({ ...plan.proposedOnset }),
      duration: Object.freeze({ ...plan.proposedDuration })
    };
  }

  const thirdEvent = events[thirdIndex]!;
  const nextIndex = admission.nextEventId === null
    ? -1
    : events.findIndex(event => event.id === admission.nextEventId);
  const nextEvent = nextIndex < 0 ? null : events[nextIndex]!;
  const released = admission.releasedInterval;
  const canExtend = nextEvent?.kind === 'rest' &&
    compare(nextEvent.onset, released.end) === 0 &&
    neutralRestNotation(notation, nextEvent.id) &&
    !hasCrossStaff(notation, nextEvent.id);

  let balance: Readonly<TupletRetimingRestBalanceV4>;
  if (canExtend && nextEvent !== null && nextIndex >= 0) {
    const nextEnd = eventEnd(nextEvent);
    events[nextIndex] = {
      ...nextEvent,
      onset: Object.freeze({ ...released.onset }),
      duration: subtract(nextEnd, released.onset)
    };
    balance = Object.freeze({ kind: 'EXTENDED_ADJACENT_REST', restEventId: nextEvent.id });
  } else {
    const restId = residualRestId(score, admission.targetEventIds, nextRevisionId);
    const residual: ScoreEvent = {
      id: restId,
      kind: 'rest',
      onset: Object.freeze({ ...released.onset }),
      duration: Object.freeze({ ...released.duration })
    };
    events.splice(thirdIndex + 1, 0, residual);
    balance = Object.freeze({ kind: 'CREATED_RESIDUAL_REST', restEventId: restId });
  }

  const eventMap = new Map(notation.events.map(entry => [entry.target.eventId, entry.notation] as const));
  const positions = ['start', 'middle', 'stop'] as const;
  admission.targetEventIds.forEach((eventId, index) => {
    eventMap.set(eventId, tupletNotation(eventNotationFor(notation, eventId), positions[index]!));
  });

  (voice as { events: readonly ScoreEvent[] }).events = events;
  (candidate as { revision: { id: string; parentId: string | null } }).revision = {
    id: nextRevisionId,
    parentId: score.revision.id
  };

  let nextScore: Readonly<ScoreDocumentV3>;
  try {
    nextScore = createScoreDocumentV3(candidate);
  } catch (error) {
    throw new TupletRetimingAuthoringV4Error(
      'Tuplet retiming score candidate failed canonical validation.',
      'RESULT_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  const nextNotation = buildNotation(nextScore, notation, eventMap);

  const postTarget = addressEntityV3(nextScore, thirdEvent.id);
  if (postTarget.kind !== 'event') {
    throw new TupletRetimingAuthoringV4Error('Tuplet retiming post-validation target disappeared.', 'RESULT_INVALID');
  }
  const post = analyzeEventDurationMutationV4(
    nextScore,
    nextNotation,
    postTarget,
    admission.eventPlans[2]!.proposedDuration,
    { allowDotRewrite: true, allowAdjacentRestConsumption: true }
  );
  if (post.reason === 'BLOCKED_EXISTING_TIMING_INVALID') {
    throw new TupletRetimingAuthoringV4Error(
      'Tuplet retiming result failed independent occupancy validation.',
      'RESULT_INVALID'
    );
  }

  return Object.freeze({ score: nextScore, notation: nextNotation, balance });
};

export const executeStraightThreeToTripletAuthoringV4 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  rawIntent: unknown,
  options: TupletRetimingAuthoringV4Options
): Readonly<TupletRetimingAuthoringV4Result> => {
  const score = createScoreDocumentV3(scoreInput);
  const notation = createNotationDocumentV4(score, notationInput);
  const intent = parseIntent(rawIntent);
  assertRevision(score, options.nextRevisionId);

  const admission = analyzeStraightThreeToTripletRetimingV4(score, notation, intent.targets);
  if (!admission.admitted) {
    throw new TupletRetimingAuthoringV4Error(
      'Straight-three triplet retiming was not admitted.',
      'TIMING_NOT_ADMITTED',
      { reason: admission.reason, couplingReasons: admission.couplingReasons }
    );
  }

  const mutated = mutate(score, notation, admission, options.nextRevisionId);
  const selection = addressEntityV3(mutated.score, admission.targetEventIds[0]);
  if (selection.kind !== 'event') {
    throw new TupletRetimingAuthoringV4Error('Tuplet retiming result selection changed kind.', 'RESULT_INVALID');
  }

  return Object.freeze({
    version: TUPLET_RETIMING_AUTHORING_V4_VERSION,
    score: mutated.score,
    notation: mutated.notation,
    selection,
    admission,
    restBalance: mutated.balance
  });
};
