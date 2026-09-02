import { createScoreDocument } from '../../score-model/src/index.js';
import type { Measure, ScoreDocument, Staff, Voice } from '../../score-model/src/index.js';
import { resolveSemanticAddress } from '../../addressing/src/index.js';
import type { MeasureAddress, VoiceAddress } from '../../addressing/src/index.js';
import { createNotationDocument, notationForMeasure } from '../../notation-structure/src/index.js';
import type { NotationDocument } from '../../notation-structure/src/index.js';
import { rebindNotationAfterScoreEdit } from '../../editor-history/src/index.js';

export const STRUCTURAL_AUTHORING_VERSION = '1.0.0' as const;

export type StructuralAuthoringIntent =
  | {
      readonly version: typeof STRUCTURAL_AUTHORING_VERSION;
      readonly type: 'ADD_MEASURE_AFTER';
      readonly target: MeasureAddress;
      readonly measureId: string;
      readonly initialVoiceId: string;
      readonly displayNumber: string | null;
    }
  | {
      readonly version: typeof STRUCTURAL_AUTHORING_VERSION;
      readonly type: 'REMOVE_EMPTY_MEASURE';
      readonly target: MeasureAddress;
    }
  | {
      readonly version: typeof STRUCTURAL_AUTHORING_VERSION;
      readonly type: 'ADD_EMPTY_VOICE';
      readonly target: MeasureAddress;
      readonly voiceId: string;
    }
  | {
      readonly version: typeof STRUCTURAL_AUTHORING_VERSION;
      readonly type: 'REMOVE_EMPTY_VOICE';
      readonly target: VoiceAddress;
    };

export interface StructuralCommitIdentity {
  readonly version: typeof STRUCTURAL_AUTHORING_VERSION;
  readonly operationId: string;
  readonly nextRevisionId: string;
}

export interface StructuralAuthoringResult {
  readonly score: Readonly<ScoreDocument>;
  readonly notation: Readonly<NotationDocument>;
}

export type StructuralAuthoringErrorCode =
  | 'INVALID_INTENT'
  | 'INVALID_IDENTITY'
  | 'STALE_TARGET'
  | 'ID_CONFLICT'
  | 'REMOVE_NONEMPTY'
  | 'REMOVE_LAST_CHILD'
  | 'NOTATION_ORPHAN_RISK'
  | 'RESULT_INVALID';

export class StructuralAuthoringError extends Error {
  readonly code: StructuralAuthoringErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: StructuralAuthoringErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'StructuralAuthoringError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

type UnknownRecord = Record<string, unknown>;

const exactRecord = (value: unknown, fields: readonly string[], label: string, code: StructuralAuthoringErrorCode): UnknownRecord => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new StructuralAuthoringError(`${label} must be an object.`, code);
  const record = value as UnknownRecord;
  const observed = Object.keys(record).sort();
  const expected = [...fields].sort();
  if (JSON.stringify(observed) !== JSON.stringify(expected)) throw new StructuralAuthoringError(`${label} field set is invalid.`, code, { observed, expected });
  return record;
};

const validId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);

const allIds = (score: ScoreDocument): ReadonlySet<string> => {
  const ids = new Set<string>([score.id, score.revision.id]);
  if (score.revision.parentId !== null) ids.add(score.revision.parentId);
  for (const part of score.parts) {
    ids.add(part.id);
    for (const staff of part.staves) {
      ids.add(staff.id);
      for (const measure of staff.measures) {
        ids.add(measure.id);
        for (const voice of measure.voices) {
          ids.add(voice.id);
          for (const event of voice.events) {
            ids.add(event.id);
            if (event.kind === 'note') ids.add(event.note.id);
            if (event.kind === 'chord') for (const note of event.notes) ids.add(note.id);
          }
        }
      }
    }
  }
  return ids;
};

const freshId = (score: ScoreDocument, value: unknown, field: string): string => {
  if (!validId(value)) throw new StructuralAuthoringError(`${field} is invalid.`, 'INVALID_INTENT');
  if (allIds(score).has(value)) throw new StructuralAuthoringError(`${field} conflicts with an existing canonical identity.`, 'ID_CONFLICT', { field, value });
  return value;
};

const measureTarget = (score: ScoreDocument, raw: unknown): MeasureAddress => {
  try {
    const target = raw as MeasureAddress;
    const resolved = resolveSemanticAddress(score, target);
    if (resolved.kind !== 'measure') throw new Error(`observed ${resolved.kind}`);
    return target;
  } catch (error) {
    throw new StructuralAuthoringError('Measure target is stale or invalid.', 'STALE_TARGET', { cause: error instanceof Error ? error.message : String(error) });
  }
};

const voiceTarget = (score: ScoreDocument, raw: unknown): VoiceAddress => {
  try {
    const target = raw as VoiceAddress;
    const resolved = resolveSemanticAddress(score, target);
    if (resolved.kind !== 'voice') throw new Error(`observed ${resolved.kind}`);
    return target;
  } catch (error) {
    throw new StructuralAuthoringError('Voice target is stale or invalid.', 'STALE_TARGET', { cause: error instanceof Error ? error.message : String(error) });
  }
};

