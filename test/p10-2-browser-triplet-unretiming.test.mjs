import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createNewScoreEditorAppDocument } from '../dist/packages/score-editor-app-document/src/index.js';
import { createEditorSessionV4 } from '../dist/packages/editor-session-controller-v4/src/index.js';
import { executeStraightThreeToTripletAuthoringV4 } from '../dist/packages/editor-tuplet-retiming-authoring-v4/src/index.js';
import { createStandaloneScoreEditorController } from '../dist/packages/score-editor-browser-app/src/index.js';

const ids=()=>{let n=0;return()=>`p10-2-browser-${++n}`;};
const note=(id,noteId,onset,duration,step)=>({
  id,kind:'note',onset,duration,note:{id:noteId,pitch:{step,alter:0,octave:4}}
});
const rest=(id,onset,duration)=>({id,kind:'rest',onset,duration});

const tripletDocument=()=>{
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
  const triplet=executeStraightThreeToTripletAuthoringV4(
    score,notation,
    {
      version:'1.0.0',type:'RETIMING_STRAIGHT_THREE_TO_TRIPLET',
      targets:['e1','e2','e3'].map(id=>addressEntityV3(score,id))
    },
    {nextRevisionId:'p10-2-browser-triplet'}
  );
  return Object.freeze({
    version:'1.0.0',
    title:'Browser Triplet',
    origin:'NEW',
    session:createEditorSessionV4(triplet.score,triplet.notation),
    savedRevisionId:triplet.score.revision.id,
    dirty:false
  });
};

test('P10-2 base browser controller delegates Triplet unretiming through the app mutation path',()=>{
  const controller=createStandaloneScoreEditorController();
  controller.adoptValidatedSnapshot(tripletDocument());
  assert.equal(
    typeof controller.commitTupletUnretiming,
    'function',
    'browser base must expose the bounded inverse commit entry point'
  );

  const current=controller.getDocument();
  const intent={
    version:'1.0.0',
    type:'UNRETIMING_TRIPLET_TO_STRAIGHT_THREE',
    targets:['e1','e2','e3'].map(id=>addressEntityV3(current.session.history.present.score,id))
  };
  const snapshot=controller.commitTupletUnretiming(
    intent,{nextRevisionId:'p10-2-browser-straight'}
  );
  assert.equal(snapshot.error,null);
  assert.equal(snapshot.revisionId,'p10-2-browser-straight');
  assert.equal(snapshot.statusCode,'TRIPLET_UNRETIMING_COMMITTED');
  assert.equal(controller.getDocument().session.history.past.length,1);
});
