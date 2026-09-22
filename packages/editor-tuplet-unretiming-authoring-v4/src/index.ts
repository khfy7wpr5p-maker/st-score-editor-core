import { createScoreDocumentV3, type ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import type { ScoreEvent } from '../../score-model/src/index.js';
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
import {
  analyzeTripletToStraightThreeUnretimingV4,
  type TupletUnretimingAdmissionV4
} from '../../editor-tuplet-unretiming-admission-v4/src/index.js';

export const TUPLET_UNRETIMING_AUTHORING_V4_VERSION = '1.0.0' as const;

export interface UnretimingTripletToStraightThreeIntentV4 {
  readonly version: typeof TUPLET_UNRETIMING_AUTHORING_V4_VERSION;
  readonly type: 'UNRETIMING_TRIPLET_TO_STRAIGHT_THREE';
  readonly targets: readonly EventAddressV3[];
}

export interface TupletUnretimingAuthoringV4Options {
  readonly nextRevisionId: string;
}

export interface TupletUnretimingAuthoringV4Result {
  readonly version: typeof TUPLET_UNRETIMING_AUTHORING_V4_VERSION;
  readonly score: Readonly<ScoreDocumentV3>;
  readonly notation: Readonly<NotationDocumentV4>;
  readonly selection: EventAddressV3;
  readonly admission: Readonly<TupletUnretimingAdmissionV4>;
}

export type TupletUnretimingAuthoringV4ErrorCode =
  | 'INVALID_INTENT'
  | 'INVALID_REVISION_ID'
  | 'TIMING_NOT_ADMITTED'
  | 'TARGET_PATH_INVALID'
  | 'RESULT_INVALID';

export class TupletUnretimingAuthoringV4Error extends Error {
  readonly code: TupletUnretimingAuthoringV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: TupletUnretimingAuthoringV4ErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'TupletUnretimingAuthoringV4Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

type RecordValue = Record<string, unknown>;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

const isRecord = (value: unknown): value is RecordValue =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const exact = (value: unknown, keys: readonly string[]): value is RecordValue =>
  isRecord(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());

const sameRational = (
  left: { readonly numerator: number; readonly denominator: number },
  right: { readonly numerator: number; readonly denominator: number }
): boolean =>
  BigInt(left.numerator) * BigInt(right.denominator) ===
  BigInt(right.numerator) * BigInt(left.denominator);

const parseIntent = (raw: unknown): Readonly<UnretimingTripletToStraightThreeIntentV4> => {
  if (
    !exact(raw, ['version', 'type', 'targets']) ||
    raw.version !== TUPLET_UNRETIMING_AUTHORING_V4_VERSION ||
    raw.type !== 'UNRETIMING_TRIPLET_TO_STRAIGHT_THREE' ||
    !Array.isArray(raw.targets) ||
    raw.targets.length !== 3
  ) {
    throw new TupletUnretimingAuthoringV4Error(
      'Triplet unretiming intent is invalid.',
      'INVALID_INTENT'
    );
  }
  return Object.freeze({
    version: TUPLET_UNRETIMING_AUTHORING_V4_VERSION,
    type: 'UNRETIMING_TRIPLET_TO_STRAIGHT_THREE',
    targets: Object.freeze(raw.targets.map(target => Object.freeze({ ...(target as EventAddressV3) })))
  });
};

const assertRevision = (score: ScoreDocumentV3, nextRevisionId: string): void => {
  if (
    !ID.test(nextRevisionId) ||
    nextRevisionId === score.revision.id ||
    nextRevisionId === score.revision.parentId
  ) {
    throw new TupletUnretimingAuthoringV4Error(
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
    throw new TupletUnretimingAuthoringV4Error(
      'Triplet unretiming changed semantic target kind.',
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
    if (error instanceof TupletUnretimingAuthoringV4Error) throw error;
    throw new TupletUnretimingAuthoringV4Error(
      'Triplet unretiming notation candidate failed validation.',
      'RESULT_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

const mutate = (
  score: ScoreDocumentV3,
  notation: NotationDocumentV4,
  admission: TupletUnretimingAdmissionV4,
  nextRevisionId: string
): Readonly<{ score: Readonly<ScoreDocumentV3>; notation: Readonly<NotationDocumentV4> }> => {
  const firstTarget = addressEntityV3(score, admission.targetEventIds[0]);
  if (firstTarget.kind !== 'event') {
    throw new TupletUnretimingAuthoringV4Error(
      'First Triplet unretiming target disappeared.',
      'TARGET_PATH_INVALID'
    );
  }

  if (admission.eventPlans.length !== 3 || admission.restPlan === null) {
    throw new TupletUnretimingAuthoringV4Error(
      'Admitted Triplet unretiming plan is incomplete.',
      'RESULT_INVALID'
    );
  }

  const candidate = structuredClone(score) as ScoreDocumentV3;
  const part = candidate.parts.find(item => item.id === firstTarget.partId);
  const staff = part?.staves.find(item => item.id === firstTarget.staffId);
  const measure = staff?.measures.find(
    item => item.id === firstTarget.measureId && item.frameId === firstTarget.frameId
  );
  const voice = measure?.voices.find(item => item.id === firstTarget.voiceId);
  if (
    part === undefined ||
    staff === undefined ||
    staff.role === 'tablature-linked' ||
    measure === undefined ||
    voice === undefined
  ) {
    throw new TupletUnretimingAuthoringV4Error(
      'Triplet unretiming target voice disappeared during mutation.',
      'TARGET_PATH_INVALID'
    );
  }

  const events = [...voice.events] as ScoreEvent[];
  for (const plan of admission.eventPlans) {
    const index = events.findIndex(event => event.id === plan.eventId);
    if (index < 0) {
      throw new TupletUnretimingAuthoringV4Error(
        'Planned Triplet unretiming event disappeared.',
        'TARGET_PATH_INVALID',
        { eventId: plan.eventId }
      );
    }
    const current = events[index]!;
    events[index] = {
      ...current,
      onset: Object.freeze({ ...plan.proposedOnset }),
      duration: Object.freeze({ ...plan.proposedDuration })
    };
  }

  const restPlan = admission.restPlan;
  const restIndex = events.findIndex(event => event.id === restPlan.restEventId);
  const restEvent = restIndex < 0 ? null : events[restIndex]!;
  if (
    restEvent === null ||
    restEvent.kind !== 'rest' ||
    !sameRational(restEvent.onset, restPlan.currentOnset) ||
    !sameRational(restEvent.duration, restPlan.currentDuration)
  ) {
    throw new TupletUnretimingAuthoringV4Error(
      'Admitted adjacent rest changed before Triplet unretiming mutation.',
      'TARGET_PATH_INVALID',
      { restEventId: restPlan.restEventId }
    );
  }

  if (restPlan.action === 'REMOVE_ADJACENT_REST') {
    events.splice(restIndex, 1);
  } else {
    if (restPlan.proposedOnset === null || restPlan.proposedDuration === null) {
      throw new TupletUnretimingAuthoringV4Error(
        'Admitted adjacent-rest shrink plan is incomplete.',
        'RESULT_INVALID',
        { restEventId: restPlan.restEventId }
      );
    }
    events[restIndex] = {
      ...restEvent,
      onset: Object.freeze({ ...restPlan.proposedOnset }),
      duration: Object.freeze({ ...restPlan.proposedDuration })
    };
  }

  const eventMap = new Map(
    notation.events.map(entry => [entry.target.eventId, entry.notation] as const)
  );
  for (const eventId of admission.targetEventIds) {
    const nextNotation = withoutTuplet(eventNotationFor(notation, eventId));
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
  } catch (error) {
    throw new TupletUnretimingAuthoringV4Error(
      'Triplet unretiming score candidate failed canonical validation.',
      'RESULT_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  const nextNotation = buildNotation(nextScore, notation, eventMap);

  for (const plan of admission.eventPlans) {
    const reboundAddress = addressEntityV3(nextScore, plan.eventId);
    const rebound = resolveSemanticAddressV3(nextScore, reboundAddress);
    if (
      rebound.kind !== 'event' ||
      !sameRational(rebound.value.onset, plan.proposedOnset) ||
      !sameRational(rebound.value.duration, plan.proposedDuration)
    ) {
      throw new TupletUnretimingAuthoringV4Error(
        'Triplet unretiming result timing does not match admitted plan.',
        'RESULT_INVALID',
        { eventId: plan.eventId }
      );
    }
    const tuplet = nextNotation.events.find(
      entry => entry.target.eventId === plan.eventId
    )?.notation.tuplet ?? null;
    if (tuplet !== null) {
      throw new TupletUnretimingAuthoringV4Error(
        'Triplet unretiming result retained owned Triplet notation.',
        'RESULT_INVALID',
        { eventId: plan.eventId }
      );
    }
  }

  if (restPlan.action === 'REMOVE_ADJACENT_REST') {
    try {
      addressEntityV3(nextScore, restPlan.restEventId);
      throw new TupletUnretimingAuthoringV4Error(
        'Triplet unretiming result retained an exactly consumed adjacent rest.',
        'RESULT_INVALID',
        { restEventId: restPlan.restEventId }
      );
    } catch (error) {
      if (error instanceof TupletUnretimingAuthoringV4Error) throw error;
    }
  } else {
    if (restPlan.proposedOnset === null || restPlan.proposedDuration === null) {
      throw new TupletUnretimingAuthoringV4Error(
        'Triplet unretiming result lost the admitted adjacent-rest shrink plan.',
        'RESULT_INVALID'
      );
    }
    const rebound = resolveSemanticAddressV3(
      nextScore,
      addressEntityV3(nextScore, restPlan.restEventId)
    );
    if (
      rebound.kind !== 'event' ||
      rebound.value.kind !== 'rest' ||
      !sameRational(rebound.value.onset, restPlan.proposedOnset) ||
      !sameRational(rebound.value.duration, restPlan.proposedDuration)
    ) {
      throw new TupletUnretimingAuthoringV4Error(
        'Triplet unretiming result does not match the admitted adjacent-rest shrink plan.',
        'RESULT_INVALID',
        { restEventId: restPlan.restEventId }
      );
    }
  }

  return Object.freeze({ score: nextScore, notation: nextNotation });
};

export const executeTripletToStraightThreeUnretimingV4 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  rawIntent: unknown,
  options: TupletUnretimingAuthoringV4Options
): Readonly<TupletUnretimingAuthoringV4Result> => {
  const score = createScoreDocumentV3(scoreInput);
  const notation = createNotationDocumentV4(score, notationInput);
  const intent = parseIntent(rawIntent);
  assertRevision(score, options.nextRevisionId);

  const admission = analyzeTripletToStraightThreeUnretimingV4(
    score,
    notation,
    intent.targets
  );
  if (!admission.admitted) {
    throw new TupletUnretimingAuthoringV4Error(
      'Triplet to straight-three unretiming was not admitted.',
      'TIMING_NOT_ADMITTED',
      { reason: admission.reason, couplingReasons: admission.couplingReasons }
    );
  }

  const mutated = mutate(score, notation, admission, options.nextRevisionId);
  const selection = addressEntityV3(mutated.score, admission.targetEventIds[0]);
  if (selection.kind !== 'event') {
    throw new TupletUnretimingAuthoringV4Error(
      'Triplet unretiming result selection changed kind.',
      'RESULT_INVALID'
    );
  }

  return Object.freeze({
    version: TUPLET_UNRETIMING_AUTHORING_V4_VERSION,
    score: mutated.score,
    notation: mutated.notation,
    selection,
    admission
  });
};
