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
import type { BarlineSpec } from '../../notation-structure/src/index.js';
import {
  createNotationDocumentV4,
  type NotationDocumentV4
} from '../../notation-structure-v4/src/index.js';

export const EDITOR_PROFESSIONAL_FRAME_BARLINES_V1_VERSION = '1.0.0' as const;

export interface ProfessionalFrameBarlinesV1Options {
  readonly nextRevisionId: string;
}

export interface ProfessionalFrameBarlinesV1Result {
  readonly version: typeof EDITOR_PROFESSIONAL_FRAME_BARLINES_V1_VERSION;
  readonly score: Readonly<ScoreDocumentV3>;
  readonly notation: Readonly<NotationDocumentV4>;
  readonly selection: MeasureFrameAddressV3;
  readonly barlines: readonly BarlineSpec[];
  readonly canonicalScoreContentMutation: false;
  readonly historyMutationAuthority: false;
}

export type ProfessionalFrameBarlinesV1ErrorCode =
  | 'INVALID_BARLINES'
  | 'STALE_TARGET'
  | 'NO_CHANGE'
  | 'INVALID_REVISION_ID'
  | 'RESULT_INVALID';

export class ProfessionalFrameBarlinesV1Error extends Error {
  readonly code: ProfessionalFrameBarlinesV1ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: ProfessionalFrameBarlinesV1ErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ProfessionalFrameBarlinesV1Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

type R = Record<string, unknown>;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const BARLINE_STYLES = new Set([
  'regular',
  'light-light',
  'light-heavy',
  'heavy-light',
  'heavy-heavy',
  'dashed',
  'dotted',
  'none'
]);
const rec = (value: unknown): value is R => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value: unknown, keys: readonly string[]): value is R =>
  rec(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const sameJson = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

const parseBarlines = (value: unknown): readonly BarlineSpec[] => {
  if (!Array.isArray(value) || value.length > 2) {
    throw new ProfessionalFrameBarlinesV1Error(
      'Frame barlines must be an array containing at most one left and one right barline.',
      'INVALID_BARLINES'
    );
  }
  const seen = new Set<string>();
  const parsed = value.map((raw, index): BarlineSpec => {
    if (!exact(raw, ['location', 'style', 'repeat'])) {
      throw new ProfessionalFrameBarlinesV1Error(
        'Barline field set is invalid.',
        'INVALID_BARLINES',
        { index }
      );
    }
    if (raw.location !== 'left' && raw.location !== 'right') {
      throw new ProfessionalFrameBarlinesV1Error(
        'Barline location must be left or right.',
        'INVALID_BARLINES',
        { index, location: raw.location }
      );
    }
    if (seen.has(raw.location)) {
      throw new ProfessionalFrameBarlinesV1Error(
        'Frame barlines cannot contain duplicate locations.',
        'INVALID_BARLINES',
        { location: raw.location }
      );
    }
    seen.add(raw.location);
    if (typeof raw.style !== 'string' || !BARLINE_STYLES.has(raw.style)) {
      throw new ProfessionalFrameBarlinesV1Error(
        'Barline style is unsupported.',
        'INVALID_BARLINES',
        { index, style: raw.style }
      );
    }
    if (raw.repeat !== null && raw.repeat !== 'forward' && raw.repeat !== 'backward') {
      throw new ProfessionalFrameBarlinesV1Error(
        'Barline repeat must be forward, backward or null.',
        'INVALID_BARLINES',
        { index, repeat: raw.repeat }
      );
    }
    return Object.freeze({
      location: raw.location,
      style: raw.style as BarlineSpec['style'],
      repeat: raw.repeat as BarlineSpec['repeat']
    });
  });
  parsed.sort((left, right) => left.location === right.location ? 0 : left.location === 'left' ? -1 : 1);
  return Object.freeze(parsed);
};

const currentFrame = (score: ScoreDocumentV3, target: MeasureFrameAddressV3): MeasureFrameAddressV3 => {
  try {
    const resolved = resolveSemanticAddressV3(score, target);
    if (resolved.kind !== 'measure-frame') throw new Error(`observed ${resolved.kind}`);
    return target;
  } catch (error) {
    throw new ProfessionalFrameBarlinesV1Error(
      'Frame barline target is stale or invalid.',
      'STALE_TARGET',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

const assertFreshRevision = (score: ScoreDocumentV3, nextRevisionId: string): void => {
  if (!ID.test(nextRevisionId) || nextRevisionId === score.revision.id || nextRevisionId === score.revision.parentId) {
    throw new ProfessionalFrameBarlinesV1Error(
      'Frame barline authoring requires a fresh stable revision id.',
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
    throw new ProfessionalFrameBarlinesV1Error(
      'Frame barline authoring would orphan an existing notation address.',
      'RESULT_INVALID',
      { targetId: targetId(address), expectedKind: address.kind, observedKind: rebound.kind }
    );
  }
  return rebound;
};

export const executeProfessionalFrameBarlinesV1 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  targetInput: MeasureFrameAddressV3,
  barlinesInput: unknown,
  options: ProfessionalFrameBarlinesV1Options
): Readonly<ProfessionalFrameBarlinesV1Result> => {
  const score = createScoreDocumentV3(scoreInput);
  const notation = createNotationDocumentV4(score, notationInput);
  const target = currentFrame(score, targetInput);
  const barlines = parseBarlines(barlinesInput);
  const existing = notation.frames.find(entry => entry.target.frameId === target.frameId)?.notation ?? {
    timeSignature: null,
    barlines: []
  };
  if (sameJson(existing.barlines, barlines)) {
    throw new ProfessionalFrameBarlinesV1Error(
      'Requested frame barlines are already the current explicit value.',
      'NO_CHANGE',
      { frameId: target.frameId }
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
    throw new ProfessionalFrameBarlinesV1Error(
      'Frame barline score revision candidate failed canonical validation.',
      'RESULT_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }

  const nextFrameNotation = Object.freeze({
    timeSignature: existing.timeSignature,
    barlines
  });
  const nextFrames = notation.frames.some(entry => entry.target.frameId === target.frameId)
    ? notation.frames.map(entry => entry.target.frameId === target.frameId
        ? { target: rebind(nextScore, entry.target) as typeof entry.target, notation: nextFrameNotation }
        : { target: rebind(nextScore, entry.target) as typeof entry.target, notation: entry.notation })
    : [
        ...notation.frames.map(entry => ({ target: rebind(nextScore, entry.target) as typeof entry.target, notation: entry.notation })),
        { target: rebind(nextScore, target) as MeasureFrameAddressV3, notation: nextFrameNotation }
      ];

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
    if (error instanceof ProfessionalFrameBarlinesV1Error) throw error;
    throw new ProfessionalFrameBarlinesV1Error(
      'Frame barline notation candidate failed canonical validation.',
      'RESULT_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }

  const selection = rebind(nextScore, target);
  if (selection.kind !== 'measure-frame') {
    throw new ProfessionalFrameBarlinesV1Error('Frame barline result selection changed semantic kind.', 'RESULT_INVALID');
  }

  return Object.freeze({
    version: EDITOR_PROFESSIONAL_FRAME_BARLINES_V1_VERSION,
    score: nextScore,
    notation: nextNotation,
    selection,
    barlines,
    canonicalScoreContentMutation: false as const,
    historyMutationAuthority: false as const
  });
};
