import { createScoreDocument } from '../../score-model/src/index.js';
import type { Pitch, Rational, ScoreDocument, ScoreEvent } from '../../score-model/src/index.js';
import { resolveSemanticAddress } from '../../addressing/src/index.js';
import type { EventAddress, NoteAddress, SemanticAddress } from '../../addressing/src/index.js';

export const EDIT_COMMAND_VERSION = '1.0.0' as const;
export const EDIT_TRANSACTION_VERSION = '1.0.0' as const;
export const MAX_COMMANDS_PER_TRANSACTION = 256;

export interface SetNotePitchCommand {
  readonly commandVersion: typeof EDIT_COMMAND_VERSION;
  readonly commandId: string;
  readonly type: 'SET_NOTE_PITCH';
  readonly target: NoteAddress;
  readonly pitch: Pitch;
}

export interface SetEventDurationCommand {
  readonly commandVersion: typeof EDIT_COMMAND_VERSION;
  readonly commandId: string;
  readonly type: 'SET_EVENT_DURATION';
  readonly target: EventAddress;
  readonly duration: Rational;
}

export interface ReplaceEventWithRestCommand {
  readonly commandVersion: typeof EDIT_COMMAND_VERSION;
  readonly commandId: string;
  readonly type: 'REPLACE_EVENT_WITH_REST';
  readonly target: EventAddress;
}

export interface ReplaceRestWithNoteCommand {
  readonly commandVersion: typeof EDIT_COMMAND_VERSION;
  readonly commandId: string;
  readonly type: 'REPLACE_REST_WITH_NOTE';
  readonly target: EventAddress;
  readonly noteId: string;
  readonly pitch: Pitch;
}

export interface AddChordToneCommand {
  readonly commandVersion: typeof EDIT_COMMAND_VERSION;
  readonly commandId: string;
  readonly type: 'ADD_CHORD_TONE';
  readonly target: EventAddress;
  readonly noteId: string;
  readonly pitch: Pitch;
}

export interface RemoveChordToneCommand {
  readonly commandVersion: typeof EDIT_COMMAND_VERSION;
  readonly commandId: string;
  readonly type: 'REMOVE_CHORD_TONE';
  readonly target: NoteAddress;
}

export type ScoreEditCommand =
  | SetNotePitchCommand
  | SetEventDurationCommand
  | ReplaceEventWithRestCommand
  | ReplaceRestWithNoteCommand
  | AddChordToneCommand
  | RemoveChordToneCommand;

export interface EditTransaction {
  readonly contractVersion: typeof EDIT_TRANSACTION_VERSION;
  readonly transactionId: string;
  readonly documentId: string;
  readonly baseRevisionId: string;
  readonly nextRevisionId: string;
  readonly commands: readonly ScoreEditCommand[];
}

export type EditErrorCode =
  | 'INVALID_TRANSACTION'
  | 'STALE_TRANSACTION'
  | 'COMMAND_TARGET_KIND'
  | 'COMMAND_PRECONDITION'
  | 'REVISION_ID_CONFLICT'
  | 'TARGET_DISAPPEARED'
  | 'RESULT_INVALID';

export class EditTransactionError extends Error {
  readonly code: EditErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: EditErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'EditTransactionError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const ensureId = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    throw new EditTransactionError('Edit identifier is invalid.', 'INVALID_TRANSACTION', { field });
  }
  return value;
};

const validPitch = (pitch: Pitch): boolean =>
  ['A','B','C','D','E','F','G'].includes(pitch.step) && Number.isInteger(pitch.alter) && pitch.alter >= -2 && pitch.alter <= 2 && Number.isInteger(pitch.octave) && pitch.octave >= -1 && pitch.octave <= 9;

const gcd = (a: number, b: number): number => {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right !== 0) [left, right] = [right, left % right];
  return left;
};

const validRational = (value: Rational): boolean =>
  Number.isSafeInteger(value.numerator) && Number.isSafeInteger(value.denominator) && value.numerator > 0 && value.denominator > 0 && gcd(value.numerator, value.denominator) === 1;

const expectedFields: Readonly<Record<ScoreEditCommand['type'], readonly string[]>> = Object.freeze({
  SET_NOTE_PITCH: ['commandVersion','commandId','type','target','pitch'],
  SET_EVENT_DURATION: ['commandVersion','commandId','type','target','duration'],
  REPLACE_EVENT_WITH_REST: ['commandVersion','commandId','type','target'],
  REPLACE_REST_WITH_NOTE: ['commandVersion','commandId','type','target','noteId','pitch'],
  ADD_CHORD_TONE: ['commandVersion','commandId','type','target','noteId','pitch'],
  REMOVE_CHORD_TONE: ['commandVersion','commandId','type','target']
});

const assertExactFields = (value: object, expected: readonly string[], label: string): void => {
  const observed = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(observed) !== JSON.stringify(wanted)) {
    throw new EditTransactionError(`${label} field set is invalid.`, 'INVALID_TRANSACTION', { observed, expected: wanted });
  }
};

