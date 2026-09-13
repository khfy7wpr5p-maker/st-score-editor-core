import type { ScoreEditorBrowserAppSnapshot } from './index.js';
import type { ReleaseHardeningControllerOptions } from './release-hardened.js';
import {
  createTripletRetimingStandaloneBrowserAppRuntime,
  createTripletRetimingStandaloneScoreEditorController,
  tripletRetimingBrowserAppProfile,
  type TripletRetimingStandaloneScoreEditorController
} from './triplet-retiming-authoring.js';
import {
  createEditorAuditionRequestV1,
  type EditorAudioPortV1,
  type EditorAuditionInstrumentIdV1,
  type EditorAuditionRequestV1
} from '../../editor-audition-v1/src/index.js';

export const AUDIO_HOST_INTEGRATED_BROWSER_VERSION = '1.0.0' as const;

export const audioHostIntegratedBrowserAppProfile = Object.freeze({
  ...tripletRetimingBrowserAppProfile,
  noteAuditionAdapterAvailable: true,
  noteAuditionUiAvailable: true,
  audioEngineBundled: false,
  externalAudioPortRequired: true,
  rendererAudioAuthority: false,
  auditionCanonicalMutationAuthority: false,
  auditionHistoryMutationAuthority: false
});

export type AudioHostAuditionStatusV1 =
  | 'DETACHED'
  | 'READY'
  | 'SKIPPED_NON_NOTE'
  | 'PLAYED'
  | 'FAILED'
  | 'STALE_SOURCE_REVISION';

export interface AudioHostStateV1 {
  readonly version: typeof AUDIO_HOST_INTEGRATED_BROWSER_VERSION;
  readonly attached: boolean;
  readonly instrumentId: EditorAuditionInstrumentIdV1;
  readonly lastStatus: AudioHostAuditionStatusV1;
  readonly lastError: Readonly<{ readonly code: string; readonly message: string }> | null;
}

export interface RenderedNoteAuditionResultV1 {
  readonly snapshot: Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly request: Readonly<EditorAuditionRequestV1> | null;
  readonly audioStatus: AudioHostAuditionStatusV1;
  readonly audioError: Readonly<{ readonly code: string; readonly message: string }> | null;
}

export interface AudioHostIntegratedStandaloneScoreEditorController extends Omit<TripletRetimingStandaloneScoreEditorController, 'profile' | 'mount' | 'unmount'> {
  readonly profile: typeof audioHostIntegratedBrowserAppProfile;
  readonly attachAudioPort: (audioPort: EditorAudioPortV1) => Readonly<AudioHostStateV1>;
  readonly detachAudioPort: () => Readonly<AudioHostStateV1>;
  readonly getAudioHostState: () => Readonly<AudioHostStateV1>;
  readonly setAuditionInstrument: (instrumentId: EditorAuditionInstrumentIdV1) => Readonly<AudioHostStateV1>;
  readonly selectRenderedScoreNoteRefWithAudition: (rawRef: unknown) => Promise<Readonly<RenderedNoteAuditionResultV1>>;
  readonly mount: (root: HTMLElement) => void;
  readonly unmount: () => void;
}

const frozenError = (code: string, message: string) => Object.freeze({ code, message });

