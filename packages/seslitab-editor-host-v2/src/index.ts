import type { ScoreDocument } from '../../score-model/src/index.js';
import type { NotationDocument } from '../../notation-structure/src/index.js';
import type { ScoreDocumentV2 } from '../../score-model-v2/src/index.js';
import type { NotationDocumentV2 } from '../../notation-structure-v2/src/index.js';
import type { RendererFamily, RendererProfile } from '../../renderer-contract/src/index.js';
import {
  createEditorSessionV2,
  createEditorSessionV2FromV1,
  createEditorSessionV2WithRendererProfile,
  selectSessionV2RenderToken,
  commitSessionGraceIntentV2,
  commitSessionArticulationIntentV2,
  commitSessionOrnamentIntentV2,
  navigateSessionHistoryV2,
  type EditorHistoryActionV2,
  type EditorSessionStateV2
} from '../../editor-session-controller-v2/src/index.js';
import type { GraceAuthoringIdentityV2, GraceAuthoringIntentV2 } from '../../editor-grace-authoring-v2/src/index.js';
import type { ArticulationAuthoringIdentityV2, ArticulationAuthoringIntentV2 } from '../../editor-articulation-authoring-v2/src/index.js';
import type { OrnamentAuthoringIdentityV2, OrnamentAuthoringIntentV2 } from '../../editor-ornament-authoring-v2/src/index.js';

export const SESLITAB_EDITOR_HOST_V2_VERSION='2.0.0' as const;
export type SesliTabInputModeV2='pointer'|'keyboard'|'touch';

export const sesliTabEditorHostProfileV2=Object.freeze({
  version:SESLITAB_EDITOR_HOST_V2_VERSION,
  canonicalStateCount:1,
  canonicalAuthority:'EDITOR_SESSION_V2_SCORE_NOTATION_PAIR',
  hostDualWriteAllowed:false,
  rendererMutationAuthority:false,
  domCoordinateMutationAuthority:false,
  pointerKeyboardTouchSameSemanticPath:true,
  playbackOwnedByHost:true,
  editorAdmissionControlsPlayback:false,
  v2MusicXmlIsProjectionOnly:true,
  networkAuthority:false,
  persistenceAuthority:false,
  serverRevisionAuthority:false,
  publicationAuthority:false,
  productionAuthority:false
});

export interface SesliTabEditorHostStateV2{
  readonly version:typeof SESLITAB_EDITOR_HOST_V2_VERSION;
  readonly session:Readonly<EditorSessionStateV2>;
  readonly lastInputMode:SesliTabInputModeV2|null;
}
export interface SesliTabHostSnapshotV2{
  readonly version:typeof SESLITAB_EDITOR_HOST_V2_VERSION;
  readonly documentId:string;
  readonly revisionId:string;
  readonly rendererFamily:RendererFamily;
  readonly renderRequest:EditorSessionStateV2['renderRequest'];
  readonly selection:EditorSessionStateV2['selection'];
  readonly status:EditorSessionStateV2['status'];
  readonly capabilities:typeof sesliTabEditorHostProfileV2;
}
export interface SesliTabHostErrorV2{
  readonly version:typeof SESLITAB_EDITOR_HOST_V2_VERSION;
  readonly code:string;
  readonly message:string;
}
export type SesliTabHostResultV2=
  |{readonly ok:true;readonly host:Readonly<SesliTabEditorHostStateV2>}
  |{readonly ok:false;readonly error:Readonly<SesliTabHostErrorV2>};

