import {
  addressEntityV3,
  resolveSemanticAddressV3,
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
import {
  createEventSpanProfessionalSelectionV1,
  type EventSpanProfessionalSelectionV1,
  type ProfessionalSelectionV1
} from '../../editor-professional-selection-v1/src/index.js';
import {
  createTeacherEventSpanSelectionV4
} from '../../editor-teacher-event-span-v4/src/index.js';
import {
  EDITOR_TEACHER_COPY_SNAPSHOT_V4_VERSION,
  TeacherCopySnapshotV4Error,
  createTeacherCopySnapshotV4,
  type TeacherCopyEventSnapshotV4,
  type TeacherCopySnapshotV4
} from '../../editor-teacher-copy-snapshot-v4/src/index.js';

export const EDITOR_PROFESSIONAL_RANGE_REPLACE_V1_VERSION = '1.0.0' as const;

export interface ProfessionalRangeReplaceAdmissionV1 {
  readonly version: typeof EDITOR_PROFESSIONAL_RANGE_REPLACE_V1_VERSION;
  readonly kind: 'PROFESSIONAL_RANGE_REPLACE_ADMISSION';
  readonly admitted: true;
  readonly sourceRevisionId: string;
  readonly sourceEventIds: readonly string[];
  readonly sourceEventCount: number;
  readonly sourceNoteCount: number;
  readonly destinationEventIds: readonly string[];
  readonly destinationRemovedNoteIds: readonly string[];
  readonly destinationEventCount: number;
  readonly destinationNoteCount: number;
  readonly measureId: string;
  readonly partId: string;
  readonly staffId: string;
  readonly voiceOrdinal: number;
  readonly sourceExtent: Rational;
  readonly destinationExtent: Rational;
  readonly destinationStart: Rational;
  readonly destinationDirection: 'FORWARD' | 'BACKWARD';
  readonly identityAllocationRequired: true;
  readonly identityAllocationPerformed: false;
  readonly relationRemappingRequired: false;
  readonly canonicalMutationAuthority: false;
  readonly historyMutationAuthority: false;
}

export type ProfessionalRangeReplaceV1ErrorCode =
  | 'INVALID_COPY_SNAPSHOT'
  | 'CLIPBOARD_STALE'
  | 'SELECTION_KIND_UNSUPPORTED'
  | 'SELECTION_STALE_OR_TAMPERED'
  | 'SOURCE_MEASURE_UNSUPPORTED'
  | 'DESTINATION_MEASURE_UNSUPPORTED'
  | 'SCOPE_MISMATCH'
  | 'SOURCE_DESTINATION_OVERLAP'
  | 'SOURCE_TIMING_INVALID'
  | 'DESTINATION_TIMING_INVALID'
  | 'REPLACE_EXTENT_MISMATCH'
  | 'SOURCE_RELATION_UNSUPPORTED'
  | 'DESTINATION_RELATION_UNSUPPORTED'
  | 'NOTATION_STALE_OR_INVALID'
  | 'INVALID_REVISION_ID'
  | 'ADMISSION_STALE_OR_TAMPERED'
  | 'IDENTITY_PLAN_STALE_OR_INVALID'
  | 'TARGET_PLAN_INVALID'
  | 'RESULT_INVALID'
  | 'NOTATION_RESULT_INVALID'
  | 'RESULT_SELECTION_INVALID'
  | 'ID_COLLISION';

export class ProfessionalRangeReplaceV1Error extends Error {
  readonly code: ProfessionalRangeReplaceV1ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: ProfessionalRangeReplaceV1ErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ProfessionalRangeReplaceV1Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

type ReplaceTimingErrorCode = 'SOURCE_TIMING_INVALID' | 'DESTINATION_TIMING_INVALID';

const absBigInt = (value: bigint): bigint => value < 0n ? -value : value;

const exactGcd = (left: bigint, right: bigint): bigint => {
  const a = absBigInt(left);
  const b = absBigInt(right);
  if (b === 0n) return a === 0n ? 1n : a;
  return exactGcd(b, a % b);
};

const exactFraction = (
  numerator: bigint,
  denominator: bigint,
  code: ReplaceTimingErrorCode
): Readonly<Rational> => {
  if (numerator < 0n || denominator <= 0n) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replace produced invalid exact timing.',
      code
    );
  }
  const divisor = exactGcd(numerator, denominator);
  const reduced = Object.freeze({
    numerator: numerator / divisor,
    denominator: denominator / divisor
  });
  const safeLimit = BigInt(Number.MAX_SAFE_INTEGER);
  if (reduced.numerator > safeLimit || reduced.denominator > safeLimit) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replace timing exceeded exact safe-integer range.',
      code
    );
  }
  return Object.freeze({
    numerator: Number(reduced.numerator),
    denominator: Number(reduced.denominator)
  });
};

const exactBinary = (
  left: Rational,
  right: Rational,
  operation: 'ADD' | 'SUBTRACT',
  code: ReplaceTimingErrorCode
): Readonly<Rational> => {
  const leftScaled = BigInt(left.numerator) * BigInt(right.denominator);
  const rightScaled = BigInt(right.numerator) * BigInt(left.denominator);
  return exactFraction(
    operation === 'ADD' ? leftScaled + rightScaled : leftScaled - rightScaled,
    BigInt(left.denominator) * BigInt(right.denominator),
    code
  );
};

const add = (
  left: Rational,
  right: Rational,
  code: ReplaceTimingErrorCode
): Readonly<Rational> => exactBinary(left, right, 'ADD', code);

const subtract = (
  left: Rational,
  right: Rational,
  code: ReplaceTimingErrorCode
): Readonly<Rational> => exactBinary(left, right, 'SUBTRACT', code);

const compare = (left: Rational, right: Rational): number => {
  const difference =
    BigInt(left.numerator) * BigInt(right.denominator) -
    BigInt(right.numerator) * BigInt(left.denominator);
  return difference === 0n ? 0 : difference < 0n ? -1 : 1;
};

const validRational = (value: Rational, allowZero: boolean): boolean => {
  if (
    !Number.isSafeInteger(value.numerator) ||
    !Number.isSafeInteger(value.denominator) ||
    value.denominator <= 0 ||
    (allowZero ? value.numerator < 0 : value.numerator <= 0)
  ) return false;
  return exactGcd(BigInt(value.numerator), BigInt(value.denominator)) === 1n;
};

