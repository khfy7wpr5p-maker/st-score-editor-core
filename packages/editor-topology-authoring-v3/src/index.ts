import {
  createScoreDocumentV3,
  type ContentStaffV3,
  type PartV3,
  type ScoreDocumentV3,
  type TabProfileV3
} from '../../score-model-v3/src/index.js';
import {
  addressEntityV3,
  resolveSemanticAddressV3,
  type DocumentAddressV3,
  type EventAddressV3,
  type GraceEventAddressV3,
  type GraceNoteAddressV3,
  type MeasureAddressV3,
  type MeasureFrameAddressV3,
  type NoteAddressV3,
  type PartAddressV3,
  type ResolvedSemanticTargetV3,
  type SemanticAddressV3,
  type StaffAddressV3
} from '../../addressing-v3/src/index.js';
import {
  createNotationDocumentV3,
  type EventNotationEntryV3,
  type FrameNotationEntryV3,
  type GraceEventNotationEntryV3,
  type GraceNoteNotationEntryV3,
  type NotationDocumentV3,
  type NoteNotationEntryV3,
  type StaffMeasureNotationEntryV3
} from '../../notation-structure-v3/src/index.js';
import type { Rational, RevisionIdentity } from '../../score-model/src/index.js';

export const TOPOLOGY_AUTHORING_V3_VERSION = '1.0.0' as const;

export interface FrameRestIdentityPlanV3 {
  readonly frameId: string;
  readonly measureId: string;
  readonly voiceId: string;
  readonly restEventId: string;
}

interface IntentBase {
  readonly version: typeof TOPOLOGY_AUTHORING_V3_VERSION;
  readonly type: string;
}

export interface AddPartIntentV3 extends IntentBase {
  readonly type: 'ADD_STANDARD_OR_PERCUSSION_PART';
  readonly target: DocumentAddressV3;
  readonly index: number;
  readonly partId: string;
  readonly partName: string | null;
  readonly instrumentId: string;
  readonly instrumentName: string | null;
  readonly instrumentShortName: string | null;
  readonly staffId: string;
  readonly staffRole: 'standard' | 'percussion';
  readonly frameRestIds: readonly FrameRestIdentityPlanV3[];
}

export interface RemovePartIntentV3 extends IntentBase {
  readonly type: 'REMOVE_PART';
  readonly target: PartAddressV3;
}
export interface ReorderPartIntentV3 extends IntentBase {
  readonly type: 'REORDER_PART';
  readonly target: PartAddressV3;
  readonly toIndex: number;
}
export interface AddStaffIntentV3 extends IntentBase {
  readonly type: 'ADD_STANDARD_OR_PERCUSSION_STAFF';
  readonly target: PartAddressV3;
  readonly index: number;
  readonly staffId: string;
  readonly staffRole: 'standard' | 'percussion';
  readonly frameRestIds: readonly FrameRestIdentityPlanV3[];
}
export interface RemoveContentStaffIntentV3 extends IntentBase {
  readonly type: 'REMOVE_CONTENT_STAFF';
  readonly target: StaffAddressV3;
}
export interface ReorderStaffIntentV3 extends IntentBase {
  readonly type: 'REORDER_STAFF';
  readonly target: StaffAddressV3;
  readonly toIndex: number;
}
export interface AddLinkedTabStaffIntentV3 extends IntentBase {
  readonly type: 'ADD_LINKED_TAB_STAFF';
  readonly target: StaffAddressV3;
  readonly index: number;
  readonly staffId: string;
  readonly tabProfile: TabProfileV3;
}
export interface RemoveLinkedTabStaffIntentV3 extends IntentBase {
  readonly type: 'REMOVE_LINKED_TAB_STAFF';
  readonly target: StaffAddressV3;
}
export interface RenamePartIntentV3 extends IntentBase {
  readonly type: 'RENAME_PART_OR_INSTRUMENT';
  readonly target: PartAddressV3;
  readonly partName: string | null;
  readonly instrumentName: string | null;
  readonly instrumentShortName: string | null;
}

