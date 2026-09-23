import type { TeacherCopySnapshotV4 } from '../../editor-teacher-copy-snapshot-v4/src/index.js';
import {
  ProfessionalRangeReplaceV1Error,
  analyzeProfessionalRangeReplaceV1,
  createProfessionalRangeCopySnapshotV1,
  planProfessionalRangeReplaceIdentitiesV1
} from '../../editor-professional-range-replace-v1/src/index.js';
import { commitSessionProfessionalRangeReplaceV1 } from '../../editor-session-professional-range-replace-v1/src/index.js';
import {
  SCORE_EDITOR_PROFESSIONAL_WORKSTATION_V1_VERSION,
  ProfessionalWorkstationV1Error,
  type ScoreEditorProfessionalWorkstationV1
} from '../../score-editor-professional-workstation-v1/src/index.js';
import type { EditorSessionStateV4 } from '../../editor-session-controller-v4/src/index.js';
import type { ScoreEditorAppDocument } from '../../score-editor-app-document/src/index.js';

export const SCORE_EDITOR_PROFESSIONAL_RANGE_REPLACE_WORKSTATION_V1_VERSION = '1.0.0' as const;

export interface ProfessionalRangeReplaceWorkstationOptionsV1 {
  readonly nextRevisionId: string;
}

const requiredSelection = (
  workstation: ScoreEditorProfessionalWorkstationV1
) => {
  const selection = workstation.professionalSelection;
  if (selection === null) {
    throw new ProfessionalWorkstationV1Error(
      'Professional range replacement requires a current professional selection.',
      'SELECTION_REQUIRED'
    );
  }
  return selection;
};

const appWithSession = (
  document: ScoreEditorAppDocument,
  session: Readonly<EditorSessionStateV4>
): Readonly<ScoreEditorAppDocument> => Object.freeze({
  version: document.version,
  title: document.title,
  origin: document.origin,
  session,
  savedRevisionId: document.savedRevisionId,
  dirty: document.savedRevisionId === null
    || session.history.present.score.revision.id !== document.savedRevisionId
});

const workstationState = (
  document: ScoreEditorAppDocument,
  professionalSelection: ScoreEditorProfessionalWorkstationV1['professionalSelection']
): Readonly<ScoreEditorProfessionalWorkstationV1> => Object.freeze({
  version: SCORE_EDITOR_PROFESSIONAL_WORKSTATION_V1_VERSION,
  document,
  professionalSelection
});

export const copyProfessionalRangeForReplaceV1 = (
  workstation: ScoreEditorProfessionalWorkstationV1
): Readonly<TeacherCopySnapshotV4> => {
  const selection = requiredSelection(workstation);
  const present = workstation.document.session.history.present;
  return createProfessionalRangeCopySnapshotV1(
    present.score,
    present.notation,
    selection
  );
};

export const commitProfessionalRangeReplaceWorkstationV1 = (
  workstation: ScoreEditorProfessionalWorkstationV1,
  snapshot: TeacherCopySnapshotV4,
  options: ProfessionalRangeReplaceWorkstationOptionsV1
): Readonly<ScoreEditorProfessionalWorkstationV1> => {
  const selection = requiredSelection(workstation);
  if (selection.kind !== 'EVENT_SPAN') {
    throw new ProfessionalRangeReplaceV1Error(
      'Professional range replacement supports only EVENT_SPAN destination selection.',
      'SELECTION_KIND_UNSUPPORTED',
      { kind: selection.kind }
    );
  }

  const present = workstation.document.session.history.present;
  const admission = analyzeProfessionalRangeReplaceV1(
    present.score,
    present.notation,
    snapshot,
    selection
  );
  const identityPlan = planProfessionalRangeReplaceIdentitiesV1(
    present.score,
    present.notation,
    snapshot,
    selection,
    admission,
    options.nextRevisionId
  );
  const committed = commitSessionProfessionalRangeReplaceV1(
    workstation.document.session,
    selection,
    snapshot,
    admission,
    identityPlan
  );

  return workstationState(
    appWithSession(workstation.document, committed.session),
    committed.professionalSelection
  );
};