const ZERO: Readonly<Rational> = Object.freeze({ numerator: 0, denominator: 1 });

const notesOf = (event: ScoreEvent): readonly { readonly id: string }[] =>
  event.kind === 'note' ? [event.note] : event.kind === 'chord' ? event.notes : [];

const spanningOrnament = (
  notation: NotationDocumentV4['events'][number]['notation']
): boolean => notation.ornaments.some(ornament =>
  ornament.kind === 'wavy-line' || (ornament.kind === 'tremolo' && ornament.type !== 'single'));

const selectionFacts = (selection: EventSpanProfessionalSelectionV1): unknown => ({
  version: selection.version,
  kind: selection.kind,
  anchorEventId: selection.anchor.eventId,
  focusEventId: selection.focus.eventId,
  direction: selection.direction,
  scope: selection.scope,
  targetEventIds: selection.targets.map(target => target.eventId)
});

const currentEventSpan = (
  score: ScoreDocumentV3,
  selection: ProfessionalSelectionV1
): Readonly<EventSpanProfessionalSelectionV1> => {
  if (selection.kind !== 'EVENT_SPAN') {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replace supports contiguous EVENT_SPAN selection only.',
      'SELECTION_KIND_UNSUPPORTED',
      { kind: selection.kind }
    );
  }
  let current: Readonly<EventSpanProfessionalSelectionV1>;
  try {
    current = createEventSpanProfessionalSelectionV1(score, selection.anchor, selection.focus);
  } catch (error) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range selection no longer resolves against the current score revision.',
      'SELECTION_STALE_OR_TAMPERED',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  if (JSON.stringify(selectionFacts(current)) !== JSON.stringify(selectionFacts(selection))) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range selection facts changed or were tampered with.',
      'SELECTION_STALE_OR_TAMPERED'
    );
  }
  return current;
};

const oneMeasure = (
  selection: EventSpanProfessionalSelectionV1,
  code: 'SOURCE_MEASURE_UNSUPPORTED' | 'DESTINATION_MEASURE_UNSUPPORTED'
): string => {
  const measureIds = new Set(selection.targets.map(target => target.measureId));
  if (measureIds.size !== 1) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replace v1 requires one exact measure.',
      code,
      { measureIds: [...measureIds] }
    );
  }
  return selection.targets[0]!.measureId;
};

const copyError = (error: unknown): never => {
  if (error instanceof ProfessionalRangeReplaceV1Error) throw error;
  if (error instanceof TeacherCopySnapshotV4Error) {
    if (error.code === 'RELATION_COUPLED_SOURCE' || error.code === 'GRACE_COUPLED_SOURCE') {
      throw new ProfessionalRangeReplaceV1Error(
        'Professional range source contains relation-coupled notation that v1 cannot remap.',
        'SOURCE_RELATION_UNSUPPORTED',
        { cause: error.message, ...error.details }
      );
    }
    if (error.code === 'TIME_NORMALIZATION_INVALID') {
      throw new ProfessionalRangeReplaceV1Error(
        'Professional range source timing cannot be normalized exactly.',
        'SOURCE_TIMING_INVALID',
        { cause: error.message, ...error.details }
      );
    }
    if (error.code === 'SPAN_STALE_OR_INVALID' || error.code === 'SOURCE_EVENT_NOT_FOUND') {
      throw new ProfessionalRangeReplaceV1Error(
        'Professional range source no longer resolves in the current score.',
        'SELECTION_STALE_OR_TAMPERED',
        { cause: error.message, ...error.details }
      );
    }
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range copy snapshot could not be created safely.',
      'INVALID_COPY_SNAPSHOT',
      { cause: error.message, sourceCode: error.code, ...error.details }
    );
  }
  throw new ProfessionalRangeReplaceV1Error(
    'Professional range copy snapshot failed unexpectedly.',
    'INVALID_COPY_SNAPSHOT',
    { cause: error instanceof Error ? error.message : String(error) }
  );
};

export const createProfessionalRangeCopySnapshotV1 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  selectionInput: ProfessionalSelectionV1
): Readonly<TeacherCopySnapshotV4> => {
  const score = createScoreDocumentV3(scoreInput);
  const selection = currentEventSpan(score, selectionInput);
  oneMeasure(selection, 'SOURCE_MEASURE_UNSUPPORTED');
  const first = selection.targets[0];
  const last = selection.targets.at(-1);
  if (first === undefined || last === undefined) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range source selection is empty.',
      'SELECTION_STALE_OR_TAMPERED'
    );
  }
  try {
    const teacherSpan = createTeacherEventSpanSelectionV4(score, first, last);
    if (teacherSpan.crossesMeasureBoundary || teacherSpan.measureIds.length !== 1) {
      throw new ProfessionalRangeReplaceV1Error(
        'Professional range copy v1 requires one source measure.',
        'SOURCE_MEASURE_UNSUPPORTED'
      );
    }
    return createTeacherCopySnapshotV4(score, notationInput, teacherSpan);
  } catch (error) {
    return copyError(error);
  }
};

const snapshotEnvelope = (
  snapshot: TeacherCopySnapshotV4
): readonly TeacherCopyEventSnapshotV4[] => {
  if (
    snapshot.version !== EDITOR_TEACHER_COPY_SNAPSHOT_V4_VERSION ||
    snapshot.kind !== 'TEACHER_COPY_SNAPSHOT' ||
    snapshot.destinationIdentityAssigned !== false ||
    snapshot.canonicalMutationAuthority !== false ||
    snapshot.historyMutationAuthority !== false ||
    snapshot.crossesMeasureBoundary ||
    snapshot.segments.length !== 1 ||
    !Number.isSafeInteger(snapshot.eventCount) ||
    snapshot.eventCount <= 0 ||
    !Number.isSafeInteger(snapshot.noteCount) ||
    snapshot.noteCount < 0
  ) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replace copy snapshot envelope is invalid.',
      'INVALID_COPY_SNAPSHOT'
    );
  }
  const segment = snapshot.segments[0]!;
  if (
    segment.frameOffset !== 0 ||
    !Array.isArray(segment.events) ||
    segment.events.length !== snapshot.eventCount
  ) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replace copy segment metadata is invalid.',
      'INVALID_COPY_SNAPSHOT'
    );
  }
  return segment.events;
};

