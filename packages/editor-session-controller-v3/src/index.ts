import { createScoreDocumentV3, type ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import { createNotationDocumentV3, type NotationDocumentV3 } from '../../notation-structure-v3/src/index.js';
import { addressEntityV3, type SemanticAddressV3 } from '../../addressing-v3/src/index.js';
import { createEditorHistoryV3, commitEditorHistoryV3, navigateEditorHistoryV3, type EditorHistoryStateV3 } from '../../editor-history-v3/src/index.js';
import { createRendererRequestV3, resolveRenderTokenV3, type RendererRequestV3 } from '../../renderer-contract-v3/src/index.js';
import { executeTopologyAuthoringV3, type TopologyAuthoringV3Options } from '../../editor-topology-authoring-v3/src/index.js';
import { migrateScoreNotationV2ToV3 } from '../../schema-migration-v2-v3/src/index.js';
import type { ScoreDocumentV2 } from '../../score-model-v2/src/index.js';
import type { NotationDocumentV2 } from '../../notation-structure-v2/src/index.js';

export const EDITOR_SESSION_V3_VERSION='3.0.0' as const;
export interface EditorSessionStateV3 { readonly version:typeof EDITOR_SESSION_V3_VERSION; readonly history:Readonly<EditorHistoryStateV3>; readonly selection:SemanticAddressV3|null; readonly renderRequest:Readonly<RendererRequestV3>; readonly status:{readonly code:string;readonly message:string} }
const state=(history:Readonly<EditorHistoryStateV3>,selection:SemanticAddressV3|null,code:string,message:string):Readonly<EditorSessionStateV3>=>Object.freeze({version:EDITOR_SESSION_V3_VERSION,history,selection,renderRequest:createRendererRequestV3(history.present.score,history.present.notation),status:Object.freeze({code,message})});
export const createEditorSessionV3=(scoreInput:ScoreDocumentV3,notationInput:NotationDocumentV3):Readonly<EditorSessionStateV3>=>{const score=createScoreDocumentV3(scoreInput);const notation=createNotationDocumentV3(score,notationInput);return state(createEditorHistoryV3(score,notation),null,'READY','Canonical v3 editor session ready.');};
export const createEditorSessionV3FromV2=(score:ScoreDocumentV2,notation:NotationDocumentV2):Readonly<EditorSessionStateV3>=>{const migrated=migrateScoreNotationV2ToV3(score,notation);return state(createEditorHistoryV3(migrated.score,migrated.notation),null,'MIGRATED_READY','V2 pair migrated once into canonical v3 session.');};
export const commitSessionTopologyIntentV3=(session:EditorSessionStateV3,intent:unknown,options:TopologyAuthoringV3Options):Readonly<EditorSessionStateV3>=>{const current=session.history.present;const result=executeTopologyAuthoringV3(current.score,current.notation,intent,options);const history=commitEditorHistoryV3(session.history,result.score,result.notation);const selection=addressEntityV3(history.present.score,result.selectionEntityId);return state(history,selection,'TOPOLOGY_EDIT_COMMITTED','Topology edit committed as one canonical v3 revision.');};
export const navigateSessionHistoryV3=(session:EditorSessionStateV3,direction:'UNDO'|'REDO'):Readonly<EditorSessionStateV3>=>state(navigateEditorHistoryV3(session.history,direction),null,direction==='UNDO'?'UNDO_COMMITTED':'REDO_COMMITTED',`${direction} restored an exact canonical v3 score+notation snapshot.`);
export const selectSessionRenderTokenV3=(session:EditorSessionStateV3,token:string):Readonly<EditorSessionStateV3>=>{const address=resolveRenderTokenV3(session.history.present.score,session.renderRequest,token);return state(session.history,address,'SELECTION_CHANGED','Opaque v3 renderer token resolved to current semantic selection.');};
