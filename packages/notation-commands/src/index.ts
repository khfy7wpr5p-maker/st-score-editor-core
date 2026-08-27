import { createScoreDocument } from '../../score-model/src/index.js';
import type { ScoreDocument } from '../../score-model/src/index.js';
import { addressEntity, resolveSemanticAddress } from '../../addressing/src/index.js';
import type { EventAddress, MeasureAddress, NoteAddress, SemanticAddress } from '../../addressing/src/index.js';
import {
  createNotationDocument,
  notationForEvent,
  notationForMeasure,
  notationForNote,
  NOTATION_DOCUMENT_VERSION
} from '../../notation-structure/src/index.js';
import type {
  AccidentalDisplay,
  BarlineSpec,
  BeamSpec,
  BoundaryMark,
  ClefSpec,
  EventNotation,
  KeySignature,
  MeasureNotation,
  NotationDocument,
  NoteNotation,
  TimeSignature,
  TupletSpec
} from '../../notation-structure/src/index.js';

export const NOTATION_COMMAND_VERSION = '1.0.0' as const;
export const NOTATION_TRANSACTION_VERSION = '1.0.0' as const;
export const MAX_NOTATION_COMMANDS_PER_TRANSACTION = 256;

export type NotationCommand =
  | { readonly commandVersion: typeof NOTATION_COMMAND_VERSION; readonly commandId: string; readonly type:'SET_TIME_SIGNATURE'; readonly target:MeasureAddress; readonly value:TimeSignature | null }
  | { readonly commandVersion: typeof NOTATION_COMMAND_VERSION; readonly commandId: string; readonly type:'SET_KEY_SIGNATURE'; readonly target:MeasureAddress; readonly value:KeySignature | null }
  | { readonly commandVersion: typeof NOTATION_COMMAND_VERSION; readonly commandId: string; readonly type:'SET_CLEF'; readonly target:MeasureAddress; readonly value:ClefSpec | null }
  | { readonly commandVersion: typeof NOTATION_COMMAND_VERSION; readonly commandId: string; readonly type:'SET_BARLINES'; readonly target:MeasureAddress; readonly value:readonly BarlineSpec[] }
  | { readonly commandVersion: typeof NOTATION_COMMAND_VERSION; readonly commandId: string; readonly type:'SET_DOTS'; readonly target:EventAddress; readonly value:number }
  | { readonly commandVersion: typeof NOTATION_COMMAND_VERSION; readonly commandId: string; readonly type:'SET_BEAMS'; readonly target:EventAddress; readonly value:readonly BeamSpec[] }
  | { readonly commandVersion: typeof NOTATION_COMMAND_VERSION; readonly commandId: string; readonly type:'SET_TUPLET'; readonly target:EventAddress; readonly value:TupletSpec | null }
  | { readonly commandVersion: typeof NOTATION_COMMAND_VERSION; readonly commandId: string; readonly type:'SET_ACCIDENTAL'; readonly target:NoteAddress; readonly value:AccidentalDisplay | null }
  | { readonly commandVersion: typeof NOTATION_COMMAND_VERSION; readonly commandId: string; readonly type:'SET_TIES'; readonly target:NoteAddress; readonly value:readonly BoundaryMark[] }
  | { readonly commandVersion: typeof NOTATION_COMMAND_VERSION; readonly commandId: string; readonly type:'SET_SLURS'; readonly target:NoteAddress; readonly value:readonly BoundaryMark[] };

export interface NotationTransaction {
  readonly contractVersion: typeof NOTATION_TRANSACTION_VERSION;
  readonly transactionId: string;
  readonly documentId: string;
  readonly baseRevisionId: string;
  readonly nextRevisionId: string;
  readonly commands: readonly NotationCommand[];
}

export interface NotationTransactionResult {
  readonly score: Readonly<ScoreDocument>;
  readonly notation: Readonly<NotationDocument>;
}

export type NotationTransactionErrorCode = 'INVALID_TRANSACTION' | 'STALE_TRANSACTION' | 'TARGET_KIND' | 'REVISION_ID_CONFLICT' | 'RESULT_INVALID';
export class NotationTransactionError extends Error {
  readonly code: NotationTransactionErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message:string, code:NotationTransactionErrorCode, details:Record<string,unknown>={}) {
    super(message); this.name='NotationTransactionError'; this.code=code; this.details=Object.freeze({...details}); Object.freeze(this);
  }
}