export type TopologyAuthoringIntentV3 =
  | AddPartIntentV3
  | RemovePartIntentV3
  | ReorderPartIntentV3
  | AddStaffIntentV3
  | RemoveContentStaffIntentV3
  | ReorderStaffIntentV3
  | AddLinkedTabStaffIntentV3
  | RemoveLinkedTabStaffIntentV3
  | RenamePartIntentV3;

export interface TopologyAuthoringV3Options { readonly nextRevisionId: string }
export interface TopologyAuthoringV3Result {
  readonly score: Readonly<ScoreDocumentV3>;
  readonly notation: Readonly<NotationDocumentV3>;
  readonly selectionEntityId: string;
}

export type TopologyAuthoringV3ErrorCode =
  | 'INVALID_INTENT'
  | 'STALE_TARGET'
  | 'TARGET_KIND_MISMATCH'
  | 'IDENTITY_PLAN_INVALID'
  | 'METER_EVIDENCE_MISSING'
  | 'LAST_PART_FORBIDDEN'
  | 'LAST_CONTENT_STAFF_FORBIDDEN'
  | 'TAB_SOURCE_IN_USE'
  | 'STAFF_ROLE_MISMATCH'
  | 'NOTATION_ORPHAN_RISK'
  | 'RESULT_INVALID';

export class TopologyAuthoringV3Error extends Error {
  readonly code: TopologyAuthoringV3ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: TopologyAuthoringV3ErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'TopologyAuthoringV3Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

type R = Record<string, unknown>;
type CurrentKind = 'document' | 'part' | 'staff';
type CurrentTarget<K extends CurrentKind> = Extract<ResolvedSemanticTargetV3, { readonly kind: K }>;

const rec = (value: unknown): value is R => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value: unknown, keys: readonly string[]): value is R =>
  rec(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const clone = <T>(value: T): T => structuredClone(value);

const parseName = (value: unknown, label: string): string | null => {
  if (value === null) return null;
  if (typeof value !== 'string' || value !== value.trim() || value.length > 256) {
    throw new TopologyAuthoringV3Error(`${label} is invalid.`, 'INVALID_INTENT');
  }
  return value;
};

const parseId = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) {
    throw new TopologyAuthoringV3Error(`${label} is invalid.`, 'INVALID_INTENT');
  }
  return value;
};

const parseIndex = (value: unknown, min: number, max: number, label: string): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new TopologyAuthoringV3Error(`${label} is outside admitted range.`, 'INVALID_INTENT', { value, min, max });
  }
  return value;
};

const currentTarget = <K extends CurrentKind>(
  score: ScoreDocumentV3,
  target: SemanticAddressV3,
  kind: K
): CurrentTarget<K> => {
  try {
    const resolved = resolveSemanticAddressV3(score, target);
    if (resolved.kind !== kind) {
      throw new TopologyAuthoringV3Error(
        'Topology target kind is not admitted for this intent.',
        'TARGET_KIND_MISMATCH',
        { expected: kind, observed: resolved.kind }
      );
    }
    return resolved as CurrentTarget<K>;
  } catch (error) {
    if (error instanceof TopologyAuthoringV3Error) throw error;
    const addressingCode = error instanceof Error && 'code' in error
      ? String((error as { code?: unknown }).code)
      : null;
    if (addressingCode === 'STALE_REVISION' || addressingCode === 'DOCUMENT_MISMATCH') {
      throw new TopologyAuthoringV3Error(
        'Topology target belongs to another canonical revision.',
        'STALE_TARGET',
        { addressingCode }
      );
    }
    throw new TopologyAuthoringV3Error(
      'Topology target does not resolve exactly.',
      'TARGET_KIND_MISMATCH',
      { addressingCode }
    );
  }
};

const gcd = (left: number, right: number): number => {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) [a, b] = [b, a % b];
  return a;
};

const durationFromMeter = (beats: number, beatType: number): Rational => {
  const divisor = gcd(beats, beatType);
  return Object.freeze({ numerator: beats / divisor, denominator: beatType / divisor });
};

