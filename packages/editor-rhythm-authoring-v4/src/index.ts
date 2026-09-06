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
import {
  analyzeEventDurationMutationV4,
  type RhythmTimingAdmissionV4
} from '../../editor-rhythm-timing-v4/src/index.js';

export const RHYTHM_AUTHORING_V4_VERSION = '1.0.0' as const;

interface IntentBase {
  readonly version: typeof RHYTHM_AUTHORING_V4_VERSION;
  readonly type: string;
}

export interface SetEventDurationRhythmIntentV4 extends IntentBase {
  readonly type: 'SET_EVENT_DURATION';
  readonly target: EventAddressV3;
  readonly duration: Rational;
}

export interface SetWrittenDurationRhythmIntentV4 extends IntentBase {
  readonly type: 'SET_WRITTEN_DURATION';
  readonly target: EventAddressV3;
  readonly duration: Rational;
  readonly dots: 0 | 1 | 2 | 3;
}

export interface ReplaceEventWithRestDurationRhythmIntentV4 extends IntentBase {
  readonly type: 'REPLACE_EVENT_WITH_REST_DURATION';
  readonly target: EventAddressV3;
  readonly duration: Rational;
  readonly dots: 0 | 1 | 2 | 3;
}

export type RhythmAuthoringIntentV4 =
  | SetEventDurationRhythmIntentV4
  | SetWrittenDurationRhythmIntentV4
  | ReplaceEventWithRestDurationRhythmIntentV4;

export interface RhythmAuthoringV4Options {
  readonly nextRevisionId: string;
}

export type RhythmRestBalanceKindV4 =
  | 'NONE'
  | 'CREATED_RESIDUAL_REST'
  | 'EXTENDED_ADJACENT_REST'
  | 'SHRANK_ADJACENT_REST'
  | 'REMOVED_ADJACENT_REST';

export interface RhythmRestBalanceV4 {
  readonly kind: RhythmRestBalanceKindV4;
  readonly restEventId: string | null;
}

export interface RhythmAuthoringV4Result {
  readonly version: typeof RHYTHM_AUTHORING_V4_VERSION;
  readonly score: Readonly<ScoreDocumentV3>;
  readonly notation: Readonly<NotationDocumentV4>;
  readonly selection: EventAddressV3;
  readonly admission: Readonly<RhythmTimingAdmissionV4>;
  readonly restBalance: Readonly<RhythmRestBalanceV4>;
}

export type RhythmAuthoringV4ErrorCode =
  | 'INVALID_INTENT'
  | 'INVALID_REVISION_ID'
  | 'STALE_TARGET'
  | 'TARGET_PATH_INVALID'
  | 'TIMING_NOT_ADMITTED'
  | 'ADJACENT_REST_NOTATION_COUPLED'
  | 'NOTATION_ORPHAN_RISK'
  | 'CROSS_STAFF_CONFLICT'
  | 'REST_ID_COLLISION'
  | 'RESULT_INVALID';

export class RhythmAuthoringV4Error extends Error {
  readonly code: RhythmAuthoringV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: RhythmAuthoringV4ErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'RhythmAuthoringV4Error';
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
    throw new RhythmAuthoringV4Error('Rhythm arithmetic produced an invalid rational.', 'RESULT_INVALID');
  }
  const divisor = gcd(numerator, denominator);
  const n = numerator / divisor;
  const d = denominator / divisor;
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (n > max || d > max) {
    throw new RhythmAuthoringV4Error('Rhythm arithmetic exceeded safe integer bounds.', 'RESULT_INVALID');
  }
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

const compare = (left: Rational, right: Rational): number => {
  const l = BigInt(left.numerator) * BigInt(right.denominator);
  const r = BigInt(right.numerator) * BigInt(left.denominator);
  return l < r ? -1 : l > r ? 1 : 0;
};

const parseDuration = (value: unknown): Readonly<Rational> => {
  if (
    !exact(value, ['numerator', 'denominator']) ||
    typeof value.numerator !== 'number' ||
    !Number.isSafeInteger(value.numerator) ||
    value.numerator <= 0 ||
    typeof value.denominator !== 'number' ||
    !Number.isSafeInteger(value.denominator) ||
    value.denominator <= 0 ||
    gcd(BigInt(value.numerator), BigInt(value.denominator)) !== 1n
  ) {
    throw new RhythmAuthoringV4Error('Duration must be a reduced positive rational.', 'INVALID_INTENT');
  }
  return Object.freeze({ numerator: value.numerator, denominator: value.denominator });
};

