import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createNewScoreEditorAppDocument } from '../dist/packages/score-editor-app-document/src/index.js';
import {
  createEditorSessionV4,
  navigateSessionHistoryV4
} from '../dist/packages/editor-session-controller-v4/src/index.js';
import { commitSessionStraightThreeToTripletV4 } from '../dist/packages/editor-session-tuplet-retiming-v4/src/index.js';
import { commitScoreEditorAppStraightThreeToTripletV4 } from '../dist/packages/score-editor-app-tuplet-retiming/src/index.js';

const ids=()=>{let n=0;return()=>`app11i-${++n}`;};
const note=(id,noteId,onset,duration,step)=>({id,kind:'note',onset,duration,note:{id:noteId,pitch:{step,alter:0,octave:4}}});
const rest=(id,onset,duration)=>({id,kind:'rest',onset,duration});

const fixture=()=>{
  const document=createNewScoreEditorAppDocument({idFactory:ids(),preset:'GUITAR_TREBLE'});
  const baseScore=document.session.history.present.score;
  const baseNotation=document.session.history.present.notation;
  const raw=structuredClone(baseScore);
  raw.parts[0].staves[0].measures[0].voices[0].events=[
    note('e1','n1',{numerator:0,denominator:1},{numerator:1,denominator:8},'C'),
    note('e2','n2',{numerator:1,denominator:8},{numerator:1,denominator:8},'D'),
    note('e3','n3',{numerator:1,denominator:4},{numerator:1,denominator:8},'E'),
    rest('tail',{numerator:3,denominator:8},{numerator:5,denominator:8})
  ];
  const score=createScoreDocumentV3(raw);
  const notation=createNotationDocumentV4(score,{
    contractVersion:'4.0.0',documentId:score.id,revisionId:score.revision.id,
    frames:baseNotation.frames.map(entry=>({target:addressEntityV3(score,entry.target.frameId),notation:entry.notation})),
    measures:baseNotation.measures.map(entry=>({target:addressEntityV3(score,entry.target.measureId),notation:entry.notation})),
    events:[],notes:[],graceEvents:[],graceNotes:[],crossStaffPlacements:[]
  });
  const intent={
    version:'1.0.0',type:'RETIMING_STRAIGHT_THREE_TO_TRIPLET',
    targets:['e1','e2','e3'].map(id=>addressEntityV3(score,id))
  };
  return {score,notation,intent};
};

const voice=session=>session.history.present.score.parts[0].staves[0].measures[0].voices[0];
const tuplets=session=>['e1','e2','e3'].map(eventId=>
  session.history.present.notation.events.find(entry=>entry.target.eventId===eventId)?.notation.tuplet??null
);

test('APP-11I session wrapper commits atomic triplet retiming as exactly one EditorSessionV4 history revision and Undo restores exact pair',()=>{
  const {score,notation,intent}=fixture();
  let session=createEditorSessionV4(score,notation);
  const beforeScore=structuredClone(session.history.present.score);
  const beforeNotation=structuredClone(session.history.present.notation);
  assert.equal(session.history.past.length,0);

  session=commitSessionStraightThreeToTripletV4(session,intent,{nextRevisionId:'app11i-session-next'});
  assert.equal(session.history.past.length,1);
  assert.equal(session.history.future.length,0);
  assert.equal(session.history.present.score.revision.id,'app11i-session-next');
  assert.equal(session.status.code,'TRIPLET_RETIMING_COMMITTED');
  assert.equal(session.selection.kind,'event');
  assert.equal(session.selection.eventId,'e1');
  assert.equal(session.selection.revisionId,'app11i-session-next');
  assert.deepEqual(voice(session).events.slice(0,3).map(event=>event.duration),[
    {numerator:1,denominator:12},{numerator:1,denominator:12},{numerator:1,denominator:12}
  ]);
  assert.deepEqual(tuplets(session),[
    {actualNotes:3,normalNotes:2,marks:[{number:1,type:'start'}]},
    {actualNotes:3,normalNotes:2,marks:[]},
    {actualNotes:3,normalNotes:2,marks:[{number:1,type:'stop'}]}
  ]);

  session=navigateSessionHistoryV4(session,'UNDO');
  assert.deepEqual(session.history.present.score,beforeScore);
  assert.deepEqual(session.history.present.notation,beforeNotation);
  assert.equal(session.history.past.length,0);
  assert.equal(session.history.future.length,1);
  assert.equal(session.selection,null);
});

test('APP-11I app wrapper preserves document metadata and dirty semantics while committing through unified history',()=>{
  const {score,notation,intent}=fixture();
  const session=createEditorSessionV4(score,notation);
  const app=Object.freeze({
    version:'1.0.0',title:'Triplet Test',origin:'NEW',session,savedRevisionId:score.revision.id,dirty:false
  });
  const next=commitScoreEditorAppStraightThreeToTripletV4(app,intent,{nextRevisionId:'app11i-app-next'});
  assert.equal(next.title,'Triplet Test');
  assert.equal(next.origin,'NEW');
  assert.equal(next.savedRevisionId,score.revision.id);
  assert.equal(next.dirty,true);
  assert.equal(next.session.history.past.length,1);
  assert.equal(next.session.history.present.score.revision.id,'app11i-app-next');
  assert.equal(next.session.status.code,'TRIPLET_RETIMING_COMMITTED');
});
