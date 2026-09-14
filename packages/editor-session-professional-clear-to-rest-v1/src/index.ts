import {
  professionalSelectionActiveTargetV1,
  type ProfessionalSelectionV1
} from '../../editor-professional-selection-v1/src/index.js';
import {
  executeProfessionalClearToRestV1,
  type ProfessionalClearToRestAdmissionV1,
  type ProfessionalClearToRestOptionsV1
} from '../../editor-professional-clear-to-rest-v1/src/index.js';
import { commitEditorHistoryV4 } from '../../editor-history-v4/src/index.js';
import {
  EDITOR_SESSION_V4_VERSION,
  type EditorSessionStateV4
} from '../../editor-session-controller-v4/src/index.js';
import { createRendererRequestV4WithProfile } from '../../renderer-contract-v4/src/index.js';

export const EDITOR_SESSION_PROFESSIONAL_CLEAR_TO_REST_V1_VERSION = '1.0.0' as const;

export interface ProfessionalClearToRestSessionResultV1 {
  readonly version: typeof EDITOR_SESSION_PROFESSIONAL_CLEAR_TO_REST_V1_VERSION;
  readonly session: Readonly<EditorSessionStateV4>;
  readonly professionalSelection: Readonly<ProfessionalSelectionV1>;
  readonly changedEventIds: readonly string[];
  readonly removedNoteIds: readonly string[];
  readonly historyCommitCount: 1;
  readonly historyAuthority: 'EditorHistoryV4';
}

export const commitSessionProfessionalClearToRestV1 = (
  session: EditorSessionStateV4,
  selection: ProfessionalSelectionV1,
  admission: ProfessionalClearToRestAdmissionV1,
  options: ProfessionalClearToRestOptionsV1
): Readonly<ProfessionalClearToRestSessionResultV1> => {
  const current = session.history.present;
  const result = executeProfessionalClearToRestV1(
    current.score,
    current.notation,
    selection,
    admission,
    options
  );
  const history = commitEditorHistoryV4(session.history, result.score, result.notation);
  const nextSession: Readonly<EditorSessionStateV4> = Object.freeze({
    version: EDITOR_SESSION_V4_VERSION,
    history,
    selection: professionalSelectionActiveTargetV1(result.selection),
    renderRequest: createRendererRequestV4WithProfile(
      history.present.score,
      history.present.notation,
      session.renderRequest.renderer
    ),
    status: Object.freeze({
      code: 'PROFESSIONAL_CLEAR_TO_REST_EDIT_COMMITTED',
      message: 'Professional rhythm-preserving clear-to-rest committed atomically in the unified V4 history.'
    })
  });

  return Object.freeze({
    version: EDITOR_SESSION_PROFESSIONAL_CLEAR_TO_REST_V1_VERSION,
    session: nextSession,
    professionalSelection: result.selection,
    changedEventIds: result.changedEventIds,
    removedNoteIds: result.removedNoteIds,
    historyCommitCount: 1 as const,
    historyAuthority: 'EditorHistoryV4' as const
  });
};
