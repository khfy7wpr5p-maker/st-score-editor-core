import { createScoreDocument } from '../../score-model/src/index.js';
import type { Rational, ScoreDocument, ScoreEvent } from '../../score-model/src/index.js';
import { createSemanticAddressIndex } from '../../addressing/src/index.js';
import type { NotationDocument, TimeSignature } from '../../notation-structure/src/index.js';
import { resolveInsertionPosition } from '../../editor-insertion-position/src/index.js';
import type { InsertionPosition } from '../../editor-insertion-position/src/index.js';
import {
  analyzeMeasureTiming,
  classifyInsertionWindow
} from '../../editor-measure-timing/src/index.js';
import {
  createMusicXmlMeasureSemanticsDocument,
  semanticsForMeasure
} from '../../musicxml-measure-semantics/src/index.js';
import type { MusicXmlMeasureSemanticsDocument } from '../../musicxml-measure-semantics/src/index.js';

export const IMPLICIT_GAP_MATERIALIZATION_VERSION = '1.0.0' as const;

export interface MaterializeImplicitGapIntent {
  readonly version: typeof IMPLICIT_GAP_MATERIALIZATION_VERSION;
  readonly type: 'MATERIALIZE_IMPLICIT_GAP';
  readonly restEventId: string;
}

export interface ImplicitGapMaterializationCommitIdentity {
  readonly operationId: string;
  readonly nextRevisionId: string;
}

export type ImplicitGapUnsafeReason =
  | 'WINDOW_NOT_IMPLICIT_GAP'
  | 'MISSING_MEASURE_EVIDENCE'
  | 'UNKNOWN_TIME_SIGNATURE'
  | 'TIME_SIGNATURE_MISMATCH'
  | 'IMPLICIT_MEASURE'
  | 'NON_CONTROLLING_MEASURE'
  | 'GAP_NOT_CONTAINED';

export type ImplicitGapMaterializationAssessment =
  | {
      readonly kind: 'ADMITTED_IMPLICIT_GAP';
      readonly safeToMaterialize: true;
      readonly gapStart: Rational;
      readonly gapEnd: Rational;
      readonly requestedStart: Rational;
      readonly requestedEnd: Rational;
    }
  | {
      readonly kind: 'IMPLICIT_GAP_UNSAFE';
      readonly safeToMaterialize: false;
      readonly reason: ImplicitGapUnsafeReason;
    };

export type ImplicitGapMaterializationErrorCode =
  | 'INVALID_INTENT'
  | 'INVALID_COMMIT_IDENTITY'
  | 'INVALID_MEASURE_EVIDENCE'
  | 'WINDOW_NOT_AUTHORIZED'
  | 'ID_CONFLICT'
  | 'RATIONAL_ARITHMETIC'
  | 'RESULT_INVALID';

export class ImplicitGapMaterializationError extends Error {
  readonly code: ImplicitGapMaterializationErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, code: ImplicitGapMaterializationErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ImplicitGapMaterializationError';
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
  typeof value === 'string' && value.length > 0 && value === value.trim() && value.length <= 128 &&
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);

const absBig = (value: bigint): bigint => value < 0n ? -value : value;
const gcdBig = (left: bigint, right: bigint): bigint => {
  let a = absBig(left);
  let b = absBig(right);
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
};

const rational = (numerator: bigint, denominator: bigint): Rational => {
  if (numerator < 0n || denominator <= 0n) {
    throw new ImplicitGapMaterializationError('Gap arithmetic produced an invalid rational.', 'RATIONAL_ARITHMETIC');
  }
  const divisor = gcdBig(numerator, denominator);
  const reducedNumerator = numerator / divisor;
  const reducedDenominator = denominator / divisor;
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (reducedNumerator > max || reducedDenominator > max) {
    throw new ImplicitGapMaterializationError('Gap arithmetic exceeded safe integer bounds.', 'RATIONAL_ARITHMETIC');
  }
  return Object.freeze({ numerator: Number(reducedNumerator), denominator: Number(reducedDenominator) });
};

