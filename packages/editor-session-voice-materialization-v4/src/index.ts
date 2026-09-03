import {
  EDITOR_SESSION_V4_VERSION,
  type EditorSessionStateV4
} from '../../editor-session-controller-v4/src/index.js';
import { commitEditorHistoryV4 } from '../../editor-history-v4/src/index.js';
import { createRendererRequestV4WithProfile } from '../../renderer-contract-v4/src/index.js';
import {
  executeVoiceMaterializationV4,
  type VoiceMaterializationV4Options
} from '../../editor-voice-materialization-v4/src/index.js';

export const commitSessionVoiceMaterializationV4 = (
  session: EditorSessionStateV4,
  intent: unknown,
  options: VoiceMaterializationV4Options
): Readonly<EditorSessionStateV4> => {
  const current = session.history.present;
  const result = executeVoiceMaterializationV4(current.score, current.notation, intent, options);
  const history = commitEditorHistoryV4(session.history, result.score, result.notation);
  return Object.freeze({
    version: EDITOR_SESSION_V4_VERSION,
    history,
    selection: result.selection,
    renderRequest: createRendererRequestV4WithProfile(
      history.present.score,
      history.present.notation,
      session.renderRequest.renderer
    ),
    status: Object.freeze({
      code: 'VOICE_MATERIALIZED',
      message: 'A bounded synthetic-score Voice was materialized as a full-measure explicit rest.'
    })
  });
};