const validId=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=128&&value===value.trim();
const exact=(value:unknown,fields:readonly string[],label:string):Record<string,unknown>=>{
  if(value===null||typeof value!=='object'||Array.isArray(value)) throw new NotationTransactionError(`${label} must be an object.`,'INVALID_TRANSACTION');
  const record=value as Record<string,unknown>; const observed=Object.keys(record).sort(); const expected=[...fields].sort();
  if(JSON.stringify(observed)!==JSON.stringify(expected)) throw new NotationTransactionError(`${label} field set is invalid.`,'INVALID_TRANSACTION',{observed,expected});
  return record;
};

const commandFields:Readonly<Record<NotationCommand['type'],readonly string[]>>=Object.freeze({
  SET_TIME_SIGNATURE:['commandVersion','commandId','type','target','value'],
  SET_KEY_SIGNATURE:['commandVersion','commandId','type','target','value'],
  SET_CLEF:['commandVersion','commandId','type','target','value'],
  SET_BARLINES:['commandVersion','commandId','type','target','value'],
  SET_DOTS:['commandVersion','commandId','type','target','value'],
  SET_BEAMS:['commandVersion','commandId','type','target','value'],
  SET_TUPLET:['commandVersion','commandId','type','target','value'],
  SET_ACCIDENTAL:['commandVersion','commandId','type','target','value'],
  SET_TIES:['commandVersion','commandId','type','target','value'],
  SET_SLURS:['commandVersion','commandId','type','target','value']
});

const expectedKind=(type:NotationCommand['type']):'measure'|'event'|'note'=>
  type==='SET_TIME_SIGNATURE'||type==='SET_KEY_SIGNATURE'||type==='SET_CLEF'||type==='SET_BARLINES'?'measure':
  type==='SET_DOTS'||type==='SET_BEAMS'||type==='SET_TUPLET'?'event':'note';

const validateTransaction=(score:ScoreDocument, notation:NotationDocument, transaction:NotationTransaction):void=>{
  exact(transaction,['contractVersion','transactionId','documentId','baseRevisionId','nextRevisionId','commands'],'NotationTransaction');
  if(transaction.contractVersion!==NOTATION_TRANSACTION_VERSION||!validId(transaction.transactionId)||!validId(transaction.documentId)||!validId(transaction.baseRevisionId)||!validId(transaction.nextRevisionId)) throw new NotationTransactionError('Notation transaction envelope is invalid.','INVALID_TRANSACTION');
  if(transaction.documentId!==score.id||transaction.baseRevisionId!==score.revision.id||notation.documentId!==score.id||notation.revisionId!==score.revision.id) throw new NotationTransactionError('Notation transaction or notation document is stale.','STALE_TRANSACTION');
  if(transaction.nextRevisionId===transaction.baseRevisionId||transaction.nextRevisionId===score.revision.parentId) throw new NotationTransactionError('Next revision id conflicts with current lineage.','REVISION_ID_CONFLICT');
  if(!Array.isArray(transaction.commands)||transaction.commands.length===0||transaction.commands.length>MAX_NOTATION_COMMANDS_PER_TRANSACTION) throw new NotationTransactionError('Notation command count is outside admitted bounds.','INVALID_TRANSACTION');
  const ids=new Set<string>();
  for(const raw of transaction.commands){
    const command=raw as NotationCommand;
    if(!(command.type in commandFields)) throw new NotationTransactionError('Notation command type is unsupported.','INVALID_TRANSACTION');
    exact(command,commandFields[command.type],'NotationCommand');
    if(command.commandVersion!==NOTATION_COMMAND_VERSION||!validId(command.commandId)||ids.has(command.commandId)) throw new NotationTransactionError('Notation command id/version is invalid or duplicated.','INVALID_TRANSACTION',{commandId:command.commandId});
    ids.add(command.commandId);
    const resolved=resolveSemanticAddress(score,command.target as SemanticAddress);
    const wanted=expectedKind(command.type);
    if(resolved.kind!==wanted) throw new NotationTransactionError('Notation command target kind is invalid.','TARGET_KIND',{wanted,observed:resolved.kind});
  }
};

const defaultMeasure=():MeasureNotation=>({timeSignature:null,keySignature:null,clef:null,barlines:[]});
const defaultEvent=():EventNotation=>({dots:0,beams:[],tuplet:null});
const defaultNote=():NoteNotation=>({accidental:null,ties:[],slurs:[]});

