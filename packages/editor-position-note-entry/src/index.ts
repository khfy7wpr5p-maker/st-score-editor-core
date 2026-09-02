import { createScoreDocument } from '../../score-model/src/index.js';
import type { Pitch, Rational, ScoreDocument, ScoreEvent } from '../../score-model/src/index.js';
import { createSemanticAddressIndex } from '../../addressing/src/index.js';
import type { NotationDocument } from '../../notation-structure/src/index.js';
import { resolveInsertionPosition } from '../../editor-insertion-position/src/index.js';
import type { InsertionPosition } from '../../editor-insertion-position/src/index.js';
import { classifyInsertionWindow } from '../../editor-measure-timing/src/index.js';

export const POSITION_NOTE_ENTRY_VERSION = '1.0.0' as const;

export interface EnterNoteAtPositionIntent {
  readonly version: typeof POSITION_NOTE_ENTRY_VERSION;
  readonly type: 'ENTER_NOTE_AT_POSITION';
  readonly noteId: string;
  readonly pitch: Pitch;
  readonly duration: Rational;
  readonly leadingRestEventId: string | null;
  readonly trailingRestEventId: string | null;
}

export interface PositionNoteEntryCommitIdentity {
  readonly operationId: string;
  readonly nextRevisionId: string;
}

export type PositionNoteEntryErrorCode =
  | 'INVALID_INTENT'
  | 'INVALID_COMMIT_IDENTITY'
  | 'WINDOW_NOT_AUTHORIZED'
  | 'TARGET_REST_MISSING'
  | 'LEADING_REST_ID_REQUIRED'
  | 'LEADING_REST_ID_UNEXPECTED'
  | 'TRAILING_REST_ID_REQUIRED'
  | 'TRAILING_REST_ID_UNEXPECTED'
  | 'ID_CONFLICT'
  | 'RATIONAL_ARITHMETIC'
  | 'RESULT_INVALID';

export class PositionNoteEntryError extends Error {
  readonly code: PositionNoteEntryErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, code: PositionNoteEntryErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'PositionNoteEntryError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const exactFields = (value: UnknownRecord, expected: readonly string[]): boolean =>
  JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());

const validId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim() && value.length <= 128;

const absBig = (value: bigint): bigint => value < 0n ? -value : value;
const gcdBig = (left: bigint, right: bigint): bigint => {
  let a = absBig(left);
  let b = absBig(right);
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
};

const validPositiveRational = (value: unknown): value is Rational => {
  if (!isRecord(value) || !exactFields(value, ['numerator', 'denominator'])) return false;
  if (typeof value.numerator !== 'number' || !Number.isSafeInteger(value.numerator) || value.numerator <= 0) return false;
  if (typeof value.denominator !== 'number' || !Number.isSafeInteger(value.denominator) || value.denominator <= 0) return false;
  return gcdBig(BigInt(value.numerator), BigInt(value.denominator)) === 1n;
};

