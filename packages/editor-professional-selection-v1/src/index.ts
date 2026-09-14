import {
  createSemanticAddressIndexV3,
  resolveSemanticAddressV3,
  type EventAddressV3
} from '../../addressing-v3/src/index.js';
import { createScoreDocumentV3, type ScoreDocumentV3 } from '../../score-model-v3/src/index.js';

export const EDITOR_PROFESSIONAL_SELECTION_V1_VERSION = '1.0.0' as const;

export interface ProfessionalSelectionScopeV1 {
  readonly partId: string;
  readonly staffId: string;
  readonly voiceOrdinal: number;
}

export interface EventSpanProfessionalSelectionV1 {
  readonly version: typeof EDITOR_PROFESSIONAL_SELECTION_V1_VERSION;
  readonly kind: 'EVENT_SPAN';
  readonly anchor: EventAddressV3;
  readonly focus: EventAddressV3;
  readonly direction: 'FORWARD' | 'BACKWARD';
  readonly scope: Readonly<ProfessionalSelectionScopeV1>;
  readonly targets: readonly EventAddressV3[];
}

export interface EventSetProfessionalSelectionV1 {
  readonly version: typeof EDITOR_PROFESSIONAL_SELECTION_V1_VERSION;
  readonly kind: 'EVENT_SET';
  readonly primary: EventAddressV3;
  readonly scope: Readonly<ProfessionalSelectionScopeV1>;
  readonly targets: readonly EventAddressV3[];
}

export type ProfessionalSelectionV1 =
  | EventSpanProfessionalSelectionV1
  | EventSetProfessionalSelectionV1;

export type ProfessionalSelectionV1ErrorCode =
  | 'STALE_SELECTION'
  | 'DUPLICATE_TARGET'
  | 'SELECTION_SCOPE_MISMATCH'
  | 'SELECTION_CARDINALITY_UNSUPPORTED'
  | 'TARGET_NOT_IN_LOGICAL_VOICE';

