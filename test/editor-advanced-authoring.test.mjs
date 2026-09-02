import test from 'node:test';
import assert from 'node:assert/strict';

import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { addressEntity } from '../dist/packages/addressing/src/index.js';
import { createNotationDocument } from '../dist/packages/notation-structure/src/index.js';
import { executeAdvancedScoreAuthoring, AdvancedAuthoringError } from '../dist/packages/editor-advanced-authoring/src/index.js';
import { createEditorHistory, commitEditorHistory, undoEditorHistory, redoEditorHistory } from '../dist/packages/editor-history/src/index.js';

const score=()=>createScoreDocument({schemaVersion:'1.0.0',id:'doc-adv',revision:{id:'rev-1',parentId:null},source:{sha256:'9'.repeat(64),format:'synthetic',byteLength:null},parts:[{id:'part-1',name:'Piano',staves:[{id:'staff-1',ordinal:1,measures:[{id:'measure-1',ordinal:1,displayNumber:'1',voices:[{id:'voice-1',ordinal:1,events:[
{id:'event-1',kind:'note',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:4},note:{id:'note-1',pitch:{step:'C',alter:0,octave:4}}},
{id:'event-2',kind:'rest',onset:{numerator:1,denominator:2},duration:{numerator:1,denominator:4}}
]}]}]}]}]});
const notation=(s,eventNotation=[])=>createNotationDocument(s,{contractVersion:'1.0.0',documentId:s.id,revisionId:s.revision.id,measures:[{target:addressEntity(s,'measure-1'),notation:{timeSignature:{beats:4,beatType:4},keySignature:null,clef:null,barlines:[]}}],events:eventNotation,notes:[]});
const tx=(s,next,commands)=>({contractVersion:'1.0.0',transactionId:`tx-${next}`,documentId:s.id,baseRevisionId:s.revision.id,nextRevisionId:next,commands});
const cmd=(id,type,target,extra={})=>({commandVersion:'1.0.0',commandId:id,type,target,...extra});

test('advanced authoring composes canonical chord construction without duplicating command semantics',()=>{
 const s=score();const n=notation(s);const t=tx(s,'rev-chord',[cmd('c1','ADD_CHORD_TONE',addressEntity(s,'event-1'),{noteId:'note-2',pitch:{step:'E',alter:0,octave:4}})]);
 const r=executeAdvancedScoreAuthoring(s,n,null,t);const e=r.score.parts[0].staves[0].measures[0].voices[0].events[0];
 assert.equal(e.kind,'chord');assert.deepEqual(e.notes.map(x=>x.id),['note-1','note-2']);assert.equal(r.notation.revisionId,'rev-chord');
});

test('duration change is independently timing-validated',()=>{
 const s=score();const n=notation(s);const t=tx(s,'rev-overflow',[cmd('d1','SET_EVENT_DURATION',addressEntity(s,'event-1'),{duration:{numerator:3,denominator:4}})]);
 assert.throws(()=>executeAdvancedScoreAuthoring(s,n,null,t),(e)=>e instanceof AdvancedAuthoringError&&e.code==='TIMING_REJECTED');
});

test('duration mutation refuses dotted/beamed/tuplet-coupled event notation',()=>{
 for(const eventNotation of [
  {dots:1,beams:[],tuplet:null},
  {dots:0,beams:[{number:1,value:'begin'}],tuplet:null},
  {dots:0,beams:[],tuplet:{actualNotes:3,normalNotes:2,marks:[{number:1,type:'start'}]}}
 ]){
  const s=score();const n=notation(s,[{target:addressEntity(s,'event-1'),notation:eventNotation}]);const t=tx(s,`rev-coupled-${eventNotation.dots}-${eventNotation.beams.length}-${eventNotation.tuplet?1:0}`,[cmd('d1','SET_EVENT_DURATION',addressEntity(s,'event-1'),{duration:{numerator:1,denominator:8}})]);
  assert.throws(()=>executeAdvancedScoreAuthoring(s,n,null,t),(e)=>e instanceof AdvancedAuthoringError&&e.code==='TIMING_COUPLED_NOTATION');
 }
});

test('removing a chord tone with notation target fails instead of orphaning notation',()=>{
 const chord=createScoreDocument({...score(),parts:[{id:'part-1',name:'Piano',staves:[{id:'staff-1',ordinal:1,measures:[{id:'measure-1',ordinal:1,displayNumber:'1',voices:[{id:'voice-1',ordinal:1,events:[{id:'event-1',kind:'chord',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:4},notes:[{id:'note-1',pitch:{step:'C',alter:0,octave:4}},{id:'note-2',pitch:{step:'E',alter:0,octave:4}}]},{id:'event-2',kind:'rest',onset:{numerator:1,denominator:2},duration:{numerator:1,denominator:4}}]}]}]}]}]});
 const n=createNotationDocument(chord,{contractVersion:'1.0.0',documentId:chord.id,revisionId:chord.revision.id,measures:[{target:addressEntity(chord,'measure-1'),notation:{timeSignature:{beats:4,beatType:4},keySignature:null,clef:null,barlines:[]}}],events:[],notes:[{target:addressEntity(chord,'note-2'),notation:{accidental:'natural',ties:[],slurs:[]}}]});
 const t=tx(chord,'rev-remove',[cmd('r1','REMOVE_CHORD_TONE',addressEntity(chord,'note-2'))]);
 assert.throws(()=>executeAdvancedScoreAuthoring(chord,n,null,t),(e)=>e instanceof AdvancedAuthoringError&&e.code==='NOTATION_ORPHAN_RISK');
});

test('safe advanced transaction composes with unified history undo/redo',()=>{
 const s=score();const n=notation(s);const t=tx(s,'rev-history',[cmd('p1','SET_NOTE_PITCH',addressEntity(s,'note-1'),{pitch:{step:'D',alter:0,octave:4}})]);
 const r=executeAdvancedScoreAuthoring(s,n,null,t);const h=commitEditorHistory(createEditorHistory(s,n),r.score,r.notation);
 assert.equal(h.present.score.parts[0].staves[0].measures[0].voices[0].events[0].note.pitch.step,'D');
 const u=undoEditorHistory(h);assert.equal(u.present.score.parts[0].staves[0].measures[0].voices[0].events[0].note.pitch.step,'C');
 const rr=redoEditorHistory(u);assert.equal(rr.present.score.parts[0].staves[0].measures[0].voices[0].events[0].note.pitch.step,'D');
});
