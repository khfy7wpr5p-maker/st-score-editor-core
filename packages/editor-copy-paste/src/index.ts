import { createScoreDocument } from '../../score-model/src/index.js';
import type { NoteAtom, ScoreDocument, ScoreEvent } from '../../score-model/src/index.js';
import { addressEntity, resolveSemanticAddress } from '../../addressing/src/index.js';
import type { VoiceAddress } from '../../addressing/src/index.js';
import { createNotationDocument, notationForEvent, notationForNote } from '../../notation-structure/src/index.js';
import type { NotationDocument } from '../../notation-structure/src/index.js';
import { createInsertionPosition } from '../../editor-insertion-position/src/index.js';
import { analyzeMeasureTiming } from '../../editor-measure-timing/src/index.js';
import { createMusicXmlMeasureSemanticsDocument, semanticsForMeasure } from '../../musicxml-measure-semantics/src/index.js';
import type { MusicXmlMeasureSemanticsDocument } from '../../musicxml-measure-semantics/src/index.js';

export const COPY_PASTE_VERSION = '1.0.0' as const;

export interface NoteCopyIdentity { readonly sourceNoteId: string; readonly newNoteId: string }
export interface EventCopyIdentity {
  readonly sourceEventId: string;
  readonly newEventId: string;
  readonly notes: readonly NoteCopyIdentity[];
}
export interface CopyVoiceToEmptyVoiceIntent {
  readonly version: typeof COPY_PASTE_VERSION;
  readonly type: 'COPY_VOICE_TO_EMPTY_VOICE';
  readonly source: VoiceAddress;
  readonly target: VoiceAddress;
  readonly identities: readonly EventCopyIdentity[];
}
export interface CopyPasteCommitIdentity {
  readonly version: typeof COPY_PASTE_VERSION;
  readonly operationId: string;
  readonly nextRevisionId: string;
}
export interface CopyPasteResult {
  readonly score: Readonly<ScoreDocument>;
  readonly notation: Readonly<NotationDocument>;
}
export type CopyPasteErrorCode =
  | 'INVALID_INTENT' | 'INVALID_IDENTITY' | 'STALE_TARGET' | 'TARGET_NOT_EMPTY'
  | 'RELATION_COUPLED_SOURCE' | 'IDENTITY_MAP_MISMATCH' | 'ID_CONFLICT'
  | 'MISSING_MEASURE_EVIDENCE' | 'UNSAFE_MEASURE_SEMANTICS' | 'INVALID_MEASURE_EVIDENCE'
  | 'TIMING_REJECTED' | 'RESULT_INVALID';