const parseIntent = (score: ScoreDocument, value: unknown): StructuralAuthoringIntent => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new StructuralAuthoringError('Structural intent must be an object.', 'INVALID_INTENT');
  const type = (value as UnknownRecord).type;
  if (type === 'ADD_MEASURE_AFTER') {
    const r = exactRecord(value, ['version','type','target','measureId','initialVoiceId','displayNumber'], 'ADD_MEASURE_AFTER', 'INVALID_INTENT');
    if (r.version !== STRUCTURAL_AUTHORING_VERSION || (r.displayNumber !== null && typeof r.displayNumber !== 'string')) throw new StructuralAuthoringError('ADD_MEASURE_AFTER payload is invalid.', 'INVALID_INTENT');
    const measureId = freshId(score, r.measureId, 'measureId');
    const initialVoiceId = freshId(score, r.initialVoiceId, 'initialVoiceId');
    if (measureId === initialVoiceId) throw new StructuralAuthoringError('New measure and voice identities must be distinct.', 'ID_CONFLICT');
    return Object.freeze({ version: STRUCTURAL_AUTHORING_VERSION, type, target: measureTarget(score, r.target), measureId, initialVoiceId, displayNumber: r.displayNumber as string | null });
  }
  if (type === 'REMOVE_EMPTY_MEASURE') {
    const r = exactRecord(value, ['version','type','target'], 'REMOVE_EMPTY_MEASURE', 'INVALID_INTENT');
    if (r.version !== STRUCTURAL_AUTHORING_VERSION) throw new StructuralAuthoringError('REMOVE_EMPTY_MEASURE version is unsupported.', 'INVALID_INTENT');
    return Object.freeze({ version: STRUCTURAL_AUTHORING_VERSION, type, target: measureTarget(score, r.target) });
  }
  if (type === 'ADD_EMPTY_VOICE') {
    const r = exactRecord(value, ['version','type','target','voiceId'], 'ADD_EMPTY_VOICE', 'INVALID_INTENT');
    if (r.version !== STRUCTURAL_AUTHORING_VERSION) throw new StructuralAuthoringError('ADD_EMPTY_VOICE version is unsupported.', 'INVALID_INTENT');
    return Object.freeze({ version: STRUCTURAL_AUTHORING_VERSION, type, target: measureTarget(score, r.target), voiceId: freshId(score, r.voiceId, 'voiceId') });
  }
  if (type === 'REMOVE_EMPTY_VOICE') {
    const r = exactRecord(value, ['version','type','target'], 'REMOVE_EMPTY_VOICE', 'INVALID_INTENT');
    if (r.version !== STRUCTURAL_AUTHORING_VERSION) throw new StructuralAuthoringError('REMOVE_EMPTY_VOICE version is unsupported.', 'INVALID_INTENT');
    return Object.freeze({ version: STRUCTURAL_AUTHORING_VERSION, type, target: voiceTarget(score, r.target) });
  }
  throw new StructuralAuthoringError('Structural intent type is unsupported.', 'INVALID_INTENT', { type });
};

const parseIdentity = (score: ScoreDocument, value: unknown): StructuralCommitIdentity => {
  const r = exactRecord(value, ['version','operationId','nextRevisionId'], 'StructuralCommitIdentity', 'INVALID_IDENTITY');
  if (r.version !== STRUCTURAL_AUTHORING_VERSION || !validId(r.operationId) || !validId(r.nextRevisionId)) throw new StructuralAuthoringError('Structural commit identity is invalid.', 'INVALID_IDENTITY');
  if (r.nextRevisionId === score.revision.id || r.nextRevisionId === score.revision.parentId) throw new StructuralAuthoringError('Next revision id conflicts with current lineage.', 'INVALID_IDENTITY');
  return Object.freeze({ version: STRUCTURAL_AUTHORING_VERSION, operationId: r.operationId, nextRevisionId: r.nextRevisionId });
};

const renumberMeasures = (measures: readonly Measure[]): readonly Measure[] => Object.freeze(measures.map((measure, index) => Object.freeze({ ...measure, ordinal: index + 1 })));
const renumberVoices = (voices: readonly Voice[]): readonly Voice[] => Object.freeze(voices.map((voice, index) => Object.freeze({ ...voice, ordinal: index + 1 })));

const transformStaff = (score: ScoreDocument, target: MeasureAddress, transform: (staff: Staff) => Staff): ScoreDocument => ({
  ...score,
  parts: score.parts.map((part) => part.id !== target.partId ? part : ({ ...part, staves: part.staves.map((staff) => staff.id === target.staffId ? transform(staff) : staff) }))
});

