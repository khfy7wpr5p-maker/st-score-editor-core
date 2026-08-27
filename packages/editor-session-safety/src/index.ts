import type { SelectionSnapshot } from '../../addressing/src/index.js';
import type { EditorStatus } from '../../editor-ui-contract/src/index.js';
import { redoEditorHistory, undoEditorHistory } from '../../editor-history/src/index.js';
import type { EditorHistoryState } from '../../editor-history/src/index.js';

export const EDITOR_SESSION_SAFETY_VERSION='1.0.0' as const;
export type EditorHistoryAction='UNDO'|'REDO';

export interface EditorHistoryTransition {
  readonly version:typeof EDITOR_SESSION_SAFETY_VERSION;
  readonly history:Readonly<EditorHistoryState>;
  readonly selection:null;
  readonly status:Readonly<EditorStatus>;
}
export interface PersistenceIndicator {
  readonly currentRevisionId:string;
  readonly persistedRevisionId:string|null;
  readonly dirty:boolean;
  readonly persistenceAuthority:false;
}

export const navigateEditorHistory=(history:EditorHistoryState,_selection:SelectionSnapshot|null,action:EditorHistoryAction):Readonly<EditorHistoryTransition>=>{
  const next=action==='UNDO'?undoEditorHistory(history):redoEditorHistory(history);
  return Object.freeze({
    version:EDITOR_SESSION_SAFETY_VERSION,
    history:next,
    selection:null,
    status:Object.freeze({level:'success',code:action==='UNDO'?'UNDO_APPLIED':'REDO_APPLIED',message:action==='UNDO'?'Previous revision restored.':'Later revision restored.'})
  });
};

export const createPersistenceIndicator=(history:EditorHistoryState,persistedRevisionId:string|null):Readonly<PersistenceIndicator>=>Object.freeze({
  currentRevisionId:history.present.score.revision.id,
  persistedRevisionId,
  dirty:persistedRevisionId===null||persistedRevisionId!==history.present.score.revision.id,
  persistenceAuthority:false
});

export const editorStatusFromError=(error:unknown):Readonly<EditorStatus>=>{
  const record:{code?:unknown;message?:unknown}=error!==null&&typeof error==='object'?error as {code?:unknown;message?:unknown}:{};
  const code=typeof record.code==='string'&&record.code.length<=64?record.code:'EDITOR_OPERATION_FAILED';
  const message=typeof record.message==='string'&&record.message.length>0&&record.message.length<=240?record.message:'The editor operation was rejected.';
  return Object.freeze({level:'error',code,message});
};
