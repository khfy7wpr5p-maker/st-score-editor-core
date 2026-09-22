import type { EditorSessionStateV4 } from '../../editor-session-controller-v4/src/index.js';
import {
  analyzeProfessionalDiatonicTransposeV1,
  analyzeProfessionalSemitoneTransposeV1,
  type ProfessionalPitchTransposeOptionsV1
} from '../../editor-professional-pitch-transpose-v1/src/index.js';
import { commitSessionProfessionalPitchTransposeV1 } from '../../editor-session-professional-pitch-transpose-v1/src/index.js';
import {
  SCORE_EDITOR_PROFESSIONAL_WORKSTATION_V1_VERSION,
  ProfessionalWorkstationV1Error,
  type ScoreEditorProfessionalWorkstationV1
} from '../../score-editor-professional-workstation-v1/src/index.js';
import type { ScoreEditorAppDocument } from '../../score-editor-app-document/src/index.js';

export const SCORE_EDITOR_PROFESSIONAL_PITCH_TRANSPOSE_WORKSTATION_V1_VERSION = '1.0.0' as const;

const selected = (
  workstation: ScoreEditorProfessionalWorkstationV1
) => {
  if (workstation.professionalSelection === null) {
    throw new ProfessionalWorkstationV1Error(
      'Professional bulk authoring requires an EVENT_SPAN or EVENT_SET selection.',
      'SELECTION_REQUIRED'
    );
  }
  return workstation.professionalSelection;
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
  dirty: document.savedRevisionId === null ||
    session.history.present.score.revision.id !== document.savedRevisionId
});

const resultState = (
  document: ScoreEditorAppDocument,
  session: Readonly<EditorSessionStateV4>,
  professionalSelection: NonNullable<ScoreEditorProfessionalWorkstationV1['professionalSelection']>
): Readonly<ScoreEditorProfessionalWorkstationV1> => Object.freeze({
  version: SCORE_EDITOR_PROFESSIONAL_WORKSTATION_V1_VERSION,
  document: appWithSession(document, session),
  professionalSelection
});

export const commitProfessionalPitchWorkstationSemitoneTransposeV1 = (
  workstation: ScoreEditorProfessionalWorkstationV1,
  semitoneDelta: number,
  options: ProfessionalPitchTransposeOptionsV1
): Readonly<ScoreEditorProfessionalWorkstationV1> => {
  const selection = selected(workstation);
  const current = workstation.document.session.history.present;
  const admission = analyzeProfessionalSemitoneTransposeV1(
    current.score,
    current.notation,
    selection,
    semitoneDelta
  );
  const result = commitSessionProfessionalPitchTransposeV1(
    workstation.document.session,
    selection,
    admission,
    options
  );
  return resultState(workstation.document, result.session, result.professionalSelection);
};

export const commitProfessionalPitchWorkstationDiatonicTransposeV1 = (
  workstation: ScoreEditorProfessionalWorkstationV1,
  diatonicSteps: number,
  options: ProfessionalPitchTransposeOptionsV1
): Readonly<ScoreEditorProfessionalWorkstationV1> => {
  const selection = selected(workstation);
  const current = workstation.document.session.history.present;
  const admission = analyzeProfessionalDiatonicTransposeV1(
    current.score,
    current.notation,
    selection,
    diatonicSteps
  );
  const result = commitSessionProfessionalPitchTransposeV1(
    workstation.document.session,
    selection,
    admission,
    options
  );
  return resultState(workstation.document, result.session, result.professionalSelection);
};
