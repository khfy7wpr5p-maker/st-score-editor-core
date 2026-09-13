import { createNotationDocumentV4, type NotationDocumentV4 } from '../../notation-structure-v4/src/index.js';
import type { EventNotationV2 } from '../../notation-structure-v2/src/index.js';
import type { NoteNotation } from '../../notation-structure/src/index.js';
import { createScoreDocumentV3, type ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import type { Pitch, Rational, ScoreEvent } from '../../score-model/src/index.js';
import type { EventAddressV3 } from '../../addressing-v3/src/index.js';
import {
  createTeacherEventSpanSelectionV4,
  type TeacherEventSpanSelectionV4
} from '../../editor-teacher-event-span-v4/src/index.js';

export const EDITOR_TEACHER_COPY_SNAPSHOT_V4_VERSION = '1.0.0' as const;

export interface TeacherCopyNoteSnapshotV4 {
  readonly sourceNoteId: string;
  readonly pitch: Pitch;
  readonly notation: NoteNotation | null;
}

export interface TeacherCopyEventSnapshotV4 {
  readonly sourceEventId: string;
  readonly sourceAddress: EventAddressV3;
  readonly kind: ScoreEvent['kind'];
  readonly sourceOnset: Rational;
  readonly onsetFromSegmentOrigin: Rational;
  readonly duration: Rational;
  readonly notes: readonly TeacherCopyNoteSnapshotV4[];
  readonly notation: EventNotationV2 | null;
}

export interface TeacherCopyMeasureSegmentV4 {
  readonly frameOffset: number;
  readonly sourceFrameId: string;
  readonly sourceMeasureId: string;
  readonly sourceSegmentOriginOnset: Rational;
  readonly events: readonly TeacherCopyEventSnapshotV4[];
}

export interface TeacherCopySnapshotV4 {
  readonly version: typeof EDITOR_TEACHER_COPY_SNAPSHOT_V4_VERSION;
  readonly kind: 'TEACHER_COPY_SNAPSHOT';
  readonly sourceDocumentId: string;
  readonly sourceRevisionId: string;
  readonly sourcePartId: string;
  readonly sourceStaffId: string;
  readonly sourceVoiceOrdinal: number;
  readonly sourceStartEventId: string;
  readonly sourceStopEventId: string;
  readonly crossesMeasureBoundary: boolean;
  readonly segments: readonly TeacherCopyMeasureSegmentV4[];
  readonly eventCount: number;
  readonly noteCount: number;
  readonly destinationIdentityAssigned: false;
  readonly canonicalMutationAuthority: false;
  readonly historyMutationAuthority: false;
}

export type TeacherCopySnapshotV4ErrorCode =
  | 'SPAN_STALE_OR_INVALID'
  | 'NOTATION_STALE_OR_INVALID'
  | 'SOURCE_EVENT_NOT_FOUND'
  | 'RELATION_COUPLED_SOURCE'
  | 'GRACE_COUPLED_SOURCE'
  | 'TIME_NORMALIZATION_INVALID';

export class TeacherCopySnapshotV4Error extends Error {
  readonly code: TeacherCopySnapshotV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: TeacherCopySnapshotV4ErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'TeacherCopySnapshotV4Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

type MutableRecord = Record<string, unknown>;
const deepFreeze = <T>(value: T): Readonly<T> => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    if (Array.isArray(value)) {
      for (const item of value) deepFreeze(item);
    } else {
      for (const item of Object.values(value as MutableRecord)) deepFreeze(item);
    }
  }
  return value as Readonly<T>;
};

const gcdBigInt = (left: bigint, right: bigint): bigint => {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a === 0n ? 1n : a;
};

const rationalClone = (value: Rational): Rational =>
  Object.freeze({ numerator: value.numerator, denominator: value.denominator });

const subtractRational = (left: Rational, right: Rational): Rational => {
  const numerator = BigInt(left.numerator) * BigInt(right.denominator)
    - BigInt(right.numerator) * BigInt(left.denominator);
  const denominator = BigInt(left.denominator) * BigInt(right.denominator);
  if (numerator < 0n || denominator <= 0n) {
    throw new TeacherCopySnapshotV4Error(
      'Teacher copy snapshot cannot normalize a negative or invalid event onset.',
      'TIME_NORMALIZATION_INVALID',
      { left, right }
    );
  }
  const divisor = gcdBigInt(numerator, denominator);
  const reducedNumerator = numerator / divisor;
  const reducedDenominator = denominator / divisor;
  const asNumerator = Number(reducedNumerator);
  const asDenominator = Number(reducedDenominator);
  if (!Number.isSafeInteger(asNumerator) || !Number.isSafeInteger(asDenominator)) {
    throw new TeacherCopySnapshotV4Error(
      'Teacher copy snapshot normalized onset exceeds exact safe-integer range.',
      'TIME_NORMALIZATION_INVALID',
      { left, right }
    );
  }
  return Object.freeze({ numerator: asNumerator, denominator: asDenominator });
};

