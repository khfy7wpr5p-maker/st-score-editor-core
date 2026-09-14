import {
  addressEntityV3,
  resolveSemanticAddressV3,
  type MeasureFrameAddressV3,
  type SemanticAddressV3
} from '../../addressing-v3/src/index.js';
import {
  createScoreDocumentV3,
  type ScoreDocumentV3
} from '../../score-model-v3/src/index.js';
import type { Rational, ScoreEvent } from '../../score-model/src/index.js';
import type { TimeSignature } from '../../notation-structure/src/index.js';
import {
  createNotationDocumentV4,
  type NotationDocumentV4
} from '../../notation-structure-v4/src/index.js';

export const EDITOR_PROFESSIONAL_TIME_SIGNATURE_V1_VERSION = '1.0.0' as const;

export interface ProfessionalTimeSignatureAdmissionV1 {
  readonly version: typeof EDITOR_PROFESSIONAL_TIME_SIGNATURE_V1_VERSION;
  readonly kind: 'PROFESSIONAL_TIME_SIGNATURE_ADMISSION';
  readonly admitted: true;
  readonly sourceRevisionId: string;
  readonly target: MeasureFrameAddressV3;
  readonly requestedTimeSignature: Readonly<TimeSignature>;
  readonly nominalMeasureDuration: Readonly<Rational>;
  readonly currentDirectTimeSignature: Readonly<TimeSignature> | null;
  readonly affectedFrameIds: readonly string[];
  readonly auditedMeasureIds: readonly string[];
  readonly auditedVoiceCount: number;
  readonly nextExplicitFrameId: string | null;
  readonly canonicalScoreContentMutation: false;
  readonly historyMutationAuthority: false;
}

export interface ProfessionalTimeSignatureOptionsV1 {
  readonly nextRevisionId: string;
}

export interface ProfessionalTimeSignatureResultV1 {
  readonly version: typeof EDITOR_PROFESSIONAL_TIME_SIGNATURE_V1_VERSION;
  readonly score: Readonly<ScoreDocumentV3>;
  readonly notation: Readonly<NotationDocumentV4>;
  readonly selection: MeasureFrameAddressV3;
  readonly admission: Readonly<ProfessionalTimeSignatureAdmissionV1>;
  readonly historyMutationAuthority: false;
}

export type ProfessionalTimeSignatureV1ErrorCode =
  | 'INVALID_TIME_SIGNATURE'
  | 'STALE_TARGET'
  | 'NO_CHANGE'
  | 'FRAME_COVERAGE_INVALID'
  | 'EXISTING_TIMING_INVALID'
  | 'METER_TOO_SHORT'
  | 'ARITHMETIC'
  | 'INVALID_REVISION_ID'
  | 'ADMISSION_STALE_OR_TAMPERED'
  | 'RESULT_INVALID';