const parseDots = (value: unknown): 0 | 1 | 2 | 3 => {
  if (value !== 0 && value !== 1 && value !== 2 && value !== 3) {
    throw new RhythmAuthoringV4Error('Written dot count must be 0 through 3.', 'INVALID_INTENT');
  }
  return value;
};

const parseIntent = (raw: unknown): Readonly<RhythmAuthoringIntentV4> => {
  if (!isRecord(raw) || raw.version !== RHYTHM_AUTHORING_V4_VERSION || typeof raw.type !== 'string') {
    throw new RhythmAuthoringV4Error('Rhythm authoring intent envelope is invalid.', 'INVALID_INTENT');
  }
  if (raw.type === 'SET_EVENT_DURATION') {
    if (!exact(raw, ['version', 'type', 'target', 'duration'])) {
      throw new RhythmAuthoringV4Error('SET_EVENT_DURATION field set is invalid.', 'INVALID_INTENT');
    }
    return Object.freeze({
      version: RHYTHM_AUTHORING_V4_VERSION,
      type: raw.type,
      target: raw.target as EventAddressV3,
      duration: parseDuration(raw.duration)
    });
  }
  if (raw.type === 'SET_WRITTEN_DURATION' || raw.type === 'REPLACE_EVENT_WITH_REST_DURATION') {
    if (!exact(raw, ['version', 'type', 'target', 'duration', 'dots'])) {
      throw new RhythmAuthoringV4Error(`${raw.type} field set is invalid.`, 'INVALID_INTENT');
    }
    return Object.freeze({
      version: RHYTHM_AUTHORING_V4_VERSION,
      type: raw.type,
      target: raw.target as EventAddressV3,
      duration: parseDuration(raw.duration),
      dots: parseDots(raw.dots)
    });
  }
  throw new RhythmAuthoringV4Error('Unsupported rhythm authoring intent.', 'INVALID_INTENT');
};

const assertRevision = (score: ScoreDocumentV3, nextRevisionId: string): void => {
  if (!ID.test(nextRevisionId) || nextRevisionId === score.revision.id) {
    throw new RhythmAuthoringV4Error('A fresh stable next revision id is required.', 'INVALID_REVISION_ID');
  }
};

const eventEnd = (event: ScoreEvent): Readonly<Rational> => add(event.onset, event.duration);

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
    throw new RhythmAuthoringV4Error('Rhythm result changed semantic target kind.', 'RESULT_INVALID');
  }
  return rebound;
};