const sourceTiming = (
  snapshot: TeacherCopySnapshotV4,
  events: readonly TeacherCopyEventSnapshotV4[]
): Readonly<Rational> => {
  let previousEnd: Readonly<Rational> | null = null;
  let noteCount = 0;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]!;
    if (
      !validRational(event.onsetFromSegmentOrigin, true) ||
      !validRational(event.duration, false) ||
      !Array.isArray(event.notes) ||
      (event.kind === 'rest' && event.notes.length !== 0) ||
      (event.kind === 'note' && event.notes.length !== 1) ||
      (event.kind === 'chord' && event.notes.length < 2)
    ) {
      throw new ProfessionalRangeReplaceV1Error(
        'Professional range source timing/content is invalid.',
        'SOURCE_TIMING_INVALID',
        { sourceEventId: event.sourceEventId }
      );
    }
    if (index === 0 && compare(event.onsetFromSegmentOrigin, ZERO) !== 0) {
      throw new ProfessionalRangeReplaceV1Error(
        'Professional range source must begin at exact relative onset zero.',
        'SOURCE_TIMING_INVALID',
        { sourceEventId: event.sourceEventId, onset: event.onsetFromSegmentOrigin }
      );
    }
    if (previousEnd !== null && compare(event.onsetFromSegmentOrigin, previousEnd) !== 0) {
      throw new ProfessionalRangeReplaceV1Error(
        'Professional range source contains a hidden timing gap or overlap.',
        'SOURCE_TIMING_INVALID',
        {
          sourceEventId: event.sourceEventId,
          expectedOnset: previousEnd,
          observedOnset: event.onsetFromSegmentOrigin
        }
      );
    }
    previousEnd = add(event.onsetFromSegmentOrigin, event.duration, 'SOURCE_TIMING_INVALID');
    noteCount += event.notes.length;
  }
  if (noteCount !== snapshot.noteCount || previousEnd === null || previousEnd.numerator === 0) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range source snapshot counts or extent are invalid.',
      'INVALID_COPY_SNAPSHOT',
      { expectedNoteCount: snapshot.noteCount, observedNoteCount: noteCount }
    );
  }
  return previousEnd;
};

const resolvedDestinationEvents = (
  score: ScoreDocumentV3,
  selection: EventSpanProfessionalSelectionV1
): readonly ScoreEvent[] => selection.targets.map(target => {
  try {
    const resolved = resolveSemanticAddressV3(score, target);
    if (resolved.kind !== 'event') throw new Error('target is not an event');
    return resolved.value;
  } catch (error) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range destination no longer resolves.',
      'SELECTION_STALE_OR_TAMPERED',
      { eventId: target.eventId, cause: error instanceof Error ? error.message : String(error) }
    );
  }
});

const destinationTiming = (events: readonly ScoreEvent[]): Readonly<{
  start: Readonly<Rational>;
  extent: Readonly<Rational>;
}> => {
  const first = events[0];
  if (first === undefined || !validRational(first.onset, true) || !validRational(first.duration, false)) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range destination timing is invalid.',
      'DESTINATION_TIMING_INVALID'
    );
  }
  let previousEnd = add(first.onset, first.duration, 'DESTINATION_TIMING_INVALID');
  for (let index = 1; index < events.length; index += 1) {
    const event = events[index]!;
    if (!validRational(event.onset, true) || !validRational(event.duration, false)) {
      throw new ProfessionalRangeReplaceV1Error(
        'Professional range destination timing is invalid.',
        'DESTINATION_TIMING_INVALID',
        { eventId: event.id }
      );
    }
    if (compare(event.onset, previousEnd) !== 0) {
      throw new ProfessionalRangeReplaceV1Error(
        'Professional range destination contains a hidden timing gap or overlap.',
        'DESTINATION_TIMING_INVALID',
        { eventId: event.id, expectedOnset: previousEnd, observedOnset: event.onset }
      );
    }
    previousEnd = add(event.onset, event.duration, 'DESTINATION_TIMING_INVALID');
  }
  return Object.freeze({
    start: Object.freeze({ ...first.onset }),
    extent: subtract(previousEnd, first.onset, 'DESTINATION_TIMING_INVALID')
  });
};

const assertRelationFree = (
  score: ScoreDocumentV3,
  notation: NotationDocumentV4,
  eventIds: ReadonlySet<string>,
  noteIds: ReadonlySet<string>,
  code: 'SOURCE_RELATION_UNSUPPORTED' | 'DESTINATION_RELATION_UNSUPPORTED'
): void => {
  for (const entry of notation.events) {
    if (!eventIds.has(entry.target.eventId)) continue;
    if (
      entry.notation.beams.length > 0 ||
      entry.notation.tuplet !== null ||
      spanningOrnament(entry.notation)
    ) {
      throw new ProfessionalRangeReplaceV1Error(
        'Professional range contains event-level relation coupling that v1 cannot remap.',
        code,
        { eventId: entry.target.eventId }
      );
    }
  }
  for (const entry of notation.notes) {
    if (!noteIds.has(entry.target.noteId)) continue;
    if (entry.notation.ties.length > 0 || entry.notation.slurs.length > 0) {
      throw new ProfessionalRangeReplaceV1Error(
        'Professional range contains tie/slur coupling that v1 cannot remap.',
        code,
        { noteId: entry.target.noteId }
      );
    }
  }
  for (const placement of notation.crossStaffPlacements) {
    if (eventIds.has(placement.source.eventId)) {
      throw new ProfessionalRangeReplaceV1Error(
        'Professional range contains cross-staff coupling that v1 cannot remap.',
        code,
        { eventId: placement.source.eventId }
      );
    }
  }
  for (const part of score.parts) for (const staff of part.staves) {
    if (staff.role === 'tablature-linked') continue;
    for (const measure of staff.measures) for (const voice of measure.voices) {
      const coupled = voice.graceGroups.find(group => eventIds.has(group.anchorEventId));
      if (coupled !== undefined) {
        throw new ProfessionalRangeReplaceV1Error(
          'Professional range contains grace-group coupling that v1 cannot remap.',
          code,
          { anchorEventId: coupled.anchorEventId, graceGroupId: coupled.id }
        );
      }
    }
  }
};

