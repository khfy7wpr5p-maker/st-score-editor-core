import type { Rational, ScoreDocument, ScoreEvent } from '../../score-model/src/index.js';
import { addressEntity, resolveSemanticAddress } from '../../addressing/src/index.js';
import type { EventAddress, NoteAddress, SelectionSnapshot, SemanticAddress } from '../../addressing/src/index.js';
import { notationForEvent, notationForNote } from '../../notation-structure/src/index.js';
import type { BoundaryMark, NotationDocument } from '../../notation-structure/src/index.js';
import {
  applyNotationTransaction,
  NOTATION_COMMAND_VERSION,
  NOTATION_TRANSACTION_VERSION
} from '../../notation-commands/src/index.js';
import type { NotationCommand, NotationTransaction } from '../../notation-commands/src/index.js';
import { parseEditorKeypadAction } from '../../editor-keypad/src/index.js';
import type { EditorKeypadAction, EditorKeypadActionId } from '../../editor-keypad/src/index.js';
import {
  EDITOR_KEYPAD_EXECUTION_VERSION,
  parseEditorKeypadCommitIdentity
} from '../../editor-keypad-execution/src/index.js';
import type {
  EditorKeypadCommitIdentity,
  EditorKeypadExecutionResult
} from '../../editor-keypad-execution/src/index.js';

export const EDITOR_KEYPAD_ADVANCED_VERSION = '1.0.0' as const;

export interface EditorKeypadEventRangeTarget {
  readonly version: typeof EDITOR_KEYPAD_ADVANCED_VERSION;
  readonly kind: 'EVENT_RANGE';
  readonly targets: readonly EventAddress[];
}

export interface EditorKeypadNotePairTarget {
  readonly version: typeof EDITOR_KEYPAD_ADVANCED_VERSION;
  readonly kind: 'NOTE_PAIR';
  readonly start: NoteAddress;
  readonly stop: NoteAddress;
}

export type EditorKeypadAdvancedTarget = EditorKeypadEventRangeTarget | EditorKeypadNotePairTarget;

export type EditorKeypadAdvancedErrorCode =
  | 'ACTION_NOT_ADVANCED'
  | 'EXPLICIT_TARGET_REQUIRED'
  | 'INVALID_TARGET_SPEC'
  | 'STALE_SELECTION'
  | 'STALE_NOTATION'
  | 'SELECTION_SCOPE_MISMATCH'
  | 'RANGE_NOT_EXACT'
  | 'TUPLET_TIMING_INCONSISTENT'
  | 'TUPLET_STATE_UNSUPPORTED'
  | 'RELATION_ENDPOINT_INVALID'
  | 'RELATION_AMBIGUOUS'
  | 'RELATION_NUMBER_EXHAUSTED';

export class EditorKeypadAdvancedError extends Error {
  readonly code: EditorKeypadAdvancedErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, code: EditorKeypadAdvancedErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'EditorKeypadAdvancedError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

type UnknownRecord = Record<string, unknown>;

const ADVANCED_ACTIONS = new Set<EditorKeypadActionId>(['tuplet.triplet', 'tie.edit', 'slur.edit']);

export const isAdvancedEditorKeypadActionId = (actionId: EditorKeypadActionId): boolean => ADVANCED_ACTIONS.has(actionId);

const exactFields = (value: unknown, fields: readonly string[], label: string): UnknownRecord => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new EditorKeypadAdvancedError(`${label} must be an object.`, 'INVALID_TARGET_SPEC');
  }
  const record = value as UnknownRecord;
  const observed = Object.keys(record).sort();
  const expected = [...fields].sort();
  if (JSON.stringify(observed) !== JSON.stringify(expected)) {
    throw new EditorKeypadAdvancedError(`${label} field set is invalid.`, 'INVALID_TARGET_SPEC', { observed, expected });
  }
  return record;
};

