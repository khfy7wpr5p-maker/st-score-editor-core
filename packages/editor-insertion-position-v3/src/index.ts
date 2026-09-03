import type { Rational } from '../../score-model/src/index.js';
import { createScoreDocumentV3, type ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import {
  resolveSemanticAddressV3,
  type VoiceAddressV3
} from '../../addressing-v3/src/index.js';
import type { VoiceV2 } from '../../score-model-v2/src/index.js';

export const INSERTION_POSITION_V3_VERSION = '3.0.0' as const;

export interface InsertionPositionV3 {
  readonly contractVersion: typeof INSERTION_POSITION_V3_VERSION;
  readonly documentId: string;
  readonly revisionId: string;
  readonly partId: string;
  readonly staffId: string;
  readonly frameId: string;
  readonly measureId: string;
  readonly voiceId: string;
  readonly onset: Rational;
}

export interface ResolvedInsertionPositionV3 {
  readonly position: Readonly<InsertionPositionV3>;
  readonly voice: VoiceV2;
}

export type InsertionPositionV3ErrorCode =
  | 'INVALID_POSITION'
  | 'DOCUMENT_MISMATCH'
  | 'STALE_POSITION'
  | 'VOICE_PATH_MISMATCH';

export class InsertionPositionV3Error extends Error {
  readonly code: InsertionPositionV3ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: InsertionPositionV3ErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'InsertionPositionV3Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

type R = Record<string, unknown>;
const rec = (value: unknown): value is R => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value: unknown, keys: readonly string[]): value is R =>
  rec(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const gcd = (a: number, b: number): number => {
  let left = Math.abs(a), right = Math.abs(b);
  while (right !== 0) [left, right] = [right, left % right];
  return left;
};
const validOnset = (value: unknown): value is Rational => exact(value, ['numerator', 'denominator']) &&
  typeof value.numerator === 'number' && Number.isSafeInteger(value.numerator) && value.numerator >= 0 &&
  typeof value.denominator === 'number' && Number.isSafeInteger(value.denominator) && value.denominator > 0 &&
  gcd(value.numerator, value.denominator) === 1;

const freezePosition = (value: InsertionPositionV3): Readonly<InsertionPositionV3> => Object.freeze({
  ...value,
  onset: Object.freeze({ ...value.onset })
});

export const parseInsertionPositionV3 = (input: unknown): Readonly<InsertionPositionV3> => {
  if (!exact(input, ['contractVersion','documentId','revisionId','partId','staffId','frameId','measureId','voiceId','onset'])) {
    throw new InsertionPositionV3Error('V3 insertion position field set is invalid.', 'INVALID_POSITION');
  }
  if (input.contractVersion !== INSERTION_POSITION_V3_VERSION ||
      typeof input.documentId !== 'string' || !ID.test(input.documentId) ||
      typeof input.revisionId !== 'string' || !ID.test(input.revisionId) ||
      typeof input.partId !== 'string' || !ID.test(input.partId) ||
      typeof input.staffId !== 'string' || !ID.test(input.staffId) ||
      typeof input.frameId !== 'string' || !ID.test(input.frameId) ||
      typeof input.measureId !== 'string' || !ID.test(input.measureId) ||
      typeof input.voiceId !== 'string' || !ID.test(input.voiceId) ||
      !validOnset(input.onset)) {
    throw new InsertionPositionV3Error('V3 insertion position values are invalid.', 'INVALID_POSITION');
  }
  return freezePosition({
    contractVersion: INSERTION_POSITION_V3_VERSION,
    documentId: input.documentId,
    revisionId: input.revisionId,
    partId: input.partId,
    staffId: input.staffId,
    frameId: input.frameId,
    measureId: input.measureId,
    voiceId: input.voiceId,
    onset: input.onset
  });
};

const voiceAddressFor = (position: InsertionPositionV3): VoiceAddressV3 => Object.freeze({
  contractVersion: '3.0.0',
  kind: 'voice',
  documentId: position.documentId,
  revisionId: position.revisionId,
  partId: position.partId,
  staffId: position.staffId,
  frameId: position.frameId,
  measureId: position.measureId,
  voiceId: position.voiceId
});

export const resolveInsertionPositionV3 = (
  scoreInput: ScoreDocumentV3,
  rawPosition: unknown
): Readonly<ResolvedInsertionPositionV3> => {
  const score = createScoreDocumentV3(scoreInput);
  const position = parseInsertionPositionV3(rawPosition);
  if (position.documentId !== score.id) {
    throw new InsertionPositionV3Error('Insertion position belongs to another document.', 'DOCUMENT_MISMATCH');
  }
  if (position.revisionId !== score.revision.id) {
    throw new InsertionPositionV3Error('Insertion position belongs to a stale canonical revision.', 'STALE_POSITION', {
      expectedRevisionId: score.revision.id,
      observedRevisionId: position.revisionId
    });
  }
  try {
    const resolved = resolveSemanticAddressV3(score, voiceAddressFor(position));
    if (resolved.kind !== 'voice') throw new Error(`observed ${resolved.kind}`);
    return Object.freeze({ position, voice: resolved.value });
  } catch (error) {
    throw new InsertionPositionV3Error('Insertion position voice path does not resolve exactly.', 'VOICE_PATH_MISMATCH', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
};

export const createInsertionPositionV3 = (
  scoreInput: ScoreDocumentV3,
  voiceAddress: VoiceAddressV3,
  onset: Rational
): Readonly<InsertionPositionV3> => {
  const score = createScoreDocumentV3(scoreInput);
  let resolved;
  try {
    resolved = resolveSemanticAddressV3(score, voiceAddress);
  } catch (error) {
    throw new InsertionPositionV3Error('Voice address cannot authorize a V3 insertion position.', 'VOICE_PATH_MISMATCH', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
  if (resolved.kind !== 'voice') throw new InsertionPositionV3Error('Insertion position requires an exact voice address.', 'VOICE_PATH_MISMATCH');
  if (!validOnset(onset)) throw new InsertionPositionV3Error('Insertion onset must be a canonical non-negative rational.', 'INVALID_POSITION');
  return freezePosition({
    contractVersion: INSERTION_POSITION_V3_VERSION,
    documentId: score.id,
    revisionId: score.revision.id,
    partId: voiceAddress.partId,
    staffId: voiceAddress.staffId,
    frameId: voiceAddress.frameId,
    measureId: voiceAddress.measureId,
    voiceId: voiceAddress.voiceId,
    onset
  });
};
