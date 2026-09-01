import type { Rational, ScoreDocument, ScoreEvent } from '../../score-model/src/index.js';
import { addressEntity, resolveSemanticAddress } from '../../addressing/src/index.js';
import type { EventAddress, NoteAddress, SelectionSnapshot, SemanticAddress } from '../../addressing/src/index.js';
import {
  applyEditTransaction,
  EDIT_COMMAND_VERSION,
  EDIT_TRANSACTION_VERSION
} from '../../commands/src/index.js';
import type { EditTransaction, ScoreEditCommand } from '../../commands/src/index.js';
import {
  createNotationDocument,
  notationForEvent,
  NOTATION_DOCUMENT_VERSION
} from '../../notation-structure/src/index.js';
import type { NotationDocument } from '../../notation-structure/src/index.js';
import {
  applyNotationTransaction,
  NOTATION_COMMAND_VERSION,
  NOTATION_TRANSACTION_VERSION
} from '../../notation-commands/src/index.js';
import type { NotationCommand, NotationTransaction } from '../../notation-commands/src/index.js';
import { parseEditorKeypadAction } from '../../editor-keypad/src/index.js';
import type { EditorKeypadAction, EditorKeypadActionId } from '../../editor-keypad/src/index.js';

export const EDITOR_KEYPAD_EXECUTION_VERSION = '1.0.0' as const;

export interface EditorKeypadCommitIdentity {
  readonly version: typeof EDITOR_KEYPAD_EXECUTION_VERSION;
  readonly transactionId: string;
  readonly nextRevisionId: string;
}

export interface EditorKeypadExecutionResult {
  readonly version: typeof EDITOR_KEYPAD_EXECUTION_VERSION;
  readonly action: Readonly<EditorKeypadAction>;
  readonly score: Readonly<ScoreDocument>;
  readonly notation: Readonly<NotationDocument>;
}

export type EditorKeypadExecutionErrorCode =
  | 'INVALID_COMMIT_IDENTITY'
  | 'STALE_SELECTION'
  | 'STALE_NOTATION'
  | 'NO_SELECTION'
  | 'SELECTION_KIND'
  | 'ACTION_NOT_IMPLEMENTED'
  | 'DURATION_DOT_INCONSISTENCY'
  | 'NOTATION_REBIND_FAILED';

export class EditorKeypadExecutionError extends Error {
  readonly code: EditorKeypadExecutionErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, code: EditorKeypadExecutionErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'EditorKeypadExecutionError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

type UnknownRecord = Record<string, unknown>;

const exactFields = (value: unknown, fields: readonly string[], label: string): UnknownRecord => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new EditorKeypadExecutionError(`${label} must be an object.`, 'INVALID_COMMIT_IDENTITY');
  }
  const record = value as UnknownRecord;
  const observed = Object.keys(record).sort();
  const expected = [...fields].sort();
  if (JSON.stringify(observed) !== JSON.stringify(expected)) {
    throw new EditorKeypadExecutionError(`${label} field set is invalid.`, 'INVALID_COMMIT_IDENTITY', { observed, expected });
  }
  return record;
};

