import test from 'node:test';
import assert from 'node:assert/strict';

import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { addressEntity } from '../dist/packages/addressing/src/index.js';
import { createNotationDocument, notationForNote } from '../dist/packages/notation-structure/src/index.js';
import { executeCopyVoiceToEmptyVoice, CopyPasteError } from '../dist/packages/editor-copy-paste/src/index.js';
import { createEditorHistory, commitEditorHistory, undoEditorHistory, redoEditorHistory } from '../dist/packages/editor-history/src/index.js';

const score=()=>createScoreDocument({schemaVersion:'1.0.0',id:'doc-copy',revision:{id:'rev-1',parentId:null},source:{sha256:'8'.repeat(64),format:'synthetic',byteLength:null},parts:[{id:'part-1',name:'Piano',staves:[{id:'staff-1',ordinal:1,measures:[
{id:'measure-1',ordinal:1,displayNumber:'1',voices:[{id:'voice-source',ordinal:1,events:[
{id:'event-1',kind:'note',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:4},note:{id:'note-1',pitch:{step:'C',alter:0,octave:4}}},
{id:'event-2',kind:'rest',onset:{numerator:1,denominator:4},duration:{numerator:1,denominator:4}}
]}]},
{id:'measure-2',ordinal:2,displayNumber:'2',voices:[{id:'voice-target',ordinal:1,events:[]}]}
]}]}]});
const notation=(s,{coupled=false}={})=>createNotationDocument(s,{contractVersion:'1.0.0',documentId:s.id,revisionId:s.revision.id,measures:[
{target:addressEntity(s,'measure-1'),notation:{timeSignature:{beats:4,beatType:4},keySignature:null,clef:null,barlines:[]}},
{target:addressEntity(s,'measure-2'),notation:{timeSignature:null,keySignature:null,clef:null,barlines:[]}}
],events:coupled?[{target:addressEntity(s,'event-1'),notation:{dots:0,beams:[{number:1,value:'begin'}],tuplet:null}}]:[],notes:[{target:addressEntity(s,'note-1'),notation:{accidental:'natural',ties:[],slurs:[]}}]});
const ids=()=>[
{sourceEventId:'event-1',newEventId:'event-copy-1',notes:[{sourceNoteId:'note-1',newNoteId:'note-copy-1'}]},
{sourceEventId:'event-2',newEventId:'event-copy-2',notes:[]}
];
const intent=(s,identities=ids())=>({version:'1.0.0',type:'COPY_VOICE_TO_EMPTY_VOICE',source:addressEntity(s,'voice-source'),target:addressEntity(s,'voice-target'),identities});
const identity=(id='rev-copy')=>({version:'1.0.0',operationId:`op-${id}`,nextRevisionId:id});
const targetEvents=(s)=>s.parts[0].staves[0].measures[1].voices[0].events;

test('copies relation-free source voice into empty target with fresh event/note identities',()=>{
 const s=score();const n=notation(s);const r=executeCopyVoiceToEmptyVoice(s,n,null,intent(s),identity());
 assert.deepEqual(targetEvents(r.score).map(e=>e.id),['event-copy-1','event-copy-2']);
 assert.equal(targetEvents(r.score)[0].note.id,'note-copy-1');
 assert.deepEqual(targetEvents(r.score)[0].note.pitch,{step:'C',alter:0,octave:4});
 assert.equal(notationForNote(r.notation,'note-copy-1').accidental,'natural');
 assert.equal(targetEvents(s).length,0);
});

test('identity map must exactly cover source event/note order and all new IDs must be fresh',()=>{
 const s=score();const n=notation(s);
 assert.throws(()=>executeCopyVoiceToEmptyVoice(s,n,null,intent(s,ids().slice(0,1)),identity('rev-short')),(e)=>e instanceof CopyPasteError&&e.code==='IDENTITY_MAP_MISMATCH');
 const collision=ids();collision[0]={...collision[0],newEventId:'measure-2'};
 assert.throws(()=>executeCopyVoiceToEmptyVoice(s,n,null,intent(s,collision),identity('rev-collision')),(e)=>e instanceof CopyPasteError&&e.code==='ID_CONFLICT');
});

test('relation-coupled source voice is rejected rather than copied ambiguously',()=>{
 const s=score();
 assert.throws(()=>executeCopyVoiceToEmptyVoice(s,notation(s,{coupled:true}),null,intent(s),identity('rev-coupled')),(e)=>e instanceof CopyPasteError&&e.code==='RELATION_COUPLED_SOURCE');
});

test('target voice must be empty',()=>{
 const s=score();
 const occupied=createScoreDocument({...s,parts:[{...s.parts[0],staves:[{...s.parts[0].staves[0],measures:[s.parts[0].staves[0].measures[0],{...s.parts[0].staves[0].measures[1],voices:[{id:'voice-target',ordinal:1,events:[{id:'target-rest',kind:'rest',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:4}}]}]}]}]}]});
 assert.throws(()=>executeCopyVoiceToEmptyVoice(occupied,notation(occupied),null,intent(occupied),identity('rev-occupied')),(e)=>e instanceof CopyPasteError&&e.code==='TARGET_NOT_EMPTY');
});

test('pasted timing is independently rejected when target meter is too short',()=>{
 const s=score();
 const n=createNotationDocument(s,{contractVersion:'1.0.0',documentId:s.id,revisionId:s.revision.id,measures:[
 {target:addressEntity(s,'measure-1'),notation:{timeSignature:{beats:4,beatType:4},keySignature:null,clef:null,barlines:[]}},
 {target:addressEntity(s,'measure-2'),notation:{timeSignature:{beats:1,beatType:4},keySignature:null,clef:null,barlines:[]}}
 ],events:[],notes:[]});
 assert.throws(()=>executeCopyVoiceToEmptyVoice(s,n,null,intent(s),identity('rev-timing')),(e)=>e instanceof CopyPasteError&&e.code==='TIMING_REJECTED');
});

test('copy/paste composes as one unified history revision',()=>{
 const s=score();const n=notation(s);const r=executeCopyVoiceToEmptyVoice(s,n,null,intent(s),identity('rev-history'));
 const h=commitEditorHistory(createEditorHistory(s,n),r.score,r.notation);assert.equal(targetEvents(h.present.score).length,2);
 const u=undoEditorHistory(h);assert.equal(targetEvents(u.present.score).length,0);
 const rr=redoEditorHistory(u);assert.equal(targetEvents(rr.present.score).length,2);
});
