import type { SemanticAddressV3 } from '../../addressing-v3/src/index.js';
import type { PlaybackEventV1, PlaybackPlanV1 } from '../../playback-plan-v1/src/index.js';

export const PLAYBACK_TRANSPORT_V1_VERSION = '1.0.0' as const;
export const DEFAULT_PLAYBACK_TEMPO_BPM = 120 as const;
export const MIN_PLAYBACK_TEMPO_BPM = 20 as const;
export const MAX_PLAYBACK_TEMPO_BPM = 300 as const;
export const DEFAULT_PLAYBACK_GAIN = 0.055 as const;

export interface ScheduledPlaybackToneV1 { readonly stop: () => void }
export interface PlaybackAudioHostV1 {
  readonly currentTime: () => number;
  readonly resume: () => Promise<void>;
  readonly scheduleTone: (frequencyHz: number, startSeconds: number, durationSeconds: number, gain: number) => ScheduledPlaybackToneV1;
  readonly dispose: () => Promise<void>;
}

export type PlaybackTransportModeV1 = 'idle' | 'playing' | 'paused' | 'stopped' | 'ended';
export interface PlaybackTransportSnapshotV1 {
  readonly version: typeof PLAYBACK_TRANSPORT_V1_VERSION;
  readonly documentId: string;
  readonly revisionId: string;
  readonly mode: PlaybackTransportModeV1;
  readonly tempoBpm: number;
  readonly positionWholeNotes: number;
  readonly durationWholeNotes: number;
  readonly cursor: SemanticAddressV3 | null;
}

export type PlaybackTransportV1ErrorCode = 'EMPTY_PLAN' | 'INVALID_TEMPO' | 'INVALID_POSITION' | 'AUDIO_UNAVAILABLE' | 'AUDIO_OPERATION_FAILED';
export class PlaybackTransportV1Error extends Error {
  readonly code: PlaybackTransportV1ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: PlaybackTransportV1ErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'PlaybackTransportV1Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const boundedTempo = (value: number): number => {
  if (!Number.isFinite(value) || value < MIN_PLAYBACK_TEMPO_BPM || value > MAX_PLAYBACK_TEMPO_BPM) {
    throw new PlaybackTransportV1Error(`tempoBpm must be finite and within ${MIN_PLAYBACK_TEMPO_BPM}..${MAX_PLAYBACK_TEMPO_BPM}`, 'INVALID_TEMPO');
  }
  return value;
};
const clampPosition = (value: number, duration: number): number => {
  if (!Number.isFinite(value) || value < 0) throw new PlaybackTransportV1Error('Playback position must be a finite non-negative whole-note value.', 'INVALID_POSITION');
  return Math.min(value, duration);
};
const secondsPerWholeNote = (tempoBpm: number): number => 240 / tempoBpm;

const currentCursor = (events: readonly PlaybackEventV1[], position: number): SemanticAddressV3 | null => {
  const event = events.find((item) => position >= item.startWholeNotes && position < item.startWholeNotes + item.durationWholeNotes);
  return event?.address ?? null;
};

export interface LocalPlaybackTransportV1 {
  readonly version: typeof PLAYBACK_TRANSPORT_V1_VERSION;
  readonly getSnapshot: () => Readonly<PlaybackTransportSnapshotV1>;
  readonly play: () => Promise<Readonly<PlaybackTransportSnapshotV1>>;
  readonly pause: () => Readonly<PlaybackTransportSnapshotV1>;
  readonly stop: () => Readonly<PlaybackTransportSnapshotV1>;
  readonly seek: (positionWholeNotes: number) => Readonly<PlaybackTransportSnapshotV1>;
  readonly setTempo: (tempoBpm: number) => Readonly<PlaybackTransportSnapshotV1>;
  readonly dispose: () => Promise<void>;
}

