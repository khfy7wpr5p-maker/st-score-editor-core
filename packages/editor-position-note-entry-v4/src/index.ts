import type { Pitch, Rational, ScoreEvent } from '../../score-model/src/index.js';
import { createScoreDocumentV3, type ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import {
  addressEntityV3,
  createSemanticAddressIndexV3,
  type SemanticAddressV3,
  type EventAddressV3
} from '../../addressing-v3/src/index.js';
import { createNotationDocumentV4, type NotationDocumentV4 } from '../../notation-structure-v4/src/index.js';
import { resolveInsertionPositionV3 } from '../../editor-insertion-position-v3/src/index.js';

export const POSITION_NOTE_ENTRY_V4_VERSION = '1.0.0' as const;

export interface EnterNoteAtPositionV4Intent {
  readonly version: typeof POSITION_NOTE_ENTRY_V4_VERSION;
  readonly type: 'ENTER_NOTE_AT_POSITION';
  readonly noteId: string;
  readonly pitch: Pitch;
  readonly duration: Rational;
  readonly leadingRestEventId: string | null;
  readonly trailingRestEventId: string | null;
}

export interface PositionNoteEntryV4Options {
  readonly nextRevisionId: string;
}

export interface PositionNoteEntryV4Result {
  readonly score: Readonly<ScoreDocumentV3>;
  readonly notation: Readonly<NotationDocumentV4>;
  readonly selection: SemanticAddressV3;
}

export type PositionNoteEntryV4ErrorCode =
  | 'INVALID_INTENT'
  | 'INVALID_OPTIONS'
  | 'WINDOW_NOT_AUTHORIZED'
  | 'LEADING_REST_ID_REQUIRED'
  | 'LEADING_REST_ID_UNEXPECTED'
  | 'TRAILING_REST_ID_REQUIRED'
  | 'TRAILING_REST_ID_UNEXPECTED'
  | 'IDENTITY_COLLISION'
  | 'NOTATION_SPLIT_CONFLICT'
  | 'GRACE_ANCHOR_CONFLICT'
  | 'RESULT_INVALID';

export class PositionNoteEntryV4Error extends Error {
  readonly code: PositionNoteEntryV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: PositionNoteEntryV4ErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'PositionNoteEntryV4Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

type R = Record<string, unknown>;
const rec = (value: unknown): value is R => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value: unknown, keys: readonly string[]): value is R =>
  rec(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const STEPS = new Set(['A','B','C','D','E','F','G']);
const abs = (value: bigint): bigint => value < 0n ? -value : value;
const gcd = (left: bigint, right: bigint): bigint => {
  let a = abs(left), b = abs(right);
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
};
const validPositiveRational = (value: unknown): value is Rational => exact(value, ['numerator','denominator']) &&
  typeof value.numerator === 'number' && Number.isSafeInteger(value.numerator) && value.numerator > 0 &&
  typeof value.denominator === 'number' && Number.isSafeInteger(value.denominator) && value.denominator > 0 &&
  gcd(BigInt(value.numerator), BigInt(value.denominator)) === 1n;
const validPitch = (value: unknown): value is Pitch => exact(value, ['step','alter','octave']) &&
  typeof value.step === 'string' && STEPS.has(value.step) &&
  typeof value.alter === 'number' && Number.isInteger(value.alter) && value.alter >= -2 && value.alter <= 2 &&
  typeof value.octave === 'number' && Number.isInteger(value.octave) && value.octave >= -1 && value.octave <= 9;

const rational = (numerator: bigint, denominator: bigint): Rational => {
  if (numerator < 0n || denominator <= 0n) throw new PositionNoteEntryV4Error('Rational arithmetic produced an invalid value.', 'RESULT_INVALID');
  const divisor = gcd(numerator, denominator);
  const n = numerator / divisor, d = denominator / divisor;
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (n > max || d > max) throw new PositionNoteEntryV4Error('Rational arithmetic exceeded safe integer bounds.', 'RESULT_INVALID');
  return Object.freeze({ numerator: Number(n), denominator: Number(d) });
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
const subtract = (left: Rational, right: Rational): Rational => rational(
  BigInt(left.numerator) * BigInt(right.denominator) - BigInt(right.numerator) * BigInt(left.denominator),
  BigInt(left.denominator) * BigInt(right.denominator)
);

const parseIntent = (raw: unknown): Readonly<EnterNoteAtPositionV4Intent> => {
  if (!exact(raw, ['version','type','noteId','pitch','duration','leadingRestEventId','trailingRestEventId']) ||
      raw.version !== POSITION_NOTE_ENTRY_V4_VERSION || raw.type !== 'ENTER_NOTE_AT_POSITION' ||
      typeof raw.noteId !== 'string' || !ID.test(raw.noteId) || !validPitch(raw.pitch) || !validPositiveRational(raw.duration) ||
      !(raw.leadingRestEventId === null || (typeof raw.leadingRestEventId === 'string' && ID.test(raw.leadingRestEventId))) ||
      !(raw.trailingRestEventId === null || (typeof raw.trailingRestEventId === 'string' && ID.test(raw.trailingRestEventId)))) {
    throw new PositionNoteEntryV4Error('Position note-entry intent is invalid.', 'INVALID_INTENT');
  }
  if (raw.leadingRestEventId !== null && raw.leadingRestEventId === raw.trailingRestEventId) {
    throw new PositionNoteEntryV4Error('Leading and trailing rest identities must differ.', 'INVALID_INTENT');
  }
  return Object.freeze({
    version: POSITION_NOTE_ENTRY_V4_VERSION,
    type: 'ENTER_NOTE_AT_POSITION',
    noteId: raw.noteId,
    pitch: Object.freeze({ ...raw.pitch }),
    duration: Object.freeze({ ...raw.duration }),
    leadingRestEventId: raw.leadingRestEventId,
    trailingRestEventId: raw.trailingRestEventId
  });
};

const parseOptions = (raw: PositionNoteEntryV4Options): Readonly<PositionNoteEntryV4Options> => {
  if (!exact(raw, ['nextRevisionId']) || typeof raw.nextRevisionId !== 'string' || !ID.test(raw.nextRevisionId)) {
    throw new PositionNoteEntryV4Error('Position note-entry options are invalid.', 'INVALID_OPTIONS');
  }
  return Object.freeze({ nextRevisionId: raw.nextRevisionId });
};

const eventEnd = (event: ScoreEvent): Rational => add(event.onset, event.duration);
const overlaps = (aStart: Rational, aEnd: Rational, bStart: Rational, bEnd: Rational): boolean =>
  compare(aStart, bEnd) < 0 && compare(bStart, aEnd) < 0;

const entityId = (address: SemanticAddressV3): string => {
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
  const next = addressEntityV3(score, entityId(address));
  if (next.kind !== address.kind) throw new PositionNoteEntryV4Error('Position note entry would orphan notation identity.', 'RESULT_INVALID', { id: entityId(address) });
  return next;
};
const rebindNotation = (score: ScoreDocumentV3, notation: NotationDocumentV4): Readonly<NotationDocumentV4> => createNotationDocumentV4(score, {
  contractVersion: '4.0.0',
  documentId: score.id,
  revisionId: score.revision.id,
  frames: notation.frames.map(entry => ({ target: rebind(score, entry.target) as typeof entry.target, notation: entry.notation })),
  measures: notation.measures.map(entry => ({ target: rebind(score, entry.target) as typeof entry.target, notation: entry.notation })),
  events: notation.events.map(entry => ({ target: rebind(score, entry.target) as typeof entry.target, notation: entry.notation })),
  notes: notation.notes.map(entry => ({ target: rebind(score, entry.target) as typeof entry.target, notation: entry.notation })),
  graceEvents: notation.graceEvents.map(entry => ({ target: rebind(score, entry.target) as typeof entry.target, notation: entry.notation })),
  graceNotes: notation.graceNotes.map(entry => ({ target: rebind(score, entry.target) as typeof entry.target, notation: entry.notation })),
  crossStaffPlacements: notation.crossStaffPlacements.map(item => ({
    source: rebind(score, item.source) as EventAddressV3,
    displayStaffId: item.displayStaffId
  }))
});

export const executePositionNoteEntryV4 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  rawPosition: unknown,
  rawIntent: unknown,
  rawOptions: PositionNoteEntryV4Options
): Readonly<PositionNoteEntryV4Result> => {
  const score = createScoreDocumentV3(scoreInput);
  const notation = createNotationDocumentV4(score, notationInput);
  const resolved = resolveInsertionPositionV3(score, rawPosition);
  const position = resolved.position;
  const voice = resolved.voice;
  const intent = parseIntent(rawIntent);
  const options = parseOptions(rawOptions);
  if (options.nextRevisionId === score.revision.id || options.nextRevisionId === score.revision.parentId) {
    throw new PositionNoteEntryV4Error('Next revision identity conflicts with current lineage.', 'INVALID_OPTIONS');
  }

  const noteEnd = add(position.onset, intent.duration);
  const candidates = voice.events.filter(event => event.kind === 'rest' &&
    compare(event.onset, position.onset) <= 0 && compare(noteEnd, eventEnd(event)) <= 0);
  if (candidates.length !== 1) {
    throw new PositionNoteEntryV4Error('Requested insertion window is not contained by exactly one explicit rest.', 'WINDOW_NOT_AUTHORIZED', {
      candidateCount: candidates.length
    });
  }
  const rest = candidates[0]!;
  for (const event of voice.events) {
    if (event.id !== rest.id && overlaps(event.onset, eventEnd(event), position.onset, noteEnd)) {
      throw new PositionNoteEntryV4Error('Requested insertion window overlaps another canonical event.', 'WINDOW_NOT_AUTHORIZED', { eventId: event.id });
    }
  }

  const restEnd = eventEnd(rest);
  const needsLeading = compare(position.onset, rest.onset) > 0;
  const needsTrailing = compare(noteEnd, restEnd) < 0;
  if (needsLeading && intent.leadingRestEventId === null) throw new PositionNoteEntryV4Error('Insertion inside a rest requires a leading-rest identity.', 'LEADING_REST_ID_REQUIRED');
  if (!needsLeading && intent.leadingRestEventId !== null) throw new PositionNoteEntryV4Error('Insertion at rest start must not provide a leading-rest identity.', 'LEADING_REST_ID_UNEXPECTED');
  if (needsTrailing && intent.trailingRestEventId === null) throw new PositionNoteEntryV4Error('Insertion before rest end requires a trailing-rest identity.', 'TRAILING_REST_ID_REQUIRED');
  if (!needsTrailing && intent.trailingRestEventId !== null) throw new PositionNoteEntryV4Error('Insertion ending at rest end must not provide a trailing-rest identity.', 'TRAILING_REST_ID_UNEXPECTED');

  if ((needsLeading || needsTrailing) && notation.events.some(entry => entry.target.eventId === rest.id)) {
    throw new PositionNoteEntryV4Error('Splitting an explicitly notated rest requires a separate notation-allocation policy.', 'NOTATION_SPLIT_CONFLICT', { eventId: rest.id });
  }
  if (voice.graceGroups.some(group => group.anchorEventId === rest.id)) {
    throw new PositionNoteEntryV4Error('A grace-anchored rest cannot be repurposed by bounded position note entry.', 'GRACE_ANCHOR_CONFLICT', { eventId: rest.id });
  }

  const ids = createSemanticAddressIndexV3(score).byEntityId;
  const fresh = [intent.noteId, intent.leadingRestEventId, intent.trailingRestEventId].filter((value): value is string => value !== null);
  if (new Set(fresh).size !== fresh.length || fresh.some(value => ids.has(value))) {
    throw new PositionNoteEntryV4Error('New note/rest identity collides with current canonical identity.', 'IDENTITY_COLLISION', { ids: fresh });
  }

  const replacement: ScoreEvent[] = [];
  if (needsLeading) replacement.push({
    id: intent.leadingRestEventId!,
    kind: 'rest',
    onset: rest.onset,
    duration: subtract(position.onset, rest.onset)
  });
  replacement.push({
    id: rest.id,
    kind: 'note',
    onset: position.onset,
    duration: intent.duration,
    note: { id: intent.noteId, pitch: intent.pitch }
  });
  if (needsTrailing) replacement.push({
    id: intent.trailingRestEventId!,
    kind: 'rest',
    onset: noteEnd,
    duration: subtract(restEnd, noteEnd)
  });

  const candidate = structuredClone(score) as ScoreDocumentV3;
  const part = candidate.parts.find(item => item.id === position.partId);
  const staff = part?.staves.find(item => item.id === position.staffId);
  if (staff === undefined || staff.role === 'tablature-linked') throw new PositionNoteEntryV4Error('Insertion target staff is unavailable.', 'WINDOW_NOT_AUTHORIZED');
  const measure = staff.measures.find(item => item.id === position.measureId && item.frameId === position.frameId);
  const targetVoice = measure?.voices.find(item => item.id === position.voiceId);
  if (targetVoice === undefined) throw new PositionNoteEntryV4Error('Insertion target voice is unavailable.', 'WINDOW_NOT_AUTHORIZED');
  const targetIndex = targetVoice.events.findIndex(item => item.id === rest.id);
  if (targetIndex < 0) throw new PositionNoteEntryV4Error('Insertion rest disappeared during transformation.', 'WINDOW_NOT_AUTHORIZED');
  const events = [...targetVoice.events];
  events.splice(targetIndex, 1, ...replacement);
  (targetVoice as { events: readonly ScoreEvent[] }).events = events;
  (candidate as { revision: { id: string; parentId: string | null } }).revision = {
    id: options.nextRevisionId,
    parentId: score.revision.id
  };

  let nextScore: Readonly<ScoreDocumentV3>;
  try {
    nextScore = createScoreDocumentV3(candidate);
  } catch (error) {
    throw new PositionNoteEntryV4Error('Position note-entry candidate failed canonical validation.', 'RESULT_INVALID', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
  let nextNotation: Readonly<NotationDocumentV4>;
  try {
    nextNotation = rebindNotation(nextScore, notation);
  } catch (error) {
    if (error instanceof PositionNoteEntryV4Error) throw error;
    throw new PositionNoteEntryV4Error('Position note-entry notation rebinding failed.', 'RESULT_INVALID', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
  const selection = addressEntityV3(nextScore, intent.noteId);
  if (selection.kind !== 'note') throw new PositionNoteEntryV4Error('Inserted note identity did not resolve as a note.', 'RESULT_INVALID');
  return Object.freeze({ score: nextScore, notation: nextNotation, selection });
};
