import type { AuditionRequest, InstrumentId } from '@st/score-audio-contracts';
import type { TeacherWorkflowControllerOptions } from './teacher-workflow.js';
import {
  createMobileTeacherViewportStandaloneBrowserAppRuntime,
  createMobileTeacherViewportStandaloneScoreEditorController,
  mobileTeacherViewportBrowserAppProfile,
  type MobileTeacherViewportStandaloneScoreEditorController
} from './mobile-teacher-viewport.js';
import {
  auditionWithScoreAudioV010,
  createScoreAudioAuditionRequestV010,
  type ScoreAudioAuditionStatusV010,
  type ScoreAudioRuntimeV010
} from '../../score-editor-sdk-v1/audio-v010.js';

export const AUDIO_HOST_INTEGRATED_BROWSER_VERSION = '1.2.0' as const;
export const QUALIFIED_AUDITION_INSTRUMENTS_V1 = Object.freeze(['GRAND_PIANO', 'VIOLIN'] as const);
export type QualifiedAuditionInstrumentV1 = (typeof QUALIFIED_AUDITION_INSTRUMENTS_V1)[number];

export const audioHostIntegratedBrowserAppProfile = Object.freeze({
  ...mobileTeacherViewportBrowserAppProfile,
  noteAuditionAdapterAvailable: true,
  noteAuditionUiAvailable: true,
  audioEngineBundled: false,
  externalAudioRuntimeRequired: true,
  qualifiedAuditionInstrument: 'GRAND_PIANO' as const,
  qualifiedAuditionInstruments: QUALIFIED_AUDITION_INSTRUMENTS_V1,
  rendererAudioAuthority: false,
  auditionCanonicalMutationAuthority: false,
  auditionHistoryMutationAuthority: false
});

export interface AudioHostStateV1 {
  readonly version: typeof AUDIO_HOST_INTEGRATED_BROWSER_VERSION;
  readonly attached: boolean;
  readonly instrumentId: QualifiedAuditionInstrumentV1;
  readonly lastStatus: 'DETACHED' | 'READY' | ScoreAudioAuditionStatusV010;
  readonly lastError: Readonly<{ readonly code: string; readonly message: string }> | null;
}

export interface RenderedNoteAuditionResultV1 {
  readonly request: Readonly<AuditionRequest> | null;
  readonly audioStatus: ScoreAudioAuditionStatusV010;
  readonly audioError: Readonly<{ readonly code: string; readonly message: string }> | null;
}

export interface AudioHostIntegratedStandaloneScoreEditorController extends Omit<MobileTeacherViewportStandaloneScoreEditorController, 'profile'> {
  readonly profile: typeof audioHostIntegratedBrowserAppProfile;
  readonly attachAudioPort: (runtime: ScoreAudioRuntimeV010) => Readonly<AudioHostStateV1>;
  readonly detachAudioPort: () => Readonly<AudioHostStateV1>;
  readonly getAudioHostState: () => Readonly<AudioHostStateV1>;
  readonly setAuditionInstrument: (instrumentId: QualifiedAuditionInstrumentV1) => Promise<Readonly<AudioHostStateV1>>;
  readonly selectRenderedScoreNoteRefWithAudition: (rawRef: unknown) => Promise<Readonly<RenderedNoteAuditionResultV1>>;
}

const assertQualifiedAuditionInstrument = (instrumentId: InstrumentId): QualifiedAuditionInstrumentV1 => {
  if (!(QUALIFIED_AUDITION_INSTRUMENTS_V1 as readonly InstrumentId[]).includes(instrumentId)) {
    throw new RangeError(`Unsupported production audition instrument: ${instrumentId}`);
  }
  return instrumentId as QualifiedAuditionInstrumentV1;
};

