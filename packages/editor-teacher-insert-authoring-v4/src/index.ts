import {
  addressEntityV3,
  type EventAddressV3,
  type SemanticAddressV3
} from '../../addressing-v3/src/index.js';
import {
  createNotationDocumentV4,
  type NotationDocumentV4
} from '../../notation-structure-v4/src/index.js';
import type { EventNotationV2 } from '../../notation-structure-v2/src/index.js';
import type { NoteNotation } from '../../notation-structure/src/index.js';
import {
  createScoreDocumentV3,
  type ScoreDocumentV3
} from '../../score-model-v3/src/index.js';
import type { Pitch, Rational, ScoreEvent } from '../../score-model/src/index.js';
import type {
  TeacherCopyEventSnapshotV4,
  TeacherCopySnapshotV4
} from '../../editor-teacher-copy-snapshot-v4/src/index.js';
import {
  analyzeTeacherInsertAfterEventV4,
  type TeacherInsertAdmissionV4,
  type TeacherInsertSuffixShiftV4,
  type TeacherInsertTrailingRestPlanV4
} from '../../editor-teacher-insert-admission-v4/src/index.js';

export const EDITOR_TEACHER_INSERT_AUTHORING_V4_VERSION = '1.0.0' as const;

export interface TeacherInsertNoteIdentityV4 {
  readonly sourceNoteId: string;
  readonly destinationNoteId: string;
}

export interface TeacherInsertEventIdentityV4 {
  readonly sourceEventId: string;
  readonly destinationEventId: string;
  readonly notes: readonly TeacherInsertNoteIdentityV4[];
}

export interface TeacherInsertIdentityPlanV4 {
  readonly documentId: string;
  readonly sourceRevisionId: string;
  readonly nextRevisionId: string;
  readonly destinationAnchorEventId: string;
  readonly trailingRestEventId: string;
  readonly events: readonly TeacherInsertEventIdentityV4[];
  readonly eventIdentityCount: number;
  readonly noteIdentityCount: number;
  readonly relationIdentityCount: 0;
  readonly identityAllocationPerformed: false;
  readonly canonicalMutationAuthority: false;
  readonly historyMutationAuthority: false;
}

export interface TeacherInsertAuthoringV4Result {
  readonly version: typeof EDITOR_TEACHER_INSERT_AUTHORING_V4_VERSION;
  readonly score: Readonly<ScoreDocumentV3>;
  readonly notation: Readonly<NotationDocumentV4>;
  readonly selection: EventAddressV3;
  readonly admission: Readonly<TeacherInsertAdmissionV4>;
  readonly identityPlan: Readonly<TeacherInsertIdentityPlanV4>;
  readonly suffixShift: readonly TeacherInsertSuffixShiftV4[];
  readonly trailingRestPlan: Readonly<TeacherInsertTrailingRestPlanV4>;
  readonly insertedEventIds: readonly string[];
  readonly insertedNoteIds: readonly string[];
  readonly historyMutationAuthority: false;
}

export type TeacherInsertAuthoringV4ErrorCode =
  | 'ADMISSION_STALE_OR_INVALID'
  | 'INVALID_REVISION_ID'
  | 'IDENTITY_COLLISION'
  | 'SNAPSHOT_CONTENT_INVALID'
  | 'DESTINATION_PATH_INVALID'
  | 'RESULT_INVALID'
  | 'NOTATION_RESULT_INVALID';

