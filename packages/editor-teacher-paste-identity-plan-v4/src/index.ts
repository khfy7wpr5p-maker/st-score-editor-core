import type { NotationDocumentV4 } from '../../notation-structure-v4/src/index.js';
import { createScoreDocumentV3, type ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import type { TeacherCopySnapshotV4 } from '../../editor-teacher-copy-snapshot-v4/src/index.js';
import {
  analyzeTeacherPasteDestinationV4,
  EDITOR_TEACHER_PASTE_ADMISSION_V4_VERSION,
  type TeacherPasteAdmissionV4
} from '../../editor-teacher-paste-admission-v4/src/index.js';

export const EDITOR_TEACHER_PASTE_IDENTITY_PLAN_V4_VERSION = '1.0.0' as const;

export interface TeacherPasteNoteIdentityPlanV4 {
  readonly sourceNoteId: string;
  readonly destinationNoteId: string;
}

export interface TeacherPasteEventIdentityPlanV4 {
  readonly sourceEventId: string;
  readonly destinationEventId: string;
  readonly notes: readonly TeacherPasteNoteIdentityPlanV4[];
}

export interface TeacherPasteIdentityPlanV4 {
  readonly version: typeof EDITOR_TEACHER_PASTE_IDENTITY_PLAN_V4_VERSION;
  readonly kind: 'TEACHER_PASTE_IDENTITY_PLAN';
  readonly documentId: string;
  readonly sourceRevisionId: string;
  readonly nextRevisionId: string;
  readonly destinationRestEventId: string;
  readonly events: readonly TeacherPasteEventIdentityPlanV4[];
  readonly eventIdentityCount: number;
  readonly noteIdentityCount: number;
  readonly relationIdentityCount: 0;
  readonly identityAllocationPerformed: false;
  readonly canonicalMutationAuthority: false;
  readonly historyMutationAuthority: false;
}

export type TeacherPasteIdentityPlanV4ErrorCode =
  | 'INVALID_REVISION_ID'
  | 'ADMISSION_STALE_OR_INVALID'
  | 'ID_COLLISION'
  | 'INVALID_SNAPSHOT';

export class TeacherPasteIdentityPlanV4Error extends Error {
  readonly code: TeacherPasteIdentityPlanV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(
    message: string,
    code: TeacherPasteIdentityPlanV4ErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'TeacherPasteIdentityPlanV4Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MASK_64 = (1n << 64n) - 1n;
const FNV_OFFSET_64 = 14695981039346656037n;
const FNV_PRIME_64 = 1099511628211n;

type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const allIds = (score: ScoreDocumentV3): ReadonlySet<string> => {
  const ids = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!isRecord(value)) return;
    for (const [key, item] of Object.entries(value)) {
      if (key === 'id' && typeof item === 'string') ids.add(item);
      visit(item);
    }
  };
  visit(score);
  return ids;
};

const fnv1a64 = (value: string): string => {
  let hash = FNV_OFFSET_64;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = (hash * FNV_PRIME_64) & MASK_64;
  }
  return hash.toString(16).padStart(16, '0');
};

const sameAdmission = (left: TeacherPasteAdmissionV4, right: TeacherPasteAdmissionV4): boolean =>
  JSON.stringify({
    version: left.version,
    kind: left.kind,
    admitted: left.admitted,
    mode: left.mode,
    destination: left.destination,
    destinationRestEventId: left.destinationRestEventId,
    pasteStart: left.pasteStart,
    pasteExtent: left.pasteExtent,
    pasteEnd: left.pasteEnd,
    sourceEventCount: left.sourceEventCount,
    sourceNoteCount: left.sourceNoteCount,
    restPlan: left.restPlan,
    identityAllocationRequired: left.identityAllocationRequired,
    identityAllocationPerformed: left.identityAllocationPerformed,
    relationRemappingRequired: left.relationRemappingRequired,
    canonicalMutationAuthority: left.canonicalMutationAuthority,
    historyMutationAuthority: left.historyMutationAuthority
  }) === JSON.stringify({
    version: right.version,
    kind: right.kind,
    admitted: right.admitted,
    mode: right.mode,
    destination: right.destination,
    destinationRestEventId: right.destinationRestEventId,
    pasteStart: right.pasteStart,
    pasteExtent: right.pasteExtent,
    pasteEnd: right.pasteEnd,
    sourceEventCount: right.sourceEventCount,
    sourceNoteCount: right.sourceNoteCount,
    restPlan: right.restPlan,
    identityAllocationRequired: right.identityAllocationRequired,
    identityAllocationPerformed: right.identityAllocationPerformed,
    relationRemappingRequired: right.relationRemappingRequired,
    canonicalMutationAuthority: right.canonicalMutationAuthority,
    historyMutationAuthority: right.historyMutationAuthority
  });

const assertFreshRevision = (score: ScoreDocumentV3, nextRevisionId: string): void => {
  if (
    !ID.test(nextRevisionId) ||
    nextRevisionId === score.revision.id ||
    nextRevisionId === score.revision.parentId
  ) {
    throw new TeacherPasteIdentityPlanV4Error(
      'Teacher paste identity planning requires a fresh stable revision id distinct from current and immediate parent revisions.',
      'INVALID_REVISION_ID',
      { nextRevisionId, currentRevisionId: score.revision.id, parentRevisionId: score.revision.parentId }
    );
  }
};

