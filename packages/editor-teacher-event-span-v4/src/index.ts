import {
  addressEntityV3,
  resolveSemanticAddressV3,
  type EventAddressV3
} from '../../addressing-v3/src/index.js';
import {
  createScoreDocumentV3,
  type ContentStaffV3,
  type ScoreDocumentV3
} from '../../score-model-v3/src/index.js';

export const EDITOR_TEACHER_EVENT_SPAN_V4_VERSION = '1.0.0' as const;

export interface TeacherEventSpanSelectionV4 {
  readonly version: typeof EDITOR_TEACHER_EVENT_SPAN_V4_VERSION;
  readonly kind: 'TEACHER_EVENT_SPAN';
  readonly start: EventAddressV3;
  readonly stop: EventAddressV3;
  readonly targets: readonly EventAddressV3[];
  readonly measureIds: readonly string[];
  readonly frameIds: readonly string[];
  readonly voiceOrdinal: number;
  readonly crossesMeasureBoundary: boolean;
}

export type TeacherEventSpanSelectionV4ErrorCode =
  | 'STALE_ENDPOINT'
  | 'DUPLICATE_ENDPOINT'
  | 'SELECTION_SCOPE_MISMATCH'
  | 'VOICE_ORDINAL_MISMATCH'
  | 'SELECTION_ORDER_INVALID'
  | 'VOICE_GAP_UNSUPPORTED'
  | 'EMPTY_SPAN_SEGMENT';