const resolveTarget = (score: ScoreDocumentV3, target: EventAddressV3): ScoreEvent => {
  try {
    const resolved = resolveSemanticAddressV3(score, target);
    if (resolved.kind !== 'event') {
      throw new RhythmAuthoringV4Error('Rhythm target is not an event.', 'TARGET_PATH_INVALID');
    }
    return resolved.value;
  } catch (error) {
    if (error instanceof RhythmAuthoringV4Error) throw error;
    throw new RhythmAuthoringV4Error(
      'Rhythm target is stale or belongs to another revision.',
      'STALE_TARGET',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

const voiceEvents = (
  score: ScoreDocumentV3,
  target: EventAddressV3
): readonly ScoreEvent[] => {
  const part = score.parts.find(item => item.id === target.partId);
  const staff = part?.staves.find(item => item.id === target.staffId);
  if (staff === undefined || staff.role === 'tablature-linked') {
    throw new RhythmAuthoringV4Error('Rhythm target staff is invalid.', 'TARGET_PATH_INVALID');
  }
  const measure = staff.measures.find(item => item.id === target.measureId && item.frameId === target.frameId);
  const voice = measure?.voices.find(item => item.id === target.voiceId);
  if (voice === undefined) {
    throw new RhythmAuthoringV4Error('Rhythm target voice is invalid.', 'TARGET_PATH_INVALID');
  }
  return voice.events;
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
  const entry = notation.events.find(item => item.target.eventId === eventId);
  if (entry === undefined) return true;
  const value = entry.notation;
  return value.dots === 0 &&
    value.beams.length === 0 &&
    value.tuplet === null &&
    value.articulations.length === 0 &&
    value.ornaments.length === 0;
};

const hasCrossStaff = (notation: NotationDocumentV4, eventId: string): boolean =>
  notation.crossStaffPlacements.some(item => item.source.eventId === eventId);

const noteIds = (event: ScoreEvent): readonly string[] =>
  event.kind === 'note' ? [event.note.id] : event.kind === 'chord' ? event.notes.map(note => note.id) : [];

const replacementSafe = (notation: NotationDocumentV4, event: ScoreEvent): void => {
  if (event.kind === 'rest') return;
  const ids = noteIds(event);
  if (notation.notes.some(entry => ids.includes(entry.target.noteId))) {
    throw new RhythmAuthoringV4Error(
      'Replacing this pitched event with a rest would orphan note notation.',
      'NOTATION_ORPHAN_RISK',
      { noteIds: ids }
    );
  }
  if (hasCrossStaff(notation, event.id)) {
    throw new RhythmAuthoringV4Error(
      'Cross-staff placement must be removed before replacing its source event with a rest.',
      'CROSS_STAFF_CONFLICT',
      { eventId: event.id }
    );
  }
  const eventNotation = eventNotationFor(notation, event.id);
  if (eventNotation.articulations.length > 0 || eventNotation.ornaments.length > 0) {
    throw new RhythmAuthoringV4Error(
      'Replacing this pitched event with a rest would retain pitched-event notation.',
      'NOTATION_ORPHAN_RISK',
      { eventId: event.id }
    );
  }
};

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
  target: EventAddressV3,
  nextRevisionId: string
): string => {
  const id = `rhythm-rest:${fnv1a64(`${score.id}|${score.revision.id}|${target.eventId}|${nextRevisionId}`)}`;
  if (allIds(score).has(id)) {
    throw new RhythmAuthoringV4Error(
      'Deterministic residual rest identity collides with current canonical identity.',
      'REST_ID_COLLISION',
      { id }
    );
  }
  return id;
};

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
    if (error instanceof RhythmAuthoringV4Error) throw error;
    throw new RhythmAuthoringV4Error(
      'Rhythm result failed notation validation.',
      'RESULT_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

const mutateScore = (
  score: ScoreDocumentV3,
  notation: NotationDocumentV4,
  intent: RhythmAuthoringIntentV4,
  admission: RhythmTimingAdmissionV4,
  nextRevisionId: string
): Readonly<{
  score: Readonly<ScoreDocumentV3>;
  eventMap: ReadonlyMap<string, EventNotationV2>;
  balance: Readonly<RhythmRestBalanceV4>;
}> => {
  const candidate = structuredClone(score) as ScoreDocumentV3;
  const part = candidate.parts.find(item => item.id === intent.target.partId);
  const staff = part?.staves.find(item => item.id === intent.target.staffId);
  if (staff === undefined || staff.role === 'tablature-linked') {
    throw new RhythmAuthoringV4Error('Rhythm target staff disappeared during mutation.', 'TARGET_PATH_INVALID');
  }
  const measure = staff.measures.find(item => item.id === intent.target.measureId && item.frameId === intent.target.frameId);
  const voice = measure?.voices.find(item => item.id === intent.target.voiceId);
  if (voice === undefined) {
    throw new RhythmAuthoringV4Error('Rhythm target voice disappeared during mutation.', 'TARGET_PATH_INVALID');
  }

  const events = [...voice.events] as ScoreEvent[];
  const targetIndex = events.findIndex(item => item.id === intent.target.eventId);
  if (targetIndex < 0) {
    throw new RhythmAuthoringV4Error('Rhythm target event disappeared during mutation.', 'TARGET_PATH_INVALID');
  }
  const current = events[targetIndex]!;
  const nextIndex = admission.nextEventId === null
    ? -1
    : events.findIndex(item => item.id === admission.nextEventId);
  const nextEvent = nextIndex < 0 ? null : events[nextIndex]!;
  const eventMap = new Map(notation.events.map(entry => [entry.target.eventId, entry.notation] as const));

  const replaceWithRest = intent.type === 'REPLACE_EVENT_WITH_REST_DURATION';
  const writeDots = intent.type !== 'SET_EVENT_DURATION';
  const dots = writeDots ? intent.dots : null;

  events[targetIndex] = replaceWithRest
    ? { id: current.id, kind: 'rest', onset: current.onset, duration: intent.duration }
    : { ...current, duration: intent.duration };

  if (writeDots && dots !== null) {
    const currentNotation = eventMap.get(current.id) ?? defaultEventNotation();
    eventMap.set(current.id, { ...currentNotation, dots });
  }

  let balance: Readonly<RhythmRestBalanceV4> = Object.freeze({ kind: 'NONE', restEventId: null });

  if (admission.direction === 'SHRINK') {
    const residualDuration = subtract(admission.currentEnd, admission.requestedEnd);
    const canExtendNextRest = nextEvent?.kind === 'rest' &&
      compare(nextEvent.onset, admission.currentEnd) === 0 &&
      neutralRestNotation(notation, nextEvent.id) &&
      !hasCrossStaff(notation, nextEvent.id);

    if (canExtendNextRest && nextEvent !== null && nextIndex >= 0) {
      const nextEnd = eventEnd(nextEvent);
      events[nextIndex] = {
        ...nextEvent,
        onset: Object.freeze({ ...admission.requestedEnd }),
        duration: subtract(nextEnd, admission.requestedEnd)
      };
      balance = Object.freeze({ kind: 'EXTENDED_ADJACENT_REST', restEventId: nextEvent.id });
    } else {
      const restId = residualRestId(score, intent.target, nextRevisionId);
      const residual: ScoreEvent = {
        id: restId,
        kind: 'rest',
        onset: Object.freeze({ ...admission.requestedEnd }),
        duration: residualDuration
      };
      events.splice(targetIndex + 1, 0, residual);
      balance = Object.freeze({ kind: 'CREATED_RESIDUAL_REST', restEventId: restId });
    }
  } else if (admission.reason === 'ADMITTED_WITH_ADJACENT_REST_CONSUMPTION') {
    if (nextEvent?.kind !== 'rest' || nextIndex < 0 || admission.nextEventEnd === null) {
      throw new RhythmAuthoringV4Error('Admitted adjacent rest is no longer available.', 'RESULT_INVALID');
    }
    if (!neutralRestNotation(notation, nextEvent.id) || hasCrossStaff(notation, nextEvent.id)) {
      throw new RhythmAuthoringV4Error(
        'Adjacent rest carries notation or placement semantics and cannot be consumed implicitly.',
        'ADJACENT_REST_NOTATION_COUPLED',
        { restEventId: nextEvent.id }
      );
    }
    if (compare(admission.requestedEnd, admission.nextEventEnd) === 0) {
      events.splice(nextIndex, 1);
      eventMap.delete(nextEvent.id);
      balance = Object.freeze({ kind: 'REMOVED_ADJACENT_REST', restEventId: nextEvent.id });
    } else {
      events[nextIndex] = {
        ...nextEvent,
        onset: Object.freeze({ ...admission.requestedEnd }),
        duration: subtract(admission.nextEventEnd, admission.requestedEnd)
      };
      balance = Object.freeze({ kind: 'SHRANK_ADJACENT_REST', restEventId: nextEvent.id });
    }
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
    throw new RhythmAuthoringV4Error(
      'Rhythm score candidate failed canonical validation.',
      'RESULT_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  return Object.freeze({ score: nextScore, eventMap, balance });
};

export const executeRhythmAuthoringV4 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  rawIntent: unknown,
  options: RhythmAuthoringV4Options
): Readonly<RhythmAuthoringV4Result> => {
  const score = createScoreDocumentV3(scoreInput);
  const notation = createNotationDocumentV4(score, notationInput);
  const intent = parseIntent(rawIntent);
  assertRevision(score, options.nextRevisionId);
  const current = resolveTarget(score, intent.target);

  if (intent.type === 'REPLACE_EVENT_WITH_REST_DURATION') replacementSafe(notation, current);

  const admission = analyzeEventDurationMutationV4(
    score,
    notation,
    intent.target,
    intent.duration,
    {
      allowDotRewrite: intent.type !== 'SET_EVENT_DURATION',
      allowAdjacentRestConsumption: true
    }
  );

  if (!admission.admitted) {
    throw new RhythmAuthoringV4Error(
      admission.reason === 'NO_OP'
        ? 'Rhythm authoring request is a no-op.'
        : 'Rhythm authoring request was not admitted by timing analysis.',
      'TIMING_NOT_ADMITTED',
      {
        reason: admission.reason,
        couplingReasons: admission.couplingReasons,
        eventId: intent.target.eventId
      }
    );
  }

  const mutated = mutateScore(score, notation, intent, admission, options.nextRevisionId);
  const nextNotation = buildNotation(mutated.score, notation, mutated.eventMap);
  const selection = addressEntityV3(mutated.score, intent.target.eventId);
  if (selection.kind !== 'event') {
    throw new RhythmAuthoringV4Error('Rhythm result selection changed kind.', 'RESULT_INVALID');
  }

  const post = analyzeEventDurationMutationV4(
    mutated.score,
    nextNotation,
    selection,
    intent.duration,
    { allowDotRewrite: true, allowAdjacentRestConsumption: true }
  );
  if (post.reason === 'BLOCKED_EXISTING_TIMING_INVALID') {
    throw new RhythmAuthoringV4Error(
      'Rhythm result failed post-mutation occupancy validation.',
      'RESULT_INVALID'
    );
  }

  return Object.freeze({
    version: RHYTHM_AUTHORING_V4_VERSION,
    score: mutated.score,
    notation: nextNotation,
    selection,
    admission,
    restBalance: mutated.balance
  });
};