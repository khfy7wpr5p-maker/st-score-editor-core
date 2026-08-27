import test from 'node:test';
import assert from 'node:assert/strict';
import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { addressEntity, createSelectionSnapshot } from '../dist/packages/addressing/src/index.js';
import { createNotationDocument } from '../dist/packages/notation-structure/src/index.js';
import { executeEditorScoreIntent } from '../dist/packages/editor-score-intents/src/index.js';
import { executeEditorNotationIntent } from '../dist/packages/editor-notation-intents/src/index.js';
import { EditorHistoryError, commitEditorHistory, createEditorHistory, rebindNotationAfterScoreEdit } from '../dist/packages/editor-history/src/index.js';
import { createAccessibilityModel, interpretKeyboardGesture, nextFocusRegion } from '../dist/packages/editor-accessibility/src/index.js';
import { createPersistenceIndicator, navigateEditorHistory } from '../dist/packages/editor-session-safety/src/index.js';

const score=()=>createScoreDocument({
  schemaVersion:'1.0.0',id:'doc-1',revision:{id:'rev-1',parentId:null},source:{sha256:'a'.repeat(64),format:'canonical',byteLength:null},
  parts:[{id:'part-1',name:'Violin',staves:[{id:'staff-1',ordinal:1,measures:[{id:'measure-1',ordinal:1,displayNumber:'1',voices:[{id:'voice-1',ordinal:1,events:[{id:'event-1',kind:'note',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:4},note:{id:'note-1',pitch:{step:'C',alter:0,octave:4}}}]}]}]}]}]
});
const notation=(s)=>createNotationDocument(s,{contractVersion:'1.0.0',documentId:s.id,revisionId:s.revision.id,measures:[],events:[],notes:[{target:addressEntity(s,'note-1'),notation:{accidental:'natural',ties:[],slurs:[]}}]});

test('score edit safely rebinds surviving notation and unified history stores both',()=>{
  const s=score();const n=notation(s);const selection=createSelectionSnapshot(s,addressEntity(s,'note-1'));
  const nextScore=executeEditorScoreIntent(s,selection,{version:'1.0.0',type:'SET_PITCH',pitch:{step:'D',alter:0,octave:4}},{transactionId:'tx-pitch',commandId:'cmd-pitch',nextRevisionId:'rev-2'});
  const nextNotation=rebindNotationAfterScoreEdit(s,n,nextScore);
  assert.equal(nextNotation.revisionId,'rev-2');
  assert.equal(nextNotation.notes[0].target.revisionId,'rev-2');
  assert.equal(nextNotation.notes[0].notation.accidental,'natural');
  const history=commitEditorHistory(createEditorHistory(s,n),nextScore,nextNotation);
  assert.equal(history.present.score.revision.id,'rev-2');
  assert.equal(history.present.notation.revisionId,'rev-2');
});

test('score edit that deletes a notated note fails notation rebind instead of silently losing it',()=>{
  const s=score();const n=notation(s);const selection=createSelectionSnapshot(s,addressEntity(s,'note-1'));
  const restScore=executeEditorScoreIntent(s,selection,{version:'1.0.0',type:'REPLACE_WITH_REST'},{transactionId:'tx-rest',commandId:'cmd-rest',nextRevisionId:'rev-rest'});
  assert.throws(()=>rebindNotationAfterScoreEdit(s,n,restScore),(error)=>error instanceof EditorHistoryError&&error.code==='NOTATION_TARGET_DISAPPEARED');
});

test('notation edit commits into same unified history and undo clears stale selection',()=>{
  const s=score();const n=notation(s);const selection=createSelectionSnapshot(s,addressEntity(s,'note-1'));
  const edited=executeEditorNotationIntent(s,n,selection,{version:'1.0.0',type:'SET_TIES',value:[{number:1,type:'start'}]},{transactionId:'ntx-tie',commandId:'ncmd-tie',nextRevisionId:'rev-tie'});
  const history=commitEditorHistory(createEditorHistory(s,n),edited.score,edited.notation);
  const transition=navigateEditorHistory(history,createSelectionSnapshot(edited.score,addressEntity(edited.score,'note-1')),'UNDO');
  assert.equal(transition.history.present.score.revision.id,'rev-1');
  assert.equal(transition.history.present.notation.revisionId,'rev-1');
  assert.equal(transition.selection,null);
  assert.equal(transition.status.code,'UNDO_APPLIED');
});

test('keyboard gestures create typed navigation requests, never score commands',()=>{
  const undo=interpretKeyboardGesture({key:'z',altKey:false,ctrlKey:true,metaKey:false,shiftKey:false});
  const redo=interpretKeyboardGesture({key:'Z',altKey:false,ctrlKey:false,metaKey:true,shiftKey:true});
  assert.deepEqual(undo,{type:'REQUEST_UNDO'});
  assert.deepEqual(redo,{type:'REQUEST_REDO'});
  assert.equal(Object.prototype.hasOwnProperty.call(undo,'commandVersion'),false);
  assert.equal(interpretKeyboardGesture({key:'d',altKey:false,ctrlKey:false,metaKey:false,shiftKey:false}),null);
  assert.equal(nextFocusRegion('status',1),'toolbar');
});

test('accessibility status and dirty indicator are presentation-only',()=>{
  const s=score();const n=notation(s);const history=createEditorHistory(s,n);
  const model=createAccessibilityModel({level:'error',code:'X',message:'Edit rejected.'});
  assert.equal(model.announcement.politeness,'assertive');
  assert.equal(model.regions.find((region)=>region.region==='score').label,'Score editor');
  const dirty=createPersistenceIndicator(history,null);
  assert.equal(dirty.dirty,true);
  assert.equal(dirty.persistenceAuthority,false);
});
