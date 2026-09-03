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
import { executeEditorKeypadActionV4, type EditorKeypadV4Options } from '../../editor-keypad-execution-v4/src/index.js';

export const EDITOR_SESSION_V4_VERSION = '4.0.0' as const;
export interface EditorSessionStateV4 {
  readonly version: typeof EDITOR_SESSION_V4_VERSION;
  readonly history: Readonly<EditorHistoryStateV4>;
  readonly selection: SemanticAddressV3 | null;
  readonly renderRequest: Readonly<RendererRequestV4>;
  readonly status: { readonly code: string; readonly message: string };
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
  const current = session.history.present;
  const result = executeBasicAuthoringV4(current.score, current.notation, intent, options);
  const history = commitEditorHistoryV4(session.history, result.score, result.notation);
  return state(history, result.selection, 'BASIC_AUTHORING_EDIT_COMMITTED', 'Basic musical authoring edit committed in the unified V4 history.', session.renderRequest.renderer);
};

export const commitSessionGraceAuthoringIntentV4 = (session: EditorSessionStateV4, intent: unknown, options: GraceAuthoringV4Options): Readonly<EditorSessionStateV4> => {
  const current = session.history.present;
  const result = executeGraceAuthoringV4(current.score, current.notation, intent, options);
  const history = commitEditorHistoryV4(session.history, result.score, result.notation);
  return state(history, result.selection, 'GRACE_AUTHORING_EDIT_COMMITTED', 'Grace authoring edit committed in the unified V4 history.', session.renderRequest.renderer);
};

export const commitSessionArticulationAuthoringIntentV4 = (session: EditorSessionStateV4, intent: unknown, options: ArticulationAuthoringV4Options): Readonly<EditorSessionStateV4> => {
  const current = session.history.present;
  const result = executeArticulationAuthoringV4(current.score, current.notation, intent, options);
  const history = commitEditorHistoryV4(session.history, result.score, result.notation);
  return state(history, result.selection, 'ARTICULATION_AUTHORING_EDIT_COMMITTED', 'Articulation authoring edit committed in the unified V4 history.', session.renderRequest.renderer);
};

export const commitSessionOrnamentAuthoringIntentV4 = (session: EditorSessionStateV4, intent: unknown, options: OrnamentAuthoringV4Options): Readonly<EditorSessionStateV4> => {
  const current = session.history.present;
  const result = executeOrnamentAuthoringV4(current.score, current.notation, intent, options);
  const history = commitEditorHistoryV4(session.history, result.score, result.notation);
  return state(history, result.selection, 'ORNAMENT_AUTHORING_EDIT_COMMITTED', 'Ornament authoring edit committed in the unified V4 history.', session.renderRequest.renderer);
};

export const commitSessionKeypadActionV4 = (session: EditorSessionStateV4, action: unknown, advancedTarget: unknown, options: EditorKeypadV4Options): Readonly<EditorSessionStateV4> => {
  const current = session.history.present;
  const result = executeEditorKeypadActionV4(current.score, current.notation, session.selection, action, advancedTarget, options);
  const history = commitEditorHistoryV4(session.history, result.score, result.notation);
  return state(history, result.selection, 'KEYPAD_EDIT_COMMITTED', 'Semantic keypad action committed atomically in the unified V4 history.', session.renderRequest.renderer);
};

export const commitSessionCrossStaffIntentV4 = (session: EditorSessionStateV4, intent: unknown, options: CrossStaffAuthoringV4Options): Readonly<EditorSessionStateV4> => {
  const current = session.history.present;
  const result = executeCrossStaffAuthoringV4(current.score, current.notation, intent, options);
  const history = commitEditorHistoryV4(session.history, result.score, result.notation);
  const selection = addressEntityV3(history.present.score, result.selectionEntityId);
  return state(history, selection, 'CROSS_STAFF_EDIT_COMMITTED', 'Cross-staff placement committed as notation-only semantic state.', session.renderRequest.renderer);
};

export const commitSessionTopologyIntentV4 = (session: EditorSessionStateV4, intent: unknown, options: TopologyAuthoringV3Options): Readonly<EditorSessionStateV4> => {
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
