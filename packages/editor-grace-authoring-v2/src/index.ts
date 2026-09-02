import {
  createScoreDocumentV2,
  type GraceEvent,
  type GraceGroup,
  type Pitch,
  type Rational,
  type ScoreDocumentV2
} from '../../score-model-v2/src/index.js';
import {
  resolveSemanticAddressV2,
  type EventAddressV2,
  type GraceEventAddressV2,
  type GraceGroupAddressV2,
  type GraceNoteAddressV2,
  type SemanticAddressV2
} from '../../addressing-v2/src/index.js';
import { createNotationDocumentV2, type NotationDocumentV2 } from '../../notation-structure-v2/src/index.js';
import { rebindNotationAfterScoreEditV2 } from '../../editor-history-v2/src/index.js';

export const GRACE_AUTHORING_V2_VERSION = '1.0.0' as const;

export interface GraceAuthoringIdentityV2 {
  readonly nextRevisionId: string;
}

export type GraceAuthoringIntentV2 =
  | {
      readonly version: typeof GRACE_AUTHORING_V2_VERSION;
      readonly type: 'CREATE_GRACE_GROUP';
      readonly target: EventAddressV2;
      readonly placement: 'before' | 'after';
      readonly groupId: string;
      readonly firstEvent: GraceEvent;
    }
  | {
      readonly version: typeof GRACE_AUTHORING_V2_VERSION;
      readonly type: 'REMOVE_GRACE_GROUP';
      readonly target: GraceGroupAddressV2;
    }
  | {
      readonly version: typeof GRACE_AUTHORING_V2_VERSION;
      readonly type: 'ADD_GRACE_EVENT';
      readonly target: GraceGroupAddressV2;
      readonly index: number;
      readonly event: GraceEvent;
    }
  | {
      readonly version: typeof GRACE_AUTHORING_V2_VERSION;
      readonly type: 'REMOVE_GRACE_EVENT';
      readonly target: GraceEventAddressV2;
    }
  | {
      readonly version: typeof GRACE_AUTHORING_V2_VERSION;
      readonly type: 'MOVE_GRACE_EVENT';
      readonly target: GraceEventAddressV2;
      readonly toIndex: number;
    }
  | {
      readonly version: typeof GRACE_AUTHORING_V2_VERSION;
      readonly type: 'REPLACE_GRACE_EVENT';
      readonly target: GraceEventAddressV2;
      readonly replacement: GraceEvent;
    }
  | {
      readonly version: typeof GRACE_AUTHORING_V2_VERSION;
      readonly type: 'SET_GRACE_NOTE_PITCH';
      readonly target: GraceNoteAddressV2;
      readonly pitch: Pitch;
    };

export interface GraceAuthoringResultV2 {
  readonly score: Readonly<ScoreDocumentV2>;
  readonly notation: Readonly<NotationDocumentV2>;
  readonly selectionEntityId: string;
}

export type GraceAuthoringV2ErrorCode =
  | 'INVALID_INTENT'
  | 'STALE_TARGET'
  | 'INVALID_REVISION_ID'
  | 'GROUP_ALREADY_EXISTS'
  | 'INDEX_OUT_OF_RANGE'
  | 'EMPTY_GROUP_FORBIDDEN'
  | 'REPLACEMENT_ID_MISMATCH'
  | 'EDIT_REJECTED'
  | 'NOTATION_ORPHAN_RISK';

export class GraceAuthoringV2Error extends Error {
  readonly code: GraceAuthoringV2ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, code: GraceAuthoringV2ErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'GraceAuthoringV2Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const clone = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map((item) => clone(item)) as T;
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)])) as T;
  }
  return value;
};

