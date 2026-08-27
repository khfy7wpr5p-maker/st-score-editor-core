import type { ScoreDocument } from '../../score-model/src/index.js';
import { addressEntity, resolveSemanticAddress } from '../../addressing/src/index.js';
import type { EventAddress, MeasureAddress, NoteAddress, SelectionSnapshot } from '../../addressing/src/index.js';
import type {
  AccidentalDisplay,
  BarlineSpec,
  BeamSpec,
  BoundaryMark,
  ClefSpec,
  KeySignature,
  NotationDocument,
  TimeSignature,
  TupletSpec
} from '../../notation-structure/src/index.js';
import {
  applyNotationTransaction,
  NOTATION_COMMAND_VERSION,
  NOTATION_TRANSACTION_VERSION
} from '../../notation-commands/src/index.js';
import type { NotationCommand, NotationTransaction, NotationTransactionResult } from '../../notation-commands/src/index.js';

export const EDITOR_NOTATION_INTENT_VERSION = '1.0.0' as const;

export type EditorNotationIntent =
  | { readonly version: typeof EDITOR_NOTATION_INTENT_VERSION; readonly type:'SET_TIME_SIGNATURE'; readonly value:TimeSignature | null }
  | { readonly version: typeof EDITOR_NOTATION_INTENT_VERSION; readonly type:'SET_KEY_SIGNATURE'; readonly value:KeySignature | null }
  | { readonly version: typeof EDITOR_NOTATION_INTENT_VERSION; readonly type:'SET_CLEF'; readonly value:ClefSpec | null }
  | { readonly version: typeof EDITOR_NOTATION_INTENT_VERSION; readonly type:'SET_BARLINES'; readonly value:readonly BarlineSpec[] }
  | { readonly version: typeof EDITOR_NOTATION_INTENT_VERSION; readonly type:'SET_DOTS'; readonly value:number }
  | { readonly version: typeof EDITOR_NOTATION_INTENT_VERSION; readonly type:'SET_BEAMS'; readonly value:readonly BeamSpec[] }
  | { readonly version: typeof EDITOR_NOTATION_INTENT_VERSION; readonly type:'SET_TUPLET'; readonly value:TupletSpec | null }
  | { readonly version: typeof EDITOR_NOTATION_INTENT_VERSION; readonly type:'SET_ACCIDENTAL'; readonly value:AccidentalDisplay | null }
  | { readonly version: typeof EDITOR_NOTATION_INTENT_VERSION; readonly type:'SET_TIES'; readonly value:readonly BoundaryMark[] }
  | { readonly version: typeof EDITOR_NOTATION_INTENT_VERSION; readonly type:'SET_SLURS'; readonly value:readonly BoundaryMark[] };

export interface NotationIntentCommitIdentity {
  readonly transactionId:string;
  readonly commandId:string;
  readonly nextRevisionId:string;
}

export type EditorNotationIntentErrorCode='INVALID_INTENT'|'STALE_SELECTION'|'STALE_NOTATION'|'NO_SELECTION'|'SELECTION_KIND'|'INVALID_COMMIT_IDENTITY';
export class EditorNotationIntentError extends Error {
  readonly code:EditorNotationIntentErrorCode;
  readonly details:Readonly<Record<string,unknown>>;
  constructor(message:string,code:EditorNotationIntentErrorCode,details:Record<string,unknown>={}){super(message);this.name='EditorNotationIntentError';this.code=code;this.details=Object.freeze({...details});Object.freeze(this);}
}

type R=Record<string,unknown>;
const record=(value:unknown,fields:readonly string[],label:string):R=>{
  if(value===null||typeof value!=='object'||Array.isArray(value)) throw new EditorNotationIntentError(`${label} must be an object.`,'INVALID_INTENT');
  const r=value as R; if(JSON.stringify(Object.keys(r).sort())!==JSON.stringify([...fields].sort())) throw new EditorNotationIntentError(`${label} field set is invalid.`,'INVALID_INTENT'); return r;
};
const int=(value:unknown,min:number,max:number,label:string):number=>{if(typeof value!=='number'||!Number.isSafeInteger(value)||value<min||value>max)throw new EditorNotationIntentError(`${label} is outside admitted range.`,'INVALID_INTENT');return value;};
const enumeration=<T extends string>(value:unknown,values:readonly T[],label:string):T=>{if(typeof value!=='string'||!values.includes(value as T))throw new EditorNotationIntentError(`${label} is unsupported.`,'INVALID_INTENT');return value as T;};
const validId=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=128&&value===value.trim();

