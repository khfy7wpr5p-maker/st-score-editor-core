import test from 'node:test';
import assert from 'node:assert/strict';
import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { addressEntity, createSelectionSnapshot } from '../dist/packages/addressing/src/index.js';
import { emptyNotationDocument } from '../dist/packages/notation-structure/src/index.js';
import { EditorNotationIntentError, executeEditorNotationIntent, parseEditorNotationIntent } from '../dist/packages/editor-notation-intents/src/index.js';

const score=(revisionId='rev-1')=>createScoreDocument({
  schemaVersion:'1.0.0',id:'doc-1',revision:{id:revisionId,parentId:revisionId==='rev-1'?null:'rev-1'},source:{sha256:'a'.repeat(64),format:'canonical',byteLength:null},
  parts:[{id:'part-1',name:'Piano',staves:[{id:'staff-1',ordinal:1,measures:[{id:'measure-1',ordinal:1,displayNumber:'1',voices:[{id:'voice-1',ordinal:1,events:[{id:'event-1',kind:'note',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:4},note:{id:'note-1',pitch:{step:'F',alter:1,octave:4}}}]}]}]}]}]
});
const ids=(suffix)=>({transactionId:`ntx-${suffix}`,commandId:`ncmd-${suffix}`,nextRevisionId:`rev-${suffix}`});

test('note selection can deterministically set accidental and advance unified revision',()=>{
  const s=score();const n=emptyNotationDocument(s);const selection=createSelectionSnapshot(s,addressEntity(s,'note-1'));
  const result=executeEditorNotationIntent(s,n,selection,{version:'1.0.0',type:'SET_ACCIDENTAL',value:'sharp'},ids('2'));
  assert.equal(result.score.revision.id,'rev-2');
  assert.equal(result.notation.revisionId,'rev-2');
  assert.equal(result.notation.notes[0].notation.accidental,'sharp');
  assert.equal(result.notation.notes[0].target.revisionId,'rev-2');
});

test('note selection may deterministically resolve parent event and measure for dots and clef',()=>{
  const s=score();let n=emptyNotationDocument(s);let selection=createSelectionSnapshot(s,addressEntity(s,'note-1'));
  const dotted=executeEditorNotationIntent(s,n,selection,{version:'1.0.0',type:'SET_DOTS',value:1},ids('dots'));
  assert.equal(dotted.notation.events[0].notation.dots,1);
  const s2=dotted.score;n=dotted.notation;selection=createSelectionSnapshot(s2,addressEntity(s2,'note-1'));
  const clef=executeEditorNotationIntent(s2,n,selection,{version:'1.0.0',type:'SET_CLEF',value:{sign:'G',line:2,octaveChange:0}},{transactionId:'ntx-clef',commandId:'ncmd-clef',nextRevisionId:'rev-clef'});
  assert.equal(clef.notation.measures[0].notation.clef.sign,'G');
});

test('wrong selection kind fails closed instead of guessing a target',()=>{
  const s=score();const n=emptyNotationDocument(s);const selection=createSelectionSnapshot(s,addressEntity(s,'measure-1'));
  assert.throws(()=>executeEditorNotationIntent(s,n,selection,{version:'1.0.0',type:'SET_TIES',value:[{number:1,type:'start'}]},ids('bad')),(error)=>error instanceof EditorNotationIntentError&&error.code==='SELECTION_KIND');
});

test('stale selection and stale notation fail closed',()=>{
  const old=score();const oldNotation=emptyNotationDocument(old);const oldSelection=createSelectionSnapshot(old,addressEntity(old,'note-1'));const current=score('rev-current');const currentNotation=emptyNotationDocument(current);
  assert.throws(()=>executeEditorNotationIntent(current,currentNotation,oldSelection,{version:'1.0.0',type:'SET_DOTS',value:1},ids('stale-selection')),(error)=>error instanceof EditorNotationIntentError&&error.code==='STALE_SELECTION');
  const currentSelection=createSelectionSnapshot(current,addressEntity(current,'note-1'));
  assert.throws(()=>executeEditorNotationIntent(current,oldNotation,currentSelection,{version:'1.0.0',type:'SET_DOTS',value:1},ids('stale-notation')),(error)=>error instanceof EditorNotationIntentError&&error.code==='STALE_NOTATION');
});

test('unknown UI fields, invalid denominator and coordinate injection are rejected before transaction creation',()=>{
  assert.throws(()=>parseEditorNotationIntent({version:'1.0.0',type:'SET_DOTS',value:1,x:100}),(error)=>error instanceof EditorNotationIntentError&&error.code==='INVALID_INTENT');
  assert.throws(()=>parseEditorNotationIntent({version:'1.0.0',type:'SET_TIME_SIGNATURE',value:{beats:4,beatType:3}}),(error)=>error instanceof EditorNotationIntentError&&error.code==='INVALID_INTENT');
  assert.throws(()=>parseEditorNotationIntent({version:'1.0.0',type:'SET_CLEF',value:{sign:'G',line:2,octaveChange:0,domId:'glyph-1'}}),(error)=>error instanceof EditorNotationIntentError&&error.code==='INVALID_INTENT');
});
