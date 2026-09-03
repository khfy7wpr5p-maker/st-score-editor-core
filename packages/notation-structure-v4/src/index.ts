import { createScoreDocumentV3, type ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import { resolveSemanticAddressV3, type EventAddressV3 } from '../../addressing-v3/src/index.js';
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

export const NOTATION_DOCUMENT_V4_VERSION = '4.0.0' as const;

export interface CrossStaffPlacementV4 {
  readonly source: EventAddressV3;
  readonly displayStaffId: string;
}

export interface NotationDocumentV4 {
  readonly contractVersion: typeof NOTATION_DOCUMENT_V4_VERSION;
  readonly documentId: string;
  readonly revisionId: string;
  readonly frames: readonly FrameNotationEntryV3[];
  readonly measures: readonly StaffMeasureNotationEntryV3[];
  readonly events: readonly EventNotationEntryV3[];
  readonly notes: readonly NoteNotationEntryV3[];
  readonly graceEvents: readonly GraceEventNotationEntryV3[];
  readonly graceNotes: readonly GraceNoteNotationEntryV3[];
  readonly crossStaffPlacements: readonly CrossStaffPlacementV4[];
}

export type NotationV4ErrorCode =
  | 'INVALID_NOTATION'
  | 'STALE_NOTATION'
  | 'INVALID_CROSS_STAFF_SOURCE'
  | 'INVALID_CROSS_STAFF_DISPLAY_STAFF'
  | 'DUPLICATE_CROSS_STAFF_SOURCE';

export class NotationV4Error extends Error {
  readonly code: NotationV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: NotationV4ErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'NotationV4Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

type R = Record<string, unknown>;
const rec = (value: unknown): value is R => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value: unknown, keys: readonly string[]): value is R =>
  rec(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const freeze = <T>(value: T): Readonly<T> => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    if (Array.isArray(value)) {
      for (const item of value) freeze(item);
    } else {
      for (const item of Object.values(value as R)) freeze(item);
    }
  }
  return value as Readonly<T>;
};

const baseNotationV3 = (score: ScoreDocumentV3, input: NotationDocumentV4): Readonly<NotationDocumentV3> =>
  createNotationDocumentV3(score, {
    contractVersion: '3.0.0',
    documentId: input.documentId,
    revisionId: input.revisionId,
    frames: input.frames,
    measures: input.measures,
    events: input.events,
    notes: input.notes,
    graceEvents: input.graceEvents,
    graceNotes: input.graceNotes
  });

const validatePlacement = (score: ScoreDocumentV3, raw: unknown, index: number): CrossStaffPlacementV4 => {
  if (!exact(raw, ['source', 'displayStaffId']) || typeof raw.displayStaffId !== 'string') {
    throw new NotationV4Error('Cross-staff placement field set is invalid.', 'INVALID_NOTATION', { index });
  }
  let resolved;
  try {
    resolved = resolveSemanticAddressV3(score, raw.source as EventAddressV3);
  } catch (error) {
    throw new NotationV4Error('Cross-staff source event is stale or invalid.', 'INVALID_CROSS_STAFF_SOURCE', {
      index,
      cause: error instanceof Error ? error.message : String(error)
    });
  }
  if (resolved.kind !== 'event') {
    throw new NotationV4Error('Cross-staff source must resolve to a normal timed event.', 'INVALID_CROSS_STAFF_SOURCE', { index, observed: resolved.kind });
  }
  if (resolved.value.kind === 'rest') {
    throw new NotationV4Error('Rest cross-staff placement is outside the admitted profile.', 'INVALID_CROSS_STAFF_SOURCE', { index });
  }
  const source = raw.source as EventAddressV3;
  const part = score.parts.find(item => item.id === source.partId);
  const sourceStaff = part?.staves.find(item => item.id === source.staffId);
  if (part === undefined || sourceStaff === undefined || sourceStaff.role !== 'standard') {
    throw new NotationV4Error('Cross-staff source must belong to a standard staff.', 'INVALID_CROSS_STAFF_SOURCE', { index, staffId: source.staffId });
  }
  if (raw.displayStaffId === source.staffId) {
    throw new NotationV4Error('Cross-staff display staff must differ from source staff.', 'INVALID_CROSS_STAFF_DISPLAY_STAFF', { index, staffId: source.staffId });
  }
  const display = part.staves.find(item => item.id === raw.displayStaffId);
  if (display === undefined || display.role !== 'standard') {
    throw new NotationV4Error('Cross-staff display target must be a standard staff in the same part.', 'INVALID_CROSS_STAFF_DISPLAY_STAFF', { index, displayStaffId: raw.displayStaffId });
  }
  if (!display.measures.some(measure => measure.frameId === source.frameId)) {
    throw new NotationV4Error('Cross-staff display staff does not own the source frame.', 'INVALID_CROSS_STAFF_DISPLAY_STAFF', { index, displayStaffId: display.id, frameId: source.frameId });
  }
  return Object.freeze({ source, displayStaffId: raw.displayStaffId });
};

export const createNotationDocumentV4 = (
  scoreInput: ScoreDocumentV3,
  input: NotationDocumentV4
): Readonly<NotationDocumentV4> => {
  const score = createScoreDocumentV3(scoreInput);
  if (!exact(input, ['contractVersion','documentId','revisionId','frames','measures','events','notes','graceEvents','graceNotes','crossStaffPlacements']) || input.contractVersion !== NOTATION_DOCUMENT_V4_VERSION) {
    throw new NotationV4Error('NotationDocumentV4 envelope is invalid.', 'INVALID_NOTATION');
  }
  if (input.documentId !== score.id || input.revisionId !== score.revision.id) {
    throw new NotationV4Error('NotationDocumentV4 belongs to another score revision.', 'STALE_NOTATION', {
      expectedDocumentId: score.id,
      expectedRevisionId: score.revision.id
    });
  }
  if (!Array.isArray(input.crossStaffPlacements)) {
    throw new NotationV4Error('crossStaffPlacements must be an array.', 'INVALID_NOTATION');
  }
  const base = baseNotationV3(score, input);
  const seen = new Set<string>();
  const placements = input.crossStaffPlacements.map((raw, index) => {
    const placement = validatePlacement(score, raw, index);
    if (seen.has(placement.source.eventId)) {
      throw new NotationV4Error('Only one cross-staff placement is allowed per source event.', 'DUPLICATE_CROSS_STAFF_SOURCE', {
        eventId: placement.source.eventId
      });
    }
    seen.add(placement.source.eventId);
    return placement;
  });
  const cloned: NotationDocumentV4 = structuredClone({
    contractVersion: NOTATION_DOCUMENT_V4_VERSION,
    documentId: score.id,
    revisionId: score.revision.id,
    frames: base.frames,
    measures: base.measures,
    events: base.events,
    notes: base.notes,
    graceEvents: base.graceEvents,
    graceNotes: base.graceNotes,
    crossStaffPlacements: placements
  });
  return freeze(cloned);
};

export const emptyNotationDocumentV4 = (score: ScoreDocumentV3): Readonly<NotationDocumentV4> =>
  createNotationDocumentV4(score, {
    contractVersion: NOTATION_DOCUMENT_V4_VERSION,
    documentId: score.id,
    revisionId: score.revision.id,
    frames: [],
    measures: [],
    events: [],
    notes: [],
    graceEvents: [],
    graceNotes: [],
    crossStaffPlacements: []
  });

export const displayStaffForEventV4 = (notation: NotationDocumentV4, eventId: string): string | null =>
  notation.crossStaffPlacements.find(item => item.source.eventId === eventId)?.displayStaffId ?? null;
