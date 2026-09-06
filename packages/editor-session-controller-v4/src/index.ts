import { createScoreDocumentV3, type ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import { addressEntityV3, resolveSemanticAddressV3, type SemanticAddressV3 } from '../../addressing-v3/src/index.js';
import { createNotationDocumentV3, type NotationDocumentV3 } from '../../notation-structure-v3/src/index.js';
import { createNotationDocumentV4, type NotationDocumentV4 } from '../../notation-structure-v4/src/index.js';
import { migrateNotationV3ToV4 } from '../../schema-migration-v3-v4/src/index.js';
import { createEditorHistoryV4, commitEditorHistoryV4, navigateEditorHistoryV4, type EditorHistoryStateV4 } from '../../editor-history-v4/src/index.js';
import { createRendererRequestV4WithProfile, resolveRenderTokenV4, type RendererRequestV4 } from '../../renderer-contract-v4/src/index.js';
import { rendererProfile, type RendererProfile } from '../../renderer-contract/src/index.js';
import { executeCrossStaffAuthoringV4, type CrossStaffAuthoringV4Options } from '../../editor-cross-staff-authoring-v4/src/index.js';
import { executeTopologyAuthoringV4 } from '../../editor-topology-authoring-v4/src/index.js';
import type { TopologyAuthoringV3Options } from '../../editor-topology-authoring-v3/src/index.js';
import { executeBasicAuthoringV4, type BasicAuthoringV4Options } from '../../editor-basic-authoring-v4/src/index.js';
import { executeGraceAuthoringV4, type GraceAuthoringV4Options } from '../../editor-grace-authoring-v4/src/index.js';
import { executeArticulationAuthoringV4, type ArticulationAuthoringV4Options } from '../../editor-articulation-authoring-v4/src/index.js';
import { executeOrnamentAuthoringV4, type OrnamentAuthoringV4Options } from '../../editor-ornament-authoring-v4/src/index.js';
import type { EditorKeypadV4Options } from '../../editor-keypad-execution-v4/src/index.js';
import { executeSafeEditorKeypadActionV4 } from '../../editor-keypad-rhythm-safe-v4/src/index.js';
import type { TeacherCopySnapshotV4 } from '../../editor-teacher-copy-snapshot-v4/src/index.js';
import type { TeacherPasteAdmissionV4 } from '../../editor-teacher-paste-admission-v4/src/index.js';
import type { TeacherPasteIdentityPlanV4 } from '../../editor-teacher-paste-identity-plan-v4/src/index.js';
import { executeTeacherPasteOverwriteV4 } from '../../editor-teacher-paste-authoring-v4/src/index.js';
import type { TeacherInsertAdmissionV4 } from '../../editor-teacher-insert-admission-v4/src/index.js';
import { executeTeacherInsertAfterEventV4 } from '../../editor-teacher-insert-authoring-v4/src/index.js';
import type { TeacherEventSpanSelectionV4 } from '../../editor-teacher-event-span-v4/src/index.js';
import type { TeacherOctaveTransposeAdmissionV4 } from '../../editor-teacher-octave-transpose-admission-v4/src/index.js';
import {
  executeTeacherOctaveTransposeV4,
  type TeacherOctaveTransposeAuthoringV4Options
} from '../../editor-teacher-octave-transpose-authoring-v4/src/index.js';

export const EDITOR_SESSION_V4_VERSION = '4.0.0' as const;
export interface EditorSessionStateV4 {
  readonly version: typeof EDITOR_SESSION_V4_VERSION;
  readonly history: Readonly<EditorHistoryStateV4>;
  readonly selection: SemanticAddressV3 | null;
  readonly renderRequest: Readonly<RendererRequestV4>;
  readonly status: { readonly code: string; readonly message: string };
}

export type EditorSessionV4ErrorCode = 'REVISION_ID_REUSE';
export class EditorSessionV4Error extends Error {
  readonly code: EditorSessionV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: EditorSessionV4ErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'EditorSessionV4Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const state = (
  history: Readonly<EditorHistoryStateV4>,
  selection: SemanticAddressV3 | null,
  code: string,
  message: string,
  profile: RendererProfile
): Readonly<EditorSessionStateV4> => Object.freeze({
  version: EDITOR_SESSION_V4_VERSION,
  history,
  selection,
  renderRequest: createRendererRequestV4WithProfile(history.present.score, history.present.notation, profile),
  status: Object.freeze({ code, message })
});
const legacyOsmdProfile = (): RendererProfile => rendererProfile('osmd');

const assertSessionRevisionDoesNotReuseParent = (
  session: EditorSessionStateV4,
  nextRevisionId: string
): void => {
  const present = session.history.present.score.revision;
  if (present.parentId !== null && nextRevisionId === present.parentId) {
    throw new EditorSessionV4Error(
      'EditorSessionV4 does not allow a new edit to reuse the immediate parent revision identity.',
      'REVISION_ID_REUSE',
      { nextRevisionId, currentRevisionId: present.id, parentRevisionId: present.parentId }
    );
  }
};

export const createEditorSessionV4WithRendererProfile = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  profile: RendererProfile
): Readonly<EditorSessionStateV4> => {
  const score = createScoreDocumentV3(scoreInput);
  const notation = createNotationDocumentV4(score, notationInput);
  return state(createEditorHistoryV4(score, notation), null, 'READY', 'Canonical score-v3 + notation-v4 editor session ready.', profile);
};

