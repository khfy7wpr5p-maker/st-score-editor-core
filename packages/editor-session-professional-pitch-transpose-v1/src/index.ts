import {
  professionalSelectionActiveTargetV1,
  type ProfessionalSelectionV1
} from '../../editor-professional-selection-v1/src/index.js';
import {
  executeProfessionalPitchTransposeV1,
  type ProfessionalPitchTransposeAdmissionV1,
  type ProfessionalPitchTransposeOptionsV1
} from '../../editor-professional-pitch-transpose-v1/src/index.js';
import { commitEditorHistoryV4 } from '../../editor-history-v4/src/index.js';
import {
  EDITOR_SESSION_V4_VERSION,
  type EditorSessionStateV4
} from '../../editor-session-controller-v4/src/index.js';
import { createRendererRequestV4WithProfile } from '../../renderer-contract-v4/src/index.js';

export const EDITOR_SESSION_PROFESSIONAL_PITCH_TRANSPOSE_V1_VERSION = '1.0.0' as const;

export interface ProfessionalPitchTransposeSessionResultV1 {
  readonly version: typeof EDITOR_SESSION_PROFESSIONAL_PITCH_TRANSPOSE_V1_VERSION;
  readonly session: Readonly<EditorSessionStateV4>;
  readonly professionalSelection: Readonly<ProfessionalSelectionV1>;
  readonly changedEventIds: readonly string[];
  readonly changedNoteIds: readonly string[];
  readonly historyCommitCount: 1;
  readonly historyAuthority: 'EditorHistoryV4';
}

const committedSession = (
  previous: EditorSessionStateV4,
  history: ReturnType<typeof commitEditorHistoryV4>,
  selection: ProfessionalSelectionV1
): Readonly<EditorSessionStateV4> => Object.freeze({
  version: EDITOR_SESSION_V4_VERSION,
  history,
  selection: professionalSelectionActiveTargetV1(selection),
  renderRequest: createRendererRequestV4WithProfile(
    history.present.score,
    history.present.notation,
    previous.renderRequest.renderer
  ),
  status: Object.freeze({
    code: 'PROFESSIONAL_PITCH_TRANSPOSE_EDIT_COMMITTED',
    message: 'Professional pitch transpose committed atomically in unified V4 history.'
  })
});

export const commitSessionProfessionalPitchTransposeV1 = (
  session: EditorSessionStateV4,
  selection: ProfessionalSelectionV1,
  admission: ProfessionalPitchTransposeAdmissionV1,
  options: ProfessionalPitchTransposeOptionsV1
): Readonly<ProfessionalPitchTransposeSessionResultV1> => {
  const present = session.history.present;
  const authored = executeProfessionalPitchTransposeV1(
    present.score,
    present.notation,
    selection,
    admission,
    options
  );
  const history = commitEditorHistoryV4(
    session.history,
    authored.score,
    authored.notation
  );

  return Object.freeze({
    version: EDITOR_SESSION_PROFESSIONAL_PITCH_TRANSPOSE_V1_VERSION,
    session: committedSession(session, history, authored.selection),
    professionalSelection: authored.selection,
    changedEventIds: authored.changedEventIds,
    changedNoteIds: authored.changedNoteIds,
    historyCommitCount: 1 as const,
    historyAuthority: 'EditorHistoryV4' as const
  });
};