export class CopyPasteError extends Error {
  readonly code: CopyPasteErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: CopyPasteErrorCode, details: Record<string, unknown> = {}) {
    super(message); this.name='CopyPasteError'; this.code=code; this.details=Object.freeze({...details}); Object.freeze(this);
  }
}
type UnknownRecord = Record<string, unknown>;
const exact=(value:unknown,fields:readonly string[],label:string,code:CopyPasteErrorCode):UnknownRecord=>{
  if(value===null||typeof value!=='object'||Array.isArray(value)) throw new CopyPasteError(`${label} must be an object.`,code);
  const r=value as UnknownRecord; const observed=Object.keys(r).sort(); const expected=[...fields].sort();
  if(JSON.stringify(observed)!==JSON.stringify(expected)) throw new CopyPasteError(`${label} field set is invalid.`,code,{observed,expected}); return r;
};
const validId=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v);
const allIds=(score:ScoreDocument):ReadonlySet<string>=>{
  const ids=new Set<string>([score.id,score.revision.id]); if(score.revision.parentId!==null)ids.add(score.revision.parentId);
  for(const p of score.parts){ids.add(p.id);for(const s of p.staves){ids.add(s.id);for(const m of s.measures){ids.add(m.id);for(const v of m.voices){ids.add(v.id);for(const e of v.events){ids.add(e.id);if(e.kind==='note')ids.add(e.note.id);if(e.kind==='chord')for(const n of e.notes)ids.add(n.id);}}}}}
  return ids;
};
const voiceTarget=(score:ScoreDocument,raw:unknown,label:string):VoiceAddress=>{
  try{const a=raw as VoiceAddress;const r=resolveSemanticAddress(score,a);if(r.kind!=='voice')throw new Error(`observed ${r.kind}`);return a;}
  catch(error){throw new CopyPasteError(`${label} is stale or invalid.`,'STALE_TARGET',{cause:error instanceof Error?error.message:String(error)});}
};
const parseIdentity=(score:ScoreDocument,value:unknown):CopyPasteCommitIdentity=>{
  const r=exact(value,['version','operationId','nextRevisionId'],'CopyPasteCommitIdentity','INVALID_IDENTITY');
  if(r.version!==COPY_PASTE_VERSION||!validId(r.operationId)||!validId(r.nextRevisionId)||r.nextRevisionId===score.revision.id||r.nextRevisionId===score.revision.parentId)throw new CopyPasteError('Copy/paste commit identity is invalid.','INVALID_IDENTITY');
  return Object.freeze({version:COPY_PASTE_VERSION,operationId:r.operationId,nextRevisionId:r.nextRevisionId});
};
const parseIntent=(score:ScoreDocument,value:unknown):CopyVoiceToEmptyVoiceIntent=>{
  const r=exact(value,['version','type','source','target','identities'],'CopyVoiceToEmptyVoiceIntent','INVALID_INTENT');
  if(r.version!==COPY_PASTE_VERSION||r.type!=='COPY_VOICE_TO_EMPTY_VOICE'||!Array.isArray(r.identities))throw new CopyPasteError('Copy/paste intent is invalid.','INVALID_INTENT');
  const source=voiceTarget(score,r.source,'source'); const target=voiceTarget(score,r.target,'target');
  if(source.voiceId===target.voiceId)throw new CopyPasteError('Source and target voices must be distinct.','INVALID_INTENT');
  const identities=r.identities.map((raw,index)=>{
    const e=exact(raw,['sourceEventId','newEventId','notes'],`identities[${index}]`,'INVALID_INTENT');
    if(!validId(e.sourceEventId)||!validId(e.newEventId)||!Array.isArray(e.notes))throw new CopyPasteError('Event copy identity is invalid.','INVALID_INTENT',{index});
    const notes=e.notes.map((nr,ni)=>{const n=exact(nr,['sourceNoteId','newNoteId'],`identities[${index}].notes[${ni}]`,'INVALID_INTENT');if(!validId(n.sourceNoteId)||!validId(n.newNoteId))throw new CopyPasteError('Note copy identity is invalid.','INVALID_INTENT',{index,ni});return Object.freeze({sourceNoteId:n.sourceNoteId,newNoteId:n.newNoteId});});
    return Object.freeze({sourceEventId:e.sourceEventId,newEventId:e.newEventId,notes:Object.freeze(notes)});
  });
  return Object.freeze({version:COPY_PASTE_VERSION,type:'COPY_VOICE_TO_EMPTY_VOICE',source,target,identities:Object.freeze(identities)});
};
const resolvedVoice=(score:ScoreDocument,address:VoiceAddress)=>{const r=resolveSemanticAddress(score,address);if(r.kind!=='voice')throw new CopyPasteError('Voice target changed kind.','STALE_TARGET');return r.value;};
const notesOf=(event:ScoreEvent):readonly NoteAtom[]=>event.kind==='note'?[event.note]:event.kind==='chord'?event.notes:[];
const validateRelations=(notation:NotationDocument,event:ScoreEvent):void=>{
  const en=notationForEvent(notation,event.id);
  if((en?.beams.length??0)>0||(en?.tuplet??null)!==null)throw new CopyPasteError('Beam/tuplet-coupled source content is not admitted by copy/paste v1.','RELATION_COUPLED_SOURCE',{eventId:event.id});
  for(const note of notesOf(event)){const nn=notationForNote(notation,note.id);if((nn?.ties.length??0)>0||(nn?.slurs.length??0)>0)throw new CopyPasteError('Tie/slur-coupled source content is not admitted by copy/paste v1.','RELATION_COUPLED_SOURCE',{noteId:note.id});}
};
const validateEvidence=(score:ScoreDocument,target:VoiceAddress,raw:MusicXmlMeasureSemanticsDocument|null):void=>{
  if(score.source.format!=='musicxml')return;
  if(raw===null)throw new CopyPasteError('MusicXML-derived structural paste requires current measure evidence.','MISSING_MEASURE_EVIDENCE');
  let doc:Readonly<MusicXmlMeasureSemanticsDocument>;try{doc=createMusicXmlMeasureSemanticsDocument(score,raw);}catch(error){throw new CopyPasteError('Measure evidence is stale or invalid.','INVALID_MEASURE_EVIDENCE',{cause:error instanceof Error?error.message:String(error)});}
  const entry=semanticsForMeasure(doc,target.measureId);if(entry===null||entry.target.partId!==target.partId||entry.target.staffId!==target.staffId)throw new CopyPasteError('Exact target measure evidence is missing.','INVALID_MEASURE_EVIDENCE');
  if(entry.implicit==='yes'||entry.nonControlling==='yes'||entry.effectiveTimeSignature===null)throw new CopyPasteError('Paste is not admitted into pickup/incomplete, non-controlling or unknown-meter measures.','UNSAFE_MEASURE_SEMANTICS');
};

