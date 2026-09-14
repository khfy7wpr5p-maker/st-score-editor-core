import type { MeasureAddressV3 } from '../../addressing-v3/src/index.js';
import {
  executeProfessionalStructureNotationV1,
  type ProfessionalStructureNotationV1Options
} from '../../editor-professional-structure-notation-v1/src/index.js';
import { commitEditorHistoryV4 } from '../../editor-history-v4/src/index.js';
import {
  EDITOR_SESSION_V4_VERSION,
  type EditorSessionStateV4
} from '../../editor-session-controller-v4/src/index.js';
import { createRendererRequestV4WithProfile } from '../../renderer-contract-v4/src/index.js';

export const EDITOR_SESSION_PROFESSIONAL_STRUCTURE_NOTATION_V1_VERSION = '1.0.0' as const;

export interface ProfessionalStructureNotationSessionResultV1 {
  readonly version: typeof EDITOR_SESSION_PROFESSIONAL_STRUCTURE_NOTATION_V1_VERSION;
  readonly session: Readonly<EditorSessionStateV4>;
  readonly selection: MeasureAddressV3;
  readonly operation: 'SET_KEY_SIGNATURE' | 'SET_CLEF';
  readonly historyCommitCount: 1;
  readonly historyAuthority: 'EditorHistoryV4';
}

export const commitSessionProfessionalStructureNotationV1 = (
  session: EditorSessionStateV4,
  intent: unknown,
  options: ProfessionalStructureNotationV1Options
): Readonly<ProfessionalStructureNotationSessionResultV1> => {
  const current = session.history.present;
  const result = executeProfessionalStructureNotationV1(
    current.score,
    current.notation,
    intent,
    options
  );
  const history = commitEditorHistoryV4(session.history, result.score, result.notation);
  const nextSession: Readonly<EditorSessionStateV4> = Object.freeze({
    version: EDITOR_SESSION_V4_VERSION,
    history,
    selection: result.selection,
    renderRequest: createRendererRequestV4WithProfile(
      history.present.score,
      history.present.notation,
      session.renderRequest.renderer
    ),
    status: Object.freeze({
      code: 'PROFESSIONAL_STRUCTURE_NOTATION_EDIT_COMMITTED',
      message: 'Professional staff-local key/clef notation edit committed atomically in unified V4 history.'
    })
  });

  return Object.freeze({
    version: EDITOR_SESSION_PROFESSIONAL_STRUCTURE_NOTATION_V1_VERSION,
    session: nextSession,
    selection: result.selection,
    operation: result.operation,
    historyCommitCount: 1 as const,
    historyAuthority: 'EditorHistoryV4' as const
  });
};
