import {
  addressEntityV3,
  resolveSemanticAddressV3,
  type EventAddressV3,
  type SemanticAddressV3
} from '../../addressing-v3/src/index.js';
import {
  createScoreDocumentV3,
  type ScoreDocumentV3
} from '../../score-model-v3/src/index.js';
import type { Pitch, ScoreEvent } from '../../score-model/src/index.js';
import {
  createNotationDocumentV4,
  type NotationDocumentV4
} from '../../notation-structure-v4/src/index.js';
import {
  createEventSetProfessionalSelectionV1,
  createEventSpanProfessionalSelectionV1,
  type EventSetProfessionalSelectionV1,
  type EventSpanProfessionalSelectionV1,
  type ProfessionalSelectionV1
} from '../../editor-professional-selection-v1/src/index.js';
import {
  createTeacherEventSpanSelectionV4,
  type TeacherEventSpanSelectionV4
} from '../../editor-teacher-event-span-v4/src/index.js';
import {
  analyzeTeacherOctaveTransposeV4,
  type TeacherOctaveDeltaV4,
  type TeacherOctaveTransposeAdmissionV4,
  type TeacherOctaveTransposeNotePlanV4
} from '../../editor-teacher-octave-transpose-admission-v4/src/index.js';
import {
  executeTeacherOctaveTransposeV4,
  type TeacherOctaveTransposeAuthoringV4Options
} from '../../editor-teacher-octave-transpose-authoring-v4/src/index.js';

export const EDITOR_PROFESSIONAL_OCTAVE_TRANSPOSE_V1_VERSION = '1.1.0' as const;

interface ProfessionalOctaveTransposeAdmissionBaseV1 {
  readonly version: typeof EDITOR_PROFESSIONAL_OCTAVE_TRANSPOSE_V1_VERSION;
  readonly kind: 'PROFESSIONAL_OCTAVE_TRANSPOSE_ADMISSION';
  readonly admitted: true;
  readonly sourceRevisionId: string;
  readonly octaveDelta: TeacherOctaveDeltaV4;
  readonly targetEventIds: readonly string[];
  readonly canonicalMutationAuthority: false;
  readonly historyMutationAuthority: false;
}

export interface ProfessionalSpanOctaveTransposeAdmissionV1 extends ProfessionalOctaveTransposeAdmissionBaseV1 {
  readonly selectionKind: 'EVENT_SPAN';
  readonly teacherAdmission: Readonly<TeacherOctaveTransposeAdmissionV4>;
}

export interface ProfessionalEventSetOctaveTransposeAdmissionV1 extends ProfessionalOctaveTransposeAdmissionBaseV1 {
  readonly selectionKind: 'EVENT_SET';
  readonly targetNotePlans: readonly TeacherOctaveTransposeNotePlanV4[];
  readonly selectedEventCount: number;
  readonly pitchedEventCount: number;
  readonly restEventCount: number;
  readonly noteCount: number;
  readonly preservesStepAndAlter: true;
  readonly relationRemappingRequired: false;
}

export type ProfessionalOctaveTransposeAdmissionV1 =
  | ProfessionalSpanOctaveTransposeAdmissionV1
  | ProfessionalEventSetOctaveTransposeAdmissionV1;

export interface ProfessionalOctaveTransposeResultV1 {
  readonly version: typeof EDITOR_PROFESSIONAL_OCTAVE_TRANSPOSE_V1_VERSION;
  readonly score: Readonly<ScoreDocumentV3>;
  readonly notation: Readonly<NotationDocumentV4>;
  readonly selection: Readonly<ProfessionalSelectionV1>;
  readonly changedEventIds: readonly string[];
  readonly changedNoteIds: readonly string[];
  readonly admission: Readonly<ProfessionalOctaveTransposeAdmissionV1>;
  readonly historyMutationAuthority: false;
}

export type ProfessionalOctaveTransposeV1ErrorCode =
  | 'SELECTION_STALE_OR_TAMPERED'
  | 'SPAN_ADAPTER_REJECTED'
  | 'ADMISSION_REJECTED'
  | 'ADMISSION_STALE_OR_TAMPERED'
  | 'AUTHORING_REJECTED'
  | 'INVALID_OCTAVE_DELTA'
  | 'NO_PITCHED_TARGETS'
  | 'TIE_RELATION_UNSUPPORTED'
  | 'GRACE_RELATION_UNSUPPORTED'
  | 'PITCH_RANGE_EXCEEDED'
  | 'INVALID_REVISION_ID'
  | 'TARGET_PLAN_INVALID'
  | 'RESULT_INVALID'
  | 'NOTATION_RESULT_INVALID'
  | 'RESULT_SELECTION_INVALID';

