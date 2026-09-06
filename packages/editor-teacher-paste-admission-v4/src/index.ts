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

export const EDITOR_TEACHER_PASTE_ADMISSION_V4_VERSION = '1.0.0' as const;

export type TeacherPasteModeV4 = 'OVERWRITE_EXPLICIT_NEUTRAL_REST_PREFIX';
export type TeacherPasteRestPlanV4 =
  | {
      readonly kind: 'REMOVE_DESTINATION_REST';
      readonly restEventId: string;
      readonly residualOnset: null;
      readonly residualDuration: null;
    }
  | {
      readonly kind: 'SHRINK_DESTINATION_REST_FORWARD';
      readonly restEventId: string;
      readonly residualOnset: Rational;
      readonly residualDuration: Rational;
    };

export interface TeacherPasteAdmissionV4 {
  readonly version: typeof EDITOR_TEACHER_PASTE_ADMISSION_V4_VERSION;
  readonly kind: 'TEACHER_PASTE_ADMISSION';
  readonly admitted: true;
  readonly mode: TeacherPasteModeV4;
  readonly destination: EventAddressV3;
  readonly destinationRestEventId: string;
  readonly pasteStart: Rational;
  readonly pasteExtent: Rational;
  readonly pasteEnd: Rational;
  readonly sourceEventCount: number;
  readonly sourceNoteCount: number;
  readonly restPlan: TeacherPasteRestPlanV4;
  readonly identityAllocationRequired: true;
  readonly identityAllocationPerformed: false;
  readonly relationRemappingRequired: false;
  readonly canonicalMutationAuthority: false;
  readonly historyMutationAuthority: false;
}

export type TeacherPasteAdmissionV4ErrorCode =
  | 'INVALID_SNAPSHOT'
  | 'SNAPSHOT_STALE_FOR_DESTINATION'
  | 'CROSS_MEASURE_SNAPSHOT_UNSUPPORTED'
  | 'SOURCE_GAPS_UNSUPPORTED'
  | 'STALE_DESTINATION'
  | 'DESTINATION_IN_SOURCE_SNAPSHOT'
  | 'DESTINATION_NOT_REST'
  | 'DESTINATION_NOT_NEUTRAL'
  | 'DESTINATION_SPACE_INSUFFICIENT'
  | 'TIMING_INVALID';

export class TeacherPasteAdmissionV4Error extends Error {
  readonly code: TeacherPasteAdmissionV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: TeacherPasteAdmissionV4ErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'TeacherPasteAdmissionV4Error';
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
    throw new TeacherPasteAdmissionV4Error(
      'Teacher paste timing produced a negative or invalid rational.',
      'TIMING_INVALID'
    );
  }
  const divisor = gcd(numerator, denominator);
  const n = numerator / divisor;
  const d = denominator / divisor;
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (n > max || d > max) {
    throw new TeacherPasteAdmissionV4Error(
      'Teacher paste timing exceeded exact safe-integer range.',
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

const snapshotEventEnd = (event: TeacherCopyEventSnapshotV4): Readonly<Rational> =>
  add(event.onsetFromSegmentOrigin, event.duration);

const ZERO: Readonly<Rational> = Object.freeze({ numerator: 0, denominator: 1 });

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
    throw new TeacherPasteAdmissionV4Error(
      'Teacher paste source snapshot envelope is invalid.',
      'INVALID_SNAPSHOT'
    );
  }
  if (snapshot.segments.length !== 1 || snapshot.crossesMeasureBoundary) {
    throw new TeacherPasteAdmissionV4Error(
      'First teacher paste admission supports one source measure segment only.',
      'CROSS_MEASURE_SNAPSHOT_UNSUPPORTED',
      { segmentCount: snapshot.segments.length, crossesMeasureBoundary: snapshot.crossesMeasureBoundary }
    );
  }
  const segment = snapshot.segments[0]!;
  if (segment.frameOffset !== 0 || !Array.isArray(segment.events) || segment.events.length !== snapshot.eventCount) {
    throw new TeacherPasteAdmissionV4Error(
      'Teacher paste source segment metadata is invalid.',
      'INVALID_SNAPSHOT'
    );
  }
  let previousEnd: Rational | null = null;
  let countedNotes = 0;
  for (let index = 0; index < segment.events.length; index += 1) {
    const event = segment.events[index]!;
    if (
      !validRational(event.onsetFromSegmentOrigin, true) ||
      !validRational(event.duration, false) ||
      !Array.isArray(event.notes)
    ) {
      throw new TeacherPasteAdmissionV4Error(
        'Teacher paste source event timing/content is invalid.',
        'INVALID_SNAPSHOT',
        { sourceEventId: event.sourceEventId }
      );
    }
    if (index === 0 && compare(event.onsetFromSegmentOrigin, ZERO) !== 0) {
      throw new TeacherPasteAdmissionV4Error(
        'First teacher paste source event must begin at exact relative onset zero.',
        'SOURCE_GAPS_UNSUPPORTED',
        { sourceEventId: event.sourceEventId, onset: event.onsetFromSegmentOrigin }
      );
    }
    if (previousEnd !== null && compare(event.onsetFromSegmentOrigin, previousEnd) !== 0) {
      throw new TeacherPasteAdmissionV4Error(
        'First teacher paste profile requires a contiguous source event sequence with no implicit gaps or overlaps.',
        'SOURCE_GAPS_UNSUPPORTED',
        { sourceEventId: event.sourceEventId, expectedOnset: previousEnd, observedOnset: event.onsetFromSegmentOrigin }
      );
    }
    previousEnd = snapshotEventEnd(event);
    countedNotes += event.notes.length;
  }
  if (countedNotes !== snapshot.noteCount) {
    throw new TeacherPasteAdmissionV4Error(
      'Teacher paste source note count does not match its snapshot payload.',
      'INVALID_SNAPSHOT',
      { expected: snapshot.noteCount, observed: countedNotes }
    );
  }
  return segment.events;
};