const validateCommand = (command: ScoreEditCommand): void => {
  if (command === null || typeof command !== 'object' || Array.isArray(command)) {
    throw new EditTransactionError('Edit command must be an object.', 'INVALID_TRANSACTION');
  }
  if (!(command.type in expectedFields)) throw new EditTransactionError('Edit command type is unsupported.', 'INVALID_TRANSACTION');
  assertExactFields(command, expectedFields[command.type], 'Edit command');
  if (command.commandVersion !== EDIT_COMMAND_VERSION) throw new EditTransactionError('Edit command version is unsupported.', 'INVALID_TRANSACTION');
  ensureId(command.commandId, 'commandId');
  if (command.type === 'SET_NOTE_PITCH' || command.type === 'REPLACE_REST_WITH_NOTE' || command.type === 'ADD_CHORD_TONE') {
    if (!validPitch(command.pitch)) throw new EditTransactionError('Command pitch is invalid.', 'INVALID_TRANSACTION', { commandId: command.commandId });
  }
  if (command.type === 'SET_EVENT_DURATION' && !validRational(command.duration)) {
    throw new EditTransactionError('Command duration is invalid or non-canonical.', 'INVALID_TRANSACTION', { commandId: command.commandId });
  }
  if (command.type === 'REPLACE_REST_WITH_NOTE' || command.type === 'ADD_CHORD_TONE') ensureId(command.noteId, 'noteId');
};

const validateTransaction = (document: ScoreDocument, transaction: EditTransaction): void => {
  if (transaction === null || typeof transaction !== 'object' || Array.isArray(transaction)) throw new EditTransactionError('Edit transaction must be an object.', 'INVALID_TRANSACTION');
  assertExactFields(transaction, ['contractVersion','transactionId','documentId','baseRevisionId','nextRevisionId','commands'], 'Edit transaction');
  if (transaction.contractVersion !== EDIT_TRANSACTION_VERSION) throw new EditTransactionError('Edit transaction version is unsupported.', 'INVALID_TRANSACTION');
  ensureId(transaction.transactionId, 'transactionId');
  ensureId(transaction.documentId, 'documentId');
  ensureId(transaction.baseRevisionId, 'baseRevisionId');
  ensureId(transaction.nextRevisionId, 'nextRevisionId');
  if (transaction.documentId !== document.id || transaction.baseRevisionId !== document.revision.id) {
    throw new EditTransactionError('Edit transaction does not target the current document revision.', 'STALE_TRANSACTION', {
      documentId: document.id,
      revisionId: document.revision.id
    });
  }
  if (transaction.nextRevisionId === transaction.baseRevisionId || transaction.nextRevisionId === document.revision.parentId) {
    throw new EditTransactionError('Next revision id conflicts with current revision lineage.', 'REVISION_ID_CONFLICT');
  }
  if (!Array.isArray(transaction.commands) || transaction.commands.length === 0 || transaction.commands.length > MAX_COMMANDS_PER_TRANSACTION) {
    throw new EditTransactionError('Edit transaction command count is outside admitted bounds.', 'INVALID_TRANSACTION', {
      count: Array.isArray(transaction.commands) ? transaction.commands.length : null,
      max: MAX_COMMANDS_PER_TRANSACTION
    });
  }
  const commandIds = new Set<string>();
  for (const command of transaction.commands) {
    validateCommand(command);
    if (commandIds.has(command.commandId)) throw new EditTransactionError('Edit command ids must be unique within a transaction.', 'INVALID_TRANSACTION', { commandId: command.commandId });
    commandIds.add(command.commandId);
    const resolved = resolveSemanticAddress(document, command.target as SemanticAddress);
    const expectedKind = command.type === 'SET_NOTE_PITCH' || command.type === 'REMOVE_CHORD_TONE' ? 'note' : 'event';
    if (resolved.kind !== expectedKind) throw new EditTransactionError('Edit command target kind is invalid.', 'COMMAND_TARGET_KIND', { commandId: command.commandId, expectedKind, observed: resolved.kind });
  }
};

const replaceEvent = (document: ScoreDocument, eventId: string, transform: (event: ScoreEvent) => ScoreEvent): ScoreDocument => ({
  ...document,
  parts: document.parts.map((part) => ({
    ...part,
    staves: part.staves.map((staff) => ({
      ...staff,
      measures: staff.measures.map((measure) => ({
        ...measure,
        voices: measure.voices.map((voice) => ({
          ...voice,
          events: voice.events.map((event) => event.id === eventId ? transform(event) : event)
        }))
      }))
    }))
  }))
});

const replaceNote = (document: ScoreDocument, noteId: string, transform: (note: { readonly id: string; readonly pitch: Pitch }) => { readonly id: string; readonly pitch: Pitch }): ScoreDocument => ({
  ...document,
  parts: document.parts.map((part) => ({
    ...part,
    staves: part.staves.map((staff) => ({
      ...staff,
      measures: staff.measures.map((measure) => ({
        ...measure,
        voices: measure.voices.map((voice) => ({
          ...voice,
          events: voice.events.map((event) => {
            if (event.kind === 'note' && event.note.id === noteId) return { ...event, note: transform(event.note) };
            if (event.kind === 'chord' && event.notes.some((note) => note.id === noteId)) return { ...event, notes: event.notes.map((note) => note.id === noteId ? transform(note) : note) };
            return event;
          })
        }))
      }))
    }))
  }))
});

