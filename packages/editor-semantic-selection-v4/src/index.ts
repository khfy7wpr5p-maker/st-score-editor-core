import {
  addressEntityV3,
  resolveSemanticAddressV3,
  type EventAddressV3,
  type NoteAddressV3,
  type SemanticAddressV3
} from '../../addressing-v3/src/index.js';
import { createScoreDocumentV3, type ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import {
  EDITOR_KEYPAD_EXECUTION_V4_VERSION,
  type EditorKeypadEventRangeTargetV4,
  type EditorKeypadNotePairTargetV4
} from '../../editor-keypad-execution-v4/src/index.js';

export const EDITOR_SEMANTIC_SELECTION_V4_VERSION = '1.0.0' as const;

export interface SingleSemanticSelectionV4 {
  readonly version: typeof EDITOR_SEMANTIC_SELECTION_V4_VERSION;
  readonly kind: 'SINGLE';
  readonly primary: SemanticAddressV3;
}

export interface NotePairSemanticSelectionV4 {
  readonly version: typeof EDITOR_SEMANTIC_SELECTION_V4_VERSION;
  readonly kind: 'NOTE_PAIR';
  readonly start: NoteAddressV3;
  readonly stop: NoteAddressV3;
}

export interface EventRangeSemanticSelectionV4 {
  readonly version: typeof EDITOR_SEMANTIC_SELECTION_V4_VERSION;
  readonly kind: 'EVENT_RANGE';
  readonly targets: readonly EventAddressV3[];
}

export type SemanticSelectionV4 =
  | SingleSemanticSelectionV4
  | NotePairSemanticSelectionV4
  | EventRangeSemanticSelectionV4;

export type SemanticSelectionV4ErrorCode =
  | 'STALE_SELECTION'
  | 'SELECTION_KIND'
  | 'DUPLICATE_TARGET'
  | 'SELECTION_SCOPE_MISMATCH'
  | 'SELECTION_ORDER_INVALID'
  | 'RANGE_NOT_CONTIGUOUS'
  | 'RANGE_CARDINALITY_UNSUPPORTED';

export class SemanticSelectionV4Error extends Error {
  readonly code: SemanticSelectionV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: SemanticSelectionV4ErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'SemanticSelectionV4Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const frozenAddress = <T extends SemanticAddressV3>(address: T): T =>
  Object.freeze({ ...address }) as T;

const validatedAddress = <T extends SemanticAddressV3>(
  score: ScoreDocumentV3,
  address: T,
  expectedKind?: T['kind']
): T => {
  try {
    const resolved = resolveSemanticAddressV3(score, address);
    if (expectedKind !== undefined && resolved.kind !== expectedKind) {
      throw new SemanticSelectionV4Error(
        `Semantic selection requires ${String(expectedKind)} address.`,
        'SELECTION_KIND',
        { actualKind: resolved.kind, expectedKind }
      );
    }
  } catch (error) {
    if (error instanceof SemanticSelectionV4Error) throw error;
    throw new SemanticSelectionV4Error(
      'Semantic selection contains a stale or invalid address.',
      'STALE_SELECTION',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  return frozenAddress(address);
};

const voiceOrdinal = (score: ScoreDocumentV3, address: NoteAddressV3): number => {
  try {
    const voiceAddress = addressEntityV3(score, address.voiceId);
    if (voiceAddress.kind !== 'voice') throw new Error('Address is not a voice.');
    const resolved = resolveSemanticAddressV3(score, voiceAddress);
    if (resolved.kind !== 'voice') throw new Error('Voice did not resolve.');
    return resolved.value.ordinal;
  } catch (error) {
    throw new SemanticSelectionV4Error(
      'Semantic note-pair voice cannot be resolved.',
      'STALE_SELECTION',
      { voiceId: address.voiceId, cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

const logicalEventIds = (
  score: ScoreDocumentV3,
  address: NoteAddressV3,
  ordinal: number
): readonly string[] => {
  const part = score.parts.find(candidate => candidate.id === address.partId);
  const staff = part?.staves.find(candidate => candidate.id === address.staffId);
  if (staff === undefined || staff.role === 'tablature-linked') {
    throw new SemanticSelectionV4Error(
      'Semantic note-pair source staff is invalid.',
      'SELECTION_SCOPE_MISMATCH',
      { partId: address.partId, staffId: address.staffId }
    );
  }
  const ids: string[] = [];
  for (const measure of staff.measures) {
    const voice = measure.voices.find(candidate => candidate.ordinal === ordinal);
    if (voice !== undefined) ids.push(...voice.events.map(event => event.id));
  }
  return Object.freeze(ids);
};

export const createSingleSemanticSelectionV4 = (
  scoreInput: ScoreDocumentV3,
  address: SemanticAddressV3
): Readonly<SingleSemanticSelectionV4> => {
  const score = createScoreDocumentV3(scoreInput);
  return Object.freeze({
    version: EDITOR_SEMANTIC_SELECTION_V4_VERSION,
    kind: 'SINGLE',
    primary: validatedAddress(score, address)
  });
};

export const createNotePairSemanticSelectionV4 = (
  scoreInput: ScoreDocumentV3,
  startInput: NoteAddressV3,
  stopInput: NoteAddressV3
): Readonly<NotePairSemanticSelectionV4> => {
  const score = createScoreDocumentV3(scoreInput);
  const start = validatedAddress(score, startInput, 'note');
  const stop = validatedAddress(score, stopInput, 'note');

  if (start.noteId === stop.noteId) {
    throw new SemanticSelectionV4Error(
      'Semantic note-pair endpoints must be distinct.',
      'DUPLICATE_TARGET',
      { noteId: start.noteId }
    );
  }
  if (start.partId !== stop.partId || start.staffId !== stop.staffId) {
    throw new SemanticSelectionV4Error(
      'Semantic note-pair endpoints must remain in one source part/staff.',
      'SELECTION_SCOPE_MISMATCH',
      {
        startPartId: start.partId,
        stopPartId: stop.partId,
        startStaffId: start.staffId,
        stopStaffId: stop.staffId
      }
    );
  }

  const startOrdinal = voiceOrdinal(score, start);
  const stopOrdinal = voiceOrdinal(score, stop);
  if (startOrdinal !== stopOrdinal) {
    throw new SemanticSelectionV4Error(
      'Semantic note-pair endpoints must use the same canonical voice ordinal.',
      'SELECTION_SCOPE_MISMATCH',
      { startOrdinal, stopOrdinal }
    );
  }

  const eventIds = logicalEventIds(score, start, startOrdinal);
  const startIndex = eventIds.indexOf(start.eventId);
  const stopIndex = eventIds.indexOf(stop.eventId);
  if (startIndex < 0 || stopIndex < 0 || stopIndex <= startIndex) {
    throw new SemanticSelectionV4Error(
      'Semantic note-pair stop must occur after start in canonical voice order.',
      'SELECTION_ORDER_INVALID',
      { startIndex, stopIndex }
    );
  }

  return Object.freeze({
    version: EDITOR_SEMANTIC_SELECTION_V4_VERSION,
    kind: 'NOTE_PAIR',
    start,
    stop
  });
};

export const createEventRangeSemanticSelectionV4 = (
  scoreInput: ScoreDocumentV3,
  targetInputs: readonly EventAddressV3[]
): Readonly<EventRangeSemanticSelectionV4> => {
  const score = createScoreDocumentV3(scoreInput);
  if (targetInputs.length < 2) {
    throw new SemanticSelectionV4Error(
      'Semantic event range requires at least two exact events.',
      'RANGE_CARDINALITY_UNSUPPORTED',
      { cardinality: targetInputs.length }
    );
  }

  const targets = targetInputs.map(target => validatedAddress(score, target, 'event'));
  const ids = targets.map(target => target.eventId);
  if (new Set(ids).size !== ids.length) {
    throw new SemanticSelectionV4Error(
      'Semantic event range contains duplicate events.',
      'DUPLICATE_TARGET',
      { eventIds: ids }
    );
  }

  const first = targets[0]!;
  if (!targets.every(target =>
    target.partId === first.partId &&
    target.staffId === first.staffId &&
    target.frameId === first.frameId &&
    target.measureId === first.measureId &&
    target.voiceId === first.voiceId
  )) {
    throw new SemanticSelectionV4Error(
      'Semantic event range must remain in one exact source measure voice.',
      'SELECTION_SCOPE_MISMATCH'
    );
  }

  let voice;
  try {
    const voiceAddress = addressEntityV3(score, first.voiceId);
    if (voiceAddress.kind !== 'voice') throw new Error('Address is not a voice.');
    const resolved = resolveSemanticAddressV3(score, voiceAddress);
    if (resolved.kind !== 'voice') throw new Error('Voice did not resolve.');
    voice = resolved.value;
  } catch (error) {
    throw new SemanticSelectionV4Error(
      'Semantic event-range voice cannot be resolved.',
      'STALE_SELECTION',
      { voiceId: first.voiceId, cause: error instanceof Error ? error.message : String(error) }
    );
  }

  const indices = targets.map(target => voice.events.findIndex(event => event.id === target.eventId));
  if (indices.some(index => index < 0)) {
    throw new SemanticSelectionV4Error(
      'Semantic event range contains an event outside the resolved voice.',
      'STALE_SELECTION',
      { indices }
    );
  }
  for (let index = 1; index < indices.length; index += 1) {
    const previous = indices[index - 1]!;
    const current = indices[index]!;
    if (current <= previous) {
      throw new SemanticSelectionV4Error(
        'Semantic event range must follow canonical event order.',
        'SELECTION_ORDER_INVALID',
        { indices }
      );
    }
    if (current !== previous + 1) {
      throw new SemanticSelectionV4Error(
        'Semantic event range must contain consecutive canonical events.',
        'RANGE_NOT_CONTIGUOUS',
        { indices }
      );
    }
  }

  return Object.freeze({
    version: EDITOR_SEMANTIC_SELECTION_V4_VERSION,
    kind: 'EVENT_RANGE',
    targets: Object.freeze(targets)
  });
};

export const semanticSelectionPrimaryV4 = (
  selection: SemanticSelectionV4
): SemanticAddressV3 => {
  switch (selection.kind) {
    case 'SINGLE': return selection.primary;
    case 'NOTE_PAIR': return selection.start;
    case 'EVENT_RANGE': return selection.targets[0]!;
  }
};

export const toEditorKeypadNotePairTargetV4 = (
  selection: SemanticSelectionV4
): Readonly<EditorKeypadNotePairTargetV4> => {
  if (selection.kind !== 'NOTE_PAIR') {
    throw new SemanticSelectionV4Error(
      'Editor keypad note-pair target requires NOTE_PAIR semantic selection.',
      'SELECTION_KIND',
      { kind: selection.kind }
    );
  }
  return Object.freeze({
    version: EDITOR_KEYPAD_EXECUTION_V4_VERSION,
    kind: 'NOTE_PAIR',
    start: selection.start,
    stop: selection.stop
  });
};

export const toEditorKeypadTripletTargetV4 = (
  selection: SemanticSelectionV4
): Readonly<EditorKeypadEventRangeTargetV4> => {
  if (selection.kind !== 'EVENT_RANGE') {
    throw new SemanticSelectionV4Error(
      'Editor keypad triplet target requires EVENT_RANGE semantic selection.',
      'SELECTION_KIND',
      { kind: selection.kind }
    );
  }
  if (selection.targets.length !== 3) {
    throw new SemanticSelectionV4Error(
      'Editor keypad triplet target requires exactly three semantic events.',
      'RANGE_CARDINALITY_UNSUPPORTED',
      { cardinality: selection.targets.length }
    );
  }
  return Object.freeze({
    version: EDITOR_KEYPAD_EXECUTION_V4_VERSION,
    kind: 'EVENT_RANGE',
    targets: selection.targets
  });
};