export const executeCopyVoiceToEmptyVoice=(score:ScoreDocument,notationInput:NotationDocument,measureSemantics:MusicXmlMeasureSemanticsDocument|null,rawIntent:unknown,rawIdentity:unknown):Readonly<CopyPasteResult>=>{
  let notation:Readonly<NotationDocument>;try{notation=createNotationDocument(score,notationInput);}catch(error){throw new CopyPasteError('Copy/paste requires current notation.','STALE_TARGET',{cause:error instanceof Error?error.message:String(error)});}
  const intent=parseIntent(score,rawIntent);const identity=parseIdentity(score,rawIdentity);const source=resolvedVoice(score,intent.source);const target=resolvedVoice(score,intent.target);
  if(target.events.length!==0)throw new CopyPasteError('Target voice must be empty for bounded copy/paste v1.','TARGET_NOT_EMPTY',{voiceId:target.id});
  validateEvidence(score,intent.target,measureSemantics);
  if(intent.identities.length!==source.events.length)throw new CopyPasteError('Identity map must cover every source event exactly once.','IDENTITY_MAP_MISMATCH');
  const existing=allIds(score);const produced=new Set<string>();
  const mappedEvents:ScoreEvent[]=source.events.map((event,index)=>{
    validateRelations(notation,event);const map=intent.identities[index];if(map===undefined||map.sourceEventId!==event.id)throw new CopyPasteError('Event identity map must follow exact source voice order.','IDENTITY_MAP_MISMATCH',{index,eventId:event.id});
    if(existing.has(map.newEventId)||produced.has(map.newEventId))throw new CopyPasteError('New event identity conflicts.','ID_CONFLICT',{id:map.newEventId});produced.add(map.newEventId);
    const sourceNotes=notesOf(event);if(map.notes.length!==sourceNotes.length)throw new CopyPasteError('Note identity map does not match source event notes.','IDENTITY_MAP_MISMATCH',{eventId:event.id});
    const mappedNotes=sourceNotes.map((note,ni)=>{const nm=map.notes[ni];if(nm===undefined||nm.sourceNoteId!==note.id)throw new CopyPasteError('Note identity map must match exact source note order.','IDENTITY_MAP_MISMATCH',{eventId:event.id,ni});if(existing.has(nm.newNoteId)||produced.has(nm.newNoteId))throw new CopyPasteError('New note identity conflicts.','ID_CONFLICT',{id:nm.newNoteId});produced.add(nm.newNoteId);return Object.freeze({...note,id:nm.newNoteId});});
    if(event.kind==='rest')return Object.freeze({...event,id:map.newEventId});
    if(event.kind==='note')return Object.freeze({...event,id:map.newEventId,note:mappedNotes[0]!});
    return Object.freeze({...event,id:map.newEventId,notes:Object.freeze(mappedNotes)});
  });
  let nextScore:Readonly<ScoreDocument>;
  try{nextScore=createScoreDocument({...score,revision:{id:identity.nextRevisionId,parentId:score.revision.id},parts:score.parts.map(p=>p.id!==intent.target.partId?p:({...p,staves:p.staves.map(s=>s.id!==intent.target.staffId?s:({...s,measures:s.measures.map(m=>m.id!==intent.target.measureId?m:({...m,voices:m.voices.map(v=>v.id===intent.target.voiceId?({...v,events:Object.freeze(mappedEvents)}):v)}))}))}))});}
  catch(error){throw new CopyPasteError('Copy/paste score candidate failed canonical validation.','RESULT_INVALID',{cause:error instanceof Error?error.message:String(error)});}
  const measureEntries=notation.measures.map(e=>({target:addressEntity(nextScore,e.target.measureId),notation:e.notation}));
  const eventEntries=[...notation.events.map(e=>({target:addressEntity(nextScore,e.target.eventId),notation:e.notation}))];
  const noteEntries=[...notation.notes.map(e=>({target:addressEntity(nextScore,e.target.noteId),notation:e.notation}))];
  source.events.forEach((event,index)=>{const map=intent.identities[index]!;const en=notationForEvent(notation,event.id);if(en!==null)eventEntries.push({target:addressEntity(nextScore,map.newEventId),notation:en});notesOf(event).forEach((note,ni)=>{const nn=notationForNote(notation,note.id);if(nn!==null)noteEntries.push({target:addressEntity(nextScore,map.notes[ni]!.newNoteId),notation:nn});});});
  let nextNotation:Readonly<NotationDocument>;
  try{nextNotation=createNotationDocument(nextScore,{contractVersion:'1.0.0',documentId:nextScore.id,revisionId:nextScore.revision.id,measures:measureEntries,events:eventEntries,notes:noteEntries});}
  catch(error){throw new CopyPasteError('Copy/paste notation candidate failed validation.','RESULT_INVALID',{cause:error instanceof Error?error.message:String(error)});}
  try{const voiceAddress=addressEntity(nextScore,intent.target.voiceId);if(voiceAddress.kind!=='voice')throw new Error(`observed ${voiceAddress.kind}`);const position=createInsertionPosition(nextScore,voiceAddress,{numerator:0,denominator:1});analyzeMeasureTiming(nextScore,nextNotation,position);}
  catch(error){throw new CopyPasteError('Pasted target voice failed independent measure timing validation.','TIMING_REJECTED',{cause:error instanceof Error?error.message:String(error)});}
  return Object.freeze({score:nextScore,notation:nextNotation});
};
