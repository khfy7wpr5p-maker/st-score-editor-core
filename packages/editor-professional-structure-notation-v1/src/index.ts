import {
  addressEntityV3,
  resolveSemanticAddressV3,
  type MeasureAddressV3,
  type SemanticAddressV3
} from '../../addressing-v3/src/index.js';
import {
  createScoreDocumentV3,
  type ScoreDocumentV3
} from '../../score-model-v3/src/index.js';
import type { ClefSpec, KeySignature } from '../../notation-structure/src/index.js';
import {
  createNotationDocumentV4,
  type NotationDocumentV4
} from '../../notation-structure-v4/src/index.js';

export const EDITOR_PROFESSIONAL_STRUCTURE_NOTATION_V1_VERSION = '1.0.0' as const;

export type ProfessionalStructureNotationIntentV1 =
  | {
      readonly version: typeof EDITOR_PROFESSIONAL_STRUCTURE_NOTATION_V1_VERSION;
      readonly type: 'SET_KEY_SIGNATURE';
      readonly target: MeasureAddressV3;
      readonly value: KeySignature | null;
    }
  | {
      readonly version: typeof EDITOR_PROFESSIONAL_STRUCTURE_NOTATION_V1_VERSION;
      readonly type: 'SET_CLEF';
      readonly target: MeasureAddressV3;
      readonly value: ClefSpec | null;
    };

export interface ProfessionalStructureNotationV1Options {
  readonly nextRevisionId: string;
}

export interface ProfessionalStructureNotationV1Result {
  readonly version: typeof EDITOR_PROFESSIONAL_STRUCTURE_NOTATION_V1_VERSION;
  readonly score: Readonly<ScoreDocumentV3>;
  readonly notation: Readonly<NotationDocumentV4>;
  readonly selection: MeasureAddressV3;
  readonly changedMeasureId: string;
  readonly operation: ProfessionalStructureNotationIntentV1['type'];
  readonly canonicalScoreContentMutation: false;
  readonly historyMutationAuthority: false;
}

export type ProfessionalStructureNotationV1ErrorCode =
  | 'INVALID_INTENT'
  | 'STALE_TARGET'
  | 'TARGET_NOT_CONTENT_STAFF'
  | 'NO_CHANGE'
  | 'INVALID_REVISION_ID'
  | 'RESULT_INVALID';

