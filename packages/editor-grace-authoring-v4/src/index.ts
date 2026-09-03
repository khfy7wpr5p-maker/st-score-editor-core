import { createScoreDocumentV3, type ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import type { GraceEvent, GraceGroup, Pitch } from '../../score-model-v2/src/index.js';
import {
  addressEntityV3,
  resolveSemanticAddressV3,
  type EventAddressV3,
  type GraceEventAddressV3,
  type GraceGroupAddressV3,
  type GraceNoteAddressV3,
  type SemanticAddressV3
} from '../../addressing-v3/src/index.js';
import { createNotationDocumentV4, type NotationDocumentV4 } from '../../notation-structure-v4/src/index.js';

export const GRACE_AUTHORING_V4_VERSION = '1.0.0' as const;

export interface GraceAuthoringV4Options { readonly nextRevisionId: string }
export type GraceAuthoringIntentV4 =
  | { readonly version: typeof GRACE_AUTHORING_V4_VERSION; readonly type: 'CREATE_GRACE_GROUP'; readonly target: EventAddressV3; readonly placement: 'before'|'after'; readonly groupId: string; readonly firstEvent: GraceEvent }
  | { readonly version: typeof GRACE_AUTHORING_V4_VERSION; readonly type: 'REMOVE_GRACE_GROUP'; readonly target: GraceGroupAddressV3 }
  | { readonly version: typeof GRACE_AUTHORING_V4_VERSION; readonly type: 'ADD_GRACE_EVENT'; readonly target: GraceGroupAddressV3; readonly index: number; readonly event: GraceEvent }
  | { readonly version: typeof GRACE_AUTHORING_V4_VERSION; readonly type: 'REMOVE_GRACE_EVENT'; readonly target: GraceEventAddressV3 }
  | { readonly version: typeof GRACE_AUTHORING_V4_VERSION; readonly type: 'MOVE_GRACE_EVENT'; readonly target: GraceEventAddressV3; readonly toIndex: number }
  | { readonly version: typeof GRACE_AUTHORING_V4_VERSION; readonly type: 'REPLACE_GRACE_EVENT'; readonly target: GraceEventAddressV3; readonly replacement: GraceEvent }
  | { readonly version: typeof GRACE_AUTHORING_V4_VERSION; readonly type: 'SET_GRACE_NOTE_PITCH'; readonly target: GraceNoteAddressV3; readonly pitch: Pitch };

export interface GraceAuthoringV4Result { readonly score: Readonly<ScoreDocumentV3>; readonly notation: Readonly<NotationDocumentV4>; readonly selection: SemanticAddressV3 }
export type GraceAuthoringV4ErrorCode = 'INVALID_INTENT'|'STALE_TARGET'|'INVALID_REVISION_ID'|'GROUP_ALREADY_EXISTS'|'INDEX_OUT_OF_RANGE'|'EMPTY_GROUP_FORBIDDEN'|'REPLACEMENT_ID_MISMATCH'|'NOTATION_ORPHAN_RISK'|'RESULT_INVALID';
export class GraceAuthoringV4Error extends Error {
  readonly code: GraceAuthoringV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message:string, code:GraceAuthoringV4ErrorCode, details:Record<string,unknown>={}) { super(message); this.name='GraceAuthoringV4Error'; this.code=code; this.details=Object.freeze({...details}); Object.freeze(this); }
}

