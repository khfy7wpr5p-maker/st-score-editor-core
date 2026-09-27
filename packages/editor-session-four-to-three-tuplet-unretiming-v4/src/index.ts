import {
  EDITOR_SESSION_V4_VERSION,
  type EditorSessionStateV4
} from '../../editor-session-controller-v4/src/index.js';
import { commitEditorHistoryV4 } from '../../editor-history-v4/src/index.js';
import { createRendererRequestV4WithProfile } from '../../renderer-contract-v4/src/index.js';
import {
  executeFourToThreeTupletToStraightFourUnretimingV4,
  type FourToThreeTupletUnretimingAuthoringV4Options
} from '../../editor-four-to-three-tuplet-unretiming-authoring-v4/src/index.js';

export const commitSessionFourToThreeTupletToStraightFourV4 = (
  session: EditorSessionStateV4,
  intent: unknown,
  options: FourToThreeTupletUnretimingAuthoringV4Options
): Readonly<EditorSessionStateV4> => {
  const current = session.history.present;
  const result = executeFourToThreeTupletToStraightFourUnretimingV4(
    current.score,
    current.notation,
    intent,
    options
  );
  const history = commitEditorHistoryV4(
    session.history,
    result.score,
    result.notation
  );

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
      code: 'FOUR_TO_THREE_TUPLET_UNRETIMING_COMMITTED',
      message: 'Atomic 4:3 tuplet to straight-four unretiming committed in the unified V4 history.'
    })
  });
};
