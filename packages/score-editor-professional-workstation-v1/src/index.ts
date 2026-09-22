import type {
  EventAddressV3,
  MeasureAddressV3,
  MeasureFrameAddressV3
} from '../../addressing-v3/src/index.js';
import {
  createEventSetProfessionalSelectionV1,
  createEventSpanProfessionalSelectionV1,
  type ProfessionalSelectionV1
} from '../../editor-professional-selection-v1/src/index.js';
import {
  analyzeProfessionalOctaveTransposeV1
} from '../../editor-professional-octave-transpose-v1/src/index.js';
import type { TeacherOctaveDeltaV4 } from '../../editor-teacher-octave-transpose-admission-v4/src/index.js';
import type { TeacherOctaveTransposeAuthoringV4Options } from '../../editor-teacher-octave-transpose-authoring-v4/src/index.js';
import { commitSessionProfessionalOctaveTransposeV1 } from '../../editor-session-professional-octave-transpose-v1/src/index.js';
import { analyzeProfessionalClearToRestV1 } from '../../editor-professional-clear-to-rest-v1/src/index.js';
import type { ProfessionalClearToRestOptionsV1 } from '../../editor-professional-clear-to-rest-v1/src/index.js';
import { commitSessionProfessionalClearToRestV1 } from '../../editor-session-professional-clear-to-rest-v1/src/index.js';
import type { ProfessionalStructureNotationV1Options } from '../../editor-professional-structure-notation-v1/src/index.js';
import { commitSessionProfessionalStructureNotationV1 } from '../../editor-session-professional-structure-notation-v1/src/index.js';
import { analyzeProfessionalTimeSignatureV1 } from '../../editor-professional-time-signature-v1/src/index.js';
import type { ProfessionalTimeSignatureOptionsV1 } from '../../editor-professional-time-signature-v1/src/index.js';
import { commitSessionProfessionalTimeSignatureV1 } from '../../editor-session-professional-time-signature-v1/src/index.js';
import type { ProfessionalFrameBarlinesV1Options } from '../../editor-professional-frame-barlines-v1/src/index.js';
import { commitSessionProfessionalFrameBarlinesV1 } from '../../editor-session-professional-frame-barlines-v1/src/index.js';
import type { TopologyAuthoringV3Options } from '../../editor-topology-authoring-v3/src/index.js';
import type { EditorSessionStateV4 } from '../../editor-session-controller-v4/src/index.js';
import {
  commitAppTopologyIntent,
  navigateAppDocumentHistory,
  type ScoreEditorAppDocument
} from '../../score-editor-app-document/src/index.js';

export const SCORE_EDITOR_PROFESSIONAL_WORKSTATION_V1_VERSION = '1.0.0' as const;

export interface ScoreEditorProfessionalWorkstationV1 {
  readonly version: typeof SCORE_EDITOR_PROFESSIONAL_WORKSTATION_V1_VERSION;
  readonly document: Readonly<ScoreEditorAppDocument>;
  readonly professionalSelection: Readonly<ProfessionalSelectionV1> | null;
}

export type ProfessionalWorkstationV1ErrorCode = 'SELECTION_REQUIRED';

export class ProfessionalWorkstationV1Error extends Error {
  readonly code: ProfessionalWorkstationV1ErrorCode;
  constructor(message: string, code: ProfessionalWorkstationV1ErrorCode) {
    super(message);
    this.name = 'ProfessionalWorkstationV1Error';
    this.code = code;
    Object.freeze(this);
  }
}

const appWithSession = (
  document: ScoreEditorAppDocument,
  session: Readonly<EditorSessionStateV4>
): Readonly<ScoreEditorAppDocument> => Object.freeze({
  version: document.version,
  title: document.title,
  origin: document.origin,
  session,
  savedRevisionId: document.savedRevisionId,
  dirty: document.savedRevisionId === null || session.history.present.score.revision.id !== document.savedRevisionId
});

const state = (
  document: ScoreEditorAppDocument,
  professionalSelection: ProfessionalSelectionV1 | null
): Readonly<ScoreEditorProfessionalWorkstationV1> => Object.freeze({
  version: SCORE_EDITOR_PROFESSIONAL_WORKSTATION_V1_VERSION,
  document,
  professionalSelection
});

const selected = (
  workstation: ScoreEditorProfessionalWorkstationV1
): Readonly<ProfessionalSelectionV1> => {
  if (workstation.professionalSelection === null) {
    throw new ProfessionalWorkstationV1Error(
      'Professional bulk authoring requires an EVENT_SPAN or EVENT_SET selection.',
      'SELECTION_REQUIRED'
    );
  }
  return workstation.professionalSelection;
};

export const createScoreEditorProfessionalWorkstationV1 = (
  document: ScoreEditorAppDocument
): Readonly<ScoreEditorProfessionalWorkstationV1> => state(document, null);

export const selectProfessionalEventSpanV1 = (
  workstation: ScoreEditorProfessionalWorkstationV1,
  anchor: EventAddressV3,
  focus: EventAddressV3
): Readonly<ScoreEditorProfessionalWorkstationV1> => {
  const score = workstation.document.session.history.present.score;
  return state(workstation.document, createEventSpanProfessionalSelectionV1(score, anchor, focus));
};

