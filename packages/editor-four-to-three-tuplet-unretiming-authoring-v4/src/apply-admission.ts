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
import type { GeneralizedTupletAdmissionV4 } from '../../editor-generalized-tuplet-admission-v4/src/index.js';

export type FourToThreeTupletUnretimingAuthoringV4ErrorCode =
  | 'INVALID_INTENT'
  | 'INVALID_REVISION_ID'
  | 'TIMING_NOT_ADMITTED'
  | 'TARGET_PATH_INVALID'
  | 'RESULT_INVALID';

export class FourToThreeTupletUnretimingAuthoringV4Error extends Error {
  readonly code: FourToThreeTupletUnretimingAuthoringV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: FourToThreeTupletUnretimingAuthoringV4ErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'FourToThreeTupletUnretimingAuthoringV4Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const sameRational = (left: Rational, right: Rational): boolean =>
  BigInt(left.numerator) * BigInt(right.denominator) ===
  BigInt(right.numerator) * BigInt(left.denominator);

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
    throw new FourToThreeTupletUnretimingAuthoringV4Error(
      '4:3 unretiming changed semantic target kind.',
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
    if (error instanceof FourToThreeTupletUnretimingAuthoringV4Error) throw error;
    throw new FourToThreeTupletUnretimingAuthoringV4Error(
      '4:3 unretiming notation candidate failed validation.',
      'RESULT_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

const noteIds = (event: ScoreEvent): readonly string[] =>
  event.kind === 'note'
    ? [event.note.id]
    : event.kind === 'chord'
      ? event.notes.map(note => note.id)
      : [];

export const applyFreshFourToThreeTupletAdmissionV4 = (
  score: ScoreDocumentV3,
  notation: NotationDocumentV4,
  admission: GeneralizedTupletAdmissionV4,
  nextRevisionId: string
): Readonly<{ score: Readonly<ScoreDocumentV3>; notation: Readonly<NotationDocumentV4> }> => {
  if (
    !admission.admitted ||
    admission.documentId !== score.id ||
    admission.revisionId !== score.revision.id ||
    admission.profile.actualNotes !== 4 ||
    admission.profile.normalNotes !== 3 ||
    admission.profile.targetCardinality !== 4 ||
    admission.targetEventIds.length !== 4 ||
    admission.eventPlans.length !== 4 ||
    admission.restPlan === null
  ) {
    throw new FourToThreeTupletUnretimingAuthoringV4Error(
      'Admitted 4:3 unretiming plan is incomplete or stale.',
      'RESULT_INVALID'
    );
  }

  const firstTarget = addressEntityV3(score, admission.targetEventIds[0]!);
  if (firstTarget.kind !== 'event') {
    throw new FourToThreeTupletUnretimingAuthoringV4Error(
      'First 4:3 unretiming target disappeared.',
      'TARGET_PATH_INVALID'
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
    throw new FourToThreeTupletUnretimingAuthoringV4Error(
      '4:3 unretiming target voice disappeared during mutation.',
      'TARGET_PATH_INVALID'
    );
  }

  const beforeTargetNoteIds = new Map<string, readonly string[]>();
  for (const eventId of admission.targetEventIds) {
    const original = voice.events.find(event => event.id === eventId);
    if (original === undefined) {
      throw new FourToThreeTupletUnretimingAuthoringV4Error(
        'Planned 4:3 unretiming event disappeared.',
        'TARGET_PATH_INVALID',
        { eventId }
      );
    }
    beforeTargetNoteIds.set(eventId, Object.freeze([...noteIds(original)]));
  }

  const events = [...voice.events] as ScoreEvent[];
  for (const plan of admission.eventPlans) {
    const index = events.findIndex(event => event.id === plan.eventId);
    if (index < 0) {
      throw new FourToThreeTupletUnretimingAuthoringV4Error(
        'Planned 4:3 unretiming event disappeared.',
        'TARGET_PATH_INVALID',
        { eventId: plan.eventId }
      );
    }
    const current = events[index]!;
    if (
      !sameRational(current.onset, plan.currentOnset) ||
      !sameRational(current.duration, plan.currentDuration)
    ) {
      throw new FourToThreeTupletUnretimingAuthoringV4Error(
        'Admitted 4:3 event timing changed before mutation.',
        'TARGET_PATH_INVALID',
        { eventId: plan.eventId }
      );
    }
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
    throw new FourToThreeTupletUnretimingAuthoringV4Error(
      'Admitted adjacent rest changed before 4:3 unretiming mutation.',
      'TARGET_PATH_INVALID',
      { restEventId: restPlan.restEventId }
    );
  }

  if (restPlan.action === 'REMOVE_ADJACENT_REST') {
    events.splice(restIndex, 1);
  } else if (restPlan.action === 'SHRINK_ADJACENT_REST_FORWARD') {
    if (restPlan.proposedOnset === null || restPlan.proposedDuration === null) {
      throw new FourToThreeTupletUnretimingAuthoringV4Error(
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
  } else {
    throw new FourToThreeTupletUnretimingAuthoringV4Error(
      'Admitted adjacent-rest action is unsupported.',
      'RESULT_INVALID',
      { action: (restPlan as { readonly action?: unknown }).action }
    );
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
    throw new FourToThreeTupletUnretimingAuthoringV4Error(
      '4:3 unretiming score candidate failed canonical validation.',
      'RESULT_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }

  const nextNotation = buildNotation(nextScore, notation, eventMap);

  for (const plan of admission.eventPlans) {
    const rebound = addressEntityV3(nextScore, plan.eventId);
    if (rebound.kind !== 'event') {
      throw new FourToThreeTupletUnretimingAuthoringV4Error(
        '4:3 unretiming result selection target changed kind.',
        'RESULT_INVALID',
        { eventId: plan.eventId }
      );
    }
    const partValue = nextScore.parts.find(item => item.id === rebound.partId);
    const staffValue = partValue?.staves.find(item => item.id === rebound.staffId);
    const measureValue = staffValue?.measures.find(
      item => item.id === rebound.measureId && item.frameId === rebound.frameId
    );
    const voiceValue = measureValue?.voices.find(item => item.id === rebound.voiceId);
    const eventValue = voiceValue?.events.find(event => event.id === plan.eventId);
    if (
      eventValue === undefined ||
      !sameRational(eventValue.onset, plan.proposedOnset) ||
      !sameRational(eventValue.duration, plan.proposedDuration) ||
      JSON.stringify(noteIds(eventValue)) !== JSON.stringify(beforeTargetNoteIds.get(plan.eventId) ?? [])
    ) {
      throw new FourToThreeTupletUnretimingAuthoringV4Error(
        '4:3 unretiming result does not match admitted event plan.',
        'RESULT_INVALID',
        { eventId: plan.eventId }
      );
    }
    const tuplet = nextNotation.events.find(
      entry => entry.target.eventId === plan.eventId
    )?.notation.tuplet ?? null;
    if (tuplet !== null) {
      throw new FourToThreeTupletUnretimingAuthoringV4Error(
        '4:3 unretiming result retained owned tuplet notation.',
        'RESULT_INVALID',
        { eventId: plan.eventId }
      );
    }
  }

  if (restPlan.action === 'REMOVE_ADJACENT_REST') {
    const stillPresent = nextScore.parts.some(partValue =>
      partValue.staves.some(staffValue =>
        staffValue.role !== 'tablature-linked' &&
        staffValue.measures.some(measureValue =>
          measureValue.voices.some(voiceValue =>
            voiceValue.events.some(event => event.id === restPlan.restEventId)
          )
        )
      )
    );
    if (
      stillPresent ||
      nextNotation.events.some(entry => entry.target.eventId === restPlan.restEventId)
    ) {
      throw new FourToThreeTupletUnretimingAuthoringV4Error(
        '4:3 unretiming result retained an exactly consumed adjacent rest.',
        'RESULT_INVALID',
        { restEventId: restPlan.restEventId }
      );
    }
  } else {
    if (restPlan.proposedOnset === null || restPlan.proposedDuration === null) {
      throw new FourToThreeTupletUnretimingAuthoringV4Error(
        '4:3 unretiming result lost the admitted rest shrink plan.',
        'RESULT_INVALID'
      );
    }
    const rebound = addressEntityV3(nextScore, restPlan.restEventId);
    if (rebound.kind !== 'event') {
      throw new FourToThreeTupletUnretimingAuthoringV4Error(
        'Shrunk adjacent rest changed semantic kind.',
        'RESULT_INVALID',
        { restEventId: restPlan.restEventId }
      );
    }
    const partValue = nextScore.parts.find(item => item.id === rebound.partId);
    const staffValue = partValue?.staves.find(item => item.id === rebound.staffId);
    const measureValue = staffValue?.measures.find(
      item => item.id === rebound.measureId && item.frameId === rebound.frameId
    );
    const voiceValue = measureValue?.voices.find(item => item.id === rebound.voiceId);
    const value = voiceValue?.events.find(event => event.id === restPlan.restEventId);
    if (
      value === undefined ||
      value.kind !== 'rest' ||
      !sameRational(value.onset, restPlan.proposedOnset) ||
      !sameRational(value.duration, restPlan.proposedDuration)
    ) {
      throw new FourToThreeTupletUnretimingAuthoringV4Error(
        '4:3 unretiming result does not match admitted adjacent-rest shrink plan.',
        'RESULT_INVALID',
        { restEventId: restPlan.restEventId }
      );
    }
  }

  return Object.freeze({ score: nextScore, notation: nextNotation });
};
