import type { Rational, ScoreDocument } from '../../score-model/src/index.js';
import { resolveSemanticAddress } from '../../addressing/src/index.js';
import type { MeasureAddress } from '../../addressing/src/index.js';
import type { TimeSignature } from '../../notation-structure/src/index.js';

export const MUSICXML_MEASURE_SEMANTICS_VERSION = '1.0.0' as const;

export type MusicXmlYesNoEvidence = 'yes' | 'no' | null;
export type MusicXmlTimeSignatureSource = 'DECLARED_HERE' | 'INHERITED' | 'UNKNOWN';
export type MusicXmlCursorOperationKind = 'backup' | 'forward';

export interface MusicXmlCursorOperationEvidence {
  readonly sourceOrder: number;
  readonly kind: MusicXmlCursorOperationKind;
  readonly duration: Rational;
  readonly cursorBefore: Rational;
  readonly cursorAfter: Rational;
}

export interface MusicXmlMeasureSemanticsEntry {
  readonly target: MeasureAddress;
  readonly sourcePartId: string;
  readonly sourceMeasureIndex: number;
  readonly sourceStaffOrdinal: number;
  readonly sourceMeasureNumber: string | null;
  readonly implicit: MusicXmlYesNoEvidence;
  readonly nonControlling: MusicXmlYesNoEvidence;
  readonly declaredTimeSignature: TimeSignature | null;
  readonly effectiveTimeSignature: TimeSignature | null;
  readonly timeSignatureSource: MusicXmlTimeSignatureSource;
  readonly cursorOperations: readonly MusicXmlCursorOperationEvidence[];
}

export interface MusicXmlMeasureSemanticsDocument {
  readonly contractVersion: typeof MUSICXML_MEASURE_SEMANTICS_VERSION;
  readonly documentId: string;
  readonly revisionId: string;
  readonly measures: readonly MusicXmlMeasureSemanticsEntry[];
}

export interface MusicXmlMeasureSemanticsDocumentInput {
  readonly contractVersion: typeof MUSICXML_MEASURE_SEMANTICS_VERSION;
  readonly documentId: string;
  readonly revisionId: string;
  readonly measures: readonly MusicXmlMeasureSemanticsEntry[];
}

export type MusicXmlMeasureSemanticsErrorCode =
  | 'INVALID_EVIDENCE'
  | 'STALE_EVIDENCE'
  | 'TARGET_KIND_MISMATCH'
  | 'DUPLICATE_TARGET';

export class MusicXmlMeasureSemanticsError extends Error {
  readonly code: MusicXmlMeasureSemanticsErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, code: MusicXmlMeasureSemanticsErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'MusicXmlMeasureSemanticsError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

type UnknownRecord = Record<string, unknown>;

const record = (value: unknown, fields: readonly string[], label: string): UnknownRecord => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new MusicXmlMeasureSemanticsError(`${label} must be an object.`, 'INVALID_EVIDENCE');
  }
  const item = value as UnknownRecord;
  const observed = Object.keys(item).sort();
  const expected = [...fields].sort();
  if (JSON.stringify(observed) !== JSON.stringify(expected)) {
    throw new MusicXmlMeasureSemanticsError(`${label} field set is invalid.`, 'INVALID_EVIDENCE', { observed, expected });
  }
  return item;
};

const nonEmptyId = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim() || value.length > 128) {
    throw new MusicXmlMeasureSemanticsError(`${label} is invalid.`, 'INVALID_EVIDENCE', { value });
  }
  return value;
};

const safeInteger = (value: unknown, min: number, max: number, label: string): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new MusicXmlMeasureSemanticsError(`${label} is outside admitted range.`, 'INVALID_EVIDENCE', { value, min, max });
  }
  return value;
};

const gcd = (left: bigint, right: bigint): bigint => {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
};

const canonicalRational = (value: unknown, label: string, allowZero: boolean): Rational => {
  const item = record(value, ['numerator', 'denominator'], label);
  const numerator = safeInteger(item.numerator, allowZero ? 0 : 1, Number.MAX_SAFE_INTEGER, `${label}.numerator`);
  const denominator = safeInteger(item.denominator, 1, Number.MAX_SAFE_INTEGER, `${label}.denominator`);
  if (gcd(BigInt(numerator), BigInt(denominator)) !== 1n) {
    throw new MusicXmlMeasureSemanticsError(`${label} must be reduced.`, 'INVALID_EVIDENCE');
  }
  return Object.freeze({ numerator, denominator });
};