const compare = (left: Rational, right: Rational): number => {
  const l = BigInt(left.numerator) * BigInt(right.denominator);
  const r = BigInt(right.numerator) * BigInt(left.denominator);
  return l < r ? -1 : l > r ? 1 : 0;
};

const subtract = (left: Rational, right: Rational): Rational => rational(
  BigInt(left.numerator) * BigInt(right.denominator) - BigInt(right.numerator) * BigInt(left.denominator),
  BigInt(left.denominator) * BigInt(right.denominator)
);

const sameTimeSignature = (left: TimeSignature, right: TimeSignature): boolean =>
  left.beats === right.beats && left.beatType === right.beatType;

const parseIntent = (input: unknown): Readonly<MaterializeImplicitGapIntent> => {
  if (!isRecord(input) || !exactFields(input, ['version', 'type', 'restEventId']) ||
      input.version !== IMPLICIT_GAP_MATERIALIZATION_VERSION ||
      input.type !== 'MATERIALIZE_IMPLICIT_GAP' || !validId(input.restEventId)) {
    throw new ImplicitGapMaterializationError('Implicit-gap materialization intent is invalid.', 'INVALID_INTENT');
  }
  return Object.freeze({
    version: IMPLICIT_GAP_MATERIALIZATION_VERSION,
    type: 'MATERIALIZE_IMPLICIT_GAP',
    restEventId: input.restEventId
  });
};

const assertCommitIdentity = (score: ScoreDocument, identity: ImplicitGapMaterializationCommitIdentity): void => {
  if (!validId(identity.operationId) || !validId(identity.nextRevisionId) ||
      identity.nextRevisionId === score.revision.id || identity.nextRevisionId === score.revision.parentId) {
    throw new ImplicitGapMaterializationError('Implicit-gap materialization commit identity is invalid.', 'INVALID_COMMIT_IDENTITY');
  }
};

