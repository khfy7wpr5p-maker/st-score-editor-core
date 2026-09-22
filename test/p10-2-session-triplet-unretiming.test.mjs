import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createNewScoreEditorAppDocument } from '../dist/packages/score-editor-app-document/src/index.js';
import { createEditorSessionV4, navigateSessionHistoryV4 } from '../dist/packages/editor-session-controller-v4/src/index.js';
import { executeStraightThreeToTripletAuthoringV4 } from '../dist/packages/editor-tuplet-retiming-authoring-v4/src/index.js';

const ids=()=>{let n=0;return()=>`p10-2-session-${++n}`;};
const note=(id,noteId,onset,duration,step)=>({
  id,kind:'note',onset,duration,note:{id:noteId,pitch:{step,alter:0,octave:4}}
});
const rest=(id,onset,duration)=>({id,kind:'rest',onset,duration});

const tripletFixture=()=>{
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
  const straightScore=createScoreDocumentV3(raw);
  const straightNotation=createNotationDocumentV4(straightScore,{
    contractVersion:'4.0.0',
    documentId:straightScore.id,
    revisionId:straightScore.revision.id,
    frames:baseNotation.frames.map(entry=>({target:addressEntityV3(straightScore,entry.target.frameId),notation:entry.notation})),
    measures:baseNotation.measures.map(entry=>({target:addressEntityV3(straightScore,entry.target.measureId),notation:entry.notation})),
    events:[],notes:[],graceEvents:[],graceNotes:[],crossStaffPlacements:[]
  });
  const forward=executeStraightThreeToTripletAuthoringV4(
    straightScore,
    straightNotation,
    {
      version:'1.0.0',
      type:'RETIMING_STRAIGHT_THREE_TO_TRIPLET',
      targets:['e1','e2','e3'].map(id=>addressEntityV3(straightScore,id))
    },
    {nextRevisionId:'p10-2-session-triplet'}
  );
  const intent={
    version:'1.0.0',
    type:'UNRETIMING_TRIPLET_TO_STRAIGHT_THREE',
    targets:['e1','e2','e3'].map(id=>addressEntityV3(forward.score,id))
  };
  return {score:forward.score,notation:forward.notation,intent};
};

test('P10-2 session commits Triplet unretiming as one history revision with exact Undo and Redo',async()=>{
  const module=await import('../dist/packages/editor-session-tuplet-unretiming-v4/src/index.js').catch(()=>({}));
  assert.equal(
    typeof module.commitSessionTripletToStraightThreeV4,
    'function',
    'P10-2 session inverse wrapper must exist'
  );

  const {score,notation,intent}=tripletFixture();
  let session=createEditorSessionV4(score,notation);
  const beforeScore=structuredClone(session.history.present.score);
  const beforeNotation=structuredClone(session.history.present.notation);

  session=module.commitSessionTripletToStraightThreeV4(
    session,intent,{nextRevisionId:'p10-2-session-straight'}
  );
  const afterScore=structuredClone(session.history.present.score);
  const afterNotation=structuredClone(session.history.present.notation);

  assert.equal(session.history.past.length,1);
  assert.equal(session.history.future.length,0);
  assert.equal(session.status.code,'TRIPLET_UNRETIMING_COMMITTED');
  assert.equal(session.selection.kind,'event');
  assert.equal(session.selection.eventId,'e1');
  assert.equal(session.selection.revisionId,'p10-2-session-straight');
  assert.equal(session.renderRequest.revisionId,'p10-2-session-straight');

  session=navigateSessionHistoryV4(session,'UNDO');
  assert.deepEqual(session.history.present.score,beforeScore);
  assert.deepEqual(session.history.present.notation,beforeNotation);
  assert.equal(session.history.past.length,0);
  assert.equal(session.history.future.length,1);

  session=navigateSessionHistoryV4(session,'REDO');
  assert.deepEqual(session.history.present.score,afterScore);
  assert.deepEqual(session.history.present.notation,afterNotation);
  assert.equal(session.history.past.length,1);
  assert.equal(session.history.future.length,0);
});

test('P10-2 app wrapper preserves metadata and dirty semantics while using unified history',async()=>{
  const module=await import('../dist/packages/score-editor-app-tuplet-unretiming/src/index.js').catch(()=>({}));
  assert.equal(
    typeof module.commitScoreEditorAppTripletToStraightThreeV4,
    'function',
    'P10-2 app inverse wrapper must exist'
  );

  const {score,notation,intent}=tripletFixture();
  const session=createEditorSessionV4(score,notation);
  const app=Object.freeze({
    version:'1.0.0',
    title:'Inverse Triplet',
    origin:'NEW',
    session,
    savedRevisionId:score.revision.id,
    dirty:false
  });
  const next=module.commitScoreEditorAppTripletToStraightThreeV4(
    app,intent,{nextRevisionId:'p10-2-app-straight'}
  );
  assert.equal(next.title,'Inverse Triplet');
  assert.equal(next.origin,'NEW');
  assert.equal(next.savedRevisionId,score.revision.id);
  assert.equal(next.dirty,true);
  assert.equal(next.session.history.past.length,1);
  assert.equal(next.session.history.present.score.revision.id,'p10-2-app-straight');
  assert.equal(next.session.status.code,'TRIPLET_UNRETIMING_COMMITTED');
});