export class ProfessionalOctaveTransposeV1Error extends Error {
  readonly code: ProfessionalOctaveTransposeV1ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: ProfessionalOctaveTransposeV1ErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ProfessionalOctaveTransposeV1Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const sameJson = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);
const samePitch = (left: Pitch, right: Pitch): boolean =>
  left.step === right.step && left.alter === right.alter && left.octave === right.octave;
const freezePitch = (pitch: Pitch): Pitch => Object.freeze({ ...pitch });

const parseDelta = (value: unknown): TeacherOctaveDeltaV4 => {
  if (value !== -2 && value !== -1 && value !== 1 && value !== 2) {
    throw new ProfessionalOctaveTransposeV1Error(
      'Professional octave transpose supports only -2, -1, +1 or +2 octaves.',
      'INVALID_OCTAVE_DELTA',
      { value }
    );
  }
  return value;
};

const selectionFacts = (selection: ProfessionalSelectionV1): unknown =>
  selection.kind === 'EVENT_SPAN'
    ? {
        version: selection.version,
        kind: selection.kind,
        anchorEventId: selection.anchor.eventId,
        focusEventId: selection.focus.eventId,
        direction: selection.direction,
        scope: selection.scope,
        targetEventIds: selection.targets.map(target => target.eventId)
      }
    : {
        version: selection.version,
        kind: selection.kind,
        primaryEventId: selection.primary.eventId,
        scope: selection.scope,
        targetEventIds: selection.targets.map(target => target.eventId)
      };

