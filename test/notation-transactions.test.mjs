import test from 'node:test';
import assert from 'node:assert/strict';
import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { addressEntity } from '../dist/packages/addressing/src/index.js';
import { createNotationDocument, emptyNotationDocument } from '../dist/packages/notation-structure/src/index.js';
import { applyNotationTransaction, NotationTransactionError } from '../dist/packages/notation-commands/src/index.js';

const score=()=>createScoreDocument({
  schemaVersion:'1.0.0',id:'doc-1',revision:{id:'rev-1',parentId:null},source:{sha256:'a'.repeat(64),format:'canonical',byteLength:null},
  parts:[{id:'part-1',name:'Violin',staves:[{id:'staff-1',ordinal:1,measures:[{id:'measure-1',ordinal:1,displayNumber:'1',voices:[{id:'voice-1',ordinal:1,events:[
    {id:'event-1',kind:'note',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:8},note:{id:'note-1',pitch:{step:'C',alter:0,octave:4}}},
    {id:'event-2',kind:'note',onset:{numerator:1,denominator:8},duration:{numerator:1,denominator:8},note:{id:'note-2',pitch:{step:'D',alter:0,octave:4}}}
  ]}]}]}]}]
});

const tx=(s,commands,next='rev-2')=>({contractVersion:'1.0.0',transactionId:'ntx-1',documentId:s.id,baseRevisionId:s.revision.id,nextRevisionId:next,commands});

test('one notation transaction atomically updates clef dots and tie on a new unified revision',()=>{
  const s=score(); const n=emptyNotationDocument(s);
  const result=applyNotationTransaction(s,n,tx(s,[
    {commandVersion:'1.0.0',commandId:'c1',type:'SET_CLEF',target:addressEntity(s,'measure-1'),value:{sign:'G',line:2,octaveChange:0}},
    {commandVersion:'1.0.0',commandId:'c2',type:'SET_DOTS',target:addressEntity(s,'event-1'),value:1},
    {commandVersion:'1.0.0',commandId:'c3',type:'SET_TIES',target:addressEntity(s,'note-1'),value:[{number:1,type:'start'}]}
  ]));
  assert.equal(result.score.revision.id,'rev-2');
  assert.equal(result.score.revision.parentId,'rev-1');
  assert.equal(result.notation.revisionId,'rev-2');
  assert.equal(result.notation.measures[0].notation.clef.sign,'G');
  assert.equal(result.notation.events[0].notation.dots,1);
  assert.equal(result.notation.notes[0].notation.ties[0].type,'start');
  assert.equal(result.notation.notes[0].target.revisionId,'rev-2');
  assert.equal(s.revision.id,'rev-1');
  assert.equal(n.notes.length,0);
});

test('invalid later notation command rejects whole transaction with no partial result',()=>{
  const s=score(); const n=emptyNotationDocument(s);
  assert.throws(()=>applyNotationTransaction(s,n,tx(s,[
    {commandVersion:'1.0.0',commandId:'c1',type:'SET_DOTS',target:addressEntity(s,'event-1'),value:1},
    {commandVersion:'1.0.0',commandId:'c2',type:'SET_TIME_SIGNATURE',target:addressEntity(s,'measure-1'),value:{beats:4,beatType:3}}
  ])),(error)=>error instanceof NotationTransactionError&&error.code==='RESULT_INVALID');
  assert.equal(n.events.length,0);
  assert.equal(s.revision.id,'rev-1');
});

test('stale notation document or transaction fails closed',()=>{
  const s=score();
  const staleNotation=createNotationDocument(s,{contractVersion:'1.0.0',documentId:s.id,revisionId:s.revision.id,measures:[],events:[],notes:[]});
  const current=createScoreDocument({...s,revision:{id:'rev-current',parentId:'rev-1'}});
  assert.throws(()=>applyNotationTransaction(current,staleNotation,{contractVersion:'1.0.0',transactionId:'ntx-stale',documentId:current.id,baseRevisionId:current.revision.id,nextRevisionId:'rev-next',commands:[{commandVersion:'1.0.0',commandId:'c1',type:'SET_DOTS',target:addressEntity(current,'event-1'),value:1}]}),(error)=>error instanceof NotationTransactionError&&error.code==='STALE_TRANSACTION');
});

test('wrong target kind and duplicate command ids fail closed before mutation',()=>{
  const s=score(); const n=emptyNotationDocument(s);
  assert.throws(()=>applyNotationTransaction(s,n,tx(s,[{commandVersion:'1.0.0',commandId:'c1',type:'SET_CLEF',target:addressEntity(s,'event-1'),value:{sign:'G',line:2,octaveChange:0}}])),(error)=>error instanceof NotationTransactionError&&error.code==='TARGET_KIND');
  assert.throws(()=>applyNotationTransaction(s,n,tx(s,[
    {commandVersion:'1.0.0',commandId:'dup',type:'SET_DOTS',target:addressEntity(s,'event-1'),value:1},
    {commandVersion:'1.0.0',commandId:'dup',type:'SET_DOTS',target:addressEntity(s,'event-2'),value:1}
  ])),(error)=>error instanceof NotationTransactionError&&error.code==='INVALID_TRANSACTION');
});
