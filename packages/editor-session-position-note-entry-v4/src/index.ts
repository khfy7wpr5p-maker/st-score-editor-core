import {
  EDITOR_SESSION_V4_VERSION,
  type EditorSessionStateV4
} from '../../editor-session-controller-v4/src/index.js';
import { commitEditorHistoryV4 } from '../../editor-history-v4/src/index.js';
import { createRendererRequestV4WithProfile } from '../../renderer-contract-v4/src/index.js';
import {
  executePositionNoteEntryV4,
  type PositionNoteEntryV4Options
} from '../../editor-position-note-entry-v4/src/index.js';

export const commitSessionPositionNoteEntryV4 = (
  session: EditorSessionStateV4,
  position: unknown,
  intent: unknown,
  options: PositionNoteEntryV4Options
): Readonly<EditorSessionStateV4> => {
  const current = session.history.present;
  const result = executePositionNoteEntryV4(current.score, current.notation, position, intent, options);
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
      code: 'POSITION_NOTE_ENTRY_COMMITTED',
      message: 'Explicit-rest position note entry committed in the unified V4 history.'
    })
  });
};