const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const rec=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:unknown,keys:readonly string[]):v is Record<string,unknown>=>rec(v)&&JSON.stringify(Object.keys(v).sort())===JSON.stringify([...keys].sort());
const assertRevision=(score:ScoreDocumentV3,id:string):void=>{if(!ID.test(id)||id===score.revision.id)throw new GraceAuthoringV4Error('A fresh stable next revision id is required.','INVALID_REVISION_ID');};
const parseIntent=(raw:unknown):GraceAuthoringIntentV4=>{
  if(!rec(raw)||raw.version!==GRACE_AUTHORING_V4_VERSION||typeof raw.type!=='string')throw new GraceAuthoringV4Error('Grace intent envelope is invalid.','INVALID_INTENT');
  const fields:Record<string,readonly string[]>={CREATE_GRACE_GROUP:['version','type','target','placement','groupId','firstEvent'],REMOVE_GRACE_GROUP:['version','type','target'],ADD_GRACE_EVENT:['version','type','target','index','event'],REMOVE_GRACE_EVENT:['version','type','target'],MOVE_GRACE_EVENT:['version','type','target','toIndex'],REPLACE_GRACE_EVENT:['version','type','target','replacement'],SET_GRACE_NOTE_PITCH:['version','type','target','pitch']};
  const expected=fields[raw.type]; if(expected===undefined||!exact(raw,expected))throw new GraceAuthoringV4Error('Grace intent field set is invalid.','INVALID_INTENT');
  return raw as unknown as GraceAuthoringIntentV4;
};
const resolve=<K extends 'event'|'grace-group'|'grace-event'|'grace-note'>(score:ScoreDocumentV3,address:SemanticAddressV3,kind:K):Extract<ReturnType<typeof resolveSemanticAddressV3>,{kind:K}>=>{
  try { const r=resolveSemanticAddressV3(score,address); if(r.kind!==kind)throw new GraceAuthoringV4Error('Grace target kind does not match intent.','INVALID_INTENT',{expected:kind,observed:r.kind}); return r as Extract<ReturnType<typeof resolveSemanticAddressV3>,{kind:K}>; }
  catch(error){ if(error instanceof GraceAuthoringV4Error)throw error; throw new GraceAuthoringV4Error('Grace target is stale or invalid.','STALE_TARGET',{cause:error instanceof Error?error.message:String(error)}); }
};
const targetId=(a:SemanticAddressV3):string=>{switch(a.kind){case'document':return a.documentId;case'measure-frame':return a.frameId;case'part':return a.partId;case'staff':return a.staffId;case'measure':return a.measureId;case'voice':return a.voiceId;case'event':return a.eventId;case'note':return a.noteId;case'grace-group':return a.graceGroupId;case'grace-event':return a.graceEventId;case'grace-note':return a.graceNoteId;}};
const rebind=(score:ScoreDocumentV3,a:SemanticAddressV3):SemanticAddressV3=>{try{const n=addressEntityV3(score,targetId(a));if(n.kind!==a.kind)throw new Error('kind changed');return n;}catch(error){throw new GraceAuthoringV4Error('Grace edit would orphan current notation.','NOTATION_ORPHAN_RISK',{targetKind:a.kind,targetId:targetId(a),cause:error instanceof Error?error.message:String(error)});}};
const rebindNotation=(score:ScoreDocumentV3,n:NotationDocumentV4):Readonly<NotationDocumentV4>=>createNotationDocumentV4(score,{contractVersion:'4.0.0',documentId:score.id,revisionId:score.revision.id,frames:n.frames.map(e=>({target:rebind(score,e.target) as typeof e.target,notation:e.notation})),measures:n.measures.map(e=>({target:rebind(score,e.target) as typeof e.target,notation:e.notation})),events:n.events.map(e=>({target:rebind(score,e.target) as typeof e.target,notation:e.notation})),notes:n.notes.map(e=>({target:rebind(score,e.target) as typeof e.target,notation:e.notation})),graceEvents:n.graceEvents.map(e=>({target:rebind(score,e.target) as typeof e.target,notation:e.notation})),graceNotes:n.graceNotes.map(e=>({target:rebind(score,e.target) as typeof e.target,notation:e.notation})),crossStaffPlacements:n.crossStaffPlacements.map(p=>({source:rebind(score,p.source) as EventAddressV3,displayStaffId:p.displayStaffId}))});

