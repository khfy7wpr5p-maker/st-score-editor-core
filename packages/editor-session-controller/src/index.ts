import type { ScoreDocument } from '../../score-model/src/index.js';
import type { SelectionSnapshot } from '../../addressing/src/index.js';
import type { NotationDocument } from '../../notation-structure/src/index.js';
import { createRendererRequest } from '../../renderer-contract/src/index.js';
import type { RendererFamily, RendererRequest } from '../../renderer-contract/src/index.js';
import { selectRenderToken } from '../../editor-selection/src/index.js';
import type { InspectorModel } from '../../editor-selection/src/index.js';
import { executeEditorScoreIntent } from '../../editor-score-intents/src/index.js';
import type { EditorCommitIdentity } from '../../editor-score-intents/src/index.js';
import { executeEditorNotationIntent } from '../../editor-notation-intents/src/index.js';
import type { NotationIntentCommitIdentity } from '../../editor-notation-intents/src/index.js';
import { commitEditorHistory, createEditorHistory, rebindNotationAfterScoreEdit } from '../../editor-history/src/index.js';
import type { EditorHistoryState } from '../../editor-history/src/index.js';
import { navigateEditorHistory } from '../../editor-session-safety/src/index.js';
import type { EditorHistoryAction } from '../../editor-session-safety/src/index.js';
import type { EditorStatus } from '../../editor-ui-contract/src/index.js';

export const EDITOR_SESSION_CONTROLLER_VERSION='1.0.0' as const;

export interface EditorSessionState {
  readonly version:typeof EDITOR_SESSION_CONTROLLER_VERSION;
  readonly rendererFamily:RendererFamily;
  readonly history:Readonly<EditorHistoryState>;
  readonly renderRequest:Readonly<RendererRequest>;
  readonly selection:Readonly<SelectionSnapshot>|null;
  readonly inspector:Readonly<InspectorModel>|null;
  readonly status:Readonly<EditorStatus>;
}

const makeState=(rendererFamily:RendererFamily,history:Readonly<EditorHistoryState>,selection:Readonly<SelectionSnapshot>|null,inspector:Readonly<InspectorModel>|null,status:Readonly<EditorStatus>):Readonly<EditorSessionState>=>Object.freeze({
  version:EDITOR_SESSION_CONTROLLER_VERSION,
  rendererFamily,
  history,
  renderRequest:createRendererRequest(history.present.score,history.present.notation,rendererFamily),
  selection,
  inspector,
  status
});

export const createEditorSession=(score:Readonly<ScoreDocument>,notation:Readonly<NotationDocument>,rendererFamily:RendererFamily='osmd'):Readonly<EditorSessionState>=>
  makeState(rendererFamily,createEditorHistory(score,notation),null,null,Object.freeze({level:'idle',code:null,message:''}));

export const selectSessionRenderToken=(session:EditorSessionState,token:string):Readonly<EditorSessionState>=>{
  const selected=selectRenderToken(session.history.present.score,session.renderRequest,token);
  return makeState(session.rendererFamily,session.history,selected.selection,selected.inspector,Object.freeze({level:'info',code:'SELECTION_CHANGED',message:`Selected ${selected.inspector.targetKind}.`}));
};

export const commitSessionScoreIntent=(session:EditorSessionState,rawIntent:unknown,identity:EditorCommitIdentity):Readonly<EditorSessionState>=>{
  if(session.selection===null)throw new Error('A current semantic selection is required.');
  const base=session.history.present;
  const nextScore=executeEditorScoreIntent(base.score,session.selection,rawIntent,identity);
  const nextNotation=rebindNotationAfterScoreEdit(base.score,base.notation,nextScore);
  const history=commitEditorHistory(session.history,nextScore,nextNotation);
  return makeState(session.rendererFamily,history,null,null,Object.freeze({level:'success',code:'SCORE_EDIT_COMMITTED',message:'Score edit committed.'}));
};

export const commitSessionNotationIntent=(session:EditorSessionState,rawIntent:unknown,identity:NotationIntentCommitIdentity):Readonly<EditorSessionState>=>{
  if(session.selection===null)throw new Error('A current semantic selection is required.');
  const base=session.history.present;
  const result=executeEditorNotationIntent(base.score,base.notation,session.selection,rawIntent,identity);
  const history=commitEditorHistory(session.history,result.score,result.notation);
  return makeState(session.rendererFamily,history,null,null,Object.freeze({level:'success',code:'NOTATION_EDIT_COMMITTED',message:'Notation edit committed.'}));
};

export const navigateSessionHistory=(session:EditorSessionState,action:EditorHistoryAction):Readonly<EditorSessionState>=>{
  const transition=navigateEditorHistory(session.history,session.selection,action);
  return makeState(session.rendererFamily,transition.history,null,null,transition.status);
};
