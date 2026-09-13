import { resolveSemanticAddressV3, type SemanticAddressV3 } from '../../addressing-v3/src/index.js';
import type { Pitch } from '../../score-model/src/index.js';
import type { ScoreDocumentV3 } from '../../score-model-v3/src/index.js';

export const EDITOR_AUDITION_V1_VERSION = '1.0.0' as const;

export type EditorAuditionInstrumentIdV1 = 'GRAND_PIANO' | 'CLASSICAL_GUITAR';

export interface EditorAuditionRequestV1 {
  readonly requestId: string;
  readonly sourceRevisionId: string;
  readonly pitch: Readonly<{ readonly midi: number }>;
  readonly instrumentId: EditorAuditionInstrumentIdV1;
  readonly velocity?: number;
  readonly durationMs?: number;
  readonly stringNumber?: number;
  readonly fret?: number;
  readonly sourceEventId?: string;
}

export interface CreateEditorAuditionRequestV1Options {
  readonly requestId: string;
  readonly instrumentId: EditorAuditionInstrumentIdV1;
  readonly velocity?: number;
  readonly durationMs?: number;
  readonly stringNumber?: number;
  readonly fret?: number;
}

export type EditorAuditionV1ErrorCode =
  | 'INVALID_REQUEST_ID'
  | 'INVALID_INSTRUMENT'
  | 'INVALID_VELOCITY'
  | 'INVALID_DURATION'
  | 'INVALID_STRING_NUMBER'
  | 'INVALID_FRET'
  | 'UNSUPPORTED_PITCH';

export class EditorAuditionV1Error extends Error {
  readonly code: EditorAuditionV1ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: EditorAuditionV1ErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'EditorAuditionV1Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

export interface EditorAudioPortV1Error {
  readonly code: string;
  readonly message: string;
}

export type EditorAudioUnlockResultV1 =
  | Readonly<{ readonly ok: true }>
  | Readonly<{ readonly ok: false; readonly error: EditorAudioPortV1Error }>;

export type EditorAudioAuditionResultV1 =
  | Readonly<{ readonly ok: true; readonly requestId: string }>
  | Readonly<{ readonly ok: false; readonly error: EditorAudioPortV1Error }>;

export interface EditorAudioPortV1 {
  readonly unlockFromUserGesture: () => Promise<EditorAudioUnlockResultV1>;
  readonly setInstrument: (instrumentId: EditorAuditionInstrumentIdV1) => Promise<void>;
  readonly audition: (request: EditorAuditionRequestV1) => Promise<EditorAudioAuditionResultV1>;
}

const SEMITONE: Readonly<Record<Pitch['step'], number>> = Object.freeze({ C:0, D:2, E:4, F:5, G:7, A:9, B:11 });

export const canonicalPitchToMidiV1 = (pitch: Pitch): number => {
  const midi = 12 * (pitch.octave + 1) + SEMITONE[pitch.step] + pitch.alter;
  if (!Number.isSafeInteger(midi) || midi < 0 || midi > 127) {
    throw new EditorAuditionV1Error('Canonical pitch is outside the MIDI audition range.', 'UNSUPPORTED_PITCH', { pitch, midi });
  }
  return midi;
};

const validateOptions = (options: CreateEditorAuditionRequestV1Options): void => {
  if (typeof options.requestId !== 'string' || options.requestId.length < 1 || options.requestId.length > 256) {
    throw new EditorAuditionV1Error('requestId must be a bounded non-empty string.', 'INVALID_REQUEST_ID');
  }
  if (options.instrumentId !== 'GRAND_PIANO' && options.instrumentId !== 'CLASSICAL_GUITAR') {
    throw new EditorAuditionV1Error('instrumentId is not admitted.', 'INVALID_INSTRUMENT');
  }
  if (options.velocity !== undefined && (!Number.isFinite(options.velocity) || options.velocity < 0 || options.velocity > 1)) {
    throw new EditorAuditionV1Error('velocity must be within [0,1].', 'INVALID_VELOCITY');
  }
  if (options.durationMs !== undefined && (!Number.isFinite(options.durationMs) || options.durationMs <= 0 || options.durationMs > 10_000)) {
    throw new EditorAuditionV1Error('durationMs must be within (0,10000].', 'INVALID_DURATION');
  }
  if (options.stringNumber !== undefined && (!Number.isSafeInteger(options.stringNumber) || options.stringNumber < 1 || options.stringNumber > 12)) {
    throw new EditorAuditionV1Error('stringNumber must be an integer in [1,12].', 'INVALID_STRING_NUMBER');
  }
  if (options.fret !== undefined && (!Number.isSafeInteger(options.fret) || options.fret < 0 || options.fret > 36)) {
    throw new EditorAuditionV1Error('fret must be an integer in [0,36].', 'INVALID_FRET');
  }
};

export const createEditorAuditionRequestV1 = (
  score: ScoreDocumentV3,
  address: SemanticAddressV3,
  options: CreateEditorAuditionRequestV1Options
): Readonly<EditorAuditionRequestV1> | null => {
  validateOptions(options);
  if (address.kind !== 'note') return null;
  const resolved = resolveSemanticAddressV3(score, address);
  if (resolved.kind !== 'note') return null;
  const request: EditorAuditionRequestV1 = {
    requestId: options.requestId,
    sourceRevisionId: score.revision.id,
    pitch: Object.freeze({ midi: canonicalPitchToMidiV1(resolved.value.pitch) }),
    instrumentId: options.instrumentId,
    sourceEventId: address.eventId,
    ...(options.velocity === undefined ? {} : { velocity: options.velocity }),
    ...(options.durationMs === undefined ? {} : { durationMs: options.durationMs }),
    ...(options.stringNumber === undefined ? {} : { stringNumber: options.stringNumber }),
    ...(options.fret === undefined ? {} : { fret: options.fret })
  };
  return Object.freeze(request);
};
