import {
  createScoreDocumentV2,
  type ScoreDocumentV2,
  type ScoreEvent
} from '../../score-model-v2/src/index.js';
import {
  addressEntityV2,
  resolveSemanticAddressV2,
  type EventAddressV2,
  type GraceEventAddressV2
} from '../../addressing-v2/src/index.js';
import {
  createNotationDocumentV2,
  type EventNotationV2,
  type GraceEventNotationV2,
  type NotationDocumentV2,
  type OrnamentSpec,
  type PlacementV2,
  type SimpleOrnamentSpec,
  type TremoloOrnamentSpec
} from '../../notation-structure-v2/src/index.js';

export const ORNAMENT_AUTHORING_V2_VERSION = '1.0.0' as const;

export type LocalOrnamentSpecV2 =
  | SimpleOrnamentSpec
  | (Omit<TremoloOrnamentSpec, 'type' | 'number'> & { readonly type: 'single'; readonly number: null });

export type OrnamentTargetV2 = EventAddressV2 | GraceEventAddressV2;
export interface OrnamentAuthoringIdentityV2 { readonly nextRevisionId: string }

export type OrnamentAuthoringIntentV2 =
  | { readonly version: typeof ORNAMENT_AUTHORING_V2_VERSION; readonly type: 'ADD_LOCAL_ORNAMENT'; readonly target: OrnamentTargetV2; readonly value: LocalOrnamentSpecV2 }
  | { readonly version: typeof ORNAMENT_AUTHORING_V2_VERSION; readonly type: 'TOGGLE_LOCAL_ORNAMENT'; readonly target: OrnamentTargetV2; readonly value: LocalOrnamentSpecV2 }
  | { readonly version: typeof ORNAMENT_AUTHORING_V2_VERSION; readonly type: 'REMOVE_LOCAL_ORNAMENT'; readonly target: OrnamentTargetV2; readonly value: LocalOrnamentSpecV2 }
  | { readonly version: typeof ORNAMENT_AUTHORING_V2_VERSION; readonly type: 'CREATE_TREMOLO_RELATION'; readonly start: EventAddressV2; readonly stop: EventAddressV2; readonly number: number; readonly marks: number; readonly placement: PlacementV2 }
  | { readonly version: typeof ORNAMENT_AUTHORING_V2_VERSION; readonly type: 'REMOVE_TREMOLO_RELATION'; readonly start: EventAddressV2; readonly stop: EventAddressV2; readonly number: number }
  | { readonly version: typeof ORNAMENT_AUTHORING_V2_VERSION; readonly type: 'CREATE_WAVY_LINE_RELATION'; readonly targets: readonly EventAddressV2[]; readonly number: number; readonly placement: PlacementV2 }
  | { readonly version: typeof ORNAMENT_AUTHORING_V2_VERSION; readonly type: 'REMOVE_WAVY_LINE_RELATION'; readonly targets: readonly EventAddressV2[]; readonly number: number };

export interface OrnamentAuthoringResultV2 {
  readonly score: Readonly<ScoreDocumentV2>;
  readonly notation: Readonly<NotationDocumentV2>;
  readonly selectionEntityId: string;
}

export type OrnamentAuthoringV2ErrorCode =
  | 'INVALID_INTENT'
  | 'STALE_TARGET'
  | 'INVALID_REVISION_ID'
  | 'INVALID_LOCAL_ORNAMENT'
  | 'DUPLICATE_ORNAMENT'
  | 'RELATION_SCOPE_UNSUPPORTED'
  | 'RELATION_NUMBER_IN_USE'
  | 'RELATION_NOT_FOUND'
  | 'INVALID_RELATION_ORDER'
  | 'RELATION_ENDPOINT_NOT_PITCHED'
  | 'RESULT_INVALID';

export class OrnamentAuthoringV2Error extends Error {
  readonly code: OrnamentAuthoringV2ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: OrnamentAuthoringV2ErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'OrnamentAuthoringV2Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value: unknown, fields: readonly string[]): value is Record<string, unknown> =>
  isRecord(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...fields].sort());
