import type { Rational } from '../../score-model/src/index.js';
import { createScoreDocumentV3, type ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import {
  addressEntityV3,
  createSemanticAddressIndexV3,
  resolveSemanticAddressV3,
  type DocumentAddressV3,
  type EventAddressV3,
  type SemanticAddressV3
} from '../../addressing-v3/src/index.js';
import { createNotationDocumentV3 } from '../../notation-structure-v3/src/index.js';
import { createNotationDocumentV4, type NotationDocumentV4 } from '../../notation-structure-v4/src/index.js';
import { executeTopologyAuthoringV3, type TopologyAuthoringV3Options } from '../../editor-topology-authoring-v3/src/index.js';

export const TOPOLOGY_AUTHORING_V4_VERSION = '1.0.0' as const;
export const APPEND_SYNTHETIC_MEASURE_FRAME_V4 = 'APPEND_SYNTHETIC_MEASURE_FRAME' as const;

export interface SyntheticMeasureFrameStaffPlanV4 {
  readonly staffId: string;
  readonly measureId: string;
  readonly voiceId: string;
  readonly restEventId: string;
}

export interface AppendSyntheticMeasureFrameIntentV4 {
  readonly version: typeof TOPOLOGY_AUTHORING_V4_VERSION;
  readonly type: typeof APPEND_SYNTHETIC_MEASURE_FRAME_V4;
  readonly target: DocumentAddressV3;
  readonly frameId: string;
  readonly displayNumber: string | null;
  readonly staffRestIds: readonly SyntheticMeasureFrameStaffPlanV4[];
}

export type TopologyAuthoringV4ErrorCode =
  | 'INVALID_INTENT'
  | 'STALE_TARGET'
  | 'ORIGIN_NOT_ADMITTED'
  | 'IDENTITY_PLAN_INVALID'
  | 'METER_EVIDENCE_MISSING'
  | 'CROSS_STAFF_ORPHAN_RISK'
  | 'RESULT_INVALID';

export class TopologyAuthoringV4Error extends Error {
  readonly code: TopologyAuthoringV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: TopologyAuthoringV4ErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'TopologyAuthoringV4Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

export interface TopologyAuthoringV4Result {
  readonly score: Readonly<ScoreDocumentV3>;
  readonly notation: Readonly<NotationDocumentV4>;
  readonly selectionEntityId: string;
}

type R = Record<string, unknown>;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const rec = (value: unknown): value is R => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value: unknown, keys: readonly string[]): value is R =>
  rec(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());

const baseNotation = (score: ScoreDocumentV3, notation: NotationDocumentV4) => createNotationDocumentV3(score, {
  contractVersion: '3.0.0',
  documentId: notation.documentId,
  revisionId: notation.revisionId,
  frames: notation.frames,
  measures: notation.measures,
  events: notation.events,
  notes: notation.notes,
  graceEvents: notation.graceEvents,
  graceNotes: notation.graceNotes
});

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
  if (next.kind !== address.kind) {
    throw new TopologyAuthoringV4Error('Topology edit would orphan notation identity.', 'RESULT_INVALID', { id: entityId(address) });
  }
  return next;
};

const rebindNotation = (score: ScoreDocumentV3, notation: NotationDocumentV4): Readonly<NotationDocumentV4> =>
  createNotationDocumentV4(score, {
    contractVersion: '4.0.0',
    documentId: score.id,
    revisionId: score.revision.id,
    frames: notation.frames.map(entry => ({ target: rebind(score, entry.target) as typeof entry.target, notation: entry.notation })),
    measures: notation.measures.map(entry => ({ target: rebind(score, entry.target) as typeof entry.target, notation: entry.notation })),
    events: notation.events.map(entry => ({ target: rebind(score, entry.target) as typeof entry.target, notation: entry.notation })),
    notes: notation.notes.map(entry => ({ target: rebind(score, entry.target) as typeof entry.target, notation: entry.notation })),
    graceEvents: notation.graceEvents.map(entry => ({ target: rebind(score, entry.target) as typeof entry.target, notation: entry.notation })),
    graceNotes: notation.graceNotes.map(entry => ({ target: rebind(score, entry.target) as typeof entry.target, notation: entry.notation })),
    crossStaffPlacements: notation.crossStaffPlacements.map(item => ({
      source: rebind(score, item.source) as EventAddressV3,
      displayStaffId: item.displayStaffId
    }))
  });

const parseId = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !ID.test(value)) {
    throw new TopologyAuthoringV4Error(`${label} is invalid.`, 'INVALID_INTENT');
  }
  return value;
};

const gcd = (left: number, right: number): number => {
  let a = Math.abs(left), b = Math.abs(right);
  while (b !== 0) [a, b] = [b, a % b];
  return a;
};

const durationFromMeter = (beats: number, beatType: number): Rational => {
  const divisor = gcd(beats, beatType);
  return Object.freeze({ numerator: beats / divisor, denominator: beatType / divisor });
};