const boundaryMarks=(value:unknown,label:string):readonly BoundaryMark[]=>{
  if(!Array.isArray(value)||value.length>32)throw new EditorNotationIntentError(`${label} must be a bounded array.`,'INVALID_INTENT');
  const seen=new Set<string>(); return Object.freeze(value.map((raw,index)=>{const r=record(raw,['number','type'],`${label}[${index}]`);const number=int(r.number,1,16,`${label}.number`);const type=enumeration(r.type,['start','stop'] as const,`${label}.type`);const key=`${number}:${type}`;if(seen.has(key))throw new EditorNotationIntentError(`${label} contains a duplicate mark.`,'INVALID_INTENT');seen.add(key);return Object.freeze({number,type});}));
};
const timeSignature=(value:unknown):TimeSignature|null=>{if(value===null)return null;const r=record(value,['beats','beatType'],'TimeSignature');const beats=int(r.beats,1,32,'beats');const beatType=int(r.beatType,1,64,'beatType');if(![1,2,4,8,16,32,64].includes(beatType))throw new EditorNotationIntentError('beatType must be a power-of-two notation denominator.','INVALID_INTENT');return Object.freeze({beats,beatType});};
const keySignature=(value:unknown):KeySignature|null=>{if(value===null)return null;const r=record(value,['fifths'],'KeySignature');return Object.freeze({fifths:int(r.fifths,-7,7,'fifths')});};
const clef=(value:unknown):ClefSpec|null=>{if(value===null)return null;const r=record(value,['sign','line','octaveChange'],'ClefSpec');return Object.freeze({sign:enumeration(r.sign,['G','F','C','percussion','TAB'] as const,'clef sign'),line:int(r.line,1,5,'clef line'),octaveChange:int(r.octaveChange,-2,2,'clef octaveChange')});};
const barlines=(value:unknown):readonly BarlineSpec[]=>{if(!Array.isArray(value)||value.length>2)throw new EditorNotationIntentError('barlines must contain at most two entries.','INVALID_INTENT');const seen=new Set<string>();return Object.freeze(value.map((raw,index)=>{const r=record(raw,['location','style','repeat'],`barline[${index}]`);const location=enumeration(r.location,['left','right'] as const,'barline location');if(seen.has(location))throw new EditorNotationIntentError('duplicate barline location.','INVALID_INTENT');seen.add(location);const style=enumeration(r.style,['regular','light-light','light-heavy','heavy-light','heavy-heavy','dashed','dotted','none'] as const,'barline style');const repeat=r.repeat===null?null:enumeration(r.repeat,['forward','backward'] as const,'barline repeat');return Object.freeze({location,style,repeat});}));};
const beams=(value:unknown):readonly BeamSpec[]=>{if(!Array.isArray(value)||value.length>8)throw new EditorNotationIntentError('beams must be a bounded array.','INVALID_INTENT');const seen=new Set<number>();return Object.freeze(value.map((raw,index)=>{const r=record(raw,['number','value'],`beam[${index}]`);const number=int(r.number,1,8,'beam number');if(seen.has(number))throw new EditorNotationIntentError('duplicate beam number.','INVALID_INTENT');seen.add(number);return Object.freeze({number,value:enumeration(r.value,['begin','continue','end','forward-hook','backward-hook'] as const,'beam value')});}));};
const tuplet=(value:unknown):TupletSpec|null=>{if(value===null)return null;const r=record(value,['actualNotes','normalNotes','marks'],'TupletSpec');return Object.freeze({actualNotes:int(r.actualNotes,1,32,'actualNotes'),normalNotes:int(r.normalNotes,1,32,'normalNotes'),marks:boundaryMarks(r.marks,'tuplet marks')});};

export const parseEditorNotationIntent=(input:unknown):Readonly<EditorNotationIntent>=>{
  const r=record(input,['version','type','value'],'EditorNotationIntent');
  if(r.version!==EDITOR_NOTATION_INTENT_VERSION||typeof r.type!=='string')throw new EditorNotationIntentError('Notation intent version/type is invalid.','INVALID_INTENT');
  let result:EditorNotationIntent;
  switch(r.type){
    case 'SET_TIME_SIGNATURE':result={version:EDITOR_NOTATION_INTENT_VERSION,type:r.type,value:timeSignature(r.value)};break;
    case 'SET_KEY_SIGNATURE':result={version:EDITOR_NOTATION_INTENT_VERSION,type:r.type,value:keySignature(r.value)};break;
    case 'SET_CLEF':result={version:EDITOR_NOTATION_INTENT_VERSION,type:r.type,value:clef(r.value)};break;
    case 'SET_BARLINES':result={version:EDITOR_NOTATION_INTENT_VERSION,type:r.type,value:barlines(r.value)};break;
    case 'SET_DOTS':result={version:EDITOR_NOTATION_INTENT_VERSION,type:r.type,value:int(r.value,0,3,'dots')};break;
    case 'SET_BEAMS':result={version:EDITOR_NOTATION_INTENT_VERSION,type:r.type,value:beams(r.value)};break;
    case 'SET_TUPLET':result={version:EDITOR_NOTATION_INTENT_VERSION,type:r.type,value:tuplet(r.value)};break;
    case 'SET_ACCIDENTAL':result={version:EDITOR_NOTATION_INTENT_VERSION,type:r.type,value:r.value===null?null:enumeration(r.value,['sharp','flat','natural','double-sharp','double-flat'] as const,'accidental')};break;
    case 'SET_TIES':result={version:EDITOR_NOTATION_INTENT_VERSION,type:r.type,value:boundaryMarks(r.value,'ties')};break;
    case 'SET_SLURS':result={version:EDITOR_NOTATION_INTENT_VERSION,type:r.type,value:boundaryMarks(r.value,'slurs')};break;
    default:throw new EditorNotationIntentError('Notation intent type is unsupported.','INVALID_INTENT',{type:r.type});
  }
  return Object.freeze(result);
};