const effectiveMeters = (score: ScoreDocumentV3, notation: NotationDocumentV3): readonly Rational[] => {
  const declarations = new Map(notation.frames.map(entry => [entry.target.frameId, entry.notation.timeSignature]));
  let active: { beats: number; beatType: number } | null = null;
  return Object.freeze(score.measureFrames.map((frame, frameIndex) => {
    const declaration = declarations.get(frame.id);
    if (declaration !== undefined && declaration !== null) active = declaration;
    if (active === null) {
      throw new TopologyAuthoringV3Error(
        'Content topology creation requires effective meter for every frame.',
        'METER_EVIDENCE_MISSING',
        { frameId: frame.id, frameIndex }
      );
    }
    return durationFromMeter(active.beats, active.beatType);
  }));
};

const parsePlans = (value: unknown, score: ScoreDocumentV3): readonly FrameRestIdentityPlanV3[] => {
  if (!Array.isArray(value) || value.length !== score.measureFrames.length) {
    throw new TopologyAuthoringV3Error('frameRestIds must exactly cover every current frame.', 'IDENTITY_PLAN_INVALID');
  }
  return Object.freeze(value.map((raw, frameIndex) => {
    if (!exact(raw, ['frameId', 'measureId', 'voiceId', 'restEventId'])) {
      throw new TopologyAuthoringV3Error('Frame-rest identity plan field set is invalid.', 'IDENTITY_PLAN_INVALID', { frameIndex });
    }
    const frame = score.measureFrames[frameIndex];
    if (frame === undefined || raw.frameId !== frame.id) {
      throw new TopologyAuthoringV3Error(
        'Frame-rest identity plan order must match canonical measure frames.',
        'IDENTITY_PLAN_INVALID',
        { frameIndex, expectedFrameId: frame?.id, observedFrameId: raw.frameId }
      );
    }
    return Object.freeze({
      frameId: parseId(raw.frameId, 'frameId'),
      measureId: parseId(raw.measureId, 'measureId'),
      voiceId: parseId(raw.voiceId, 'voiceId'),
      restEventId: parseId(raw.restEventId, 'restEventId')
    });
  }));
};

const createContentStaff = (
  score: ScoreDocumentV3,
  notation: NotationDocumentV3,
  staffId: string,
  role: 'standard' | 'percussion',
  ordinal: number,
  plans: readonly FrameRestIdentityPlanV3[]
): ContentStaffV3 => {
  const meters = effectiveMeters(score, notation);
  return {
    id: staffId,
    ordinal,
    role,
    measures: plans.map((plan, frameIndex) => ({
      id: plan.measureId,
      frameId: plan.frameId,
      voices: [{
        id: plan.voiceId,
        ordinal: 1,
        events: [{
          id: plan.restEventId,
          kind: 'rest',
          onset: { numerator: 0, denominator: 1 },
          duration: meters[frameIndex] as Rational
        }],
        graceGroups: []
      }]
    }))
  };
};

const normalizeParts = (parts: PartV3[]): void => {
  parts.forEach((part, index) => { parts[index] = { ...part, ordinal: index + 1 }; });
};

const normalizeStaffs = (part: PartV3): PartV3 => ({
  ...part,
  staves: part.staves.map((staff, index) => ({ ...staff, ordinal: index + 1 }))
});