const timeSignature = (value: unknown, label: string): TimeSignature | null => {
  if (value === null) return null;
  const item = record(value, ['beats', 'beatType'], label);
  const beats = safeInteger(item.beats, 1, 32, `${label}.beats`);
  const beatType = safeInteger(item.beatType, 1, 64, `${label}.beatType`);
  if (![1, 2, 4, 8, 16, 32, 64].includes(beatType)) {
    throw new MusicXmlMeasureSemanticsError(`${label}.beatType is unsupported.`, 'INVALID_EVIDENCE', { beatType });
  }
  return Object.freeze({ beats, beatType });
};

const yesNo = (value: unknown, label: string): MusicXmlYesNoEvidence => {
  if (value === null || value === 'yes' || value === 'no') return value;
  throw new MusicXmlMeasureSemanticsError(`${label} must be yes, no, or null.`, 'INVALID_EVIDENCE', { value });
};

const sameTime = (left: TimeSignature | null, right: TimeSignature | null): boolean =>
  left === null || right === null
    ? left === right
    : left.beats === right.beats && left.beatType === right.beatType;

const validateCursorOperations = (value: unknown, label: string): readonly MusicXmlCursorOperationEvidence[] => {
  if (!Array.isArray(value) || value.length > 100000) {
    throw new MusicXmlMeasureSemanticsError(`${label} must be a bounded array.`, 'INVALID_EVIDENCE');
  }
  let previousOrder = -1;
  return Object.freeze(value.map((raw, index) => {
    const item = record(raw, ['sourceOrder', 'kind', 'duration', 'cursorBefore', 'cursorAfter'], `${label}[${index}]`);
    const sourceOrder = safeInteger(item.sourceOrder, 0, Number.MAX_SAFE_INTEGER, `${label}[${index}].sourceOrder`);
    if (sourceOrder <= previousOrder) {
      throw new MusicXmlMeasureSemanticsError(`${label} source order must be strictly increasing.`, 'INVALID_EVIDENCE');
    }
    previousOrder = sourceOrder;
    if (item.kind !== 'backup' && item.kind !== 'forward') {
      throw new MusicXmlMeasureSemanticsError(`${label}[${index}].kind is unsupported.`, 'INVALID_EVIDENCE');
    }
    return Object.freeze({
      sourceOrder,
      kind: item.kind,
      duration: canonicalRational(item.duration, `${label}[${index}].duration`, false),
      cursorBefore: canonicalRational(item.cursorBefore, `${label}[${index}].cursorBefore`, true),
      cursorAfter: canonicalRational(item.cursorAfter, `${label}[${index}].cursorAfter`, true)
    });
  }));
};