const eventNotes = (event: ScoreEvent): readonly { readonly id: string; readonly pitch: Pitch }[] =>
  event.kind === 'note' ? [event.note] : event.kind === 'chord' ? event.notes : [];

const spanningOrnament = (notation: EventNotationV2): boolean =>
  notation.ornaments.some(ornament =>
    ornament.kind === 'wavy-line' || (ornament.kind === 'tremolo' && ornament.type !== 'single'));

const assertRelationFreeSource = (
  score: ScoreDocumentV3,
  notation: NotationDocumentV4,
  targetIds: ReadonlySet<string>,
  noteIds: ReadonlySet<string>
): void => {
  for (const entry of notation.events) {
    if (!targetIds.has(entry.target.eventId)) continue;
    if (entry.notation.beams.length > 0) {
      throw new TeacherCopySnapshotV4Error(
        'Teacher copy snapshot does not yet own beam relation remapping.',
        'RELATION_COUPLED_SOURCE',
        { eventId: entry.target.eventId, relation: 'beam' }
      );
    }
    if (entry.notation.tuplet !== null) {
      throw new TeacherCopySnapshotV4Error(
        'Teacher copy snapshot does not yet own tuplet relation remapping.',
        'RELATION_COUPLED_SOURCE',
        { eventId: entry.target.eventId, relation: 'tuplet' }
      );
    }
    if (spanningOrnament(entry.notation)) {
      throw new TeacherCopySnapshotV4Error(
        'Teacher copy snapshot does not yet own spanning ornament relation remapping.',
        'RELATION_COUPLED_SOURCE',
        { eventId: entry.target.eventId, relation: 'spanning-ornament' }
      );
    }
  }
  for (const entry of notation.notes) {
    if (!noteIds.has(entry.target.noteId)) continue;
    if (entry.notation.ties.length > 0 || entry.notation.slurs.length > 0) {
      throw new TeacherCopySnapshotV4Error(
        'Teacher copy snapshot does not yet own tie/slur relation remapping.',
        'RELATION_COUPLED_SOURCE',
        {
          noteId: entry.target.noteId,
          ties: entry.notation.ties.length,
          slurs: entry.notation.slurs.length
        }
      );
    }
  }
  for (const placement of notation.crossStaffPlacements) {
    if (!targetIds.has(placement.source.eventId)) continue;
    throw new TeacherCopySnapshotV4Error(
      'Teacher copy snapshot does not yet own cross-staff placement remapping.',
      'RELATION_COUPLED_SOURCE',
      { eventId: placement.source.eventId, relation: 'cross-staff' }
    );
  }
  for (const part of score.parts) {
    for (const staff of part.staves) {
      if (staff.role === 'tablature-linked') continue;
      for (const measure of staff.measures) {
        for (const voice of measure.voices) {
          const coupled = voice.graceGroups.find(group => targetIds.has(group.anchorEventId));
          if (coupled !== undefined) {
            throw new TeacherCopySnapshotV4Error(
              'Teacher copy snapshot does not yet own grace-group cloning/remapping.',
              'GRACE_COUPLED_SOURCE',
              { anchorEventId: coupled.anchorEventId, graceGroupId: coupled.id }
            );
          }
        }
      }
    }
  }
};

const sourceEvent = (score: ScoreDocumentV3, address: EventAddressV3): ScoreEvent => {
  const part = score.parts.find(candidate => candidate.id === address.partId);
  const staff = part?.staves.find(candidate => candidate.id === address.staffId);
  if (staff === undefined || staff.role === 'tablature-linked') {
    throw new TeacherCopySnapshotV4Error(
      'Teacher copy source staff no longer resolves.',
      'SOURCE_EVENT_NOT_FOUND',
      { eventId: address.eventId }
    );
  }
  const measure = staff.measures.find(candidate => candidate.id === address.measureId);
  const voice = measure?.voices.find(candidate => candidate.id === address.voiceId);
  const event = voice?.events.find(candidate => candidate.id === address.eventId);
  if (event === undefined) {
    throw new TeacherCopySnapshotV4Error(
      'Teacher copy source event no longer resolves in its exact source voice.',
      'SOURCE_EVENT_NOT_FOUND',
      { eventId: address.eventId }
    );
  }
  return event;
};

