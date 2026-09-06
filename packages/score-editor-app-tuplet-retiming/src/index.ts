import type { ScoreEditorAppDocument } from '../../score-editor-app-document/src/index.js';
import { commitSessionStraightThreeToTripletV4 } from '../../editor-session-tuplet-retiming-v4/src/index.js';
import type { TupletRetimingAuthoringV4Options } from '../../editor-tuplet-retiming-authoring-v4/src/index.js';

export const commitScoreEditorAppStraightThreeToTripletV4 = (
  document: ScoreEditorAppDocument,
  intent: unknown,
  options: TupletRetimingAuthoringV4Options
): Readonly<ScoreEditorAppDocument> => {
  const session = commitSessionStraightThreeToTripletV4(document.session, intent, options);
  return Object.freeze({
    ...document,
    session,
    dirty: document.savedRevisionId === null || session.history.present.score.revision.id !== document.savedRevisionId
  });
};