export class ProfessionalTimeSignatureV1Error extends Error {
  readonly code: ProfessionalTimeSignatureV1ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: ProfessionalTimeSignatureV1ErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ProfessionalTimeSignatureV1Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

type R = Record<string, unknown>;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const rec = (value: unknown): value is R => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value: unknown, keys: readonly string[]): value is R =>
  rec(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const sameJson = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

const gcd = (left: bigint, right: bigint): bigint => {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
};

const rational = (numerator: bigint, denominator: bigint): Readonly<Rational> => {
  if (numerator < 0n || denominator <= 0n) {
    throw new ProfessionalTimeSignatureV1Error('Time-signature arithmetic became invalid.', 'ARITHMETIC');
  }
  const divisor = gcd(numerator, denominator);
  const n = numerator / divisor;
  const d = denominator / divisor;
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (n > max || d > max) {
    throw new ProfessionalTimeSignatureV1Error('Time-signature arithmetic exceeded safe integer bounds.', 'ARITHMETIC');
  }
  return Object.freeze({ numerator: Number(n), denominator: Number(d) });
};

const add = (left: Rational, right: Rational): Readonly<Rational> => rational(
  BigInt(left.numerator) * BigInt(right.denominator) + BigInt(right.numerator) * BigInt(left.denominator),
  BigInt(left.denominator) * BigInt(right.denominator)
);

const compare = (left: Rational, right: Rational): number => {
  const l = BigInt(left.numerator) * BigInt(right.denominator);
  const r = BigInt(right.numerator) * BigInt(left.denominator);
  return l < r ? -1 : l > r ? 1 : 0;
};

const parseTimeSignature = (value: unknown): Readonly<TimeSignature> => {
  if (
    !exact(value, ['beats', 'beatType']) ||
    typeof value.beats !== 'number' ||
    !Number.isSafeInteger(value.beats) ||
    value.beats < 1 ||
    value.beats > 32 ||
    typeof value.beatType !== 'number' ||
    !Number.isSafeInteger(value.beatType) ||
    ![1, 2, 4, 8, 16, 32, 64].includes(value.beatType)
  ) {
    throw new ProfessionalTimeSignatureV1Error(
      'Time signature must use beats 1..32 and a power-of-two beatType 1..64.',
      'INVALID_TIME_SIGNATURE'
    );
  }
  return Object.freeze({ beats: value.beats, beatType: value.beatType });
};

const frameTarget = (score: ScoreDocumentV3, target: MeasureFrameAddressV3): MeasureFrameAddressV3 => {
  try {
    const resolved = resolveSemanticAddressV3(score, target);
    if (resolved.kind !== 'measure-frame') throw new Error(`observed ${resolved.kind}`);
    return target;
  } catch (error) {
    throw new ProfessionalTimeSignatureV1Error(
      'Time-signature target frame is stale or invalid.',
      'STALE_TARGET',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

const eventEnd = (event: ScoreEvent): Readonly<Rational> => add(event.onset, event.duration);

const affectedFrames = (
  score: ScoreDocumentV3,
  notation: NotationDocumentV4,
  targetFrameId: string
): Readonly<{ frameIds: readonly string[]; nextExplicitFrameId: string | null }> => {
  const start = score.measureFrames.findIndex(frame => frame.id === targetFrameId);
  if (start < 0) {
    throw new ProfessionalTimeSignatureV1Error('Target frame disappeared from canonical frame sequence.', 'STALE_TARGET');
  }
  const explicit = new Map(notation.frames.map(entry => [entry.target.frameId, entry.notation.timeSignature] as const));
  const ids: string[] = [];
  let nextExplicitFrameId: string | null = null;
  for (let index = start; index < score.measureFrames.length; index += 1) {
    const frame = score.measureFrames[index];
    if (frame === undefined) break;
    if (index > start && (explicit.get(frame.id) ?? null) !== null) {
      nextExplicitFrameId = frame.id;
      break;
    }
    ids.push(frame.id);
  }
  return Object.freeze({ frameIds: Object.freeze(ids), nextExplicitFrameId });
};

const auditTiming = (
  score: ScoreDocumentV3,
  frameIds: readonly string[],
  nominalDuration: Rational
): Readonly<{ measureIds: readonly string[]; voiceCount: number }> => {
  const wanted = new Set(frameIds);
  const measureIds: string[] = [];
  let voiceCount = 0;

  for (const part of score.parts) {
    for (const staff of part.staves) {
      if (staff.role === 'tablature-linked') continue;
      for (const frameId of frameIds) {
        const measure = staff.measures.find(candidate => candidate.frameId === frameId);
        if (measure === undefined) {
          throw new ProfessionalTimeSignatureV1Error(
            'Every affected frame must be represented on every content staff.',
            'FRAME_COVERAGE_INVALID',
            { partId: part.id, staffId: staff.id, frameId }
          );
        }
        measureIds.push(measure.id);
        if (measure.voices.length === 0) {
          throw new ProfessionalTimeSignatureV1Error(
            'Affected content-staff measures must contain at least one canonical voice.',
            'FRAME_COVERAGE_INVALID',
            { measureId: measure.id, frameId }
          );
        }
        for (const voice of measure.voices) {
          voiceCount += 1;
          const originalOrder = new Map(voice.events.map((event, index) => [event.id, index] as const));
          const ordered = [...voice.events].sort((left, right) =>
            compare(left.onset, right.onset) ||
            (originalOrder.get(left.id) ?? 0) - (originalOrder.get(right.id) ?? 0)
          );
          let previousEnd: Readonly<Rational> | null = null;
          let previousEventId: string | null = null;
          for (const event of ordered) {
            if (previousEnd !== null && compare(event.onset, previousEnd) < 0) {
              throw new ProfessionalTimeSignatureV1Error(
                'Existing voice timing overlaps before meter mutation; time signature authoring cannot mask invalid timing.',
                'EXISTING_TIMING_INVALID',
                { measureId: measure.id, voiceId: voice.id, previousEventId, eventId: event.id }
              );
            }
            const end = eventEnd(event);
            if (compare(end, nominalDuration) > 0) {
              throw new ProfessionalTimeSignatureV1Error(
                'Requested meter is shorter than existing timed content in an affected frame.',
                'METER_TOO_SHORT',
                {
                  frameId,
                  measureId: measure.id,
                  voiceId: voice.id,
                  eventId: event.id,
                  eventEnd: end,
                  nominalDuration
                }
              );
            }
            previousEnd = end;
            previousEventId = event.id;
          }
        }
      }
    }
  }

  if (wanted.size !== frameIds.length) {
    throw new ProfessionalTimeSignatureV1Error('Affected frame list contains duplicate identities.', 'FRAME_COVERAGE_INVALID');
  }
  return Object.freeze({ measureIds: Object.freeze(measureIds), voiceCount });
};

export const analyzeProfessionalTimeSignatureV1 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  targetInput: MeasureFrameAddressV3,
  requestedInput: unknown
): Readonly<ProfessionalTimeSignatureAdmissionV1> => {
  const score = createScoreDocumentV3(scoreInput);
  const notation = createNotationDocumentV4(score, notationInput);
  const target = frameTarget(score, targetInput);
  const requested = parseTimeSignature(requestedInput);
  const currentDirect = notation.frames.find(entry => entry.target.frameId === target.frameId)?.notation.timeSignature ?? null;
  if (currentDirect !== null && sameJson(currentDirect, requested)) {
    throw new ProfessionalTimeSignatureV1Error(
      'Requested time signature already exists directly on the target frame.',
      'NO_CHANGE',
      { frameId: target.frameId }
    );
  }

  const nominalMeasureDuration = rational(BigInt(requested.beats), BigInt(requested.beatType));
  const affected = affectedFrames(score, notation, target.frameId);
  const timing = auditTiming(score, affected.frameIds, nominalMeasureDuration);

  return Object.freeze({
    version: EDITOR_PROFESSIONAL_TIME_SIGNATURE_V1_VERSION,
    kind: 'PROFESSIONAL_TIME_SIGNATURE_ADMISSION' as const,
    admitted: true as const,
    sourceRevisionId: score.revision.id,
    target: Object.freeze({ ...target }),
    requestedTimeSignature: requested,
    nominalMeasureDuration,
    currentDirectTimeSignature: currentDirect === null ? null : Object.freeze({ ...currentDirect }),
    affectedFrameIds: affected.frameIds,
    auditedMeasureIds: timing.measureIds,
    auditedVoiceCount: timing.voiceCount,
    nextExplicitFrameId: affected.nextExplicitFrameId,
    canonicalScoreContentMutation: false as const,
    historyMutationAuthority: false as const
  });
};

const assertFreshRevision = (score: ScoreDocumentV3, nextRevisionId: string): void => {
  if (!ID.test(nextRevisionId) || nextRevisionId === score.revision.id || nextRevisionId === score.revision.parentId) {
    throw new ProfessionalTimeSignatureV1Error(
      'Time-signature authoring requires a fresh stable revision id.',
      'INVALID_REVISION_ID',
      { nextRevisionId, currentRevisionId: score.revision.id, parentRevisionId: score.revision.parentId }
    );
  }
};

const targetId = (address: SemanticAddressV3): string => {
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
  const rebound = addressEntityV3(score, targetId(address));
  if (rebound.kind !== address.kind) {
    throw new ProfessionalTimeSignatureV1Error(
      'Time-signature authoring would orphan an existing semantic notation address.',
      'RESULT_INVALID',
      { targetId: targetId(address), expectedKind: address.kind, observedKind: rebound.kind }
    );
  }
  return rebound;
};

export const executeProfessionalTimeSignatureV1 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  targetInput: MeasureFrameAddressV3,
  requestedInput: unknown,
  admissionInput: ProfessionalTimeSignatureAdmissionV1,
  options: ProfessionalTimeSignatureOptionsV1
): Readonly<ProfessionalTimeSignatureResultV1> => {
  const score = createScoreDocumentV3(scoreInput);
  const notation = createNotationDocumentV4(score, notationInput);
  const currentAdmission = analyzeProfessionalTimeSignatureV1(score, notation, targetInput, requestedInput);
  if (!sameJson(currentAdmission, admissionInput)) {
    throw new ProfessionalTimeSignatureV1Error(
      'Time-signature admission facts changed or were tampered with before mutation.',
      'ADMISSION_STALE_OR_TAMPERED'
    );
  }
  assertFreshRevision(score, options.nextRevisionId);

  const rawScore = structuredClone(score) as ScoreDocumentV3;
  (rawScore as { revision: ScoreDocumentV3['revision'] }).revision = {
    id: options.nextRevisionId,
    parentId: score.revision.id
  };
  let nextScore: Readonly<ScoreDocumentV3>;
  try {
    nextScore = createScoreDocumentV3(rawScore);
  } catch (error) {
    throw new ProfessionalTimeSignatureV1Error(
      'Time-signature score revision candidate failed canonical validation.',
      'RESULT_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }

  const targetFrameId = currentAdmission.target.frameId;
  const existingFrame = notation.frames.find(entry => entry.target.frameId === targetFrameId);
  const nextFrameNotation = {
    timeSignature: currentAdmission.requestedTimeSignature,
    barlines: existingFrame?.notation.barlines ?? []
  };
  const nextFrames = existingFrame === undefined
    ? [
        ...notation.frames.map(entry => ({ target: rebind(nextScore, entry.target) as typeof entry.target, notation: entry.notation })),
        { target: rebind(nextScore, currentAdmission.target) as MeasureFrameAddressV3, notation: nextFrameNotation }
      ]
    : notation.frames.map(entry => entry.target.frameId === targetFrameId
        ? { target: rebind(nextScore, entry.target) as typeof entry.target, notation: nextFrameNotation }
        : { target: rebind(nextScore, entry.target) as typeof entry.target, notation: entry.notation });

  let nextNotation: Readonly<NotationDocumentV4>;
  try {
    nextNotation = createNotationDocumentV4(nextScore, {
      contractVersion: '4.0.0',
      documentId: nextScore.id,
      revisionId: nextScore.revision.id,
      frames: nextFrames,
      measures: notation.measures.map(entry => ({ target: rebind(nextScore, entry.target) as typeof entry.target, notation: entry.notation })),
      events: notation.events.map(entry => ({ target: rebind(nextScore, entry.target) as typeof entry.target, notation: entry.notation })),
      notes: notation.notes.map(entry => ({ target: rebind(nextScore, entry.target) as typeof entry.target, notation: entry.notation })),
      graceEvents: notation.graceEvents.map(entry => ({ target: rebind(nextScore, entry.target) as typeof entry.target, notation: entry.notation })),
      graceNotes: notation.graceNotes.map(entry => ({ target: rebind(nextScore, entry.target) as typeof entry.target, notation: entry.notation })),
      crossStaffPlacements: notation.crossStaffPlacements.map(entry => ({
        source: rebind(nextScore, entry.source) as typeof entry.source,
        displayStaffId: entry.displayStaffId
      }))
    });
  } catch (error) {
    if (error instanceof ProfessionalTimeSignatureV1Error) throw error;
    throw new ProfessionalTimeSignatureV1Error(
      'Time-signature notation candidate failed canonical validation.',
      'RESULT_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }

  const selection = rebind(nextScore, currentAdmission.target);
  if (selection.kind !== 'measure-frame') {
    throw new ProfessionalTimeSignatureV1Error('Time-signature result selection changed semantic kind.', 'RESULT_INVALID');
  }

  return Object.freeze({
    version: EDITOR_PROFESSIONAL_TIME_SIGNATURE_V1_VERSION,
    score: nextScore,
    notation: nextNotation,
    selection,
    admission: currentAdmission,
    historyMutationAuthority: false as const
  });
};
