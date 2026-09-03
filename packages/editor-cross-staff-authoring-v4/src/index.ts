import { createScoreDocumentV3, type ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import { addressEntityV3, resolveSemanticAddressV3, type EventAddressV3 } from '../../addressing-v3/src/index.js';
import { createNotationDocumentV4, type NotationDocumentV4 } from '../../notation-structure-v4/src/index.js';

export const CROSS_STAFF_AUTHORING_V4_VERSION = '1.0.0' as const;

export type CrossStaffAuthoringIntentV4 =
  | { readonly version: typeof CROSS_STAFF_AUTHORING_V4_VERSION; readonly type: 'SET_CROSS_STAFF_PLACEMENT'; readonly target: EventAddressV3; readonly displayStaffId: string }
  | { readonly version: typeof CROSS_STAFF_AUTHORING_V4_VERSION; readonly type: 'REMOVE_CROSS_STAFF_PLACEMENT'; readonly target: EventAddressV3 };

export interface CrossStaffAuthoringV4Options { readonly nextRevisionId: string }
export interface CrossStaffAuthoringV4Result {
  readonly score: Readonly<ScoreDocumentV3>;
  readonly notation: Readonly<NotationDocumentV4>;
  readonly selectionEntityId: string;
}

export type CrossStaffAuthoringV4ErrorCode =
  | 'INVALID_INTENT'
  | 'STALE_TARGET'
  | 'INVALID_REVISION_ID'
  | 'PLACEMENT_UNCHANGED'
  | 'PLACEMENT_NOT_FOUND'
  | 'RESULT_INVALID';

export class CrossStaffAuthoringV4Error extends Error {
  readonly code: CrossStaffAuthoringV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: CrossStaffAuthoringV4ErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'CrossStaffAuthoringV4Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

type R = Record<string, unknown>;
const rec = (value: unknown): value is R => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value: unknown, fields: readonly string[]): value is R => rec(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...fields].sort());
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

const parseIntent = (input: unknown): CrossStaffAuthoringIntentV4 => {
  if (!rec(input) || input.version !== CROSS_STAFF_AUTHORING_V4_VERSION || typeof input.type !== 'string') {
    throw new CrossStaffAuthoringV4Error('Cross-staff intent envelope is invalid.', 'INVALID_INTENT');
  }
  if (input.type === 'SET_CROSS_STAFF_PLACEMENT') {
    if (!exact(input, ['version','type','target','displayStaffId']) || typeof input.displayStaffId !== 'string' || !ID.test(input.displayStaffId)) {
      throw new CrossStaffAuthoringV4Error('SET_CROSS_STAFF_PLACEMENT field set is invalid.', 'INVALID_INTENT');
    }
    return input as unknown as CrossStaffAuthoringIntentV4;
  }
  if (input.type === 'REMOVE_CROSS_STAFF_PLACEMENT') {
    if (!exact(input, ['version','type','target'])) throw new CrossStaffAuthoringV4Error('REMOVE_CROSS_STAFF_PLACEMENT field set is invalid.', 'INVALID_INTENT');
    return input as unknown as CrossStaffAuthoringIntentV4;
  }
  throw new CrossStaffAuthoringV4Error('Cross-staff intent type is unsupported.', 'INVALID_INTENT', { type: input.type });
};

const assertRevision = (score: ScoreDocumentV3, options: CrossStaffAuthoringV4Options): void => {
  if (!exact(options, ['nextRevisionId']) || typeof options.nextRevisionId !== 'string' || !ID.test(options.nextRevisionId) || options.nextRevisionId === score.revision.id) {
    throw new CrossStaffAuthoringV4Error('A fresh stable next revision id is required.', 'INVALID_REVISION_ID');
  }
};