export const createMusicXmlMeasureSemanticsDocument = (
  score: ScoreDocument,
  input: MusicXmlMeasureSemanticsDocumentInput
): Readonly<MusicXmlMeasureSemanticsDocument> => {
  record(input, ['contractVersion', 'documentId', 'revisionId', 'measures'], 'MusicXmlMeasureSemanticsDocument');
  if (input.contractVersion !== MUSICXML_MEASURE_SEMANTICS_VERSION) {
    throw new MusicXmlMeasureSemanticsError('Measure-semantics contract version is unsupported.', 'INVALID_EVIDENCE');
  }
  if (input.documentId !== score.id || input.revisionId !== score.revision.id) {
    throw new MusicXmlMeasureSemanticsError('Measure-semantics evidence belongs to another score revision.', 'STALE_EVIDENCE', {
      expectedDocumentId: score.id,
      expectedRevisionId: score.revision.id,
      observedDocumentId: input.documentId,
      observedRevisionId: input.revisionId
    });
  }
  if (!Array.isArray(input.measures) || input.measures.length > 100000) {
    throw new MusicXmlMeasureSemanticsError('Measure-semantics entries must be a bounded array.', 'INVALID_EVIDENCE');
  }

  const seenTargets = new Set<string>();
  const measures = input.measures.map((rawEntry, index) => {
    const item = record(rawEntry, [
      'target', 'sourcePartId', 'sourceMeasureIndex', 'sourceStaffOrdinal', 'sourceMeasureNumber',
      'implicit', 'nonControlling', 'declaredTimeSignature', 'effectiveTimeSignature',
      'timeSignatureSource', 'cursorOperations'
    ], `measures[${index}]`);

    const target = item.target as MeasureAddress;
    let resolved;
    try {
      resolved = resolveSemanticAddress(score, target);
    } catch (error) {
      throw new MusicXmlMeasureSemanticsError('Measure-semantics target does not resolve on the current score.', 'STALE_EVIDENCE', {
        index,
        cause: error instanceof Error ? error.message : String(error)
      });
    }
    if (resolved.kind !== 'measure') {
      throw new MusicXmlMeasureSemanticsError('Measure-semantics target kind is invalid.', 'TARGET_KIND_MISMATCH', { index, observed: resolved.kind });
    }
    if (seenTargets.has(target.measureId)) {
      throw new MusicXmlMeasureSemanticsError('Measure-semantics contains a duplicate canonical measure target.', 'DUPLICATE_TARGET', { measureId: target.measureId });
    }
    seenTargets.add(target.measureId);

    const sourcePartId = nonEmptyId(item.sourcePartId, `measures[${index}].sourcePartId`);
    const sourceMeasureIndex = safeInteger(item.sourceMeasureIndex, 0, Number.MAX_SAFE_INTEGER, `measures[${index}].sourceMeasureIndex`);
    const sourceStaffOrdinal = safeInteger(item.sourceStaffOrdinal, 1, 128, `measures[${index}].sourceStaffOrdinal`);
    const sourceMeasureNumber = item.sourceMeasureNumber === null
      ? null
      : nonEmptyId(item.sourceMeasureNumber, `measures[${index}].sourceMeasureNumber`);
    const implicit = yesNo(item.implicit, `measures[${index}].implicit`);
    const nonControlling = yesNo(item.nonControlling, `measures[${index}].nonControlling`);
    const declaredTimeSignature = timeSignature(item.declaredTimeSignature, `measures[${index}].declaredTimeSignature`);
    const effectiveTimeSignature = timeSignature(item.effectiveTimeSignature, `measures[${index}].effectiveTimeSignature`);

    if (!['DECLARED_HERE', 'INHERITED', 'UNKNOWN'].includes(item.timeSignatureSource as string)) {
      throw new MusicXmlMeasureSemanticsError('timeSignatureSource is unsupported.', 'INVALID_EVIDENCE', { index, value: item.timeSignatureSource });
    }
    const timeSignatureSource = item.timeSignatureSource as MusicXmlTimeSignatureSource;
    if (timeSignatureSource === 'DECLARED_HERE' && (declaredTimeSignature === null || !sameTime(declaredTimeSignature, effectiveTimeSignature))) {
      throw new MusicXmlMeasureSemanticsError('Declared time-signature evidence is inconsistent.', 'INVALID_EVIDENCE', { index });
    }
    if (timeSignatureSource === 'INHERITED' && (declaredTimeSignature !== null || effectiveTimeSignature === null)) {
      throw new MusicXmlMeasureSemanticsError('Inherited time-signature evidence is inconsistent.', 'INVALID_EVIDENCE', { index });
    }
    if (timeSignatureSource === 'UNKNOWN' && (declaredTimeSignature !== null || effectiveTimeSignature !== null)) {
      throw new MusicXmlMeasureSemanticsError('Unknown time-signature evidence must not carry a value.', 'INVALID_EVIDENCE', { index });
    }

    return Object.freeze({
      target,
      sourcePartId,
      sourceMeasureIndex,
      sourceStaffOrdinal,
      sourceMeasureNumber,
      implicit,
      nonControlling,
      declaredTimeSignature,
      effectiveTimeSignature,
      timeSignatureSource,
      cursorOperations: validateCursorOperations(item.cursorOperations, `measures[${index}].cursorOperations`)
    });
  });

  return Object.freeze({
    contractVersion: MUSICXML_MEASURE_SEMANTICS_VERSION,
    documentId: score.id,
    revisionId: score.revision.id,
    measures: Object.freeze(measures)
  });
};

export const semanticsForMeasure = (
  document: MusicXmlMeasureSemanticsDocument,
  measureId: string
): MusicXmlMeasureSemanticsEntry | null => document.measures.find((entry) => entry.target.measureId === measureId) ?? null;
