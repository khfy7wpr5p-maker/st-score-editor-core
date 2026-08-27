import type { Pitch, Rational, ScoreDocument } from '../../score-model/src/index.js';
import { addressEntity, resolveSemanticAddress } from '../../addressing/src/index.js';
import type { EventAddress, NoteAddress, SelectionSnapshot } from '../../addressing/src/index.js';
import { applyEditTransaction, EDIT_COMMAND_VERSION, EDIT_TRANSACTION_VERSION } from '../../commands/src/index.js';
import type { EditTransaction, ScoreEditCommand } from '../../commands/src/index.js';

export const EDITOR_SCORE_INTENT_VERSION = '1.0.0' as const;

export type EditorScoreIntent =
  | { readonly version: typeof EDITOR_SCORE_INTENT_VERSION; readonly type: 'SET_PITCH'; readonly pitch: Pitch }
  | { readonly version: typeof EDITOR_SCORE_INTENT_VERSION; readonly type: 'SET_DURATION'; readonly duration: Rational }
  | { readonly version: typeof EDITOR_SCORE_INTENT_VERSION; readonly type: 'REPLACE_WITH_REST' }
  | { readonly version: typeof EDITOR_SCORE_INTENT_VERSION; readonly type: 'REPLACE_REST_WITH_NOTE'; readonly noteId: string; readonly pitch: Pitch }
  | { readonly version: typeof EDITOR_SCORE_INTENT_VERSION; readonly type: 'ADD_CHORD_TONE'; readonly noteId: string; readonly pitch: Pitch }
  | { readonly version: typeof EDITOR_SCORE_INTENT_VERSION; readonly type: 'REMOVE_CHORD_TONE' };

export interface EditorCommitIdentity {
  readonly transactionId: string;
  readonly commandId: string;
  readonly nextRevisionId: string;
}

export type EditorIntentErrorCode =
  | 'INVALID_INTENT'
  | 'STALE_SELECTION'
  | 'NO_SELECTION'
  | 'SELECTION_KIND'
  | 'INVALID_COMMIT_IDENTITY';

