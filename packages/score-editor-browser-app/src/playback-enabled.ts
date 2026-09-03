import type { SemanticAddressV3 } from '../../addressing-v3/src/index.js';
import { createPlaybackPlanV1, type PlaybackPlanV1Status } from '../../playback-plan-v1/src/index.js';
import {
  DEFAULT_PLAYBACK_TEMPO_BPM,
  MAX_PLAYBACK_TEMPO_BPM,
  MIN_PLAYBACK_TEMPO_BPM,
  createBrowserWebAudioHostV1,
  createLocalPlaybackTransportV1,
  type LocalPlaybackTransportV1,
  type PlaybackAudioHostV1,
  type PlaybackTransportModeV1
} from '../../playback-web-audio/src/index.js';
import type { RecoveryEnabledControllerOptions } from './recovery-enabled.js';
import {
  createViewportEnabledStandaloneBrowserAppRuntime,
  createViewportEnabledStandaloneScoreEditorController,
  viewportEnabledBrowserAppProfile,
  type ViewportEnabledStandaloneScoreEditorController
} from './viewport-enabled.js';

export const PLAYBACK_ENABLED_BROWSER_APP_VERSION = '1.0.0' as const;

export const playbackEnabledBrowserAppProfile = Object.freeze({
  ...viewportEnabledBrowserAppProfile,
  playbackBundled: true,
  playbackCanonicalAuthority: false,
  playbackEditorAdmissionCoupled: false,
  playbackNetworkCapable: false,
  playbackPlanSource: 'ScoreDocumentV3' as const,
  playbackOutput: 'browser-web-audio-local' as const,
  playbackCursorMutationAuthority: false,
  playbackDefaultTempoBpm: DEFAULT_PLAYBACK_TEMPO_BPM
});

export interface PlaybackEnabledControllerOptions extends RecoveryEnabledControllerOptions {
  readonly playbackHostFactory?: () => PlaybackAudioHostV1;
  readonly playbackTempoBpm?: number;
}

export interface BrowserPlaybackState {
  readonly version: typeof PLAYBACK_ENABLED_BROWSER_APP_VERSION;
  readonly available: boolean;
  readonly mode: PlaybackTransportModeV1;
  readonly documentId: string | null;
  readonly revisionId: string | null;
  readonly tempoBpm: number;
  readonly positionWholeNotes: number;
  readonly durationWholeNotes: number;
  readonly cursor: SemanticAddressV3 | null;
  readonly planStatus: PlaybackPlanV1Status | null;
  readonly warningCount: number;
  readonly status: Readonly<{ code: string; message: string }>;
}

export interface PlaybackEnabledStandaloneScoreEditorController extends Omit<ViewportEnabledStandaloneScoreEditorController, 'profile' | 'mount' | 'unmount'> {
  readonly profile: typeof playbackEnabledBrowserAppProfile;
  readonly mount: (root: HTMLElement) => void;
  readonly unmount: () => void;
  readonly getPlaybackState: () => Readonly<BrowserPlaybackState>;
  readonly playbackPlay: () => Promise<Readonly<BrowserPlaybackState>>;
  readonly playbackPause: () => Readonly<BrowserPlaybackState>;
  readonly playbackStop: () => Readonly<BrowserPlaybackState>;
  readonly playbackSeek: (positionWholeNotes: number) => Readonly<BrowserPlaybackState>;
  readonly playbackSetTempo: (tempoBpm: number) => Readonly<BrowserPlaybackState>;
}

const audioApiAvailable = (): boolean => {
  const scope = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  return typeof globalThis.AudioContext === 'function' || typeof scope.webkitAudioContext === 'function';
};
const validTempo = (value: number): number => {
  if (!Number.isFinite(value) || value < MIN_PLAYBACK_TEMPO_BPM || value > MAX_PLAYBACK_TEMPO_BPM) {
    throw new RangeError(`playback tempo must be within ${MIN_PLAYBACK_TEMPO_BPM}..${MAX_PLAYBACK_TEMPO_BPM}`);
  }
  return value;
};

