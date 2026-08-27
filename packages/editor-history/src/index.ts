import type { ScoreDocument } from '../../score-model/src/index.js';
import { addressEntity } from '../../addressing/src/index.js';
import type { EventAddress, MeasureAddress, NoteAddress } from '../../addressing/src/index.js';
import { createNotationDocument } from '../../notation-structure/src/index.js';
import type { NotationDocument } from '../../notation-structure/src/index.js';

export const EDITOR_HISTORY_VERSION='1.0.0' as const;

export interface EditorRevisionSnapshot {
  readonly score:Readonly<ScoreDocument>;
  readonly notation:Readonly<NotationDocument>;
}
export interface EditorHistoryState {
  readonly contractVersion:typeof EDITOR_HISTORY_VERSION;
  readonly documentId:string;
  readonly past:readonly EditorRevisionSnapshot[];
  readonly present:EditorRevisionSnapshot;
  readonly future:readonly EditorRevisionSnapshot[];
}
export type EditorHistoryErrorCode='SNAPSHOT_MISMATCH'|'DOCUMENT_MISMATCH'|'LINEAGE_MISMATCH'|'HISTORY_BOUNDARY'|'NOTATION_TARGET_DISAPPEARED';
export class EditorHistoryError extends Error {
  readonly code:EditorHistoryErrorCode;
  readonly details:Readonly<Record<string,unknown>>;
  constructor(message:string,code:EditorHistoryErrorCode,details:Record<string,unknown>={}){super(message);this.name='EditorHistoryError';this.code=code;this.details=Object.freeze({...details});Object.freeze(this);}
}

const assertSnapshot=(snapshot:EditorRevisionSnapshot):void=>{
  if(snapshot.score.id!==snapshot.notation.documentId||snapshot.score.revision.id!==snapshot.notation.revisionId){
    throw new EditorHistoryError('Score and notation must share one document/revision identity.','SNAPSHOT_MISMATCH',{scoreDocumentId:snapshot.score.id,scoreRevisionId:snapshot.score.revision.id,notationDocumentId:snapshot.notation.documentId,notationRevisionId:snapshot.notation.revisionId});
  }
};
const frozenSnapshot=(snapshot:EditorRevisionSnapshot):Readonly<EditorRevisionSnapshot>=>{assertSnapshot(snapshot);return Object.freeze({score:snapshot.score,notation:snapshot.notation});};
const freezeHistory=(state:EditorHistoryState):Readonly<EditorHistoryState>=>Object.freeze({...state,past:Object.freeze([...state.past]),future:Object.freeze([...state.future]),present:frozenSnapshot(state.present)});

export const createEditorHistory=(score:Readonly<ScoreDocument>,notation:Readonly<NotationDocument>):Readonly<EditorHistoryState>=>freezeHistory({contractVersion:EDITOR_HISTORY_VERSION,documentId:score.id,past:[],present:{score,notation},future:[]});

export const commitEditorHistory=(history:EditorHistoryState,score:Readonly<ScoreDocument>,notation:Readonly<NotationDocument>):Readonly<EditorHistoryState>=>{
  const next=frozenSnapshot({score,notation});
  if(score.id!==history.documentId)throw new EditorHistoryError('Cannot commit another document into editor history.','DOCUMENT_MISMATCH');
  if(score.revision.parentId!==history.present.score.revision.id)throw new EditorHistoryError('Next editor revision is not a direct child of present.','LINEAGE_MISMATCH',{expectedParent:history.present.score.revision.id,observedParent:score.revision.parentId});
  return freezeHistory({contractVersion:EDITOR_HISTORY_VERSION,documentId:history.documentId,past:[...history.past,history.present],present:next,future:[]});
};

export const undoEditorHistory=(history:EditorHistoryState):Readonly<EditorHistoryState>=>{
  const previous=history.past.at(-1);if(previous===undefined)throw new EditorHistoryError('No earlier editor revision is available.','HISTORY_BOUNDARY');
  return freezeHistory({contractVersion:EDITOR_HISTORY_VERSION,documentId:history.documentId,past:history.past.slice(0,-1),present:previous,future:[history.present,...history.future]});
};
export const redoEditorHistory=(history:EditorHistoryState):Readonly<EditorHistoryState>=>{
  const next=history.future[0];if(next===undefined)throw new EditorHistoryError('No later editor revision is available.','HISTORY_BOUNDARY');
  if(next.score.revision.parentId!==history.present.score.revision.id)throw new EditorHistoryError('Redo lineage no longer matches present.','LINEAGE_MISMATCH');
  return freezeHistory({contractVersion:EDITOR_HISTORY_VERSION,documentId:history.documentId,past:[...history.past,history.present],present:next,future:history.future.slice(1)});
};

const missingTarget=(id:string,kind:string,error:unknown):never=>{throw new EditorHistoryError('A notation target disappeared or changed kind during score edit.','NOTATION_TARGET_DISAPPEARED',{id,kind,cause:error instanceof Error?error.message:String(error)});};
const rebindMeasure=(score:ScoreDocument,id:string):MeasureAddress=>{try{const a=addressEntity(score,id);if(a.kind!=='measure')return missingTarget(id,'measure',new Error(`observed ${a.kind}`));return a;}catch(error){return missingTarget(id,'measure',error);}};
const rebindEvent=(score:ScoreDocument,id:string):EventAddress=>{try{const a=addressEntity(score,id);if(a.kind!=='event')return missingTarget(id,'event',new Error(`observed ${a.kind}`));return a;}catch(error){return missingTarget(id,'event',error);}};
const rebindNote=(score:ScoreDocument,id:string):NoteAddress=>{try{const a=addressEntity(score,id);if(a.kind!=='note')return missingTarget(id,'note',new Error(`observed ${a.kind}`));return a;}catch(error){return missingTarget(id,'note',error);}};

export const rebindNotationAfterScoreEdit=(
  previousScore:Readonly<ScoreDocument>,
  previousNotation:Readonly<NotationDocument>,
  nextScore:Readonly<ScoreDocument>
):Readonly<NotationDocument>=>{
  assertSnapshot({score:previousScore,notation:previousNotation});
  if(nextScore.id!==previousScore.id||nextScore.revision.parentId!==previousScore.revision.id)throw new EditorHistoryError('Score edit result is not a direct child of the notation base revision.','LINEAGE_MISMATCH');
  return createNotationDocument(nextScore,{
    contractVersion:'1.0.0',documentId:nextScore.id,revisionId:nextScore.revision.id,
    measures:previousNotation.measures.map((entry)=>({target:rebindMeasure(nextScore,entry.target.measureId),notation:entry.notation})),
    events:previousNotation.events.map((entry)=>({target:rebindEvent(nextScore,entry.target.eventId),notation:entry.notation})),
    notes:previousNotation.notes.map((entry)=>({target:rebindNote(nextScore,entry.target.noteId),notation:entry.notation}))
  });
};
