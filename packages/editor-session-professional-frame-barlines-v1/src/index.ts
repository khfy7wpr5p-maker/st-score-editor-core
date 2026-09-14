import type { MeasureFrameAddressV3 } from '../../addressing-v3/src/index.js';
import {
  executeProfessionalFrameBarlinesV1,
  type ProfessionalFrameBarlinesV1Options
} from '../../editor-professional-frame-barlines-v1/src/index.js';
import { commitEditorHistoryV4 } from '../../editor-history-v4/src/index.js';
import {
  EDITOR_SESSION_V4_VERSION,
  type EditorSessionStateV4
} from '../../editor-session-controller-v4/src/index.js';
import { createRendererRequestV4WithProfile } from '../../renderer-contract-v4/src/index.js';

export const EDITOR_SESSION_PROFESSIONAL_FRAME_BARLINES_V1_VERSION = '1.0.0' as const;

export interface ProfessionalFrameBarlinesSessionResultV1 {
  readonly version: typeof EDITOR_SESSION_PROFESSIONAL_FRAME_BARLINES_V1_VERSION;
  readonly session: Readonly<EditorSessionStateV4>;
  readonly selection: MeasureFrameAddressV3;
  readonly historyCommitCount: 1;
  readonly historyAuthority: 'EditorHistoryV4';
}

export const commitSessionProfessionalFrameBarlinesV1 = (
  session: EditorSessionStateV4,
  target: MeasureFrameAddressV3,
  barlines: unknown,
  options: ProfessionalFrameBarlinesV1Options
): Readonly<ProfessionalFrameBarlinesSessionResultV1> => {
  const current = session.history.present;
  const result = executeProfessionalFrameBarlinesV1(current.score, current.notation, target, barlines, options);
  const history = commitEditorHistoryV4(session.history, result.score, result.notation);
  const nextSession: Readonly<EditorSessionStateV4> = Object.freeze({
    version: EDITOR_SESSION_V4_VERSION,
    history,
    selection: result.selection,
    renderRequest: createRendererRequestV4WithProfile(history.present.score, history.present.notation, session.renderRequest.renderer),
    status: Object.freeze({
      code: 'PROFESSIONAL_FRAME_BARLINES_EDIT_COMMITTED',
      message: 'Professional frame barline/repeat edit committed atomically in unified V4 history.'
    })
  });
  return Object.freeze({
    version: EDITOR_SESSION_PROFESSIONAL_FRAME_BARLINES_V1_VERSION,
    session: nextSession,
    selection: result.selection,
    historyCommitCount: 1 as const,
    historyAuthority: 'EditorHistoryV4' as const
  });
};
