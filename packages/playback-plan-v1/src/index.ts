import { createSemanticAddressIndexV3, type EventAddressV3 } from '../../addressing-v3/src/index.js';
import { contentStavesV3, createScoreDocumentV3, type ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import type { Pitch, ScoreEvent } from '../../score-model/src/index.js';

export const PLAYBACK_PLAN_V1_VERSION = '1.0.0' as const;

export type PlaybackPlanV1Status = 'READY' | 'PARTIAL' | 'EMPTY';
export type PlaybackPlanV1WarningCode = 'EMPTY_FRAME_ZERO_EXTENT' | 'GRACE_PLAYBACK_DEFERRED';

export interface PlaybackPlanV1Warning {
  readonly code: PlaybackPlanV1WarningCode;
  readonly frameId: string | null;
  readonly count: number;
}

export interface PlaybackPitchV1 {
  readonly pitch: Pitch;
  readonly frequencyHz: number;
}

export interface PlaybackEventV1 {
  readonly eventId: string;
  readonly address: EventAddressV3;
  readonly startWholeNotes: number;
  readonly durationWholeNotes: number;
  readonly pitches: readonly PlaybackPitchV1[];
}

export interface PlaybackPlanV1 {
  readonly version: typeof PLAYBACK_PLAN_V1_VERSION;
  readonly documentId: string;
  readonly revisionId: string;
  readonly status: PlaybackPlanV1Status;
  readonly durationWholeNotes: number;
  readonly events: readonly PlaybackEventV1[];
  readonly omittedGraceEventCount: number;
  readonly warnings: readonly PlaybackPlanV1Warning[];
}

export class PlaybackPlanV1Error extends Error {
  readonly code: 'ADDRESS_RESOLUTION_FAILED' | 'INVALID_TIMELINE';
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: PlaybackPlanV1Error['code'], details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'PlaybackPlanV1Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const semitones: Readonly<Record<Pitch['step'], number>> = Object.freeze({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 });
const rationalNumber = (value: Readonly<{ numerator: number; denominator: number }>): number => value.numerator / value.denominator;

export const pitchFrequencyHzV1 = (pitch: Pitch): number => {
  const midi = ((pitch.octave + 1) * 12) + semitones[pitch.step] + pitch.alter;
  return 440 * (2 ** ((midi - 69) / 12));
};

const eventPitches = (event: ScoreEvent): readonly Pitch[] => {
  if (event.kind === 'note') return Object.freeze([event.note.pitch]);
  if (event.kind === 'chord') return Object.freeze(event.notes.map((note) => note.pitch));
  return Object.freeze([] as Pitch[]);
};

export const createPlaybackPlanV1 = (input: ScoreDocumentV3): Readonly<PlaybackPlanV1> => {
  const document = createScoreDocumentV3(input);
  const addresses = createSemanticAddressIndexV3(document);
  const events: PlaybackEventV1[] = [];
  const warnings: PlaybackPlanV1Warning[] = [];
  let frameStart = 0;
  let omittedGraceEventCount = 0;

  for (let frameIndex = 0; frameIndex < document.measureFrames.length; frameIndex += 1) {
    const frame = document.measureFrames[frameIndex];
    if (frame === undefined) throw new PlaybackPlanV1Error('Playback frame index is invalid.', 'INVALID_TIMELINE', { frameIndex });
    let frameExtent = 0;
    let frameHasTimedContent = false;

    for (const part of document.parts) {
      for (const staff of contentStavesV3(part)) {
        const measure = staff.measures[frameIndex];
        if (measure === undefined || measure.frameId !== frame.id) {
          throw new PlaybackPlanV1Error('Playback frame alignment is invalid.', 'INVALID_TIMELINE', { frameId: frame.id, staffId: staff.id });
        }
        for (const voice of measure.voices) {
          for (const event of voice.events) {
            const onset = rationalNumber(event.onset);
            const duration = rationalNumber(event.duration);
            const end = onset + duration;
            if (!Number.isFinite(onset) || !Number.isFinite(duration) || onset < 0 || duration <= 0 || !Number.isFinite(end)) {
              throw new PlaybackPlanV1Error('Playback event timing is invalid.', 'INVALID_TIMELINE', { eventId: event.id });
            }
            frameHasTimedContent = true;
            frameExtent = Math.max(frameExtent, end);
            const pitches = eventPitches(event);
            if (pitches.length === 0) continue;
            const address = addresses.byEntityId.get(event.id);
            if (address === undefined || address.kind !== 'event') {
              throw new PlaybackPlanV1Error('Playback event semantic address could not be resolved.', 'ADDRESS_RESOLUTION_FAILED', { eventId: event.id });
            }
            events.push(Object.freeze({
              eventId: event.id,
              address: address as EventAddressV3,
              startWholeNotes: frameStart + onset,
              durationWholeNotes: duration,
              pitches: Object.freeze(pitches.map((pitch) => Object.freeze({ pitch: Object.freeze({ ...pitch }), frequencyHz: pitchFrequencyHzV1(pitch) })))
            }));
          }
          for (const group of voice.graceGroups) omittedGraceEventCount += group.events.length;
        }
      }
    }

    if (!frameHasTimedContent) warnings.push(Object.freeze({ code: 'EMPTY_FRAME_ZERO_EXTENT', frameId: frame.id, count: 1 }));
    frameStart += frameExtent;
  }

  if (omittedGraceEventCount > 0) warnings.push(Object.freeze({ code: 'GRACE_PLAYBACK_DEFERRED', frameId: null, count: omittedGraceEventCount }));
  events.sort((left, right) => left.startWholeNotes - right.startWholeNotes || left.eventId.localeCompare(right.eventId));
  const status: PlaybackPlanV1Status = events.length === 0 ? 'EMPTY' : warnings.length > 0 ? 'PARTIAL' : 'READY';

  return Object.freeze({
    version: PLAYBACK_PLAN_V1_VERSION,
    documentId: document.id,
    revisionId: document.revision.id,
    status,
    durationWholeNotes: frameStart,
    events: Object.freeze(events),
    omittedGraceEventCount,
    warnings: Object.freeze(warnings)
  });
};