export const createLocalPlaybackTransportV1 = (
  host: PlaybackAudioHostV1,
  plan: PlaybackPlanV1,
  options: Readonly<{ tempoBpm?: number; gain?: number }> = {}
): Readonly<LocalPlaybackTransportV1> => {
  let tempoBpm = boundedTempo(options.tempoBpm ?? DEFAULT_PLAYBACK_TEMPO_BPM);
  const gain = options.gain ?? DEFAULT_PLAYBACK_GAIN;
  if (!Number.isFinite(gain) || gain <= 0 || gain > 0.2) throw new RangeError('gain must be finite and within (0, 0.2].');
  let mode: PlaybackTransportModeV1 = 'idle';
  let storedPosition = 0;
  let startedAtHostSeconds = 0;
  let startedAtPosition = 0;
  let active: ScheduledPlaybackToneV1[] = [];
  let disposed = false;

  const stopScheduled = (): void => {
    for (const tone of active) {
      try { tone.stop(); } catch { /* presentation/audio cleanup is best effort */ }
    }
    active = [];
  };
  const positionNow = (): number => {
    if (mode !== 'playing') return storedPosition;
    const value = startedAtPosition + Math.max(0, host.currentTime() - startedAtHostSeconds) / secondsPerWholeNote(tempoBpm);
    if (value >= plan.durationWholeNotes) {
      storedPosition = plan.durationWholeNotes;
      mode = 'ended';
      active = [];
      return storedPosition;
    }
    return value;
  };
  const snapshot = (): Readonly<PlaybackTransportSnapshotV1> => {
    const position = positionNow();
    return Object.freeze({
      version: PLAYBACK_TRANSPORT_V1_VERSION,
      documentId: plan.documentId,
      revisionId: plan.revisionId,
      mode,
      tempoBpm,
      positionWholeNotes: position,
      durationWholeNotes: plan.durationWholeNotes,
      cursor: currentCursor(plan.events, position)
    });
  };
  const scheduleFrom = (position: number): void => {
    stopScheduled();
    const hostStart = host.currentTime();
    const secondsPerWhole = secondsPerWholeNote(tempoBpm);
    for (const event of plan.events) {
      const eventEnd = event.startWholeNotes + event.durationWholeNotes;
      if (eventEnd <= position) continue;
      const skipped = Math.max(0, position - event.startWholeNotes);
      const remaining = event.durationWholeNotes - skipped;
      const startWhole = Math.max(0, event.startWholeNotes - position);
      const startSeconds = hostStart + startWhole * secondsPerWhole;
      const durationSeconds = remaining * secondsPerWhole;
      const eventGain = gain / Math.max(1, Math.sqrt(event.pitches.length));
      for (const pitch of event.pitches) active.push(host.scheduleTone(pitch.frequencyHz, startSeconds, durationSeconds, eventGain));
    }
    startedAtHostSeconds = hostStart;
    startedAtPosition = position;
    storedPosition = position;
    mode = 'playing';
  };
  const requireActive = (): void => {
    if (disposed) throw new PlaybackTransportV1Error('Playback transport has been disposed.', 'AUDIO_OPERATION_FAILED');
  };

  const value: LocalPlaybackTransportV1 = {
    version: PLAYBACK_TRANSPORT_V1_VERSION,
    getSnapshot: snapshot,
    play: async () => {
      requireActive();
      if (plan.events.length === 0 || plan.durationWholeNotes <= 0) throw new PlaybackTransportV1Error('Playback plan contains no playable timed events.', 'EMPTY_PLAN');
      if (mode === 'playing') return snapshot();
      if (mode === 'ended') storedPosition = 0;
      try {
        await host.resume();
        scheduleFrom(storedPosition);
      } catch (error) {
        stopScheduled();
        mode = 'stopped';
        throw error instanceof PlaybackTransportV1Error
          ? error
          : new PlaybackTransportV1Error('Local audio playback could not start.', 'AUDIO_OPERATION_FAILED', { cause: error instanceof Error ? error.message : String(error) });
      }
      return snapshot();
    },
    pause: () => {
      requireActive();
      if (mode === 'playing') {
        storedPosition = positionNow();
        stopScheduled();
        mode = 'paused';
      }
      return snapshot();
    },
    stop: () => {
      requireActive();
      stopScheduled();
      storedPosition = 0;
      mode = 'stopped';
      return snapshot();
    },
    seek: (positionWholeNotes) => {
      requireActive();
      const next = clampPosition(positionWholeNotes, plan.durationWholeNotes);
      const wasPlaying = mode === 'playing';
      stopScheduled();
      storedPosition = next;
      if (next >= plan.durationWholeNotes) mode = 'ended';
      else if (wasPlaying) scheduleFrom(next);
      else if (mode === 'idle' || mode === 'ended') mode = 'paused';
      return snapshot();
    },
    setTempo: (nextTempoBpm) => {
      requireActive();
      const next = boundedTempo(nextTempoBpm);
      const wasPlaying = mode === 'playing';
      const position = positionNow();
      if (wasPlaying) stopScheduled();
      tempoBpm = next;
      storedPosition = position;
      if (wasPlaying && position < plan.durationWholeNotes) scheduleFrom(position);
      return snapshot();
    },
    dispose: async () => {
      if (disposed) return;
      stopScheduled();
      disposed = true;
      mode = 'stopped';
      try { await host.dispose(); } catch { /* disposal cannot affect canonical/editor state */ }
    }
  };
  return Object.freeze(value);
};

export const createBrowserWebAudioHostV1 = (): PlaybackAudioHostV1 => {
  const scope = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  const Context = typeof globalThis.AudioContext === 'function' ? globalThis.AudioContext : scope.webkitAudioContext;
  if (Context === undefined) throw new PlaybackTransportV1Error('Web Audio API is unavailable in this browser.', 'AUDIO_UNAVAILABLE');
  const context = new Context();
  let disposed = false;
  return Object.freeze({
    currentTime: () => context.currentTime,
    resume: async () => {
      if (disposed) throw new PlaybackTransportV1Error('Web Audio host is disposed.', 'AUDIO_OPERATION_FAILED');
      if (context.state === 'suspended') await context.resume();
    },
    scheduleTone: (frequencyHz, startSeconds, durationSeconds, gainValue) => {
      if (disposed) throw new PlaybackTransportV1Error('Web Audio host is disposed.', 'AUDIO_OPERATION_FAILED');
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = Math.max(context.currentTime, startSeconds);
      const duration = Math.max(0.015, durationSeconds);
      const end = start + duration;
      const attack = Math.min(0.008, duration / 4);
      const release = Math.min(0.02, duration / 3);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequencyHz, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(gainValue, start + attack);
      gain.gain.setValueAtTime(gainValue, Math.max(start + attack, end - release));
      gain.gain.linearRampToValueAtTime(0.0001, end);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(end + 0.005);
      let stopped = false;
      return Object.freeze({ stop: () => { if (stopped) return; stopped = true; try { oscillator.stop(); } catch { /* already stopped */ } } });
    },
    dispose: async () => {
      if (disposed) return;
      disposed = true;
      if (context.state !== 'closed') await context.close();
    }
  });
};
