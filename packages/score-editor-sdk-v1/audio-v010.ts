import { resolveSemanticAddressV3, type SemanticAddressV3 } from '../addressing-v3/src/index.js';
import type { Pitch } from '../score-model/src/index.js';
import type { ScoreDocumentV3 } from '../score-model-v3/src/index.js';
import type { AuditionRequest, InstrumentId } from '@st/score-audio-contracts';
import type { WebAudioEngine } from '@st/score-audio-web';
import type { ScoreEditorSdkCapabilityIdV1 } from './src/index.js';

export const SCORE_AUDIO_ENGINE_V010 = Object.freeze({
  release: 'v0.1.0',
  releaseCommit: 'd11a2dd9141169ddfec5901f3cadc4cce0d7b345',
  contractsPackage: '@st/score-audio-contracts@0.1.0',
  webPackage: '@st/score-audio-web@0.1.0'
} as const);

export type ScoreAudioRuntimeV010 = Pick<
  WebAudioEngine,
  'unlockFromUserGesture' | 'setInstrument' | 'getInstrumentProfile' | 'audition' | 'supports'
>;

export interface CreateScoreAudioAuditionRequestV010Options {
  readonly requestId: string;
  readonly instrumentId: InstrumentId;
  readonly velocity?: number;
  readonly durationMs?: number;
  readonly stringNumber?: number;
  readonly fret?: number;
}

export type ScoreAudioAuditionStatusV010 =
  | 'PLAYED'
  | 'SKIPPED_NON_NOTE'
  | 'RUNTIME_UNAVAILABLE'
  | 'INSTRUMENT_NOT_QUALIFIED'
  | 'STALE_SOURCE_REVISION'
  | 'FAILED';

export interface ScoreAudioAuditionOutcomeV010 {
  readonly status: ScoreAudioAuditionStatusV010;
  readonly request: Readonly<AuditionRequest> | null;
  readonly error: Readonly<{ readonly code: string; readonly message: string }> | null;
}

const SEMITONE: Readonly<Record<Pitch['step'], number>> = Object.freeze({
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11
});

export const canonicalPitchToMidiV010 = (pitch: Pitch): number => {
  const midi = 12 * (pitch.octave + 1) + SEMITONE[pitch.step] + pitch.alter;
  if (!Number.isSafeInteger(midi) || midi < 0 || midi > 127) {
    throw new RangeError('Canonical pitch is outside the MIDI audition range.');
  }
  return midi;
};

export const createScoreAudioAuditionRequestV010 = (
  score: ScoreDocumentV3,
  address: SemanticAddressV3,
  options: CreateScoreAudioAuditionRequestV010Options
): Readonly<AuditionRequest> | null => {
  if (address.kind !== 'note') return null;
  const resolved = resolveSemanticAddressV3(score, address);
  if (resolved.kind !== 'note') return null;

  const request: AuditionRequest = {
    requestId: options.requestId,
    sourceRevisionId: score.revision.id,
    pitch: Object.freeze({ midi: canonicalPitchToMidiV010(resolved.value.pitch) }),
    instrumentId: options.instrumentId,
    sourceEventId: address.eventId,
    ...(options.velocity === undefined ? {} : { velocity: options.velocity }),
    ...(options.durationMs === undefined ? {} : { durationMs: options.durationMs }),
    ...(options.stringNumber === undefined ? {} : { stringNumber: options.stringNumber }),
    ...(options.fret === undefined ? {} : { fret: options.fret })
  };

  return Object.freeze(request);
};

const outcome = (
  status: ScoreAudioAuditionStatusV010,
  request: Readonly<AuditionRequest> | null,
  error: Readonly<{ readonly code: string; readonly message: string }> | null = null
): Readonly<ScoreAudioAuditionOutcomeV010> => Object.freeze({ status, request, error });

export const auditionWithScoreAudioV010 = async (input: {
  readonly runtime: ScoreAudioRuntimeV010 | null | undefined;
  readonly request: Readonly<AuditionRequest> | null;
  readonly getCurrentRevisionId: () => string | null;
}): Promise<Readonly<ScoreAudioAuditionOutcomeV010>> => {
  const { runtime, request, getCurrentRevisionId } = input;
  if (request === null) return outcome('SKIPPED_NON_NOTE', null);
  if (!runtime || !runtime.supports('note-audition')) {
    return outcome('RUNTIME_UNAVAILABLE', request, Object.freeze({
      code: 'AUDIO_RUNTIME_UNAVAILABLE',
      message: 'ST Score Audio Engine v0.1.0 note audition runtime is unavailable.'
    }));
  }

  const stillCurrent = (): boolean => getCurrentRevisionId() === request.sourceRevisionId;
  if (!stillCurrent()) {
    return outcome('STALE_SOURCE_REVISION', request, Object.freeze({
      code: 'STALE_SOURCE_REVISION',
      message: 'Canonical score revision changed before audio execution.'
    }));
  }

  try {
    const unlocked = await runtime.unlockFromUserGesture();
    if (!unlocked.ok) return outcome('FAILED', request, unlocked.error);
    if (!stillCurrent()) {
      return outcome('STALE_SOURCE_REVISION', request, Object.freeze({
        code: 'STALE_SOURCE_REVISION',
        message: 'Canonical score revision changed after audio unlock.'
      }));
    }

    await runtime.setInstrument(request.instrumentId);
    if (!stillCurrent()) {
      return outcome('STALE_SOURCE_REVISION', request, Object.freeze({
        code: 'STALE_SOURCE_REVISION',
        message: 'Canonical score revision changed while preparing the audio instrument.'
      }));
    }

    const profile = runtime.getInstrumentProfile(request.instrumentId);
    if (profile.lifecycle !== 'ACTIVE' || profile.sampleReadiness !== 'QUALIFIED') {
      return outcome('INSTRUMENT_NOT_QUALIFIED', request, Object.freeze({
        code: 'AUDIO_INSTRUMENT_NOT_QUALIFIED',
        message: `${profile.displayName} is ${profile.lifecycle}/${profile.sampleReadiness} in ST Score Audio Engine v0.1.0.`
      }));
    }

    const result = await runtime.audition(request);
    return result.ok ? outcome('PLAYED', request) : outcome('FAILED', request, result.error);
  } catch (error) {
    return outcome('FAILED', request, Object.freeze({
      code: 'AUDIO_RUNTIME_FAILURE',
      message: error instanceof Error ? error.message : 'Audio runtime failed.'
    }));
  }
};

export const createScoreEditorSdkAudioCapabilityProbeV010 = (
  baseSupports: (capability: ScoreEditorSdkCapabilityIdV1) => boolean,
  runtime: ScoreAudioRuntimeV010 | null | undefined
): Readonly<{ readonly supports: (capability: ScoreEditorSdkCapabilityIdV1) => boolean }> => Object.freeze({
  supports: (capability: ScoreEditorSdkCapabilityIdV1): boolean =>
    capability === 'audioAudition'
      ? Boolean(runtime?.supports('note-audition'))
      : baseSupports(capability)
});
