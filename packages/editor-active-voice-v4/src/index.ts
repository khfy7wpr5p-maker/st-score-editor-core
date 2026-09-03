import type { Rational } from '../../score-model/src/index.js';
import { createScoreDocumentV3, type ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import {
  addressEntityV3,
  resolveSemanticAddressV3,
  type SemanticAddressV3,
  type VoiceAddressV3
} from '../../addressing-v3/src/index.js';
import { createInsertionPositionV3, type InsertionPositionV3 } from '../../editor-insertion-position-v3/src/index.js';

export const ACTIVE_VOICE_V4_VERSION = '1.0.0' as const;
export const ACTIVE_VOICE_ORDINALS_V4 = Object.freeze([1, 2, 3, 4, 5] as const);
export type ActiveVoiceOrdinalV4 = typeof ACTIVE_VOICE_ORDINALS_V4[number];

export type ActiveVoiceV4ErrorCode =
  | 'INVALID_VOICE_ORDINAL'
  | 'STALE_CONTEXT'
  | 'MEASURE_CONTEXT_REQUIRED'
  | 'VOICE_NOT_PRESENT';

export class ActiveVoiceV4Error extends Error {
  readonly code: ActiveVoiceV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: ActiveVoiceV4ErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ActiveVoiceV4Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const parseOrdinal = (value: number): ActiveVoiceOrdinalV4 => {
  if (!(ACTIVE_VOICE_ORDINALS_V4 as readonly number[]).includes(value)) {
    throw new ActiveVoiceV4Error('Active Voice must be one of 1, 2, 3, 4 or 5.', 'INVALID_VOICE_ORDINAL', { value });
  }
  return value as ActiveVoiceOrdinalV4;
};

type MeasureContext = Readonly<{
  partId: string;
  staffId: string;
  frameId: string;
  measureId: string;
}>;

const measureContextFor = (score: ScoreDocumentV3, context: SemanticAddressV3): MeasureContext => {
  try {
    resolveSemanticAddressV3(score, context);
  } catch (error) {
    throw new ActiveVoiceV4Error('Active Voice context is stale or invalid.', 'STALE_CONTEXT', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
  switch (context.kind) {
    case 'measure':
    case 'voice':
    case 'event':
    case 'note':
    case 'grace-group':
    case 'grace-event':
    case 'grace-note':
      return Object.freeze({
        partId: context.partId,
        staffId: context.staffId,
        frameId: context.frameId,
        measureId: context.measureId
      });
    default:
      throw new ActiveVoiceV4Error('Active Voice requires a current measure-level semantic context.', 'MEASURE_CONTEXT_REQUIRED', {
        kind: context.kind
      });
  }
};

export const resolveActiveVoiceAddressV4 = (
  scoreInput: ScoreDocumentV3,
  context: SemanticAddressV3,
  requestedOrdinal: number
): Readonly<VoiceAddressV3> => {
  const score = createScoreDocumentV3(scoreInput);
  const ordinal = parseOrdinal(requestedOrdinal);
  const scope = measureContextFor(score, context);
  const part = score.parts.find(item => item.id === scope.partId);
  const staff = part?.staves.find(item => item.id === scope.staffId);
  if (staff === undefined || staff.role === 'tablature-linked') {
    throw new ActiveVoiceV4Error('Active Voice context does not resolve to a content-bearing staff.', 'MEASURE_CONTEXT_REQUIRED');
  }
  const measure = staff.measures.find(item => item.id === scope.measureId && item.frameId === scope.frameId);
  const voice = measure?.voices.find(item => item.ordinal === ordinal);
  if (voice === undefined) {
    throw new ActiveVoiceV4Error('Requested active Voice does not exist in the current canonical measure.', 'VOICE_NOT_PRESENT', {
      requestedOrdinal: ordinal,
      measureId: scope.measureId
    });
  }
  const address = addressEntityV3(score, voice.id);
  if (address.kind !== 'voice') throw new ActiveVoiceV4Error('Resolved active Voice identity changed kind.', 'VOICE_NOT_PRESENT');
  return address;
};

export const createActiveVoiceInsertionPositionV4 = (
  scoreInput: ScoreDocumentV3,
  context: SemanticAddressV3,
  requestedOrdinal: number,
  onset: Rational
): Readonly<InsertionPositionV3> => createInsertionPositionV3(
  scoreInput,
  resolveActiveVoiceAddressV4(scoreInput, context, requestedOrdinal),
  onset
);

export const activeVoiceAvailabilityV4 = (
  scoreInput: ScoreDocumentV3,
  context: SemanticAddressV3
): readonly ActiveVoiceOrdinalV4[] => {
  const score = createScoreDocumentV3(scoreInput);
  const scope = measureContextFor(score, context);
  const part = score.parts.find(item => item.id === scope.partId);
  const staff = part?.staves.find(item => item.id === scope.staffId);
  if (staff === undefined || staff.role === 'tablature-linked') return Object.freeze([]);
  const measure = staff.measures.find(item => item.id === scope.measureId && item.frameId === scope.frameId);
  if (measure === undefined) return Object.freeze([]);
  return Object.freeze(
    measure.voices
      .map(item => item.ordinal)
      .filter((ordinal): ordinal is ActiveVoiceOrdinalV4 => (ACTIVE_VOICE_ORDINALS_V4 as readonly number[]).includes(ordinal))
      .sort((left, right) => left - right)
  );
};
