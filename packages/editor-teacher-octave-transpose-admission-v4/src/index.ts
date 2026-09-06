import {
  resolveSemanticAddressV3,
  type EventAddressV3
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
import {
  createTeacherEventSpanSelectionV4,
  EDITOR_TEACHER_EVENT_SPAN_V4_VERSION,
  type TeacherEventSpanSelectionV4
} from '../../editor-teacher-event-span-v4/src/index.js';

export const EDITOR_TEACHER_OCTAVE_TRANSPOSE_ADMISSION_V4_VERSION = '1.0.0' as const;
export type TeacherOctaveDeltaV4 = -2 | -1 | 1 | 2;

export interface TeacherOctaveTransposeNotePlanV4 {
  readonly eventId: string;
  readonly noteId: string;
  readonly sourcePitch: Pitch;
  readonly targetPitch: Pitch;
}

export interface TeacherOctaveTransposeAdmissionV4 {
  readonly version: typeof EDITOR_TEACHER_OCTAVE_TRANSPOSE_ADMISSION_V4_VERSION;
  readonly kind: 'TEACHER_OCTAVE_TRANSPOSE_ADMISSION';
  readonly admitted: true;
  readonly octaveDelta: TeacherOctaveDeltaV4;
  readonly sourceRevisionId: string;
  readonly targetEventIds: readonly string[];
  readonly targetNotePlans: readonly TeacherOctaveTransposeNotePlanV4[];
  readonly selectedEventCount: number;
  readonly pitchedEventCount: number;
  readonly restEventCount: number;
  readonly noteCount: number;
  readonly crossesMeasureBoundary: boolean;
  readonly preservesStepAndAlter: true;
  readonly relationRemappingRequired: false;
  readonly canonicalMutationAuthority: false;
  readonly historyMutationAuthority: false;
}

export type TeacherOctaveTransposeAdmissionV4ErrorCode =
  | 'INVALID_OCTAVE_DELTA'
  | 'INVALID_SELECTION'
  | 'STALE_SELECTION'
  | 'SELECTION_TAMPERED'
  | 'NO_PITCHED_TARGETS'
  | 'TIE_RELATION_UNSUPPORTED'
  | 'GRACE_RELATION_UNSUPPORTED'
  | 'PITCH_RANGE_EXCEEDED';

export class TeacherOctaveTransposeAdmissionV4Error extends Error {
  readonly code: TeacherOctaveTransposeAdmissionV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(
    message: string,
    code: TeacherOctaveTransposeAdmissionV4ErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'TeacherOctaveTransposeAdmissionV4Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const freezePitch = (pitch: Pitch): Pitch => Object.freeze({ ...pitch });

const parseDelta = (value: unknown): TeacherOctaveDeltaV4 => {
  if (value !== -2 && value !== -1 && value !== 1 && value !== 2) {
    throw new TeacherOctaveTransposeAdmissionV4Error(
      'First teacher bulk-transpose profile supports only -2, -1, +1 or +2 octaves.',
      'INVALID_OCTAVE_DELTA',
      { value }
    );
  }
  return value;
};

const selectionFacts = (selection: TeacherEventSpanSelectionV4): unknown => ({
  version: selection.version,
  kind: selection.kind,
  start: selection.start,
  stop: selection.stop,
  targets: selection.targets.map(target => target.eventId),
  measureIds: selection.measureIds,
  frameIds: selection.frameIds,
  voiceOrdinal: selection.voiceOrdinal,
  crossesMeasureBoundary: selection.crossesMeasureBoundary
});

const revalidateSelection = (
  score: ScoreDocumentV3,
  selection: TeacherEventSpanSelectionV4
): Readonly<TeacherEventSpanSelectionV4> => {
  if (
    selection.version !== EDITOR_TEACHER_EVENT_SPAN_V4_VERSION ||
    selection.kind !== 'TEACHER_EVENT_SPAN' ||
    !Array.isArray(selection.targets) ||
    selection.targets.length === 0
  ) {
    throw new TeacherOctaveTransposeAdmissionV4Error(
      'Teacher octave transpose selection envelope is invalid.',
      'INVALID_SELECTION'
    );
  }
  let current: Readonly<TeacherEventSpanSelectionV4>;
  try {
    current = createTeacherEventSpanSelectionV4(score, selection.start, selection.stop);
  } catch (error) {
    throw new TeacherOctaveTransposeAdmissionV4Error(
      'Teacher octave transpose selection no longer resolves against the current score revision.',
      'STALE_SELECTION',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  if (JSON.stringify(selectionFacts(current)) !== JSON.stringify(selectionFacts(selection))) {
    throw new TeacherOctaveTransposeAdmissionV4Error(
      'Teacher octave transpose selection facts changed or were tampered with.',
      'SELECTION_TAMPERED'
    );
  }
  return current;
};

const selectedEvent = (score: ScoreDocumentV3, target: EventAddressV3): ScoreEvent => {
  try {
    const resolved = resolveSemanticAddressV3(score, target);
    if (resolved.kind !== 'event') throw new Error('target is not event');
    return resolved.value;
  } catch (error) {
    throw new TeacherOctaveTransposeAdmissionV4Error(
      'Teacher octave transpose target no longer resolves as an event.',
      'STALE_SELECTION',
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

export const analyzeTeacherOctaveTransposeV4 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  selectionInput: TeacherEventSpanSelectionV4,
  octaveDeltaInput: TeacherOctaveDeltaV4
): Readonly<TeacherOctaveTransposeAdmissionV4> => {
  const score = createScoreDocumentV3(scoreInput);
  let notation: Readonly<NotationDocumentV4>;
  try {
    notation = createNotationDocumentV4(score, notationInput);
  } catch (error) {
    throw new TeacherOctaveTransposeAdmissionV4Error(
      'Teacher octave transpose notation is stale or invalid.',
      'STALE_SELECTION',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  const delta = parseDelta(octaveDeltaInput);
  const selection = revalidateSelection(score, selectionInput);
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
      throw new TeacherOctaveTransposeAdmissionV4Error(
        'First teacher octave-transpose profile does not leave anchored grace content at the old octave.',
        'GRACE_RELATION_UNSUPPORTED',
        { eventId: event.id }
      );
    }
    pitchedEventCount += 1;
    for (const note of noteAtoms(event)) {
      const notationForNote = noteNotation.get(note.id);
      if (notationForNote !== undefined && notationForNote.ties.length > 0) {
        throw new TeacherOctaveTransposeAdmissionV4Error(
          'First teacher octave-transpose profile requires tie-free selected notes until relation closure is implemented.',
          'TIE_RELATION_UNSUPPORTED',
          { eventId: event.id, noteId: note.id }
        );
      }
      const targetOctave = note.pitch.octave + delta;
      if (targetOctave < -1 || targetOctave > 9) {
        throw new TeacherOctaveTransposeAdmissionV4Error(
          'Teacher octave transpose would move a pitch outside the canonical pitch range.',
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
    throw new TeacherOctaveTransposeAdmissionV4Error(
      'Teacher octave transpose selection contains no pitched note targets.',
      'NO_PITCHED_TARGETS'
    );
  }

  return Object.freeze({
    version: EDITOR_TEACHER_OCTAVE_TRANSPOSE_ADMISSION_V4_VERSION,
    kind: 'TEACHER_OCTAVE_TRANSPOSE_ADMISSION' as const,
    admitted: true as const,
    octaveDelta: delta,
    sourceRevisionId: score.revision.id,
    targetEventIds: Object.freeze(selection.targets.map(target => target.eventId)),
    targetNotePlans: Object.freeze(targetNotePlans),
    selectedEventCount: selection.targets.length,
    pitchedEventCount,
    restEventCount,
    noteCount: targetNotePlans.length,
    crossesMeasureBoundary: selection.crossesMeasureBoundary,
    preservesStepAndAlter: true as const,
    relationRemappingRequired: false as const,
    canonicalMutationAuthority: false as const,
    historyMutationAuthority: false as const
  });
};
