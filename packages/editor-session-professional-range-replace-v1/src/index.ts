import {
  professionalSelectionActiveTargetV1,
  type EventSpanProfessionalSelectionV1
} from '../../editor-professional-selection-v1/src/index.js';
import {
  executeProfessionalRangeReplaceV1,
  type ProfessionalRangeReplaceAdmissionV1,
  type ProfessionalRangeReplaceIdentityPlanV1
} from '../../editor-professional-range-replace-v1/src/index.js';
import type { TeacherCopySnapshotV4 } from '../../editor-teacher-copy-snapshot-v4/src/index.js';
import { commitEditorHistoryV4 } from '../../editor-history-v4/src/index.js';
import {
  EDITOR_SESSION_V4_VERSION,
  type EditorSessionStateV4
} from '../../editor-session-controller-v4/src/index.js';
import { createRendererRequestV4WithProfile } from '../../renderer-contract-v4/src/index.js';

export const EDITOR_SESSION_PROFESSIONAL_RANGE_REPLACE_V1_VERSION = '1.0.0' as const;

export interface ProfessionalRangeReplaceSessionResultV1 {
  readonly version: typeof EDITOR_SESSION_PROFESSIONAL_RANGE_REPLACE_V1_VERSION;
  readonly session: Readonly<EditorSessionStateV4>;
  readonly professionalSelection: Readonly<EventSpanProfessionalSelectionV1>;
  readonly insertedEventIds: readonly string[];
  readonly insertedNoteIds: readonly string[];
  readonly removedDestinationEventIds: readonly string[];
  readonly removedDestinationNoteIds: readonly string[];
  readonly historyCommitCount: 1;
  readonly historyAuthority: 'EditorHistoryV4';
}

export const commitSessionProfessionalRangeReplaceV1 = (
  session: EditorSessionStateV4,
  destination: EventSpanProfessionalSelectionV1,
  snapshot: TeacherCopySnapshotV4,
  admission: ProfessionalRangeReplaceAdmissionV1,
  identityPlan: ProfessionalRangeReplaceIdentityPlanV1
): Readonly<ProfessionalRangeReplaceSessionResultV1> => {
  const present = session.history.present;
  const authored = executeProfessionalRangeReplaceV1(
    present.score,
    present.notation,
    snapshot,
    destination,
    admission,
    identityPlan
  );
  const history = commitEditorHistoryV4(
    session.history,
    authored.score,
    authored.notation
  );
  const nextSession: Readonly<EditorSessionStateV4> = Object.freeze({
    version: EDITOR_SESSION_V4_VERSION,
    history,
    selection: professionalSelectionActiveTargetV1(authored.selection),
    renderRequest: createRendererRequestV4WithProfile(
      history.present.score,
      history.present.notation,
      session.renderRequest.renderer
    ),
    status: Object.freeze({
      code: 'PROFESSIONAL_RANGE_REPLACE_EDIT_COMMITTED',
      message: 'Professional range replacement committed atomically in unified V4 history.'
    })
  });

  return Object.freeze({
    version: EDITOR_SESSION_PROFESSIONAL_RANGE_REPLACE_V1_VERSION,
    session: nextSession,
    professionalSelection: authored.selection,
    insertedEventIds: authored.insertedEventIds,
    insertedNoteIds: authored.insertedNoteIds,
    removedDestinationEventIds: authored.removedDestinationEventIds,
    removedDestinationNoteIds: authored.removedDestinationNoteIds,
    historyCommitCount: 1 as const,
    historyAuthority: 'EditorHistoryV4' as const
  });
};