export const createAudioHostIntegratedStandaloneScoreEditorController = (
  options: ReleaseHardeningControllerOptions = {}
): Readonly<AudioHostIntegratedStandaloneScoreEditorController> => {
  const base = createTripletRetimingStandaloneScoreEditorController(options);
  let audioPort: EditorAudioPortV1 | null = null;
  let instrumentId: EditorAuditionInstrumentIdV1 = 'GRAND_PIANO';
  let lastStatus: AudioHostAuditionStatusV1 = 'DETACHED';
  let lastError: Readonly<{ readonly code: string; readonly message: string }> | null = null;
  let requestSequence = 0;
  let root: HTMLElement | null = null;
  let toolbarObserver: MutationObserver | null = null;

  const state = (): Readonly<AudioHostStateV1> => Object.freeze({
    version: AUDIO_HOST_INTEGRATED_BROWSER_VERSION,
    attached: audioPort !== null,
    instrumentId,
    lastStatus,
    lastError
  });

  const sourceRevisionStillCurrent = (sourceRevisionId: string): boolean =>
    base.getDocument()?.session.history.present.score.revision.id === sourceRevisionId;

  const decorate = (): void => {
    if (root === null) return;
    const toolbar = root.querySelector<HTMLElement>('.stse-toolbar');
    if (toolbar === null) return;
    let select = toolbar.querySelector<HTMLSelectElement>('[data-st-audition-instrument]');
    if (select === null) {
      select = toolbar.ownerDocument.createElement('select');
      select.setAttribute('data-st-audition-instrument', AUDIO_HOST_INTEGRATED_BROWSER_VERSION);
      select.setAttribute('aria-label', 'Audition instrument');
      for (const descriptor of [
        ['GRAND_PIANO', 'Piano'],
        ['CLASSICAL_GUITAR', 'Guitar']
      ] as const) {
        const option = toolbar.ownerDocument.createElement('option');
        option.value = descriptor[0];
        option.textContent = descriptor[1];
        select.append(option);
      }
      select.addEventListener('change', () => {
        const value = select?.value;
        if (value === 'GRAND_PIANO' || value === 'CLASSICAL_GUITAR') controller.setAuditionInstrument(value);
      });
      toolbar.append(select);
    }
    select.value = instrumentId;
    select.disabled = audioPort === null;
    select.title = audioPort === null ? 'Audio Engine host is not attached.' : 'Sound used when touching a rendered note.';
  };

  const outcome = (
    snapshot: Readonly<ScoreEditorBrowserAppSnapshot>,
    request: Readonly<EditorAuditionRequestV1> | null,
    status: AudioHostAuditionStatusV1,
    error: Readonly<{ readonly code: string; readonly message: string }> | null = null
  ): Readonly<RenderedNoteAuditionResultV1> => {
    lastStatus = status;
    lastError = error;
    decorate();
    return Object.freeze({ snapshot, request, audioStatus: status, audioError: error });
  };

  const selectRenderedScoreNoteRefWithAudition = async (rawRef: unknown): Promise<Readonly<RenderedNoteAuditionResultV1>> => {
    const snapshot = base.selectRenderedScoreNoteRef(rawRef);
    const documentValue = base.getDocument();
    if (documentValue === null || documentValue.session.selection === null) {
      return outcome(snapshot, null, 'SKIPPED_NON_NOTE');
    }
    const score = documentValue.session.history.present.score;
    const request = createEditorAuditionRequestV1(score, documentValue.session.selection, Object.freeze({
      requestId: `editor-note-touch-${++requestSequence}`,
      instrumentId,
      velocity: 0.78,
      durationMs: instrumentId === 'CLASSICAL_GUITAR' ? 1000 : 800
    }));
    if (request === null) return outcome(snapshot, null, 'SKIPPED_NON_NOTE');
    const port = audioPort;
    if (port === null) return outcome(snapshot, request, 'FAILED', frozenError('AUDIO_PORT_UNAVAILABLE', 'Audio Engine host is not attached.'));

    try {
      const unlocked = await port.unlockFromUserGesture();
      if (!unlocked.ok) return outcome(snapshot, request, 'FAILED', unlocked.error);
      if (!sourceRevisionStillCurrent(request.sourceRevisionId)) {
        return outcome(snapshot, request, 'STALE_SOURCE_REVISION', frozenError('STALE_SOURCE_REVISION', 'Canonical score revision changed before audition execution.'));
      }
      await port.setInstrument(request.instrumentId);
      if (!sourceRevisionStillCurrent(request.sourceRevisionId)) {
        return outcome(snapshot, request, 'STALE_SOURCE_REVISION', frozenError('STALE_SOURCE_REVISION', 'Canonical score revision changed while preparing the audition instrument.'));
      }
      const result = await port.audition(request);
      return result.ok
        ? outcome(snapshot, request, 'PLAYED')
        : outcome(snapshot, request, 'FAILED', result.error);
    } catch (error) {
      return outcome(snapshot, request, 'FAILED', frozenError('AUDIO_PORT_FAILURE', error instanceof Error ? error.message : 'Audio port failed.'));
    }
  };

  const observeToolbarLifecycle = (nextRoot: HTMLElement): void => {
    toolbarObserver?.disconnect();
    const Observer = nextRoot.ownerDocument.defaultView?.MutationObserver;
    if (Observer === undefined) return;
    toolbarObserver = new Observer(() => decorate());
    toolbarObserver.observe(nextRoot, { childList: true, subtree: true });
  };

  base.subscribe(() => decorate());

  const controller: AudioHostIntegratedStandaloneScoreEditorController = {
    ...base,
    profile: audioHostIntegratedBrowserAppProfile,
    attachAudioPort: (nextPort) => {
      audioPort = nextPort;
      lastStatus = 'READY';
      lastError = null;
      decorate();
      return state();
    },
    detachAudioPort: () => {
      audioPort = null;
      lastStatus = 'DETACHED';
      lastError = null;
      decorate();
      return state();
    },
    getAudioHostState: state,
    setAuditionInstrument: (nextInstrumentId) => {
      instrumentId = nextInstrumentId;
      lastStatus = audioPort === null ? 'DETACHED' : 'READY';
      lastError = null;
      decorate();
      return state();
    },
    selectRenderedScoreNoteRefWithAudition,
    mount: (nextRoot) => {
      root = nextRoot;
      base.mount(nextRoot);
      observeToolbarLifecycle(nextRoot);
      decorate();
    },
    unmount: () => {
      toolbarObserver?.disconnect();
      toolbarObserver = null;
      root = null;
      base.unmount();
    }
  };

  return Object.freeze(controller);
};

export const createAudioHostIntegratedStandaloneBrowserAppRuntime = () => {
  const base = createTripletRetimingStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: audioHostIntegratedBrowserAppProfile,
    createController: createAudioHostIntegratedStandaloneScoreEditorController,
    audioAudition: Object.freeze({
      version: AUDIO_HOST_INTEGRATED_BROWSER_VERSION,
      bundledEngine: false,
      externalAudioPortRequired: true,
      canonicalMutationAuthority: false,
      historyMutationAuthority: false,
      rendererAudioAuthority: false,
      instruments: Object.freeze(['GRAND_PIANO', 'CLASSICAL_GUITAR'] as const)
    })
  });
};