const effectiveMeterAtEnd = (score: ScoreDocumentV3, notation: NotationDocumentV4): Rational => {
  const declarations = new Map(notation.frames.map(entry => [entry.target.frameId, entry.notation.timeSignature]));
  let active: { beats: number; beatType: number } | null = null;
  for (const frame of score.measureFrames) {
    const declaration = declarations.get(frame.id);
    if (declaration !== undefined && declaration !== null) active = declaration;
    if (active === null) {
      throw new TopologyAuthoringV4Error(
        'Synthetic measure-frame append requires proven effective meter.',
        'METER_EVIDENCE_MISSING',
        { frameId: frame.id }
      );
    }
  }
  if (active === null) {
    throw new TopologyAuthoringV4Error('Synthetic measure-frame append requires proven effective meter.', 'METER_EVIDENCE_MISSING');
  }
  return durationFromMeter(active.beats, active.beatType);
};

const expectedLosslessFrameId = (score: ScoreDocumentV3): string => {
  for (const [index, frame] of score.measureFrames.entries()) {
    const expected = `frame:${index + 1}`;
    if (frame.id !== expected) {
      throw new TopologyAuthoringV4Error(
        'Synthetic measure-frame append requires the current lossless deterministic frame identity sequence.',
        'IDENTITY_PLAN_INVALID',
        { frameId: frame.id, expectedFrameId: expected }
      );
    }
  }
  return `frame:${score.measureFrames.length + 1}`;
};

