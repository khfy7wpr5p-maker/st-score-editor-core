import {
  commitCanonicalEditorSessionResultV4,
  type EditorSessionStateV4
} from '../../editor-session-controller-v4/src/index.js';
import {
  executeTripletToStraightThreeUnretimingV4,
  type TupletUnretimingAuthoringV4Options
} from '../../editor-tuplet-unretiming-authoring-v4/src/index.js';

export const commitSessionTripletToStraightThreeV4 = (
  session: EditorSessionStateV4,
  intent: unknown,
  options: TupletUnretimingAuthoringV4Options
): Readonly<EditorSessionStateV4> => {
  const current = session.history.present;
  const result = executeTripletToStraightThreeUnretimingV4(
    current.score,
    current.notation,
    intent,
    options
  );
  return commitCanonicalEditorSessionResultV4(
    session,
    result,
    'TRIPLET_UNRETIMING_COMMITTED',
    'Atomic triplet to straight-three unretiming committed in the unified V4 history.'
  );
};