const same = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);
const validRelationNumber = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= 16;
const validMarks = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= 8;
const validPlacement = (value: unknown): value is PlacementV2 => value === 'auto' || value === 'above' || value === 'below';

const parseIntent = (raw: unknown): OrnamentAuthoringIntentV2 => {
  if (!isRecord(raw) || raw.version !== ORNAMENT_AUTHORING_V2_VERSION || typeof raw.type !== 'string') {
    throw new OrnamentAuthoringV2Error('Ornament intent envelope is invalid.', 'INVALID_INTENT');
  }
  const fields: Readonly<Record<OrnamentAuthoringIntentV2['type'], readonly string[]>> = {
    ADD_LOCAL_ORNAMENT: ['version', 'type', 'target', 'value'],
    TOGGLE_LOCAL_ORNAMENT: ['version', 'type', 'target', 'value'],
    REMOVE_LOCAL_ORNAMENT: ['version', 'type', 'target', 'value'],
    CREATE_TREMOLO_RELATION: ['version', 'type', 'start', 'stop', 'number', 'marks', 'placement'],
    REMOVE_TREMOLO_RELATION: ['version', 'type', 'start', 'stop', 'number'],
    CREATE_WAVY_LINE_RELATION: ['version', 'type', 'targets', 'number', 'placement'],
    REMOVE_WAVY_LINE_RELATION: ['version', 'type', 'targets', 'number']
  };
  if (!(raw.type in fields) || !exact(raw, fields[raw.type as OrnamentAuthoringIntentV2['type']])) {
    throw new OrnamentAuthoringV2Error('Ornament intent field set is invalid.', 'INVALID_INTENT');
  }
  return raw as unknown as OrnamentAuthoringIntentV2;
};

const assertIdentity = (score: ScoreDocumentV2, identity: OrnamentAuthoringIdentityV2): void => {
  if (!exact(identity, ['nextRevisionId']) || typeof identity.nextRevisionId !== 'string' || !ID_PATTERN.test(identity.nextRevisionId) || identity.nextRevisionId === score.revision.id) {
    throw new OrnamentAuthoringV2Error('A fresh stable next revision id is required.', 'INVALID_REVISION_ID');
  }
};

const isLocal = (value: unknown): value is LocalOrnamentSpecV2 => {
  if (!isRecord(value) || typeof value.kind !== 'string') return false;
  if (value.kind === 'wavy-line') return false;
  if (value.kind === 'tremolo') return value.type === 'single' && value.number === null;
  return true;
};

const assertLocalValue = (value: unknown): asserts value is LocalOrnamentSpecV2 => {
  if (!isLocal(value)) throw new OrnamentAuthoringV2Error('Local ornament operation accepts only simple ornaments or single-note tremolo.', 'INVALID_LOCAL_ORNAMENT');
};

const resolveLocalTarget = (score: ScoreDocumentV2, target: OrnamentTargetV2): void => {
  try {
    const resolved = resolveSemanticAddressV2(score, target);
    if (resolved.kind !== 'event' && resolved.kind !== 'grace-event') throw new Error(`observed ${resolved.kind}`);
  } catch (error) {
    throw new OrnamentAuthoringV2Error('Ornament target is stale or invalid.', 'STALE_TARGET', { cause: error instanceof Error ? error.message : String(error) });
  }
};

const normalEvent = (score: ScoreDocumentV2, target: EventAddressV2): ScoreEvent => {
  try {
    const resolved = resolveSemanticAddressV2(score, target);
    if (resolved.kind !== 'event') throw new Error(`observed ${resolved.kind}`);
    return resolved.value;
  } catch (error) {
    throw new OrnamentAuthoringV2Error('Relation endpoint is stale or invalid.', 'STALE_TARGET', { cause: error instanceof Error ? error.message : String(error) });
  }
};

const defaultEvent = (): EventNotationV2 => ({ dots: 0, beams: [], tuplet: null, articulations: [], ornaments: [] });
const defaultGraceEvent = (): GraceEventNotationV2 => ({ slash: false, dots: 0, beams: [], articulations: [], ornaments: [] });
const isSpanning = (ornament: OrnamentSpec): boolean => ornament.kind === 'wavy-line' || (ornament.kind === 'tremolo' && ornament.type !== 'single');

