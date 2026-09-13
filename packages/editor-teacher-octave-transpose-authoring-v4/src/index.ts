import {
  addressEntityV3,
  type EventAddressV3,
  type SemanticAddressV3
} from '../../addressing-v3/src/index.js';
import {
  createNotationDocumentV4,
  type NotationDocumentV4
} from '../../notation-structure-v4/src/index.js';
import {
  createScoreDocumentV3,
  type ScoreDocumentV3
} from '../../score-model-v3/src/index.js';
import type { Pitch, ScoreEvent } from '../../score-model/src/index.js';
import type { TeacherEventSpanSelectionV4 } from '../../editor-teacher-event-span-v4/src/index.js';
import {
  analyzeTeacherOctaveTransposeV4,
  type TeacherOctaveTransposeAdmissionV4
} from '../../editor-teacher-octave-transpose-admission-v4/src/index.js';

export const EDITOR_TEACHER_OCTAVE_TRANSPOSE_AUTHORING_V4_VERSION = '1.0.0' as const;

export interface TeacherOctaveTransposeAuthoringV4Options {
  readonly nextRevisionId: string;
}

export interface TeacherOctaveTransposeAuthoringV4Result {
  readonly version: typeof EDITOR_TEACHER_OCTAVE_TRANSPOSE_AUTHORING_V4_VERSION;
  readonly score: Readonly<ScoreDocumentV3>;
  readonly notation: Readonly<NotationDocumentV4>;
  readonly selection: EventAddressV3;
  readonly admission: Readonly<TeacherOctaveTransposeAdmissionV4>;
  readonly changedEventIds: readonly string[];
  readonly changedNoteIds: readonly string[];
  readonly historyMutationAuthority: false;
}

export type TeacherOctaveTransposeAuthoringV4ErrorCode =
  | 'INVALID_REVISION_ID'
  | 'ADMISSION_STALE_OR_INVALID'
  | 'TARGET_PLAN_INVALID'
  | 'RESULT_INVALID'
  | 'NOTATION_RESULT_INVALID';

