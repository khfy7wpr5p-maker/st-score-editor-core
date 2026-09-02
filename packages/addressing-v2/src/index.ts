import {
  createScoreDocumentV2,
  type GraceEvent,
  type GraceGroup,
  type NoteAtom,
  type PartV2,
  type ScoreDocumentV2,
  type ScoreEvent,
  type StaffV2,
  type MeasureV2,
  type VoiceV2
} from '../../score-model-v2/src/index.js';

export const SEMANTIC_ADDRESS_V2_VERSION = '2.0.0' as const;
export type AddressKindV2 = 'document'|'part'|'staff'|'measure'|'voice'|'event'|'note'|'grace-group'|'grace-event'|'grace-note';
interface AddressBaseV2 { readonly contractVersion: typeof SEMANTIC_ADDRESS_V2_VERSION; readonly kind: AddressKindV2; readonly documentId: string; readonly revisionId: string }
export interface DocumentAddressV2 extends AddressBaseV2 { readonly kind:'document' }
export interface PartAddressV2 extends AddressBaseV2 { readonly kind:'part'; readonly partId:string }
export interface StaffAddressV2 extends AddressBaseV2 { readonly kind:'staff'; readonly partId:string; readonly staffId:string }
export interface MeasureAddressV2 extends AddressBaseV2 { readonly kind:'measure'; readonly partId:string; readonly staffId:string; readonly measureId:string }
export interface VoiceAddressV2 extends AddressBaseV2 { readonly kind:'voice'; readonly partId:string; readonly staffId:string; readonly measureId:string; readonly voiceId:string }
export interface EventAddressV2 extends AddressBaseV2 { readonly kind:'event'; readonly partId:string; readonly staffId:string; readonly measureId:string; readonly voiceId:string; readonly eventId:string }
export interface NoteAddressV2 extends AddressBaseV2 { readonly kind:'note'; readonly partId:string; readonly staffId:string; readonly measureId:string; readonly voiceId:string; readonly eventId:string; readonly noteId:string }
export interface GraceGroupAddressV2 extends AddressBaseV2 { readonly kind:'grace-group'; readonly partId:string; readonly staffId:string; readonly measureId:string; readonly voiceId:string; readonly graceGroupId:string }
export interface GraceEventAddressV2 extends AddressBaseV2 { readonly kind:'grace-event'; readonly partId:string; readonly staffId:string; readonly measureId:string; readonly voiceId:string; readonly graceGroupId:string; readonly graceEventId:string }
export interface GraceNoteAddressV2 extends AddressBaseV2 { readonly kind:'grace-note'; readonly partId:string; readonly staffId:string; readonly measureId:string; readonly voiceId:string; readonly graceGroupId:string; readonly graceEventId:string; readonly graceNoteId:string }
export type SemanticAddressV2 = DocumentAddressV2|PartAddressV2|StaffAddressV2|MeasureAddressV2|VoiceAddressV2|EventAddressV2|NoteAddressV2|GraceGroupAddressV2|GraceEventAddressV2|GraceNoteAddressV2;

export type ResolvedSemanticTargetV2 =
  | { readonly kind:'document'; readonly value:ScoreDocumentV2 }
  | { readonly kind:'part'; readonly value:PartV2 }
  | { readonly kind:'staff'; readonly value:StaffV2 }
  | { readonly kind:'measure'; readonly value:MeasureV2 }
  | { readonly kind:'voice'; readonly value:VoiceV2 }
  | { readonly kind:'event'; readonly value:ScoreEvent }
  | { readonly kind:'note'; readonly value:NoteAtom }
  | { readonly kind:'grace-group'; readonly value:GraceGroup }
  | { readonly kind:'grace-event'; readonly value:GraceEvent }
  | { readonly kind:'grace-note'; readonly value:NoteAtom };

