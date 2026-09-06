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
  EDITOR_TEACHER_COPY_SNAPSHOT_V4_VERSION,
  type TeacherCopyEventSnapshotV4,
  type TeacherCopySnapshotV4
} from '../../editor-teacher-copy-snapshot-v4/src/index.js';

export const EDITOR_TEACHER_INSERT_ADMISSION_V4_VERSION = '1.0.0' as const;
export type TeacherInsertModeV4 = 'INSERT_AFTER_EVENT_USING_TRAILING_NEUTRAL_REST_CAPACITY';

export interface TeacherInsertSuffixShiftV4 {
  readonly eventId: string;
  readonly sourceOnset: Rational;
  readonly targetOnset: Rational;
}

export type TeacherInsertTrailingRestPlanV4 =
  | {
      readonly kind: 'REMOVE_TRAILING_REST';
      readonly restEventId: string;
      readonly sourceOnset: Rational;
      readonly sourceDuration: Rational;
      readonly targetOnset: null;
      readonly targetDuration: null;
    }
  | {
      readonly kind: 'SHRINK_TRAILING_REST_FORWARD';
      readonly restEventId: string;
      readonly sourceOnset: Rational;
      readonly sourceDuration: Rational;
      readonly targetOnset: Rational;
      readonly targetDuration: Rational;
    };

export interface TeacherInsertAdmissionV4 {
  readonly version: typeof EDITOR_TEACHER_INSERT_ADMISSION_V4_VERSION;
  readonly kind: 'TEACHER_INSERT_ADMISSION';
  readonly admitted: true;
  readonly mode: TeacherInsertModeV4;
  readonly sourceRevisionId: string;
  readonly destinationAnchor: EventAddressV3;
  readonly destinationAnchorEventId: string;
  readonly destinationMeasureId: string;
  readonly destinationVoiceId: string;
  readonly insertStart: Rational;
  readonly insertExtent: Rational;
  readonly insertEnd: Rational;
  readonly suffixShift: readonly TeacherInsertSuffixShiftV4[];
  readonly trailingRestPlan: TeacherInsertTrailingRestPlanV4;
  readonly sourceEventCount: number;
  readonly sourceNoteCount: number;
  readonly identityAllocationRequired: true;
  readonly relationRemappingRequired: false;
  readonly canonicalMutationAuthority: false;
  readonly historyMutationAuthority: false;
}

export type TeacherInsertAdmissionV4ErrorCode =
  | 'INVALID_SNAPSHOT'
  | 'SNAPSHOT_STALE_FOR_DESTINATION'
  | 'CROSS_MEASURE_SNAPSHOT_UNSUPPORTED'
  | 'SOURCE_GAPS_UNSUPPORTED'
  | 'STALE_DESTINATION'
  | 'DESTINATION_PATH_INVALID'
  | 'DESTINATION_RANGE_IN_SOURCE_SNAPSHOT'
  | 'TRAILING_REST_MISSING'
  | 'TRAILING_REST_NOT_NEUTRAL'
  | 'TRAILING_CAPACITY_INSUFFICIENT'
  | 'DESTINATION_TIMING_GAP_OR_OVERLAP'
  | 'RELATION_COUPLED_DESTINATION'
  | 'GRACE_COUPLED_DESTINATION'
  | 'TIMING_INVALID';

export class TeacherInsertAdmissionV4Error extends Error {
  readonly code: TeacherInsertAdmissionV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(
    message: string,
    code: TeacherInsertAdmissionV4ErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'TeacherInsertAdmissionV4Error';
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
    throw new TeacherInsertAdmissionV4Error('Teacher insert timing is invalid.', 'TIMING_INVALID');
  }
  const divisor = gcd(numerator, denominator);
  const n = numerator / divisor;
  const d = denominator / divisor;
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (n > max || d > max) {
    throw new TeacherInsertAdmissionV4Error(
      'Teacher insert timing exceeded exact safe-integer range.',
      'TIMING_INVALID'
    );
  }
  return Object.freeze({ numerator: Number(n), denominator: Number(d) });
};