const applyIntent = (score: ScoreDocument, notation: NotationDocument, intent: StructuralAuthoringIntent): ScoreDocument => {
  if (intent.type === 'ADD_MEASURE_AFTER') {
    return transformStaff(score, intent.target, (staff) => {
      const index = staff.measures.findIndex((measure) => measure.id === intent.target.measureId);
      if (index < 0) throw new StructuralAuthoringError('Target measure disappeared.', 'STALE_TARGET');
      const newMeasure: Measure = Object.freeze({
        id: intent.measureId,
        ordinal: index + 2,
        displayNumber: intent.displayNumber,
        voices: Object.freeze([{ id: intent.initialVoiceId, ordinal: 1, events: Object.freeze([]) }])
      });
      return Object.freeze({ ...staff, measures: renumberMeasures([...staff.measures.slice(0, index + 1), newMeasure, ...staff.measures.slice(index + 1)]) });
    });
  }

  if (intent.type === 'REMOVE_EMPTY_MEASURE') {
    return transformStaff(score, intent.target, (staff) => {
      const index = staff.measures.findIndex((measure) => measure.id === intent.target.measureId);
      const measure = staff.measures[index];
      if (measure === undefined) throw new StructuralAuthoringError('Target measure disappeared.', 'STALE_TARGET');
      if (staff.measures.length <= 1) throw new StructuralAuthoringError('A staff must retain at least one measure.', 'REMOVE_LAST_CHILD');
      if (measure.voices.some((voice) => voice.events.length > 0)) throw new StructuralAuthoringError('Only a fully empty measure may be removed by SEC-NE-06 v1.', 'REMOVE_NONEMPTY');
      if (notationForMeasure(notation, measure.id) !== null) throw new StructuralAuthoringError('Measure notation would be orphaned by removal.', 'NOTATION_ORPHAN_RISK', { measureId: measure.id });
      return Object.freeze({ ...staff, measures: renumberMeasures(staff.measures.filter((item) => item.id !== measure.id)) });
    });
  }

  if (intent.type === 'ADD_EMPTY_VOICE') {
    return transformStaff(score, intent.target, (staff) => Object.freeze({
      ...staff,
      measures: staff.measures.map((measure) => measure.id !== intent.target.measureId ? measure : Object.freeze({
        ...measure,
        voices: Object.freeze([...measure.voices, Object.freeze({ id: intent.voiceId, ordinal: measure.voices.length + 1, events: Object.freeze([]) })])
      }))
    }));
  }

  const measureTargetAddress: MeasureAddress = Object.freeze({
    contractVersion: intent.target.contractVersion,
    kind: 'measure',
    documentId: intent.target.documentId,
    revisionId: intent.target.revisionId,
    partId: intent.target.partId,
    staffId: intent.target.staffId,
    measureId: intent.target.measureId
  });
  return transformStaff(score, measureTargetAddress, (staff) => Object.freeze({
    ...staff,
    measures: staff.measures.map((measure) => {
      if (measure.id !== intent.target.measureId) return measure;
      const voice = measure.voices.find((item) => item.id === intent.target.voiceId);
      if (voice === undefined) throw new StructuralAuthoringError('Target voice disappeared.', 'STALE_TARGET');
      if (measure.voices.length <= 1) throw new StructuralAuthoringError('A measure must retain at least one voice.', 'REMOVE_LAST_CHILD');
      if (voice.events.length > 0) throw new StructuralAuthoringError('Only an empty voice may be removed by SEC-NE-06 v1.', 'REMOVE_NONEMPTY');
      return Object.freeze({ ...measure, voices: renumberVoices(measure.voices.filter((item) => item.id !== voice.id)) });
    })
  }));
};

export const executeStructuralAuthoring = (
  score: ScoreDocument,
  notationInput: NotationDocument,
  rawIntent: unknown,
  rawIdentity: unknown
): Readonly<StructuralAuthoringResult> => {
  let notation: Readonly<NotationDocument>;
  try { notation = createNotationDocument(score, notationInput); }
  catch (error) { throw new StructuralAuthoringError('Structural authoring requires current valid notation.', 'STALE_TARGET', { cause: error instanceof Error ? error.message : String(error) }); }
  const intent = parseIntent(score, rawIntent);
  const identity = parseIdentity(score, rawIdentity);
  const draft = applyIntent(score, notation, intent);
  let nextScore: Readonly<ScoreDocument>;
  try { nextScore = createScoreDocument({ ...draft, revision: { id: identity.nextRevisionId, parentId: score.revision.id } }); }
  catch (error) { throw new StructuralAuthoringError('Structural authoring candidate failed canonical validation.', 'RESULT_INVALID', { cause: error instanceof Error ? error.message : String(error) }); }
  let nextNotation: Readonly<NotationDocument>;
  try { nextNotation = rebindNotationAfterScoreEdit(score, notation, nextScore); }
  catch (error) { throw new StructuralAuthoringError('Structural edit would orphan or invalidate notation.', 'NOTATION_ORPHAN_RISK', { cause: error instanceof Error ? error.message : String(error) }); }
  return Object.freeze({ score: nextScore, notation: nextNotation });
};