type Draft={
  measures:Map<string,MeasureNotation>;
  events:Map<string,EventNotation>;
  notes:Map<string,NoteNotation>;
};

const makeDraft=(notation:NotationDocument):Draft=>({
  measures:new Map(notation.measures.map((entry)=>[entry.target.measureId,entry.notation])),
  events:new Map(notation.events.map((entry)=>[entry.target.eventId,entry.notation])),
  notes:new Map(notation.notes.map((entry)=>[entry.target.noteId,entry.notation]))
});

const applyCommand=(draft:Draft,command:NotationCommand):void=>{
  if(command.type==='SET_TIME_SIGNATURE'||command.type==='SET_KEY_SIGNATURE'||command.type==='SET_CLEF'||command.type==='SET_BARLINES'){
    const id=command.target.measureId; const current=draft.measures.get(id)??defaultMeasure();
    if(command.type==='SET_TIME_SIGNATURE') draft.measures.set(id,{...current,timeSignature:command.value});
    else if(command.type==='SET_KEY_SIGNATURE') draft.measures.set(id,{...current,keySignature:command.value});
    else if(command.type==='SET_CLEF') draft.measures.set(id,{...current,clef:command.value});
    else draft.measures.set(id,{...current,barlines:command.value});
    return;
  }
  if(command.type==='SET_DOTS'||command.type==='SET_BEAMS'||command.type==='SET_TUPLET'){
    const id=command.target.eventId; const current=draft.events.get(id)??defaultEvent();
    if(command.type==='SET_DOTS') draft.events.set(id,{...current,dots:command.value});
    else if(command.type==='SET_BEAMS') draft.events.set(id,{...current,beams:command.value});
    else draft.events.set(id,{...current,tuplet:command.value});
    return;
  }
  const id=command.target.noteId; const current=draft.notes.get(id)??defaultNote();
  if(command.type==='SET_ACCIDENTAL') draft.notes.set(id,{...current,accidental:command.value});
  else if(command.type==='SET_TIES') draft.notes.set(id,{...current,ties:command.value});
  else draft.notes.set(id,{...current,slurs:command.value});
};

const toNotationInput=(score:ScoreDocument,draft:Draft)=>({
  contractVersion:NOTATION_DOCUMENT_VERSION,
  documentId:score.id,
  revisionId:score.revision.id,
  measures:[...draft.measures].map(([id,notation])=>{const target=addressEntity(score,id);if(target.kind!=='measure')throw new NotationTransactionError('Measure target disappeared.','RESULT_INVALID',{id});return {target,notation};}),
  events:[...draft.events].map(([id,notation])=>{const target=addressEntity(score,id);if(target.kind!=='event')throw new NotationTransactionError('Event target disappeared.','RESULT_INVALID',{id});return {target,notation};}),
  notes:[...draft.notes].map(([id,notation])=>{const target=addressEntity(score,id);if(target.kind!=='note')throw new NotationTransactionError('Note target disappeared.','RESULT_INVALID',{id});return {target,notation};})
});

export const applyNotationTransaction=(score:ScoreDocument,notation:NotationDocument,transaction:NotationTransaction):Readonly<NotationTransactionResult>=>{
  validateTransaction(score,notation,transaction);
  const draft=makeDraft(notation);
  for(const command of transaction.commands) applyCommand(draft,command);
  try {
    // Validate the entire candidate notation against the immutable base before creating lineage.
    createNotationDocument(score,toNotationInput(score,draft));
    const nextScore=createScoreDocument({...score,revision:{id:transaction.nextRevisionId,parentId:score.revision.id}});
    const nextNotation=createNotationDocument(nextScore,toNotationInput(nextScore,draft));
    return Object.freeze({score:nextScore,notation:nextNotation});
  } catch(error){
    if(error instanceof NotationTransactionError) throw error;
    throw new NotationTransactionError('Notation transaction result failed validation.','RESULT_INVALID',{cause:error instanceof Error?error.message:String(error)});
  }
};

export const existingMeasureNotation=(notation:NotationDocument,id:string):MeasureNotation=>notationForMeasure(notation,id)??defaultMeasure();
export const existingEventNotation=(notation:NotationDocument,id:string):EventNotation=>notationForEvent(notation,id)??defaultEvent();
export const existingNoteNotation=(notation:NotationDocument,id:string):NoteNotation=>notationForNote(notation,id)??defaultNote();