const assertIdentity = (score: ScoreDocumentV2, identity: GraceAuthoringIdentityV2): void => {
  if (
    !isRecord(identity) ||
    JSON.stringify(Object.keys(identity).sort()) !== JSON.stringify(['nextRevisionId']) ||
    typeof identity.nextRevisionId !== 'string' ||
    !ID_PATTERN.test(identity.nextRevisionId) ||
    identity.nextRevisionId === score.revision.id
  ) {
    throw new GraceAuthoringV2Error(
      'Grace authoring requires one fresh stable next revision identity.',
      'INVALID_REVISION_ID'
    );
  }
};

const assertIntentVersion = (intent: GraceAuthoringIntentV2): void => {
  if (intent.version !== GRACE_AUTHORING_V2_VERSION) {
    throw new GraceAuthoringV2Error('Grace authoring intent version is unsupported.', 'INVALID_INTENT');
  }
};

const resolvedTarget = (score: ScoreDocumentV2, target: SemanticAddressV2) => {
  try {
    return resolveSemanticAddressV2(score, target);
  } catch (error) {
    throw new GraceAuthoringV2Error(
      'Grace authoring target is stale, invalid or belongs to another score revision.',
      'STALE_TARGET',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

interface MutableVoicePath {
  readonly voice: {
    events: Array<Record<string, unknown>>;
    graceGroups: Array<Record<string, unknown>>;
  };
}

const mutableVoice = (
  raw: Record<string, unknown>,
  target: EventAddressV2 | GraceGroupAddressV2 | GraceEventAddressV2 | GraceNoteAddressV2
): MutableVoicePath['voice'] => {
  const parts = raw.parts as Array<Record<string, unknown>>;
  const part = parts.find((item) => item.id === target.partId);
  const staff = (part?.staves as Array<Record<string, unknown>> | undefined)?.find((item) => item.id === target.staffId);
  const measure = (staff?.measures as Array<Record<string, unknown>> | undefined)?.find((item) => item.id === target.measureId);
  const voice = (measure?.voices as Array<Record<string, unknown>> | undefined)?.find((item) => item.id === target.voiceId);
  if (!voice || !Array.isArray(voice.events) || !Array.isArray(voice.graceGroups)) {
    throw new GraceAuthoringV2Error('Resolved target ancestry could not be located in mutable candidate.', 'EDIT_REJECTED');
  }
  return voice as MutableVoicePath['voice'];
};

const groupFor = (voice: MutableVoicePath['voice'], groupId: string): Record<string, unknown> => {
  const group = voice.graceGroups.find((item) => item.id === groupId);
  if (!group || !Array.isArray(group.events)) {
    throw new GraceAuthoringV2Error('Grace group disappeared from the mutable candidate.', 'EDIT_REJECTED', { groupId });
  }
  return group;
};

const eventFor = (group: Record<string, unknown>, eventId: string): { event: Record<string, unknown>; index: number } => {
  const events = group.events as Array<Record<string, unknown>>;
  const index = events.findIndex((item) => item.id === eventId);
  if (index < 0) {
    throw new GraceAuthoringV2Error('Grace event disappeared from the mutable candidate.', 'EDIT_REJECTED', { eventId });
  }
  return { event: events[index]!, index };
};

const normalOccupancyFingerprint = (score: ScoreDocumentV2): string =>
  JSON.stringify(
    score.parts.map((part) => part.staves.map((staff) => staff.measures.map((measure) =>
      measure.voices.map((voice) => voice.events.map((event) => ({
        id: event.id,
        kind: event.kind,
        onset: event.onset,
        duration: event.duration
      })))
    )))
  );

const withNextRevision = (raw: Record<string, unknown>, score: ScoreDocumentV2, nextRevisionId: string): void => {
  raw.revision = { id: nextRevisionId, parentId: score.revision.id };
};

const candidateForIntent = (
  score: ScoreDocumentV2,
  intent: GraceAuthoringIntentV2,
  nextRevisionId: string
): { readonly raw: Record<string, unknown>; readonly selectionEntityId: string } => {
  assertIntentVersion(intent);
  const raw = clone(score) as unknown as Record<string, unknown>;
  withNextRevision(raw, score, nextRevisionId);

  if (intent.type === 'CREATE_GRACE_GROUP') {
    const resolved = resolvedTarget(score, intent.target);
    if (resolved.kind !== 'event') throw new GraceAuthoringV2Error('Grace group anchor must target a normal event.', 'INVALID_INTENT');
    const voice = mutableVoice(raw, intent.target);
    if (voice.graceGroups.some((group) => group.anchorEventId === intent.target.eventId && group.placement === intent.placement)) {
      throw new GraceAuthoringV2Error('The target event already has a grace group at this placement.', 'GROUP_ALREADY_EXISTS');
    }
    voice.graceGroups.push({
      id: intent.groupId,
      anchorEventId: intent.target.eventId,
      placement: intent.placement,
      events: [clone(intent.firstEvent)]
    });
    return { raw, selectionEntityId: intent.groupId };
  }

  if (intent.type === 'REMOVE_GRACE_GROUP') {
    const resolved = resolvedTarget(score, intent.target);
    if (resolved.kind !== 'grace-group') throw new GraceAuthoringV2Error('Grace group removal requires a grace-group target.', 'INVALID_INTENT');
    const voice = mutableVoice(raw, intent.target);
    const index = voice.graceGroups.findIndex((group) => group.id === intent.target.graceGroupId);
    if (index < 0) throw new GraceAuthoringV2Error('Grace group target disappeared.', 'EDIT_REJECTED');
    voice.graceGroups.splice(index, 1);
    return { raw, selectionEntityId: resolved.value.anchorEventId };
  }

  if (intent.type === 'ADD_GRACE_EVENT') {
    const resolved = resolvedTarget(score, intent.target);
    if (resolved.kind !== 'grace-group') throw new GraceAuthoringV2Error('Adding a grace event requires a grace-group target.', 'INVALID_INTENT');
    const group = groupFor(mutableVoice(raw, intent.target), intent.target.graceGroupId);
    const events = group.events as Array<Record<string, unknown>>;
    if (!Number.isSafeInteger(intent.index) || intent.index < 0 || intent.index > events.length) {
      throw new GraceAuthoringV2Error('Grace event insertion index is outside the group bounds.', 'INDEX_OUT_OF_RANGE', { index: intent.index });
    }
    events.splice(intent.index, 0, clone(intent.event) as unknown as Record<string, unknown>);
    return { raw, selectionEntityId: intent.event.id };
  }

  if (intent.type === 'REMOVE_GRACE_EVENT') {
    const resolved = resolvedTarget(score, intent.target);
    if (resolved.kind !== 'grace-event') throw new GraceAuthoringV2Error('Removing a grace event requires a grace-event target.', 'INVALID_INTENT');
    const group = groupFor(mutableVoice(raw, intent.target), intent.target.graceGroupId);
    const events = group.events as Array<Record<string, unknown>>;
    if (events.length === 1) {
      throw new GraceAuthoringV2Error('The final grace event cannot be removed without removing its group.', 'EMPTY_GROUP_FORBIDDEN');
    }
    const located = eventFor(group, intent.target.graceEventId);
    events.splice(located.index, 1);
    return { raw, selectionEntityId: intent.target.graceGroupId };
  }

  if (intent.type === 'MOVE_GRACE_EVENT') {
    const resolved = resolvedTarget(score, intent.target);
    if (resolved.kind !== 'grace-event') throw new GraceAuthoringV2Error('Moving a grace event requires a grace-event target.', 'INVALID_INTENT');
    const group = groupFor(mutableVoice(raw, intent.target), intent.target.graceGroupId);
    const events = group.events as Array<Record<string, unknown>>;
    if (!Number.isSafeInteger(intent.toIndex) || intent.toIndex < 0 || intent.toIndex >= events.length) {
      throw new GraceAuthoringV2Error('Grace event destination index is outside the group bounds.', 'INDEX_OUT_OF_RANGE', { toIndex: intent.toIndex });
    }
    const located = eventFor(group, intent.target.graceEventId);
    const [event] = events.splice(located.index, 1);
    events.splice(intent.toIndex, 0, event!);
    return { raw, selectionEntityId: intent.target.graceEventId };
  }

  if (intent.type === 'REPLACE_GRACE_EVENT') {
    const resolved = resolvedTarget(score, intent.target);
    if (resolved.kind !== 'grace-event') throw new GraceAuthoringV2Error('Replacing a grace event requires a grace-event target.', 'INVALID_INTENT');
    if (intent.replacement.id !== intent.target.graceEventId) {
      throw new GraceAuthoringV2Error('Grace event replacement must preserve the event identity.', 'REPLACEMENT_ID_MISMATCH');
    }
    const group = groupFor(mutableVoice(raw, intent.target), intent.target.graceGroupId);
    const located = eventFor(group, intent.target.graceEventId);
    (group.events as Array<Record<string, unknown>>)[located.index] = clone(intent.replacement) as unknown as Record<string, unknown>;
    return { raw, selectionEntityId: intent.target.graceEventId };
  }

  const resolved = resolvedTarget(score, intent.target);
  if (resolved.kind !== 'grace-note') throw new GraceAuthoringV2Error('Grace pitch edit requires a grace-note target.', 'INVALID_INTENT');
  const group = groupFor(mutableVoice(raw, intent.target), intent.target.graceGroupId);
  const located = eventFor(group, intent.target.graceEventId);
  const event = located.event;
  if (event.kind === 'note') {
    const note = event.note as Record<string, unknown>;
    if (note.id !== intent.target.graceNoteId) throw new GraceAuthoringV2Error('Grace note ancestry changed unexpectedly.', 'EDIT_REJECTED');
    note.pitch = clone(intent.pitch);
  } else if (event.kind === 'chord') {
    const notes = event.notes as Array<Record<string, unknown>>;
    const note = notes.find((item) => item.id === intent.target.graceNoteId);
    if (!note) throw new GraceAuthoringV2Error('Grace chord note target disappeared.', 'EDIT_REJECTED');
    note.pitch = clone(intent.pitch);
  } else {
    throw new GraceAuthoringV2Error('Rest grace events do not contain a pitch target.', 'INVALID_INTENT');
  }
  return { raw, selectionEntityId: intent.target.graceNoteId };
};

export const executeGraceAuthoringV2 = (
  scoreInput: ScoreDocumentV2,
  notationInput: NotationDocumentV2,
  intent: GraceAuthoringIntentV2,
  identity: GraceAuthoringIdentityV2
): Readonly<GraceAuthoringResultV2> => {
  const score = createScoreDocumentV2(scoreInput);
  const notation = createNotationDocumentV2(score, notationInput);
  assertIdentity(score, identity);
  const beforeOccupancy = normalOccupancyFingerprint(score);

  let candidate: Readonly<ScoreDocumentV2>;
  let selectionEntityId: string;
  try {
    const built = candidateForIntent(score, intent, identity.nextRevisionId);
    selectionEntityId = built.selectionEntityId;
    candidate = createScoreDocumentV2(built.raw);
  } catch (error) {
    if (error instanceof GraceAuthoringV2Error) throw error;
    throw new GraceAuthoringV2Error('Grace authoring candidate failed canonical v2 validation.', 'EDIT_REJECTED', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  if (normalOccupancyFingerprint(candidate) !== beforeOccupancy) {
    throw new GraceAuthoringV2Error('Grace authoring may not mutate normal timed measure occupancy.', 'EDIT_REJECTED');
  }

  let nextNotation: Readonly<NotationDocumentV2>;
  try {
    nextNotation = rebindNotationAfterScoreEditV2(score, notation, candidate);
  } catch (error) {
    throw new GraceAuthoringV2Error(
      'Grace authoring would orphan or invalidate existing notation targets.',
      'NOTATION_ORPHAN_RISK',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }

  return Object.freeze({ score: candidate, notation: nextNotation, selectionEntityId });
};
