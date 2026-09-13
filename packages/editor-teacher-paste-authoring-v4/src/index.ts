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
import type { Rational, ScoreEvent } from '../../score-model/src/index.js';
import type {
  TeacherCopyEventSnapshotV4,
  TeacherCopySnapshotV4
} from '../../editor-teacher-copy-snapshot-v4/src/index.js';
import {
  analyzeTeacherPasteDestinationV4,
  type TeacherPasteAdmissionV4,
  type TeacherPasteRestPlanV4
} from '../../editor-teacher-paste-admission-v4/src/index.js';
import {
  planTeacherPasteIdentitiesV4,
  type TeacherPasteEventIdentityPlanV4,
  type TeacherPasteIdentityPlanV4
} from '../../editor-teacher-paste-identity-plan-v4/src/index.js';

export const EDITOR_TEACHER_PASTE_AUTHORING_V4_VERSION = '1.0.0' as const;

export interface TeacherPasteAuthoringV4Result {
  readonly version: typeof EDITOR_TEACHER_PASTE_AUTHORING_V4_VERSION;
  readonly score: Readonly<ScoreDocumentV3>;
  readonly notation: Readonly<NotationDocumentV4>;
  readonly selection: EventAddressV3;
  readonly admission: Readonly<TeacherPasteAdmissionV4>;
  readonly identityPlan: Readonly<TeacherPasteIdentityPlanV4>;
  readonly restPlan: Readonly<TeacherPasteRestPlanV4>;
  readonly insertedEventIds: readonly string[];
  readonly insertedNoteIds: readonly string[];
  readonly historyMutationAuthority: false;
}

export type TeacherPasteAuthoringV4ErrorCode =
  | 'ADMISSION_STALE_OR_INVALID'
  | 'IDENTITY_PLAN_STALE_OR_INVALID'
  | 'DESTINATION_PATH_INVALID'
  | 'SNAPSHOT_CONTENT_INVALID'
  | 'RESULT_INVALID'
  | 'NOTATION_RESULT_INVALID';

export class TeacherPasteAuthoringV4Error extends Error {
  readonly code: TeacherPasteAuthoringV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(
    message: string,
    code: TeacherPasteAuthoringV4ErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'TeacherPasteAuthoringV4Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const gcd = (left: bigint, right: bigint): bigint => {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a === 0n ? 1n : a;
};

const rational = (numerator: bigint, denominator: bigint): Readonly<Rational> => {
  if (numerator < 0n || denominator <= 0n) {
    throw new TeacherPasteAuthoringV4Error('Teacher paste result produced invalid timing.', 'RESULT_INVALID');
  }
  const divisor = gcd(numerator, denominator);
  const n = numerator / divisor;
  const d = denominator / divisor;
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (n > max || d > max) {
    throw new TeacherPasteAuthoringV4Error('Teacher paste result timing exceeded exact safe-integer range.', 'RESULT_INVALID');
  }
  return Object.freeze({ numerator: Number(n), denominator: Number(d) });
};

const add = (left: Rational, right: Rational): Readonly<Rational> => rational(
  BigInt(left.numerator) * BigInt(right.denominator) +
    BigInt(right.numerator) * BigInt(left.denominator),
  BigInt(left.denominator) * BigInt(right.denominator)
);

const sameJson = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

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
    throw new TeacherPasteAuthoringV4Error(
      'Teacher paste result changed semantic target kind during notation rebind.',
      'NOTATION_RESULT_INVALID',
      { targetId: targetId(address), expectedKind: address.kind, observedKind: rebound.kind }
    );
  }
  return rebound;
};

