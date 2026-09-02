import type { Rational, ScoreDocument, Voice } from '../../score-model/src/index.js';
import {
  SEMANTIC_ADDRESS_VERSION,
  resolveSemanticAddress
} from '../../addressing/src/index.js';
import type { VoiceAddress } from '../../addressing/src/index.js';

export const INSERTION_POSITION_VERSION = '1.0.0' as const;

export interface InsertionPosition {
  readonly contractVersion: typeof INSERTION_POSITION_VERSION;
  readonly documentId: string;
  readonly revisionId: string;
  readonly partId: string;
  readonly staffId: string;
  readonly measureId: string;
  readonly voiceId: string;
  readonly onset: Rational;
}

export interface ResolvedInsertionPosition {
  readonly position: Readonly<InsertionPosition>;
  readonly voice: Voice;
}

export type InsertionPositionErrorCode =
  | 'INVALID_POSITION'
  | 'DOCUMENT_MISMATCH'
  | 'STALE_POSITION'
  | 'VOICE_PATH_MISMATCH';

export class InsertionPositionError extends Error {
  readonly code: InsertionPositionErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, code: InsertionPositionErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'InsertionPositionError';
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

const gcd = (a: number, b: number): number => {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right !== 0) [left, right] = [right, left % right];
  return left;
};

const validOnset = (value: unknown): value is Rational => {
  if (!isRecord(value) || !exactFields(value, ['numerator', 'denominator'])) return false;
  return typeof value.numerator === 'number' && Number.isSafeInteger(value.numerator) && value.numerator >= 0 &&
    typeof value.denominator === 'number' && Number.isSafeInteger(value.denominator) && value.denominator > 0 &&
    gcd(value.numerator, value.denominator) === 1;
};

const freezePosition = (position: InsertionPosition): Readonly<InsertionPosition> => Object.freeze({
  ...position,
  onset: Object.freeze({ ...position.onset })
});

export const parseInsertionPosition = (input: unknown): Readonly<InsertionPosition> => {
  if (!isRecord(input) || !exactFields(input, [
    'contractVersion', 'documentId', 'revisionId', 'partId', 'staffId', 'measureId', 'voiceId', 'onset'
  ])) {
    throw new InsertionPositionError('Insertion position field set is invalid.', 'INVALID_POSITION');
  }
  if (input.contractVersion !== INSERTION_POSITION_VERSION ||
      !validId(input.documentId) || !validId(input.revisionId) ||
      !validId(input.partId) || !validId(input.staffId) ||
      !validId(input.measureId) || !validId(input.voiceId) ||
      !validOnset(input.onset)) {
    throw new InsertionPositionError('Insertion position values are invalid.', 'INVALID_POSITION');
  }
  return freezePosition({
    contractVersion: INSERTION_POSITION_VERSION,
    documentId: input.documentId,
    revisionId: input.revisionId,
    partId: input.partId,
    staffId: input.staffId,
    measureId: input.measureId,
    voiceId: input.voiceId,
    onset: input.onset
  });
};

const voiceAddressFor = (position: InsertionPosition): VoiceAddress => Object.freeze({
  contractVersion: SEMANTIC_ADDRESS_VERSION,
  kind: 'voice',
  documentId: position.documentId,
  revisionId: position.revisionId,
  partId: position.partId,
  staffId: position.staffId,
  measureId: position.measureId,
  voiceId: position.voiceId
});

export const resolveInsertionPosition = (
  score: ScoreDocument,
  rawPosition: unknown
): Readonly<ResolvedInsertionPosition> => {
  const position = parseInsertionPosition(rawPosition);
  if (position.documentId !== score.id) {
    throw new InsertionPositionError('Insertion position belongs to another document.', 'DOCUMENT_MISMATCH', {
      expectedDocumentId: score.id,
      observedDocumentId: position.documentId
    });
  }
  if (position.revisionId !== score.revision.id) {
    throw new InsertionPositionError('Insertion position belongs to a stale score revision.', 'STALE_POSITION', {
      expectedRevisionId: score.revision.id,
      observedRevisionId: position.revisionId
    });
  }
  try {
    const resolved = resolveSemanticAddress(score, voiceAddressFor(position));
    if (resolved.kind !== 'voice') {
      throw new InsertionPositionError('Insertion position did not resolve to a voice.', 'VOICE_PATH_MISMATCH');
    }
    return Object.freeze({ position, voice: resolved.value });
  } catch (error) {
    if (error instanceof InsertionPositionError) throw error;
    throw new InsertionPositionError('Insertion position voice path does not resolve in the current score.', 'VOICE_PATH_MISMATCH', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
};

export const createInsertionPosition = (
  score: ScoreDocument,
  voiceAddress: VoiceAddress,
  onset: Rational
): Readonly<InsertionPosition> => {
  let resolved;
  try {
    resolved = resolveSemanticAddress(score, voiceAddress);
  } catch (error) {
    throw new InsertionPositionError('Voice address cannot authorize an insertion position.', 'VOICE_PATH_MISMATCH', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
  if (resolved.kind !== 'voice') {
    throw new InsertionPositionError('Insertion position requires an exact voice address.', 'VOICE_PATH_MISMATCH');
  }
  if (!validOnset(onset)) {
    throw new InsertionPositionError('Insertion onset must be a canonical non-negative rational.', 'INVALID_POSITION');
  }
  return freezePosition({
    contractVersion: INSERTION_POSITION_VERSION,
    documentId: score.id,
    revisionId: score.revision.id,
    partId: voiceAddress.partId,
    staffId: voiceAddress.staffId,
    measureId: voiceAddress.measureId,
    voiceId: voiceAddress.voiceId,
    onset
  });
};