export class EditorIntentError extends Error {
  readonly code: EditorIntentErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: EditorIntentErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'EditorIntentError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactFields = (value: UnknownRecord, expected: readonly string[]): boolean => JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
const validId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim() && value.length <= 128;
const validPitch = (value: unknown): value is Pitch => {
  if (!isRecord(value) || !exactFields(value, ['step','alter','octave'])) return false;
  return typeof value.step === 'string' && ['A','B','C','D','E','F','G'].includes(value.step) &&
    typeof value.alter === 'number' && Number.isInteger(value.alter) && value.alter >= -2 && value.alter <= 2 &&
    typeof value.octave === 'number' && Number.isInteger(value.octave) && value.octave >= -1 && value.octave <= 9;
};
const gcd=(a:number,b:number):number=>{let x=Math.abs(a),y=Math.abs(b);while(y!==0)[x,y]=[y,x%y];return x;};
const validRational = (value: unknown): value is Rational => {
  if (!isRecord(value) || !exactFields(value, ['numerator','denominator'])) return false;
  return typeof value.numerator === 'number' && Number.isSafeInteger(value.numerator) && value.numerator > 0 &&
    typeof value.denominator === 'number' && Number.isSafeInteger(value.denominator) && value.denominator > 0 &&
    gcd(value.numerator, value.denominator) === 1;
};

export const parseEditorScoreIntent = (input: unknown): Readonly<EditorScoreIntent> => {
  if (!isRecord(input) || input.version !== EDITOR_SCORE_INTENT_VERSION || typeof input.type !== 'string') {
    throw new EditorIntentError('Editor score intent envelope is invalid.', 'INVALID_INTENT');
  }
  let result: EditorScoreIntent;
  if (input.type === 'SET_PITCH' && exactFields(input,['version','type','pitch']) && validPitch(input.pitch)) result={version:EDITOR_SCORE_INTENT_VERSION,type:'SET_PITCH',pitch:input.pitch};
  else if (input.type === 'SET_DURATION' && exactFields(input,['version','type','duration']) && validRational(input.duration)) result={version:EDITOR_SCORE_INTENT_VERSION,type:'SET_DURATION',duration:input.duration};
  else if (input.type === 'REPLACE_WITH_REST' && exactFields(input,['version','type'])) result={version:EDITOR_SCORE_INTENT_VERSION,type:'REPLACE_WITH_REST'};
  else if (input.type === 'REPLACE_REST_WITH_NOTE' && exactFields(input,['version','type','noteId','pitch']) && validId(input.noteId) && validPitch(input.pitch)) result={version:EDITOR_SCORE_INTENT_VERSION,type:'REPLACE_REST_WITH_NOTE',noteId:input.noteId,pitch:input.pitch};
  else if (input.type === 'ADD_CHORD_TONE' && exactFields(input,['version','type','noteId','pitch']) && validId(input.noteId) && validPitch(input.pitch)) result={version:EDITOR_SCORE_INTENT_VERSION,type:'ADD_CHORD_TONE',noteId:input.noteId,pitch:input.pitch};
  else if (input.type === 'REMOVE_CHORD_TONE' && exactFields(input,['version','type'])) result={version:EDITOR_SCORE_INTENT_VERSION,type:'REMOVE_CHORD_TONE'};
  else throw new EditorIntentError('Editor score intent fields or values are invalid.', 'INVALID_INTENT', { type: input.type });
  return Object.freeze(result);
};

const assertSelection = (score: ScoreDocument, selection: SelectionSnapshot): void => {
  if (selection.documentId !== score.id || selection.revisionId !== score.revision.id) {
    throw new EditorIntentError('Editor selection is stale or belongs to another document.', 'STALE_SELECTION');
  }
  if (selection.primary === null) throw new EditorIntentError('Editor score intent requires a semantic selection.', 'NO_SELECTION');
  resolveSemanticAddress(score, selection.primary);
};

const eventTarget = (score: ScoreDocument, selection: SelectionSnapshot): EventAddress => {
  const primary = selection.primary;
  if (primary === null) throw new EditorIntentError('Editor score intent requires a semantic selection.', 'NO_SELECTION');
  if (primary.kind === 'event') return primary;
  if (primary.kind === 'note') {
    const address = addressEntity(score, primary.eventId);
    if (address.kind === 'event') return address;
  }
  throw new EditorIntentError('Selected entity cannot be used as an event target.', 'SELECTION_KIND', { kind: primary.kind });
};

const noteTarget = (selection: SelectionSnapshot): NoteAddress => {
  const primary = selection.primary;
  if (primary?.kind !== 'note') throw new EditorIntentError('Selected entity must be a note.', 'SELECTION_KIND', { kind: primary?.kind ?? null });
  return primary;
};

const assertCommitIdentity = (identity: EditorCommitIdentity): void => {
  if (!validId(identity.transactionId) || !validId(identity.commandId) || !validId(identity.nextRevisionId)) {
    throw new EditorIntentError('Commit identity contains an invalid id.', 'INVALID_COMMIT_IDENTITY');
  }
};

const commandFor = (score: ScoreDocument, selection: SelectionSnapshot, intent: EditorScoreIntent, commandId: string): ScoreEditCommand => {
  if (intent.type === 'SET_PITCH') return { commandVersion:EDIT_COMMAND_VERSION,commandId,type:'SET_NOTE_PITCH',target:noteTarget(selection),pitch:intent.pitch };
  if (intent.type === 'SET_DURATION') return { commandVersion:EDIT_COMMAND_VERSION,commandId,type:'SET_EVENT_DURATION',target:eventTarget(score,selection),duration:intent.duration };
  if (intent.type === 'REPLACE_WITH_REST') return { commandVersion:EDIT_COMMAND_VERSION,commandId,type:'REPLACE_EVENT_WITH_REST',target:eventTarget(score,selection) };
  if (intent.type === 'REPLACE_REST_WITH_NOTE') return { commandVersion:EDIT_COMMAND_VERSION,commandId,type:'REPLACE_REST_WITH_NOTE',target:eventTarget(score,selection),noteId:intent.noteId,pitch:intent.pitch };
  if (intent.type === 'ADD_CHORD_TONE') return { commandVersion:EDIT_COMMAND_VERSION,commandId,type:'ADD_CHORD_TONE',target:eventTarget(score,selection),noteId:intent.noteId,pitch:intent.pitch };
  return { commandVersion:EDIT_COMMAND_VERSION,commandId,type:'REMOVE_CHORD_TONE',target:noteTarget(selection) };
};

export const executeEditorScoreIntent = (
  score: ScoreDocument,
  selection: SelectionSnapshot,
  rawIntent: unknown,
  identity: EditorCommitIdentity
): Readonly<ScoreDocument> => {
  assertSelection(score, selection);
  assertCommitIdentity(identity);
  const intent = parseEditorScoreIntent(rawIntent);
  const command = commandFor(score, selection, intent, identity.commandId);
  const transaction: EditTransaction = Object.freeze({
    contractVersion: EDIT_TRANSACTION_VERSION,
    transactionId: identity.transactionId,
    documentId: score.id,
    baseRevisionId: score.revision.id,
    nextRevisionId: identity.nextRevisionId,
    commands: Object.freeze([Object.freeze(command)])
  });
  return applyEditTransaction(score, transaction);
};
