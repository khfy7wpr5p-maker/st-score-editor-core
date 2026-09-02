import type { ScoreDocument } from '../../score-model/src/index.js';
import type { NotationDocument } from '../../notation-structure/src/index.js';
import type { RendererFamily } from '../../renderer-contract/src/index.js';
import {
  createEditorSession,
  selectSessionRenderToken,
  commitSessionScoreIntent,
  commitSessionNotationIntent,
  commitSessionKeypadAction,
  commitSessionNoteEntry,
  navigateSessionHistory,
  type EditorSessionState
} from '../../editor-session-controller/src/index.js';
import type { EditorCommitIdentity } from '../../editor-score-intents/src/index.js';
import type { NotationIntentCommitIdentity } from '../../editor-notation-intents/src/index.js';
import type { NoteEntryCommitIdentity } from '../../editor-note-entry/src/index.js';
import type { EditorHistoryAction } from '../../editor-session-safety/src/index.js';

export const SESLITAB_EDITOR_HOST_VERSION='1.0.0' as const;
export type SesliTabInputMode='pointer'|'keyboard'|'touch';

export const sesliTabEditorHostProfile=Object.freeze({
  version:SESLITAB_EDITOR_HOST_VERSION,
  canonicalStateCount:1,
  canonicalAuthority:'EDITOR_SESSION_SCORE_DOCUMENT',
  hostDualWriteAllowed:false,
  rendererMutationAuthority:false,
  domCoordinateMutationAuthority:false,
  pointerKeyboardTouchSameSemanticPath:true,
  playbackOwnedByHost:true,
  editorAdmissionControlsPlayback:false,
  networkAuthority:false,
  persistenceAuthority:false,
  serverRevisionAuthority:false,
  publicationAuthority:false,
  productionAuthority:false
});

export interface SesliTabEditorHostState{
  readonly version:typeof SESLITAB_EDITOR_HOST_VERSION;
  readonly session:Readonly<EditorSessionState>;
  readonly lastInputMode:SesliTabInputMode|null;
}
export interface SesliTabHostSnapshot{
  readonly version:typeof SESLITAB_EDITOR_HOST_VERSION;
  readonly documentId:string;
  readonly revisionId:string;
  readonly rendererFamily:RendererFamily;
  readonly renderRequest:EditorSessionState['renderRequest'];
  readonly selection:EditorSessionState['selection'];
  readonly status:EditorSessionState['status'];
  readonly capabilities:typeof sesliTabEditorHostProfile;
}
export interface SesliTabHostError{
  readonly version:typeof SESLITAB_EDITOR_HOST_VERSION;
  readonly code:string;
  readonly message:string;
}
export type SesliTabHostResult=
  |{readonly ok:true;readonly host:Readonly<SesliTabEditorHostState>}
  |{readonly ok:false;readonly error:Readonly<SesliTabHostError>};

const state=(session:Readonly<EditorSessionState>,lastInputMode:SesliTabInputMode|null):Readonly<SesliTabEditorHostState>=>Object.freeze({version:SESLITAB_EDITOR_HOST_VERSION,session,lastInputMode});
const failure=(error:unknown):Readonly<SesliTabHostResult>=>{
  const record=error!==null&&typeof error==='object'?error as {readonly code?:unknown;readonly message?:unknown}:null;
  const code=typeof record?.code==='string'&&record.code.length>0?record.code:'SESLITAB_EDITOR_OPERATION_REJECTED';
  const message=typeof record?.message==='string'&&record.message.length>0?record.message:'SesliTab editor operation rejected.';
  return Object.freeze({ok:false,error:Object.freeze({version:SESLITAB_EDITOR_HOST_VERSION,code,message})});
};
const execute=(host:SesliTabEditorHostState,inputMode:SesliTabInputMode,operation:(session:EditorSessionState)=>Readonly<EditorSessionState>):Readonly<SesliTabHostResult>=>{
  try{return Object.freeze({ok:true,host:state(operation(host.session),inputMode)});}
  catch(error){return failure(error);}
};

export const createSesliTabEditorHost=(score:Readonly<ScoreDocument>,notation:Readonly<NotationDocument>,rendererFamily:RendererFamily='osmd'):Readonly<SesliTabEditorHostState>=>
  state(createEditorSession(score,notation,rendererFamily),null);

export const createSesliTabHostSnapshot=(host:SesliTabEditorHostState):Readonly<SesliTabHostSnapshot>=>Object.freeze({
  version:SESLITAB_EDITOR_HOST_VERSION,
  documentId:host.session.history.present.score.id,
  revisionId:host.session.history.present.score.revision.id,
  rendererFamily:host.session.rendererFamily,
  renderRequest:host.session.renderRequest,
  selection:host.session.selection,
  status:host.session.status,
  capabilities:sesliTabEditorHostProfile
});

export const selectSesliTabRenderToken=(host:SesliTabEditorHostState,token:string,inputMode:SesliTabInputMode):Readonly<SesliTabHostResult>=>
  execute(host,inputMode,(session)=>selectSessionRenderToken(session,token));

export const commitSesliTabScoreIntent=(host:SesliTabEditorHostState,rawIntent:unknown,identity:EditorCommitIdentity,inputMode:SesliTabInputMode):Readonly<SesliTabHostResult>=>
  execute(host,inputMode,(session)=>commitSessionScoreIntent(session,rawIntent,identity));

export const commitSesliTabNotationIntent=(host:SesliTabEditorHostState,rawIntent:unknown,identity:NotationIntentCommitIdentity,inputMode:SesliTabInputMode):Readonly<SesliTabHostResult>=>
  execute(host,inputMode,(session)=>commitSessionNotationIntent(session,rawIntent,identity));

export const commitSesliTabKeypadAction=(host:SesliTabEditorHostState,rawAction:unknown,rawIdentity:unknown,rawTarget:unknown,inputMode:SesliTabInputMode):Readonly<SesliTabHostResult>=>
  execute(host,inputMode,(session)=>commitSessionKeypadAction(session,rawAction,rawIdentity,rawTarget));

export const commitSesliTabNoteEntry=(host:SesliTabEditorHostState,rawIntent:unknown,identity:NoteEntryCommitIdentity,inputMode:SesliTabInputMode):Readonly<SesliTabHostResult>=>
  execute(host,inputMode,(session)=>commitSessionNoteEntry(session,rawIntent,identity));

export const navigateSesliTabHistory=(host:SesliTabEditorHostState,action:EditorHistoryAction,inputMode:SesliTabInputMode='keyboard'):Readonly<SesliTabHostResult>=>
  execute(host,inputMode,(session)=>navigateSessionHistory(session,action));