const validPitch = (value: unknown): value is Pitch => {
  if (!isRecord(value) || !exactFields(value, ['step', 'alter', 'octave'])) return false;
  return typeof value.step === 'string' && ['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(value.step) &&
    typeof value.alter === 'number' && Number.isInteger(value.alter) && value.alter >= -2 && value.alter <= 2 &&
    typeof value.octave === 'number' && Number.isInteger(value.octave) && value.octave >= -1 && value.octave <= 9;
};

const rational = (numerator: bigint, denominator: bigint): Rational => {
  if (numerator < 0n || denominator <= 0n) {
    throw new PositionNoteEntryError('Rational arithmetic produced an invalid value.', 'RATIONAL_ARITHMETIC');
  }
  const divisor = gcdBig(numerator, denominator);
  const reducedNumerator = numerator / divisor;
  const reducedDenominator = denominator / divisor;
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (reducedNumerator > max || reducedDenominator > max) {
    throw new PositionNoteEntryError('Rational arithmetic exceeded safe integer bounds.', 'RATIONAL_ARITHMETIC');
  }
  return Object.freeze({ numerator: Number(reducedNumerator), denominator: Number(reducedDenominator) });
};

const compare = (left: Rational, right: Rational): number => {
  const l = BigInt(left.numerator) * BigInt(right.denominator);
  const r = BigInt(right.numerator) * BigInt(left.denominator);
  return l < r ? -1 : l > r ? 1 : 0;
};

const add = (left: Rational, right: Rational): Rational => rational(
  BigInt(left.numerator) * BigInt(right.denominator) + BigInt(right.numerator) * BigInt(left.denominator),
  BigInt(left.denominator) * BigInt(right.denominator)
);

const subtract = (left: Rational, right: Rational): Rational => {
  const numerator = BigInt(left.numerator) * BigInt(right.denominator) - BigInt(right.numerator) * BigInt(left.denominator);
  return rational(numerator, BigInt(left.denominator) * BigInt(right.denominator));
};

export const parseEnterNoteAtPositionIntent = (input: unknown): Readonly<EnterNoteAtPositionIntent> => {
  if (!isRecord(input) || !exactFields(input, [
    'version', 'type', 'noteId', 'pitch', 'duration', 'leadingRestEventId', 'trailingRestEventId'
  ])) {
    throw new PositionNoteEntryError('Position note-entry intent field set is invalid.', 'INVALID_INTENT');
  }
  if (input.version !== POSITION_NOTE_ENTRY_VERSION || input.type !== 'ENTER_NOTE_AT_POSITION' ||
      !validId(input.noteId) || !validPitch(input.pitch) || !validPositiveRational(input.duration) ||
      !(input.leadingRestEventId === null || validId(input.leadingRestEventId)) ||
      !(input.trailingRestEventId === null || validId(input.trailingRestEventId))) {
    throw new PositionNoteEntryError('Position note-entry intent values are invalid.', 'INVALID_INTENT');
  }
  if (input.leadingRestEventId !== null && input.leadingRestEventId === input.trailingRestEventId) {
    throw new PositionNoteEntryError('Leading and trailing rest identities must be distinct.', 'INVALID_INTENT');
  }
  return Object.freeze({
    version: POSITION_NOTE_ENTRY_VERSION,
    type: 'ENTER_NOTE_AT_POSITION',
    noteId: input.noteId,
    pitch: Object.freeze({ ...input.pitch }),
    duration: Object.freeze({ ...input.duration }),
    leadingRestEventId: input.leadingRestEventId,
    trailingRestEventId: input.trailingRestEventId
  });
};

const assertCommitIdentity = (score: ScoreDocument, identity: PositionNoteEntryCommitIdentity): void => {
  if (!validId(identity.operationId) || !validId(identity.nextRevisionId) ||
      identity.nextRevisionId === score.revision.id || identity.nextRevisionId === score.revision.parentId) {
    throw new PositionNoteEntryError('Position note-entry commit identity is invalid.', 'INVALID_COMMIT_IDENTITY');
  }
};

const replaceRest = (
  score: ScoreDocument,
  position: InsertionPosition,
  restEventId: string,
  replacement: readonly ScoreEvent[]
): ScoreDocument => ({
  ...score,
  parts: score.parts.map((part) => part.id !== position.partId ? part : ({
    ...part,
    staves: part.staves.map((staff) => staff.id !== position.staffId ? staff : ({
      ...staff,
      measures: staff.measures.map((measure) => measure.id !== position.measureId ? measure : ({
        ...measure,
        voices: measure.voices.map((voice) => voice.id !== position.voiceId ? voice : ({
          ...voice,
          events: voice.events.flatMap((event) => event.id === restEventId ? replacement : [event])
        }))
      }))
    }))
  }))
});

export const executePositionNoteEntry = (
  score: ScoreDocument,
  notation: NotationDocument,
  rawPosition: unknown,
  rawIntent: unknown,
  identity: PositionNoteEntryCommitIdentity
): Readonly<ScoreDocument> => {
  assertCommitIdentity(score, identity);
  const intent = parseEnterNoteAtPositionIntent(rawIntent);
  const resolvedPosition = resolveInsertionPosition(score, rawPosition);
  const position = resolvedPosition.position;
  const classification = classifyInsertionWindow(score, notation, position, intent.duration);
  if (classification.kind !== 'EXPLICIT_REST_SLOT' || !classification.safeToAuthor) {
    throw new PositionNoteEntryError('The requested insertion window is not an admitted explicit-rest slot.', 'WINDOW_NOT_AUTHORIZED', {
      classification: classification.kind
    });
  }

  const rest = resolvedPosition.voice.events.find((event) => event.id === classification.restEventId);
  if (rest === undefined || rest.kind !== 'rest') {
    throw new PositionNoteEntryError('The authorized rest event could not be resolved in the selected voice.', 'TARGET_REST_MISSING', {
      restEventId: classification.restEventId
    });
  }

  const restEnd = add(rest.onset, rest.duration);
  const noteEnd = add(position.onset, intent.duration);
  const needsLeading = compare(position.onset, rest.onset) > 0;
  const needsTrailing = compare(noteEnd, restEnd) < 0;

  if (needsLeading && intent.leadingRestEventId === null) {
    throw new PositionNoteEntryError('Insertion inside a rest requires an explicit leading-rest id.', 'LEADING_REST_ID_REQUIRED');
  }
  if (!needsLeading && intent.leadingRestEventId !== null) {
    throw new PositionNoteEntryError('Insertion at the rest start must not provide a leading-rest id.', 'LEADING_REST_ID_UNEXPECTED');
  }
  if (needsTrailing && intent.trailingRestEventId === null) {
    throw new PositionNoteEntryError('Insertion before the rest end requires an explicit trailing-rest id.', 'TRAILING_REST_ID_REQUIRED');
  }
  if (!needsTrailing && intent.trailingRestEventId !== null) {
    throw new PositionNoteEntryError('Insertion ending at the rest end must not provide a trailing-rest id.', 'TRAILING_REST_ID_UNEXPECTED');
  }

  const index = createSemanticAddressIndex(score).byEntityId;
  for (const candidate of [intent.noteId, intent.leadingRestEventId, intent.trailingRestEventId]) {
    if (candidate !== null && index.has(candidate)) {
      throw new PositionNoteEntryError('A new note/rest identity already exists in the score.', 'ID_CONFLICT', { id: candidate });
    }
  }

  const replacement: ScoreEvent[] = [];
  if (needsLeading) {
    const leadingRestEventId = intent.leadingRestEventId;
    if (leadingRestEventId === null) {
      throw new PositionNoteEntryError('Insertion inside a rest requires an explicit leading-rest id.', 'LEADING_REST_ID_REQUIRED');
    }
    replacement.push({
      id: leadingRestEventId,
      kind: 'rest',
      onset: rest.onset,
      duration: subtract(position.onset, rest.onset)
    });
  }

  replacement.push({
    id: rest.id,
    kind: 'note',
    onset: position.onset,
    duration: intent.duration,
    note: { id: intent.noteId, pitch: intent.pitch }
  });

  if (needsTrailing) {
    const trailingRestEventId = intent.trailingRestEventId;
    if (trailingRestEventId === null) {
      throw new PositionNoteEntryError('Insertion before the rest end requires an explicit trailing-rest id.', 'TRAILING_REST_ID_REQUIRED');
    }
    replacement.push({
      id: trailingRestEventId,
      kind: 'rest',
      onset: noteEnd,
      duration: subtract(restEnd, noteEnd)
    });
  }

  const draft = replaceRest(score, position, rest.id, replacement);
  try {
    return createScoreDocument({
      ...draft,
      revision: { id: identity.nextRevisionId, parentId: score.revision.id }
    });
  } catch (error) {
    throw new PositionNoteEntryError('Position note-entry result failed canonical score validation.', 'RESULT_INVALID', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
};