export const createTeacherCopySnapshotV4 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  spanInput: TeacherEventSpanSelectionV4
): Readonly<TeacherCopySnapshotV4> => {
  const score = createScoreDocumentV3(scoreInput);
  let notation: Readonly<NotationDocumentV4>;
  try {
    notation = createNotationDocumentV4(score, notationInput);
  } catch (error) {
    throw new TeacherCopySnapshotV4Error(
      'Teacher copy notation is stale or invalid for the current canonical score.',
      'NOTATION_STALE_OR_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }

  let span: Readonly<TeacherEventSpanSelectionV4>;
  try {
    span = createTeacherEventSpanSelectionV4(score, spanInput.start, spanInput.stop);
  } catch (error) {
    throw new TeacherCopySnapshotV4Error(
      'Teacher copy span is stale or invalid for the current canonical score.',
      'SPAN_STALE_OR_INVALID',
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }

  const selectedEventIds = new Set(span.targets.map(target => target.eventId));
  const selectedNoteIds = new Set<string>();
  for (const target of span.targets) {
    for (const note of eventNotes(sourceEvent(score, target))) selectedNoteIds.add(note.id);
  }
  assertRelationFreeSource(score, notation, selectedEventIds, selectedNoteIds);

  const eventNotationById = new Map(notation.events.map(entry => [entry.target.eventId, entry.notation] as const));
  const noteNotationById = new Map(notation.notes.map(entry => [entry.target.noteId, entry.notation] as const));
  const segments: TeacherCopyMeasureSegmentV4[] = [];
  let noteCount = 0;

  for (let frameOffset = 0; frameOffset < span.measureIds.length; frameOffset += 1) {
    const measureId = span.measureIds[frameOffset]!;
    const frameId = span.frameIds[frameOffset]!;
    const targets = span.targets.filter(target => target.measureId === measureId);
    if (targets.length === 0) {
      throw new TeacherCopySnapshotV4Error(
        'Teacher copy span contains an empty measure segment.',
        'SOURCE_EVENT_NOT_FOUND',
        { measureId, frameId }
      );
    }
    const firstEvent = sourceEvent(score, targets[0]!);
    const origin = frameOffset === 0
      ? rationalClone(firstEvent.onset)
      : Object.freeze({ numerator: 0, denominator: 1 });
    const events: TeacherCopyEventSnapshotV4[] = targets.map(target => {
      const event = sourceEvent(score, target);
      const notes = eventNotes(event).map(note => {
        noteCount += 1;
        return deepFreeze({
          sourceNoteId: note.id,
          pitch: structuredClone(note.pitch),
          notation: noteNotationById.has(note.id)
            ? structuredClone(noteNotationById.get(note.id)!)
            : null
        }) as TeacherCopyNoteSnapshotV4;
      });
      return deepFreeze({
        sourceEventId: event.id,
        sourceAddress: structuredClone(target),
        kind: event.kind,
        sourceOnset: rationalClone(event.onset),
        onsetFromSegmentOrigin: subtractRational(event.onset, origin),
        duration: rationalClone(event.duration),
        notes,
        notation: eventNotationById.has(event.id)
          ? structuredClone(eventNotationById.get(event.id)!)
          : null
      }) as TeacherCopyEventSnapshotV4;
    });
    segments.push(deepFreeze({
      frameOffset,
      sourceFrameId: frameId,
      sourceMeasureId: measureId,
      sourceSegmentOriginOnset: origin,
      events
    }) as TeacherCopyMeasureSegmentV4);
  }

  return deepFreeze({
    version: EDITOR_TEACHER_COPY_SNAPSHOT_V4_VERSION,
    kind: 'TEACHER_COPY_SNAPSHOT' as const,
    sourceDocumentId: score.id,
    sourceRevisionId: score.revision.id,
    sourcePartId: span.start.partId,
    sourceStaffId: span.start.staffId,
    sourceVoiceOrdinal: span.voiceOrdinal,
    sourceStartEventId: span.start.eventId,
    sourceStopEventId: span.stop.eventId,
    crossesMeasureBoundary: span.crossesMeasureBoundary,
    segments,
    eventCount: span.targets.length,
    noteCount,
    destinationIdentityAssigned: false as const,
    canonicalMutationAuthority: false as const,
    historyMutationAuthority: false as const
  }) as Readonly<TeacherCopySnapshotV4>;
};