const resolveDestination = (score: ScoreDocumentV3, target: EventAddressV3): ScoreEvent => {
  try {
    const resolved = resolveSemanticAddressV3(score, target);
    if (resolved.kind !== 'event') throw new Error('target did not resolve as event');
    return resolved.value;
  } catch (error) {
    throw new TeacherPasteAdmissionV4Error(
      'Teacher paste destination is stale or invalid.',
      'STALE_DESTINATION',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

const neutralRest = (notation: NotationDocumentV4, eventId: string): boolean => {
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
  if (notation.crossStaffPlacements.some(item => item.source.eventId === eventId)) return false;
  return true;
};

const graceAnchoredTo = (score: ScoreDocumentV3, eventId: string): boolean => {
  for (const part of score.parts) for (const staff of part.staves) {
    if (staff.role === 'tablature-linked') continue;
    for (const measure of staff.measures) for (const voice of measure.voices) {
      if (voice.graceGroups.some(group => group.anchorEventId === eventId)) return true;
    }
  }
  return false;
};

export const analyzeTeacherPasteDestinationV4 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  snapshotInput: TeacherCopySnapshotV4,
  destination: EventAddressV3
): Readonly<TeacherPasteAdmissionV4> => {
  const score = createScoreDocumentV3(scoreInput);
  let notation: Readonly<NotationDocumentV4>;
  try {
    notation = createNotationDocumentV4(score, notationInput);
  } catch (error) {
    throw new TeacherPasteAdmissionV4Error(
      'Teacher paste destination notation is stale or invalid.',
      'STALE_DESTINATION',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
  const events = validateSnapshot(snapshotInput);
  if (snapshotInput.sourceDocumentId !== score.id || snapshotInput.sourceRevisionId !== score.revision.id) {
    throw new TeacherPasteAdmissionV4Error(
      'First teacher paste admission requires a snapshot from the exact current destination document revision.',
      'SNAPSHOT_STALE_FOR_DESTINATION',
      {
        snapshotDocumentId: snapshotInput.sourceDocumentId,
        destinationDocumentId: score.id,
        snapshotRevisionId: snapshotInput.sourceRevisionId,
        destinationRevisionId: score.revision.id
      }
    );
  }
  const target = resolveDestination(score, destination);
  if (events.some(event => event.sourceEventId === target.id)) {
    throw new TeacherPasteAdmissionV4Error(
      'Teacher paste destination cannot be one of the source snapshot events in the first overwrite profile.',
      'DESTINATION_IN_SOURCE_SNAPSHOT',
      { eventId: target.id }
    );
  }
  if (target.kind !== 'rest') {
    throw new TeacherPasteAdmissionV4Error(
      'First teacher paste admission overwrites only an explicit destination rest.',
      'DESTINATION_NOT_REST',
      { eventId: target.id, kind: target.kind }
    );
  }
  if (!neutralRest(notation, target.id) || graceAnchoredTo(score, target.id)) {
    throw new TeacherPasteAdmissionV4Error(
      'Destination rest carries notation, cross-staff or grace semantics and is not neutral.',
      'DESTINATION_NOT_NEUTRAL',
      { eventId: target.id }
    );
  }

  const extent = events.reduce<Readonly<Rational>>(
    (largest, event) => compare(snapshotEventEnd(event), largest) > 0 ? snapshotEventEnd(event) : largest,
    ZERO
  );
  if (extent.numerator === 0) {
    throw new TeacherPasteAdmissionV4Error(
      'Teacher paste source extent is empty.',
      'INVALID_SNAPSHOT'
    );
  }
  if (compare(extent, target.duration) > 0) {
    throw new TeacherPasteAdmissionV4Error(
      'Destination rest is shorter than the exact source snapshot extent.',
      'DESTINATION_SPACE_INSUFFICIENT',
      { eventId: target.id, extent, destinationDuration: target.duration }
    );
  }
  const pasteEnd = add(target.onset, extent);
  const restEnd = add(target.onset, target.duration);
  const restPlan: TeacherPasteRestPlanV4 = compare(extent, target.duration) === 0
    ? Object.freeze({
        kind: 'REMOVE_DESTINATION_REST' as const,
        restEventId: target.id,
        residualOnset: null,
        residualDuration: null
      })
    : Object.freeze({
        kind: 'SHRINK_DESTINATION_REST_FORWARD' as const,
        restEventId: target.id,
        residualOnset: pasteEnd,
        residualDuration: subtract(restEnd, pasteEnd)
      });

  return Object.freeze({
    version: EDITOR_TEACHER_PASTE_ADMISSION_V4_VERSION,
    kind: 'TEACHER_PASTE_ADMISSION' as const,
    admitted: true as const,
    mode: 'OVERWRITE_EXPLICIT_NEUTRAL_REST_PREFIX' as const,
    destination: Object.freeze({ ...destination }),
    destinationRestEventId: target.id,
    pasteStart: Object.freeze({ ...target.onset }),
    pasteExtent: extent,
    pasteEnd,
    sourceEventCount: snapshotInput.eventCount,
    sourceNoteCount: snapshotInput.noteCount,
    restPlan,
    identityAllocationRequired: true as const,
    identityAllocationPerformed: false as const,
    relationRemappingRequired: false as const,
    canonicalMutationAuthority: false as const,
    historyMutationAuthority: false as const
  });
};