export const createPlaybackEnabledStandaloneScoreEditorController = (
  options: PlaybackEnabledControllerOptions = {}
): Readonly<PlaybackEnabledStandaloneScoreEditorController> => {
  const base = createViewportEnabledStandaloneScoreEditorController(options);
  const hostFactory = options.playbackHostFactory ?? createBrowserWebAudioHostV1;
  const injectedHost = options.playbackHostFactory !== undefined;
  let tempoBpm = validTempo(options.playbackTempoBpm ?? DEFAULT_PLAYBACK_TEMPO_BPM);
  let transport: Readonly<LocalPlaybackTransportV1> | null = null;
  let planStatus: PlaybackPlanV1Status | null = null;
  let warningCount = 0;
  let playbackStatus: Readonly<{ code: string; message: string }> = Object.freeze({ code: 'PLAYBACK_IDLE', message: 'Playback is ready when a document contains playable notes.' });
  let root: HTMLElement | null = null;
  let playGeneration = 0;

  const transportSnapshot = () => transport?.getSnapshot() ?? null;
  const state = (): Readonly<BrowserPlaybackState> => {
    const snapshot = transportSnapshot();
    const current = base.getDocument();
    return Object.freeze({
      version: PLAYBACK_ENABLED_BROWSER_APP_VERSION,
      available: injectedHost || audioApiAvailable(),
      mode: snapshot?.mode ?? 'idle',
      documentId: snapshot?.documentId ?? current?.session.history.present.score.id ?? null,
      revisionId: snapshot?.revisionId ?? current?.session.history.present.score.revision.id ?? null,
      tempoBpm: snapshot?.tempoBpm ?? tempoBpm,
      positionWholeNotes: snapshot?.positionWholeNotes ?? 0,
      durationWholeNotes: snapshot?.durationWholeNotes ?? 0,
      cursor: snapshot?.cursor ?? null,
      planStatus,
      warningCount,
      status: playbackStatus
    });
  };
  const disposeTransport = (): void => {
    const previous = transport;
    transport = null;
    if (previous !== null) {
      try { previous.stop(); } catch { /* playback cleanup cannot affect editor state */ }
      void previous.dispose();
    }
  };
  const updateStatusFromMode = (): void => {
    const snapshot = transportSnapshot();
    if (snapshot === null) return;
    if (snapshot.mode === 'playing') playbackStatus = Object.freeze({ code: 'PLAYBACK_PLAYING', message: planStatus === 'PARTIAL' ? 'Playing available canonical notes; some playback semantics are deferred.' : 'Playing local canonical score audio.' });
    else if (snapshot.mode === 'paused') playbackStatus = Object.freeze({ code: 'PLAYBACK_PAUSED', message: 'Playback paused.' });
    else if (snapshot.mode === 'stopped') playbackStatus = Object.freeze({ code: 'PLAYBACK_STOPPED', message: 'Playback stopped.' });
    else if (snapshot.mode === 'ended') playbackStatus = Object.freeze({ code: 'PLAYBACK_ENDED', message: 'Playback reached the end.' });
  };
  const augmentUi = (): void => {
    if (root === null) return;
    const toolbar = root.querySelector<HTMLElement>('.stse-toolbar');
    if (toolbar === null) return;
    let controls = toolbar.querySelector<HTMLElement>('[data-st-score-editor-playback-controls]');
    if (controls === null) {
      controls = toolbar.ownerDocument.createElement('div');
      controls.setAttribute('data-st-score-editor-playback-controls', PLAYBACK_ENABLED_BROWSER_APP_VERSION);
      controls.style.display = 'flex'; controls.style.gap = '4px'; controls.style.alignItems = 'center';
      const play = toolbar.ownerDocument.createElement('button'); play.type = 'button'; play.textContent = 'Play'; play.setAttribute('data-playback-action', 'play'); play.addEventListener('click', () => { void controller.playbackPlay(); });
      const pause = toolbar.ownerDocument.createElement('button'); pause.type = 'button'; pause.textContent = 'Pause'; pause.setAttribute('data-playback-action', 'pause'); pause.addEventListener('click', () => { controller.playbackPause(); });
      const stop = toolbar.ownerDocument.createElement('button'); stop.type = 'button'; stop.textContent = 'Stop'; stop.setAttribute('data-playback-action', 'stop'); stop.addEventListener('click', () => { controller.playbackStop(); });
      const label = toolbar.ownerDocument.createElement('span'); label.setAttribute('data-playback-status', 'true'); label.style.fontSize = '12px';
      controls.append(play, pause, stop, label);
      toolbar.append(controls);
    }
    const snapshot = state();
    const hasDocument = base.getDocument() !== null;
    const play = controls.querySelector<HTMLButtonElement>('[data-playback-action="play"]');
    const pause = controls.querySelector<HTMLButtonElement>('[data-playback-action="pause"]');
    const stop = controls.querySelector<HTMLButtonElement>('[data-playback-action="stop"]');
    const label = controls.querySelector<HTMLElement>('[data-playback-status]');
    if (play !== null) play.disabled = !hasDocument;
    if (pause !== null) pause.disabled = snapshot.mode !== 'playing';
    if (stop !== null) stop.disabled = snapshot.mode === 'idle' || snapshot.mode === 'stopped';
    if (label !== null) label.textContent = `${snapshot.tempoBpm} BPM · ${snapshot.mode}`;
  };

  base.subscribe((snapshot) => {
    const playback = transportSnapshot();
    if (playback !== null && snapshot.revisionId !== playback.revisionId) {
      playGeneration += 1;
      disposeTransport();
      planStatus = null;
      warningCount = 0;
      playbackStatus = Object.freeze({ code: 'PLAYBACK_STALE_REVISION_STOPPED', message: 'Playback stopped because the canonical revision changed.' });
    } else updateStatusFromMode();
    augmentUi();
  });

  const controller: PlaybackEnabledStandaloneScoreEditorController = {
    ...base,
    profile: playbackEnabledBrowserAppProfile,
    mount: (nextRoot) => { base.mount(nextRoot); root = nextRoot; augmentUi(); },
    unmount: () => { playGeneration += 1; disposeTransport(); root = null; base.unmount(); },
    getPlaybackState: () => { updateStatusFromMode(); return state(); },
    playbackPlay: async () => {
      const generation = ++playGeneration;
      const document = base.getDocument();
      if (document === null) {
        playbackStatus = Object.freeze({ code: 'PLAYBACK_NO_DOCUMENT', message: 'Playback requires an open score document.' });
        augmentUi();
        return state();
      }
      const score = document.session.history.present.score;
      const existing = transportSnapshot();
      if (existing === null || existing.revisionId !== score.revision.id) {
        disposeTransport();
        const plan = createPlaybackPlanV1(score);
        planStatus = plan.status;
        warningCount = plan.warnings.length;
        tempoBpm = validTempo(tempoBpm);
        if (plan.status === 'EMPTY' || plan.events.length === 0) {
          playbackStatus = Object.freeze({ code: 'PLAYBACK_NO_PLAYABLE_EVENTS', message: 'No playable normal note/chord events are available in the current score.' });
          augmentUi();
          return state();
        }
        try {
          transport = createLocalPlaybackTransportV1(hostFactory(), plan, { tempoBpm });
        } catch (error) {
          playbackStatus = Object.freeze({ code: 'PLAYBACK_UNAVAILABLE', message: error instanceof Error ? error.message : 'Local audio playback is unavailable.' });
          augmentUi();
          return state();
        }
      }
      try {
        await transport?.play();
      } catch (error) {
        playbackStatus = Object.freeze({ code: 'PLAYBACK_ERROR', message: error instanceof Error ? error.message : 'Playback could not start.' });
        augmentUi();
        return state();
      }
      const after = base.getDocument();
      if (generation !== playGeneration || after === null || after.session.history.present.score.revision.id !== score.revision.id) {
        disposeTransport();
        playbackStatus = Object.freeze({ code: 'PLAYBACK_STALE_REVISION_STOPPED', message: 'Playback start was cancelled because the canonical revision changed.' });
        augmentUi();
        return state();
      }
      updateStatusFromMode();
      augmentUi();
      return state();
    },
    playbackPause: () => {
      playGeneration += 1;
      if (transport !== null) transport.pause();
      updateStatusFromMode(); augmentUi(); return state();
    },
    playbackStop: () => {
      playGeneration += 1;
      if (transport !== null) transport.stop();
      updateStatusFromMode(); augmentUi(); return state();
    },
    playbackSeek: (positionWholeNotes) => {
      if (transport === null) {
        playbackStatus = Object.freeze({ code: 'PLAYBACK_NOT_PREPARED', message: 'Start playback once before seeking.' });
        augmentUi(); return state();
      }
      transport.seek(positionWholeNotes); updateStatusFromMode(); augmentUi(); return state();
    },
    playbackSetTempo: (nextTempoBpm) => {
      tempoBpm = validTempo(nextTempoBpm);
      if (transport !== null) transport.setTempo(tempoBpm);
      updateStatusFromMode(); augmentUi(); return state();
    }
  };
  return Object.freeze(controller);
};

export const createPlaybackEnabledStandaloneBrowserAppRuntime = () => {
  const base = createViewportEnabledStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: playbackEnabledBrowserAppProfile,
    createController: createPlaybackEnabledStandaloneScoreEditorController,
    playback: Object.freeze({
      version: PLAYBACK_ENABLED_BROWSER_APP_VERSION,
      bundled: true,
      canonicalAuthority: false,
      editorAdmissionCoupled: false,
      networkCapable: false,
      output: 'browser-web-audio-local' as const,
      planSource: 'ScoreDocumentV3' as const,
      defaultTempoBpm: DEFAULT_PLAYBACK_TEMPO_BPM,
      tempoRange: Object.freeze([MIN_PLAYBACK_TEMPO_BPM, MAX_PLAYBACK_TEMPO_BPM] as const),
      gracePlayback: 'deferred-partial' as const,
      cursorMutationAuthority: false
    })
  });
};
