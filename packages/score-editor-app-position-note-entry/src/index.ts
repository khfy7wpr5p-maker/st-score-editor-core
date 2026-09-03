import type { ScoreEditorAppDocument } from '../../score-editor-app-document/src/index.js';
import { commitSessionPositionNoteEntryV4 } from '../../editor-session-position-note-entry-v4/src/index.js';
import type { PositionNoteEntryV4Options } from '../../editor-position-note-entry-v4/src/index.js';

export const commitScoreEditorAppPositionNoteEntryV4 = (
  document: ScoreEditorAppDocument,
  position: unknown,
  intent: unknown,
  options: PositionNoteEntryV4Options
): Readonly<ScoreEditorAppDocument> => {
  const session = commitSessionPositionNoteEntryV4(document.session, position, intent, options);
  return Object.freeze({
    ...document,
    session,
    dirty: document.savedRevisionId === null || session.history.present.score.revision.id !== document.savedRevisionId
  });
};