const mutableVoice=(candidate:ScoreDocumentV3,target:EventAddressV3|GraceGroupAddressV3|GraceEventAddressV3|GraceNoteAddressV3)=>{
  const part=candidate.parts.find(p=>p.id===target.partId); const staff=part?.staves.find(s=>s.id===target.staffId); if(!staff||staff.role==='tablature-linked')throw new GraceAuthoringV4Error('Grace target ancestry is invalid.','STALE_TARGET'); const measure=staff.measures.find(m=>m.id===target.measureId); const voice=measure?.voices.find(v=>v.id===target.voiceId); if(!voice)throw new GraceAuthoringV4Error('Grace target voice is invalid.','STALE_TARGET'); return voice as {id:string;ordinal:number;events:readonly unknown[];graceGroups:GraceGroup[]};
};
const group=(voice:{graceGroups:GraceGroup[]},id:string):GraceGroup=>{const g=voice.graceGroups.find(x=>x.id===id);if(!g)throw new GraceAuthoringV4Error('Grace group disappeared.','STALE_TARGET');return g;};
const allGraceNotationIds=(n:NotationDocumentV4):Set<string>=>new Set([...n.graceEvents.map(e=>e.target.graceEventId),...n.graceNotes.map(e=>e.target.graceNoteId)]);
const eventNoteIds=(event:GraceEvent):readonly string[]=>event.kind==='note'?[event.note.id]:event.kind==='chord'?event.notes.map(n=>n.id):[];
const groupEntityIds=(g:GraceGroup):readonly string[]=>[g.id,...g.events.flatMap(e=>[e.id,...eventNoteIds(e)])];