export class TeacherEventSpanSelectionV4Error extends Error {
  readonly code: TeacherEventSpanSelectionV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: TeacherEventSpanSelectionV4ErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'TeacherEventSpanSelectionV4Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const freezeEventAddress = (address: EventAddressV3): EventAddressV3 =>
  Object.freeze({ ...address });

const validateEndpoint = (
  score: ScoreDocumentV3,
  endpoint: EventAddressV3,
  label: 'start' | 'stop'
): EventAddressV3 => {
  try {
    const resolved = resolveSemanticAddressV3(score, endpoint);
    if (resolved.kind !== 'event') throw new Error(`${label} endpoint did not resolve as event.`);
    return freezeEventAddress(endpoint);
  } catch (error) {
    throw new TeacherEventSpanSelectionV4Error(
      `Teacher event span ${label} endpoint is stale or invalid.`,
      'STALE_ENDPOINT',
      { label, cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

const contentStaff = (
  score: ScoreDocumentV3,
  partId: string,
  staffId: string
): ContentStaffV3 => {
  const part = score.parts.find(candidate => candidate.id === partId);
  const staff = part?.staves.find(candidate => candidate.id === staffId);
  if (staff === undefined || staff.role === 'tablature-linked') {
    throw new TeacherEventSpanSelectionV4Error(
      'Teacher event span requires one content-bearing source staff.',
      'SELECTION_SCOPE_MISMATCH',
      { partId, staffId }
    );
  }
  return staff;
};

const voiceOrdinalFor = (score: ScoreDocumentV3, endpoint: EventAddressV3): number => {
  try {
    const address = addressEntityV3(score, endpoint.voiceId);
    if (address.kind !== 'voice') throw new Error('Endpoint voice id is not a voice address.');
    const resolved = resolveSemanticAddressV3(score, address);
    if (resolved.kind !== 'voice') throw new Error('Endpoint voice did not resolve.');
    return resolved.value.ordinal;
  } catch (error) {
    throw new TeacherEventSpanSelectionV4Error(
      'Teacher event span endpoint voice cannot be resolved.',
      'STALE_ENDPOINT',
      { voiceId: endpoint.voiceId, cause: error instanceof Error ? error.message : String(error) }
    );
  }
};

export const createTeacherEventSpanSelectionV4 = (
  scoreInput: ScoreDocumentV3,
  startInput: EventAddressV3,
  stopInput: EventAddressV3
): Readonly<TeacherEventSpanSelectionV4> => {
  const score = createScoreDocumentV3(scoreInput);
  const start = validateEndpoint(score, startInput, 'start');
  const stop = validateEndpoint(score, stopInput, 'stop');

  if (start.eventId === stop.eventId) {
    throw new TeacherEventSpanSelectionV4Error(
      'Teacher event span endpoints must be distinct.',
      'DUPLICATE_ENDPOINT',
      { eventId: start.eventId }
    );
  }

  if (start.partId !== stop.partId || start.staffId !== stop.staffId) {
    throw new TeacherEventSpanSelectionV4Error(
      'Teacher event span endpoints must remain in one source part/staff.',
      'SELECTION_SCOPE_MISMATCH',
      {
        startPartId: start.partId,
        stopPartId: stop.partId,
        startStaffId: start.staffId,
        stopStaffId: stop.staffId
      }
    );
  }

  const staff = contentStaff(score, start.partId, start.staffId);
  const startOrdinal = voiceOrdinalFor(score, start);
  const stopOrdinal = voiceOrdinalFor(score, stop);
  if (startOrdinal !== stopOrdinal) {
    throw new TeacherEventSpanSelectionV4Error(
      'Teacher event span endpoints must use the same canonical voice ordinal.',
      'VOICE_ORDINAL_MISMATCH',
      { startOrdinal, stopOrdinal }
    );
  }

  const startMeasureIndex = staff.measures.findIndex(measure => measure.id === start.measureId);
  const stopMeasureIndex = staff.measures.findIndex(measure => measure.id === stop.measureId);
  if (startMeasureIndex < 0 || stopMeasureIndex < 0) {
    throw new TeacherEventSpanSelectionV4Error(
      'Teacher event span measure endpoint no longer resolves in the source staff.',
      'STALE_ENDPOINT',
      { startMeasureIndex, stopMeasureIndex }
    );
  }
  if (stopMeasureIndex < startMeasureIndex) {
    throw new TeacherEventSpanSelectionV4Error(
      'Teacher event span stop must occur after start in canonical measure order.',
      'SELECTION_ORDER_INVALID',
      { startMeasureIndex, stopMeasureIndex }
    );
  }

  const targets: EventAddressV3[] = [];
  const measureIds: string[] = [];
  const frameIds: string[] = [];

  for (let measureIndex = startMeasureIndex; measureIndex <= stopMeasureIndex; measureIndex += 1) {
    const measure = staff.measures[measureIndex]!;
    const voice = measure.voices.find(candidate => candidate.ordinal === startOrdinal);
    if (voice === undefined) {
      throw new TeacherEventSpanSelectionV4Error(
        'Teacher event span cannot cross a measure where the selected voice ordinal is absent.',
        'VOICE_GAP_UNSUPPORTED',
        { measureId: measure.id, frameId: measure.frameId, voiceOrdinal: startOrdinal }
      );
    }
    if (voice.events.length === 0) {
      throw new TeacherEventSpanSelectionV4Error(
        'Teacher event span cannot infer content through an empty selected voice segment.',
        'EMPTY_SPAN_SEGMENT',
        { measureId: measure.id, frameId: measure.frameId, voiceOrdinal: startOrdinal }
      );
    }

    let from = 0;
    let through = voice.events.length - 1;
    if (measureIndex === startMeasureIndex) {
      from = voice.events.findIndex(event => event.id === start.eventId);
      if (from < 0) {
        throw new TeacherEventSpanSelectionV4Error(
          'Teacher event span start event is outside the resolved source voice.',
          'STALE_ENDPOINT',
          { eventId: start.eventId, measureId: measure.id }
        );
      }
    }
    if (measureIndex === stopMeasureIndex) {
      through = voice.events.findIndex(event => event.id === stop.eventId);
      if (through < 0) {
        throw new TeacherEventSpanSelectionV4Error(
          'Teacher event span stop event is outside the resolved source voice.',
          'STALE_ENDPOINT',
          { eventId: stop.eventId, measureId: measure.id }
        );
      }
    }
    if (through < from) {
      throw new TeacherEventSpanSelectionV4Error(
        'Teacher event span stop must occur after start in canonical event order.',
        'SELECTION_ORDER_INVALID',
        { measureId: measure.id, from, through }
      );
    }

    const segment = voice.events.slice(from, through + 1);
    if (segment.length === 0) {
      throw new TeacherEventSpanSelectionV4Error(
        'Teacher event span produced an empty canonical segment.',
        'EMPTY_SPAN_SEGMENT',
        { measureId: measure.id, frameId: measure.frameId, voiceOrdinal: startOrdinal }
      );
    }
    measureIds.push(measure.id);
    frameIds.push(measure.frameId);
    for (const event of segment) {
      const address = addressEntityV3(score, event.id);
      if (address.kind !== 'event') {
        throw new TeacherEventSpanSelectionV4Error(
          'Teacher event span encountered a non-event semantic target.',
          'STALE_ENDPOINT',
          { eventId: event.id }
        );
      }
      targets.push(freezeEventAddress(address));
    }
  }

  if (targets[0]?.eventId !== start.eventId || targets[targets.length - 1]?.eventId !== stop.eventId) {
    throw new TeacherEventSpanSelectionV4Error(
      'Teacher event span endpoints are not the exact boundaries of the canonical target list.',
      'SELECTION_ORDER_INVALID',
      { targetCount: targets.length }
    );
  }

  return Object.freeze({
    version: EDITOR_TEACHER_EVENT_SPAN_V4_VERSION,
    kind: 'TEACHER_EVENT_SPAN' as const,
    start,
    stop,
    targets: Object.freeze(targets),
    measureIds: Object.freeze(measureIds),
    frameIds: Object.freeze(frameIds),
    voiceOrdinal: startOrdinal,
    crossesMeasureBoundary: startMeasureIndex !== stopMeasureIndex
  });
};