export const analyzeProfessionalRangeReplaceV1 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  snapshotInput: TeacherCopySnapshotV4,
  destinationInput: ProfessionalSelectionV1
): Readonly<ProfessionalRangeReplaceAdmissionV1> => {
  const score = createScoreDocumentV3(scoreInput);
  let notation: Readonly<NotationDocumentV4>;
  try {
    notation = createNotationDocumentV4(score, notationInput);
  } catch (error) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replace notation is stale or invalid.',
      'NOTATION_STALE_OR_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }

  const sourceEvents = snapshotEnvelope(snapshotInput);
  if (
    snapshotInput.sourceDocumentId !== score.id ||
    snapshotInput.sourceRevisionId !== score.revision.id
  ) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replace requires a copy snapshot from the exact current revision.',
      'CLIPBOARD_STALE',
      {
        snapshotDocumentId: snapshotInput.sourceDocumentId,
        currentDocumentId: score.id,
        snapshotRevisionId: snapshotInput.sourceRevisionId,
        currentRevisionId: score.revision.id
      }
    );
  }

  const destination = currentEventSpan(score, destinationInput);

  if (
    snapshotInput.sourcePartId !== destination.scope.partId ||
    snapshotInput.sourceStaffId !== destination.scope.staffId ||
    snapshotInput.sourceVoiceOrdinal !== destination.scope.voiceOrdinal
  ) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replace requires source and destination in one part/staff/Voice scope.',
      'SCOPE_MISMATCH',
      {
        sourcePartId: snapshotInput.sourcePartId,
        destinationPartId: destination.scope.partId,
        sourceStaffId: snapshotInput.sourceStaffId,
        destinationStaffId: destination.scope.staffId,
        sourceVoiceOrdinal: snapshotInput.sourceVoiceOrdinal,
        destinationVoiceOrdinal: destination.scope.voiceOrdinal
      }
    );
  }

  const sourceMeasureId = snapshotInput.segments[0]!.sourceMeasureId;
  const destinationMeasureId = oneMeasure(destination, 'DESTINATION_MEASURE_UNSUPPORTED');
  if (sourceMeasureId !== destinationMeasureId) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replace v1 requires source and destination in the same exact measure.',
      'DESTINATION_MEASURE_UNSUPPORTED',
      { sourceMeasureId, destinationMeasureId }
    );
  }

  const sourceIds = new Set(sourceEvents.map(event => event.sourceEventId));
  const destinationIds = destination.targets.map(target => target.eventId);
  const overlap = destinationIds.find(eventId => sourceIds.has(eventId));
  if (overlap !== undefined) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replace source and destination may not share events.',
      'SOURCE_DESTINATION_OVERLAP',
      { eventId: overlap }
    );
  }

  const sourceExtent = sourceTiming(snapshotInput, sourceEvents);
  const destinationEvents = resolvedDestinationEvents(score, destination);
  const destinationTimingFacts = destinationTiming(destinationEvents);

  const sourceEventIds = Object.freeze(sourceEvents.map(event => event.sourceEventId));
  const sourceNoteIds = new Set(sourceEvents.flatMap(event => event.notes.map(note => note.sourceNoteId)));
  const destinationEventIds = Object.freeze([...destinationIds]);
  const destinationRemovedNoteIds = Object.freeze(
    destinationEvents.flatMap(event => notesOf(event).map(note => note.id))
  );
  const destinationNoteIds = new Set(destinationRemovedNoteIds);

  assertRelationFree(score, notation, new Set(sourceEventIds), sourceNoteIds, 'SOURCE_RELATION_UNSUPPORTED');
  assertRelationFree(score, notation, new Set(destinationEventIds), destinationNoteIds, 'DESTINATION_RELATION_UNSUPPORTED');

  if (compare(sourceExtent, destinationTimingFacts.extent) !== 0) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replace requires exactly equal source and destination extents.',
      'REPLACE_EXTENT_MISMATCH',
      { sourceExtent, destinationExtent: destinationTimingFacts.extent }
    );
  }

  return Object.freeze({
    version: EDITOR_PROFESSIONAL_RANGE_REPLACE_V1_VERSION,
    kind: 'PROFESSIONAL_RANGE_REPLACE_ADMISSION' as const,
    admitted: true as const,
    sourceRevisionId: score.revision.id,
    sourceEventIds,
    sourceEventCount: sourceEventIds.length,
    sourceNoteCount: snapshotInput.noteCount,
    destinationEventIds,
    destinationRemovedNoteIds,
    destinationEventCount: destinationEventIds.length,
    destinationNoteCount: destinationRemovedNoteIds.length,
    measureId: sourceMeasureId,
    partId: snapshotInput.sourcePartId,
    staffId: snapshotInput.sourceStaffId,
    voiceOrdinal: snapshotInput.sourceVoiceOrdinal,
    sourceExtent: Object.freeze({ ...sourceExtent }),
    destinationExtent: Object.freeze({ ...destinationTimingFacts.extent }),
    destinationStart: Object.freeze({ ...destinationTimingFacts.start }),
    destinationDirection: destination.direction,
    identityAllocationRequired: true as const,
    identityAllocationPerformed: false as const,
    relationRemappingRequired: false as const,
    canonicalMutationAuthority: false as const,
    historyMutationAuthority: false as const
  });
};

export interface ProfessionalRangeReplaceNoteIdentityPlanV1 {
  readonly sourceNoteId: string;
  readonly destinationNoteId: string;
}

export interface ProfessionalRangeReplaceEventIdentityPlanV1 {
  readonly sourceEventId: string;
  readonly destinationEventId: string;
  readonly notes: readonly ProfessionalRangeReplaceNoteIdentityPlanV1[];
}

