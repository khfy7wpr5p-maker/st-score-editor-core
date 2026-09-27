import {
  commitCanonicalEditorSessionResultV4,
  type EditorSessionStateV4
} from '../../editor-session-controller-v4/src/index.js';
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
  return commitCanonicalEditorSessionResultV4(
    session,
    result,
    'FOUR_TO_THREE_TUPLET_UNRETIMING_COMMITTED',
    'Atomic 4:3 tuplet to straight-four unretiming committed in the unified V4 history.'
  );
};