const buildCopiedEvent = (
  source: TeacherCopyEventSnapshotV4,
  identities: TeacherPasteEventIdentityPlanV4,
  pasteStart: Rational
): ScoreEvent => {
  if (source.sourceEventId !== identities.sourceEventId || source.notes.length !== identities.notes.length) {
    throw new TeacherPasteAuthoringV4Error(
      'Teacher paste source content no longer matches its deterministic identity plan.',
      'SNAPSHOT_CONTENT_INVALID',
      { sourceEventId: source.sourceEventId }
    );
  }
  const onset = add(pasteStart, source.onsetFromSegmentOrigin);
  const duration = Object.freeze({ ...source.duration });
  if (source.kind === 'rest') {
    if (source.notes.length !== 0) {
      throw new TeacherPasteAuthoringV4Error('Rest snapshot unexpectedly carries note content.', 'SNAPSHOT_CONTENT_INVALID');
    }
    return Object.freeze({ id: identities.destinationEventId, kind: 'rest' as const, onset, duration });
  }
  if (source.kind === 'note') {
    if (source.notes.length !== 1 || identities.notes.length !== 1) {
      throw new TeacherPasteAuthoringV4Error('Note snapshot must carry exactly one note identity.', 'SNAPSHOT_CONTENT_INVALID');
    }
    const note = source.notes[0]!;
    const planned = identities.notes[0]!;
    if (note.sourceNoteId !== planned.sourceNoteId) {
      throw new TeacherPasteAuthoringV4Error('Note source identity no longer matches its paste plan.', 'SNAPSHOT_CONTENT_INVALID');
    }
    return Object.freeze({
      id: identities.destinationEventId,
      kind: 'note' as const,
      onset,
      duration,
      note: Object.freeze({ id: planned.destinationNoteId, pitch: Object.freeze({ ...note.pitch }) })
    });
  }
  if (source.notes.length < 2) {
    throw new TeacherPasteAuthoringV4Error('Chord snapshot must carry at least two notes.', 'SNAPSHOT_CONTENT_INVALID');
  }
  return Object.freeze({
    id: identities.destinationEventId,
    kind: 'chord' as const,
    onset,
    duration,
    notes: Object.freeze(source.notes.map((note, index) => {
      const planned = identities.notes[index]!;
      if (planned === undefined || planned.sourceNoteId !== note.sourceNoteId) {
        throw new TeacherPasteAuthoringV4Error('Chord note identity no longer matches its paste plan.', 'SNAPSHOT_CONTENT_INVALID');
      }
      return Object.freeze({ id: planned.destinationNoteId, pitch: Object.freeze({ ...note.pitch }) });
    }))
  });
};