const parseIntent = (input: unknown, score: ScoreDocumentV3): TopologyAuthoringIntentV3 => {
  if (!rec(input) || input.version !== TOPOLOGY_AUTHORING_V3_VERSION || typeof input.type !== 'string') {
    throw new TopologyAuthoringV3Error('Topology intent envelope is invalid.', 'INVALID_INTENT');
  }

  switch (input.type) {
    case 'ADD_STANDARD_OR_PERCUSSION_PART': {
      if (!exact(input, ['version','type','target','index','partId','partName','instrumentId','instrumentName','instrumentShortName','staffId','staffRole','frameRestIds'])) {
        throw new TopologyAuthoringV3Error('ADD part field set is invalid.', 'INVALID_INTENT');
      }
      if (input.staffRole !== 'standard' && input.staffRole !== 'percussion') {
        throw new TopologyAuthoringV3Error('staffRole is invalid.', 'INVALID_INTENT');
      }
      return {
        version: '1.0.0', type: input.type,
        target: input.target as DocumentAddressV3,
        index: parseIndex(input.index, 0, score.parts.length, 'index'),
        partId: parseId(input.partId, 'partId'),
        partName: parseName(input.partName, 'partName'),
        instrumentId: parseId(input.instrumentId, 'instrumentId'),
        instrumentName: parseName(input.instrumentName, 'instrumentName'),
        instrumentShortName: parseName(input.instrumentShortName, 'instrumentShortName'),
        staffId: parseId(input.staffId, 'staffId'),
        staffRole: input.staffRole,
        frameRestIds: parsePlans(input.frameRestIds, score)
      };
    }
    case 'REMOVE_PART':
      if (!exact(input, ['version','type','target'])) throw new TopologyAuthoringV3Error('REMOVE_PART field set is invalid.', 'INVALID_INTENT');
      return { version: '1.0.0', type: input.type, target: input.target as PartAddressV3 };
    case 'REORDER_PART':
      if (!exact(input, ['version','type','target','toIndex'])) throw new TopologyAuthoringV3Error('REORDER_PART field set is invalid.', 'INVALID_INTENT');
      return { version: '1.0.0', type: input.type, target: input.target as PartAddressV3, toIndex: parseIndex(input.toIndex, 0, score.parts.length - 1, 'toIndex') };
    case 'ADD_STANDARD_OR_PERCUSSION_STAFF': {
      if (!exact(input, ['version','type','target','index','staffId','staffRole','frameRestIds'])) throw new TopologyAuthoringV3Error('ADD staff field set is invalid.', 'INVALID_INTENT');
      if (input.staffRole !== 'standard' && input.staffRole !== 'percussion') throw new TopologyAuthoringV3Error('staffRole is invalid.', 'INVALID_INTENT');
      const target = input.target as PartAddressV3;
      const resolved = currentTarget(score, target, 'part');
      return { version: '1.0.0', type: input.type, target, index: parseIndex(input.index, 0, resolved.value.staves.length, 'index'), staffId: parseId(input.staffId, 'staffId'), staffRole: input.staffRole, frameRestIds: parsePlans(input.frameRestIds, score) };
    }
    case 'REMOVE_CONTENT_STAFF':
      if (!exact(input, ['version','type','target'])) throw new TopologyAuthoringV3Error('REMOVE_CONTENT_STAFF field set is invalid.', 'INVALID_INTENT');
      return { version: '1.0.0', type: input.type, target: input.target as StaffAddressV3 };
    case 'REORDER_STAFF': {
      if (!exact(input, ['version','type','target','toIndex'])) throw new TopologyAuthoringV3Error('REORDER_STAFF field set is invalid.', 'INVALID_INTENT');
      const target = input.target as StaffAddressV3;
      const resolved = currentTarget(score, target, 'staff');
      const part = score.parts.find(item => item.id === target.partId);
      if (part === undefined) throw new TopologyAuthoringV3Error('Staff parent part does not resolve.', 'TARGET_KIND_MISMATCH');
      void resolved;
      return { version: '1.0.0', type: input.type, target, toIndex: parseIndex(input.toIndex, 0, part.staves.length - 1, 'toIndex') };
    }
    case 'ADD_LINKED_TAB_STAFF': {
      if (!exact(input, ['version','type','target','index','staffId','tabProfile'])) throw new TopologyAuthoringV3Error('ADD_LINKED_TAB_STAFF field set is invalid.', 'INVALID_INTENT');
      const target = input.target as StaffAddressV3;
      currentTarget(score, target, 'staff');
      const part = score.parts.find(item => item.id === target.partId);
      if (part === undefined) throw new TopologyAuthoringV3Error('TAB source parent part does not resolve.', 'TARGET_KIND_MISMATCH');
      return { version: '1.0.0', type: input.type, target, index: parseIndex(input.index, 0, part.staves.length, 'index'), staffId: parseId(input.staffId, 'staffId'), tabProfile: clone(input.tabProfile) as TabProfileV3 };
    }
    case 'REMOVE_LINKED_TAB_STAFF':
      if (!exact(input, ['version','type','target'])) throw new TopologyAuthoringV3Error('REMOVE_LINKED_TAB_STAFF field set is invalid.', 'INVALID_INTENT');
      return { version: '1.0.0', type: input.type, target: input.target as StaffAddressV3 };
    case 'RENAME_PART_OR_INSTRUMENT':
      if (!exact(input, ['version','type','target','partName','instrumentName','instrumentShortName'])) throw new TopologyAuthoringV3Error('RENAME field set is invalid.', 'INVALID_INTENT');
      return { version: '1.0.0', type: input.type, target: input.target as PartAddressV3, partName: parseName(input.partName, 'partName'), instrumentName: parseName(input.instrumentName, 'instrumentName'), instrumentShortName: parseName(input.instrumentShortName, 'instrumentShortName') };
    default:
      throw new TopologyAuthoringV3Error('Unsupported topology authoring intent.', 'INVALID_INTENT', { type: input.type });
  }
};

