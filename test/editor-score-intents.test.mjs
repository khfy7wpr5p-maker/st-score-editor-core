import test from 'node:test';
import assert from 'node:assert/strict';
import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { addressEntity, createSelectionSnapshot } from '../dist/packages/addressing/src/index.js';
import { EditorIntentError, executeEditorScoreIntent, parseEditorScoreIntent } from '../dist/packages/editor-score-intents/src/index.js';

const makeScore = (revisionId='rev-1') => createScoreDocument({
  schemaVersion:'1.0.0',id:'doc-1',revision:{id:revisionId,parentId:revisionId==='rev-1'?null:'rev-1'},source:{sha256:'a'.repeat(64),format:'canonical',byteLength:null},
  parts:[{id:'part-1',name:'Piano',staves:[{id:'staff-1',ordinal:1,measures:[{id:'measure-1',ordinal:1,displayNumber:'1',voices:[{id:'voice-1',ordinal:1,events:[
    {id:'event-1',kind:'note',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:4},note:{id:'note-1',pitch:{step:'C',alter:0,octave:4}}},
    {id:'event-2',kind:'rest',onset:{numerator:1,denominator:4},duration:{numerator:1,denominator:4}}
  ]}]}]}]}]
});

const ids=(suffix)=>({transactionId:`tx-${suffix}`,commandId:`cmd-${suffix}`,nextRevisionId:`rev-${suffix}`});

test('SET_PITCH intent commits through E4 and creates immutable new revision',()=>{
  const score=makeScore();
  const selection=createSelectionSnapshot(score,addressEntity(score,'note-1'));
  const next=executeEditorScoreIntent(score,selection,{version:'1.0.0',type:'SET_PITCH',pitch:{step:'D',alter:1,octave:4}},ids('2'));
  assert.equal(next.revision.id,'rev-2');
  assert.equal(next.revision.parentId,'rev-1');
  assert.equal(next.parts[0].staves[0].measures[0].voices[0].events[0].note.pitch.step,'D');
  assert.equal(score.parts[0].staves[0].measures[0].voices[0].events[0].note.pitch.step,'C');
  assert.equal(Object.isFrozen(next),true);
});

test('SET_DURATION can derive the parent event from a current note selection',()=>{
  const score=makeScore();
  const selection=createSelectionSnapshot(score,addressEntity(score,'note-1'));
  const next=executeEditorScoreIntent(score,selection,{version:'1.0.0',type:'SET_DURATION',duration:{numerator:1,denominator:8}},ids('duration'));
  assert.deepEqual(next.parts[0].staves[0].measures[0].voices[0].events[0].duration,{numerator:1,denominator:8});
});

test('rest selection can be replaced with a note only through typed intent',()=>{
  const score=makeScore();
  const selection=createSelectionSnapshot(score,addressEntity(score,'event-2'));
  const next=executeEditorScoreIntent(score,selection,{version:'1.0.0',type:'REPLACE_REST_WITH_NOTE',noteId:'note-2',pitch:{step:'E',alter:0,octave:4}},ids('rest'));
  const event=next.parts[0].staves[0].measures[0].voices[0].events[1];
  assert.equal(event.kind,'note');
  assert.equal(event.note.id,'note-2');
});

test('stale selection fails closed and is never auto-retargeted',()=>{
  const old=makeScore('rev-1');
  const selection=createSelectionSnapshot(old,addressEntity(old,'note-1'));
  const current=makeScore('rev-current');
  assert.throws(()=>executeEditorScoreIntent(current,selection,{version:'1.0.0',type:'SET_PITCH',pitch:{step:'D',alter:0,octave:4}},ids('stale')),(error)=>error instanceof EditorIntentError&&error.code==='STALE_SELECTION');
});

test('unknown browser fields and non-canonical duration are rejected before transaction creation',()=>{
  assert.throws(()=>parseEditorScoreIntent({version:'1.0.0',type:'SET_PITCH',pitch:{step:'D',alter:0,octave:4},x:100}), (error)=>error instanceof EditorIntentError&&error.code==='INVALID_INTENT');
  assert.throws(()=>parseEditorScoreIntent({version:'1.0.0',type:'SET_DURATION',duration:{numerator:2,denominator:8}}), (error)=>error instanceof EditorIntentError&&error.code==='INVALID_INTENT');
});