const requireCurrentSelection = (
  score: ScoreDocumentV3,
  selection: ProfessionalSelectionV1
): Readonly<ProfessionalSelectionV1> => {
  let current: Readonly<ProfessionalSelectionV1>;
  try {
    if (selection.kind === 'EVENT_SPAN') {
      current = createEventSpanProfessionalSelectionV1(score, selection.anchor, selection.focus);
    } else {
      const explicit = [
        selection.primary,
        ...selection.targets.filter(target => target.eventId !== selection.primary.eventId)
      ];
      current = createEventSetProfessionalSelectionV1(score, explicit);
    }
  } catch (error) {
    throw new ProfessionalOctaveTransposeV1Error(
      'Professional octave-transpose selection no longer resolves against the current score revision.',
      'SELECTION_STALE_OR_TAMPERED',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  if (!sameJson(selectionFacts(current), selectionFacts(selection))) {
    throw new ProfessionalOctaveTransposeV1Error(
      'Professional octave-transpose selection facts changed or were tampered with.',
      'SELECTION_STALE_OR_TAMPERED'
    );
  }
  return current;
};

const teacherSpanFor = (
  score: ScoreDocumentV3,
  selection: EventSpanProfessionalSelectionV1
): Readonly<TeacherEventSpanSelectionV4> => {
  const first = selection.targets[0];
  const last = selection.targets.at(-1);
  if (first === undefined || last === undefined) {
    throw new ProfessionalOctaveTransposeV1Error(
      'Professional event span has no canonical target boundaries.',
      'SPAN_ADAPTER_REJECTED'
    );
  }

  let teacher: Readonly<TeacherEventSpanSelectionV4>;
  try {
    teacher = createTeacherEventSpanSelectionV4(score, first, last);
  } catch (error) {
    throw new ProfessionalOctaveTransposeV1Error(
      'Professional event span is outside the proven teacher bulk-authoring admission profile.',
      'SPAN_ADAPTER_REJECTED',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  const professionalIds = selection.targets.map(target => target.eventId);
  const teacherIds = teacher.targets.map(target => target.eventId);
  if (!sameJson(professionalIds, teacherIds)) {
    throw new ProfessionalOctaveTransposeV1Error(
      'Teacher span adapter would change the exact professional selection target set.',
      'SPAN_ADAPTER_REJECTED',
      { professionalIds, teacherIds }
    );
  }
  return teacher;
};

const selectedEvent = (score: ScoreDocumentV3, target: EventAddressV3): ScoreEvent => {
  try {
    const resolved = resolveSemanticAddressV3(score, target);
    if (resolved.kind !== 'event') throw new Error('target is not event');
    return resolved.value;
  } catch (error) {
    throw new ProfessionalOctaveTransposeV1Error(
      'Professional event-set target no longer resolves as an event.',
      'SELECTION_STALE_OR_TAMPERED',
      { eventId: target.eventId, cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

const graceAnchoredEventIds = (score: ScoreDocumentV3): ReadonlySet<string> => {
  const ids = new Set<string>();
  for (const part of score.parts) for (const staff of part.staves) {
    if (staff.role === 'tablature-linked') continue;
    for (const measure of staff.measures) for (const voice of measure.voices) {
      for (const group of voice.graceGroups) ids.add(group.anchorEventId);
    }
  }
  return ids;
};

const noteAtoms = (event: ScoreEvent) =>
  event.kind === 'note' ? [event.note] : event.kind === 'chord' ? [...event.notes] : [];

const analyzeEventSet = (
  score: ScoreDocumentV3,
  notation: NotationDocumentV4,
  selection: EventSetProfessionalSelectionV1,
  octaveDeltaInput: TeacherOctaveDeltaV4
): Readonly<ProfessionalEventSetOctaveTransposeAdmissionV1> => {
  const delta = parseDelta(octaveDeltaInput);
  const anchored = graceAnchoredEventIds(score);
  const noteNotation = new Map(notation.notes.map(entry => [entry.target.noteId, entry.notation]));
  const targetNotePlans: TeacherOctaveTransposeNotePlanV4[] = [];
  let pitchedEventCount = 0;
  let restEventCount = 0;

  for (const target of selection.targets) {
    const event = selectedEvent(score, target);
    if (event.kind === 'rest') {
      restEventCount += 1;
      continue;
    }
    if (anchored.has(event.id)) {
      throw new ProfessionalOctaveTransposeV1Error(
        'Discontiguous octave transpose does not leave anchored grace content at the old octave.',
        'GRACE_RELATION_UNSUPPORTED',
        { eventId: event.id }
      );
    }
    pitchedEventCount += 1;
    for (const note of noteAtoms(event)) {
      const notationForNote = noteNotation.get(note.id);
      if (notationForNote !== undefined && notationForNote.ties.length > 0) {
        throw new ProfessionalOctaveTransposeV1Error(
          'Discontiguous octave transpose requires tie-free selected notes until relation closure is implemented.',
          'TIE_RELATION_UNSUPPORTED',
          { eventId: event.id, noteId: note.id }
        );
      }
      const targetOctave = note.pitch.octave + delta;
      if (targetOctave < -1 || targetOctave > 9) {
        throw new ProfessionalOctaveTransposeV1Error(
          'Professional event-set transpose would move a pitch outside the canonical pitch range.',
          'PITCH_RANGE_EXCEEDED',
          { eventId: event.id, noteId: note.id, sourceOctave: note.pitch.octave, targetOctave }
        );
      }
      targetNotePlans.push(Object.freeze({
        eventId: event.id,
        noteId: note.id,
        sourcePitch: freezePitch(note.pitch),
        targetPitch: Object.freeze({ ...note.pitch, octave: targetOctave })
      }));
    }
  }

  if (targetNotePlans.length === 0) {
    throw new ProfessionalOctaveTransposeV1Error(
      'Professional event-set transpose contains no pitched note targets.',
      'NO_PITCHED_TARGETS'
    );
  }

  return Object.freeze({
    version: EDITOR_PROFESSIONAL_OCTAVE_TRANSPOSE_V1_VERSION,
    kind: 'PROFESSIONAL_OCTAVE_TRANSPOSE_ADMISSION' as const,
    admitted: true as const,
    selectionKind: 'EVENT_SET' as const,
    sourceRevisionId: score.revision.id,
    octaveDelta: delta,
    targetEventIds: Object.freeze(selection.targets.map(target => target.eventId)),
    targetNotePlans: Object.freeze(targetNotePlans),
    selectedEventCount: selection.targets.length,
    pitchedEventCount,
    restEventCount,
    noteCount: targetNotePlans.length,
    preservesStepAndAlter: true as const,
    relationRemappingRequired: false as const,
    canonicalMutationAuthority: false as const,
    historyMutationAuthority: false as const
  });
};

const eventAddress = (score: ScoreDocumentV3, eventId: string): EventAddressV3 => {
  const address = addressEntityV3(score, eventId);
  if (address.kind !== 'event') {
    throw new ProfessionalOctaveTransposeV1Error(
      'Professional octave-transpose result selection no longer resolves as event.',
      'RESULT_SELECTION_INVALID',
      { eventId, observedKind: address.kind }
    );
  }
  return address;
};

const assertFreshRevision = (score: ScoreDocumentV3, nextRevisionId: string): void => {
  if (!ID.test(nextRevisionId) || nextRevisionId === score.revision.id || nextRevisionId === score.revision.parentId) {
    throw new ProfessionalOctaveTransposeV1Error(
      'Professional event-set transpose requires a fresh stable revision id.',
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
    throw new ProfessionalOctaveTransposeV1Error(
      'Professional event-set transpose would orphan existing notation.',
      'NOTATION_RESULT_INVALID',
      { targetId: targetId(address), targetKind: address.kind, cause: error instanceof Error ? error.message : String(error) }
    );
  }
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
    if (error instanceof ProfessionalOctaveTransposeV1Error) throw error;
    throw new ProfessionalOctaveTransposeV1Error(
      'Professional event-set transpose notation result failed canonical validation.',
      'NOTATION_RESULT_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

const mutateEventSet = (
  score: ScoreDocumentV3,
  admission: ProfessionalEventSetOctaveTransposeAdmissionV1,
  nextRevisionId: string
): Readonly<{ score: Readonly<ScoreDocumentV3>; changedEventIds: readonly string[]; changedNoteIds: readonly string[] }> => {
  assertFreshRevision(score, nextRevisionId);
  const plans = new Map(admission.targetNotePlans.map(plan => [plan.noteId, plan]));
  const seen = new Set<string>();
  const changedEvents = new Set<string>();
  const raw = structuredClone(score) as ScoreDocumentV3;

  for (const part of raw.parts) for (const staff of part.staves) {
    if (staff.role === 'tablature-linked') continue;
    for (const measure of staff.measures) for (const voice of measure.voices) {
      (voice as { events: readonly ScoreEvent[] }).events = voice.events.map((event): ScoreEvent => {
        if (event.kind === 'rest') return event;
        if (event.kind === 'note') {
          const plan = plans.get(event.note.id);
          if (plan === undefined) return event;
          if (plan.eventId !== event.id || !samePitch(event.note.pitch, plan.sourcePitch)) {
            throw new ProfessionalOctaveTransposeV1Error(
              'Professional event-set note plan no longer matches canonical source pitch/path.',
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
            throw new ProfessionalOctaveTransposeV1Error(
              'Professional event-set chord-tone plan no longer matches canonical source pitch/path.',
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
    }
  }

  if (seen.size !== plans.size || [...plans.keys()].some(noteId => !seen.has(noteId))) {
    throw new ProfessionalOctaveTransposeV1Error(
      'Professional event-set transpose could not apply every admitted note plan exactly once.',
      'TARGET_PLAN_INVALID',
      { expected: plans.size, applied: seen.size }
    );
  }

  (raw as { revision: ScoreDocumentV3['revision'] }).revision = {
    id: nextRevisionId,
    parentId: score.revision.id
  };
  let result: Readonly<ScoreDocumentV3>;
  try {
    result = createScoreDocumentV3(raw);
  } catch (error) {
    throw new ProfessionalOctaveTransposeV1Error(
      'Professional event-set transpose score result failed canonical validation.',
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

export const analyzeProfessionalOctaveTransposeV1 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  selectionInput: ProfessionalSelectionV1,
  octaveDeltaInput: TeacherOctaveDeltaV4
): Readonly<ProfessionalOctaveTransposeAdmissionV1> => {
  const score = createScoreDocumentV3(scoreInput);
  let notation: Readonly<NotationDocumentV4>;
  try {
    notation = createNotationDocumentV4(score, notationInput);
  } catch (error) {
    throw new ProfessionalOctaveTransposeV1Error(
      'Professional octave transpose requires current notation.',
      'ADMISSION_REJECTED',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  const selection = requireCurrentSelection(score, selectionInput);
  if (selection.kind === 'EVENT_SET') {
    return analyzeEventSet(score, notation, selection, octaveDeltaInput);
  }

  const teacherSelection = teacherSpanFor(score, selection);
  let teacherAdmission: Readonly<TeacherOctaveTransposeAdmissionV4>;
  try {
    teacherAdmission = analyzeTeacherOctaveTransposeV4(score, notation, teacherSelection, octaveDeltaInput);
  } catch (error) {
    throw new ProfessionalOctaveTransposeV1Error(
      'Professional octave transpose was rejected by the proven teacher safety admission.',
      'ADMISSION_REJECTED',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }

  return Object.freeze({
    version: EDITOR_PROFESSIONAL_OCTAVE_TRANSPOSE_V1_VERSION,
    kind: 'PROFESSIONAL_OCTAVE_TRANSPOSE_ADMISSION' as const,
    admitted: true as const,
    selectionKind: 'EVENT_SPAN' as const,
    sourceRevisionId: score.revision.id,
    octaveDelta: teacherAdmission.octaveDelta,
    targetEventIds: Object.freeze(selection.targets.map(target => target.eventId)),
    teacherAdmission,
    canonicalMutationAuthority: false as const,
    historyMutationAuthority: false as const
  });
};

export const executeProfessionalOctaveTransposeV1 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  selectionInput: ProfessionalSelectionV1,
  admissionInput: ProfessionalOctaveTransposeAdmissionV1,
  options: TeacherOctaveTransposeAuthoringV4Options
): Readonly<ProfessionalOctaveTransposeResultV1> => {
  const score = createScoreDocumentV3(scoreInput);
  const notation = createNotationDocumentV4(score, notationInput);
  const selection = requireCurrentSelection(score, selectionInput);

  let currentAdmission: Readonly<ProfessionalOctaveTransposeAdmissionV1>;
  try {
    currentAdmission = analyzeProfessionalOctaveTransposeV1(
      score,
      notation,
      selection,
      admissionInput.octaveDelta
    );
  } catch (error) {
    throw new ProfessionalOctaveTransposeV1Error(
      'Professional octave-transpose admission no longer revalidates.',
      'ADMISSION_STALE_OR_TAMPERED',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  if (!sameJson(currentAdmission, admissionInput)) {
    throw new ProfessionalOctaveTransposeV1Error(
      'Professional octave-transpose admission facts changed or were tampered with before mutation.',
      'ADMISSION_STALE_OR_TAMPERED'
    );
  }

  if (selection.kind === 'EVENT_SPAN' && currentAdmission.selectionKind === 'EVENT_SPAN') {
    const teacherSelection = teacherSpanFor(score, selection);
    let result: ReturnType<typeof executeTeacherOctaveTransposeV4>;
    try {
      result = executeTeacherOctaveTransposeV4(
        score,
        notation,
        teacherSelection,
        currentAdmission.teacherAdmission,
        options
      );
    } catch (error) {
      throw new ProfessionalOctaveTransposeV1Error(
        'Professional octave transpose was rejected by the proven teacher authoring engine.',
        'AUTHORING_REJECTED',
        { cause: error instanceof Error ? error.message : String(error) }
      );
    }
    const nextSelection = createEventSpanProfessionalSelectionV1(
      result.score,
      eventAddress(result.score, selection.anchor.eventId),
      eventAddress(result.score, selection.focus.eventId)
    );
    return Object.freeze({
      version: EDITOR_PROFESSIONAL_OCTAVE_TRANSPOSE_V1_VERSION,
      score: result.score,
      notation: result.notation,
      selection: nextSelection,
      changedEventIds: result.changedEventIds,
      changedNoteIds: result.changedNoteIds,
      admission: currentAdmission,
      historyMutationAuthority: false as const
    });
  }

  if (selection.kind === 'EVENT_SET' && currentAdmission.selectionKind === 'EVENT_SET') {
    const mutation = mutateEventSet(score, currentAdmission, options.nextRevisionId);
    const nextNotation = rebindNotation(mutation.score, notation);
    const primary = eventAddress(mutation.score, selection.primary.eventId);
    const explicit = [
      primary,
      ...selection.targets
        .filter(target => target.eventId !== selection.primary.eventId)
        .map(target => eventAddress(mutation.score, target.eventId))
    ];
    const nextSelection = createEventSetProfessionalSelectionV1(mutation.score, explicit);
    return Object.freeze({
      version: EDITOR_PROFESSIONAL_OCTAVE_TRANSPOSE_V1_VERSION,
      score: mutation.score,
      notation: nextNotation,
      selection: nextSelection,
      changedEventIds: mutation.changedEventIds,
      changedNoteIds: mutation.changedNoteIds,
      admission: currentAdmission,
      historyMutationAuthority: false as const
    });
  }

  throw new ProfessionalOctaveTransposeV1Error(
    'Professional selection and admission kinds no longer match.',
    'ADMISSION_STALE_OR_TAMPERED',
    { selectionKind: selection.kind, admissionKind: currentAdmission.selectionKind }
  );
};