const sameVoiceScope = (targets: readonly EventAddressV2[]): boolean => targets.length > 0 && targets.every((target) =>
  target.partId === targets[0]?.partId &&
  target.staffId === targets[0]?.staffId &&
  target.measureId === targets[0]?.measureId &&
  target.voiceId === targets[0]?.voiceId
);

const orderedIndices = (score: ScoreDocumentV2, targets: readonly EventAddressV2[]): readonly number[] => {
  if (targets.length < 2 || targets.length > 32 || !sameVoiceScope(targets)) {
    throw new OrnamentAuthoringV2Error('Spanning ornament targets must contain 2..32 normal events in one exact measure/voice.', 'RELATION_SCOPE_UNSUPPORTED');
  }
  const first = targets[0];
  if (first === undefined) throw new OrnamentAuthoringV2Error('Relation target list is empty.', 'RELATION_SCOPE_UNSUPPORTED');
  const part = score.parts.find((item) => item.id === first.partId);
  const staff = part?.staves.find((item) => item.id === first.staffId);
  const measure = staff?.measures.find((item) => item.id === first.measureId);
  const voice = measure?.voices.find((item) => item.id === first.voiceId);
  if (voice === undefined) throw new OrnamentAuthoringV2Error('Relation voice scope no longer exists.', 'STALE_TARGET');
  const indices = targets.map((target) => {
    const event = normalEvent(score, target);
    if (event.kind === 'rest') throw new OrnamentAuthoringV2Error('Spanning ornament endpoints/members must be pitched events.', 'RELATION_ENDPOINT_NOT_PITCHED', { eventId: event.id });
    const index = voice.events.findIndex((item) => item.id === target.eventId);
    if (index < 0) throw new OrnamentAuthoringV2Error('Relation target is not in the addressed voice.', 'STALE_TARGET', { eventId: target.eventId });
    return index;
  });
  if (new Set(indices).size !== indices.length || indices.some((value, index) => index > 0 && value <= (indices[index - 1] ?? -1))) {
    throw new OrnamentAuthoringV2Error('Spanning ornament targets must be unique and strictly increasing in canonical event order.', 'INVALID_RELATION_ORDER', { indices });
  }
  return Object.freeze(indices);
};

const allOrnaments = (notation: NotationDocumentV2): readonly OrnamentSpec[] => Object.freeze([
  ...notation.events.flatMap((entry) => entry.notation.ornaments),
  ...notation.graceEvents.flatMap((entry) => entry.notation.ornaments)
]);

const relationInUse = (notation: NotationDocumentV2, kind: 'tremolo' | 'wavy-line', number: number): boolean =>
  allOrnaments(notation).some((ornament) => ornament.kind === kind && (ornament.kind === 'wavy-line' || ornament.type !== 'single') && ornament.number === number);

const normalRelationMembers = (notation: NotationDocumentV2, kind: 'tremolo' | 'wavy-line', number: number): readonly string[] => {
  const members: string[] = [];
  for (const entry of notation.events) {
    if (entry.notation.ornaments.some((ornament) => ornament.kind === kind && (ornament.kind === 'wavy-line' || ornament.type !== 'single') && ornament.number === number)) members.push(entry.target.eventId);
  }
  if (notation.graceEvents.some((entry) => entry.notation.ornaments.some((ornament) => ornament.kind === kind && (ornament.kind === 'wavy-line' || ornament.type !== 'single') && ornament.number === number))) {
    throw new OrnamentAuthoringV2Error('This bounded relation profile does not mutate relations spanning grace events.', 'RELATION_SCOPE_UNSUPPORTED', { kind, number });
  }
  return Object.freeze(members);
};

const withoutRelation = (items: readonly OrnamentSpec[], kind: 'tremolo' | 'wavy-line', number: number): readonly OrnamentSpec[] =>
  items.filter((ornament) => !(ornament.kind === kind && (ornament.kind === 'wavy-line' || ornament.type !== 'single') && ornament.number === number));

