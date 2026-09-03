import { createScoreDocumentV3, type ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import {
  addressEntityV3,
  resolveSemanticAddressV3,
  type EventAddressV3,
  type GraceEventAddressV3,
  type SemanticAddressV3
} from '../../addressing-v3/src/index.js';
import {
  createNotationDocumentV4,
  type NotationDocumentV4
} from '../../notation-structure-v4/src/index.js';
import type { ArticulationSpec, EventNotationV2, GraceEventNotationV2 } from '../../notation-structure-v2/src/index.js';

export const ARTICULATION_AUTHORING_V4_VERSION='1.0.0' as const;
export interface ArticulationAuthoringV4Options { readonly nextRevisionId:string }
export type ArticulationTargetV4=EventAddressV3|GraceEventAddressV3;
export type ArticulationAuthoringIntentV4=
  | { readonly version:typeof ARTICULATION_AUTHORING_V4_VERSION; readonly type:'SET_ARTICULATIONS'; readonly target:ArticulationTargetV4; readonly value:readonly ArticulationSpec[] }
  | { readonly version:typeof ARTICULATION_AUTHORING_V4_VERSION; readonly type:'TOGGLE_ARTICULATION'; readonly target:ArticulationTargetV4; readonly value:ArticulationSpec }
  | { readonly version:typeof ARTICULATION_AUTHORING_V4_VERSION; readonly type:'REMOVE_ARTICULATION'; readonly target:ArticulationTargetV4; readonly value:ArticulationSpec };
export interface ArticulationAuthoringV4Result { readonly score:Readonly<ScoreDocumentV3>; readonly notation:Readonly<NotationDocumentV4>; readonly selection:SemanticAddressV3 }
export type ArticulationAuthoringV4ErrorCode='INVALID_INTENT'|'STALE_TARGET'|'INVALID_REVISION_ID'|'RESULT_INVALID';
export class ArticulationAuthoringV4Error extends Error { readonly code:ArticulationAuthoringV4ErrorCode; readonly details:Readonly<Record<string,unknown>>; constructor(message:string,code:ArticulationAuthoringV4ErrorCode,details:Record<string,unknown>={}){super(message);this.name='ArticulationAuthoringV4Error';this.code=code;this.details=Object.freeze({...details});Object.freeze(this);} }

const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const rec=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:unknown,k:readonly string[]):v is Record<string,unknown>=>rec(v)&&JSON.stringify(Object.keys(v).sort())===JSON.stringify([...k].sort());
const same=(a:ArticulationSpec,b:ArticulationSpec):boolean=>JSON.stringify(a)===JSON.stringify(b);
const parse=(raw:unknown):ArticulationAuthoringIntentV4=>{if(!rec(raw)||raw.version!==ARTICULATION_AUTHORING_V4_VERSION||typeof raw.type!=='string'||!exact(raw,['version','type','target','value'])||!['SET_ARTICULATIONS','TOGGLE_ARTICULATION','REMOVE_ARTICULATION'].includes(raw.type))throw new ArticulationAuthoringV4Error('Articulation intent is invalid.','INVALID_INTENT');return raw as unknown as ArticulationAuthoringIntentV4;};
const validateTarget=(score:ScoreDocumentV3,target:ArticulationTargetV4):void=>{try{const r=resolveSemanticAddressV3(score,target);if(r.kind!=='event'&&r.kind!=='grace-event')throw new Error(`observed ${r.kind}`);}catch(error){throw new ArticulationAuthoringV4Error('Articulation target is stale or invalid.','STALE_TARGET',{cause:error instanceof Error?error.message:String(error)});}};
const targetId=(a:SemanticAddressV3):string=>{switch(a.kind){case'document':return a.documentId;case'measure-frame':return a.frameId;case'part':return a.partId;case'staff':return a.staffId;case'measure':return a.measureId;case'voice':return a.voiceId;case'event':return a.eventId;case'note':return a.noteId;case'grace-group':return a.graceGroupId;case'grace-event':return a.graceEventId;case'grace-note':return a.graceNoteId;}};
const rebind=(score:ScoreDocumentV3,a:SemanticAddressV3):SemanticAddressV3=>addressEntityV3(score,targetId(a));
const defaultEvent=():EventNotationV2=>({dots:0,beams:[],tuplet:null,articulations:[],ornaments:[]});
const defaultGrace=():GraceEventNotationV2=>({slash:false,dots:0,beams:[],articulations:[],ornaments:[]});
const next=(current:readonly ArticulationSpec[],intent:ArticulationAuthoringIntentV4):readonly ArticulationSpec[]=>{if(intent.type==='SET_ARTICULATIONS')return [...intent.value];const index=current.findIndex(x=>same(x,intent.value));if(intent.type==='TOGGLE_ARTICULATION')return index>=0?current.filter((_,i)=>i!==index):[...current,intent.value];return current.filter(x=>!same(x,intent.value));};