export const createEditorSessionV4 = (scoreInput: ScoreDocumentV3, notationInput: NotationDocumentV4): Readonly<EditorSessionStateV4> =>
  createEditorSessionV4WithRendererProfile(scoreInput, notationInput, legacyOsmdProfile());

export const createEditorSessionV4FromV3WithRendererProfile = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV3,
  profile: RendererProfile
): Readonly<EditorSessionStateV4> => {
  const score = createScoreDocumentV3(scoreInput);
  const notation = createNotationDocumentV3(score, notationInput);
  return state(
    createEditorHistoryV4(score, migrateNotationV3ToV4(score, notation)),
    null,
    'MIGRATED_READY',
    'Notation V3 migrated once into canonical V4 session.',
    profile
  );
};

export const createEditorSessionV4FromV3 = (scoreInput: ScoreDocumentV3, notationInput: NotationDocumentV3): Readonly<EditorSessionStateV4> =>
  createEditorSessionV4FromV3WithRendererProfile(scoreInput, notationInput, legacyOsmdProfile());

export const commitSessionBasicAuthoringIntentV4 = (session: EditorSessionStateV4, intent: unknown, options: BasicAuthoringV4Options): Readonly<EditorSessionStateV4> => {
  assertSessionRevisionDoesNotReuseParent(session, options.nextRevisionId);
  const current = session.history.present;
  const result = executeBasicAuthoringV4(current.score, current.notation, intent, options);
  const history = commitEditorHistoryV4(session.history, result.score, result.notation);
  return state(history, result.selection, 'BASIC_AUTHORING_EDIT_COMMITTED', 'Basic musical authoring edit committed in the unified V4 history.', session.renderRequest.renderer);
};

export const commitSessionGraceAuthoringIntentV4 = (session: EditorSessionStateV4, intent: unknown, options: GraceAuthoringV4Options): Readonly<EditorSessionStateV4> => {
  assertSessionRevisionDoesNotReuseParent(session, options.nextRevisionId);
  const current = session.history.present;
  const result = executeGraceAuthoringV4(current.score, current.notation, intent, options);
  const history = commitEditorHistoryV4(session.history, result.score, result.notation);
  return state(history, result.selection, 'GRACE_AUTHORING_EDIT_COMMITTED', 'Grace authoring edit committed in the unified V4 history.', session.renderRequest.renderer);
};

export const commitSessionArticulationAuthoringIntentV4 = (session: EditorSessionStateV4, intent: unknown, options: ArticulationAuthoringV4Options): Readonly<EditorSessionStateV4> => {
  assertSessionRevisionDoesNotReuseParent(session, options.nextRevisionId);
  const current = session.history.present;
  const result = executeArticulationAuthoringV4(current.score, current.notation, intent, options);
  const history = commitEditorHistoryV4(session.history, result.score, result.notation);
  return state(history, result.selection, 'ARTICULATION_AUTHORING_EDIT_COMMITTED', 'Articulation authoring edit committed in the unified V4 history.', session.renderRequest.renderer);
};

export const commitSessionOrnamentAuthoringIntentV4 = (session: EditorSessionStateV4, intent: unknown, options: OrnamentAuthoringV4Options): Readonly<EditorSessionStateV4> => {
  assertSessionRevisionDoesNotReuseParent(session, options.nextRevisionId);
  const current = session.history.present;
  const result = executeOrnamentAuthoringV4(current.score, current.notation, intent, options);
  const history = commitEditorHistoryV4(session.history, result.score, result.notation);
  return state(history, result.selection, 'ORNAMENT_AUTHORING_EDIT_COMMITTED', 'Ornament authoring edit committed in the unified V4 history.', session.renderRequest.renderer);
};

export const commitSessionKeypadActionV4 = (session: EditorSessionStateV4, action: unknown, advancedTarget: unknown, options: EditorKeypadV4Options): Readonly<EditorSessionStateV4> => {
  assertSessionRevisionDoesNotReuseParent(session, options.nextRevisionId);
  const current = session.history.present;
  const result = executeSafeEditorKeypadActionV4(current.score, current.notation, session.selection, action, advancedTarget, options);
  const history = commitEditorHistoryV4(session.history, result.score, result.notation);
  return state(history, result.selection, 'KEYPAD_EDIT_COMMITTED', 'Semantic keypad action committed atomically in the unified V4 history.', session.renderRequest.renderer);
};