const mutateScore = (
  score: ScoreDocumentV3,
  snapshot: TeacherCopySnapshotV4,
  admission: TeacherPasteAdmissionV4,
  identityPlan: TeacherPasteIdentityPlanV4
): Readonly<ScoreDocumentV3> => {
  const raw = structuredClone(score) as ScoreDocumentV3;
  const destination = admission.destination;
  const part = raw.parts.find(item => item.id === destination.partId);
  const staff = part?.staves.find(item => item.id === destination.staffId);
  if (staff === undefined || staff.role === 'tablature-linked') {
    throw new TeacherPasteAuthoringV4Error('Teacher paste destination staff is invalid.', 'DESTINATION_PATH_INVALID');
  }
  const measure = staff.measures.find(item => item.id === destination.measureId && item.frameId === destination.frameId);
  const voice = measure?.voices.find(item => item.id === destination.voiceId);
  if (voice === undefined) {
    throw new TeacherPasteAuthoringV4Error('Teacher paste destination voice is invalid.', 'DESTINATION_PATH_INVALID');
  }
  const destinationIndex = voice.events.findIndex(item => item.id === admission.destinationRestEventId);
  if (destinationIndex < 0 || voice.events[destinationIndex]?.kind !== 'rest') {
    throw new TeacherPasteAuthoringV4Error('Admitted destination rest no longer exists.', 'DESTINATION_PATH_INVALID');
  }
  const sourceEvents = snapshot.segments[0]?.events;
  if (sourceEvents === undefined || sourceEvents.length !== identityPlan.events.length) {
    throw new TeacherPasteAuthoringV4Error('Teacher paste source/identity event counts diverged.', 'SNAPSHOT_CONTENT_INVALID');
  }
  const inserted = sourceEvents.map((source, index) =>
    buildCopiedEvent(source, identityPlan.events[index]!, admission.pasteStart));
  const replacement: ScoreEvent[] = [...inserted];
  if (admission.restPlan.kind === 'SHRINK_DESTINATION_REST_FORWARD') {
    replacement.push(Object.freeze({
      id: admission.destinationRestEventId,
      kind: 'rest' as const,
      onset: Object.freeze({ ...admission.restPlan.residualOnset }),
      duration: Object.freeze({ ...admission.restPlan.residualDuration })
    }));
  }
  (voice.events as ScoreEvent[]).splice(destinationIndex, 1, ...replacement);
  (raw as { revision: { id: string; parentId: string | null } }).revision = {
    id: identityPlan.nextRevisionId,
    parentId: score.revision.id
  };
  try {
    return createScoreDocumentV3(raw);
  } catch (error) {
    throw new TeacherPasteAuthoringV4Error(
      'Teacher paste score result failed canonical validation.',
      'RESULT_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

const buildNotation = (
  resultScore: ScoreDocumentV3,
  base: NotationDocumentV4,
  snapshot: TeacherCopySnapshotV4,
  admission: TeacherPasteAdmissionV4,
  identityPlan: TeacherPasteIdentityPlanV4
): Readonly<NotationDocumentV4> => {
  const removedDestination = admission.restPlan.kind === 'REMOVE_DESTINATION_REST';
  const eventEntries = base.events
    .filter(entry => !(removedDestination && entry.target.eventId === admission.destinationRestEventId))
    .map(entry => ({
      target: rebind(resultScore, entry.target) as EventAddressV3,
      notation: entry.notation
    }));
  const noteEntries = base.notes.map(entry => ({
    target: rebind(resultScore, entry.target) as typeof entry.target,
    notation: entry.notation
  }));
  const sourceEvents = snapshot.segments[0]?.events;
  if (sourceEvents === undefined || sourceEvents.length !== identityPlan.events.length) {
    throw new TeacherPasteAuthoringV4Error('Teacher paste notation source/identity counts diverged.', 'SNAPSHOT_CONTENT_INVALID');
  }
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
        throw new TeacherPasteAuthoringV4Error('Teacher paste note notation identity plan diverged.', 'SNAPSHOT_CONTENT_INVALID');
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
      frames: base.frames.map(entry => ({
        target: rebind(resultScore, entry.target) as typeof entry.target,
        notation: entry.notation
      })),
      measures: base.measures.map(entry => ({
        target: rebind(resultScore, entry.target) as typeof entry.target,
        notation: entry.notation
      })),
      events: eventEntries,
      notes: noteEntries,
      graceEvents: base.graceEvents.map(entry => ({
        target: rebind(resultScore, entry.target) as typeof entry.target,
        notation: entry.notation
      })),
      graceNotes: base.graceNotes.map(entry => ({
        target: rebind(resultScore, entry.target) as typeof entry.target,
        notation: entry.notation
      })),
      crossStaffPlacements: base.crossStaffPlacements.map(entry => ({
        source: rebind(resultScore, entry.source) as EventAddressV3,
        displayStaffId: entry.displayStaffId
      }))
    });
  } catch (error) {
    if (error instanceof TeacherPasteAuthoringV4Error) throw error;
    throw new TeacherPasteAuthoringV4Error(
      'Teacher paste notation result failed canonical validation.',
      'NOTATION_RESULT_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

export const executeTeacherPasteOverwriteV4 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  snapshotInput: TeacherCopySnapshotV4,
  admissionInput: TeacherPasteAdmissionV4,
  identityPlanInput: TeacherPasteIdentityPlanV4
): Readonly<TeacherPasteAuthoringV4Result> => {
  const score = createScoreDocumentV3(scoreInput);
  let notation: Readonly<NotationDocumentV4>;
  try {
    notation = createNotationDocumentV4(score, notationInput);
  } catch (error) {
    throw new TeacherPasteAuthoringV4Error(
      'Teacher paste source notation is stale or invalid.',
      'ADMISSION_STALE_OR_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  let admission: Readonly<TeacherPasteAdmissionV4>;
  try {
    admission = analyzeTeacherPasteDestinationV4(score, notation, snapshotInput, admissionInput.destination);
  } catch (error) {
    throw new TeacherPasteAuthoringV4Error(
      'Teacher paste admission no longer revalidates.',
      'ADMISSION_STALE_OR_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  if (!sameJson(admission, admissionInput)) {
    throw new TeacherPasteAuthoringV4Error('Teacher paste admission facts changed before mutation.', 'ADMISSION_STALE_OR_INVALID');
  }
  let identityPlan: Readonly<TeacherPasteIdentityPlanV4>;
  try {
    identityPlan = planTeacherPasteIdentitiesV4(
      score,
      notation,
      snapshotInput,
      admission,
      identityPlanInput.nextRevisionId
    );
  } catch (error) {
    throw new TeacherPasteAuthoringV4Error(
      'Teacher paste identity plan no longer revalidates.',
      'IDENTITY_PLAN_STALE_OR_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  if (!sameJson(identityPlan, identityPlanInput)) {
    throw new TeacherPasteAuthoringV4Error('Teacher paste identity plan facts changed before mutation.', 'IDENTITY_PLAN_STALE_OR_INVALID');
  }

  const resultScore = mutateScore(score, snapshotInput, admission, identityPlan);
  const resultNotation = buildNotation(resultScore, notation, snapshotInput, admission, identityPlan);
  const insertedEventIds = Object.freeze(identityPlan.events.map(item => item.destinationEventId));
  const insertedNoteIds = Object.freeze(identityPlan.events.flatMap(item => item.notes.map(note => note.destinationNoteId)));
  const first = insertedEventIds[0];
  if (first === undefined) {
    throw new TeacherPasteAuthoringV4Error('Teacher paste result contains no inserted event.', 'RESULT_INVALID');
  }
  const selection = addressEntityV3(resultScore, first);
  if (selection.kind !== 'event') {
    throw new TeacherPasteAuthoringV4Error('Teacher paste first inserted identity did not resolve as event.', 'RESULT_INVALID');
  }
  return Object.freeze({
    version: EDITOR_TEACHER_PASTE_AUTHORING_V4_VERSION,
    score: resultScore,
    notation: resultNotation,
    selection,
    admission,
    identityPlan,
    restPlan: admission.restPlan,
    insertedEventIds,
    insertedNoteIds,
    historyMutationAuthority: false as const
  });
};