export const executeGraceAuthoringV4=(scoreInput:ScoreDocumentV3,notationInput:NotationDocumentV4,rawIntent:unknown,options:GraceAuthoringV4Options):Readonly<GraceAuthoringV4Result>=>{
  const score=createScoreDocumentV3(scoreInput); const notation=createNotationDocumentV4(score,notationInput); const intent=parseIntent(rawIntent); assertRevision(score,options.nextRevisionId);
  if(intent.type==='CREATE_GRACE_GROUP')resolve(score,intent.target,'event');
  else if(intent.type==='REMOVE_GRACE_GROUP'||intent.type==='ADD_GRACE_EVENT')resolve(score,intent.target,'grace-group');
  else if(intent.type==='REMOVE_GRACE_EVENT'||intent.type==='MOVE_GRACE_EVENT'||intent.type==='REPLACE_GRACE_EVENT')resolve(score,intent.target,'grace-event');
  else resolve(score,intent.target,'grace-note');
  const candidate=structuredClone(score) as ScoreDocumentV3; const nids=allGraceNotationIds(notation); let selectionId:string;
  const voice=mutableVoice(candidate,intent.target);
  if(intent.type==='CREATE_GRACE_GROUP'){
    if(voice.graceGroups.some(g=>g.anchorEventId===intent.target.eventId&&g.placement===intent.placement))throw new GraceAuthoringV4Error('Grace group already exists for anchor/placement.','GROUP_ALREADY_EXISTS');
    voice.graceGroups=[...voice.graceGroups,{id:intent.groupId,anchorEventId:intent.target.eventId,placement:intent.placement,events:[structuredClone(intent.firstEvent)]}]; selectionId=intent.groupId;
  }else if(intent.type==='REMOVE_GRACE_GROUP'){
    const g=group(voice,intent.target.graceGroupId); const orphans=groupEntityIds(g).filter(id=>nids.has(id)); if(orphans.length)throw new GraceAuthoringV4Error('Removing grace group would orphan notation.','NOTATION_ORPHAN_RISK',{ids:orphans}); voice.graceGroups=voice.graceGroups.filter(x=>x.id!==g.id); selectionId=g.anchorEventId;
  }else if(intent.type==='ADD_GRACE_EVENT'){
    const g=group(voice,intent.target.graceGroupId); if(!Number.isSafeInteger(intent.index)||intent.index<0||intent.index>g.events.length)throw new GraceAuthoringV4Error('Grace event insertion index is out of range.','INDEX_OUT_OF_RANGE',{index:intent.index}); const events=[...g.events];events.splice(intent.index,0,structuredClone(intent.event)); (g as {events:readonly GraceEvent[]}).events=events; selectionId=intent.event.id;
  }else if(intent.type==='REMOVE_GRACE_EVENT'){
    const g=group(voice,intent.target.graceGroupId); if(g.events.length===1)throw new GraceAuthoringV4Error('Final grace event cannot be removed without removing group.','EMPTY_GROUP_FORBIDDEN'); const e=g.events.find(x=>x.id===intent.target.graceEventId)!; const orphans=[e.id,...eventNoteIds(e)].filter(id=>nids.has(id));if(orphans.length)throw new GraceAuthoringV4Error('Removing grace event would orphan notation.','NOTATION_ORPHAN_RISK',{ids:orphans}); (g as {events:readonly GraceEvent[]}).events=g.events.filter(x=>x.id!==e.id); selectionId=g.id;
  }else if(intent.type==='MOVE_GRACE_EVENT'){
    const g=group(voice,intent.target.graceGroupId); const from=g.events.findIndex(x=>x.id===intent.target.graceEventId); if(!Number.isSafeInteger(intent.toIndex)||intent.toIndex<0||intent.toIndex>=g.events.length)throw new GraceAuthoringV4Error('Grace move index is out of range.','INDEX_OUT_OF_RANGE',{toIndex:intent.toIndex}); const events=[...g.events];const [e]=events.splice(from,1);events.splice(intent.toIndex,0,e!);(g as {events:readonly GraceEvent[]}).events=events;selectionId=intent.target.graceEventId;
  }else if(intent.type==='REPLACE_GRACE_EVENT'){
    if(intent.replacement.id!==intent.target.graceEventId)throw new GraceAuthoringV4Error('Replacement grace event must preserve event id.','REPLACEMENT_ID_MISMATCH'); const g=group(voice,intent.target.graceGroupId); const idx=g.events.findIndex(x=>x.id===intent.target.graceEventId);const old=g.events[idx]!;const removed=eventNoteIds(old).filter(id=>!eventNoteIds(intent.replacement).includes(id)&&nids.has(id));if(removed.length)throw new GraceAuthoringV4Error('Replacement would orphan grace-note notation.','NOTATION_ORPHAN_RISK',{ids:removed});const events=[...g.events];events[idx]=structuredClone(intent.replacement);(g as {events:readonly GraceEvent[]}).events=events;selectionId=intent.replacement.id;
  }else{
    const g=group(voice,intent.target.graceGroupId); const e=g.events.find(x=>x.id===intent.target.graceEventId)!; if(e.kind==='rest')throw new GraceAuthoringV4Error('Grace rest has no note pitch.','INVALID_INTENT'); if(e.kind==='note'){if(e.note.id!==intent.target.graceNoteId)throw new GraceAuthoringV4Error('Grace note target no longer matches event.','STALE_TARGET');(e as {note:{id:string;pitch:Pitch}}).note={...e.note,pitch:intent.pitch};}else{(e as {notes:readonly {id:string;pitch:Pitch}[]}).notes=e.notes.map(n=>n.id===intent.target.graceNoteId?{...n,pitch:intent.pitch}:n);} selectionId=intent.target.graceNoteId;
  }
  (candidate as {revision:{id:string;parentId:string|null}}).revision={id:options.nextRevisionId,parentId:score.revision.id};
  let nextScore:Readonly<ScoreDocumentV3>;try{nextScore=createScoreDocumentV3(candidate);}catch(error){throw new GraceAuthoringV4Error('Grace edit failed canonical V3 validation.','RESULT_INVALID',{cause:error instanceof Error?error.message:String(error)});}
  let nextNotation:Readonly<NotationDocumentV4>;try{nextNotation=rebindNotation(nextScore,notation);}catch(error){if(error instanceof GraceAuthoringV4Error)throw error;throw new GraceAuthoringV4Error('Grace edit failed V4 notation validation.','RESULT_INVALID',{cause:error instanceof Error?error.message:String(error)});}
  return Object.freeze({score:nextScore,notation:nextNotation,selection:addressEntityV3(nextScore,selectionId)});
};