const currentEvent = (score: ScoreDocumentV3, target: EventAddressV3): void => {
  try {
    const resolved = resolveSemanticAddressV3(score, target);
    if (resolved.kind !== 'event') throw new Error(`observed ${resolved.kind}`);
  } catch (error) {
    throw new CrossStaffAuthoringV4Error('Cross-staff target is stale or invalid.', 'STALE_TARGET', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
};

const rebound = (score: ScoreDocumentV3, notation: NotationDocumentV4, placements: readonly { sourceEventId: string; displayStaffId: string }[]): Readonly<NotationDocumentV4> => {
  const address = (id: string, kind: string) => {
    const value = addressEntityV3(score, id);
    if (value.kind !== kind) throw new CrossStaffAuthoringV4Error('Notation target kind changed while rebinding.', 'RESULT_INVALID', { id, expectedKind: kind, observedKind: value.kind });
    return value;
  };
  return createNotationDocumentV4(score, {
    contractVersion: '4.0.0',
    documentId: score.id,
    revisionId: score.revision.id,
    frames: notation.frames.map(entry => ({ target: address(entry.target.frameId, 'measure-frame'), notation: entry.notation })) as never,
    measures: notation.measures.map(entry => ({ target: address(entry.target.measureId, 'measure'), notation: entry.notation })) as never,
    events: notation.events.map(entry => ({ target: address(entry.target.eventId, 'event'), notation: entry.notation })) as never,
    notes: notation.notes.map(entry => ({ target: address(entry.target.noteId, 'note'), notation: entry.notation })) as never,
    graceEvents: notation.graceEvents.map(entry => ({ target: address(entry.target.graceEventId, 'grace-event'), notation: entry.notation })) as never,
    graceNotes: notation.graceNotes.map(entry => ({ target: address(entry.target.graceNoteId, 'grace-note'), notation: entry.notation })) as never,
    crossStaffPlacements: placements.map(item => ({ source: address(item.sourceEventId, 'event'), displayStaffId: item.displayStaffId })) as never
  });
};

export const executeCrossStaffAuthoringV4 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  rawIntent: unknown,
  options: CrossStaffAuthoringV4Options
): Readonly<CrossStaffAuthoringV4Result> => {
  const score = createScoreDocumentV3(scoreInput);
  const notation = createNotationDocumentV4(score, notationInput);
  const intent = parseIntent(rawIntent);
  assertRevision(score, options);
  currentEvent(score, intent.target);

  const current = notation.crossStaffPlacements.map(item => ({ sourceEventId: item.source.eventId, displayStaffId: item.displayStaffId }));
  const index = current.findIndex(item => item.sourceEventId === intent.target.eventId);
  if (intent.type === 'SET_CROSS_STAFF_PLACEMENT') {
    if (index >= 0 && current[index]?.displayStaffId === intent.displayStaffId) {
      throw new CrossStaffAuthoringV4Error('Cross-staff placement already has the requested display staff.', 'PLACEMENT_UNCHANGED', { eventId: intent.target.eventId, displayStaffId: intent.displayStaffId });
    }
    if (index >= 0) current[index] = { sourceEventId: intent.target.eventId, displayStaffId: intent.displayStaffId };
    else current.push({ sourceEventId: intent.target.eventId, displayStaffId: intent.displayStaffId });
  } else {
    if (index < 0) throw new CrossStaffAuthoringV4Error('Cross-staff placement does not exist on target.', 'PLACEMENT_NOT_FOUND', { eventId: intent.target.eventId });
    current.splice(index, 1);
  }

  const nextScore = createScoreDocumentV3({
    ...structuredClone(score),
    revision: { id: options.nextRevisionId, parentId: score.revision.id }
  });
  try {
    const nextNotation = rebound(nextScore, notation, current);
    return Object.freeze({ score: nextScore, notation: nextNotation, selectionEntityId: intent.target.eventId });
  } catch (error) {
    if (error instanceof CrossStaffAuthoringV4Error) throw error;
    throw new CrossStaffAuthoringV4Error('Cross-staff authoring result failed canonical validation.', 'RESULT_INVALID', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
};
