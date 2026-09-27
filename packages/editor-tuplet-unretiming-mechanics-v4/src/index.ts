import { createScoreDocumentV3, type ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import type { Rational, ScoreEvent } from '../../score-model/src/index.js';
import {
  addressEntityV3,
  resolveSemanticAddressV3,
  type EventAddressV3,
  type SemanticAddressV3
} from '../../addressing-v3/src/index.js';
import {
  createNotationDocumentV4,
  type NotationDocumentV4
} from '../../notation-structure-v4/src/index.js';
import type { EventNotationV2 } from '../../notation-structure-v2/src/index.js';

export class TupletAuthoringErrorBaseV4<Code extends string> extends Error {
  readonly code: Code;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    name: string,
    message: string,
    code: Code,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = name;
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

type ExactRecordV4 = Record<string, unknown>;
const STABLE_ID_V4 = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export const isExactRecordV4 = (
  value: unknown,
  keys: readonly string[]
): value is ExactRecordV4 =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());

export const isFreshRevisionIdV4 = (
  score: ScoreDocumentV3,
  nextRevisionId: string
): boolean =>
  STABLE_ID_V4.test(nextRevisionId) &&
  nextRevisionId !== score.revision.id &&
  nextRevisionId !== score.revision.parentId;

type MechanicsErrorCodeV4 = 'TARGET_PATH_INVALID' | 'RESULT_INVALID';
type MechanicsErrorFactoryV4 = (
  message: string,
  code: MechanicsErrorCodeV4,
  details?: Record<string, unknown>
) => Error;

export interface TupletUnretimingEventPlanLikeV4 {
  readonly eventId: string;
  readonly currentOnset: Rational;
  readonly currentDuration: Rational;
  readonly proposedOnset: Rational;
  readonly proposedDuration: Rational;
}

export interface TupletUnretimingRestPlanLikeV4 {
  readonly action: 'REMOVE_ADJACENT_REST' | 'SHRINK_ADJACENT_REST_FORWARD';
  readonly restEventId: string;
  readonly currentOnset: Rational;
  readonly currentDuration: Rational;
  readonly proposedOnset: Rational | null;
  readonly proposedDuration: Rational | null;
}

export interface TupletUnretimingMechanicsPlanV4 {
  readonly targetEventIds: readonly string[];
  readonly eventPlans: readonly TupletUnretimingEventPlanLikeV4[];
  readonly restPlan: TupletUnretimingRestPlanLikeV4 | null;
}

export interface TupletUnretimingMechanicsOptionsV4 {
  readonly expectedTargetCount: number;
  readonly label: string;
  readonly error: MechanicsErrorFactoryV4;
}

const sameRational = (left: Rational, right: Rational): boolean =>
  BigInt(left.numerator) * BigInt(right.denominator) ===
  BigInt(right.numerator) * BigInt(left.denominator);

const TARGET_ID_FIELD_BY_KIND = Object.freeze({
  document: 'documentId',
  'measure-frame': 'frameId',
  part: 'partId',
  staff: 'staffId',
  measure: 'measureId',
  voice: 'voiceId',
  event: 'eventId',
  note: 'noteId',
  'grace-group': 'graceGroupId',
  'grace-event': 'graceEventId',
  'grace-note': 'graceNoteId'
} as const);

const targetId = (address: SemanticAddressV3): string => {
  const field = TARGET_ID_FIELD_BY_KIND[address.kind];
  return (address as unknown as Record<string, string>)[field]!;
};

const rebind = (
  score: ScoreDocumentV3,
  address: SemanticAddressV3,
  options: TupletUnretimingMechanicsOptionsV4
): SemanticAddressV3 => {
  const rebound = addressEntityV3(score, targetId(address));
  if (rebound.kind !== address.kind) {
    throw options.error(
      `${options.label} changed semantic target kind.`,
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

export const eventNotationForTupletV4 = (
  notation: NotationDocumentV4,
  eventId: string
): EventNotationV2 =>
  notation.events.find(entry => entry.target.eventId === eventId)?.notation ??
  defaultEventNotation();

const withoutTuplet = (current: EventNotationV2): EventNotationV2 => ({
  ...current,
  tuplet: null
});

const neutralEventNotation = (value: EventNotationV2): boolean =>
  value.dots === 0 &&
  value.beams.length === 0 &&
  value.tuplet === null &&
  value.articulations.length === 0 &&
  value.ornaments.length === 0;

const noteIds = (event: ScoreEvent): readonly string[] =>
  event.kind === 'note'
    ? [event.note.id]
    : event.kind === 'chord'
      ? event.notes.map(note => note.id)
      : [];

export const buildTupletNotationDocumentV4 = (
  score: ScoreDocumentV3,
  base: NotationDocumentV4,
  eventMap: ReadonlyMap<string, EventNotationV2>,
  options: TupletUnretimingMechanicsOptionsV4
): Readonly<NotationDocumentV4> => {
  try {
    return createNotationDocumentV4(score, {
      contractVersion: '4.0.0',
      documentId: score.id,
      revisionId: score.revision.id,
      frames: base.frames.map(entry => ({
        target: rebind(score, entry.target, options) as typeof entry.target,
        notation: entry.notation
      })),
      measures: base.measures.map(entry => ({
        target: rebind(score, entry.target, options) as typeof entry.target,
        notation: entry.notation
      })),
      events: [...eventMap].map(([eventId, value]) => ({
        target: addressEntityV3(score, eventId) as EventAddressV3,
        notation: value
      })),
      notes: base.notes.map(entry => ({
        target: rebind(score, entry.target, options) as typeof entry.target,
        notation: entry.notation
      })),
      graceEvents: base.graceEvents.map(entry => ({
        target: rebind(score, entry.target, options) as typeof entry.target,
        notation: entry.notation
      })),
      graceNotes: base.graceNotes.map(entry => ({
        target: rebind(score, entry.target, options) as typeof entry.target,
        notation: entry.notation
      })),
      crossStaffPlacements: base.crossStaffPlacements.map(item => ({
        source: rebind(score, item.source, options) as EventAddressV3,
        displayStaffId: item.displayStaffId
      }))
    });
  } catch (cause) {
    throw options.error(
      `${options.label} notation candidate failed validation.`,
      'RESULT_INVALID',
      { cause: cause instanceof Error ? cause.message : String(cause) }
    );
  }
};

const resolveEvent = (
  score: ScoreDocumentV3,
  eventId: string
): ScoreEvent | null => {
  try {
    const address = addressEntityV3(score, eventId);
    const resolved = resolveSemanticAddressV3(score, address);
    return resolved.kind === 'event' ? resolved.value : null;
  } catch {
    return null;
  }
};

export const applyTupletUnretimingMechanicsV4 = (
  score: ScoreDocumentV3,
  notation: NotationDocumentV4,
  plan: TupletUnretimingMechanicsPlanV4,
  nextRevisionId: string,
  options: TupletUnretimingMechanicsOptionsV4
): Readonly<{ score: Readonly<ScoreDocumentV3>; notation: Readonly<NotationDocumentV4> }> => {
  if (
    plan.targetEventIds.length !== options.expectedTargetCount ||
    plan.eventPlans.length !== options.expectedTargetCount ||
    plan.restPlan === null
  ) {
    throw options.error(
      `${options.label} admitted plan is incomplete.`,
      'RESULT_INVALID'
    );
  }

  let firstAddress: EventAddressV3;
  try {
    const addressed = addressEntityV3(score, plan.targetEventIds[0]!);
    if (addressed.kind !== 'event') throw new Error('TARGET_KIND_CHANGED');
    firstAddress = addressed;
  } catch {
    throw options.error(
      `First ${options.label} target disappeared.`,
      'TARGET_PATH_INVALID'
    );
  }

  const candidate = structuredClone(score) as ScoreDocumentV3;
  const part = candidate.parts.find(item => item.id === firstAddress.partId);
  const staff = part?.staves.find(item => item.id === firstAddress.staffId);
  const measure = staff?.measures.find(
    item => item.id === firstAddress.measureId && item.frameId === firstAddress.frameId
  );
  const voice = measure?.voices.find(item => item.id === firstAddress.voiceId);
  if (
    part === undefined ||
    staff === undefined ||
    staff.role === 'tablature-linked' ||
    measure === undefined ||
    voice === undefined
  ) {
    throw options.error(
      `${options.label} target voice disappeared during mutation.`,
      'TARGET_PATH_INVALID'
    );
  }

  const beforeNoteIds = new Map<string, readonly string[]>();
  for (const eventId of plan.targetEventIds) {
    const original = voice.events.find(event => event.id === eventId);
    if (original === undefined) {
      throw options.error(
        `Planned ${options.label} event disappeared.`,
        'TARGET_PATH_INVALID',
        { eventId }
      );
    }
    beforeNoteIds.set(eventId, Object.freeze([...noteIds(original)]));
  }

  const events = [...voice.events] as ScoreEvent[];
  for (const eventPlan of plan.eventPlans) {
    const index = events.findIndex(event => event.id === eventPlan.eventId);
    const current = index < 0 ? null : events[index]!;
    if (
      current === null ||
      !sameRational(current.onset, eventPlan.currentOnset) ||
      !sameRational(current.duration, eventPlan.currentDuration)
    ) {
      throw options.error(
        `Admitted ${options.label} event timing changed before mutation.`,
        'TARGET_PATH_INVALID',
        { eventId: eventPlan.eventId }
      );
    }
    events[index] = {
      ...current,
      onset: Object.freeze({ ...eventPlan.proposedOnset }),
      duration: Object.freeze({ ...eventPlan.proposedDuration })
    };
  }

  const restPlan = plan.restPlan;
  const restIndex = events.findIndex(event => event.id === restPlan.restEventId);
  const rest = restIndex < 0 ? null : events[restIndex]!;
  if (
    rest === null ||
    rest.kind !== 'rest' ||
    !sameRational(rest.onset, restPlan.currentOnset) ||
    !sameRational(rest.duration, restPlan.currentDuration)
  ) {
    throw options.error(
      `Admitted adjacent rest changed before ${options.label} mutation.`,
      'TARGET_PATH_INVALID',
      { restEventId: restPlan.restEventId }
    );
  }

  if (restPlan.action === 'REMOVE_ADJACENT_REST') {
    events.splice(restIndex, 1);
  } else if (restPlan.action === 'SHRINK_ADJACENT_REST_FORWARD') {
    if (restPlan.proposedOnset === null || restPlan.proposedDuration === null) {
      throw options.error(
        'Admitted adjacent-rest shrink plan is incomplete.',
        'RESULT_INVALID',
        { restEventId: restPlan.restEventId }
      );
    }
    events[restIndex] = {
      ...rest,
      onset: Object.freeze({ ...restPlan.proposedOnset }),
      duration: Object.freeze({ ...restPlan.proposedDuration })
    };
  } else {
    throw options.error(
      'Admitted adjacent-rest action is unsupported.',
      'RESULT_INVALID',
      { action: (restPlan as { readonly action?: unknown }).action }
    );
  }

  const eventMap = new Map(
    notation.events.map(entry => [entry.target.eventId, entry.notation] as const)
  );
  for (const eventId of plan.targetEventIds) {
    const nextNotation = withoutTuplet(eventNotationForTupletV4(notation, eventId));
    if (neutralEventNotation(nextNotation)) eventMap.delete(eventId);
    else eventMap.set(eventId, nextNotation);
  }
  if (restPlan.action === 'REMOVE_ADJACENT_REST') {
    eventMap.delete(restPlan.restEventId);
  }

  (voice as { events: readonly ScoreEvent[] }).events = events;
  (candidate as { revision: { id: string; parentId: string | null } }).revision = {
    id: nextRevisionId,
    parentId: score.revision.id
  };

  let nextScore: Readonly<ScoreDocumentV3>;
  try {
    nextScore = createScoreDocumentV3(candidate);
  } catch (cause) {
    throw options.error(
      `${options.label} score candidate failed canonical validation.`,
      'RESULT_INVALID',
      { cause: cause instanceof Error ? cause.message : String(cause) }
    );
  }
  const nextNotation = buildTupletNotationDocumentV4(nextScore, notation, eventMap, options);

  for (const eventPlan of plan.eventPlans) {
    const value = resolveEvent(nextScore, eventPlan.eventId);
    if (
      value === null ||
      !sameRational(value.onset, eventPlan.proposedOnset) ||
      !sameRational(value.duration, eventPlan.proposedDuration) ||
      JSON.stringify(noteIds(value)) !== JSON.stringify(beforeNoteIds.get(eventPlan.eventId) ?? [])
    ) {
      throw options.error(
        `${options.label} result does not match admitted event plan.`,
        'RESULT_INVALID',
        { eventId: eventPlan.eventId }
      );
    }
    const tuplet = nextNotation.events.find(
      entry => entry.target.eventId === eventPlan.eventId
    )?.notation.tuplet ?? null;
    if (tuplet !== null) {
      throw options.error(
        `${options.label} result retained owned tuplet notation.`,
        'RESULT_INVALID',
        { eventId: eventPlan.eventId }
      );
    }
  }

  const restValue = resolveEvent(nextScore, restPlan.restEventId);
  if (restPlan.action === 'REMOVE_ADJACENT_REST') {
    if (
      restValue !== null ||
      nextNotation.events.some(entry => entry.target.eventId === restPlan.restEventId)
    ) {
      throw options.error(
        `${options.label} result retained an exactly consumed adjacent rest.`,
        'RESULT_INVALID',
        { restEventId: restPlan.restEventId }
      );
    }
  } else {
    if (
      restPlan.proposedOnset === null ||
      restPlan.proposedDuration === null ||
      restValue === null ||
      restValue.kind !== 'rest' ||
      !sameRational(restValue.onset, restPlan.proposedOnset) ||
      !sameRational(restValue.duration, restPlan.proposedDuration)
    ) {
      throw options.error(
        `${options.label} result does not match admitted adjacent-rest shrink plan.`,
        'RESULT_INVALID',
        { restEventId: restPlan.restEventId }
      );
    }
  }

  return Object.freeze({ score: nextScore, notation: nextNotation });
};