const validatedEvidence = (
  score: ScoreDocument,
  input: unknown
): Readonly<MusicXmlMeasureSemanticsDocument> => {
  try {
    return createMusicXmlMeasureSemanticsDocument(score, input as MusicXmlMeasureSemanticsDocument);
  } catch (error) {
    throw new ImplicitGapMaterializationError('Implicit-gap materialization requires valid current measure-semantics evidence.', 'INVALID_MEASURE_EVIDENCE', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
};

export const assessImplicitGapMaterialization = (
  score: ScoreDocument,
  notation: NotationDocument,
  rawMeasureSemantics: unknown,
  rawPosition: unknown,
  rawDuration: unknown
): Readonly<ImplicitGapMaterializationAssessment> => {
  const evidence = validatedEvidence(score, rawMeasureSemantics);
  const resolved = resolveInsertionPosition(score, rawPosition);
  const position = resolved.position;
  const analysis = analyzeMeasureTiming(score, notation, position);
  const window = classifyInsertionWindow(score, notation, position, rawDuration);

  if (window.kind !== 'IMPLICIT_GAP_UNADMITTED') {
    return Object.freeze({ kind: 'IMPLICIT_GAP_UNSAFE', safeToMaterialize: false, reason: 'WINDOW_NOT_IMPLICIT_GAP' });
  }

  const semantics = semanticsForMeasure(evidence, position.measureId);
  if (semantics === null || semantics.target.partId !== position.partId || semantics.target.staffId !== position.staffId) {
    return Object.freeze({ kind: 'IMPLICIT_GAP_UNSAFE', safeToMaterialize: false, reason: 'MISSING_MEASURE_EVIDENCE' });
  }
  if (semantics.effectiveTimeSignature === null) {
    return Object.freeze({ kind: 'IMPLICIT_GAP_UNSAFE', safeToMaterialize: false, reason: 'UNKNOWN_TIME_SIGNATURE' });
  }
  if (!sameTimeSignature(semantics.effectiveTimeSignature, analysis.timeSignature)) {
    return Object.freeze({ kind: 'IMPLICIT_GAP_UNSAFE', safeToMaterialize: false, reason: 'TIME_SIGNATURE_MISMATCH' });
  }
  if (semantics.implicit === 'yes') {
    return Object.freeze({ kind: 'IMPLICIT_GAP_UNSAFE', safeToMaterialize: false, reason: 'IMPLICIT_MEASURE' });
  }
  if (semantics.nonControlling === 'yes') {
    return Object.freeze({ kind: 'IMPLICIT_GAP_UNSAFE', safeToMaterialize: false, reason: 'NON_CONTROLLING_MEASURE' });
  }

  const gap = analysis.implicitGaps.find((candidate) =>
    compare(window.start, candidate.start) >= 0 && compare(window.end, candidate.end) <= 0
  );
  if (gap === undefined) {
    return Object.freeze({ kind: 'IMPLICIT_GAP_UNSAFE', safeToMaterialize: false, reason: 'GAP_NOT_CONTAINED' });
  }

  return Object.freeze({
    kind: 'ADMITTED_IMPLICIT_GAP',
    safeToMaterialize: true,
    gapStart: Object.freeze({ ...gap.start }),
    gapEnd: Object.freeze({ ...gap.end }),
    requestedStart: Object.freeze({ ...window.start }),
    requestedEnd: Object.freeze({ ...window.end })
  });
};

const replaceVoice = (
  score: ScoreDocument,
  position: InsertionPosition,
  events: readonly ScoreEvent[]
): ScoreDocument => ({
  ...score,
  parts: score.parts.map((part) => part.id !== position.partId ? part : ({
    ...part,
    staves: part.staves.map((staff) => staff.id !== position.staffId ? staff : ({
      ...staff,
      measures: staff.measures.map((measure) => measure.id !== position.measureId ? measure : ({
        ...measure,
        voices: measure.voices.map((voice) => voice.id !== position.voiceId ? voice : ({ ...voice, events }))
      }))
    }))
  }))
});

export const executeImplicitGapMaterialization = (
  score: ScoreDocument,
  notation: NotationDocument,
  rawMeasureSemantics: unknown,
  rawPosition: unknown,
  rawDuration: unknown,
  rawIntent: unknown,
  identity: ImplicitGapMaterializationCommitIdentity
): Readonly<ScoreDocument> => {
  assertCommitIdentity(score, identity);
  const intent = parseIntent(rawIntent);
  const resolved = resolveInsertionPosition(score, rawPosition);
  const assessment = assessImplicitGapMaterialization(score, notation, rawMeasureSemantics, resolved.position, rawDuration);
  if (!assessment.safeToMaterialize) {
    throw new ImplicitGapMaterializationError('Requested implicit gap is not admitted for deterministic materialization.', 'WINDOW_NOT_AUTHORIZED', {
      reason: assessment.reason
    });
  }

  if (createSemanticAddressIndex(score).byEntityId.has(intent.restEventId)) {
    throw new ImplicitGapMaterializationError('Materialized rest identity already exists in the canonical score.', 'ID_CONFLICT', {
      id: intent.restEventId
    });
  }

  const materializedRest: ScoreEvent = Object.freeze({
    id: intent.restEventId,
    kind: 'rest',
    onset: assessment.gapStart,
    duration: subtract(assessment.gapEnd, assessment.gapStart)
  });
  const events = [...resolved.voice.events, materializedRest].sort((left, right) => compare(left.onset, right.onset));
  const draft = replaceVoice(score, resolved.position, Object.freeze(events));

  try {
    return createScoreDocument({
      ...draft,
      revision: { id: identity.nextRevisionId, parentId: score.revision.id }
    });
  } catch (error) {
    throw new ImplicitGapMaterializationError('Materialized implicit-gap score failed canonical validation.', 'RESULT_INVALID', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
};