const plannedId = (
  prefix: 'paste-event' | 'paste-note',
  score: ScoreDocumentV3,
  destinationRestEventId: string,
  nextRevisionId: string,
  discriminator: string
): string => `${prefix}:${fnv1a64(`${score.id}|${score.revision.id}|${destinationRestEventId}|${nextRevisionId}|${discriminator}`)}`;

export const planTeacherPasteIdentitiesV4 = (
  scoreInput: ScoreDocumentV3,
  notation: NotationDocumentV4,
  snapshot: TeacherCopySnapshotV4,
  admissionInput: TeacherPasteAdmissionV4,
  nextRevisionId: string
): Readonly<TeacherPasteIdentityPlanV4> => {
  const score = createScoreDocumentV3(scoreInput);
  assertFreshRevision(score, nextRevisionId);
  if (
    admissionInput.version !== EDITOR_TEACHER_PASTE_ADMISSION_V4_VERSION ||
    admissionInput.kind !== 'TEACHER_PASTE_ADMISSION' ||
    admissionInput.admitted !== true
  ) {
    throw new TeacherPasteIdentityPlanV4Error(
      'Teacher paste admission envelope is invalid.',
      'ADMISSION_STALE_OR_INVALID'
    );
  }

  let currentAdmission: Readonly<TeacherPasteAdmissionV4>;
  try {
    currentAdmission = analyzeTeacherPasteDestinationV4(score, notation, snapshot, admissionInput.destination);
  } catch (error) {
    throw new TeacherPasteIdentityPlanV4Error(
      'Teacher paste admission no longer revalidates against the current canonical pair.',
      'ADMISSION_STALE_OR_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  if (!sameAdmission(admissionInput, currentAdmission)) {
    throw new TeacherPasteIdentityPlanV4Error(
      'Teacher paste admission facts changed or were tampered with before identity planning.',
      'ADMISSION_STALE_OR_INVALID'
    );
  }
  const segment = snapshot.segments[0];
  if (segment === undefined || segment.events.length !== snapshot.eventCount) {
    throw new TeacherPasteIdentityPlanV4Error(
      'Teacher paste snapshot no longer contains the admitted source event set.',
      'INVALID_SNAPSHOT'
    );
  }

  const occupied = allIds(score);
  const planned = new Set<string>();
  let noteIdentityCount = 0;
  const events = segment.events.map((event, eventIndex) => {
    const destinationEventId = plannedId(
      'paste-event',
      score,
      currentAdmission.destinationRestEventId,
      nextRevisionId,
      `event|${eventIndex}|${event.sourceEventId}`
    );
    if (occupied.has(destinationEventId) || planned.has(destinationEventId)) {
      throw new TeacherPasteIdentityPlanV4Error(
        'Deterministic teacher paste event identity collides with canonical or planned identity.',
        'ID_COLLISION',
        { id: destinationEventId, sourceEventId: event.sourceEventId }
      );
    }
    planned.add(destinationEventId);
    const notes = event.notes.map((note, noteIndex) => {
      const destinationNoteId = plannedId(
        'paste-note',
        score,
        currentAdmission.destinationRestEventId,
        nextRevisionId,
        `note|${eventIndex}|${noteIndex}|${note.sourceNoteId}`
      );
      if (occupied.has(destinationNoteId) || planned.has(destinationNoteId)) {
        throw new TeacherPasteIdentityPlanV4Error(
          'Deterministic teacher paste note identity collides with canonical or planned identity.',
          'ID_COLLISION',
          { id: destinationNoteId, sourceNoteId: note.sourceNoteId }
        );
      }
      planned.add(destinationNoteId);
      noteIdentityCount += 1;
      return Object.freeze({ sourceNoteId: note.sourceNoteId, destinationNoteId });
    });
    return Object.freeze({
      sourceEventId: event.sourceEventId,
      destinationEventId,
      notes: Object.freeze(notes)
    });
  });

  if (events.length !== snapshot.eventCount || noteIdentityCount !== snapshot.noteCount) {
    throw new TeacherPasteIdentityPlanV4Error(
      'Teacher paste identity counts do not match the admitted snapshot.',
      'INVALID_SNAPSHOT',
      {
        expectedEvents: snapshot.eventCount,
        plannedEvents: events.length,
        expectedNotes: snapshot.noteCount,
        plannedNotes: noteIdentityCount
      }
    );
  }

  return Object.freeze({
    version: EDITOR_TEACHER_PASTE_IDENTITY_PLAN_V4_VERSION,
    kind: 'TEACHER_PASTE_IDENTITY_PLAN' as const,
    documentId: score.id,
    sourceRevisionId: score.revision.id,
    nextRevisionId,
    destinationRestEventId: currentAdmission.destinationRestEventId,
    events: Object.freeze(events),
    eventIdentityCount: events.length,
    noteIdentityCount,
    relationIdentityCount: 0 as const,
    identityAllocationPerformed: false as const,
    canonicalMutationAuthority: false as const,
    historyMutationAuthority: false as const
  });
};