export class TeacherOctaveTransposeAuthoringV4Error extends Error {
  readonly code: TeacherOctaveTransposeAuthoringV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(
    message: string,
    code: TeacherOctaveTransposeAuthoringV4ErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'TeacherOctaveTransposeAuthoringV4Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const sameJson = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);
const samePitch = (left: Pitch, right: Pitch): boolean =>
  left.step === right.step && left.alter === right.alter && left.octave === right.octave;

const assertFreshRevision = (score: ScoreDocumentV3, nextRevisionId: string): void => {
  if (
    !ID.test(nextRevisionId) ||
    nextRevisionId === score.revision.id ||
    nextRevisionId === score.revision.parentId
  ) {
    throw new TeacherOctaveTransposeAuthoringV4Error(
      'Teacher octave transpose requires a fresh stable revision id distinct from current and immediate parent revisions.',
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
  try {
    const rebound = addressEntityV3(score, targetId(address));
    if (rebound.kind !== address.kind) throw new Error('semantic kind changed');
    return rebound;
  } catch (error) {
    throw new TeacherOctaveTransposeAuthoringV4Error(
      'Teacher octave transpose result would orphan existing notation.',
      'NOTATION_RESULT_INVALID',
      { targetId: targetId(address), targetKind: address.kind, cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

const mutateScore = (
  score: ScoreDocumentV3,
  admission: TeacherOctaveTransposeAdmissionV4,
  nextRevisionId: string
): Readonly<{ score: Readonly<ScoreDocumentV3>; changedEventIds: readonly string[]; changedNoteIds: readonly string[] }> => {
  const plans = new Map(admission.targetNotePlans.map(plan => [plan.noteId, plan]));
  const seen = new Set<string>();
  const changedEvents = new Set<string>();
  const raw = structuredClone(score) as ScoreDocumentV3;

  for (const part of raw.parts) for (const staff of part.staves) {
    if (staff.role === 'tablature-linked') continue;
    for (const measure of staff.measures) for (const voice of measure.voices) {
      const nextEvents = voice.events.map((event): ScoreEvent => {
        if (event.kind === 'rest') return event;
        if (event.kind === 'note') {
          const plan = plans.get(event.note.id);
          if (plan === undefined) return event;
          if (plan.eventId !== event.id || !samePitch(event.note.pitch, plan.sourcePitch)) {
            throw new TeacherOctaveTransposeAuthoringV4Error(
              'Teacher octave transpose note plan no longer matches canonical source pitch/path.',
              'TARGET_PLAN_INVALID',
              { eventId: event.id, noteId: event.note.id }
            );
          }
          seen.add(event.note.id);
          changedEvents.add(event.id);
          return { ...event, note: { ...event.note, pitch: { ...plan.targetPitch } } };
        }
        let changed = false;
        const notes = event.notes.map(note => {
          const plan = plans.get(note.id);
          if (plan === undefined) return note;
          if (plan.eventId !== event.id || !samePitch(note.pitch, plan.sourcePitch)) {
            throw new TeacherOctaveTransposeAuthoringV4Error(
              'Teacher octave transpose chord-tone plan no longer matches canonical source pitch/path.',
              'TARGET_PLAN_INVALID',
              { eventId: event.id, noteId: note.id }
            );
          }
          seen.add(note.id);
          changed = true;
          return { ...note, pitch: { ...plan.targetPitch } };
        });
        if (!changed) return event;
        changedEvents.add(event.id);
        return { ...event, notes };
      });
      (voice as { events: readonly ScoreEvent[] }).events = nextEvents;
    }
  }

  if (seen.size !== plans.size || [...plans.keys()].some(noteId => !seen.has(noteId))) {
    throw new TeacherOctaveTransposeAuthoringV4Error(
      'Teacher octave transpose could not apply every admitted note plan exactly once.',
      'TARGET_PLAN_INVALID',
      { expected: plans.size, applied: seen.size }
    );
  }

  (raw as { revision: { id: string; parentId: string | null } }).revision = {
    id: nextRevisionId,
    parentId: score.revision.id
  };
  let result: Readonly<ScoreDocumentV3>;
  try {
    result = createScoreDocumentV3(raw);
  } catch (error) {
    throw new TeacherOctaveTransposeAuthoringV4Error(
      'Teacher octave transpose score result failed canonical validation.',
      'RESULT_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  return Object.freeze({
    score: result,
    changedEventIds: Object.freeze([...changedEvents]),
    changedNoteIds: Object.freeze([...seen])
  });
};

const rebindNotation = (
  score: ScoreDocumentV3,
  notation: NotationDocumentV4
): Readonly<NotationDocumentV4> => {
  try {
    return createNotationDocumentV4(score, {
      contractVersion: '4.0.0',
      documentId: score.id,
      revisionId: score.revision.id,
      frames: notation.frames.map(entry => ({ target: rebind(score, entry.target) as typeof entry.target, notation: entry.notation })),
      measures: notation.measures.map(entry => ({ target: rebind(score, entry.target) as typeof entry.target, notation: entry.notation })),
      events: notation.events.map(entry => ({ target: rebind(score, entry.target) as typeof entry.target, notation: entry.notation })),
      notes: notation.notes.map(entry => ({ target: rebind(score, entry.target) as typeof entry.target, notation: entry.notation })),
      graceEvents: notation.graceEvents.map(entry => ({ target: rebind(score, entry.target) as typeof entry.target, notation: entry.notation })),
      graceNotes: notation.graceNotes.map(entry => ({ target: rebind(score, entry.target) as typeof entry.target, notation: entry.notation })),
      crossStaffPlacements: notation.crossStaffPlacements.map(entry => ({
        source: rebind(score, entry.source) as EventAddressV3,
        displayStaffId: entry.displayStaffId
      }))
    });
  } catch (error) {
    if (error instanceof TeacherOctaveTransposeAuthoringV4Error) throw error;
    throw new TeacherOctaveTransposeAuthoringV4Error(
      'Teacher octave transpose notation result failed canonical validation.',
      'NOTATION_RESULT_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

export const executeTeacherOctaveTransposeV4 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  selection: TeacherEventSpanSelectionV4,
  admissionInput: TeacherOctaveTransposeAdmissionV4,
  options: TeacherOctaveTransposeAuthoringV4Options
): Readonly<TeacherOctaveTransposeAuthoringV4Result> => {
  const score = createScoreDocumentV3(scoreInput);
  let notation: Readonly<NotationDocumentV4>;
  try {
    notation = createNotationDocumentV4(score, notationInput);
  } catch (error) {
    throw new TeacherOctaveTransposeAuthoringV4Error(
      'Teacher octave transpose source notation is stale or invalid.',
      'ADMISSION_STALE_OR_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  assertFreshRevision(score, options.nextRevisionId);

  let admission: Readonly<TeacherOctaveTransposeAdmissionV4>;
  try {
    admission = analyzeTeacherOctaveTransposeV4(score, notation, selection, admissionInput.octaveDelta);
  } catch (error) {
    throw new TeacherOctaveTransposeAuthoringV4Error(
      'Teacher octave transpose admission no longer revalidates.',
      'ADMISSION_STALE_OR_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  if (!sameJson(admission, admissionInput)) {
    throw new TeacherOctaveTransposeAuthoringV4Error(
      'Teacher octave transpose admission facts changed or were tampered with before mutation.',
      'ADMISSION_STALE_OR_INVALID'
    );
  }

  const mutation = mutateScore(score, admission, options.nextRevisionId);
  const resultNotation = rebindNotation(mutation.score, notation);
  const firstEventId = admission.targetEventIds[0];
  if (firstEventId === undefined) {
    throw new TeacherOctaveTransposeAuthoringV4Error('Teacher octave transpose result has no selected event.', 'RESULT_INVALID');
  }
  const selected = addressEntityV3(mutation.score, firstEventId);
  if (selected.kind !== 'event') {
    throw new TeacherOctaveTransposeAuthoringV4Error('Teacher octave transpose selection no longer resolves as event.', 'RESULT_INVALID');
  }

  return Object.freeze({
    version: EDITOR_TEACHER_OCTAVE_TRANSPOSE_AUTHORING_V4_VERSION,
    score: mutation.score,
    notation: resultNotation,
    selection: selected,
    admission,
    changedEventIds: mutation.changedEventIds,
    changedNoteIds: mutation.changedNoteIds,
    historyMutationAuthority: false as const
  });
};
