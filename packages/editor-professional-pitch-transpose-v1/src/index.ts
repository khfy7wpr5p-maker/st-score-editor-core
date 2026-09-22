import {
  addressEntityV3,
  resolveSemanticAddressV3,
  type EventAddressV3,
  type NoteAddressV3,
  type SemanticAddressV3
} from '../../addressing-v3/src/index.js';
import {
  createScoreDocumentV3,
  type ScoreDocumentV3
} from '../../score-model-v3/src/index.js';
import type { Pitch, ScoreEvent } from '../../score-model/src/index.js';
import type { AccidentalDisplay, NoteNotation } from '../../notation-structure/src/index.js';
import {
  createNotationDocumentV4,
  type NotationDocumentV4
} from '../../notation-structure-v4/src/index.js';
import {
  createEventSetProfessionalSelectionV1,
  createEventSpanProfessionalSelectionV1,
  type ProfessionalSelectionV1
} from '../../editor-professional-selection-v1/src/index.js';
import {
  PitchTheoryV1Error,
  accidentalDisplayForPitchV1,
  transposeDiatonicPitchV1,
  transposeSemitonePitchV1
} from './pitch-theory.js';

export const EDITOR_PROFESSIONAL_PITCH_TRANSPOSE_V1_VERSION = '1.0.0' as const;

export type ProfessionalPitchTransposeModeV1 = 'SEMITONE' | 'DIATONIC';

export interface ProfessionalPitchTransposeNotePlanV1 {
  readonly eventId: string;
  readonly noteId: string;
  readonly sourcePitch: Readonly<Pitch>;
  readonly targetPitch: Readonly<Pitch>;
  readonly effectiveKeyFifths: number;
  readonly sourceAccidental: AccidentalDisplay | null;
  readonly targetAccidental: AccidentalDisplay | null;
}

export interface ProfessionalPitchTransposeAdmissionV1 {
  readonly version: typeof EDITOR_PROFESSIONAL_PITCH_TRANSPOSE_V1_VERSION;
  readonly kind: 'PROFESSIONAL_PITCH_TRANSPOSE_ADMISSION';
  readonly admitted: true;
  readonly sourceRevisionId: string;
  readonly selectionKind: 'EVENT_SPAN' | 'EVENT_SET';
  readonly mode: ProfessionalPitchTransposeModeV1;
  readonly interval: number;
  readonly targetEventIds: readonly string[];
  readonly targetNotePlans: readonly ProfessionalPitchTransposeNotePlanV1[];
  readonly selectedEventCount: number;
  readonly pitchedEventCount: number;
  readonly restEventCount: number;
  readonly noteCount: number;
  readonly canonicalMutationAuthority: false;
  readonly historyMutationAuthority: false;
  readonly rendererCoordinateAuthority: false;
  readonly domAuthoringAuthority: false;
}

export interface ProfessionalPitchTransposeOptionsV1 {
  readonly nextRevisionId: string;
}

export interface ProfessionalPitchTransposeResultV1 {
  readonly version: typeof EDITOR_PROFESSIONAL_PITCH_TRANSPOSE_V1_VERSION;
  readonly score: Readonly<ScoreDocumentV3>;
  readonly notation: Readonly<NotationDocumentV4>;
  readonly selection: Readonly<ProfessionalSelectionV1>;
  readonly changedEventIds: readonly string[];
  readonly changedNoteIds: readonly string[];
  readonly admission: Readonly<ProfessionalPitchTransposeAdmissionV1>;
  readonly historyMutationAuthority: false;
}

export type ProfessionalPitchTransposeV1ErrorCode =
  | 'INVALID_SEMITONE_DELTA'
  | 'INVALID_DIATONIC_STEPS'
  | 'SELECTION_STALE_OR_TAMPERED'
  | 'NO_PITCHED_TARGETS'
  | 'TIE_RELATION_UNSUPPORTED'
  | 'GRACE_RELATION_UNSUPPORTED'
  | 'KEY_CONTEXT_INVALID'
  | 'PITCH_RANGE_EXCEEDED'
  | 'SPELLING_UNREPRESENTABLE'
  | 'ADMISSION_STALE_OR_TAMPERED'
  | 'TARGET_PLAN_INVALID'
  | 'NOTATION_RESULT_INVALID'
  | 'RESULT_INVALID'
  | 'RESULT_SELECTION_INVALID'
  | 'INVALID_REVISION_ID';