const validId = (value: unknown, maxLength: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= maxLength && value === value.trim();

export const parseEditorKeypadCommitIdentity = (input: unknown): Readonly<EditorKeypadCommitIdentity> => {
  const record = exactFields(input, ['version', 'transactionId', 'nextRevisionId'], 'EditorKeypadCommitIdentity');
  if (
    record.version !== EDITOR_KEYPAD_EXECUTION_VERSION ||
    !validId(record.transactionId, 96) ||
    !validId(record.nextRevisionId, 128)
  ) {
    throw new EditorKeypadExecutionError('Editor keypad commit identity is invalid.', 'INVALID_COMMIT_IDENTITY');
  }
  return Object.freeze({
    version: EDITOR_KEYPAD_EXECUTION_VERSION,
    transactionId: record.transactionId,
    nextRevisionId: record.nextRevisionId
  });
};

const SIMPLE_DURATIONS: Readonly<Record<string, Readonly<Rational>>> = Object.freeze({
  whole: Object.freeze({ numerator: 1, denominator: 1 }),
  half: Object.freeze({ numerator: 1, denominator: 2 }),
  quarter: Object.freeze({ numerator: 1, denominator: 4 }),
  eighth: Object.freeze({ numerator: 1, denominator: 8 }),
  '16th': Object.freeze({ numerator: 1, denominator: 16 }),
  '32nd': Object.freeze({ numerator: 1, denominator: 32 })
});

const DOT_FACTORS = Object.freeze([
  Object.freeze({ numerator: 1, denominator: 1 }),
  Object.freeze({ numerator: 3, denominator: 2 }),
  Object.freeze({ numerator: 7, denominator: 4 }),
  Object.freeze({ numerator: 15, denominator: 8 })
] as const);

const gcdBigInt = (left: bigint, right: bigint): bigint => {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
};

const rational = (numerator: bigint, denominator: bigint): Readonly<Rational> => {
  if (numerator <= 0n || denominator <= 0n) {
    throw new EditorKeypadExecutionError('Computed keypad duration is not positive.', 'DURATION_DOT_INCONSISTENCY');
  }
  const divisor = gcdBigInt(numerator, denominator);
  const n = numerator / divisor;
  const d = denominator / divisor;
  if (n > BigInt(Number.MAX_SAFE_INTEGER) || d > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new EditorKeypadExecutionError('Computed keypad duration exceeds canonical safe-integer bounds.', 'DURATION_DOT_INCONSISTENCY');
  }
  return Object.freeze({ numerator: Number(n), denominator: Number(d) });
};

const multiply = (value: Rational, numerator: number, denominator: number): Readonly<Rational> =>
  rational(BigInt(value.numerator) * BigInt(numerator), BigInt(value.denominator) * BigInt(denominator));

const sameRational = (left: Rational, right: Rational): boolean =>
  left.numerator === right.numerator && left.denominator === right.denominator;

const simpleDurationForAction = (actionId: EditorKeypadActionId): Readonly<Rational> | null => {
  const match = /^(?:duration|rest)\.(whole|half|quarter|eighth|16th|32nd)$/.exec(actionId);
  if (match === null) return null;
  const key = match[1];
  if (key === undefined) return null;
  return SIMPLE_DURATIONS[key] ?? null;
};

const dotCountForAction = (actionId: EditorKeypadActionId): 0 | 1 | 2 | 3 | null => {
  const match = /^dot\.set\.([0-3])$/.exec(actionId);
  if (match === null) return null;
  const raw = Number(match[1]);
  return raw === 0 || raw === 1 || raw === 2 || raw === 3 ? raw : null;
};

const alterationForAction = (actionId: EditorKeypadActionId): -1 | 0 | 1 | null => {
  if (actionId === 'accidental.flat') return -1;
  if (actionId === 'accidental.natural') return 0;
  if (actionId === 'accidental.sharp') return 1;
  return null;
};

const assertCurrent = (
  score: ScoreDocument,
  notation: NotationDocument,
  selection: SelectionSnapshot
): SemanticAddress => {
  if (selection.documentId !== score.id || selection.revisionId !== score.revision.id) {
    throw new EditorKeypadExecutionError('Keypad selection is stale or belongs to another document.', 'STALE_SELECTION');
  }
  if (notation.documentId !== score.id || notation.revisionId !== score.revision.id) {
    throw new EditorKeypadExecutionError('Keypad notation is stale or belongs to another score revision.', 'STALE_NOTATION');
  }
  if (selection.primary === null) throw new EditorKeypadExecutionError('Keypad action requires a semantic selection.', 'NO_SELECTION');
  resolveSemanticAddress(score, selection.primary);
  return selection.primary;
};

const eventTarget = (score: ScoreDocument, primary: SemanticAddress): EventAddress => {
  if (primary.kind === 'event') return primary;
  if (primary.kind === 'note') {
    const target = addressEntity(score, primary.eventId);
    if (target.kind === 'event') return target;
  }
  throw new EditorKeypadExecutionError('Keypad action requires an event or note selection.', 'SELECTION_KIND', { kind: primary.kind });
};

const noteTarget = (primary: SemanticAddress): NoteAddress => {
  if (primary.kind !== 'note') {
    throw new EditorKeypadExecutionError('Accidental keypad action requires an exact note selection.', 'SELECTION_KIND', { kind: primary.kind });
  }
  return primary;
};

const eventFor = (score: ScoreDocument, target: EventAddress): ScoreEvent => {
  const resolved = resolveSemanticAddress(score, target);
  if (resolved.kind !== 'event') throw new EditorKeypadExecutionError('Resolved keypad event target changed kind.', 'SELECTION_KIND');
  return resolved.value;
};

const noteIdsForEvent = (event: ScoreEvent): readonly string[] =>
  event.kind === 'note' ? [event.note.id] : event.kind === 'chord' ? event.notes.map((note) => note.id) : [];

const scoreCommandId = (identity: EditorKeypadCommitIdentity, index: 1 | 2): string => `${identity.transactionId}:score:${index}`;
const notationTransactionId = (identity: EditorKeypadCommitIdentity): string => `${identity.transactionId}:notation`;
const notationCommandId = (identity: EditorKeypadCommitIdentity): string => `${identity.transactionId}:notation:1`;

const executeScoreCommands = (
  score: ScoreDocument,
  identity: EditorKeypadCommitIdentity,
  commands: readonly ScoreEditCommand[]
): Readonly<ScoreDocument> => {
  const transaction: EditTransaction = Object.freeze({
    contractVersion: EDIT_TRANSACTION_VERSION,
    transactionId: identity.transactionId,
    documentId: score.id,
    baseRevisionId: score.revision.id,
    nextRevisionId: identity.nextRevisionId,
    commands: Object.freeze([...commands])
  });
  return applyEditTransaction(score, transaction);
};

const executeNotationCommand = (
  score: ScoreDocument,
  notation: NotationDocument,
  identity: EditorKeypadCommitIdentity,
  command: NotationCommand
): Readonly<NotationDocument> => {
  const transaction: NotationTransaction = Object.freeze({
    contractVersion: NOTATION_TRANSACTION_VERSION,
    transactionId: notationTransactionId(identity),
    documentId: score.id,
    baseRevisionId: score.revision.id,
    nextRevisionId: identity.nextRevisionId,
    commands: Object.freeze([Object.freeze(command)])
  });
  return applyNotationTransaction(score, notation, transaction).notation;
};

const rebindMeasure = (score: ScoreDocument, id: string) => {
  const target = addressEntity(score, id);
  if (target.kind !== 'measure') throw new EditorKeypadExecutionError('Measure notation target changed kind during keypad commit.', 'NOTATION_REBIND_FAILED', { id, observed: target.kind });
  return target;
};

const rebindEvent = (score: ScoreDocument, id: string) => {
  const target = addressEntity(score, id);
  if (target.kind !== 'event') throw new EditorKeypadExecutionError('Event notation target changed kind during keypad commit.', 'NOTATION_REBIND_FAILED', { id, observed: target.kind });
  return target;
};

const rebindNote = (score: ScoreDocument, id: string) => {
  const target = addressEntity(score, id);
  if (target.kind !== 'note') throw new EditorKeypadExecutionError('Note notation target changed kind during keypad commit.', 'NOTATION_REBIND_FAILED', { id, observed: target.kind });
  return target;
};

const notationOnEditedScore = (
  nextScore: ScoreDocument,
  candidate: NotationDocument,
  allowedRemovedNoteIds: ReadonlySet<string>
): Readonly<NotationDocument> => {
  try {
    const notes = candidate.notes.flatMap((entry) => {
      try {
        return [{ target: rebindNote(nextScore, entry.target.noteId), notation: entry.notation }];
      } catch (error) {
        if (allowedRemovedNoteIds.has(entry.target.noteId)) return [];
        throw error;
      }
    });
    return createNotationDocument(nextScore, {
      contractVersion: NOTATION_DOCUMENT_VERSION,
      documentId: nextScore.id,
      revisionId: nextScore.revision.id,
      measures: candidate.measures.map((entry) => ({ target: rebindMeasure(nextScore, entry.target.measureId), notation: entry.notation })),
      events: candidate.events.map((entry) => ({ target: rebindEvent(nextScore, entry.target.eventId), notation: entry.notation })),
      notes
    });
  } catch (error) {
    if (error instanceof EditorKeypadExecutionError) throw error;
    throw new EditorKeypadExecutionError('Notation could not be rebound to the keypad score result.', 'NOTATION_REBIND_FAILED', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
};

const durationAndDotsResult = (
  score: ScoreDocument,
  notation: NotationDocument,
  primary: SemanticAddress,
  duration: Rational,
  dots: 0 | 1 | 2 | 3,
  identity: EditorKeypadCommitIdentity,
  replaceWithRest: boolean
): Readonly<EditorKeypadExecutionResult>['score' | 'notation'] extends never ? never : { readonly score: Readonly<ScoreDocument>; readonly notation: Readonly<NotationDocument> } => {
  const target = eventTarget(score, primary);
  const event = eventFor(score, target);
  const scoreCommands: ScoreEditCommand[] = [];
  if (replaceWithRest && event.kind !== 'rest') {
    scoreCommands.push(Object.freeze({
      commandVersion: EDIT_COMMAND_VERSION,
      commandId: scoreCommandId(identity, 1),
      type: 'REPLACE_EVENT_WITH_REST',
      target
    }));
    scoreCommands.push(Object.freeze({
      commandVersion: EDIT_COMMAND_VERSION,
      commandId: scoreCommandId(identity, 2),
      type: 'SET_EVENT_DURATION',
      target,
      duration
    }));
  } else {
    scoreCommands.push(Object.freeze({
      commandVersion: EDIT_COMMAND_VERSION,
      commandId: scoreCommandId(identity, 1),
      type: 'SET_EVENT_DURATION',
      target,
      duration
    }));
  }
  const nextScore = executeScoreCommands(score, identity, scoreCommands);
  const notationCandidate = executeNotationCommand(score, notation, identity, Object.freeze({
    commandVersion: NOTATION_COMMAND_VERSION,
    commandId: notationCommandId(identity),
    type: 'SET_DOTS',
    target,
    value: dots
  }));
  const removedNotes = replaceWithRest && event.kind !== 'rest' ? new Set(noteIdsForEvent(event)) : new Set<string>();
  return Object.freeze({ score: nextScore, notation: notationOnEditedScore(nextScore, notationCandidate, removedNotes) });
};

const dottedDuration = (event: ScoreEvent, currentDots: number, requestedDots: 0 | 1 | 2 | 3): Readonly<Rational> => {
  if (currentDots < 0 || currentDots > 3 || !Number.isSafeInteger(currentDots)) {
    throw new EditorKeypadExecutionError('Current dot metadata is outside the admitted keypad range.', 'DURATION_DOT_INCONSISTENCY', { currentDots });
  }
  const currentFactor = DOT_FACTORS[currentDots];
  const requestedFactor = DOT_FACTORS[requestedDots];
  if (currentFactor === undefined || requestedFactor === undefined) {
    throw new EditorKeypadExecutionError('Dot factor is unavailable.', 'DURATION_DOT_INCONSISTENCY');
  }
  const base = multiply(event.duration, currentFactor.denominator, currentFactor.numerator);
  const admittedBase = Object.values(SIMPLE_DURATIONS).find((value) => sameRational(value, base));
  if (admittedBase === undefined) {
    throw new EditorKeypadExecutionError('Current duration/dot state does not resolve to an admitted simple keypad value.', 'DURATION_DOT_INCONSISTENCY', {
      duration: event.duration,
      currentDots
    });
  }
  return multiply(admittedBase, requestedFactor.numerator, requestedFactor.denominator);
};

export const executeEditorKeypadAction = (
  score: ScoreDocument,
  notation: NotationDocument,
  selection: SelectionSnapshot,
  rawAction: unknown,
  rawIdentity: unknown
): Readonly<EditorKeypadExecutionResult> => {
  const action = parseEditorKeypadAction(rawAction);
  const identity = parseEditorKeypadCommitIdentity(rawIdentity);
  const primary = assertCurrent(score, notation, selection);

  const simpleDuration = simpleDurationForAction(action.actionId);
  if (simpleDuration !== null) {
    const replaceWithRest = action.actionId.startsWith('rest.');
    const result = durationAndDotsResult(score, notation, primary, simpleDuration, 0, identity, replaceWithRest);
    return Object.freeze({ version: EDITOR_KEYPAD_EXECUTION_VERSION, action, score: result.score, notation: result.notation });
  }

  const alter = alterationForAction(action.actionId);
  if (alter !== null) {
    const target = noteTarget(primary);
    const resolved = resolveSemanticAddress(score, target);
    if (resolved.kind !== 'note') throw new EditorKeypadExecutionError('Selected accidental target changed kind.', 'SELECTION_KIND');
    const nextScore = executeScoreCommands(score, identity, [Object.freeze({
      commandVersion: EDIT_COMMAND_VERSION,
      commandId: scoreCommandId(identity, 1),
      type: 'SET_NOTE_PITCH',
      target,
      pitch: Object.freeze({ ...resolved.value.pitch, alter })
    })]);
    const display = alter === -1 ? 'flat' : alter === 0 ? 'natural' : 'sharp';
    const notationCandidate = executeNotationCommand(score, notation, identity, Object.freeze({
      commandVersion: NOTATION_COMMAND_VERSION,
      commandId: notationCommandId(identity),
      type: 'SET_ACCIDENTAL',
      target,
      value: display
    }));
    const nextNotation = notationOnEditedScore(nextScore, notationCandidate, new Set<string>());
    return Object.freeze({ version: EDITOR_KEYPAD_EXECUTION_VERSION, action, score: nextScore, notation: nextNotation });
  }

  const requestedDots = dotCountForAction(action.actionId);
  if (requestedDots !== null) {
    const target = eventTarget(score, primary);
    const event = eventFor(score, target);
    const currentDots = notationForEvent(notation, target.eventId)?.dots ?? 0;
    const nextDuration = dottedDuration(event, currentDots, requestedDots);
    const result = durationAndDotsResult(score, notation, primary, nextDuration, requestedDots, identity, false);
    return Object.freeze({ version: EDITOR_KEYPAD_EXECUTION_VERSION, action, score: result.score, notation: result.notation });
  }

  throw new EditorKeypadExecutionError('Keypad action is admitted by the descriptor contract but not implemented by SEC-KP-02/03/04.', 'ACTION_NOT_IMPLEMENTED', { actionId: action.actionId });
};