export interface ProfessionalRangeReplaceIdentityPlanV1 {
  readonly version: typeof EDITOR_PROFESSIONAL_RANGE_REPLACE_V1_VERSION;
  readonly kind: 'PROFESSIONAL_RANGE_REPLACE_IDENTITY_PLAN';
  readonly documentId: string;
  readonly sourceRevisionId: string;
  readonly nextRevisionId: string;
  readonly destinationStartEventId: string;
  readonly destinationStopEventId: string;
  readonly events: readonly ProfessionalRangeReplaceEventIdentityPlanV1[];
  readonly eventIdentityCount: number;
  readonly noteIdentityCount: number;
  readonly relationIdentityCount: 0;
  readonly identityAllocationPerformed: false;
  readonly canonicalMutationAuthority: false;
  readonly historyMutationAuthority: false;
}

const REPLACE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MASK_64 = (1n << 64n) - 1n;
const FNV_OFFSET_64 = 14695981039346656037n;
const FNV_PRIME_64 = 1099511628211n;

const allCanonicalIds = (score: ScoreDocumentV3): ReadonlySet<string> => {
  const ids = new Set<string>();
  const pending: unknown[] = [score];
  while (pending.length > 0) {
    const value = pending.pop();
    if (Array.isArray(value)) {
      pending.push(...value);
      continue;
    }
    if (value === null || typeof value !== 'object') continue;
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'id' && typeof nested === 'string') ids.add(nested);
      if (nested !== null && typeof nested === 'object') pending.push(nested);
    }
  }
  return ids;
};

const fnv1a64 = (value: string): string =>
  value.split('').reduce(
    (hash, character) =>
      ((hash ^ BigInt(character.charCodeAt(0))) * FNV_PRIME_64) & MASK_64,
    FNV_OFFSET_64
  ).toString(16).padStart(16, '0');

const assertFreshReplaceRevision = (score: ScoreDocumentV3, nextRevisionId: string): void => {
  if (
    !REPLACE_ID.test(nextRevisionId) ||
    nextRevisionId === score.revision.id ||
    nextRevisionId === score.revision.parentId
  ) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replace identity planning requires a fresh stable revision id.',
      'INVALID_REVISION_ID',
      {
        nextRevisionId,
        currentRevisionId: score.revision.id,
        parentRevisionId: score.revision.parentId
      }
    );
  }
};

const sameReplaceAdmission = (
  left: ProfessionalRangeReplaceAdmissionV1,
  right: ProfessionalRangeReplaceAdmissionV1
): boolean => JSON.stringify(left) === JSON.stringify(right);

const replacementPlannedId = (
  prefix: 'replace-event' | 'replace-note',
  score: ScoreDocumentV3,
  destination: EventSpanProfessionalSelectionV1,
  nextRevisionId: string,
  discriminator: string
): string => `${prefix}:${fnv1a64(
  `${score.id}|${score.revision.id}|${destination.targets[0]!.eventId}|${destination.targets.at(-1)!.eventId}|${nextRevisionId}|${discriminator}`
)}`;

const reserveReplacementIdentity = (
  id: string,
  occupied: ReadonlySet<string>,
  planned: Set<string>,
  sourceDetails: Readonly<Record<string, string>>
): string => {
  if (occupied.has(id) || planned.has(id)) {
    throw new ProfessionalRangeReplaceV1Error(
      'Deterministic professional replacement identity collides with canonical or planned identity.',
      'ID_COLLISION',
      { id, ...sourceDetails }
    );
  }
  planned.add(id);
  return id;
};

export const planProfessionalRangeReplaceIdentitiesV1 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  snapshotInput: TeacherCopySnapshotV4,
  destinationInput: EventSpanProfessionalSelectionV1,
  admissionInput: ProfessionalRangeReplaceAdmissionV1,
  nextRevisionId: string
): Readonly<ProfessionalRangeReplaceIdentityPlanV1> => {
  const score = createScoreDocumentV3(scoreInput);
  assertFreshReplaceRevision(score, nextRevisionId);

  let currentAdmission: Readonly<ProfessionalRangeReplaceAdmissionV1>;
  try {
    currentAdmission = analyzeProfessionalRangeReplaceV1(
      score,
      notationInput,
      snapshotInput,
      destinationInput
    );
  } catch (error) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replace admission no longer revalidates before identity planning.',
      'ADMISSION_STALE_OR_TAMPERED',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  if (!sameReplaceAdmission(admissionInput, currentAdmission)) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replace admission facts changed before identity planning.',
      'ADMISSION_STALE_OR_TAMPERED'
    );
  }

  const sourceEvents = snapshotEnvelope(snapshotInput);
  if (
    sourceEvents.length !== currentAdmission.sourceEventCount ||
    sourceEvents.length !== snapshotInput.eventCount
  ) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replace snapshot no longer contains the admitted source event set.',
      'INVALID_COPY_SNAPSHOT'
    );
  }

  const destination = currentEventSpan(score, destinationInput);
  const firstDestination = destination.targets[0];
  const lastDestination = destination.targets.at(-1);
  if (firstDestination === undefined || lastDestination === undefined) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replace destination identity range is empty.',
      'SELECTION_STALE_OR_TAMPERED'
    );
  }

  const occupied = allCanonicalIds(score);
  const planned = new Set<string>();
  let noteIdentityCount = 0;
  const events = sourceEvents.map((event, eventIndex) => {
    const destinationEventId = reserveReplacementIdentity(
      replacementPlannedId(
        'replace-event',
        score,
        destination,
        nextRevisionId,
        `event|${eventIndex}|${event.sourceEventId}`
      ),
      occupied,
      planned,
      { sourceEventId: event.sourceEventId }
    );

    const notes = event.notes.map((note, noteIndex) => {
      const destinationNoteId = reserveReplacementIdentity(
        replacementPlannedId(
          'replace-note',
          score,
          destination,
          nextRevisionId,
          `note|${eventIndex}|${noteIndex}|${note.sourceNoteId}`
        ),
        occupied,
        planned,
        { sourceNoteId: note.sourceNoteId }
      );
      noteIdentityCount += 1;
      return Object.freeze({ sourceNoteId: note.sourceNoteId, destinationNoteId });
    });

    return Object.freeze({
      sourceEventId: event.sourceEventId,
      destinationEventId,
      notes: Object.freeze(notes)
    });
  });

  if (events.length !== snapshotInput.eventCount || noteIdentityCount !== snapshotInput.noteCount) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replace planned identity counts do not match the source snapshot.',
      'INVALID_COPY_SNAPSHOT',
      {
        expectedEvents: snapshotInput.eventCount,
        plannedEvents: events.length,
        expectedNotes: snapshotInput.noteCount,
        plannedNotes: noteIdentityCount
      }
    );
  }

  return Object.freeze({
    version: EDITOR_PROFESSIONAL_RANGE_REPLACE_V1_VERSION,
    kind: 'PROFESSIONAL_RANGE_REPLACE_IDENTITY_PLAN' as const,
    documentId: score.id,
    sourceRevisionId: score.revision.id,
    nextRevisionId,
    destinationStartEventId: firstDestination.eventId,
    destinationStopEventId: lastDestination.eventId,
    events: Object.freeze(events),
    eventIdentityCount: events.length,
    noteIdentityCount,
    relationIdentityCount: 0 as const,
    identityAllocationPerformed: false as const,
    canonicalMutationAuthority: false as const,
    historyMutationAuthority: false as const
  });
};