export class ProfessionalPitchTransposeV1Error extends Error {
  readonly code: ProfessionalPitchTransposeV1ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: ProfessionalPitchTransposeV1ErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ProfessionalPitchTransposeV1Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const sameJson = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);
const samePitch = (left: Pitch, right: Pitch): boolean =>
  left.step === right.step && left.alter === right.alter && left.octave === right.octave;
const freezePitch = (pitch: Pitch): Readonly<Pitch> => Object.freeze({ ...pitch });

const selectionFingerprint = (selection: ProfessionalSelectionV1): string => {
  const endpoints = selection.kind === 'EVENT_SPAN'
    ? [selection.anchor.eventId, selection.focus.eventId, selection.direction]
    : [selection.primary.eventId];
  return JSON.stringify([
    selection.version,
    selection.kind,
    selection.scope,
    endpoints,
    selection.targets.map(({ eventId }) => eventId)
  ]);
};

const recreateSelection = (
  score: ScoreDocumentV3,
  selection: ProfessionalSelectionV1
): Readonly<ProfessionalSelectionV1> =>
  selection.kind === 'EVENT_SPAN'
    ? createEventSpanProfessionalSelectionV1(score, selection.anchor, selection.focus)
    : createEventSetProfessionalSelectionV1(score, [
        selection.primary,
        ...selection.targets.filter(({ eventId }) => eventId !== selection.primary.eventId)
      ]);

