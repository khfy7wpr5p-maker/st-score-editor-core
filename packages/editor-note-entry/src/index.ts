import { createScoreDocument } from '../../score-model/src/index.js';
import type { Pitch, Rational, ScoreDocument, ScoreEvent } from '../../score-model/src/index.js';
import { createSemanticAddressIndex, resolveSemanticAddress } from '../../addressing/src/index.js';
import type { EventAddress } from '../../addressing/src/index.js';

export const EDITOR_NOTE_ENTRY_VERSION = '1.0.0' as const;

export interface EnterNoteInRestIntent {
  readonly version: typeof EDITOR_NOTE_ENTRY_VERSION;
  readonly type: 'ENTER_NOTE_IN_REST';
  readonly noteId: string;
  readonly pitch: Pitch;
  readonly duration: Rational;
  readonly remainderEventId: string | null;
}

export interface NoteEntryCommitIdentity {
  readonly operationId: string;
  readonly nextRevisionId: string;
}

export type NoteEntryErrorCode =
  | 'INVALID_INTENT'
  | 'INVALID_COMMIT_IDENTITY'
  | 'STALE_TARGET'
  | 'TARGET_KIND'
  | 'DURATION_EXCEEDS_REST'
  | 'REMAINDER_ID_REQUIRED'
  | 'UNEXPECTED_REMAINDER_ID'
  | 'ID_CONFLICT'
  | 'RATIONAL_ARITHMETIC'
  | 'RESULT_INVALID';

export class NoteEntryError extends Error {
  readonly code: NoteEntryErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, code: NoteEntryErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'NoteEntryError';
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

const gcdNumber = (a: number, b: number): number => {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right !== 0) [left, right] = [right, left % right];
  return left;
};

const validPositiveRational = (value: unknown): value is Rational => {
  if (!isRecord(value) || !exactFields(value, ['numerator', 'denominator'])) return false;
  return typeof value.numerator === 'number' && Number.isSafeInteger(value.numerator) && value.numerator > 0 &&
    typeof value.denominator === 'number' && Number.isSafeInteger(value.denominator) && value.denominator > 0 &&
    gcdNumber(value.numerator, value.denominator) === 1;
};

