import { createScoreDocumentV2, type ScoreDocumentV2 } from '../../score-model-v2/src/index.js';
import {
  addressEntityV2,
  resolveSemanticAddressV2,
  type EventAddressV2,
  type GraceEventAddressV2
} from '../../addressing-v2/src/index.js';
import {
  createNotationDocumentV2,
  type ArticulationSpec,
  type EventNotationV2,
  type GraceEventNotationV2,
  type NotationDocumentV2
} from '../../notation-structure-v2/src/index.js';

export const ARTICULATION_AUTHORING_V2_VERSION = '1.0.0' as const;

export interface ArticulationAuthoringIdentityV2 { readonly nextRevisionId: string }
export type ArticulationTargetV2 = EventAddressV2 | GraceEventAddressV2;
export type ArticulationAuthoringIntentV2 =
  | { readonly version: typeof ARTICULATION_AUTHORING_V2_VERSION; readonly type: 'SET_ARTICULATIONS'; readonly target: ArticulationTargetV2; readonly value: readonly ArticulationSpec[] }
  | { readonly version: typeof ARTICULATION_AUTHORING_V2_VERSION; readonly type: 'TOGGLE_ARTICULATION'; readonly target: ArticulationTargetV2; readonly value: ArticulationSpec }
  | { readonly version: typeof ARTICULATION_AUTHORING_V2_VERSION; readonly type: 'REMOVE_ARTICULATION'; readonly target: ArticulationTargetV2; readonly value: ArticulationSpec };

export interface ArticulationAuthoringResultV2 { readonly score: Readonly<ScoreDocumentV2>; readonly notation: Readonly<NotationDocumentV2>; readonly selectionEntityId: string }
export type ArticulationAuthoringV2ErrorCode = 'INVALID_INTENT'|'STALE_TARGET'|'INVALID_REVISION_ID'|'RESULT_INVALID';
export class ArticulationAuthoringV2Error extends Error { readonly code:ArticulationAuthoringV2ErrorCode; readonly details:Readonly<Record<string,unknown>>; constructor(message:string,code:ArticulationAuthoringV2ErrorCode,details:Record<string,unknown>={}){super(message);this.name='ArticulationAuthoringV2Error';this.code=code;this.details=Object.freeze({...details});Object.freeze(this);} }

const ID_PATTERN=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const rec=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact=(value:unknown,keys:readonly string[]):value is Record<string,unknown>=>rec(value)&&JSON.stringify(Object.keys(value).sort())===JSON.stringify([...keys].sort());
const same=(left:ArticulationSpec,right:ArticulationSpec):boolean=>JSON.stringify(left)===JSON.stringify(right);
const parseIntent=(raw:unknown):ArticulationAuthoringIntentV2=>{
  if(!rec(raw)||raw.version!==ARTICULATION_AUTHORING_V2_VERSION||typeof raw.type!=='string')throw new ArticulationAuthoringV2Error('Articulation intent envelope is invalid.','INVALID_INTENT');
  const keys=raw.type==='SET_ARTICULATIONS'?['version','type','target','value']:raw.type==='TOGGLE_ARTICULATION'||raw.type==='REMOVE_ARTICULATION'?['version','type','target','value']:null;
  if(keys===null||!exact(raw,keys))throw new ArticulationAuthoringV2Error('Articulation intent field set is invalid.','INVALID_INTENT');
  return raw as unknown as ArticulationAuthoringIntentV2;
};
const assertIdentity=(score:ScoreDocumentV2,identity:ArticulationAuthoringIdentityV2):void=>{if(!exact(identity,['nextRevisionId'])||typeof identity.nextRevisionId!=='string'||!ID_PATTERN.test(identity.nextRevisionId)||identity.nextRevisionId===score.revision.id)throw new ArticulationAuthoringV2Error('A fresh stable next revision id is required.','INVALID_REVISION_ID');};
const validateTarget=(score:ScoreDocumentV2,target:ArticulationTargetV2):void=>{try{const resolved=resolveSemanticAddressV2(score,target);if(resolved.kind!=='event'&&resolved.kind!=='grace-event')throw new Error(`observed ${resolved.kind}`);}catch(error){throw new ArticulationAuthoringV2Error('Articulation target is stale or invalid.','STALE_TARGET',{cause:error instanceof Error?error.message:String(error)});}};
const defaultEvent=():EventNotationV2=>({dots:0,beams:[],tuplet:null,articulations:[],ornaments:[]});
const defaultGraceEvent=():GraceEventNotationV2=>({slash:false,dots:0,beams:[],articulations:[],ornaments:[]});
const nextList=(current:readonly ArticulationSpec[],intent:ArticulationAuthoringIntentV2):readonly ArticulationSpec[]=>{if(intent.type==='SET_ARTICULATIONS')return [...intent.value];if(intent.type==='TOGGLE_ARTICULATION'){const index=current.findIndex(item=>same(item,intent.value));return index>=0?current.filter((_,i)=>i!==index):[...current,intent.value];}return current.filter(item=>!same(item,intent.value));};

export const executeArticulationAuthoringV2=(scoreInput:ScoreDocumentV2,notationInput:NotationDocumentV2,rawIntent:unknown,identity:ArticulationAuthoringIdentityV2):Readonly<ArticulationAuthoringResultV2>=>{
  const score=createScoreDocumentV2(scoreInput);const notation=createNotationDocumentV2(score,notationInput);const intent=parseIntent(rawIntent);assertIdentity(score,identity);validateTarget(score,intent.target);
  const nextScore=createScoreDocumentV2({...score,revision:{id:identity.nextRevisionId,parentId:score.revision.id}});
  const normal=new Map(notation.events.map(entry=>[entry.target.eventId,entry.notation]));
  const grace=new Map(notation.graceEvents.map(entry=>[entry.target.graceEventId,entry.notation]));
  if(intent.target.kind==='event'){const current=normal.get(intent.target.eventId)??defaultEvent();normal.set(intent.target.eventId,{...current,articulations:nextList(current.articulations,intent)});}else{const current=grace.get(intent.target.graceEventId)??defaultGraceEvent();grace.set(intent.target.graceEventId,{...current,articulations:nextList(current.articulations,intent)});}
  try{
    const nextNotation=createNotationDocumentV2(nextScore,{contractVersion:'2.0.0',documentId:nextScore.id,revisionId:nextScore.revision.id,
      measures:notation.measures.map(entry=>({target:addressEntityV2(nextScore,entry.target.measureId),notation:entry.notation})) as never,
      events:[...normal].map(([id,value])=>({target:addressEntityV2(nextScore,id),notation:value})) as never,
      notes:notation.notes.map(entry=>({target:addressEntityV2(nextScore,entry.target.noteId),notation:entry.notation})) as never,
      graceEvents:[...grace].map(([id,value])=>({target:addressEntityV2(nextScore,id),notation:value})) as never,
      graceNotes:notation.graceNotes.map(entry=>({target:addressEntityV2(nextScore,entry.target.graceNoteId),notation:entry.notation})) as never});
    return Object.freeze({score:nextScore,notation:nextNotation,selectionEntityId:intent.target.kind==='event'?intent.target.eventId:intent.target.graceEventId});
  }catch(error){throw new ArticulationAuthoringV2Error('Articulation authoring result failed v2 notation validation.','RESULT_INVALID',{cause:error instanceof Error?error.message:String(error)});}
};
