import type { MeasureFrameAddressV3 } from '../../addressing-v3/src/index.js';
import {
  executeProfessionalTimeSignatureV1,
  type ProfessionalTimeSignatureAdmissionV1,
  type ProfessionalTimeSignatureOptionsV1
} from '../../editor-professional-time-signature-v1/src/index.js';
import { commitEditorHistoryV4 } from '../../editor-history-v4/src/index.js';
import {
  EDITOR_SESSION_V4_VERSION,
  type EditorSessionStateV4
} from '../../editor-session-controller-v4/src/index.js';
import { createRendererRequestV4WithProfile } from '../../renderer-contract-v4/src/index.js';

export const EDITOR_SESSION_PROFESSIONAL_TIME_SIGNATURE_V1_VERSION = '1.0.0' as const;

export interface ProfessionalTimeSignatureSessionResultV1 {
  readonly version: typeof EDITOR_SESSION_PROFESSIONAL_TIME_SIGNATURE_V1_VERSION;
  readonly session: Readonly<EditorSessionStateV4>;
  readonly selection: MeasureFrameAddressV3;
  readonly admission: Readonly<ProfessionalTimeSignatureAdmissionV1>;
  readonly historyCommitCount: 1;
  readonly historyAuthority: 'EditorHistoryV4';
}

export const commitSessionProfessionalTimeSignatureV1 = (
  session: EditorSessionStateV4,
  target: MeasureFrameAddressV3,
  requestedTimeSignature: unknown,
  admission: ProfessionalTimeSignatureAdmissionV1,
  options: ProfessionalTimeSignatureOptionsV1
): Readonly<ProfessionalTimeSignatureSessionResultV1> => {
  const current = session.history.present;
  const result = executeProfessionalTimeSignatureV1(
    current.score,
    current.notation,
    target,
    requestedTimeSignature,
    admission,
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
      code: 'PROFESSIONAL_TIME_SIGNATURE_EDIT_COMMITTED',
      message: 'Propagation-safe frame-global time signature edit committed atomically in unified V4 history.'
    })
  });

  return Object.freeze({
    version: EDITOR_SESSION_PROFESSIONAL_TIME_SIGNATURE_V1_VERSION,
    session: nextSession,
    selection: result.selection,
    admission: result.admission,
    historyCommitCount: 1 as const,
    historyAuthority: 'EditorHistoryV4' as const
  });
};