const rebound = <T extends SemanticAddressV3>(score: ScoreDocumentV3, entityId: string, kind: T['kind']): T => {
  try {
    const address = addressEntityV3(score, entityId);
    if (address.kind !== kind) throw new Error(`expected ${kind}, observed ${address.kind}`);
    return address as T;
  } catch (error) {
    throw new TopologyAuthoringV3Error(
      'Topology edit would orphan canonical notation.',
      'NOTATION_ORPHAN_RISK',
      { entityId, cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

const rebindNotation = (score: ScoreDocumentV3, notation: NotationDocumentV3): Readonly<NotationDocumentV3> => {
  const frames: FrameNotationEntryV3[] = notation.frames.map(entry => ({ target: rebound<MeasureFrameAddressV3>(score, entry.target.frameId, 'measure-frame'), notation: entry.notation }));
  const measures: StaffMeasureNotationEntryV3[] = notation.measures.map(entry => ({ target: rebound<MeasureAddressV3>(score, entry.target.measureId, 'measure'), notation: entry.notation }));
  const events: EventNotationEntryV3[] = notation.events.map(entry => ({ target: rebound<EventAddressV3>(score, entry.target.eventId, 'event'), notation: entry.notation }));
  const notes: NoteNotationEntryV3[] = notation.notes.map(entry => ({ target: rebound<NoteAddressV3>(score, entry.target.noteId, 'note'), notation: entry.notation }));
  const graceEvents: GraceEventNotationEntryV3[] = notation.graceEvents.map(entry => ({ target: rebound<GraceEventAddressV3>(score, entry.target.graceEventId, 'grace-event'), notation: entry.notation }));
  const graceNotes: GraceNoteNotationEntryV3[] = notation.graceNotes.map(entry => ({ target: rebound<GraceNoteAddressV3>(score, entry.target.graceNoteId, 'grace-note'), notation: entry.notation }));
  return createNotationDocumentV3(score, { contractVersion: '3.0.0', documentId: score.id, revisionId: score.revision.id, frames, measures, events, notes, graceEvents, graceNotes });
};

const nextRevision = (score: ScoreDocumentV3, value: string): RevisionIdentity => {
  const next = parseId(value, 'nextRevisionId');
  if (next === score.revision.id) throw new TopologyAuthoringV3Error('nextRevisionId must create a new direct child.', 'INVALID_INTENT');
  return { id: next, parentId: score.revision.id };
};

export const executeTopologyAuthoringV3 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV3,
  intentInput: unknown,
  options: TopologyAuthoringV3Options
): TopologyAuthoringV3Result => {
  const score = createScoreDocumentV3(scoreInput);
  const notation = createNotationDocumentV3(score, notationInput);
  const intent = parseIntent(intentInput, score);
  const revision = nextRevision(score, options.nextRevisionId);
  let candidate = clone(score) as ScoreDocumentV3;
  let selectionEntityId = score.id;

  switch (intent.type) {
    case 'ADD_STANDARD_OR_PERCUSSION_PART': {
      currentTarget(score, intent.target, 'document');
      const staff = createContentStaff(score, notation, intent.staffId, intent.staffRole, 1, intent.frameRestIds);
      const part: PartV3 = { id: intent.partId, ordinal: intent.index + 1, name: intent.partName, instrument: { id: intent.instrumentId, name: intent.instrumentName, shortName: intent.instrumentShortName }, staves: [staff] };
      const parts = clone(score.parts) as PartV3[];
      parts.splice(intent.index, 0, part);
      normalizeParts(parts);
      candidate = { ...candidate, parts, revision };
      selectionEntityId = intent.partId;
      break;
    }
    case 'REMOVE_PART': {
      const target = currentTarget(score, intent.target, 'part');
      if (score.parts.length === 1) throw new TopologyAuthoringV3Error('The final part cannot be removed.', 'LAST_PART_FORBIDDEN');
      const parts = (clone(score.parts) as PartV3[]).filter(part => part.id !== target.value.id);
      normalizeParts(parts);
      candidate = { ...candidate, parts, revision };
      selectionEntityId = score.id;
      break;
    }
    case 'REORDER_PART': {
      const target = currentTarget(score, intent.target, 'part');
      const parts = clone(score.parts) as PartV3[];
      const from = parts.findIndex(part => part.id === target.value.id);
      const [moved] = parts.splice(from, 1);
      if (moved === undefined) throw new TopologyAuthoringV3Error('Part disappeared during reorder.', 'RESULT_INVALID');
      parts.splice(intent.toIndex, 0, moved);
      normalizeParts(parts);
      candidate = { ...candidate, parts, revision };
      selectionEntityId = target.value.id;
      break;
    }
    case 'ADD_STANDARD_OR_PERCUSSION_STAFF': {
      const target = currentTarget(score, intent.target, 'part');
      const parts = clone(score.parts) as PartV3[];
      const partIndex = parts.findIndex(part => part.id === target.value.id);
      const part = parts[partIndex];
      if (part === undefined) throw new TopologyAuthoringV3Error('Part disappeared during staff addition.', 'RESULT_INVALID');
      const staff = createContentStaff(score, notation, intent.staffId, intent.staffRole, intent.index + 1, intent.frameRestIds);
      const staves = [...part.staves];
      staves.splice(intent.index, 0, staff);
      parts[partIndex] = normalizeStaffs({ ...part, staves });
      candidate = { ...candidate, parts, revision };
      selectionEntityId = intent.staffId;
      break;
    }
    case 'REMOVE_CONTENT_STAFF': {
      const target = currentTarget(score, intent.target, 'staff');
      if (target.value.role === 'tablature-linked') throw new TopologyAuthoringV3Error('REMOVE_CONTENT_STAFF requires a content-bearing staff.', 'STAFF_ROLE_MISMATCH');
      const part = score.parts.find(item => item.id === intent.target.partId);
      if (part === undefined) throw new TopologyAuthoringV3Error('Staff parent part disappeared.', 'RESULT_INVALID');
      const contentCount = part.staves.filter(staff => staff.role !== 'tablature-linked').length;
      if (contentCount <= 1) throw new TopologyAuthoringV3Error('A part must retain at least one content-bearing staff.', 'LAST_CONTENT_STAFF_FORBIDDEN');
      if (part.staves.some(staff => staff.role === 'tablature-linked' && staff.sourceStaffId === target.value.id)) {
        throw new TopologyAuthoringV3Error('A standard staff referenced by linked TAB cannot be removed independently.', 'TAB_SOURCE_IN_USE', { staffId: target.value.id });
      }
      const parts = clone(score.parts) as PartV3[];
      const partIndex = parts.findIndex(item => item.id === part.id);
      const mutable = parts[partIndex];
      if (mutable === undefined) throw new TopologyAuthoringV3Error('Part disappeared during staff removal.', 'RESULT_INVALID');
      parts[partIndex] = normalizeStaffs({ ...mutable, staves: mutable.staves.filter(staff => staff.id !== target.value.id) });
      candidate = { ...candidate, parts, revision };
      selectionEntityId = part.id;
      break;
    }
    case 'REORDER_STAFF': {
      const target = currentTarget(score, intent.target, 'staff');
      const parts = clone(score.parts) as PartV3[];
      const partIndex = parts.findIndex(part => part.id === intent.target.partId);
      const part = parts[partIndex];
      if (part === undefined) throw new TopologyAuthoringV3Error('Part disappeared during staff reorder.', 'RESULT_INVALID');
      const staves = [...part.staves];
      const from = staves.findIndex(staff => staff.id === target.value.id);
      const [moved] = staves.splice(from, 1);
      if (moved === undefined) throw new TopologyAuthoringV3Error('Staff disappeared during reorder.', 'RESULT_INVALID');
      staves.splice(intent.toIndex, 0, moved);
      parts[partIndex] = normalizeStaffs({ ...part, staves });
      candidate = { ...candidate, parts, revision };
      selectionEntityId = target.value.id;
      break;
    }
    case 'ADD_LINKED_TAB_STAFF': {
      const source = currentTarget(score, intent.target, 'staff');
      if (source.value.role !== 'standard') throw new TopologyAuthoringV3Error('Linked TAB source must be a standard staff.', 'STAFF_ROLE_MISMATCH');
      const parts = clone(score.parts) as PartV3[];
      const partIndex = parts.findIndex(part => part.id === intent.target.partId);
      const part = parts[partIndex];
      if (part === undefined) throw new TopologyAuthoringV3Error('Part disappeared during linked TAB addition.', 'RESULT_INVALID');
      const staves = [...part.staves];
      staves.splice(intent.index, 0, { id: intent.staffId, ordinal: intent.index + 1, role: 'tablature-linked', sourceStaffId: source.value.id, tabProfile: clone(intent.tabProfile), measures: [] });
      parts[partIndex] = normalizeStaffs({ ...part, staves });
      candidate = { ...candidate, parts, revision };
      selectionEntityId = intent.staffId;
      break;
    }
    case 'REMOVE_LINKED_TAB_STAFF': {
      const target = currentTarget(score, intent.target, 'staff');
      if (target.value.role !== 'tablature-linked') throw new TopologyAuthoringV3Error('REMOVE_LINKED_TAB_STAFF requires a linked TAB staff.', 'STAFF_ROLE_MISMATCH');
      const parts = clone(score.parts) as PartV3[];
      const partIndex = parts.findIndex(part => part.id === intent.target.partId);
      const part = parts[partIndex];
      if (part === undefined) throw new TopologyAuthoringV3Error('Part disappeared during linked TAB removal.', 'RESULT_INVALID');
      parts[partIndex] = normalizeStaffs({ ...part, staves: part.staves.filter(staff => staff.id !== target.value.id) });
      candidate = { ...candidate, parts, revision };
      selectionEntityId = part.id;
      break;
    }
    case 'RENAME_PART_OR_INSTRUMENT': {
      const target = currentTarget(score, intent.target, 'part');
      const parts = clone(score.parts) as PartV3[];
      const partIndex = parts.findIndex(part => part.id === target.value.id);
      const part = parts[partIndex];
      if (part === undefined) throw new TopologyAuthoringV3Error('Part disappeared during rename.', 'RESULT_INVALID');
      parts[partIndex] = { ...part, name: intent.partName, instrument: { ...part.instrument, name: intent.instrumentName, shortName: intent.instrumentShortName } };
      candidate = { ...candidate, parts, revision };
      selectionEntityId = part.id;
      break;
    }
  }

  let nextScore: Readonly<ScoreDocumentV3>;
  try {
    nextScore = createScoreDocumentV3(candidate);
  } catch (error) {
    throw new TopologyAuthoringV3Error('Topology candidate failed v3 validation.', 'RESULT_INVALID', { cause: error instanceof Error ? error.message : String(error) });
  }
  const nextNotation = rebindNotation(nextScore, notation);
  return Object.freeze({ score: nextScore, notation: nextNotation, selectionEntityId });
};
