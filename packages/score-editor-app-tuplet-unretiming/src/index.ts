import type { ScoreEditorAppDocument } from '../../score-editor-app-document/src/index.js';
import { commitSessionTripletToStraightThreeV4 } from '../../editor-session-tuplet-unretiming-v4/src/index.js';
import type { TupletUnretimingAuthoringV4Options } from '../../editor-tuplet-unretiming-authoring-v4/src/index.js';

export const commitScoreEditorAppTripletToStraightThreeV4 = (
  document: ScoreEditorAppDocument,
  intent: unknown,
  options: TupletUnretimingAuthoringV4Options
): Readonly<ScoreEditorAppDocument> => {
  const session = commitSessionTripletToStraightThreeV4(document.session, intent, options);
  return Object.freeze({
    ...document,
    session,
    dirty: document.savedRevisionId === null ||
      session.history.present.score.revision.id !== document.savedRevisionId
  });
};
