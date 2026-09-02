import type { ScoreDocument } from '../../score-model/src/index.js';
import type { NotationDocument } from '../../notation-structure/src/index.js';
import { createScoreDocumentV2, type ScoreDocumentV2 } from '../../score-model-v2/src/index.js';
import { createNotationDocumentV2, type NotationDocumentV2 } from '../../notation-structure-v2/src/index.js';
import { migrateSchemaPairV1ToV2 } from '../../schema-migration-v1-v2/src/index.js';
import {
  commitEditorHistoryV2,
  createEditorHistoryV2,
  redoEditorHistoryV2,
  undoEditorHistoryV2,
  type EditorHistoryStateV2
} from '../../editor-history-v2/src/index.js';
import { createRendererRequestV2WithProfile, type RendererRequestV2 } from '../../renderer-contract-v2/src/index.js';
import { rendererProfile, type RendererFamily, type RendererProfile } from '../../renderer-contract/src/index.js';
import {
  createInspectorModelV2,
  createSelectionSnapshotV2,
  selectRenderTokenV2,
  type InspectorModelV2,
  type SelectionSnapshotV2
} from '../../editor-selection-v2/src/index.js';
import { addressEntityV2 } from '../../addressing-v2/src/index.js';
import {
  executeGraceAuthoringV2,
  type GraceAuthoringIdentityV2,
  type GraceAuthoringIntentV2
} from '../../editor-grace-authoring-v2/src/index.js';
import {
  executeArticulationAuthoringV2,
  type ArticulationAuthoringIdentityV2,
  type ArticulationAuthoringIntentV2
} from '../../editor-articulation-authoring-v2/src/index.js';
import type { EditorStatus } from '../../editor-ui-contract/src/index.js';

export const EDITOR_SESSION_CONTROLLER_V2_VERSION = '2.0.0' as const;

export interface EditorSessionStateV2 {
  readonly version: typeof EDITOR_SESSION_CONTROLLER_V2_VERSION;
  readonly schemaVersion: '2.0.0';
  readonly rendererFamily: RendererFamily;
  readonly history: Readonly<EditorHistoryStateV2>;
  readonly renderRequest: Readonly<RendererRequestV2>;
  readonly selection: Readonly<SelectionSnapshotV2> | null;
  readonly inspector: Readonly<InspectorModelV2> | null;
  readonly status: Readonly<EditorStatus>;
}

const editorStatus = (
  level: EditorStatus['level'],
  code: string | null,
  message: string
): Readonly<EditorStatus> => Object.freeze({ level, code, message });

const state = (
  profile: RendererProfile,
  history: Readonly<EditorHistoryStateV2>,
  selection: Readonly<SelectionSnapshotV2> | null,
  inspector: Readonly<InspectorModelV2> | null,
  currentStatus: Readonly<EditorStatus>
): Readonly<EditorSessionStateV2> => Object.freeze({
  version: EDITOR_SESSION_CONTROLLER_V2_VERSION,
  schemaVersion: '2.0.0',
  rendererFamily: profile.family,
  history,
  renderRequest: createRendererRequestV2WithProfile(history.present.score, history.present.notation, profile),
  selection,
  inspector,
  status: currentStatus
});

export const createEditorSessionV2WithRendererProfile = (
  scoreInput: ScoreDocumentV2,
  notationInput: NotationDocumentV2,
  profile: RendererProfile
): Readonly<EditorSessionStateV2> => {
  const score = createScoreDocumentV2(scoreInput);
  const notation = createNotationDocumentV2(score, notationInput);
  return state(profile, createEditorHistoryV2(score, notation), null, null, editorStatus('idle', null, ''));
};

export const createEditorSessionV2 = (
  score: ScoreDocumentV2,
  notation: NotationDocumentV2,
  family: RendererFamily = 'osmd'
): Readonly<EditorSessionStateV2> =>
  createEditorSessionV2WithRendererProfile(score, notation, rendererProfile(family));

export const createEditorSessionV2FromV1 = (
  score: ScoreDocument,
  notation: NotationDocument,
  family: RendererFamily = 'osmd'
): Readonly<EditorSessionStateV2> => {
  const migrated = migrateSchemaPairV1ToV2(score, notation);
  return createEditorSessionV2(migrated.score, migrated.notation, family);
};

export const selectSessionV2RenderToken = (
  session: EditorSessionStateV2,
  token: string
): Readonly<EditorSessionStateV2> => {
  const selected = selectRenderTokenV2(session.history.present.score, session.renderRequest, token);
  return state(
    session.renderRequest.renderer,
    session.history,
    selected.selection,
    selected.inspector,
    editorStatus('info', 'SELECTION_CHANGED', `Selected ${selected.inspector.targetKind}.`)
  );
};

export const commitSessionGraceIntentV2 = (
  session: EditorSessionStateV2,
  intent: GraceAuthoringIntentV2,
  identity: GraceAuthoringIdentityV2
): Readonly<EditorSessionStateV2> => {
  const base = session.history.present;
  const result = executeGraceAuthoringV2(base.score, base.notation, intent, identity);
  const history = commitEditorHistoryV2(session.history, result.score, result.notation);
  const nextAddress = addressEntityV2(result.score, result.selectionEntityId);
  const selection = createSelectionSnapshotV2(result.score, nextAddress);
  const inspector = createInspectorModelV2(result.score, nextAddress);
  return state(
    session.renderRequest.renderer,
    history,
    selection,
    inspector,
    editorStatus('success', 'GRACE_EDIT_COMMITTED', 'Grace edit committed.')
  );
};

export const commitSessionArticulationIntentV2 = (
  session: EditorSessionStateV2,
  intent: ArticulationAuthoringIntentV2,
  identity: ArticulationAuthoringIdentityV2
): Readonly<EditorSessionStateV2> => {
  const base = session.history.present;
  const result = executeArticulationAuthoringV2(base.score, base.notation, intent, identity);
  const history = commitEditorHistoryV2(session.history, result.score, result.notation);
  const nextAddress = addressEntityV2(result.score, result.selectionEntityId);
  const selection = createSelectionSnapshotV2(result.score, nextAddress);
  const inspector = createInspectorModelV2(result.score, nextAddress);
  return state(
    session.renderRequest.renderer,
    history,
    selection,
    inspector,
    editorStatus('success', 'ARTICULATION_EDIT_COMMITTED', 'Articulation edit committed.')
  );
};

export type EditorHistoryActionV2 = 'UNDO' | 'REDO';

export const navigateSessionHistoryV2 = (
  session: EditorSessionStateV2,
  action: EditorHistoryActionV2
): Readonly<EditorSessionStateV2> => {
  const history = action === 'UNDO' ? undoEditorHistoryV2(session.history) : redoEditorHistoryV2(session.history);
  return state(
    session.renderRequest.renderer,
    history,
    null,
    null,
    editorStatus(
      'info',
      action === 'UNDO' ? 'UNDO_APPLIED' : 'REDO_APPLIED',
      action === 'UNDO' ? 'Undo applied.' : 'Redo applied.'
    )
  );
};