export const createAudioHostIntegratedStandaloneScoreEditorController = (
  options: TeacherWorkflowControllerOptions = {}
): Readonly<AudioHostIntegratedStandaloneScoreEditorController> => {
  const base = createMobileTeacherViewportStandaloneScoreEditorController(options);
  let runtime: ScoreAudioRuntimeV010 | null = null;
  let instrumentId: QualifiedAuditionInstrumentV1 = 'GRAND_PIANO';
  let lastStatus: AudioHostStateV1['lastStatus'] = 'DETACHED';
  let lastError: AudioHostStateV1['lastError'] = null;
  let requestSequence = 0;

  const state = (): Readonly<AudioHostStateV1> => Object.freeze({
    version: AUDIO_HOST_INTEGRATED_BROWSER_VERSION,
    attached: runtime !== null,
    instrumentId,
    lastStatus,
    lastError
  });

  const setAuditionInstrument = async (
    nextInstrumentId: QualifiedAuditionInstrumentV1
  ): Promise<Readonly<AudioHostStateV1>> => {
    const next = assertQualifiedAuditionInstrument(nextInstrumentId);
    const previous = instrumentId;
    instrumentId = next;
    lastError = null;
    try {
      if (runtime) await runtime.setInstrument(next);
      lastStatus = runtime ? 'READY' : 'DETACHED';
      return state();
    } catch (error) {
      instrumentId = previous;
      lastStatus = 'FAILED';
      lastError = Object.freeze({
        code: 'AUDIO_INSTRUMENT_SWITCH_FAILED',
        message: error instanceof Error ? error.message : 'Audio instrument switch failed.'
      });
      throw error;
    }
  };

  const selectRenderedScoreNoteRefWithAudition = async (
    rawRef: unknown
  ): Promise<Readonly<RenderedNoteAuditionResultV1>> => {
    base.selectRenderedScoreNoteRef(rawRef);
    const documentValue = base.getDocument();
    if (documentValue === null || documentValue.session.selection === null) {
      lastStatus = 'SKIPPED_NON_NOTE';
      lastError = null;
      return Object.freeze({ request: null, audioStatus: 'SKIPPED_NON_NOTE', audioError: null });
    }

    const score = documentValue.session.history.present.score;
    const request = createScoreAudioAuditionRequestV010(
      score,
      documentValue.session.selection,
      Object.freeze({
        requestId: `editor-note-touch-${++requestSequence}`,
        instrumentId,
        velocity: 0.78,
        durationMs: 800
      })
    );

    const result = await auditionWithScoreAudioV010({
      runtime,
      request,
      getCurrentRevisionId: () => base.getDocument()?.session.history.present.score.revision.id ?? null
    });
    lastStatus = result.status;
    lastError = result.error;
    return Object.freeze({ request: result.request, audioStatus: result.status, audioError: result.error });
  };

  return Object.freeze({
    ...base,
    profile: audioHostIntegratedBrowserAppProfile,
    attachAudioPort: (nextRuntime: ScoreAudioRuntimeV010) => {
      runtime = nextRuntime;
      lastStatus = 'READY';
      lastError = null;
      return state();
    },
    detachAudioPort: () => {
      runtime = null;
      lastStatus = 'DETACHED';
      lastError = null;
      return state();
    },
    getAudioHostState: state,
    setAuditionInstrument,
    selectRenderedScoreNoteRefWithAudition
  });
};

export const createAudioHostIntegratedStandaloneBrowserAppRuntime = () => {
  const base = createMobileTeacherViewportStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: audioHostIntegratedBrowserAppProfile,
    createController: createAudioHostIntegratedStandaloneScoreEditorController,
    audioAudition: Object.freeze({
      version: AUDIO_HOST_INTEGRATED_BROWSER_VERSION,
      bundledEngine: false,
      externalAudioRuntimeRequired: true,
      canonicalMutationAuthority: false,
      historyMutationAuthority: false,
      rendererAudioAuthority: false,
      instruments: QUALIFIED_AUDITION_INSTRUMENTS_V1,
      suspendedInstruments: Object.freeze(['CLASSICAL_GUITAR'] as const)
    })
  });
};
