import {
  EDITOR_SESSION_V4_VERSION,
  type EditorSessionStateV4
} from '../../editor-session-controller-v4/src/index.js';
import { commitEditorHistoryV4 } from '../../editor-history-v4/src/index.js';
import { createRendererRequestV4WithProfile } from '../../renderer-contract-v4/src/index.js';
import {
  executeStraightThreeToTripletAuthoringV4,
  type TupletRetimingAuthoringV4Options
} from '../../editor-tuplet-retiming-authoring-v4/src/index.js';

export const commitSessionStraightThreeToTripletV4 = (
  session: EditorSessionStateV4,
  intent: unknown,
  options: TupletRetimingAuthoringV4Options
): Readonly<EditorSessionStateV4> => {
  const current = session.history.present;
  const result = executeStraightThreeToTripletAuthoringV4(
    current.score,
    current.notation,
    intent,
    options
  );
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
      code: 'TRIPLET_RETIMING_COMMITTED',
      message: 'Atomic straight-three to triplet retiming committed in the unified V4 history.'
    })
  });
};