const add = (left: Rational, right: Rational): Readonly<Rational> => rational(
  BigInt(left.numerator) * BigInt(right.denominator) +
    BigInt(right.numerator) * BigInt(left.denominator),
  BigInt(left.denominator) * BigInt(right.denominator)
);

const subtract = (left: Rational, right: Rational): Readonly<Rational> => rational(
  BigInt(left.numerator) * BigInt(right.denominator) -
    BigInt(right.numerator) * BigInt(left.denominator),
  BigInt(left.denominator) * BigInt(right.denominator)
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
const eventEnd = (event: Pick<ScoreEvent, 'onset' | 'duration'>): Readonly<Rational> => add(event.onset, event.duration);
const snapshotEventEnd = (event: TeacherCopyEventSnapshotV4): Readonly<Rational> =>
  add(event.onsetFromSegmentOrigin, event.duration);

const validateSnapshot = (snapshot: TeacherCopySnapshotV4): readonly TeacherCopyEventSnapshotV4[] => {
  if (
    snapshot.version !== EDITOR_TEACHER_COPY_SNAPSHOT_V4_VERSION ||
    snapshot.kind !== 'TEACHER_COPY_SNAPSHOT' ||
    snapshot.destinationIdentityAssigned !== false ||
    snapshot.canonicalMutationAuthority !== false ||
    snapshot.historyMutationAuthority !== false ||
    !Array.isArray(snapshot.segments) ||
    !Number.isSafeInteger(snapshot.eventCount) ||
    snapshot.eventCount <= 0 ||
    !Number.isSafeInteger(snapshot.noteCount) ||
    snapshot.noteCount < 0
  ) {
    throw new TeacherInsertAdmissionV4Error('Teacher insert source snapshot envelope is invalid.', 'INVALID_SNAPSHOT');
  }
  if (snapshot.crossesMeasureBoundary || snapshot.segments.length !== 1) {
    throw new TeacherInsertAdmissionV4Error(
      'First teacher insert profile supports one contiguous source-measure segment only.',
      'CROSS_MEASURE_SNAPSHOT_UNSUPPORTED',
      { segmentCount: snapshot.segments.length, crossesMeasureBoundary: snapshot.crossesMeasureBoundary }
    );
  }
  const segment = snapshot.segments[0]!;
  if (segment.frameOffset !== 0 || segment.events.length !== snapshot.eventCount) {
    throw new TeacherInsertAdmissionV4Error('Teacher insert source segment metadata is invalid.', 'INVALID_SNAPSHOT');
  }
  let previousEnd: Rational | null = null;
  let countedNotes = 0;
  for (let index = 0; index < segment.events.length; index += 1) {
    const event = segment.events[index]!;
    if (!validRational(event.onsetFromSegmentOrigin, true) || !validRational(event.duration, false)) {
      throw new TeacherInsertAdmissionV4Error('Teacher insert source timing is invalid.', 'INVALID_SNAPSHOT');
    }
    if (event.kind === 'rest' && event.notes.length !== 0) {
      throw new TeacherInsertAdmissionV4Error('Rest source snapshot carries note content.', 'INVALID_SNAPSHOT');
    }
    if (event.kind === 'note' && event.notes.length !== 1) {
      throw new TeacherInsertAdmissionV4Error('Note source snapshot must carry one note.', 'INVALID_SNAPSHOT');
    }
    if (event.kind === 'chord' && event.notes.length < 2) {
      throw new TeacherInsertAdmissionV4Error('Chord source snapshot must carry at least two notes.', 'INVALID_SNAPSHOT');
    }
    if (index === 0 && compare(event.onsetFromSegmentOrigin, ZERO) !== 0) {
      throw new TeacherInsertAdmissionV4Error(
        'Teacher insert source must begin at exact relative onset zero.',
        'SOURCE_GAPS_UNSUPPORTED'
      );
    }
    if (previousEnd !== null && compare(event.onsetFromSegmentOrigin, previousEnd) !== 0) {
      throw new TeacherInsertAdmissionV4Error(
        'Teacher insert source must be contiguous with no hidden gaps or overlaps.',
        'SOURCE_GAPS_UNSUPPORTED'
      );
    }
    previousEnd = snapshotEventEnd(event);
    countedNotes += event.notes.length;
  }
  if (countedNotes !== snapshot.noteCount) {
    throw new TeacherInsertAdmissionV4Error('Teacher insert source note count is inconsistent.', 'INVALID_SNAPSHOT');
  }
  return segment.events;
};

const notesOf = (event: ScoreEvent): readonly { readonly id: string }[] =>
  event.kind === 'note' ? [event.note] : event.kind === 'chord' ? event.notes : [];

const spanningOrnament = (notation: NotationDocumentV4['events'][number]['notation']): boolean =>
  notation.ornaments.some(ornament =>
    ornament.kind === 'wavy-line' || (ornament.kind === 'tremolo' && ornament.type !== 'single'));

const assertNoShiftCoupledRelations = (
  score: ScoreDocumentV3,
  notation: NotationDocumentV4,
  events: readonly ScoreEvent[]
): void => {
  const eventIds = new Set(events.map(event => event.id));
  const noteIds = new Set(events.flatMap(event => notesOf(event).map(note => note.id)));
  for (const entry of notation.events) {
    if (!eventIds.has(entry.target.eventId)) continue;
    if (entry.notation.beams.length > 0 || entry.notation.tuplet !== null || spanningOrnament(entry.notation)) {
      throw new TeacherInsertAdmissionV4Error(
        'Teacher insert would split or shift relation-coupled event notation.',
        'RELATION_COUPLED_DESTINATION',
        { eventId: entry.target.eventId }
      );
    }
  }
  for (const entry of notation.notes) {
    if (!noteIds.has(entry.target.noteId)) continue;
    if (entry.notation.ties.length > 0 || entry.notation.slurs.length > 0) {
      throw new TeacherInsertAdmissionV4Error(
        'Teacher insert would split or shift tie/slur-coupled note notation.',
        'RELATION_COUPLED_DESTINATION',
        { noteId: entry.target.noteId }
      );
    }
  }
  for (const placement of notation.crossStaffPlacements) {
    if (eventIds.has(placement.source.eventId)) {
      throw new TeacherInsertAdmissionV4Error(
        'Teacher insert does not yet own cross-staff relation shifting.',
        'RELATION_COUPLED_DESTINATION',
        { eventId: placement.source.eventId }
      );
    }
  }
  for (const part of score.parts) for (const staff of part.staves) {
    if (staff.role === 'tablature-linked') continue;
    for (const measure of staff.measures) for (const voice of measure.voices) {
      const coupled = voice.graceGroups.find(group => eventIds.has(group.anchorEventId));
      if (coupled !== undefined) {
        throw new TeacherInsertAdmissionV4Error(
          'Teacher insert does not yet shift or re-anchor grace content.',
          'GRACE_COUPLED_DESTINATION',
          { anchorEventId: coupled.anchorEventId, graceGroupId: coupled.id }
        );
      }
    }
  }
};

const neutralTrailingRest = (notation: NotationDocumentV4, eventId: string): boolean => {
  const entry = notation.events.find(item => item.target.eventId === eventId);
  if (entry !== undefined) {
    const value = entry.notation;
    if (
      value.dots !== 0 ||
      value.beams.length > 0 ||
      value.tuplet !== null ||
      value.articulations.length > 0 ||
      value.ornaments.length > 0
    ) return false;
  }
  return !notation.crossStaffPlacements.some(item => item.source.eventId === eventId);
};

export const analyzeTeacherInsertAfterEventV4 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  snapshotInput: TeacherCopySnapshotV4,
  destinationAnchorInput: EventAddressV3
): Readonly<TeacherInsertAdmissionV4> => {
  const score = createScoreDocumentV3(scoreInput);
  let notation: Readonly<NotationDocumentV4>;
  try {
    notation = createNotationDocumentV4(score, notationInput);
  } catch (error) {
    throw new TeacherInsertAdmissionV4Error(
      'Teacher insert notation is stale or invalid.',
      'STALE_DESTINATION',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  const sourceEvents = validateSnapshot(snapshotInput);
  if (snapshotInput.sourceDocumentId !== score.id || snapshotInput.sourceRevisionId !== score.revision.id) {
    throw new TeacherInsertAdmissionV4Error(
      'Teacher insert requires a source snapshot from the exact current destination revision.',
      'SNAPSHOT_STALE_FOR_DESTINATION',
      {
        snapshotDocumentId: snapshotInput.sourceDocumentId,
        destinationDocumentId: score.id,
        snapshotRevisionId: snapshotInput.sourceRevisionId,
        destinationRevisionId: score.revision.id
      }
    );
  }

  let anchor: ScoreEvent;
  try {
    const resolved = resolveSemanticAddressV3(score, destinationAnchorInput);
    if (resolved.kind !== 'event') throw new Error('destination anchor is not an event');
    anchor = resolved.value;
  } catch (error) {
    throw new TeacherInsertAdmissionV4Error(
      'Teacher insert destination anchor is stale or invalid.',
      'STALE_DESTINATION',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }

  const part = score.parts.find(item => item.id === destinationAnchorInput.partId);
  const staff = part?.staves.find(item => item.id === destinationAnchorInput.staffId);
  if (staff === undefined || staff.role === 'tablature-linked') {
    throw new TeacherInsertAdmissionV4Error('Teacher insert destination staff is invalid.', 'DESTINATION_PATH_INVALID');
  }
  const measure = staff.measures.find(item =>
    item.id === destinationAnchorInput.measureId && item.frameId === destinationAnchorInput.frameId);
  const voice = measure?.voices.find(item => item.id === destinationAnchorInput.voiceId);
  if (voice === undefined) {
    throw new TeacherInsertAdmissionV4Error('Teacher insert destination voice is invalid.', 'DESTINATION_PATH_INVALID');
  }
  const anchorIndex = voice.events.findIndex(event => event.id === anchor.id);
  if (anchorIndex < 0) {
    throw new TeacherInsertAdmissionV4Error('Teacher insert anchor is outside its addressed voice.', 'DESTINATION_PATH_INVALID');
  }
  if (anchorIndex >= voice.events.length - 1) {
    throw new TeacherInsertAdmissionV4Error(
      'Teacher insert requires an exact trailing neutral rest after the destination anchor.',
      'TRAILING_REST_MISSING'
    );
  }

  const trailing = voice.events[voice.events.length - 1]!;
  if (trailing.kind !== 'rest' || voice.events.length - 1 <= anchorIndex) {
    throw new TeacherInsertAdmissionV4Error(
      'Teacher insert requires the addressed voice to end in an explicit trailing rest.',
      'TRAILING_REST_MISSING'
    );
  }
  if (!neutralTrailingRest(notation, trailing.id)) {
    throw new TeacherInsertAdmissionV4Error(
      'Teacher insert trailing capacity rest carries notation or cross-staff semantics.',
      'TRAILING_REST_NOT_NEUTRAL',
      { eventId: trailing.id }
    );
  }

  const shiftRegion = voice.events.slice(anchorIndex, voice.events.length - 1);
  assertNoShiftCoupledRelations(score, notation, [...shiftRegion, trailing]);

  let expectedOnset = eventEnd(anchor);
  const suffix = voice.events.slice(anchorIndex + 1, voice.events.length - 1);
  for (const event of suffix) {
    if (compare(event.onset, expectedOnset) !== 0) {
      throw new TeacherInsertAdmissionV4Error(
        'Teacher insert destination suffix contains a timing gap or overlap.',
        'DESTINATION_TIMING_GAP_OR_OVERLAP',
        { eventId: event.id, expectedOnset, observedOnset: event.onset }
      );
    }
    expectedOnset = eventEnd(event);
  }
  if (compare(trailing.onset, expectedOnset) !== 0) {
    throw new TeacherInsertAdmissionV4Error(
      'Teacher insert trailing rest is not exactly contiguous with the destination suffix.',
      'DESTINATION_TIMING_GAP_OR_OVERLAP',
      { eventId: trailing.id, expectedOnset, observedOnset: trailing.onset }
    );
  }

  const sourceIds = new Set(sourceEvents.map(event => event.sourceEventId));
  const destinationRangeIds = new Set([anchor.id, ...suffix.map(event => event.id), trailing.id]);
  const overlap = [...sourceIds].find(id => destinationRangeIds.has(id));
  if (overlap !== undefined) {
    throw new TeacherInsertAdmissionV4Error(
      'First teacher insert profile does not use source events from the destination shift/capacity range.',
      'DESTINATION_RANGE_IN_SOURCE_SNAPSHOT',
      { eventId: overlap }
    );
  }

  const extent = sourceEvents.reduce<Readonly<Rational>>(
    (largest, event) => compare(snapshotEventEnd(event), largest) > 0 ? snapshotEventEnd(event) : largest,
    ZERO
  );
  if (extent.numerator === 0) {
    throw new TeacherInsertAdmissionV4Error('Teacher insert source extent is empty.', 'INVALID_SNAPSHOT');
  }
  if (compare(extent, trailing.duration) > 0) {
    throw new TeacherInsertAdmissionV4Error(
      'Teacher insert extent exceeds exact trailing neutral-rest capacity.',
      'TRAILING_CAPACITY_INSUFFICIENT',
      { extent, trailingDuration: trailing.duration }
    );
  }

  const insertStart = eventEnd(anchor);
  const insertEnd = add(insertStart, extent);
  const suffixShift = Object.freeze(suffix.map(event => Object.freeze({
    eventId: event.id,
    sourceOnset: Object.freeze({ ...event.onset }),
    targetOnset: add(event.onset, extent)
  })));
  const trailingRestPlan: TeacherInsertTrailingRestPlanV4 = compare(extent, trailing.duration) === 0
    ? Object.freeze({
        kind: 'REMOVE_TRAILING_REST' as const,
        restEventId: trailing.id,
        sourceOnset: Object.freeze({ ...trailing.onset }),
        sourceDuration: Object.freeze({ ...trailing.duration }),
        targetOnset: null,
        targetDuration: null
      })
    : Object.freeze({
        kind: 'SHRINK_TRAILING_REST_FORWARD' as const,
        restEventId: trailing.id,
        sourceOnset: Object.freeze({ ...trailing.onset }),
        sourceDuration: Object.freeze({ ...trailing.duration }),
        targetOnset: add(trailing.onset, extent),
        targetDuration: subtract(trailing.duration, extent)
      });

  return Object.freeze({
    version: EDITOR_TEACHER_INSERT_ADMISSION_V4_VERSION,
    kind: 'TEACHER_INSERT_ADMISSION' as const,
    admitted: true as const,
    mode: 'INSERT_AFTER_EVENT_USING_TRAILING_NEUTRAL_REST_CAPACITY' as const,
    sourceRevisionId: score.revision.id,
    destinationAnchor: Object.freeze({ ...destinationAnchorInput }),
    destinationAnchorEventId: anchor.id,
    destinationMeasureId: destinationAnchorInput.measureId,
    destinationVoiceId: destinationAnchorInput.voiceId,
    insertStart,
    insertExtent: extent,
    insertEnd,
    suffixShift,
    trailingRestPlan,
    sourceEventCount: snapshotInput.eventCount,
    sourceNoteCount: snapshotInput.noteCount,
    identityAllocationRequired: true as const,
    relationRemappingRequired: false as const,
    canonicalMutationAuthority: false as const,
    historyMutationAuthority: false as const
  });
};