export class ProfessionalSelectionV1Error extends Error {
  readonly code: ProfessionalSelectionV1ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: ProfessionalSelectionV1ErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ProfessionalSelectionV1Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const frozenEventAddress = (address: EventAddressV3): EventAddressV3 =>
  Object.freeze({ ...address });

const validatedEventAddress = (
  score: ScoreDocumentV3,
  address: EventAddressV3
): EventAddressV3 => {
  try {
    const resolved = resolveSemanticAddressV3(score, address);
    if (resolved.kind !== 'event') throw new Error('Address did not resolve to an event.');
  } catch (error) {
    throw new ProfessionalSelectionV1Error(
      'Professional selection contains a stale or invalid event address.',
      'STALE_SELECTION',
      { eventId: address.eventId, cause: error instanceof Error ? error.message : String(error) }
    );
  }
  return frozenEventAddress(address);
};

const contentStaff = (score: ScoreDocumentV3, address: EventAddressV3) => {
  const part = score.parts.find(candidate => candidate.id === address.partId);
  const staff = part?.staves.find(candidate => candidate.id === address.staffId);
  if (part === undefined || staff === undefined || staff.role === 'tablature-linked') {
    throw new ProfessionalSelectionV1Error(
      'Professional selection requires one canonical content staff.',
      'SELECTION_SCOPE_MISMATCH',
      { partId: address.partId, staffId: address.staffId }
    );
  }
  return staff;
};

const eventVoiceOrdinal = (score: ScoreDocumentV3, address: EventAddressV3): number => {
  try {
    const index = createSemanticAddressIndexV3(score);
    const voiceAddress = index.byEntityId.get(address.voiceId);
    if (voiceAddress?.kind !== 'voice') throw new Error('Event voice address is unavailable.');
    const resolved = resolveSemanticAddressV3(score, voiceAddress);
    if (resolved.kind !== 'voice') throw new Error('Event voice did not resolve.');
    return resolved.value.ordinal;
  } catch (error) {
    throw new ProfessionalSelectionV1Error(
      'Professional selection event voice cannot be resolved.',
      'STALE_SELECTION',
      { eventId: address.eventId, voiceId: address.voiceId, cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

const logicalEventAddresses = (
  score: ScoreDocumentV3,
  reference: EventAddressV3,
  voiceOrdinal: number
): readonly EventAddressV3[] => {
  const staff = contentStaff(score, reference);
  const index = createSemanticAddressIndexV3(score);
  const result: EventAddressV3[] = [];

  for (const measure of staff.measures) {
    const voice = measure.voices.find(candidate => candidate.ordinal === voiceOrdinal);
    if (voice === undefined) continue;
    for (const event of voice.events) {
      const address = index.byEntityId.get(event.id);
      if (address?.kind !== 'event') {
        throw new ProfessionalSelectionV1Error(
          'Canonical event is missing a deterministic event address.',
          'STALE_SELECTION',
          { eventId: event.id }
        );
      }
      result.push(frozenEventAddress(address));
    }
  }
  return Object.freeze(result);
};

const sameSourceStaff = (left: EventAddressV3, right: EventAddressV3): boolean =>
  left.partId === right.partId && left.staffId === right.staffId;

const frozenScope = (
  address: EventAddressV3,
  voiceOrdinal: number
): Readonly<ProfessionalSelectionScopeV1> => Object.freeze({
  partId: address.partId,
  staffId: address.staffId,
  voiceOrdinal
});

export const createEventSpanProfessionalSelectionV1 = (
  scoreInput: ScoreDocumentV3,
  anchorInput: EventAddressV3,
  focusInput: EventAddressV3
): Readonly<EventSpanProfessionalSelectionV1> => {
  const score = createScoreDocumentV3(scoreInput);
  const anchor = validatedEventAddress(score, anchorInput);
  const focus = validatedEventAddress(score, focusInput);

  if (anchor.eventId === focus.eventId) {
    throw new ProfessionalSelectionV1Error(
      'Professional event span requires two distinct endpoints.',
      'SELECTION_CARDINALITY_UNSUPPORTED',
      { eventId: anchor.eventId }
    );
  }
  if (!sameSourceStaff(anchor, focus)) {
    throw new ProfessionalSelectionV1Error(
      'Professional event span endpoints must remain in one source part/staff.',
      'SELECTION_SCOPE_MISMATCH',
      {
        anchorPartId: anchor.partId,
        anchorStaffId: anchor.staffId,
        focusPartId: focus.partId,
        focusStaffId: focus.staffId
      }
    );
  }

  const anchorOrdinal = eventVoiceOrdinal(score, anchor);
  const focusOrdinal = eventVoiceOrdinal(score, focus);
  if (anchorOrdinal !== focusOrdinal) {
    throw new ProfessionalSelectionV1Error(
      'Professional event span endpoints must use the same logical Voice ordinal.',
      'SELECTION_SCOPE_MISMATCH',
      { anchorOrdinal, focusOrdinal }
    );
  }

  const logical = logicalEventAddresses(score, anchor, anchorOrdinal);
  const anchorIndex = logical.findIndex(candidate => candidate.eventId === anchor.eventId);
  const focusIndex = logical.findIndex(candidate => candidate.eventId === focus.eventId);
  if (anchorIndex < 0 || focusIndex < 0) {
    throw new ProfessionalSelectionV1Error(
      'Professional event span endpoint is outside the resolved logical Voice.',
      'TARGET_NOT_IN_LOGICAL_VOICE',
      { anchorIndex, focusIndex }
    );
  }

  const startIndex = Math.min(anchorIndex, focusIndex);
  const stopIndex = Math.max(anchorIndex, focusIndex);
  const targets = Object.freeze(logical.slice(startIndex, stopIndex + 1));

  return Object.freeze({
    version: EDITOR_PROFESSIONAL_SELECTION_V1_VERSION,
    kind: 'EVENT_SPAN',
    anchor,
    focus,
    direction: focusIndex >= anchorIndex ? 'FORWARD' : 'BACKWARD',
    scope: frozenScope(anchor, anchorOrdinal),
    targets
  });
};

export const createEventSetProfessionalSelectionV1 = (
  scoreInput: ScoreDocumentV3,
  targetInputs: readonly EventAddressV3[]
): Readonly<EventSetProfessionalSelectionV1> => {
  const score = createScoreDocumentV3(scoreInput);
  if (targetInputs.length < 2) {
    throw new ProfessionalSelectionV1Error(
      'Professional event set requires at least two exact events.',
      'SELECTION_CARDINALITY_UNSUPPORTED',
      { cardinality: targetInputs.length }
    );
  }

  const targetsInput = targetInputs.map(target => validatedEventAddress(score, target));
  const eventIds = targetsInput.map(target => target.eventId);
  if (new Set(eventIds).size !== eventIds.length) {
    throw new ProfessionalSelectionV1Error(
      'Professional event set contains duplicate events.',
      'DUPLICATE_TARGET',
      { eventIds }
    );
  }

  const primary = targetsInput[0]!;
  if (!targetsInput.every(target => sameSourceStaff(primary, target))) {
    throw new ProfessionalSelectionV1Error(
      'Professional event set must remain in one source part/staff.',
      'SELECTION_SCOPE_MISMATCH'
    );
  }

  const primaryOrdinal = eventVoiceOrdinal(score, primary);
  const ordinals = targetsInput.map(target => eventVoiceOrdinal(score, target));
  if (!ordinals.every(ordinal => ordinal === primaryOrdinal)) {
    throw new ProfessionalSelectionV1Error(
      'Professional event set must remain in one logical Voice ordinal.',
      'SELECTION_SCOPE_MISMATCH',
      { ordinals }
    );
  }

  const logical = logicalEventAddresses(score, primary, primaryOrdinal);
  const logicalIndex = new Map(logical.map((target, index) => [target.eventId, index] as const));
  const missing = targetsInput.filter(target => !logicalIndex.has(target.eventId));
  if (missing.length > 0) {
    throw new ProfessionalSelectionV1Error(
      'Professional event-set target is outside the resolved logical Voice.',
      'TARGET_NOT_IN_LOGICAL_VOICE',
      { eventIds: missing.map(target => target.eventId) }
    );
  }

  const targets = Object.freeze([...targetsInput].sort((left, right) =>
    logicalIndex.get(left.eventId)! - logicalIndex.get(right.eventId)!
  ));

  return Object.freeze({
    version: EDITOR_PROFESSIONAL_SELECTION_V1_VERSION,
    kind: 'EVENT_SET',
    primary,
    scope: frozenScope(primary, primaryOrdinal),
    targets
  });
};

export const professionalSelectionActiveTargetV1 = (
  selection: ProfessionalSelectionV1
): EventAddressV3 => selection.kind === 'EVENT_SPAN' ? selection.focus : selection.primary;

export const professionalSelectionTargetsV1 = (
  selection: ProfessionalSelectionV1
): readonly EventAddressV3[] => selection.targets;
