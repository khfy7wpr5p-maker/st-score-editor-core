import test from 'node:test';
import assert from 'node:assert/strict';

import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { addressEntity } from '../dist/packages/addressing/src/index.js';
import { createNotationDocument } from '../dist/packages/notation-structure/src/index.js';
import { executeStructuralAuthoring, StructuralAuthoringError } from '../dist/packages/editor-structural-authoring/src/index.js';
import { createEditorHistory, commitEditorHistory, undoEditorHistory, redoEditorHistory } from '../dist/packages/editor-history/src/index.js';

const makeScore = () => createScoreDocument({
  schemaVersion:'1.0.0', id:'doc-struct', revision:{id:'rev-1',parentId:null}, source:{sha256:'7'.repeat(64),format:'synthetic',byteLength:null},
  parts:[{id:'part-1',name:'Piano',staves:[{id:'staff-1',ordinal:1,measures:[
    {id:'measure-1',ordinal:1,displayNumber:'1',voices:[{id:'voice-1',ordinal:1,events:[]}]},
    {id:'measure-2',ordinal:2,displayNumber:'2',voices:[{id:'voice-2',ordinal:1,events:[]}]}
  ]}]}]
});
const notation = (s, measures=[]) => createNotationDocument(s,{contractVersion:'1.0.0',documentId:s.id,revisionId:s.revision.id,measures,events:[],notes:[]});
const identity = (id) => ({version:'1.0.0',operationId:`op-${id}`,nextRevisionId:id});
const intent = (type, target, extra={}) => ({version:'1.0.0',type,target,...extra});

test('ADD_MEASURE_AFTER inserts one empty canonical measure and renumbers ordinals without changing existing IDs',()=>{
  const s=makeScore(); const n=notation(s);
  const r=executeStructuralAuthoring(s,n,intent('ADD_MEASURE_AFTER',addressEntity(s,'measure-1'),{measureId:'measure-new',initialVoiceId:'voice-new',displayNumber:'1a'}),identity('rev-add-m'));
  const ms=r.score.parts[0].staves[0].measures;
  assert.deepEqual(ms.map(m=>[m.id,m.ordinal]),[['measure-1',1],['measure-new',2],['measure-2',3]]);
  assert.equal(ms[1].voices[0].id,'voice-new');
  assert.equal(ms[1].voices[0].events.length,0);
  assert.equal(r.notation.revisionId,'rev-add-m');
});

test('ADD_EMPTY_VOICE appends a fresh empty voice',()=>{
  const s=makeScore();
  const r=executeStructuralAuthoring(s,notation(s),intent('ADD_EMPTY_VOICE',addressEntity(s,'measure-1'),{voiceId:'voice-new'}),identity('rev-add-v'));
  assert.deepEqual(r.score.parts[0].staves[0].measures[0].voices.map(v=>[v.id,v.ordinal]),[['voice-1',1],['voice-new',2]]);
});

test('REMOVE_EMPTY_VOICE removes only an empty non-last voice and renumbers siblings',()=>{
  const base=makeScore();
  const added=executeStructuralAuthoring(base,notation(base),intent('ADD_EMPTY_VOICE',addressEntity(base,'measure-1'),{voiceId:'voice-new'}),identity('rev-add'));
  const removed=executeStructuralAuthoring(added.score,added.notation,intent('REMOVE_EMPTY_VOICE',addressEntity(added.score,'voice-1')),identity('rev-remove'));
  assert.deepEqual(removed.score.parts[0].staves[0].measures[0].voices.map(v=>[v.id,v.ordinal]),[['voice-new',1]]);
});

test('REMOVE_EMPTY_MEASURE rejects last measure, nonempty measure and measure notation orphaning',()=>{
  const s=makeScore();
  const withNotation=notation(s,[{target:addressEntity(s,'measure-1'),notation:{timeSignature:{beats:4,beatType:4},keySignature:null,clef:null,barlines:[]}}]);
  assert.throws(()=>executeStructuralAuthoring(s,withNotation,intent('REMOVE_EMPTY_MEASURE',addressEntity(s,'measure-1')),identity('rev-note-orphan')),(e)=>e instanceof StructuralAuthoringError&&e.code==='NOTATION_ORPHAN_RISK');

  const one=createScoreDocument({...s,parts:[{...s.parts[0],staves:[{...s.parts[0].staves[0],measures:[s.parts[0].staves[0].measures[0]]}]}]});
  assert.throws(()=>executeStructuralAuthoring(one,notation(one),intent('REMOVE_EMPTY_MEASURE',addressEntity(one,'measure-1')),identity('rev-last')),(e)=>e instanceof StructuralAuthoringError&&e.code==='REMOVE_LAST_CHILD');

  const nonempty=createScoreDocument({...s,parts:[{...s.parts[0],staves:[{...s.parts[0].staves[0],measures:[{...s.parts[0].staves[0].measures[0],voices:[{id:'voice-1',ordinal:1,events:[{id:'rest-1',kind:'rest',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:4}}]}]},s.parts[0].staves[0].measures[1]]}]}]});
  assert.throws(()=>executeStructuralAuthoring(nonempty,notation(nonempty),intent('REMOVE_EMPTY_MEASURE',addressEntity(nonempty,'measure-1')),identity('rev-nonempty')),(e)=>e instanceof StructuralAuthoringError&&e.code==='REMOVE_NONEMPTY');
});

test('fresh structural IDs are globally enforced',()=>{
  const s=makeScore();
  assert.throws(()=>executeStructuralAuthoring(s,notation(s),intent('ADD_EMPTY_VOICE',addressEntity(s,'measure-1'),{voiceId:'measure-2'}),identity('rev-conflict')),(e)=>e instanceof StructuralAuthoringError&&e.code==='ID_CONFLICT');
});

test('structural authoring composes as one unified history revision',()=>{
  const s=makeScore(); const n=notation(s);
  const r=executeStructuralAuthoring(s,n,intent('ADD_MEASURE_AFTER',addressEntity(s,'measure-1'),{measureId:'measure-new',initialVoiceId:'voice-new',displayNumber:null}),identity('rev-history'));
  const h=commitEditorHistory(createEditorHistory(s,n),r.score,r.notation);
  assert.equal(h.present.score.parts[0].staves[0].measures.length,3);
  const u=undoEditorHistory(h); assert.equal(u.present.score.parts[0].staves[0].measures.length,2);
  const rr=redoEditorHistory(u); assert.equal(rr.present.score.parts[0].staves[0].measures.length,3);
});