const state=(session:Readonly<EditorSessionStateV2>,lastInputMode:SesliTabInputModeV2|null):Readonly<SesliTabEditorHostStateV2>=>Object.freeze({version:SESLITAB_EDITOR_HOST_V2_VERSION,session,lastInputMode});
const failure=(error:unknown):Readonly<SesliTabHostResultV2>=>{
  const record=error!==null&&typeof error==='object'?error as {readonly code?:unknown;readonly message?:unknown}:null;
  const code=typeof record?.code==='string'&&record.code.length>0?record.code:'SESLITAB_V2_EDITOR_OPERATION_REJECTED';
  const message=typeof record?.message==='string'&&record.message.length>0?record.message:'SesliTab v2 editor operation rejected.';
  return Object.freeze({ok:false,error:Object.freeze({version:SESLITAB_EDITOR_HOST_V2_VERSION,code,message})});
};
const execute=(host:SesliTabEditorHostStateV2,inputMode:SesliTabInputModeV2,operation:(session:EditorSessionStateV2)=>Readonly<EditorSessionStateV2>):Readonly<SesliTabHostResultV2>=>{
  try{return Object.freeze({ok:true,host:state(operation(host.session),inputMode)});}
  catch(error){return failure(error);}
};

export const createSesliTabEditorHostV2=(score:Readonly<ScoreDocumentV2>,notation:Readonly<NotationDocumentV2>,rendererFamily:RendererFamily='osmd'):Readonly<SesliTabEditorHostStateV2>=>
  state(createEditorSessionV2(score,notation,rendererFamily),null);

export const createSesliTabEditorHostV2WithRendererProfile=(score:Readonly<ScoreDocumentV2>,notation:Readonly<NotationDocumentV2>,profile:RendererProfile):Readonly<SesliTabEditorHostStateV2>=>
  state(createEditorSessionV2WithRendererProfile(score,notation,profile),null);

export const createSesliTabEditorHostV2FromV1=(score:Readonly<ScoreDocument>,notation:Readonly<NotationDocument>,rendererFamily:RendererFamily='osmd'):Readonly<SesliTabEditorHostStateV2>=>
  state(createEditorSessionV2FromV1(score,notation,rendererFamily),null);

export const createSesliTabHostSnapshotV2=(host:SesliTabEditorHostStateV2):Readonly<SesliTabHostSnapshotV2>=>Object.freeze({
  version:SESLITAB_EDITOR_HOST_V2_VERSION,
  documentId:host.session.history.present.score.id,
  revisionId:host.session.history.present.score.revision.id,
  rendererFamily:host.session.rendererFamily,
  renderRequest:host.session.renderRequest,
  selection:host.session.selection,
  status:host.session.status,
  capabilities:sesliTabEditorHostProfileV2
});

export const selectSesliTabV2RenderToken=(host:SesliTabEditorHostStateV2,token:string,inputMode:SesliTabInputModeV2):Readonly<SesliTabHostResultV2>=>
  execute(host,inputMode,(session)=>selectSessionV2RenderToken(session,token));

export const commitSesliTabGraceIntentV2=(host:SesliTabEditorHostStateV2,intent:GraceAuthoringIntentV2,identity:GraceAuthoringIdentityV2,inputMode:SesliTabInputModeV2):Readonly<SesliTabHostResultV2>=>
  execute(host,inputMode,(session)=>commitSessionGraceIntentV2(session,intent,identity));

export const commitSesliTabArticulationIntentV2=(host:SesliTabEditorHostStateV2,intent:ArticulationAuthoringIntentV2,identity:ArticulationAuthoringIdentityV2,inputMode:SesliTabInputModeV2):Readonly<SesliTabHostResultV2>=>
  execute(host,inputMode,(session)=>commitSessionArticulationIntentV2(session,intent,identity));

export const commitSesliTabOrnamentIntentV2=(host:SesliTabEditorHostStateV2,intent:OrnamentAuthoringIntentV2,identity:OrnamentAuthoringIdentityV2,inputMode:SesliTabInputModeV2):Readonly<SesliTabHostResultV2>=>
  execute(host,inputMode,(session)=>commitSessionOrnamentIntentV2(session,intent,identity));

export const navigateSesliTabHistoryV2=(host:SesliTabEditorHostStateV2,action:EditorHistoryActionV2,inputMode:SesliTabInputModeV2='keyboard'):Readonly<SesliTabHostResultV2>=>
  execute(host,inputMode,(session)=>navigateSessionHistoryV2(session,action));