export interface ProfessionalRangeReplaceResultV1 {
  readonly version: typeof EDITOR_PROFESSIONAL_RANGE_REPLACE_V1_VERSION;
  readonly score: Readonly<ScoreDocumentV3>;
  readonly notation: Readonly<NotationDocumentV4>;
  readonly selection: Readonly<EventSpanProfessionalSelectionV1>;
  readonly admission: Readonly<ProfessionalRangeReplaceAdmissionV1>;
  readonly identityPlan: Readonly<ProfessionalRangeReplaceIdentityPlanV1>;
  readonly insertedEventIds: readonly string[];
  readonly insertedNoteIds: readonly string[];
  readonly removedDestinationEventIds: readonly string[];
  readonly removedDestinationNoteIds: readonly string[];
  readonly historyMutationAuthority: false;
}

const sameJson = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const semanticTargetId = (address: SemanticAddressV3): string => {
  if ('graceNoteId' in address) return address.graceNoteId;
  if ('graceEventId' in address) return address.graceEventId;
  if ('graceGroupId' in address) return address.graceGroupId;
  if ('noteId' in address) return address.noteId;
  if ('eventId' in address) return address.eventId;
  if ('voiceId' in address) return address.voiceId;
  if ('measureId' in address) return address.measureId;
  if ('staffId' in address) return address.staffId;
  if ('partId' in address) return address.partId;
  if ('frameId' in address) return address.frameId;
  return address.documentId;
};

const rebindReplaceAddress = (
  score: ScoreDocumentV3,
  address: SemanticAddressV3
): SemanticAddressV3 => {
  const id = semanticTargetId(address);
  const rebound = addressEntityV3(score, id);
  if (rebound.kind !== address.kind) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replacement changed semantic target kind while rebinding notation.',
      'NOTATION_RESULT_INVALID',
      { id, expectedKind: address.kind, observedKind: rebound.kind }
    );
  }
  return rebound;
};

const revalidateCopySnapshot = (
  score: ScoreDocumentV3,
  notation: NotationDocumentV4,
  snapshot: TeacherCopySnapshotV4
): Readonly<TeacherCopySnapshotV4> => {
  let start: SemanticAddressV3;
  let stop: SemanticAddressV3;
  try {
    start = addressEntityV3(score, snapshot.sourceStartEventId);
    stop = addressEntityV3(score, snapshot.sourceStopEventId);
  } catch (error) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replacement source snapshot no longer resolves.',
      'ADMISSION_STALE_OR_TAMPERED',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  if (start.kind !== 'event' || stop.kind !== 'event') {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replacement source snapshot endpoints are not normal events.',
      'ADMISSION_STALE_OR_TAMPERED'
    );
  }
  let current: Readonly<TeacherCopySnapshotV4>;
  try {
    current = createTeacherCopySnapshotV4(
      score,
      notation,
      createTeacherEventSpanSelectionV4(score, start, stop)
    );
  } catch (error) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replacement source snapshot no longer revalidates.',
      error instanceof TeacherCopySnapshotV4Error &&
        (error.code === 'RELATION_COUPLED_SOURCE' || error.code === 'GRACE_COUPLED_SOURCE')
        ? 'SOURCE_RELATION_UNSUPPORTED'
        : 'ADMISSION_STALE_OR_TAMPERED',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  if (!sameJson(current, snapshot)) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replacement source snapshot facts changed or were tampered with.',
      'ADMISSION_STALE_OR_TAMPERED'
    );
  }
  return current;
};

const buildReplacementEvent = (
  source: TeacherCopyEventSnapshotV4,
  identities: ProfessionalRangeReplaceEventIdentityPlanV1,
  destinationStart: Rational
): ScoreEvent => {
  if (
    source.sourceEventId !== identities.sourceEventId ||
    source.notes.length !== identities.notes.length
  ) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replacement source content no longer matches the identity plan.',
      'IDENTITY_PLAN_STALE_OR_INVALID',
      { sourceEventId: source.sourceEventId }
    );
  }

  const common = Object.freeze({
    id: identities.destinationEventId,
    onset: add(destinationStart, source.onsetFromSegmentOrigin, 'DESTINATION_TIMING_INVALID'),
    duration: Object.freeze({ ...source.duration })
  });

  switch (source.kind) {
    case 'rest': {
      if (source.notes.length !== 0) {
        throw new ProfessionalRangeReplaceV1Error(
          'Professional range replacement rest snapshot unexpectedly carries notes.',
          'ADMISSION_STALE_OR_TAMPERED',
          { sourceEventId: source.sourceEventId }
        );
      }
      return Object.freeze({ ...common, kind: 'rest' as const });
    }
    case 'note': {
      const sourceNote = source.notes[0];
      const plannedNote = identities.notes[0];
      if (
        sourceNote === undefined ||
        plannedNote === undefined ||
        sourceNote.sourceNoteId !== plannedNote.sourceNoteId
      ) {
        throw new ProfessionalRangeReplaceV1Error(
          'Professional range replacement note identity mapping is invalid.',
          'IDENTITY_PLAN_STALE_OR_INVALID',
          { sourceEventId: source.sourceEventId }
        );
      }
      return Object.freeze({
        ...common,
        kind: 'note' as const,
        note: Object.freeze({
          id: plannedNote.destinationNoteId,
          pitch: Object.freeze({ ...sourceNote.pitch })
        })
      });
    }
    case 'chord': {
      if (source.notes.length < 2) {
        throw new ProfessionalRangeReplaceV1Error(
          'Professional range replacement chord snapshot contains too few notes.',
          'ADMISSION_STALE_OR_TAMPERED',
          { sourceEventId: source.sourceEventId }
        );
      }
      const notes = source.notes.map((sourceNote, noteIndex) => {
        const plannedNote = identities.notes[noteIndex];
        if (plannedNote === undefined || plannedNote.sourceNoteId !== sourceNote.sourceNoteId) {
          throw new ProfessionalRangeReplaceV1Error(
            'Professional range replacement chord identity mapping is invalid.',
            'IDENTITY_PLAN_STALE_OR_INVALID',
            { sourceEventId: source.sourceEventId, sourceNoteId: sourceNote.sourceNoteId }
          );
        }
        return Object.freeze({
          id: plannedNote.destinationNoteId,
          pitch: Object.freeze({ ...sourceNote.pitch })
        });
      });
      return Object.freeze({ ...common, kind: 'chord' as const, notes: Object.freeze(notes) });
    }
  }
};