const requireCurrentSelection = (
  score: ScoreDocumentV3,
  selection: ProfessionalSelectionV1
): Readonly<ProfessionalSelectionV1> => {
  let current: Readonly<ProfessionalSelectionV1>;
  try {
    current = recreateSelection(score, selection);
  } catch (error) {
    throw new ProfessionalPitchTransposeV1Error(
      'Professional pitch-transpose selection no longer resolves against the current revision.',
      'SELECTION_STALE_OR_TAMPERED',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  if (selectionFingerprint(current) !== selectionFingerprint(selection)) {
    throw new ProfessionalPitchTransposeV1Error(
      'Professional pitch-transpose selection facts changed or were tampered with.',
      'SELECTION_STALE_OR_TAMPERED'
    );
  }
  return current;
};

const selectedEvent = (
  score: ScoreDocumentV3,
  target: EventAddressV3
): ScoreEvent => {
  try {
    const resolved = resolveSemanticAddressV3(score, target);
    if (resolved.kind !== 'event') throw new Error('target is not event');
    return resolved.value;
  } catch (error) {
    throw new ProfessionalPitchTransposeV1Error(
      'Professional pitch-transpose target no longer resolves as an event.',
      'SELECTION_STALE_OR_TAMPERED',
      { eventId: target.eventId, cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

const noteAtoms = (event: ScoreEvent) =>
  event.kind === 'note' ? [event.note] : event.kind === 'chord' ? [...event.notes] : [];

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

const effectiveKeyFifthsForEvent = (
  score: ScoreDocumentV3,
  notation: NotationDocumentV4,
  target: EventAddressV3
): number => {
  const part = score.parts.find(item => item.id === target.partId);
  const staff = part?.staves.find(item => item.id === target.staffId);
  if (staff === undefined || staff.role === 'tablature-linked') {
    throw new ProfessionalPitchTransposeV1Error(
      'Pitch transpose requires a canonical content staff target.',
      'KEY_CONTEXT_INVALID',
      { partId: target.partId, staffId: target.staffId }
    );
  }
  const measureIndex = staff.measures.findIndex(item => item.id === target.measureId);
  if (measureIndex < 0) {
    throw new ProfessionalPitchTransposeV1Error(
      'Pitch transpose target measure is unavailable in the selected content staff.',
      'KEY_CONTEXT_INVALID',
      { measureId: target.measureId }
    );
  }

  const byMeasure = new Map(
    notation.measures.map(entry => [entry.target.measureId, entry.notation.keySignature] as const)
  );
  for (let index = measureIndex; index >= 0; index -= 1) {
    const explicit = byMeasure.get(staff.measures[index]!.id);
    if (explicit !== undefined && explicit !== null) return explicit.fifths;
  }
  return 0;
};

const theoryFailure = (error: unknown): never => {
  if (error instanceof PitchTheoryV1Error) {
    throw new ProfessionalPitchTransposeV1Error(
      error.message,
      error.code,
      { theoryCode: error.code }
    );
  }
  throw error;
};

const targetPitch = (
  source: Pitch,
  fifths: number,
  mode: ProfessionalPitchTransposeModeV1,
  interval: number
): Readonly<Pitch> => {
  try {
    return mode === 'SEMITONE'
      ? transposeSemitonePitchV1(source, fifths, interval)
      : transposeDiatonicPitchV1(source, fifths, interval);
  } catch (error) {
    return theoryFailure(error);
  }
};

const analyzeProfessionalPitchTransposeV1 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  selectionInput: ProfessionalSelectionV1,
  mode: ProfessionalPitchTransposeModeV1,
  interval: number
): Readonly<ProfessionalPitchTransposeAdmissionV1> => {
  const score = createScoreDocumentV3(scoreInput);
  let notation: Readonly<NotationDocumentV4>;
  try {
    notation = createNotationDocumentV4(score, notationInput);
  } catch (error) {
    throw new ProfessionalPitchTransposeV1Error(
      'Professional pitch transpose requires current canonical notation.',
      'NOTATION_RESULT_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  const selection = requireCurrentSelection(score, selectionInput);
  const noteNotation = new Map(notation.notes.map(entry => [entry.target.noteId, entry.notation] as const));
  const graceAnchors = graceAnchoredEventIds(score);
  const plans: ProfessionalPitchTransposeNotePlanV1[] = [];
  let pitchedEventCount = 0;
  let restEventCount = 0;

  for (const target of selection.targets) {
    const event = selectedEvent(score, target);
    if (graceAnchors.has(event.id)) {
      throw new ProfessionalPitchTransposeV1Error(
        'Professional pitch transpose does not yet own grace relation closure.',
        'GRACE_RELATION_UNSUPPORTED',
        { eventId: event.id }
      );
    }
    if (event.kind === 'rest') {
      restEventCount += 1;
      continue;
    }

    pitchedEventCount += 1;
    const fifths = effectiveKeyFifthsForEvent(score, notation, target);
    for (const note of noteAtoms(event)) {
      const currentNotation = noteNotation.get(note.id);
      if ((currentNotation?.ties.length ?? 0) > 0) {
        throw new ProfessionalPitchTransposeV1Error(
          'Professional pitch transpose requires tie-free selected notes until relation closure is implemented.',
          'TIE_RELATION_UNSUPPORTED',
          { eventId: event.id, noteId: note.id }
        );
      }

      const nextPitch = targetPitch(note.pitch, fifths, mode, interval);
      const nextAccidental = accidentalDisplayForPitchV1(nextPitch, fifths);
      plans.push(Object.freeze({
        eventId: event.id,
        noteId: note.id,
        sourcePitch: freezePitch(note.pitch),
        targetPitch: freezePitch(nextPitch),
        effectiveKeyFifths: fifths,
        sourceAccidental: currentNotation?.accidental ?? null,
        targetAccidental: nextAccidental
      }));
    }
  }

  if (plans.length === 0) {
    throw new ProfessionalPitchTransposeV1Error(
      'Professional pitch transpose contains no pitched note targets.',
      'NO_PITCHED_TARGETS'
    );
  }

  return Object.freeze({
    version: EDITOR_PROFESSIONAL_PITCH_TRANSPOSE_V1_VERSION,
    kind: 'PROFESSIONAL_PITCH_TRANSPOSE_ADMISSION' as const,
    admitted: true as const,
    sourceRevisionId: score.revision.id,
    selectionKind: selection.kind,
    mode,
    interval,
    targetEventIds: Object.freeze(selection.targets.map(target => target.eventId)),
    targetNotePlans: Object.freeze(plans),
    selectedEventCount: selection.targets.length,
    pitchedEventCount,
    restEventCount,
    noteCount: plans.length,
    canonicalMutationAuthority: false as const,
    historyMutationAuthority: false as const,
    rendererCoordinateAuthority: false as const,
    domAuthoringAuthority: false as const
  });
};

export const analyzeProfessionalSemitoneTransposeV1 = (
  score: ScoreDocumentV3,
  notation: NotationDocumentV4,
  selection: ProfessionalSelectionV1,
  delta: number
): Readonly<ProfessionalPitchTransposeAdmissionV1> =>
  analyzeProfessionalPitchTransposeV1(score, notation, selection, 'SEMITONE', delta);

export const analyzeProfessionalDiatonicTransposeV1 = (
  score: ScoreDocumentV3,
  notation: NotationDocumentV4,
  selection: ProfessionalSelectionV1,
  steps: number
): Readonly<ProfessionalPitchTransposeAdmissionV1> =>
  analyzeProfessionalPitchTransposeV1(score, notation, selection, 'DIATONIC', steps);

const assertFreshRevision = (score: ScoreDocumentV3, nextRevisionId: string): void => {
  if (!ID.test(nextRevisionId) || nextRevisionId === score.revision.id || nextRevisionId === score.revision.parentId) {
    throw new ProfessionalPitchTransposeV1Error(
      'Professional pitch transpose requires a fresh stable revision id.',
      'INVALID_REVISION_ID',
      { nextRevisionId, currentRevisionId: score.revision.id, parentRevisionId: score.revision.parentId }
    );
  }
};

const ADDRESS_ID_FIELD = Object.freeze({
  document: 'documentId',
  'measure-frame': 'frameId',
  part: 'partId',
  staff: 'staffId',
  measure: 'measureId',
  voice: 'voiceId',
  event: 'eventId',
  note: 'noteId',
  'grace-group': 'graceGroupId',
  'grace-event': 'graceEventId',
  'grace-note': 'graceNoteId'
} satisfies Record<SemanticAddressV3['kind'], string>);

const targetId = (address: SemanticAddressV3): string => {
  const field = ADDRESS_ID_FIELD[address.kind];
  const value = (address as unknown as Record<string, unknown>)[field];
  if (typeof value !== 'string') {
    throw new ProfessionalPitchTransposeV1Error(
      'Professional pitch transpose encountered an invalid semantic target identity.',
      'NOTATION_RESULT_INVALID',
      { targetKind: address.kind, field }
    );
  }
  return value;
};

const rebind = (score: ScoreDocumentV3, address: SemanticAddressV3): SemanticAddressV3 => {
  const id = targetId(address);
  try {
    const candidate = addressEntityV3(score, id);
    if (candidate.kind !== address.kind) throw new Error('semantic kind changed');
    return candidate;
  } catch (error) {
    throw new ProfessionalPitchTransposeV1Error(
      'Professional pitch transpose would orphan existing notation.',
      'NOTATION_RESULT_INVALID',
      { targetId: id, targetKind: address.kind, cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

const eventAddress = (score: ScoreDocumentV3, eventId: string): EventAddressV3 => {
  const address = addressEntityV3(score, eventId);
  if (address.kind !== 'event') {
    throw new ProfessionalPitchTransposeV1Error(
      'Professional pitch-transpose result event changed semantic kind.',
      'RESULT_SELECTION_INVALID',
      { eventId, observedKind: address.kind }
    );
  }
  return address;
};

const noteAddress = (score: ScoreDocumentV3, noteId: string): NoteAddressV3 => {
  const address = addressEntityV3(score, noteId);
  if (address.kind !== 'note') {
    throw new ProfessionalPitchTransposeV1Error(
      'Professional pitch-transpose result note changed semantic kind.',
      'NOTATION_RESULT_INVALID',
      { noteId, observedKind: address.kind }
    );
  }
  return address;
};

const mutateScore = (
  score: ScoreDocumentV3,
  admission: ProfessionalPitchTransposeAdmissionV1,
  nextRevisionId: string
): Readonly<{
  score: Readonly<ScoreDocumentV3>;
  changedEventIds: readonly string[];
  changedNoteIds: readonly string[];
}> => {
  assertFreshRevision(score, nextRevisionId);
  const plans = new Map(admission.targetNotePlans.map(plan => [plan.noteId, plan] as const));
  const seen = new Set<string>();
  const changedEvents = new Set<string>();
  const raw = structuredClone(score) as ScoreDocumentV3;

  const rewriteAtom = <T extends { readonly id: string; readonly pitch: Pitch }>(
    eventId: string,
    atom: T
  ): T => {
    const plan = plans.get(atom.id);
    if (plan === undefined) return atom;
    if (plan.eventId !== eventId || !samePitch(atom.pitch, plan.sourcePitch)) {
      throw new ProfessionalPitchTransposeV1Error(
        'Professional pitch-transpose target plan no longer matches source pitch/path.',
        'TARGET_PLAN_INVALID',
        { eventId, noteId: atom.id }
      );
    }
    seen.add(atom.id);
    return { ...atom, pitch: { ...plan.targetPitch } };
  };

  const rewriteEvent = (event: ScoreEvent): ScoreEvent => {
    if (event.kind === 'rest') return event;
    if (event.kind === 'note') {
      const note = rewriteAtom(event.id, event.note);
      if (note === event.note) return event;
      changedEvents.add(event.id);
      return { ...event, note };
    }
    const notes = event.notes.map(note => rewriteAtom(event.id, note));
    if (notes.every((note, index) => note === event.notes[index])) return event;
    changedEvents.add(event.id);
    return { ...event, notes };
  };

  for (const part of raw.parts) {
    for (const staff of part.staves) {
      if (staff.role === 'tablature-linked') continue;
      for (const measure of staff.measures) {
        for (const voice of measure.voices) {
          (voice as { events: readonly ScoreEvent[] }).events = voice.events.map(rewriteEvent);
        }
      }
    }
  }

  if (seen.size !== plans.size || [...plans.keys()].some(noteIdValue => !seen.has(noteIdValue))) {
    throw new ProfessionalPitchTransposeV1Error(
      'Professional pitch transpose could not apply every admitted note plan exactly once.',
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
    throw new ProfessionalPitchTransposeV1Error(
      'Professional pitch-transpose score candidate failed canonical validation.',
      'RESULT_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }

  const changedEventIds = admission.targetEventIds.filter(eventIdValue => changedEvents.has(eventIdValue));
  return Object.freeze({
    score: result,
    changedEventIds: Object.freeze(changedEventIds),
    changedNoteIds: Object.freeze(admission.targetNotePlans.map(plan => plan.noteId))
  });
};

const buildNotation = (
  score: ScoreDocumentV3,
  base: NotationDocumentV4,
  admission: ProfessionalPitchTransposeAdmissionV1
): Readonly<NotationDocumentV4> => {
  const noteMap = new Map<string, NoteNotation>(
    base.notes.map(entry => [entry.target.noteId, entry.notation] as const)
  );

  for (const plan of admission.targetNotePlans) {
    const current = noteMap.get(plan.noteId);
    if (current === undefined) {
      if (plan.targetAccidental !== null) {
        noteMap.set(plan.noteId, Object.freeze({
          accidental: plan.targetAccidental,
          ties: Object.freeze([]),
          slurs: Object.freeze([])
        }));
      }
      continue;
    }
    noteMap.set(plan.noteId, Object.freeze({
      accidental: plan.targetAccidental,
      ties: current.ties,
      slurs: current.slurs
    }));
  }

  const rebindEntries = <T extends { readonly target: SemanticAddressV3 }>(
    entries: readonly T[]
  ): T[] => entries.map(entry => ({
    ...entry,
    target: rebind(score, entry.target)
  }) as T);

  try {
    return createNotationDocumentV4(score, {
      contractVersion: '4.0.0',
      documentId: score.id,
      revisionId: score.revision.id,
      frames: rebindEntries(base.frames),
      measures: rebindEntries(base.measures),
      events: rebindEntries(base.events),
      notes: [...noteMap].map(([id, notation]) => ({
        target: noteAddress(score, id),
        notation
      })),
      graceEvents: rebindEntries(base.graceEvents),
      graceNotes: rebindEntries(base.graceNotes),
      crossStaffPlacements: base.crossStaffPlacements.map(entry => ({
        ...entry,
        source: rebind(score, entry.source) as EventAddressV3
      }))
    });
  } catch (error) {
    if (error instanceof ProfessionalPitchTransposeV1Error) throw error;
    throw new ProfessionalPitchTransposeV1Error(
      'Professional pitch-transpose notation candidate failed canonical validation.',
      'NOTATION_RESULT_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

const rebindSelection = (
  score: ScoreDocumentV3,
  selection: ProfessionalSelectionV1
): Readonly<ProfessionalSelectionV1> => {
  try {
    if (selection.kind === 'EVENT_SPAN') {
      return createEventSpanProfessionalSelectionV1(
        score,
        eventAddress(score, selection.anchor.eventId),
        eventAddress(score, selection.focus.eventId)
      );
    }
    const primary = eventAddress(score, selection.primary.eventId);
    return createEventSetProfessionalSelectionV1(score, [
      primary,
      ...selection.targets
        .filter(target => target.eventId !== selection.primary.eventId)
        .map(target => eventAddress(score, target.eventId))
    ]);
  } catch (error) {
    if (error instanceof ProfessionalPitchTransposeV1Error) throw error;
    throw new ProfessionalPitchTransposeV1Error(
      'Professional pitch-transpose selection could not rebind to the result revision.',
      'RESULT_SELECTION_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

export const executeProfessionalPitchTransposeV1 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  selectionInput: ProfessionalSelectionV1,
  admissionInput: ProfessionalPitchTransposeAdmissionV1,
  options: ProfessionalPitchTransposeOptionsV1
): Readonly<ProfessionalPitchTransposeResultV1> => {
  const score = createScoreDocumentV3(scoreInput);
  const notation = createNotationDocumentV4(score, notationInput);
  const selection = requireCurrentSelection(score, selectionInput);

  let currentAdmission: Readonly<ProfessionalPitchTransposeAdmissionV1>;
  try {
    currentAdmission = admissionInput.mode === 'SEMITONE'
      ? analyzeProfessionalSemitoneTransposeV1(score, notation, selection, admissionInput.interval)
      : analyzeProfessionalDiatonicTransposeV1(score, notation, selection, admissionInput.interval);
  } catch (error) {
    throw new ProfessionalPitchTransposeV1Error(
      'Professional pitch-transpose admission no longer revalidates.',
      'ADMISSION_STALE_OR_TAMPERED',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }

  if (!sameJson(currentAdmission, admissionInput)) {
    throw new ProfessionalPitchTransposeV1Error(
      'Professional pitch-transpose admission facts changed or were tampered with before mutation.',
      'ADMISSION_STALE_OR_TAMPERED'
    );
  }

  const mutation = mutateScore(score, currentAdmission, options.nextRevisionId);
  const nextNotation = buildNotation(mutation.score, notation, currentAdmission);
  const nextSelection = rebindSelection(mutation.score, selection);

  return Object.freeze({
    version: EDITOR_PROFESSIONAL_PITCH_TRANSPOSE_V1_VERSION,
    score: mutation.score,
    notation: nextNotation,
    selection: nextSelection,
    changedEventIds: mutation.changedEventIds,
    changedNoteIds: mutation.changedNoteIds,
    admission: currentAdmission,
    historyMutationAuthority: false as const
  });
};