export const executeArticulationAuthoringV4=(scoreInput:ScoreDocumentV3,notationInput:NotationDocumentV4,rawIntent:unknown,options:ArticulationAuthoringV4Options):Readonly<ArticulationAuthoringV4Result>=>{
  const score=createScoreDocumentV3(scoreInput);const notation=createNotationDocumentV4(score,notationInput);const intent=parse(rawIntent);if(!ID.test(options.nextRevisionId)||options.nextRevisionId===score.revision.id)throw new ArticulationAuthoringV4Error('A fresh stable next revision id is required.','INVALID_REVISION_ID');validateTarget(score,intent.target);
  const candidate=structuredClone(score) as ScoreDocumentV3;(candidate as {revision:{id:string;parentId:string|null}}).revision={id:options.nextRevisionId,parentId:score.revision.id};const nextScore=createScoreDocumentV3(candidate);
  const events=new Map(notation.events.map(e=>[e.target.eventId,e.notation]));const grace=new Map(notation.graceEvents.map(e=>[e.target.graceEventId,e.notation]));
  const id=intent.target.kind==='event'?intent.target.eventId:intent.target.graceEventId;
  if(intent.target.kind==='event'){const current=events.get(id)??defaultEvent();events.set(id,{...current,articulations:next(current.articulations,intent)});}else{const current=grace.get(id)??defaultGrace();grace.set(id,{...current,articulations:next(current.articulations,intent)});}
  try{
    const nextNotation=createNotationDocumentV4(nextScore,{contractVersion:'4.0.0',documentId:nextScore.id,revisionId:nextScore.revision.id,frames:notation.frames.map(e=>({target:rebind(nextScore,e.target) as typeof e.target,notation:e.notation})),measures:notation.measures.map(e=>({target:rebind(nextScore,e.target) as typeof e.target,notation:e.notation})),events:[...events].map(([entityId,value])=>({target:addressEntityV3(nextScore,entityId) as EventAddressV3,notation:value})),notes:notation.notes.map(e=>({target:rebind(nextScore,e.target) as typeof e.target,notation:e.notation})),graceEvents:[...grace].map(([entityId,value])=>({target:addressEntityV3(nextScore,entityId) as GraceEventAddressV3,notation:value})),graceNotes:notation.graceNotes.map(e=>({target:rebind(nextScore,e.target) as typeof e.target,notation:e.notation})),crossStaffPlacements:notation.crossStaffPlacements.map(p=>({source:rebind(nextScore,p.source) as EventAddressV3,displayStaffId:p.displayStaffId}))});
    return Object.freeze({score:nextScore,notation:nextNotation,selection:addressEntityV3(nextScore,id)});
  }catch(error){throw new ArticulationAuthoringV4Error('Articulation result failed V4 validation.','RESULT_INVALID',{cause:error instanceof Error?error.message:String(error)});}
};