export const commitSessionTeacherPasteOverwriteV4 = (
  session: EditorSessionStateV4,
  snapshot: TeacherCopySnapshotV4,
  admission: TeacherPasteAdmissionV4,
  identityPlan: TeacherPasteIdentityPlanV4
): Readonly<EditorSessionStateV4> => {
  assertSessionRevisionDoesNotReuseParent(session, identityPlan.nextRevisionId);
  const current = session.history.present;
  const result = executeTeacherPasteOverwriteV4(current.score, current.notation, snapshot, admission, identityPlan);
  const history = commitEditorHistoryV4(session.history, result.score, result.notation);
  return state(
    history,
    result.selection,
    'TEACHER_PASTE_EDIT_COMMITTED',
    'Teacher paste overwrite committed atomically in the unified V4 history.',
    session.renderRequest.renderer
  );
};

export const commitSessionTeacherInsertAfterEventV4 = (
  session: EditorSessionStateV4,
  snapshot: TeacherCopySnapshotV4,
  admission: TeacherInsertAdmissionV4,
  nextRevisionId: string
): Readonly<EditorSessionStateV4> => {
  assertSessionRevisionDoesNotReuseParent(session, nextRevisionId);
  const current = session.history.present;
  const result = executeTeacherInsertAfterEventV4(
    current.score,
    current.notation,
    snapshot,
    admission,
    nextRevisionId
  );
  const history = commitEditorHistoryV4(session.history, result.score, result.notation);
  return state(
    history,
    result.selection,
    'TEACHER_INSERT_EDIT_COMMITTED',
    'Teacher insert committed atomically in the unified V4 history.',
    session.renderRequest.renderer
  );
};

export const commitSessionTeacherOctaveTransposeV4 = (
  session: EditorSessionStateV4,
  selection: TeacherEventSpanSelectionV4,
  admission: TeacherOctaveTransposeAdmissionV4,
  options: TeacherOctaveTransposeAuthoringV4Options
): Readonly<EditorSessionStateV4> => {
  assertSessionRevisionDoesNotReuseParent(session, options.nextRevisionId);
  const current = session.history.present;
  const result = executeTeacherOctaveTransposeV4(
    current.score,
    current.notation,
    selection,
    admission,
    options
  );
  const history = commitEditorHistoryV4(session.history, result.score, result.notation);
  return state(
    history,
    result.selection,
    'TEACHER_OCTAVE_TRANSPOSE_EDIT_COMMITTED',
    'Teacher octave transpose committed atomically in the unified V4 history.',
    session.renderRequest.renderer
  );
};

export const commitSessionCrossStaffIntentV4 = (session: EditorSessionStateV4, intent: unknown, options: CrossStaffAuthoringV4Options): Readonly<EditorSessionStateV4> => {
  assertSessionRevisionDoesNotReuseParent(session, options.nextRevisionId);
  const current = session.history.present;
  const result = executeCrossStaffAuthoringV4(current.score, current.notation, intent, options);
  const history = commitEditorHistoryV4(session.history, result.score, result.notation);
  const selection = addressEntityV3(history.present.score, result.selectionEntityId);
  return state(history, selection, 'CROSS_STAFF_EDIT_COMMITTED', 'Cross-staff placement committed as notation-only semantic state.', session.renderRequest.renderer);
};

export const commitSessionTopologyIntentV4 = (session: EditorSessionStateV4, intent: unknown, options: TopologyAuthoringV3Options): Readonly<EditorSessionStateV4> => {
  assertSessionRevisionDoesNotReuseParent(session, options.nextRevisionId);
  const current = session.history.present;
  const result = executeTopologyAuthoringV4(current.score, current.notation, intent, options);
  const history = commitEditorHistoryV4(session.history, result.score, result.notation);
  const selection = addressEntityV3(history.present.score, result.selectionEntityId);
  return state(history, selection, 'TOPOLOGY_EDIT_COMMITTED', 'Topology edit committed with V4 cross-staff orphan protection.', session.renderRequest.renderer);
};

export const selectSessionSemanticAddressV4 = (session: EditorSessionStateV4, address: SemanticAddressV3 | null): Readonly<EditorSessionStateV4> => {
  if (address === null) return state(session.history, null, 'SELECTION_CHANGED', 'Semantic selection cleared.', session.renderRequest.renderer);
  resolveSemanticAddressV3(session.history.present.score, address);
  return state(session.history, address, 'SELECTION_CHANGED', 'Current-revision semantic selection accepted.', session.renderRequest.renderer);
};

export const navigateSessionHistoryV4 = (session: EditorSessionStateV4, direction: 'UNDO' | 'REDO'): Readonly<EditorSessionStateV4> =>
  state(
    navigateEditorHistoryV4(session.history, direction),
    null,
    direction === 'UNDO' ? 'UNDO_COMMITTED' : 'REDO_COMMITTED',
    `${direction} restored an exact score-v3 + notation-v4 snapshot.`,
    session.renderRequest.renderer
  );

export const selectSessionRenderTokenV4 = (session: EditorSessionStateV4, token: string): Readonly<EditorSessionStateV4> => {
  const address = resolveRenderTokenV4(session.history.present.score, session.renderRequest, token);
  return state(session.history, address, 'SELECTION_CHANGED', 'Opaque V4 renderer token resolved to original source semantic selection.', session.renderRequest.renderer);
};