export const selectProfessionalEventSetV1 = (
  workstation: ScoreEditorProfessionalWorkstationV1,
  targets: readonly EventAddressV3[]
): Readonly<ScoreEditorProfessionalWorkstationV1> => {
  const score = workstation.document.session.history.present.score;
  return state(workstation.document, createEventSetProfessionalSelectionV1(score, targets));
};

export const clearProfessionalWorkstationSelectionV1 = (
  workstation: ScoreEditorProfessionalWorkstationV1
): Readonly<ScoreEditorProfessionalWorkstationV1> => state(workstation.document, null);

export const commitProfessionalWorkstationOctaveTransposeV1 = (
  workstation: ScoreEditorProfessionalWorkstationV1,
  octaveDelta: TeacherOctaveDeltaV4,
  options: TeacherOctaveTransposeAuthoringV4Options
): Readonly<ScoreEditorProfessionalWorkstationV1> => {
  const selection = selected(workstation);
  const current = workstation.document.session.history.present;
  const admission = analyzeProfessionalOctaveTransposeV1(
    current.score,
    current.notation,
    selection,
    octaveDelta
  );
  const result = commitSessionProfessionalOctaveTransposeV1(
    workstation.document.session,
    selection,
    admission,
    options
  );
  return state(appWithSession(workstation.document, result.session), result.professionalSelection);
};

export const commitProfessionalWorkstationClearToRestV1 = (
  workstation: ScoreEditorProfessionalWorkstationV1,
  options: ProfessionalClearToRestOptionsV1
): Readonly<ScoreEditorProfessionalWorkstationV1> => {
  const selection = selected(workstation);
  const current = workstation.document.session.history.present;
  const admission = analyzeProfessionalClearToRestV1(current.score, current.notation, selection);
  const result = commitSessionProfessionalClearToRestV1(
    workstation.document.session,
    selection,
    admission,
    options
  );
  return state(appWithSession(workstation.document, result.session), result.professionalSelection);
};

export const commitProfessionalWorkstationKeySignatureV1 = (
  workstation: ScoreEditorProfessionalWorkstationV1,
  target: MeasureAddressV3,
  value: unknown,
  options: ProfessionalStructureNotationV1Options
): Readonly<ScoreEditorProfessionalWorkstationV1> => {
  const result = commitSessionProfessionalStructureNotationV1(
    workstation.document.session,
    { version: '1.0.0', type: 'SET_KEY_SIGNATURE', target, value },
    options
  );
  return state(appWithSession(workstation.document, result.session), null);
};

export const commitProfessionalWorkstationClefV1 = (
  workstation: ScoreEditorProfessionalWorkstationV1,
  target: MeasureAddressV3,
  value: unknown,
  options: ProfessionalStructureNotationV1Options
): Readonly<ScoreEditorProfessionalWorkstationV1> => {
  const result = commitSessionProfessionalStructureNotationV1(
    workstation.document.session,
    { version: '1.0.0', type: 'SET_CLEF', target, value },
    options
  );
  return state(appWithSession(workstation.document, result.session), null);
};

export const commitProfessionalWorkstationTimeSignatureV1 = (
  workstation: ScoreEditorProfessionalWorkstationV1,
  target: MeasureFrameAddressV3,
  value: unknown,
  options: ProfessionalTimeSignatureOptionsV1
): Readonly<ScoreEditorProfessionalWorkstationV1> => {
  const current = workstation.document.session.history.present;
  const admission = analyzeProfessionalTimeSignatureV1(current.score, current.notation, target, value);
  const result = commitSessionProfessionalTimeSignatureV1(
    workstation.document.session,
    target,
    value,
    admission,
    options
  );
  return state(appWithSession(workstation.document, result.session), null);
};

export const commitProfessionalWorkstationFrameBarlinesV1 = (
  workstation: ScoreEditorProfessionalWorkstationV1,
  target: MeasureFrameAddressV3,
  value: unknown,
  options: ProfessionalFrameBarlinesV1Options
): Readonly<ScoreEditorProfessionalWorkstationV1> => {
  const result = commitSessionProfessionalFrameBarlinesV1(
    workstation.document.session,
    target,
    value,
    options
  );
  return state(appWithSession(workstation.document, result.session), null);
};

export const commitProfessionalWorkstationTopologyV1 = (
  workstation: ScoreEditorProfessionalWorkstationV1,
  intent: unknown,
  options: TopologyAuthoringV3Options
): Readonly<ScoreEditorProfessionalWorkstationV1> => state(
  commitAppTopologyIntent(workstation.document, intent, options),
  null
);

export const navigateProfessionalWorkstationHistoryV1 = (
  workstation: ScoreEditorProfessionalWorkstationV1,
  direction: 'UNDO' | 'REDO'
): Readonly<ScoreEditorProfessionalWorkstationV1> => state(
  navigateAppDocumentHistory(workstation.document, direction),
  null
);