export class ProfessionalStructureNotationV1Error extends Error {
  readonly code: ProfessionalStructureNotationV1ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: ProfessionalStructureNotationV1ErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ProfessionalStructureNotationV1Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

type R = Record<string, unknown>;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const CLEF_SIGNS = new Set(['G', 'F', 'C', 'percussion', 'TAB']);
const rec = (value: unknown): value is R => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value: unknown, keys: readonly string[]): value is R =>
  rec(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const sameJson = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

const parseKey = (value: unknown): KeySignature | null => {
  if (value === null) return null;
  if (!exact(value, ['fifths']) || typeof value.fifths !== 'number' || !Number.isSafeInteger(value.fifths) || value.fifths < -7 || value.fifths > 7) {
    throw new ProfessionalStructureNotationV1Error(
      'Key signature must contain an integer fifths value between -7 and +7.',
      'INVALID_INTENT'
    );
  }
  return Object.freeze({ fifths: value.fifths });
};

const parseClef = (value: unknown): ClefSpec | null => {
  if (value === null) return null;
  if (
    !exact(value, ['sign', 'line', 'octaveChange']) ||
    typeof value.sign !== 'string' ||
    !CLEF_SIGNS.has(value.sign) ||
    typeof value.line !== 'number' ||
    !Number.isSafeInteger(value.line) ||
    value.line < 1 ||
    value.line > 5 ||
    typeof value.octaveChange !== 'number' ||
    !Number.isSafeInteger(value.octaveChange) ||
    value.octaveChange < -2 ||
    value.octaveChange > 2
  ) {
    throw new ProfessionalStructureNotationV1Error(
      'Clef must use an admitted sign, line 1..5 and octaveChange -2..2.',
      'INVALID_INTENT'
    );
  }
  return Object.freeze({
    sign: value.sign as ClefSpec['sign'],
    line: value.line,
    octaveChange: value.octaveChange
  });
};

const parseIntent = (raw: unknown): ProfessionalStructureNotationIntentV1 => {
  if (!rec(raw) || raw.version !== EDITOR_PROFESSIONAL_STRUCTURE_NOTATION_V1_VERSION || typeof raw.type !== 'string') {
    throw new ProfessionalStructureNotationV1Error('Professional structure-notation intent envelope is invalid.', 'INVALID_INTENT');
  }
  if (raw.type === 'SET_KEY_SIGNATURE') {
    if (!exact(raw, ['version', 'type', 'target', 'value'])) {
      throw new ProfessionalStructureNotationV1Error('SET_KEY_SIGNATURE field set is invalid.', 'INVALID_INTENT');
    }
    return Object.freeze({
      version: EDITOR_PROFESSIONAL_STRUCTURE_NOTATION_V1_VERSION,
      type: 'SET_KEY_SIGNATURE' as const,
      target: raw.target as MeasureAddressV3,
      value: parseKey(raw.value)
    });
  }
  if (raw.type === 'SET_CLEF') {
    if (!exact(raw, ['version', 'type', 'target', 'value'])) {
      throw new ProfessionalStructureNotationV1Error('SET_CLEF field set is invalid.', 'INVALID_INTENT');
    }
    return Object.freeze({
      version: EDITOR_PROFESSIONAL_STRUCTURE_NOTATION_V1_VERSION,
      type: 'SET_CLEF' as const,
      target: raw.target as MeasureAddressV3,
      value: parseClef(raw.value)
    });
  }
  throw new ProfessionalStructureNotationV1Error(
    'Unsupported professional structure-notation intent.',
    'INVALID_INTENT',
    { type: raw.type }
  );
};

const currentMeasureTarget = (
  score: ScoreDocumentV3,
  target: MeasureAddressV3
): MeasureAddressV3 => {
  try {
    const resolved = resolveSemanticAddressV3(score, target);
    if (resolved.kind !== 'measure') throw new Error(`observed ${resolved.kind}`);
  } catch (error) {
    throw new ProfessionalStructureNotationV1Error(
      'Professional structure-notation target is stale or invalid.',
      'STALE_TARGET',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  const part = score.parts.find(candidate => candidate.id === target.partId);
  const staff = part?.staves.find(candidate => candidate.id === target.staffId);
  if (staff === undefined || staff.role === 'tablature-linked') {
    throw new ProfessionalStructureNotationV1Error(
      'Key/clef authoring requires a content-bearing staff measure.',
      'TARGET_NOT_CONTENT_STAFF',
      { partId: target.partId, staffId: target.staffId }
    );
  }
  return target;
};

const assertFreshRevision = (score: ScoreDocumentV3, nextRevisionId: string): void => {
  if (!ID.test(nextRevisionId) || nextRevisionId === score.revision.id || nextRevisionId === score.revision.parentId) {
    throw new ProfessionalStructureNotationV1Error(
      'Professional structure notation requires a fresh stable revision id.',
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
    throw new ProfessionalStructureNotationV1Error(
      'Professional structure notation would orphan an existing semantic notation address.',
      'RESULT_INVALID',
      { targetId: targetId(address), expectedKind: address.kind, observedKind: rebound.kind }
    );
  }
  return rebound;
};

export const executeProfessionalStructureNotationV1 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  rawIntent: unknown,
  options: ProfessionalStructureNotationV1Options
): Readonly<ProfessionalStructureNotationV1Result> => {
  const score = createScoreDocumentV3(scoreInput);
  const notation = createNotationDocumentV4(score, notationInput);
  const intent = parseIntent(rawIntent);
  const target = currentMeasureTarget(score, intent.target);
  assertFreshRevision(score, options.nextRevisionId);

  const existing = notation.measures.find(entry => entry.target.measureId === target.measureId)?.notation ?? {
    keySignature: null,
    clef: null
  };
  const nextMeasureNotation = intent.type === 'SET_KEY_SIGNATURE'
    ? { ...existing, keySignature: intent.value }
    : { ...existing, clef: intent.value };
  if (sameJson(existing, nextMeasureNotation)) {
    throw new ProfessionalStructureNotationV1Error(
      'Professional structure-notation intent would not change canonical notation.',
      'NO_CHANGE',
      { type: intent.type, measureId: target.measureId }
    );
  }

  const rawScore = structuredClone(score) as ScoreDocumentV3;
  (rawScore as { revision: ScoreDocumentV3['revision'] }).revision = {
    id: options.nextRevisionId,
    parentId: score.revision.id
  };
  let nextScore: Readonly<ScoreDocumentV3>;
  try {
    nextScore = createScoreDocumentV3(rawScore);
  } catch (error) {
    throw new ProfessionalStructureNotationV1Error(
      'Professional structure-notation revision candidate failed score validation.',
      'RESULT_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }

  const nextMeasures = notation.measures.some(entry => entry.target.measureId === target.measureId)
    ? notation.measures.map(entry => entry.target.measureId === target.measureId
        ? { target: rebind(nextScore, entry.target) as typeof entry.target, notation: nextMeasureNotation }
        : { target: rebind(nextScore, entry.target) as typeof entry.target, notation: entry.notation })
    : [
        ...notation.measures.map(entry => ({ target: rebind(nextScore, entry.target) as typeof entry.target, notation: entry.notation })),
        { target: rebind(nextScore, target) as MeasureAddressV3, notation: nextMeasureNotation }
      ];

  let nextNotation: Readonly<NotationDocumentV4>;
  try {
    nextNotation = createNotationDocumentV4(nextScore, {
      contractVersion: '4.0.0',
      documentId: nextScore.id,
      revisionId: nextScore.revision.id,
      frames: notation.frames.map(entry => ({ target: rebind(nextScore, entry.target) as typeof entry.target, notation: entry.notation })),
      measures: nextMeasures,
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
    if (error instanceof ProfessionalStructureNotationV1Error) throw error;
    throw new ProfessionalStructureNotationV1Error(
      'Professional structure-notation candidate failed notation validation.',
      'RESULT_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }

  const selection = rebind(nextScore, target);
  if (selection.kind !== 'measure') {
    throw new ProfessionalStructureNotationV1Error(
      'Professional structure-notation selection did not remain a measure.',
      'RESULT_INVALID'
    );
  }

  return Object.freeze({
    version: EDITOR_PROFESSIONAL_STRUCTURE_NOTATION_V1_VERSION,
    score: nextScore,
    notation: nextNotation,
    selection,
    changedMeasureId: target.measureId,
    operation: intent.type,
    canonicalScoreContentMutation: false as const,
    historyMutationAuthority: false as const
  });
};
