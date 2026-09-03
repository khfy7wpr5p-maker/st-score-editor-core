import type { ScoreEditorAppDocument } from '../../score-editor-app-document/src/index.js';
import { commitSessionVoiceMaterializationV4 } from '../../editor-session-voice-materialization-v4/src/index.js';
import type { VoiceMaterializationV4Options } from '../../editor-voice-materialization-v4/src/index.js';

export const commitScoreEditorAppVoiceMaterializationV4 = (
  document: ScoreEditorAppDocument,
  intent: unknown,
  options: VoiceMaterializationV4Options
): Readonly<ScoreEditorAppDocument> => {
  const session = commitSessionVoiceMaterializationV4(document.session, intent, options);
  return Object.freeze({
    ...document,
    session,
    dirty: document.savedRevisionId === null || session.history.present.score.revision.id !== document.savedRevisionId
  });
};