const mutateReplacementScore = (
  score: ScoreDocumentV3,
  snapshot: TeacherCopySnapshotV4,
  destination: EventSpanProfessionalSelectionV1,
  admission: ProfessionalRangeReplaceAdmissionV1,
  identityPlan: ProfessionalRangeReplaceIdentityPlanV1
): Readonly<ScoreDocumentV3> => {
  const raw = structuredClone(score) as ScoreDocumentV3;
  const firstTarget = destination.targets[0];
  if (firstTarget === undefined) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replacement destination target list is empty.',
      'TARGET_PLAN_INVALID'
    );
  }
  const part = raw.parts.find(item => item.id === firstTarget.partId);
  const staff = part?.staves.find(item => item.id === firstTarget.staffId);
  if (staff === undefined || staff.role === 'tablature-linked') {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replacement destination staff no longer resolves.',
      'TARGET_PLAN_INVALID'
    );
  }
  const measure = staff.measures.find(item =>
    item.id === firstTarget.measureId && item.frameId === firstTarget.frameId
  );
  const voice = measure?.voices.find(item => item.id === firstTarget.voiceId);
  if (voice === undefined) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replacement destination Voice no longer resolves.',
      'TARGET_PLAN_INVALID'
    );
  }

  const expectedIds = admission.destinationEventIds;
  const startIndex = voice.events.findIndex(event => event.id === expectedIds[0]);
  if (startIndex < 0) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replacement destination start no longer exists.',
      'TARGET_PLAN_INVALID'
    );
  }
  const observedIds = voice.events
    .slice(startIndex, startIndex + expectedIds.length)
    .map(event => event.id);
  if (!sameJson(observedIds, expectedIds)) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replacement destination slice changed before mutation.',
      'TARGET_PLAN_INVALID',
      { expectedIds, observedIds }
    );
  }
  if (
    identityPlan.destinationStartEventId !== expectedIds[0] ||
    identityPlan.destinationStopEventId !== expectedIds.at(-1)
  ) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replacement identity plan targets a different destination slice.',
      'IDENTITY_PLAN_STALE_OR_INVALID'
    );
  }

  const sourceEvents = snapshot.segments[0]?.events;
  if (sourceEvents === undefined || sourceEvents.length !== identityPlan.events.length) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replacement source and identity event counts diverged.',
      'IDENTITY_PLAN_STALE_OR_INVALID'
    );
  }
  const inserted = sourceEvents.map((source, index) =>
    buildReplacementEvent(
      source,
      identityPlan.events[index]!,
      admission.destinationStart
    )
  );

  (voice.events as ScoreEvent[]).splice(startIndex, expectedIds.length, ...inserted);
  Object.assign(raw, {
    revision: Object.freeze({
      id: identityPlan.nextRevisionId,
      parentId: score.revision.id
    })
  });

  try {
    return createScoreDocumentV3(raw);
  } catch (error) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replacement score candidate failed canonical validation.',
      'RESULT_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