const assertCurrent=(score:ScoreDocument,notation:NotationDocument,selection:SelectionSnapshot):void=>{
  if(selection.documentId!==score.id||selection.revisionId!==score.revision.id)throw new EditorNotationIntentError('Selection is stale or belongs to another score.','STALE_SELECTION');
  if(notation.documentId!==score.id||notation.revisionId!==score.revision.id)throw new EditorNotationIntentError('Notation is stale or belongs to another score.','STALE_NOTATION');
  if(selection.primary===null)throw new EditorNotationIntentError('Notation intent requires a semantic selection.','NO_SELECTION');
  resolveSemanticAddress(score,selection.primary);
};
const measureTarget=(score:ScoreDocument,selection:SelectionSnapshot):MeasureAddress=>{const p=selection.primary;if(p===null)throw new EditorNotationIntentError('Selection required.','NO_SELECTION');if(p.kind==='measure')return p;if(p.kind==='voice'||p.kind==='event'||p.kind==='note'){const a=addressEntity(score,p.measureId);if(a.kind==='measure')return a;}throw new EditorNotationIntentError('Selection cannot deterministically resolve to a measure.','SELECTION_KIND',{kind:p.kind});};
const eventTarget=(score:ScoreDocument,selection:SelectionSnapshot):EventAddress=>{const p=selection.primary;if(p===null)throw new EditorNotationIntentError('Selection required.','NO_SELECTION');if(p.kind==='event')return p;if(p.kind==='note'){const a=addressEntity(score,p.eventId);if(a.kind==='event')return a;}throw new EditorNotationIntentError('Selection cannot deterministically resolve to an event.','SELECTION_KIND',{kind:p.kind});};
const noteTarget=(selection:SelectionSnapshot):NoteAddress=>{const p=selection.primary;if(p?.kind!=='note')throw new EditorNotationIntentError('Notation intent requires a note selection.','SELECTION_KIND',{kind:p?.kind??null});return p;};
const assertIdentity=(identity:NotationIntentCommitIdentity):void=>{if(!validId(identity.transactionId)||!validId(identity.commandId)||!validId(identity.nextRevisionId))throw new EditorNotationIntentError('Notation commit identity is invalid.','INVALID_COMMIT_IDENTITY');};

const commandFor=(score:ScoreDocument,selection:SelectionSnapshot,intent:EditorNotationIntent,commandId:string):NotationCommand=>{
  const base={commandVersion:NOTATION_COMMAND_VERSION,commandId};
  switch(intent.type){
    case 'SET_TIME_SIGNATURE':return {...base,type:intent.type,target:measureTarget(score,selection),value:intent.value};
    case 'SET_KEY_SIGNATURE':return {...base,type:intent.type,target:measureTarget(score,selection),value:intent.value};
    case 'SET_CLEF':return {...base,type:intent.type,target:measureTarget(score,selection),value:intent.value};
    case 'SET_BARLINES':return {...base,type:intent.type,target:measureTarget(score,selection),value:intent.value};
    case 'SET_DOTS':return {...base,type:intent.type,target:eventTarget(score,selection),value:intent.value};
    case 'SET_BEAMS':return {...base,type:intent.type,target:eventTarget(score,selection),value:intent.value};
    case 'SET_TUPLET':return {...base,type:intent.type,target:eventTarget(score,selection),value:intent.value};
    case 'SET_ACCIDENTAL':return {...base,type:intent.type,target:noteTarget(selection),value:intent.value};
    case 'SET_TIES':return {...base,type:intent.type,target:noteTarget(selection),value:intent.value};
    case 'SET_SLURS':return {...base,type:intent.type,target:noteTarget(selection),value:intent.value};
  }
};

export const executeEditorNotationIntent=(score:ScoreDocument,notation:NotationDocument,selection:SelectionSnapshot,rawIntent:unknown,identity:NotationIntentCommitIdentity):Readonly<NotationTransactionResult>=>{
  assertCurrent(score,notation,selection); assertIdentity(identity); const intent=parseEditorNotationIntent(rawIntent); const command=Object.freeze(commandFor(score,selection,intent,identity.commandId));
  const transaction:NotationTransaction=Object.freeze({contractVersion:NOTATION_TRANSACTION_VERSION,transactionId:identity.transactionId,documentId:score.id,baseRevisionId:score.revision.id,nextRevisionId:identity.nextRevisionId,commands:Object.freeze([command])});
  return applyNotationTransaction(score,notation,transaction);
};
