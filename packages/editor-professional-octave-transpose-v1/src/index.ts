import {
  addressEntityV3,
  type EventAddressV3
} from '../../addressing-v3/src/index.js';
import {
  createScoreDocumentV3,
  type ScoreDocumentV3
} from '../../score-model-v3/src/index.js';
import {
  createNotationDocumentV4,
  type NotationDocumentV4
} from '../../notation-structure-v4/src/index.js';
import {
  createEventSpanProfessionalSelectionV1,
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
  type TeacherOctaveTransposeAdmissionV4
} from '../../editor-teacher-octave-transpose-admission-v4/src/index.js';
import {
  executeTeacherOctaveTransposeV4,
  type TeacherOctaveTransposeAuthoringV4Options
} from '../../editor-teacher-octave-transpose-authoring-v4/src/index.js';

export const EDITOR_PROFESSIONAL_OCTAVE_TRANSPOSE_V1_VERSION = '1.0.0' as const;

export interface ProfessionalOctaveTransposeAdmissionV1 {
  readonly version: typeof EDITOR_PROFESSIONAL_OCTAVE_TRANSPOSE_V1_VERSION;
  readonly kind: 'PROFESSIONAL_OCTAVE_TRANSPOSE_ADMISSION';
  readonly admitted: true;
  readonly selectionKind: 'EVENT_SPAN';
  readonly sourceRevisionId: string;
  readonly octaveDelta: TeacherOctaveDeltaV4;
  readonly targetEventIds: readonly string[];
  readonly teacherAdmission: Readonly<TeacherOctaveTransposeAdmissionV4>;
  readonly canonicalMutationAuthority: false;
  readonly historyMutationAuthority: false;
}

export interface ProfessionalOctaveTransposeResultV1 {
  readonly version: typeof EDITOR_PROFESSIONAL_OCTAVE_TRANSPOSE_V1_VERSION;
  readonly score: Readonly<ScoreDocumentV3>;
  readonly notation: Readonly<NotationDocumentV4>;
  readonly selection: Readonly<EventSpanProfessionalSelectionV1>;
  readonly changedEventIds: readonly string[];
  readonly changedNoteIds: readonly string[];
  readonly admission: Readonly<ProfessionalOctaveTransposeAdmissionV1>;
  readonly historyMutationAuthority: false;
}

export type ProfessionalOctaveTransposeV1ErrorCode =
  | 'SELECTION_KIND_UNSUPPORTED'
  | 'SELECTION_STALE_OR_TAMPERED'
  | 'SPAN_ADAPTER_REJECTED'
  | 'ADMISSION_REJECTED'
  | 'ADMISSION_STALE_OR_TAMPERED'
  | 'AUTHORING_REJECTED'
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

const sameJson = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

const selectionFacts = (selection: EventSpanProfessionalSelectionV1): unknown => ({
  version: selection.version,
  kind: selection.kind,
  anchorEventId: selection.anchor.eventId,
  focusEventId: selection.focus.eventId,
  direction: selection.direction,
  scope: selection.scope,
  targetEventIds: selection.targets.map(target => target.eventId)
});

const requireCurrentSpan = (
  score: ScoreDocumentV3,
  selection: ProfessionalSelectionV1
): Readonly<EventSpanProfessionalSelectionV1> => {
  if (selection.kind !== 'EVENT_SPAN') {
    throw new ProfessionalOctaveTransposeV1Error(
      'P08-B1 octave transpose admits contiguous professional EVENT_SPAN selections only.',
      'SELECTION_KIND_UNSUPPORTED',
      { selectionKind: selection.kind }
    );
  }

  let current: Readonly<EventSpanProfessionalSelectionV1>;
  try {
    current = createEventSpanProfessionalSelectionV1(score, selection.anchor, selection.focus);
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

export const analyzeProfessionalOctaveTransposeV1 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  selectionInput: ProfessionalSelectionV1,
  octaveDelta: TeacherOctaveDeltaV4
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
  const selection = requireCurrentSpan(score, selectionInput);
  const teacherSelection = teacherSpanFor(score, selection);

  let teacherAdmission: Readonly<TeacherOctaveTransposeAdmissionV4>;
  try {
    teacherAdmission = analyzeTeacherOctaveTransposeV4(
      score,
      notation,
      teacherSelection,
      octaveDelta
    );
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
  const selection = requireCurrentSpan(score, selectionInput);

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
};