const buildReplacementNotation = (
  resultScore: ScoreDocumentV3,
  base: NotationDocumentV4,
  snapshot: TeacherCopySnapshotV4,
  admission: ProfessionalRangeReplaceAdmissionV1,
  identityPlan: ProfessionalRangeReplaceIdentityPlanV1
): Readonly<NotationDocumentV4> => {
  const removedEvents = new Set(admission.destinationEventIds);
  const removedNotes = new Set(admission.destinationRemovedNoteIds);

  const eventEntries = base.events
    .filter(entry => !removedEvents.has(entry.target.eventId))
    .map(entry => ({
      target: rebindReplaceAddress(resultScore, entry.target) as EventAddressV3,
      notation: entry.notation
    }));
  const noteEntries = base.notes
    .filter(entry => !removedNotes.has(entry.target.noteId))
    .map(entry => ({
      target: rebindReplaceAddress(resultScore, entry.target) as typeof entry.target,
      notation: entry.notation
    }));

  const sourceEvents = snapshot.segments[0]?.events;
  if (sourceEvents === undefined || sourceEvents.length !== identityPlan.events.length) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replacement notation source and identity counts diverged.',
      'IDENTITY_PLAN_STALE_OR_INVALID'
    );
  }

  const copiedEventEntries = sourceEvents.flatMap((source, eventIndex) => {
    if (source.notation === null) return [];
    const plan = identityPlan.events[eventIndex]!;
    return [{
      target: addressEntityV3(resultScore, plan.destinationEventId) as EventAddressV3,
      notation: structuredClone(source.notation) as EventNotationV2
    }];
  });

  const copiedNoteEntries = sourceEvents.flatMap((source, eventIndex) =>
    source.notes.flatMap((sourceNote, noteIndex) => {
      if (sourceNote.notation === null) return [];
      const plannedNote = identityPlan.events[eventIndex]?.notes[noteIndex];
      if (plannedNote === undefined || plannedNote.sourceNoteId !== sourceNote.sourceNoteId) {
        throw new ProfessionalRangeReplaceV1Error(
          'Professional range replacement note notation identity plan diverged.',
          'IDENTITY_PLAN_STALE_OR_INVALID'
        );
      }
      const target = addressEntityV3(resultScore, plannedNote.destinationNoteId);
      if (target.kind !== 'note') {
        throw new ProfessionalRangeReplaceV1Error(
          'Professional range replacement planned note identity did not resolve as a note.',
          'NOTATION_RESULT_INVALID',
          { noteId: plannedNote.destinationNoteId }
        );
      }
      return [{
        target,
        notation: structuredClone(sourceNote.notation) as NoteNotation
      }];
    })
  );

  eventEntries.push(...copiedEventEntries);
  noteEntries.push(...copiedNoteEntries);

  const rebindEntries = <T extends { readonly target: SemanticAddressV3; readonly notation: unknown }>(
    entries: readonly T[]
  ): T[] => entries.map(entry => ({
    ...entry,
    target: rebindReplaceAddress(resultScore, entry.target)
  }) as T);

  try {
    return createNotationDocumentV4(resultScore, {
      contractVersion: '4.0.0',
      documentId: resultScore.id,
      revisionId: resultScore.revision.id,
      frames: rebindEntries(base.frames),
      measures: rebindEntries(base.measures),
      events: eventEntries,
      notes: noteEntries,
      graceEvents: rebindEntries(base.graceEvents),
      graceNotes: rebindEntries(base.graceNotes),
      crossStaffPlacements: base.crossStaffPlacements.map(entry => ({
        source: rebindReplaceAddress(resultScore, entry.source) as EventAddressV3,
        displayStaffId: entry.displayStaffId
      }))
    });
  } catch (error) {
    if (error instanceof ProfessionalRangeReplaceV1Error) throw error;
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replacement notation candidate failed canonical validation.',
      'NOTATION_RESULT_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

const resultReplacementSelection = (
  score: ScoreDocumentV3,
  insertedEventIds: readonly string[],
  direction: 'FORWARD' | 'BACKWARD'
): Readonly<EventSpanProfessionalSelectionV1> => {
  const firstId = insertedEventIds[0];
  const lastId = insertedEventIds.at(-1);
  if (firstId === undefined || lastId === undefined) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replacement result contains no inserted events.',
      'RESULT_SELECTION_INVALID'
    );
  }
  try {
    const first = addressEntityV3(score, firstId);
    const last = addressEntityV3(score, lastId);
    if (first.kind !== 'event' || last.kind !== 'event') throw new Error('inserted ids are not events');
    return direction === 'FORWARD'
      ? createEventSpanProfessionalSelectionV1(score, first, last)
      : createEventSpanProfessionalSelectionV1(score, last, first);
  } catch (error) {
    if (error instanceof ProfessionalRangeReplaceV1Error) throw error;
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replacement result selection could not be constructed.',
      'RESULT_SELECTION_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

export const executeProfessionalRangeReplaceV1 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  snapshotInput: TeacherCopySnapshotV4,
  destinationInput: EventSpanProfessionalSelectionV1,
  admissionInput: ProfessionalRangeReplaceAdmissionV1,
  identityPlanInput: ProfessionalRangeReplaceIdentityPlanV1
): Readonly<ProfessionalRangeReplaceResultV1> => {
  const score = createScoreDocumentV3(scoreInput);
  let notation: Readonly<NotationDocumentV4>;
  try {
    notation = createNotationDocumentV4(score, notationInput);
  } catch (error) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replacement source notation is stale or invalid.',
      'NOTATION_STALE_OR_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }

  const snapshot = revalidateCopySnapshot(score, notation, snapshotInput);

  let admission: Readonly<ProfessionalRangeReplaceAdmissionV1>;
  try {
    admission = analyzeProfessionalRangeReplaceV1(score, notation, snapshot, destinationInput);
  } catch (error) {
    if (error instanceof ProfessionalRangeReplaceV1Error &&
        error.code === 'SOURCE_RELATION_UNSUPPORTED') throw error;
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replacement admission no longer revalidates.',
      'ADMISSION_STALE_OR_TAMPERED',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  if (!sameJson(admission, admissionInput)) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replacement admission facts changed before mutation.',
      'ADMISSION_STALE_OR_TAMPERED'
    );
  }

  let identityPlan: Readonly<ProfessionalRangeReplaceIdentityPlanV1>;
  try {
    identityPlan = planProfessionalRangeReplaceIdentitiesV1(
      score,
      notation,
      snapshot,
      destinationInput,
      admission,
      identityPlanInput.nextRevisionId
    );
  } catch (error) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replacement identity plan no longer revalidates.',
      'IDENTITY_PLAN_STALE_OR_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  if (!sameJson(identityPlan, identityPlanInput)) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replacement identity plan facts changed before mutation.',
      'IDENTITY_PLAN_STALE_OR_INVALID'
    );
  }

  const destination = currentEventSpan(score, destinationInput);
  const resultScore = mutateReplacementScore(score, snapshot, destination, admission, identityPlan);
  const resultNotation = buildReplacementNotation(
    resultScore,
    notation,
    snapshot,
    admission,
    identityPlan
  );
  const insertedEventIds = Object.freeze(identityPlan.events.map(item => item.destinationEventId));
  const insertedNoteIds = Object.freeze(
    identityPlan.events.flatMap(item => item.notes.map(note => note.destinationNoteId))
  );
  const selection = resultReplacementSelection(
    resultScore,
    insertedEventIds,
    admission.destinationDirection
  );

  return Object.freeze({
    version: EDITOR_PROFESSIONAL_RANGE_REPLACE_V1_VERSION,
    score: resultScore,
    notation: resultNotation,
    selection,
    admission,
    identityPlan,
    insertedEventIds,
    insertedNoteIds,
    removedDestinationEventIds: Object.freeze([...admission.destinationEventIds]),
    removedDestinationNoteIds: Object.freeze([...admission.destinationRemovedNoteIds]),
    historyMutationAuthority: false as const
  });
};