export const SCORE_AUDIO_ENGINE_V010 = Object.freeze({
  release: "v0.1.0",
  releaseCommit: "d11a2dd9141169ddfec5901f3cadc4cce0d7b345",
  contractsPackage: "@st/score-audio-contracts@0.1.0",
  webPackage: "@st/score-audio-web@0.1.0",
} as const);

export type ScoreAudioInstrumentV010 =
  | "GRAND_PIANO"
  | "CLASSICAL_GUITAR"
  | "VIOLIN";

export type ScoreAudioReadinessV010 =
  | "ACTIVE_QUALIFIED"
  | "SUSPENDED"
  | "SCAFFOLD_UNQUALIFIED";

export interface ScoreAudioRuntimePortV010 {
  getInstrumentReadiness(instrument: ScoreAudioInstrumentV010): ScoreAudioReadinessV010;
  audition(input: {
    sourceRevisionId: string;
    midi: number;
    instrument: ScoreAudioInstrumentV010;
    durationMs?: number;
  }): Promise<{ ok: true } | { ok: false; code: string; message?: string }>;
  stopAll?(): void | Promise<void>;
  dispose?(): void | Promise<void>;
}

export interface ScoreAudioAuditionRequestV010 {
  sourceRevisionId: string;
  midi: number;
  instrument: ScoreAudioInstrumentV010;
  durationMs?: number;
}

export type ScoreAudioAuditionResultV010 =
  | { ok: true }
  | {
      ok: false;
      code:
        | "AUDIO_RUNTIME_UNAVAILABLE"
        | "AUDIO_INSTRUMENT_NOT_QUALIFIED"
        | "AUDIO_STALE_REVISION"
        | "AUDIO_RUNTIME_ERROR";
      message?: string;
    };

/**
 * P06 adapter seam for the official ST Score Audio Engine v0.1.0 runtime.
 *
 * This module deliberately does not implement WebAudio and does not infer pitch.
 * The host must supply a canonical, revision-bound request produced by Editor Core
 * and an external runtime implementing the public v0.1.0 behavior.
 */
export async function auditionWithScoreAudioV010(input: {
  runtime: ScoreAudioRuntimePortV010 | null | undefined;
  request: ScoreAudioAuditionRequestV010;
  currentRevisionId: string;
}): Promise<ScoreAudioAuditionResultV010> {
  if (input.request.sourceRevisionId !== input.currentRevisionId) {
    return { ok: false, code: "AUDIO_STALE_REVISION" };
  }

  if (!input.runtime) {
    return { ok: false, code: "AUDIO_RUNTIME_UNAVAILABLE" };
  }

  if (input.runtime.getInstrumentReadiness(input.request.instrument) !== "ACTIVE_QUALIFIED") {
    return { ok: false, code: "AUDIO_INSTRUMENT_NOT_QUALIFIED" };
  }

  try {
    const result = await input.runtime.audition(input.request);
    return result.ok
      ? { ok: true }
      : { ok: false, code: "AUDIO_RUNTIME_ERROR", message: result.message ?? result.code };
  } catch (error) {
    return {
      ok: false,
      code: "AUDIO_RUNTIME_ERROR",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
