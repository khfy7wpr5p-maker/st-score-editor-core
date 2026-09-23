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

const gcd = (left: bigint, right: bigint): bigint => {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a === 0n ? 1n : a;
};

const rational = (
  numerator: bigint,
  denominator: bigint,
  code: 'SOURCE_TIMING_INVALID' | 'DESTINATION_TIMING_INVALID'
): Readonly<Rational> => {
  if (numerator < 0n || denominator <= 0n) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replace produced invalid exact timing.',
      code
    );
  }
  const divisor = gcd(numerator, denominator);
  const n = numerator / divisor;
  const d = denominator / divisor;
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (n > max || d > max) {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replace timing exceeded exact safe-integer range.',
      code
    );
  }
  return Object.freeze({ numerator: Number(n), denominator: Number(d) });
};

const add = (
  left: Rational,
  right: Rational,
  code: 'SOURCE_TIMING_INVALID' | 'DESTINATION_TIMING_INVALID'
): Readonly<Rational> => rational(
  BigInt(left.numerator) * BigInt(right.denominator) +
    BigInt(right.numerator) * BigInt(left.denominator),
  BigInt(left.denominator) * BigInt(right.denominator),
  code
);

const subtract = (
  left: Rational,
  right: Rational,
  code: 'SOURCE_TIMING_INVALID' | 'DESTINATION_TIMING_INVALID'
): Readonly<Rational> => rational(
  BigInt(left.numerator) * BigInt(right.denominator) -
    BigInt(right.numerator) * BigInt(left.denominator),
  BigInt(left.denominator) * BigInt(right.denominator),
  code
);

const compare = (left: Rational, right: Rational): number => {
  const l = BigInt(left.numerator) * BigInt(right.denominator);
  const r = BigInt(right.numerator) * BigInt(left.denominator);
  return l < r ? -1 : l > r ? 1 : 0;
};

const validRational = (value: Rational, allowZero: boolean): boolean =>
  Number.isSafeInteger(value.numerator) &&
  Number.isSafeInteger(value.denominator) &&
  value.denominator > 0 &&
  (allowZero ? value.numerator >= 0 : value.numerator > 0) &&
  gcd(BigInt(value.numerator), BigInt(value.denominator)) === 1n;

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

type IdentityRecord = Record<string, unknown>;
const identityRecord = (value: unknown): value is IdentityRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const allCanonicalIds = (score: ScoreDocumentV3): ReadonlySet<string> => {
  const ids = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!identityRecord(value)) return;
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
    const destinationEventId = replacementPlannedId(
      'replace-event',
      score,
      destination,
      nextRevisionId,
      `event|${eventIndex}|${event.sourceEventId}`
    );
    if (occupied.has(destinationEventId) || planned.has(destinationEventId)) {
      throw new ProfessionalRangeReplaceV1Error(
        'Deterministic professional replacement event identity collides with canonical or planned identity.',
        'ID_COLLISION',
        { id: destinationEventId, sourceEventId: event.sourceEventId }
      );
    }
    planned.add(destinationEventId);

    const notes = event.notes.map((note, noteIndex) => {
      const destinationNoteId = replacementPlannedId(
        'replace-note',
        score,
        destination,
        nextRevisionId,
        `note|${eventIndex}|${noteIndex}|${note.sourceNoteId}`
      );
      if (occupied.has(destinationNoteId) || planned.has(destinationNoteId)) {
        throw new ProfessionalRangeReplaceV1Error(
          'Deterministic professional replacement note identity collides with canonical or planned identity.',
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