const validateAddress = <T extends SemanticAddress>(score: ScoreDocument, raw: unknown, kind: T['kind'], label: string): Readonly<T> => {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new EditorKeypadAdvancedError(`${label} must be a semantic address.`, 'INVALID_TARGET_SPEC');
  }
  const candidate = raw as T;
  try {
    const resolved = resolveSemanticAddress(score, candidate);
    if (resolved.kind !== kind) {
      throw new EditorKeypadAdvancedError(`${label} has the wrong semantic kind.`, 'INVALID_TARGET_SPEC', { expected: kind, observed: resolved.kind });
    }
  } catch (error) {
    if (error instanceof EditorKeypadAdvancedError) throw error;
    throw new EditorKeypadAdvancedError(`${label} is stale or invalid for the current score revision.`, 'INVALID_TARGET_SPEC', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
  return Object.freeze({ ...candidate } as T) as Readonly<T>;
};

export const parseEditorKeypadAdvancedTarget = (score: ScoreDocument, input: unknown): Readonly<EditorKeypadAdvancedTarget> => {
  if (input === null || input === undefined) {
    throw new EditorKeypadAdvancedError('Advanced keypad action requires an explicit revision-bound target.', 'EXPLICIT_TARGET_REQUIRED');
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new EditorKeypadAdvancedError('Advanced keypad target must be an object.', 'INVALID_TARGET_SPEC');
  }
  const kind = (input as UnknownRecord).kind;
  if (kind === 'EVENT_RANGE') {
    const record = exactFields(input, ['version', 'kind', 'targets'], 'EditorKeypadEventRangeTarget');
    if (record.version !== EDITOR_KEYPAD_ADVANCED_VERSION || !Array.isArray(record.targets) || record.targets.length !== 3) {
      throw new EditorKeypadAdvancedError('Triplet event range must contain exactly three current-revision event addresses.', 'INVALID_TARGET_SPEC');
    }
    const targets = record.targets.map((item, index) => validateAddress<EventAddress>(score, item, 'event', `targets[${index}]`));
    const ids = new Set(targets.map((target) => target.eventId));
    if (ids.size !== 3) throw new EditorKeypadAdvancedError('Triplet event range contains duplicate events.', 'INVALID_TARGET_SPEC');
    return Object.freeze({ version: EDITOR_KEYPAD_ADVANCED_VERSION, kind: 'EVENT_RANGE', targets: Object.freeze(targets) });
  }
  if (kind === 'NOTE_PAIR') {
    const record = exactFields(input, ['version', 'kind', 'start', 'stop'], 'EditorKeypadNotePairTarget');
    if (record.version !== EDITOR_KEYPAD_ADVANCED_VERSION) {
      throw new EditorKeypadAdvancedError('Connection target version is unsupported.', 'INVALID_TARGET_SPEC');
    }
    const start = validateAddress<NoteAddress>(score, record.start, 'note', 'start');
    const stop = validateAddress<NoteAddress>(score, record.stop, 'note', 'stop');
    if (start.noteId === stop.noteId) throw new EditorKeypadAdvancedError('Connection endpoints must be distinct notes.', 'RELATION_ENDPOINT_INVALID');
    return Object.freeze({ version: EDITOR_KEYPAD_ADVANCED_VERSION, kind: 'NOTE_PAIR', start, stop });
  }
  throw new EditorKeypadAdvancedError('Advanced keypad target kind is unsupported.', 'INVALID_TARGET_SPEC', { kind });
};

const assertCurrent = (score: ScoreDocument, notation: NotationDocument, selection: SelectionSnapshot): SemanticAddress => {
  if (selection.documentId !== score.id || selection.revisionId !== score.revision.id) {
    throw new EditorKeypadAdvancedError('Advanced keypad selection is stale or belongs to another document.', 'STALE_SELECTION');
  }
  if (notation.documentId !== score.id || notation.revisionId !== score.revision.id) {
    throw new EditorKeypadAdvancedError('Advanced keypad notation is stale or belongs to another score revision.', 'STALE_NOTATION');
  }
  if (selection.primary === null) {
    throw new EditorKeypadAdvancedError('Advanced keypad action requires a current semantic selection.', 'STALE_SELECTION');
  }
  resolveSemanticAddress(score, selection.primary);
  return selection.primary;
};

const gcd = (a: bigint, b: bigint): bigint => {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
};

const normalized = (numerator: bigint, denominator: bigint): Readonly<Rational> => {
  if (denominator <= 0n || numerator < 0n) throw new EditorKeypadAdvancedError('Computed rational is invalid.', 'TUPLET_TIMING_INCONSISTENT');
  const divisor = gcd(numerator, denominator);
  const n = numerator / divisor;
  const d = denominator / divisor;
  if (n > BigInt(Number.MAX_SAFE_INTEGER) || d > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new EditorKeypadAdvancedError('Computed rational exceeds safe integer bounds.', 'TUPLET_TIMING_INCONSISTENT');
  }
  return Object.freeze({ numerator: Number(n), denominator: Number(d) });
};

const add = (left: Rational, right: Rational): Readonly<Rational> =>
  normalized(
    BigInt(left.numerator) * BigInt(right.denominator) + BigInt(right.numerator) * BigInt(left.denominator),
    BigInt(left.denominator) * BigInt(right.denominator)
  );

const multiply = (value: Rational, numerator: number, denominator: number): Readonly<Rational> =>
  normalized(BigInt(value.numerator) * BigInt(numerator), BigInt(value.denominator) * BigInt(denominator));

const sameRational = (left: Rational, right: Rational): boolean =>
  BigInt(left.numerator) * BigInt(right.denominator) === BigInt(right.numerator) * BigInt(left.denominator);

const SIMPLE_DURATIONS: readonly Readonly<Rational>[] = Object.freeze([
  Object.freeze({ numerator: 1, denominator: 1 }),
  Object.freeze({ numerator: 1, denominator: 2 }),
  Object.freeze({ numerator: 1, denominator: 4 }),
  Object.freeze({ numerator: 1, denominator: 8 }),
  Object.freeze({ numerator: 1, denominator: 16 }),
  Object.freeze({ numerator: 1, denominator: 32 })
]);

const eventFor = (score: ScoreDocument, address: EventAddress): ScoreEvent => {
  const resolved = resolveSemanticAddress(score, address);
  if (resolved.kind !== 'event') throw new EditorKeypadAdvancedError('Triplet target changed semantic kind.', 'RANGE_NOT_EXACT');
  return resolved.value;
};

const eventIdForSelection = (primary: SemanticAddress): string | null => {
  if (primary.kind === 'event') return primary.eventId;
  if (primary.kind === 'note') return primary.eventId;
  return null;
};

const notationTransactionId = (identity: EditorKeypadCommitIdentity): string => `${identity.transactionId}:advanced`;
const notationCommandId = (identity: EditorKeypadCommitIdentity, index: number): string => `${identity.transactionId}:advanced:${index}`;

const applyNotationCommands = (
  score: ScoreDocument,
  notation: NotationDocument,
  identity: EditorKeypadCommitIdentity,
  commands: readonly NotationCommand[]
): { readonly score: Readonly<ScoreDocument>; readonly notation: Readonly<NotationDocument> } => {
  const transaction: NotationTransaction = Object.freeze({
    contractVersion: NOTATION_TRANSACTION_VERSION,
    transactionId: notationTransactionId(identity),
    documentId: score.id,
    baseRevisionId: score.revision.id,
    nextRevisionId: identity.nextRevisionId,
    commands: Object.freeze([...commands])
  });
  const result = applyNotationTransaction(score, notation, transaction);
  return Object.freeze({ score: result.score, notation: result.notation });
};

const tripletResult = (
  score: ScoreDocument,
  notation: NotationDocument,
  primary: SemanticAddress,
  target: EditorKeypadEventRangeTarget,
  identity: EditorKeypadCommitIdentity
): { readonly score: Readonly<ScoreDocument>; readonly notation: Readonly<NotationDocument> } => {
  const selectedEventId = eventIdForSelection(primary);
  if (selectedEventId === null || !target.targets.some((item) => item.eventId === selectedEventId)) {
    throw new EditorKeypadAdvancedError('Current selection must belong to the explicit triplet range.', 'SELECTION_SCOPE_MISMATCH');
  }
  const [first, second, third] = target.targets;
  if (first === undefined || second === undefined || third === undefined) {
    throw new EditorKeypadAdvancedError('Triplet range is incomplete.', 'RANGE_NOT_EXACT');
  }
  const samePath = target.targets.every((item) =>
    item.partId === first.partId && item.staffId === first.staffId && item.measureId === first.measureId && item.voiceId === first.voiceId
  );
  if (!samePath) throw new EditorKeypadAdvancedError('Triplet range must stay inside one exact measure voice.', 'RANGE_NOT_EXACT');

  const voiceAddress = addressEntity(score, first.voiceId);
  const voiceResolved = resolveSemanticAddress(score, voiceAddress);
  if (voiceResolved.kind !== 'voice') throw new EditorKeypadAdvancedError('Triplet voice could not be resolved.', 'RANGE_NOT_EXACT');
  const indices = target.targets.map((item) => voiceResolved.value.events.findIndex((event) => event.id === item.eventId));
  const [firstIndex, secondIndex, thirdIndex] = indices;
  if (
    firstIndex === undefined || secondIndex === undefined || thirdIndex === undefined ||
    firstIndex < 0 || secondIndex !== firstIndex + 1 || thirdIndex !== secondIndex + 1
  ) {
    throw new EditorKeypadAdvancedError('Triplet range must contain exactly three consecutive events in score order.', 'RANGE_NOT_EXACT', { indices });
  }

  const events = target.targets.map((item) => eventFor(score, item));
  const firstEvent = events[0]!;
  if (!events.every((event) => sameRational(event.duration, firstEvent.duration))) {
    throw new EditorKeypadAdvancedError('Triplet v1 requires three equal canonical event durations.', 'TUPLET_TIMING_INCONSISTENT');
  }
  if (!sameRational(add(events[0]!.onset, events[0]!.duration), events[1]!.onset) ||
      !sameRational(add(events[1]!.onset, events[1]!.duration), events[2]!.onset)) {
    throw new EditorKeypadAdvancedError('Triplet events must be canonically contiguous.', 'TUPLET_TIMING_INCONSISTENT');
  }
  const writtenBase = multiply(firstEvent.duration, 3, 2);
  if (!SIMPLE_DURATIONS.some((value) => sameRational(value, writtenBase))) {
    throw new EditorKeypadAdvancedError('Canonical triplet timing does not resolve to an admitted whole-through-32nd written base.', 'TUPLET_TIMING_INCONSISTENT', {
      duration: firstEvent.duration,
      writtenBase
    });
  }
  for (const item of target.targets) {
    const current = notationForEvent(notation, item.eventId);
    if ((current?.dots ?? 0) !== 0) {
      throw new EditorKeypadAdvancedError('Triplet v1 does not combine with augmentation dots.', 'TUPLET_TIMING_INCONSISTENT', { eventId: item.eventId });
    }
    if ((current?.tuplet ?? null) !== null) {
      throw new EditorKeypadAdvancedError('Triplet target already carries tuplet metadata; removal/retiming is not admitted without onset mutation support.', 'TUPLET_STATE_UNSUPPORTED', { eventId: item.eventId });
    }
  }

  const startMark = Object.freeze([{ number: 1, type: 'start' as const }]);
  const stopMark = Object.freeze([{ number: 1, type: 'stop' as const }]);
  const values = [
    Object.freeze({ actualNotes: 3, normalNotes: 2, marks: startMark }),
    Object.freeze({ actualNotes: 3, normalNotes: 2, marks: Object.freeze([] as BoundaryMark[]) }),
    Object.freeze({ actualNotes: 3, normalNotes: 2, marks: stopMark })
  ] as const;
  const commands = target.targets.map((item, index) => Object.freeze({
    commandVersion: NOTATION_COMMAND_VERSION,
    commandId: notationCommandId(identity, index + 1),
    type: 'SET_TUPLET' as const,
    target: item,
    value: values[index]!
  }));
  return applyNotationCommands(score, notation, identity, commands);
};

const noteValue = (score: ScoreDocument, address: NoteAddress) => {
  const resolved = resolveSemanticAddress(score, address);
  if (resolved.kind !== 'note') throw new EditorKeypadAdvancedError('Connection endpoint changed semantic kind.', 'RELATION_ENDPOINT_INVALID');
  return resolved.value;
};

const voiceOrdinal = (score: ScoreDocument, address: NoteAddress): number => {
  const voice = resolveSemanticAddress(score, addressEntity(score, address.voiceId));
  if (voice.kind !== 'voice') throw new EditorKeypadAdvancedError('Connection endpoint voice could not be resolved.', 'RELATION_ENDPOINT_INVALID');
  return voice.value.ordinal;
};

const logicalVoiceEventIds = (score: ScoreDocument, address: NoteAddress, ordinal: number): readonly string[] => {
  const part = score.parts.find((item) => item.id === address.partId);
  const staff = part?.staves.find((item) => item.id === address.staffId);
  if (part === undefined || staff === undefined) throw new EditorKeypadAdvancedError('Connection endpoint path could not be resolved.', 'RELATION_ENDPOINT_INVALID');
  const ids: string[] = [];
  const measures = [...staff.measures].sort((left, right) => left.ordinal - right.ordinal);
  for (const measure of measures) {
    const voice = measure.voices.find((item) => item.ordinal === ordinal);
    if (voice !== undefined) ids.push(...voice.events.map((event) => event.id));
  }
  return Object.freeze(ids);
};

const relationMarks = (notation: NotationDocument, noteId: string, relation: 'tie' | 'slur'): readonly BoundaryMark[] => {
  const current = notationForNote(notation, noteId);
  return relation === 'tie' ? current?.ties ?? [] : current?.slurs ?? [];
};

const sharedRelationNumbers = (startMarks: readonly BoundaryMark[], stopMarks: readonly BoundaryMark[]): readonly number[] => {
  const starts = new Set(startMarks.filter((mark) => mark.type === 'start').map((mark) => mark.number));
  return Object.freeze([...new Set(stopMarks.filter((mark) => mark.type === 'stop' && starts.has(mark.number)).map((mark) => mark.number))].sort((a, b) => a - b));
};

const nextRelationNumber = (startMarks: readonly BoundaryMark[], stopMarks: readonly BoundaryMark[]): number => {
  const used = new Set([...startMarks, ...stopMarks].map((mark) => mark.number));
  for (let number = 1; number <= 16; number += 1) if (!used.has(number)) return number;
  throw new EditorKeypadAdvancedError('No admitted boundary number remains for the explicit connection.', 'RELATION_NUMBER_EXHAUSTED');
};

const sortedMarks = (marks: readonly BoundaryMark[]): readonly BoundaryMark[] => Object.freeze(
  [...marks].sort((left, right) => left.number - right.number || left.type.localeCompare(right.type))
);

const connectionResult = (
  score: ScoreDocument,
  notation: NotationDocument,
  primary: SemanticAddress,
  target: EditorKeypadNotePairTarget,
  identity: EditorKeypadCommitIdentity,
  relation: 'tie' | 'slur'
): { readonly score: Readonly<ScoreDocument>; readonly notation: Readonly<NotationDocument> } => {
  if (primary.kind !== 'note' || primary.noteId !== target.start.noteId) {
    throw new EditorKeypadAdvancedError('Current selection must be the explicit connection start note.', 'SELECTION_SCOPE_MISMATCH');
  }
  if (target.start.partId !== target.stop.partId || target.start.staffId !== target.stop.staffId) {
    throw new EditorKeypadAdvancedError('Connection endpoints must remain in one part and staff in v1.', 'RELATION_ENDPOINT_INVALID');
  }
  const startOrdinal = voiceOrdinal(score, target.start);
  const stopOrdinal = voiceOrdinal(score, target.stop);
  if (startOrdinal !== stopOrdinal) {
    throw new EditorKeypadAdvancedError('Connection endpoints must use the same voice ordinal in v1.', 'RELATION_ENDPOINT_INVALID', { startOrdinal, stopOrdinal });
  }
  const eventIds = logicalVoiceEventIds(score, target.start, startOrdinal);
  const startIndex = eventIds.indexOf(target.start.eventId);
  const stopIndex = eventIds.indexOf(target.stop.eventId);
  if (startIndex < 0 || stopIndex <= startIndex) {
    throw new EditorKeypadAdvancedError('Connection stop must occur after the explicit start in canonical voice order.', 'RELATION_ENDPOINT_INVALID', { startIndex, stopIndex });
  }
  const startNote = noteValue(score, target.start);
  const stopNote = noteValue(score, target.stop);
  if (relation === 'tie') {
    if (stopIndex !== startIndex + 1) {
      throw new EditorKeypadAdvancedError('Tie v1 requires consecutive canonical events in the same logical voice.', 'RELATION_ENDPOINT_INVALID', { startIndex, stopIndex });
    }
    if (startNote.pitch.step !== stopNote.pitch.step || startNote.pitch.alter !== stopNote.pitch.alter || startNote.pitch.octave !== stopNote.pitch.octave) {
      throw new EditorKeypadAdvancedError('Tie endpoints must have exactly the same canonical pitch.', 'RELATION_ENDPOINT_INVALID');
    }
  }

  const startMarks = relationMarks(notation, target.start.noteId, relation);
  const stopMarks = relationMarks(notation, target.stop.noteId, relation);
  const shared = sharedRelationNumbers(startMarks, stopMarks);
  if (shared.length > 1) {
    throw new EditorKeypadAdvancedError('Explicit connection matches multiple existing relations.', 'RELATION_AMBIGUOUS', { shared });
  }

  let nextStart: readonly BoundaryMark[];
  let nextStop: readonly BoundaryMark[];
  if (shared.length === 1) {
    const number = shared[0]!;
    nextStart = sortedMarks(startMarks.filter((mark) => !(mark.number === number && mark.type === 'start')));
    nextStop = sortedMarks(stopMarks.filter((mark) => !(mark.number === number && mark.type === 'stop')));
  } else {
    if (relation === 'tie') {
      const existingOutgoing = startMarks.some((mark) => mark.type === 'start');
      const existingIncoming = stopMarks.some((mark) => mark.type === 'stop');
      if (existingOutgoing || existingIncoming) {
        throw new EditorKeypadAdvancedError('Tie endpoint already participates in another outgoing/incoming tie.', 'RELATION_AMBIGUOUS');
      }
    }
    const number = nextRelationNumber(startMarks, stopMarks);
    nextStart = sortedMarks([...startMarks, Object.freeze({ number, type: 'start' as const })]);
    nextStop = sortedMarks([...stopMarks, Object.freeze({ number, type: 'stop' as const })]);
  }

  const commandType = relation === 'tie' ? 'SET_TIES' as const : 'SET_SLURS' as const;
  const commands: readonly NotationCommand[] = Object.freeze([
    Object.freeze({
      commandVersion: NOTATION_COMMAND_VERSION,
      commandId: notationCommandId(identity, 1),
      type: commandType,
      target: target.start,
      value: nextStart
    }) as NotationCommand,
    Object.freeze({
      commandVersion: NOTATION_COMMAND_VERSION,
      commandId: notationCommandId(identity, 2),
      type: commandType,
      target: target.stop,
      value: nextStop
    }) as NotationCommand
  ]);
  return applyNotationCommands(score, notation, identity, commands);
};

export const executeAdvancedEditorKeypadAction = (
  score: ScoreDocument,
  notation: NotationDocument,
  selection: SelectionSnapshot,
  rawAction: unknown,
  rawIdentity: unknown,
  rawTarget: unknown
): Readonly<EditorKeypadExecutionResult> => {
  const action: Readonly<EditorKeypadAction> = parseEditorKeypadAction(rawAction);
  if (!isAdvancedEditorKeypadActionId(action.actionId)) {
    throw new EditorKeypadAdvancedError('Action does not belong to the advanced explicit-target keypad surface.', 'ACTION_NOT_ADVANCED', { actionId: action.actionId });
  }
  const identity = parseEditorKeypadCommitIdentity(rawIdentity);
  const primary = assertCurrent(score, notation, selection);
  const target = parseEditorKeypadAdvancedTarget(score, rawTarget);

  let result: { readonly score: Readonly<ScoreDocument>; readonly notation: Readonly<NotationDocument> };
  if (action.actionId === 'tuplet.triplet') {
    if (target.kind !== 'EVENT_RANGE') throw new EditorKeypadAdvancedError('Triplet action requires EVENT_RANGE target.', 'INVALID_TARGET_SPEC');
    result = tripletResult(score, notation, primary, target, identity);
  } else if (action.actionId === 'tie.edit') {
    if (target.kind !== 'NOTE_PAIR') throw new EditorKeypadAdvancedError('Tie action requires NOTE_PAIR target.', 'INVALID_TARGET_SPEC');
    result = connectionResult(score, notation, primary, target, identity, 'tie');
  } else if (action.actionId === 'slur.edit') {
    if (target.kind !== 'NOTE_PAIR') throw new EditorKeypadAdvancedError('Slur action requires NOTE_PAIR target.', 'INVALID_TARGET_SPEC');
    result = connectionResult(score, notation, primary, target, identity, 'slur');
  } else {
    throw new EditorKeypadAdvancedError('Advanced keypad action is unsupported.', 'ACTION_NOT_ADVANCED', { actionId: action.actionId });
  }

  return Object.freeze({
    version: EDITOR_KEYPAD_EXECUTION_VERSION,
    action,
    score: result.score,
    notation: result.notation
  });
};