const parseAppendIntent = (
  score: ScoreDocumentV3,
  raw: unknown
): Readonly<AppendSyntheticMeasureFrameIntentV4> => {
  if (!exact(raw, ['version','type','target','frameId','displayNumber','staffRestIds']) ||
      raw.version !== TOPOLOGY_AUTHORING_V4_VERSION || raw.type !== APPEND_SYNTHETIC_MEASURE_FRAME_V4 ||
      !(raw.displayNumber === null || typeof raw.displayNumber === 'string') || !Array.isArray(raw.staffRestIds)) {
    throw new TopologyAuthoringV4Error('Synthetic measure-frame append intent is invalid.', 'INVALID_INTENT');
  }

  let target: DocumentAddressV3;
  try {
    target = raw.target as DocumentAddressV3;
    const resolved = resolveSemanticAddressV3(score, target);
    if (resolved.kind !== 'document') throw new Error(`observed ${resolved.kind}`);
  } catch (error) {
    throw new TopologyAuthoringV4Error('Synthetic measure-frame target is stale or invalid.', 'STALE_TARGET', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  const contentStaffs = score.parts.flatMap(part => part.staves.filter(staff => staff.role !== 'tablature-linked'));
  if (raw.staffRestIds.length !== contentStaffs.length) {
    throw new TopologyAuthoringV4Error('Synthetic measure-frame identity plan must exactly cover every content staff.', 'IDENTITY_PLAN_INVALID', {
      expected: contentStaffs.length,
      observed: raw.staffRestIds.length
    });
  }

  const staffRestIds = raw.staffRestIds.map((item, index): SyntheticMeasureFrameStaffPlanV4 => {
    if (!exact(item, ['staffId','measureId','voiceId','restEventId'])) {
      throw new TopologyAuthoringV4Error('Synthetic measure-frame staff identity plan is invalid.', 'IDENTITY_PLAN_INVALID', { index });
    }
    const expectedStaff = contentStaffs[index];
    if (expectedStaff === undefined || item.staffId !== expectedStaff.id) {
      throw new TopologyAuthoringV4Error('Synthetic measure-frame staff identity plan order must match canonical content-staff order.', 'IDENTITY_PLAN_INVALID', {
        index,
        expectedStaffId: expectedStaff?.id,
        observedStaffId: item.staffId
      });
    }
    return Object.freeze({
      staffId: parseId(item.staffId, 'staffId'),
      measureId: parseId(item.measureId, 'measureId'),
      voiceId: parseId(item.voiceId, 'voiceId'),
      restEventId: parseId(item.restEventId, 'restEventId')
    });
  });

  const frameId = parseId(raw.frameId, 'frameId');
  const expectedFrameId = expectedLosslessFrameId(score);
  if (frameId !== expectedFrameId) {
    throw new TopologyAuthoringV4Error(
      'Synthetic measure-frame identity must preserve the admitted lossless MusicXML frame sequence.',
      'IDENTITY_PLAN_INVALID',
      { frameId, expectedFrameId }
    );
  }
  const newIds = [frameId, ...staffRestIds.flatMap(item => [item.measureId, item.voiceId, item.restEventId])];
  const currentIds = createSemanticAddressIndexV3(score).byEntityId;
  if (new Set(newIds).size !== newIds.length || newIds.some(value => currentIds.has(value))) {
    throw new TopologyAuthoringV4Error('Synthetic measure-frame identities must be fresh and globally distinct.', 'IDENTITY_PLAN_INVALID', { ids: newIds });
  }

  return Object.freeze({
    version: TOPOLOGY_AUTHORING_V4_VERSION,
    type: APPEND_SYNTHETIC_MEASURE_FRAME_V4,
    target,
    frameId,
    displayNumber: raw.displayNumber as string | null,
    staffRestIds: Object.freeze(staffRestIds)
  });
};

const appendSyntheticMeasureFrame = (
  score: ScoreDocumentV3,
  notation: NotationDocumentV4,
  intentInput: unknown,
  options: TopologyAuthoringV3Options
): Readonly<TopologyAuthoringV4Result> => {
  if (score.source.format !== 'synthetic') {
    throw new TopologyAuthoringV4Error('Automatic measure-frame growth is admitted only for synthetic scores.', 'ORIGIN_NOT_ADMITTED', {
      sourceFormat: score.source.format
    });
  }
  const intent = parseAppendIntent(score, intentInput);
  const duration = effectiveMeterAtEnd(score, notation);
  const nextRevisionId = parseId(options.nextRevisionId, 'nextRevisionId');
  if (nextRevisionId === score.revision.id || nextRevisionId === score.revision.parentId || createSemanticAddressIndexV3(score).byEntityId.has(nextRevisionId)) {
    throw new TopologyAuthoringV4Error('Next revision identity conflicts with current lineage or canonical identity.', 'INVALID_INTENT');
  }

  const planByStaff = new Map(intent.staffRestIds.map(plan => [plan.staffId, plan]));
  const candidate = structuredClone(score) as ScoreDocumentV3;
  (candidate as { measureFrames: ScoreDocumentV3['measureFrames'] }).measureFrames = [
    ...candidate.measureFrames,
    { id: intent.frameId, ordinal: candidate.measureFrames.length + 1, displayNumber: intent.displayNumber }
  ];
  for (const part of candidate.parts) {
    for (const staff of part.staves) {
      if (staff.role === 'tablature-linked') continue;
      const plan = planByStaff.get(staff.id);
      if (plan === undefined) {
        throw new TopologyAuthoringV4Error('Synthetic measure-frame identity plan lost a content staff.', 'IDENTITY_PLAN_INVALID', { staffId: staff.id });
      }
      (staff as { measures: typeof staff.measures }).measures = [
        ...staff.measures,
        {
          id: plan.measureId,
          frameId: intent.frameId,
          voices: [{
            id: plan.voiceId,
            ordinal: 1,
            events: [{
              id: plan.restEventId,
              kind: 'rest',
              onset: { numerator: 0, denominator: 1 },
              duration
            }],
            graceGroups: []
          }]
        }
      ];
    }
  }
  (candidate as { revision: ScoreDocumentV3['revision'] }).revision = { id: nextRevisionId, parentId: score.revision.id };

  let nextScore: Readonly<ScoreDocumentV3>;
  try {
    nextScore = createScoreDocumentV3(candidate);
  } catch (error) {
    throw new TopologyAuthoringV4Error('Synthetic measure-frame candidate failed canonical validation.', 'RESULT_INVALID', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  let nextNotation: Readonly<NotationDocumentV4>;
  try {
    nextNotation = rebindNotation(nextScore, notation);
  } catch (error) {
    if (error instanceof TopologyAuthoringV4Error) throw error;
    throw new TopologyAuthoringV4Error('Synthetic measure-frame notation rebinding failed.', 'RESULT_INVALID', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
  return Object.freeze({ score: nextScore, notation: nextNotation, selectionEntityId: intent.frameId });
};

export const executeTopologyAuthoringV4 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  intent: unknown,
  options: TopologyAuthoringV3Options
): Readonly<TopologyAuthoringV4Result> => {
  const score = createScoreDocumentV3(scoreInput);
  const notation = createNotationDocumentV4(score, notationInput);

  if (rec(intent) && intent.type === APPEND_SYNTHETIC_MEASURE_FRAME_V4) {
    return appendSyntheticMeasureFrame(score, notation, intent, options);
  }

  const result = executeTopologyAuthoringV3(score, baseNotation(score, notation), intent, options);
  try {
    const placements = notation.crossStaffPlacements.map(item => {
      const source = addressEntityV3(result.score, item.source.eventId);
      if (source.kind !== 'event') throw new Error(`source event changed kind: ${item.source.eventId}`);
      return { source, displayStaffId: item.displayStaffId };
    });
    const nextNotation = createNotationDocumentV4(result.score, {
      contractVersion: '4.0.0',
      documentId: result.score.id,
      revisionId: result.score.revision.id,
      frames: result.notation.frames,
      measures: result.notation.measures,
      events: result.notation.events,
      notes: result.notation.notes,
      graceEvents: result.notation.graceEvents,
      graceNotes: result.notation.graceNotes,
      crossStaffPlacements: placements
    });
    return Object.freeze({ score: result.score, notation: nextNotation, selectionEntityId: result.selectionEntityId });
  } catch (error) {
    throw new TopologyAuthoringV4Error(
      'Topology edit would orphan or invalidate a current cross-staff placement.',
      'CROSS_STAFF_ORPHAN_RISK',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
};