export class TeacherInsertAuthoringV4Error extends Error {
  readonly code: TeacherInsertAuthoringV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(
    message: string,
    code: TeacherInsertAuthoringV4ErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'TeacherInsertAuthoringV4Error';
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

const gcd = (left: bigint, right: bigint): bigint => {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a === 0n ? 1n : a;
};

const rational = (numerator: bigint, denominator: bigint): Readonly<Rational> => {
  if (numerator < 0n || denominator <= 0n) {
    throw new TeacherInsertAuthoringV4Error('Teacher insert result produced invalid timing.', 'RESULT_INVALID');
  }
  const divisor = gcd(numerator, denominator);
  const n = numerator / divisor;
  const d = denominator / divisor;
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (n > max || d > max) {
    throw new TeacherInsertAuthoringV4Error('Teacher insert result timing exceeded exact safe-integer range.', 'RESULT_INVALID');
  }
  return Object.freeze({ numerator: Number(n), denominator: Number(d) });
};

const add = (left: Rational, right: Rational): Readonly<Rational> => rational(
  BigInt(left.numerator) * BigInt(right.denominator) +
    BigInt(right.numerator) * BigInt(left.denominator),
  BigInt(left.denominator) * BigInt(right.denominator)
);

const sameJson = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

const fnv1a64 = (value: string): string => {
  let hash = FNV_OFFSET_64;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = (hash * FNV_PRIME_64) & MASK_64;
  }
  return hash.toString(16).padStart(16, '0');
};

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

const assertFreshRevision = (score: ScoreDocumentV3, nextRevisionId: string): void => {
  if (!ID.test(nextRevisionId) || nextRevisionId === score.revision.id || nextRevisionId === score.revision.parentId) {
    throw new TeacherInsertAuthoringV4Error(
      'Teacher insert requires a fresh stable revision id distinct from current and immediate parent revisions.',
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
    throw new TeacherInsertAuthoringV4Error(
      'Teacher insert result changed semantic target kind during notation rebind.',
      'NOTATION_RESULT_INVALID',
      { targetId: targetId(address), expectedKind: address.kind, observedKind: rebound.kind }
    );
  }
  return rebound;
};

const spanningOrnament = (notation: EventNotationV2): boolean =>
  notation.ornaments.some(ornament =>
    ornament.kind === 'wavy-line' || (ornament.kind === 'tremolo' && ornament.type !== 'single'));

const assertSnapshotRelationFree = (snapshot: TeacherCopySnapshotV4): readonly TeacherCopyEventSnapshotV4[] => {
  const segment = snapshot.segments[0];
  if (segment === undefined || snapshot.segments.length !== 1 || segment.events.length !== snapshot.eventCount) {
    throw new TeacherInsertAuthoringV4Error('Teacher insert source snapshot shape is invalid.', 'SNAPSHOT_CONTENT_INVALID');
  }
  let noteCount = 0;
  for (const event of segment.events) {
    if (event.notation !== null) {
      if (event.notation.beams.length > 0 || event.notation.tuplet !== null || spanningOrnament(event.notation)) {
        throw new TeacherInsertAuthoringV4Error(
          'Teacher insert source snapshot contains relation-coupled event notation.',
          'SNAPSHOT_CONTENT_INVALID',
          { sourceEventId: event.sourceEventId }
        );
      }
    }
    for (const note of event.notes) {
      noteCount += 1;
      if (note.notation !== null && (note.notation.ties.length > 0 || note.notation.slurs.length > 0)) {
        throw new TeacherInsertAuthoringV4Error(
          'Teacher insert source snapshot contains relation-coupled note notation.',
          'SNAPSHOT_CONTENT_INVALID',
          { sourceNoteId: note.sourceNoteId }
        );
      }
    }
  }
  if (noteCount !== snapshot.noteCount) {
    throw new TeacherInsertAuthoringV4Error('Teacher insert source note count changed.', 'SNAPSHOT_CONTENT_INVALID');
  }
  return segment.events;
};

const planIdentities = (
  score: ScoreDocumentV3,
  snapshot: TeacherCopySnapshotV4,
  admission: TeacherInsertAdmissionV4,
  nextRevisionId: string
): Readonly<TeacherInsertIdentityPlanV4> => {
  assertFreshRevision(score, nextRevisionId);
  const sourceEvents = assertSnapshotRelationFree(snapshot);
  const occupied = allIds(score);
  const planned = new Set<string>();
  const trailingRestEventId = admission.trailingRestPlan.restEventId;
  let noteIdentityCount = 0;
  const events = sourceEvents.map((event, eventIndex) => {
    const destinationEventId = `insert-event:${fnv1a64(`${score.id}|${score.revision.id}|${admission.destinationAnchorEventId}|${trailingRestEventId}|${nextRevisionId}|event|${eventIndex}|${event.sourceEventId}`)}`;
    if (occupied.has(destinationEventId) || planned.has(destinationEventId)) {
      throw new TeacherInsertAuthoringV4Error('Deterministic teacher insert event identity collides.', 'IDENTITY_COLLISION', { id: destinationEventId });
    }
    planned.add(destinationEventId);
    const notes = event.notes.map((note, noteIndex) => {
      const destinationNoteId = `insert-note:${fnv1a64(`${score.id}|${score.revision.id}|${admission.destinationAnchorEventId}|${trailingRestEventId}|${nextRevisionId}|note|${eventIndex}|${noteIndex}|${note.sourceNoteId}`)}`;
      if (occupied.has(destinationNoteId) || planned.has(destinationNoteId)) {
        throw new TeacherInsertAuthoringV4Error('Deterministic teacher insert note identity collides.', 'IDENTITY_COLLISION', { id: destinationNoteId });
      }
      planned.add(destinationNoteId);
      noteIdentityCount += 1;
      return Object.freeze({ sourceNoteId: note.sourceNoteId, destinationNoteId });
    });
    return Object.freeze({ sourceEventId: event.sourceEventId, destinationEventId, notes: Object.freeze(notes) });
  });
  if (events.length !== snapshot.eventCount || noteIdentityCount !== snapshot.noteCount) {
    throw new TeacherInsertAuthoringV4Error('Teacher insert identity counts diverged from snapshot.', 'SNAPSHOT_CONTENT_INVALID');
  }
  return Object.freeze({
    documentId: score.id,
    sourceRevisionId: score.revision.id,
    nextRevisionId,
    destinationAnchorEventId: admission.destinationAnchorEventId,
    trailingRestEventId,
    events: Object.freeze(events),
    eventIdentityCount: events.length,
    noteIdentityCount,
    relationIdentityCount: 0 as const,
    identityAllocationPerformed: false as const,
    canonicalMutationAuthority: false as const,
    historyMutationAuthority: false as const
  });
};

const buildInsertedEvent = (
  source: TeacherCopyEventSnapshotV4,
  identities: TeacherInsertEventIdentityV4,
  insertStart: Rational
): ScoreEvent => {
  if (source.sourceEventId !== identities.sourceEventId || source.notes.length !== identities.notes.length) {
    throw new TeacherInsertAuthoringV4Error('Teacher insert source/identity facts diverged.', 'SNAPSHOT_CONTENT_INVALID');
  }
  const onset = add(insertStart, source.onsetFromSegmentOrigin);
  const duration = Object.freeze({ ...source.duration });
  if (source.kind === 'rest') {
    if (source.notes.length !== 0) throw new TeacherInsertAuthoringV4Error('Rest snapshot carries notes.', 'SNAPSHOT_CONTENT_INVALID');
    return Object.freeze({ id: identities.destinationEventId, kind: 'rest' as const, onset, duration });
  }
  if (source.kind === 'note') {
    if (source.notes.length !== 1 || identities.notes.length !== 1) {
      throw new TeacherInsertAuthoringV4Error('Note snapshot identity count is invalid.', 'SNAPSHOT_CONTENT_INVALID');
    }
    const sourceNote = source.notes[0]!;
    const plannedNote = identities.notes[0]!;
    if (sourceNote.sourceNoteId !== plannedNote.sourceNoteId) {
      throw new TeacherInsertAuthoringV4Error('Teacher insert note identity diverged.', 'SNAPSHOT_CONTENT_INVALID');
    }
    return Object.freeze({
      id: identities.destinationEventId,
      kind: 'note' as const,
      onset,
      duration,
      note: Object.freeze({ id: plannedNote.destinationNoteId, pitch: Object.freeze({ ...sourceNote.pitch } as Pitch) })
    });
  }
  if (source.notes.length < 2) throw new TeacherInsertAuthoringV4Error('Chord snapshot is invalid.', 'SNAPSHOT_CONTENT_INVALID');
  return Object.freeze({
    id: identities.destinationEventId,
    kind: 'chord' as const,
    onset,
    duration,
    notes: Object.freeze(source.notes.map((note, noteIndex) => {
      const planned = identities.notes[noteIndex];
      if (planned === undefined || planned.sourceNoteId !== note.sourceNoteId) {
        throw new TeacherInsertAuthoringV4Error('Teacher insert chord note identity diverged.', 'SNAPSHOT_CONTENT_INVALID');
      }
      return Object.freeze({ id: planned.destinationNoteId, pitch: Object.freeze({ ...note.pitch } as Pitch) });
    }))
  });
};

const mutateScore = (
  score: ScoreDocumentV3,
  snapshot: TeacherCopySnapshotV4,
  admission: TeacherInsertAdmissionV4,
  identityPlan: TeacherInsertIdentityPlanV4
): Readonly<ScoreDocumentV3> => {
  const raw = structuredClone(score) as ScoreDocumentV3;
  const target = admission.destinationAnchor;
  const part = raw.parts.find(item => item.id === target.partId);
  const staff = part?.staves.find(item => item.id === target.staffId);
  if (staff === undefined || staff.role === 'tablature-linked') {
    throw new TeacherInsertAuthoringV4Error('Teacher insert destination staff is invalid.', 'DESTINATION_PATH_INVALID');
  }
  const measure = staff.measures.find(item => item.id === target.measureId && item.frameId === target.frameId);
  const voice = measure?.voices.find(item => item.id === target.voiceId);
  if (voice === undefined) throw new TeacherInsertAuthoringV4Error('Teacher insert destination voice is invalid.', 'DESTINATION_PATH_INVALID');
  const anchorIndex = voice.events.findIndex(event => event.id === admission.destinationAnchorEventId);
  if (anchorIndex < 0) throw new TeacherInsertAuthoringV4Error('Teacher insert anchor no longer exists.', 'DESTINATION_PATH_INVALID');
  const trailingIndex = voice.events.findIndex(event => event.id === admission.trailingRestPlan.restEventId);
  if (trailingIndex !== voice.events.length - 1 || trailingIndex <= anchorIndex) {
    throw new TeacherInsertAuthoringV4Error('Teacher insert trailing capacity rest moved.', 'DESTINATION_PATH_INVALID');
  }
  const sourceEvents = assertSnapshotRelationFree(snapshot);
  if (sourceEvents.length !== identityPlan.events.length) {
    throw new TeacherInsertAuthoringV4Error('Teacher insert source/identity event counts diverged.', 'SNAPSHOT_CONTENT_INVALID');
  }
  const inserted = sourceEvents.map((source, index) =>
    buildInsertedEvent(source, identityPlan.events[index]!, admission.insertStart));
  const shiftById = new Map(admission.suffixShift.map(item => [item.eventId, item] as const));
  const prefix = voice.events.slice(0, anchorIndex + 1);
  const suffix = voice.events.slice(anchorIndex + 1, trailingIndex).map(event => {
    const plan = shiftById.get(event.id);
    if (plan === undefined || !sameJson(event.onset, plan.sourceOnset)) {
      throw new TeacherInsertAuthoringV4Error('Teacher insert suffix shift plan no longer matches canonical timing.', 'DESTINATION_PATH_INVALID', { eventId: event.id });
    }
    return Object.freeze({ ...event, onset: Object.freeze({ ...plan.targetOnset }) }) as ScoreEvent;
  });
  if (suffix.length !== admission.suffixShift.length) {
    throw new TeacherInsertAuthoringV4Error('Teacher insert suffix shift coverage changed.', 'DESTINATION_PATH_INVALID');
  }
  const replacement: ScoreEvent[] = [...prefix, ...inserted, ...suffix];
  if (admission.trailingRestPlan.kind === 'SHRINK_TRAILING_REST_FORWARD') {
    replacement.push(Object.freeze({
      id: admission.trailingRestPlan.restEventId,
      kind: 'rest' as const,
      onset: Object.freeze({ ...admission.trailingRestPlan.targetOnset }),
      duration: Object.freeze({ ...admission.trailingRestPlan.targetDuration })
    }));
  }
  (voice.events as ScoreEvent[]).splice(0, voice.events.length, ...replacement);
  (raw as { revision: { id: string; parentId: string | null } }).revision = {
    id: identityPlan.nextRevisionId,
    parentId: score.revision.id
  };
  try {
    return createScoreDocumentV3(raw);
  } catch (error) {
    throw new TeacherInsertAuthoringV4Error(
      'Teacher insert score result failed canonical validation.',
      'RESULT_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

const buildNotation = (
  resultScore: ScoreDocumentV3,
  base: NotationDocumentV4,
  snapshot: TeacherCopySnapshotV4,
  admission: TeacherInsertAdmissionV4,
  identityPlan: TeacherInsertIdentityPlanV4
): Readonly<NotationDocumentV4> => {
  const removeTrailing = admission.trailingRestPlan.kind === 'REMOVE_TRAILING_REST';
  const eventEntries = base.events
    .filter(entry => !(removeTrailing && entry.target.eventId === admission.trailingRestPlan.restEventId))
    .map(entry => ({ target: rebind(resultScore, entry.target) as EventAddressV3, notation: entry.notation }));
  const noteEntries = base.notes.map(entry => ({ target: rebind(resultScore, entry.target) as typeof entry.target, notation: entry.notation }));
  const sourceEvents = assertSnapshotRelationFree(snapshot);
  sourceEvents.forEach((source, eventIndex) => {
    const plan = identityPlan.events[eventIndex]!;
    if (source.notation !== null) {
      eventEntries.push({
        target: addressEntityV3(resultScore, plan.destinationEventId) as EventAddressV3,
        notation: structuredClone(source.notation) as EventNotationV2
      });
    }
    source.notes.forEach((note, noteIndex) => {
      if (note.notation === null) return;
      const planned = plan.notes[noteIndex];
      if (planned === undefined || planned.sourceNoteId !== note.sourceNoteId) {
        throw new TeacherInsertAuthoringV4Error('Teacher insert note notation identity diverged.', 'SNAPSHOT_CONTENT_INVALID');
      }
      noteEntries.push({
        target: addressEntityV3(resultScore, planned.destinationNoteId) as typeof base.notes[number]['target'],
        notation: structuredClone(note.notation) as NoteNotation
      });
    });
  });
  try {
    return createNotationDocumentV4(resultScore, {
      contractVersion: '4.0.0',
      documentId: resultScore.id,
      revisionId: resultScore.revision.id,
      frames: base.frames.map(entry => ({ target: rebind(resultScore, entry.target) as typeof entry.target, notation: entry.notation })),
      measures: base.measures.map(entry => ({ target: rebind(resultScore, entry.target) as typeof entry.target, notation: entry.notation })),
      events: eventEntries,
      notes: noteEntries,
      graceEvents: base.graceEvents.map(entry => ({ target: rebind(resultScore, entry.target) as typeof entry.target, notation: entry.notation })),
      graceNotes: base.graceNotes.map(entry => ({ target: rebind(resultScore, entry.target) as typeof entry.target, notation: entry.notation })),
      crossStaffPlacements: base.crossStaffPlacements.map(entry => ({
        source: rebind(resultScore, entry.source) as EventAddressV3,
        displayStaffId: entry.displayStaffId
      }))
    });
  } catch (error) {
    if (error instanceof TeacherInsertAuthoringV4Error) throw error;
    throw new TeacherInsertAuthoringV4Error(
      'Teacher insert notation result failed canonical validation.',
      'NOTATION_RESULT_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

export const executeTeacherInsertAfterEventV4 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  snapshotInput: TeacherCopySnapshotV4,
  admissionInput: TeacherInsertAdmissionV4,
  nextRevisionId: string
): Readonly<TeacherInsertAuthoringV4Result> => {
  const score = createScoreDocumentV3(scoreInput);
  let notation: Readonly<NotationDocumentV4>;
  try {
    notation = createNotationDocumentV4(score, notationInput);
  } catch (error) {
    throw new TeacherInsertAuthoringV4Error(
      'Teacher insert source notation is stale or invalid.',
      'ADMISSION_STALE_OR_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  let admission: Readonly<TeacherInsertAdmissionV4>;
  try {
    admission = analyzeTeacherInsertAfterEventV4(score, notation, snapshotInput, admissionInput.destinationAnchor);
  } catch (error) {
    throw new TeacherInsertAuthoringV4Error(
      'Teacher insert admission no longer revalidates.',
      'ADMISSION_STALE_OR_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  if (!sameJson(admission, admissionInput)) {
    throw new TeacherInsertAuthoringV4Error('Teacher insert admission facts changed before mutation.', 'ADMISSION_STALE_OR_INVALID');
  }
  const identityPlan = planIdentities(score, snapshotInput, admission, nextRevisionId);
  const resultScore = mutateScore(score, snapshotInput, admission, identityPlan);
  const resultNotation = buildNotation(resultScore, notation, snapshotInput, admission, identityPlan);
  const insertedEventIds = Object.freeze(identityPlan.events.map(item => item.destinationEventId));
  const insertedNoteIds = Object.freeze(identityPlan.events.flatMap(item => item.notes.map(note => note.destinationNoteId)));
  const first = insertedEventIds[0];
  if (first === undefined) throw new TeacherInsertAuthoringV4Error('Teacher insert result has no inserted event.', 'RESULT_INVALID');
  const selection = addressEntityV3(resultScore, first);
  if (selection.kind !== 'event') throw new TeacherInsertAuthoringV4Error('Teacher insert selection did not resolve as event.', 'RESULT_INVALID');
  return Object.freeze({
    version: EDITOR_TEACHER_INSERT_AUTHORING_V4_VERSION,
    score: resultScore,
    notation: resultNotation,
    selection,
    admission,
    identityPlan,
    suffixShift: admission.suffixShift,
    trailingRestPlan: admission.trailingRestPlan,
    insertedEventIds,
    insertedNoteIds,
    historyMutationAuthority: false as const
  });
};