const eventExists = (document: ScoreDocument, eventId: string): boolean => document.parts.some((part) => part.staves.some((staff) => staff.measures.some((measure) => measure.voices.some((voice) => voice.events.some((event) => event.id === eventId)))));
const noteExists = (document: ScoreDocument, noteId: string): boolean => document.parts.some((part) => part.staves.some((staff) => staff.measures.some((measure) => measure.voices.some((voice) => voice.events.some((event) => event.kind === 'note' ? event.note.id === noteId : event.kind === 'chord' && event.notes.some((note) => note.id === noteId))))));

const applyCommand = (draft: ScoreDocument, command: ScoreEditCommand): ScoreDocument => {
  if (command.type === 'SET_NOTE_PITCH') {
    if (!noteExists(draft, command.target.noteId)) throw new EditTransactionError('Command target disappeared during transaction.', 'TARGET_DISAPPEARED', { commandId: command.commandId });
    return replaceNote(draft, command.target.noteId, (note) => ({ ...note, pitch: command.pitch }));
  }
  if (!eventExists(draft, command.target.eventId)) throw new EditTransactionError('Command target disappeared during transaction.', 'TARGET_DISAPPEARED', { commandId: command.commandId });
  if (command.type === 'SET_EVENT_DURATION') return replaceEvent(draft, command.target.eventId, (event) => ({ ...event, duration: command.duration }));
  if (command.type === 'REPLACE_EVENT_WITH_REST') return replaceEvent(draft, command.target.eventId, (event) => ({ id: event.id, kind: 'rest', onset: event.onset, duration: event.duration }));
  if (command.type === 'REPLACE_REST_WITH_NOTE') {
    if (noteExists(draft, command.noteId)) throw new EditTransactionError('New note id already exists.', 'COMMAND_PRECONDITION', { commandId: command.commandId, noteId: command.noteId });
    return replaceEvent(draft, command.target.eventId, (event) => {
      if (event.kind !== 'rest') throw new EditTransactionError('REPLACE_REST_WITH_NOTE requires a rest target.', 'COMMAND_PRECONDITION', { commandId: command.commandId });
      return { id: event.id, kind: 'note', onset: event.onset, duration: event.duration, note: { id: command.noteId, pitch: command.pitch } };
    });
  }
  if (command.type === 'ADD_CHORD_TONE') {
    if (noteExists(draft, command.noteId)) throw new EditTransactionError('New note id already exists.', 'COMMAND_PRECONDITION', { commandId: command.commandId, noteId: command.noteId });
    return replaceEvent(draft, command.target.eventId, (event) => {
      const note = { id: command.noteId, pitch: command.pitch };
      if (event.kind === 'note') return { id: event.id, kind: 'chord', onset: event.onset, duration: event.duration, notes: [event.note, note] };
      if (event.kind === 'chord') return { ...event, notes: [...event.notes, note] };
      throw new EditTransactionError('ADD_CHORD_TONE requires a pitched event.', 'COMMAND_PRECONDITION', { commandId: command.commandId });
    });
  }
  if (!noteExists(draft, command.target.noteId)) throw new EditTransactionError('Command target disappeared during transaction.', 'TARGET_DISAPPEARED', { commandId: command.commandId });
  return replaceEvent(draft, command.target.eventId, (event) => {
    if (event.kind !== 'chord') throw new EditTransactionError('REMOVE_CHORD_TONE requires a chord target.', 'COMMAND_PRECONDITION', { commandId: command.commandId });
    const remaining = event.notes.filter((note) => note.id !== command.target.noteId);
    if (remaining.length === event.notes.length) throw new EditTransactionError('Chord tone target was not found.', 'TARGET_DISAPPEARED', { commandId: command.commandId });
    if (remaining.length === 1) return { id: event.id, kind: 'note', onset: event.onset, duration: event.duration, note: remaining[0]! };
    if (remaining.length >= 2) return { ...event, notes: remaining };
    throw new EditTransactionError('Chord cannot become empty through REMOVE_CHORD_TONE.', 'COMMAND_PRECONDITION', { commandId: command.commandId });
  });
};

export const applyEditTransaction = (document: ScoreDocument, transaction: EditTransaction): Readonly<ScoreDocument> => {
  validateTransaction(document, transaction);
  let draft: ScoreDocument = document;
  for (const command of transaction.commands) draft = applyCommand(draft, command);
  try {
    return createScoreDocument({
      ...draft,
      revision: { id: transaction.nextRevisionId, parentId: document.revision.id }
    });
  } catch (error) {
    throw new EditTransactionError('Edit transaction result failed canonical validation.', 'RESULT_INVALID', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
};