export type AddressingV2ErrorCode='INVALID_ADDRESS'|'DOCUMENT_MISMATCH'|'STALE_REVISION'|'TARGET_NOT_FOUND'|'ADDRESS_PATH_MISMATCH';
export class AddressingV2Error extends Error {
  readonly code:AddressingV2ErrorCode; readonly details:Readonly<Record<string,unknown>>;
  constructor(message:string,code:AddressingV2ErrorCode,details:Record<string,unknown>={}){ super(message); this.name='AddressingV2Error'; this.code=code; this.details=Object.freeze({...details}); Object.freeze(this); }
}
const keys:Readonly<Record<AddressKindV2,readonly string[]>>=Object.freeze({
  document:['contractVersion','kind','documentId','revisionId'],
  part:['contractVersion','kind','documentId','revisionId','partId'],
  staff:['contractVersion','kind','documentId','revisionId','partId','staffId'],
  measure:['contractVersion','kind','documentId','revisionId','partId','staffId','measureId'],
  voice:['contractVersion','kind','documentId','revisionId','partId','staffId','measureId','voiceId'],
  event:['contractVersion','kind','documentId','revisionId','partId','staffId','measureId','voiceId','eventId'],
  note:['contractVersion','kind','documentId','revisionId','partId','staffId','measureId','voiceId','eventId','noteId'],
  'grace-group':['contractVersion','kind','documentId','revisionId','partId','staffId','measureId','voiceId','graceGroupId'],
  'grace-event':['contractVersion','kind','documentId','revisionId','partId','staffId','measureId','voiceId','graceGroupId','graceEventId'],
  'grace-note':['contractVersion','kind','documentId','revisionId','partId','staffId','measureId','voiceId','graceGroupId','graceEventId','graceNoteId']
});
const kinds=new Set<AddressKindV2>(Object.keys(keys) as AddressKindV2[]);
const record=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const id=(value:unknown,field:string):string=>{if(typeof value!=='string'||value.length===0||value!==value.trim())throw new AddressingV2Error('Invalid semantic identifier.','INVALID_ADDRESS',{field});return value;};
const envelope=(document:ScoreDocumentV2,address:SemanticAddressV2):void=>{
  if(!record(address)||typeof address.kind!=='string'||!kinds.has(address.kind as AddressKindV2))throw new AddressingV2Error('Unsupported semantic address shape.','INVALID_ADDRESS');
  const expected=[...keys[address.kind]].sort(),observed=Object.keys(address).sort();
  if(JSON.stringify(expected)!==JSON.stringify(observed))throw new AddressingV2Error('Semantic address field set is invalid.','INVALID_ADDRESS',{expected,observed});
  if(address.contractVersion!==SEMANTIC_ADDRESS_V2_VERSION)throw new AddressingV2Error('Semantic address version is unsupported.','INVALID_ADDRESS');
  if(address.documentId!==document.id)throw new AddressingV2Error('Address belongs to another document.','DOCUMENT_MISMATCH');
  if(address.revisionId!==document.revision.id)throw new AddressingV2Error('Address belongs to a stale revision.','STALE_REVISION');
};
const child=<T extends {readonly id:string}>(items:readonly T[],target:string,field:string,parent:string):T=>{id(target,field);const value=items.find(x=>x.id===target);if(!value)throw new AddressingV2Error('Semantic target does not belong to addressed parent.','ADDRESS_PATH_MISMATCH',{[field]:target,parent});return value;};
const normalNotes=(event:ScoreEvent):readonly NoteAtom[]=>event.kind==='note'?[event.note]:event.kind==='chord'?event.notes:[];
const graceNotes=(event:GraceEvent):readonly NoteAtom[]=>event.kind==='note'?[event.note]:event.kind==='chord'?event.notes:[];
export const resolveSemanticAddressV2=(documentInput:ScoreDocumentV2,address:SemanticAddressV2):ResolvedSemanticTargetV2=>{
  const document=createScoreDocumentV2(documentInput); envelope(document,address);
  if(address.kind==='document')return Object.freeze({kind:'document',value:document});
  const part=child(document.parts,address.partId,'partId',document.id); if(address.kind==='part')return Object.freeze({kind:'part',value:part});
  const staff=child(part.staves,address.staffId,'staffId',part.id); if(address.kind==='staff')return Object.freeze({kind:'staff',value:staff});
  const measure=child(staff.measures,address.measureId,'measureId',staff.id); if(address.kind==='measure')return Object.freeze({kind:'measure',value:measure});
  const voice=child(measure.voices,address.voiceId,'voiceId',measure.id); if(address.kind==='voice')return Object.freeze({kind:'voice',value:voice});
  if(address.kind==='event'||address.kind==='note'){
    const event=child(voice.events,address.eventId,'eventId',voice.id); if(address.kind==='event')return Object.freeze({kind:'event',value:event});
    return Object.freeze({kind:'note',value:child(normalNotes(event),address.noteId,'noteId',event.id)});
  }
  const group=child(voice.graceGroups,address.graceGroupId,'graceGroupId',voice.id); if(address.kind==='grace-group')return Object.freeze({kind:'grace-group',value:group});
  const event=child(group.events,address.graceEventId,'graceEventId',group.id); if(address.kind==='grace-event')return Object.freeze({kind:'grace-event',value:event});
  return Object.freeze({kind:'grace-note',value:child(graceNotes(event),address.graceNoteId,'graceNoteId',event.id)});
};
const common=(document:ScoreDocumentV2,kind:AddressKindV2)=>({contractVersion:SEMANTIC_ADDRESS_V2_VERSION,kind,documentId:document.id,revisionId:document.revision.id});
const frozen=<T extends SemanticAddressV2>(value:T):Readonly<T>=>Object.freeze(value);
export interface SemanticAddressIndexV2 { readonly document:Readonly<DocumentAddressV2>; readonly byEntityId:ReadonlyMap<string,SemanticAddressV2> }
export const createSemanticAddressIndexV2=(documentInput:ScoreDocumentV2):SemanticAddressIndexV2=>{
  const document=createScoreDocumentV2(documentInput); const documentAddress=frozen<DocumentAddressV2>({...common(document,'document'),kind:'document'}); const map=new Map<string,SemanticAddressV2>([[document.id,documentAddress]]);
  const add=(entityId:string,address:SemanticAddressV2)=>{if(map.has(entityId))throw new AddressingV2Error('Duplicate entity identity prevents deterministic addressing.','INVALID_ADDRESS',{entityId});map.set(entityId,frozen(address));};
  for(const part of document.parts){add(part.id,{...common(document,'part'),kind:'part',partId:part.id});for(const staff of part.staves){add(staff.id,{...common(document,'staff'),kind:'staff',partId:part.id,staffId:staff.id});for(const measure of staff.measures){add(measure.id,{...common(document,'measure'),kind:'measure',partId:part.id,staffId:staff.id,measureId:measure.id});for(const voice of measure.voices){add(voice.id,{...common(document,'voice'),kind:'voice',partId:part.id,staffId:staff.id,measureId:measure.id,voiceId:voice.id});for(const event of voice.events){add(event.id,{...common(document,'event'),kind:'event',partId:part.id,staffId:staff.id,measureId:measure.id,voiceId:voice.id,eventId:event.id});for(const note of normalNotes(event))add(note.id,{...common(document,'note'),kind:'note',partId:part.id,staffId:staff.id,measureId:measure.id,voiceId:voice.id,eventId:event.id,noteId:note.id});}for(const group of voice.graceGroups){add(group.id,{...common(document,'grace-group'),kind:'grace-group',partId:part.id,staffId:staff.id,measureId:measure.id,voiceId:voice.id,graceGroupId:group.id});for(const event of group.events){add(event.id,{...common(document,'grace-event'),kind:'grace-event',partId:part.id,staffId:staff.id,measureId:measure.id,voiceId:voice.id,graceGroupId:group.id,graceEventId:event.id});for(const note of graceNotes(event))add(note.id,{...common(document,'grace-note'),kind:'grace-note',partId:part.id,staffId:staff.id,measureId:measure.id,voiceId:voice.id,graceGroupId:group.id,graceEventId:event.id,graceNoteId:note.id});}}}}}}
  return Object.freeze({document:documentAddress,byEntityId:map});
};
export const addressEntityV2=(document:ScoreDocumentV2,entityId:string):SemanticAddressV2=>{id(entityId,'entityId');const address=createSemanticAddressIndexV2(document).byEntityId.get(entityId);if(!address)throw new AddressingV2Error('Entity target was not found.','TARGET_NOT_FOUND',{entityId});return address;};
