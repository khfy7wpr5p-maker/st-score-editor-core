import type { ScoreEditorBrowserAppSnapshot } from './index.js';
import type { RecoveryEnabledControllerOptions } from './recovery-enabled.js';
import {
  createRendererHitEnabledStandaloneScoreEditorController,
  rendererHitEnabledBrowserAppProfile,
  type RendererHitEnabledStandaloneScoreEditorController
} from './renderer-hit-enabled.js';
import {
  createEditorAuditionRequestV1,
  type CreateEditorAuditionRequestV1Options,
  type EditorAudioPortV1,
  type EditorAuditionRequestV1
} from '../../editor-audition-v1/src/index.js';

export const AUDIO_AUDITION_ENABLED_BROWSER_APP_VERSION = '1.0.0' as const;

export const audioAuditionEnabledBrowserAppProfile = Object.freeze({
  ...rendererHitEnabledBrowserAppProfile,
  noteAuditionAdapterAvailable: true,
  audioEngineBundled: false,
  rendererAudioAuthority: false,
  auditionCanonicalMutationAuthority: false
});

export type RendererHitAuditionStatusV1 =
  | 'SKIPPED_NON_NOTE'
  | 'PLAYED'
  | 'FAILED'
  | 'STALE_SOURCE_REVISION';

export interface RendererHitAuditionResultV1 {
  readonly snapshot: Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly request: Readonly<EditorAuditionRequestV1> | null;
  readonly audioStatus: RendererHitAuditionStatusV1;
  readonly audioError: Readonly<{ readonly code: string; readonly message: string }> | null;
}

export interface AudioAuditionEnabledStandaloneScoreEditorController extends Omit<RendererHitEnabledStandaloneScoreEditorController, 'profile'> {
  readonly profile: typeof audioAuditionEnabledBrowserAppProfile;
  readonly selectRendererHitWithAudition: (
    rawHit: unknown,
    audioPort: EditorAudioPortV1,
    options: CreateEditorAuditionRequestV1Options
  ) => Promise<Readonly<RendererHitAuditionResultV1>>;
}

const outcome = (
  snapshot: Readonly<ScoreEditorBrowserAppSnapshot>,
  request: Readonly<EditorAuditionRequestV1> | null,
  audioStatus: RendererHitAuditionStatusV1,
  audioError: Readonly<{ readonly code: string; readonly message: string }> | null = null
): Readonly<RendererHitAuditionResultV1> => Object.freeze({ snapshot, request, audioStatus, audioError });

export const createAudioAuditionEnabledStandaloneScoreEditorController = (
  options: RecoveryEnabledControllerOptions = {}
): Readonly<AudioAuditionEnabledStandaloneScoreEditorController> => {
  const base = createRendererHitEnabledStandaloneScoreEditorController(options);

  const sourceRevisionStillCurrent = (sourceRevisionId: string): boolean =>
    base.getDocument()?.session.history.present.score.revision.id === sourceRevisionId;

  const selectRendererHitWithAudition = async (
    rawHit: unknown,
    audioPort: EditorAudioPortV1,
    auditionOptions: CreateEditorAuditionRequestV1Options
  ): Promise<Readonly<RendererHitAuditionResultV1>> => {
    const snapshot = base.selectRendererHit(rawHit);
    const document = base.getDocument();
    if (document === null || document.session.selection === null) {
      return outcome(snapshot, null, 'SKIPPED_NON_NOTE');
    }
    const score = document.session.history.present.score;
    const request = createEditorAuditionRequestV1(score, document.session.selection, auditionOptions);
    if (request === null) return outcome(snapshot, null, 'SKIPPED_NON_NOTE');

    try {
      const unlocked = await audioPort.unlockFromUserGesture();
      if (!unlocked.ok) return outcome(snapshot, request, 'FAILED', unlocked.error);
      if (!sourceRevisionStillCurrent(request.sourceRevisionId)) {
        return outcome(snapshot, request, 'STALE_SOURCE_REVISION', Object.freeze({ code:'STALE_SOURCE_REVISION', message:'Canonical score revision changed before audition execution.' }));
      }
      await audioPort.setInstrument(request.instrumentId);
      if (!sourceRevisionStillCurrent(request.sourceRevisionId)) {
        return outcome(snapshot, request, 'STALE_SOURCE_REVISION', Object.freeze({ code:'STALE_SOURCE_REVISION', message:'Canonical score revision changed while preparing the audition instrument.' }));
      }
      const result = await audioPort.audition(request);
      return result.ok ? outcome(snapshot, request, 'PLAYED') : outcome(snapshot, request, 'FAILED', result.error);
    } catch (error) {
      return outcome(snapshot, request, 'FAILED', Object.freeze({
        code: 'AUDIO_PORT_FAILURE',
        message: error instanceof Error ? error.message : 'Audio port failed.'
      }));
    }
  };

  const controller: AudioAuditionEnabledStandaloneScoreEditorController = Object.freeze({
    ...base,
    profile: audioAuditionEnabledBrowserAppProfile,
    selectRendererHitWithAudition
  });
  return controller;
};