const validPitch = (value: unknown): value is Pitch => {
  if (!isRecord(value) || !exactFields(value, ['step', 'alter', 'octave'])) return false;
  return typeof value.step === 'string' && ['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(value.step) &&
    typeof value.alter === 'number' && Number.isInteger(value.alter) && value.alter >= -2 && value.alter <= 2 &&
    typeof value.octave === 'number' && Number.isInteger(value.octave) && value.octave >= -1 && value.octave <= 9;
};

const gcdBigInt = (a: bigint, b: bigint): bigint => {
  let left = a < 0n ? -a : a;
  let right = b < 0n ? -b : b;
  while (right !== 0n) [left, right] = [right, left % right];
  return left;
};

const rationalFromBigInt = (numerator: bigint, denominator: bigint): Rational => {
  if (denominator <= 0n || numerator < 0n) {
    throw new NoteEntryError('Rational arithmetic produced an invalid value.', 'RATIONAL_ARITHMETIC');
  }
  const divisor = gcdBigInt(numerator, denominator);
  const reducedNumerator = numerator / divisor;
  const reducedDenominator = denominator / divisor;
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (reducedNumerator > max || reducedDenominator > max) {
    throw new NoteEntryError('Rational arithmetic exceeded safe integer bounds.', 'RATIONAL_ARITHMETIC');
  }
  return Object.freeze({
    numerator: Number(reducedNumerator),
    denominator: Number(reducedDenominator)
  });
};

const compareRational = (left: Rational, right: Rational): number => {
  const lhs = BigInt(left.numerator) * BigInt(right.denominator);
  const rhs = BigInt(right.numerator) * BigInt(left.denominator);
  return lhs < rhs ? -1 : lhs > rhs ? 1 : 0;
};

const addRational = (left: Rational, right: Rational): Rational =>
  rationalFromBigInt(
    BigInt(left.numerator) * BigInt(right.denominator) + BigInt(right.numerator) * BigInt(left.denominator),
    BigInt(left.denominator) * BigInt(right.denominator)
  );

const subtractPositiveRational = (left: Rational, right: Rational): Rational => {
  const numerator = BigInt(left.numerator) * BigInt(right.denominator) - BigInt(right.numerator) * BigInt(left.denominator);
  if (numerator <= 0n) {
    throw new NoteEntryError('Remainder duration must be positive.', 'RATIONAL_ARITHMETIC');
  }
  return rationalFromBigInt(numerator, BigInt(left.denominator) * BigInt(right.denominator));
};

export const parseEnterNoteInRestIntent = (input: unknown): Readonly<EnterNoteInRestIntent> => {
  if (!isRecord(input) || !exactFields(input, ['version', 'type', 'noteId', 'pitch', 'duration', 'remainderEventId'])) {
    throw new NoteEntryError('Note-entry intent field set is invalid.', 'INVALID_INTENT');
  }
  if (input.version !== EDITOR_NOTE_ENTRY_VERSION || input.type !== 'ENTER_NOTE_IN_REST' ||
      !validId(input.noteId) || !validPitch(input.pitch) || !validPositiveRational(input.duration) ||
      !(input.remainderEventId === null || validId(input.remainderEventId))) {
    throw new NoteEntryError('Note-entry intent values are invalid.', 'INVALID_INTENT');
  }
  return Object.freeze({
    version: EDITOR_NOTE_ENTRY_VERSION,
    type: 'ENTER_NOTE_IN_REST',
    noteId: input.noteId,
    pitch: Object.freeze({ ...input.pitch }),
    duration: Object.freeze({ ...input.duration }),
    remainderEventId: input.remainderEventId
  });
};

const assertCommitIdentity = (score: ScoreDocument, identity: NoteEntryCommitIdentity): void => {
  if (!validId(identity.operationId) || !validId(identity.nextRevisionId) ||
      identity.nextRevisionId === score.revision.id || identity.nextRevisionId === score.revision.parentId) {
    throw new NoteEntryError('Note-entry commit identity is invalid.', 'INVALID_COMMIT_IDENTITY');
  }
};

const replaceTargetRest = (
  score: ScoreDocument,
  target: EventAddress,
  replacement: readonly ScoreEvent[]
): ScoreDocument => ({
  ...score,
  parts: score.parts.map((part) => part.id !== target.partId ? part : ({
    ...part,
    staves: part.staves.map((staff) => staff.id !== target.staffId ? staff : ({
      ...staff,
      measures: staff.measures.map((measure) => measure.id !== target.measureId ? measure : ({
        ...measure,
        voices: measure.voices.map((voice) => voice.id !== target.voiceId ? voice : ({
          ...voice,
          events: voice.events.flatMap((event) => event.id === target.eventId ? replacement : [event])
        }))
      }))
    }))
  }))
});

export const executeRestNoteEntry = (
  score: ScoreDocument,
  target: EventAddress,
  rawIntent: unknown,
  identity: NoteEntryCommitIdentity
): Readonly<ScoreDocument> => {
  assertCommitIdentity(score, identity);
  const intent = parseEnterNoteInRestIntent(rawIntent);

  let resolved;
  try {
    resolved = resolveSemanticAddress(score, target);
  } catch (error) {
    throw new NoteEntryError('Note-entry target is stale, malformed, or belongs to another document.', 'STALE_TARGET', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
  if (resolved.kind !== 'event' || resolved.value.kind !== 'rest') {
    throw new NoteEntryError('Note entry currently requires an exact rest event target.', 'TARGET_KIND', {
      kind: resolved.kind === 'event' ? resolved.value.kind : resolved.kind
    });
  }

  const rest = resolved.value;
  const durationComparison = compareRational(intent.duration, rest.duration);
  if (durationComparison > 0) {
    throw new NoteEntryError('Requested note duration exceeds the selected rest duration.', 'DURATION_EXCEEDS_REST');
  }
  if (durationComparison === 0 && intent.remainderEventId !== null) {
    throw new NoteEntryError('An exact rest replacement must not provide a remainder event id.', 'UNEXPECTED_REMAINDER_ID');
  }
  if (durationComparison < 0 && intent.remainderEventId === null) {
    throw new NoteEntryError('Splitting a rest requires an explicit remainder event id.', 'REMAINDER_ID_REQUIRED');
  }

  const entityIndex = createSemanticAddressIndex(score).byEntityId;
  if (entityIndex.has(intent.noteId) || (intent.remainderEventId !== null && entityIndex.has(intent.remainderEventId))) {
    throw new NoteEntryError('New note or remainder event identity already exists.', 'ID_CONFLICT', {
      noteId: intent.noteId,
      remainderEventId: intent.remainderEventId
    });
  }

  const noteEvent: ScoreEvent = {
    id: rest.id,
    kind: 'note',
    onset: rest.onset,
    duration: intent.duration,
    note: { id: intent.noteId, pitch: intent.pitch }
  };

  const replacement: ScoreEvent[] = [noteEvent];
  if (durationComparison < 0) {
    const remainderEventId = intent.remainderEventId;
    if (remainderEventId === null) {
      throw new NoteEntryError('Splitting a rest requires an explicit remainder event id.', 'REMAINDER_ID_REQUIRED');
    }
    replacement.push({
      id: remainderEventId,
      kind: 'rest',
      onset: addRational(rest.onset, intent.duration),
      duration: subtractPositiveRational(rest.duration, intent.duration)
    });
  }

  const draft = replaceTargetRest(score, target, replacement);
  try {
    return createScoreDocument({
      ...draft,
      revision: { id: identity.nextRevisionId, parentId: score.revision.id }
    });
  } catch (error) {
    throw new NoteEntryError('Note-entry result failed canonical score validation.', 'RESULT_INVALID', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
};
