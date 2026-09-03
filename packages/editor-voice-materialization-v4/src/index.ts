import type { Rational, ScoreEvent } from '../../score-model/src/index.js';
import { createScoreDocumentV3, type ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import {
  addressEntityV3,
  createSemanticAddressIndexV3,
  resolveSemanticAddressV3,
  type EventAddressV3,
  type MeasureAddressV3,
  type SemanticAddressV3,
  type VoiceAddressV3
} from '../../addressing-v3/src/index.js';
import { createNotationDocumentV4, type NotationDocumentV4 } from '../../notation-structure-v4/src/index.js';
import { ACTIVE_VOICE_ORDINALS_V4, type ActiveVoiceOrdinalV4 } from '../../editor-active-voice-v4/src/index.js';

export const VOICE_MATERIALIZATION_V4_VERSION = '1.0.0' as const;

export interface MaterializeVoiceV4Intent {
  readonly version: typeof VOICE_MATERIALIZATION_V4_VERSION;
  readonly type: 'MATERIALIZE_VOICE';
  readonly target: MeasureAddressV3;
  readonly voiceOrdinal: ActiveVoiceOrdinalV4;
  readonly voiceId: string;
  readonly restEventId: string;
}

export interface VoiceMaterializationV4Options {
  readonly nextRevisionId: string;
}

export interface VoiceMaterializationV4Result {
  readonly score: Readonly<ScoreDocumentV3>;
  readonly notation: Readonly<NotationDocumentV4>;
  readonly selection: VoiceAddressV3;
  readonly measureDuration: Rational;
}

export type VoiceMaterializationV4ErrorCode =
  | 'INVALID_INTENT'
  | 'INVALID_OPTIONS'
  | 'STALE_TARGET'
  | 'STAFF_SCOPE_UNSUPPORTED'
  | 'SOURCE_SCOPE_UNSUPPORTED'
  | 'VOICE_ALREADY_PRESENT'
  | 'METER_UNAVAILABLE'
  | 'MEASURE_COVERAGE_UNPROVEN'
  | 'IDENTITY_COLLISION'
  | 'RESULT_INVALID';

export class VoiceMaterializationV4Error extends Error {
  readonly code: VoiceMaterializationV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: VoiceMaterializationV4ErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'VoiceMaterializationV4Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

type R = Record<string, unknown>;
const rec = (value: unknown): value is R => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value: unknown, keys: readonly string[]): value is R =>
  rec(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const abs = (value: bigint): bigint => value < 0n ? -value : value;
const gcd = (left: bigint, right: bigint): bigint => {
  let a = abs(left), b = abs(right);
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
};
const rational = (numerator: bigint, denominator: bigint): Rational => {
  if (numerator < 0n || denominator <= 0n) throw new VoiceMaterializationV4Error('Rational arithmetic failed.', 'RESULT_INVALID');
  const divisor = gcd(numerator, denominator);
  const n = numerator / divisor, d = denominator / divisor;
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (n > max || d > max) throw new VoiceMaterializationV4Error('Rational arithmetic exceeded safe integer bounds.', 'RESULT_INVALID');
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
  if (next.kind !== address.kind) throw new VoiceMaterializationV4Error('Voice materialization would orphan notation identity.', 'RESULT_INVALID', { id: entityId(address) });
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
  crossStaffPlacements: notation.crossStaffPlacements.map(item => ({ source: rebind(score, item.source) as EventAddressV3, displayStaffId: item.displayStaffId }))
});

const parseIntent = (raw: unknown): Readonly<MaterializeVoiceV4Intent> => {
  if (!exact(raw, ['version','type','target','voiceOrdinal','voiceId','restEventId']) ||
      raw.version !== VOICE_MATERIALIZATION_V4_VERSION || raw.type !== 'MATERIALIZE_VOICE' ||
      typeof raw.voiceOrdinal !== 'number' || !(ACTIVE_VOICE_ORDINALS_V4 as readonly number[]).includes(raw.voiceOrdinal) ||
      typeof raw.voiceId !== 'string' || !ID.test(raw.voiceId) ||
      typeof raw.restEventId !== 'string' || !ID.test(raw.restEventId) || raw.voiceId === raw.restEventId) {
    throw new VoiceMaterializationV4Error('Voice materialization intent is invalid.', 'INVALID_INTENT');
  }
  return Object.freeze({
    version: VOICE_MATERIALIZATION_V4_VERSION,
    type: 'MATERIALIZE_VOICE',
    target: raw.target as MeasureAddressV3,
    voiceOrdinal: raw.voiceOrdinal as ActiveVoiceOrdinalV4,
    voiceId: raw.voiceId,
    restEventId: raw.restEventId
  });
};
const parseOptions = (raw: VoiceMaterializationV4Options): Readonly<VoiceMaterializationV4Options> => {
  if (!exact(raw, ['nextRevisionId']) || typeof raw.nextRevisionId !== 'string' || !ID.test(raw.nextRevisionId)) {
    throw new VoiceMaterializationV4Error('Voice materialization options are invalid.', 'INVALID_OPTIONS');
  }
  return Object.freeze({ nextRevisionId: raw.nextRevisionId });
};

const effectiveMeasureDuration = (score: ScoreDocumentV3, notation: NotationDocumentV4, frameId: string): Rational => {
  const frameIndex = score.measureFrames.findIndex(frame => frame.id === frameId);
  if (frameIndex < 0) throw new VoiceMaterializationV4Error('Target measure frame is unavailable.', 'METER_UNAVAILABLE');
  const notationByFrame = new Map(notation.frames.map(entry => [entry.target.frameId, entry.notation]));
  for (let index = frameIndex; index >= 0; index -= 1) {
    const frame = score.measureFrames[index]!;
    const signature = notationByFrame.get(frame.id)?.timeSignature ?? null;
    if (signature !== null) return rational(BigInt(signature.beats), BigInt(signature.beatType));
  }
  throw new VoiceMaterializationV4Error('No effective time signature is available for the target measure.', 'METER_UNAVAILABLE', { frameId });
};

const fullyCoversMeasure = (events: readonly ScoreEvent[], duration: Rational): boolean => {
  if (events.length === 0) return false;
  const ordered = [...events].sort((left, right) => compare(left.onset, right.onset));
  let cursor: Rational = Object.freeze({ numerator: 0, denominator: 1 });
  for (const event of ordered) {
    if (compare(event.onset, cursor) !== 0) return false;
    cursor = add(cursor, event.duration);
    if (compare(cursor, duration) > 0) return false;
  }
  return compare(cursor, duration) === 0;
};

export const executeVoiceMaterializationV4 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  rawIntent: unknown,
  rawOptions: VoiceMaterializationV4Options
): Readonly<VoiceMaterializationV4Result> => {
  const score = createScoreDocumentV3(scoreInput);
  const notation = createNotationDocumentV4(score, notationInput);
  const intent = parseIntent(rawIntent);
  const options = parseOptions(rawOptions);
  if (options.nextRevisionId === score.revision.id || options.nextRevisionId === score.revision.parentId) {
    throw new VoiceMaterializationV4Error('Next revision identity conflicts with current lineage.', 'INVALID_OPTIONS');
  }
  if (score.source.format !== 'synthetic') {
    throw new VoiceMaterializationV4Error('Automatic Voice materialization is currently admitted only for synthetic/new scores.', 'SOURCE_SCOPE_UNSUPPORTED', { sourceFormat: score.source.format });
  }

  let resolved;
  try {
    resolved = resolveSemanticAddressV3(score, intent.target);
  } catch (error) {
    throw new VoiceMaterializationV4Error('Voice materialization target is stale or invalid.', 'STALE_TARGET', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
  if (resolved.kind !== 'measure') throw new VoiceMaterializationV4Error('Voice materialization requires an exact measure target.', 'STALE_TARGET');
  const part = score.parts.find(item => item.id === intent.target.partId);
  const staff = part?.staves.find(item => item.id === intent.target.staffId);
  if (staff === undefined || staff.role !== 'standard') {
    throw new VoiceMaterializationV4Error('Automatic Voice materialization is admitted only on standard staves.', 'STAFF_SCOPE_UNSUPPORTED');
  }
  const measure = staff.measures.find(item => item.id === intent.target.measureId && item.frameId === intent.target.frameId);
  if (measure === undefined) throw new VoiceMaterializationV4Error('Target measure path is invalid.', 'STALE_TARGET');
  if (measure.voices.some(voice => voice.ordinal === intent.voiceOrdinal)) {
    throw new VoiceMaterializationV4Error('Requested Voice already exists in the target measure.', 'VOICE_ALREADY_PRESENT', { voiceOrdinal: intent.voiceOrdinal });
  }

  const duration = effectiveMeasureDuration(score, notation, intent.target.frameId);
  if (!measure.voices.some(voice => fullyCoversMeasure(voice.events, duration))) {
    throw new VoiceMaterializationV4Error('No existing Voice proves exact full-measure coverage for safe materialization.', 'MEASURE_COVERAGE_UNPROVEN', {
      measureId: measure.id,
      measureDuration: duration
    });
  }
  const ids = createSemanticAddressIndexV3(score).byEntityId;
  if (ids.has(intent.voiceId) || ids.has(intent.restEventId)) {
    throw new VoiceMaterializationV4Error('New Voice/rest identity collides with current canonical identity.', 'IDENTITY_COLLISION');
  }

  const candidate = structuredClone(score) as ScoreDocumentV3;
  const candidatePart = candidate.parts.find(item => item.id === intent.target.partId)!;
  const candidateStaff = candidatePart.staves.find(item => item.id === intent.target.staffId)!;
  if (candidateStaff.role === 'tablature-linked') throw new VoiceMaterializationV4Error('Target staff lost content authority.', 'RESULT_INVALID');
  const candidateMeasure = candidateStaff.measures.find(item => item.id === intent.target.measureId)!;
  const nextVoices = [...candidateMeasure.voices, {
    id: intent.voiceId,
    ordinal: intent.voiceOrdinal,
    events: [{
      id: intent.restEventId,
      kind: 'rest' as const,
      onset: { numerator: 0, denominator: 1 },
      duration
    }],
    graceGroups: []
  }].sort((left, right) => left.ordinal - right.ordinal);
  (candidateMeasure as { voices: typeof nextVoices }).voices = nextVoices;
  (candidate as { revision: { id: string; parentId: string | null } }).revision = {
    id: options.nextRevisionId,
    parentId: score.revision.id
  };

  let nextScore: Readonly<ScoreDocumentV3>;
  try {
    nextScore = createScoreDocumentV3(candidate);
  } catch (error) {
    throw new VoiceMaterializationV4Error('Voice materialization candidate failed canonical validation.', 'RESULT_INVALID', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
  let nextNotation: Readonly<NotationDocumentV4>;
  try {
    nextNotation = rebindNotation(nextScore, notation);
  } catch (error) {
    if (error instanceof VoiceMaterializationV4Error) throw error;
    throw new VoiceMaterializationV4Error('Voice materialization notation rebinding failed.', 'RESULT_INVALID', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
  const selection = addressEntityV3(nextScore, intent.voiceId);
  if (selection.kind !== 'voice') throw new VoiceMaterializationV4Error('Materialized Voice identity did not resolve as Voice.', 'RESULT_INVALID');
  return Object.freeze({ score: nextScore, notation: nextNotation, selection, measureDuration: duration });
};