const rebindNotation = (
  nextScore: ScoreDocumentV2,
  notation: NotationDocumentV2,
  normal: ReadonlyMap<string, EventNotationV2>,
  grace: ReadonlyMap<string, GraceEventNotationV2>
): Readonly<NotationDocumentV2> => createNotationDocumentV2(nextScore, {
  contractVersion: '2.0.0',
  documentId: nextScore.id,
  revisionId: nextScore.revision.id,
  measures: notation.measures.map((entry) => ({ target: addressEntityV2(nextScore, entry.target.measureId), notation: entry.notation })) as never,
  events: [...normal].map(([id, value]) => ({ target: addressEntityV2(nextScore, id), notation: value })) as never,
  notes: notation.notes.map((entry) => ({ target: addressEntityV2(nextScore, entry.target.noteId), notation: entry.notation })) as never,
  graceEvents: [...grace].map(([id, value]) => ({ target: addressEntityV2(nextScore, id), notation: value })) as never,
  graceNotes: notation.graceNotes.map((entry) => ({ target: addressEntityV2(nextScore, entry.target.graceNoteId), notation: entry.notation })) as never
});

export const executeOrnamentAuthoringV2 = (
  scoreInput: ScoreDocumentV2,
  notationInput: NotationDocumentV2,
  rawIntent: unknown,
  identity: OrnamentAuthoringIdentityV2
): Readonly<OrnamentAuthoringResultV2> => {
  const score = createScoreDocumentV2(scoreInput);
  const notation = createNotationDocumentV2(score, notationInput);
  const intent = parseIntent(rawIntent);
  assertIdentity(score, identity);
  const normal = new Map(notation.events.map((entry) => [entry.target.eventId, entry.notation]));
  const grace = new Map(notation.graceEvents.map((entry) => [entry.target.graceEventId, entry.notation]));
  let selectionEntityId: string;

  if (intent.type === 'ADD_LOCAL_ORNAMENT' || intent.type === 'TOGGLE_LOCAL_ORNAMENT' || intent.type === 'REMOVE_LOCAL_ORNAMENT') {
    resolveLocalTarget(score, intent.target);
    assertLocalValue(intent.value);
    selectionEntityId = intent.target.kind === 'event' ? intent.target.eventId : intent.target.graceEventId;
    const map = intent.target.kind === 'event' ? normal : grace;
    const current = intent.target.kind === 'event' ? (normal.get(selectionEntityId) ?? defaultEvent()) : (grace.get(selectionEntityId) ?? defaultGraceEvent());
    const existing = current.ornaments.findIndex((item) => same(item, intent.value));
    let ornaments: readonly OrnamentSpec[];
    if (intent.type === 'ADD_LOCAL_ORNAMENT') {
      if (existing >= 0) throw new OrnamentAuthoringV2Error('Ornament already exists on target.', 'DUPLICATE_ORNAMENT');
      ornaments = [...current.ornaments, intent.value];
    } else if (intent.type === 'TOGGLE_LOCAL_ORNAMENT') {
      ornaments = existing >= 0 ? current.ornaments.filter((_, index) => index !== existing) : [...current.ornaments, intent.value];
    } else {
      ornaments = existing >= 0 ? current.ornaments.filter((_, index) => index !== existing) : current.ornaments;
    }
    if (intent.target.kind === 'event') normal.set(selectionEntityId, { ...(current as EventNotationV2), ornaments });
    else grace.set(selectionEntityId, { ...(current as GraceEventNotationV2), ornaments });
    void map;
  } else if (intent.type === 'CREATE_TREMOLO_RELATION') {
    if (!validRelationNumber(intent.number) || !validMarks(intent.marks) || !validPlacement(intent.placement)) throw new OrnamentAuthoringV2Error('Tremolo relation parameters are invalid.', 'INVALID_INTENT');
    orderedIndices(score, [intent.start, intent.stop]);
    if (relationInUse(notation, 'tremolo', intent.number)) throw new OrnamentAuthoringV2Error('Tremolo relation number is already in use.', 'RELATION_NUMBER_IN_USE', { number: intent.number });
    const start = normal.get(intent.start.eventId) ?? defaultEvent();
    const stop = normal.get(intent.stop.eventId) ?? defaultEvent();
    normal.set(intent.start.eventId, { ...start, ornaments: [...start.ornaments, { kind: 'tremolo', type: 'start', marks: intent.marks, number: intent.number, placement: intent.placement }] });
    normal.set(intent.stop.eventId, { ...stop, ornaments: [...stop.ornaments, { kind: 'tremolo', type: 'stop', marks: intent.marks, number: intent.number, placement: intent.placement }] });
    selectionEntityId = intent.start.eventId;
  } else if (intent.type === 'REMOVE_TREMOLO_RELATION') {
    if (!validRelationNumber(intent.number)) throw new OrnamentAuthoringV2Error('Tremolo relation number is invalid.', 'INVALID_INTENT');
    orderedIndices(score, [intent.start, intent.stop]);
    const members = normalRelationMembers(notation, 'tremolo', intent.number);
    if (!same(members, [intent.start.eventId, intent.stop.eventId])) throw new OrnamentAuthoringV2Error('Exact tremolo relation endpoints were not found.', 'RELATION_NOT_FOUND', { members });
    const start = normal.get(intent.start.eventId) ?? defaultEvent();
    const stop = normal.get(intent.stop.eventId) ?? defaultEvent();
    normal.set(intent.start.eventId, { ...start, ornaments: withoutRelation(start.ornaments, 'tremolo', intent.number) });
    normal.set(intent.stop.eventId, { ...stop, ornaments: withoutRelation(stop.ornaments, 'tremolo', intent.number) });
    selectionEntityId = intent.start.eventId;
  } else if (intent.type === 'CREATE_WAVY_LINE_RELATION') {
    if (!Array.isArray(intent.targets) || !validRelationNumber(intent.number) || !validPlacement(intent.placement)) throw new OrnamentAuthoringV2Error('Wavy-line relation parameters are invalid.', 'INVALID_INTENT');
    orderedIndices(score, intent.targets);
    if (relationInUse(notation, 'wavy-line', intent.number)) throw new OrnamentAuthoringV2Error('Wavy-line relation number is already in use.', 'RELATION_NUMBER_IN_USE', { number: intent.number });
    intent.targets.forEach((target, index) => {
      const current = normal.get(target.eventId) ?? defaultEvent();
      const type = index === 0 ? 'start' : index === intent.targets.length - 1 ? 'stop' : 'continue';
      normal.set(target.eventId, { ...current, ornaments: [...current.ornaments, { kind: 'wavy-line', type, number: intent.number, placement: intent.placement }] });
    });
    selectionEntityId = intent.targets[0]?.eventId ?? '';
  } else {
    if (!Array.isArray(intent.targets) || !validRelationNumber(intent.number)) throw new OrnamentAuthoringV2Error('Wavy-line relation parameters are invalid.', 'INVALID_INTENT');
    orderedIndices(score, intent.targets);
    const members = normalRelationMembers(notation, 'wavy-line', intent.number);
    const expected = intent.targets.map((target) => target.eventId);
    if (!same(members, expected)) throw new OrnamentAuthoringV2Error('Exact wavy-line relation members were not found.', 'RELATION_NOT_FOUND', { members, expected });
    for (const target of intent.targets) {
      const current = normal.get(target.eventId) ?? defaultEvent();
      normal.set(target.eventId, { ...current, ornaments: withoutRelation(current.ornaments, 'wavy-line', intent.number) });
    }
    selectionEntityId = intent.targets[0]?.eventId ?? '';
  }

  const nextScore = createScoreDocumentV2({ ...score, revision: { id: identity.nextRevisionId, parentId: score.revision.id } });
  try {
    const nextNotation = rebindNotation(nextScore, notation, normal, grace);
    return Object.freeze({ score: nextScore, notation: nextNotation, selectionEntityId });
  } catch (error) {
    throw new OrnamentAuthoringV2Error('Ornament authoring result failed v2 notation validation.', 'RESULT_INVALID', { cause: error instanceof Error ? error.message : String(error) });
  }
};
