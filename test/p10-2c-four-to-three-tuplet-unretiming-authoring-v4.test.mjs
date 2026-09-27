import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createNewScoreEditorAppDocument } from '../dist/packages/score-editor-app-document/src/index.js';

const ids=()=>{let n=0;return()=>`p10-2c-${++n}`;};
const note=(id,noteId,onset,duration,step)=>({
  id,kind:'note',onset,duration,note:{id:noteId,pitch:{step,alter:0,octave:4}}
});
const rest=(id,onset,duration)=>({id,kind:'rest',onset,duration});
const eventNotation=(overrides={})=>({
  dots:0,beams:[],tuplet:null,articulations:[],ornaments:[],...overrides
});
const fourToThree=(position,number=1)=>eventNotation({
  tuplet:{
    actualNotes:4,
    normalNotes:3,
    marks:position==='middle'?[]:[{number,type:position}]
  }
});

const fixture=(restDuration={numerator:1,denominator:8})=>{
  const document=createNewScoreEditorAppDocument({idFactory:ids(),preset:'GUITAR_TREBLE'});
  const baseScore=document.session.history.present.score;
  const baseNotation=document.session.history.present.notation;
  const raw=structuredClone(baseScore);
  const staff=raw.parts[0].staves.find(candidate=>candidate.role==='standard');
  staff.measures[0].voices[0].events=[
    note('e1','n1',{numerator:0,denominator:1},{numerator:3,denominator:32},'C'),
    note('e2','n2',{numerator:3,denominator:32},{numerator:3,denominator:32},'D'),
    note('e3','n3',{numerator:3,denominator:16},{numerator:3,denominator:32},'E'),
    note('e4','n4',{numerator:9,denominator:32},{numerator:3,denominator:32},'F'),
    rest('r1',{numerator:3,denominator:8},restDuration)
  ];
  const score=createScoreDocumentV3(raw);
  const notation=createNotationDocumentV4(score,{
    contractVersion:'4.0.0',
    documentId:score.id,
    revisionId:score.revision.id,
    frames:baseNotation.frames.map(entry=>({
      target:addressEntityV3(score,entry.target.frameId),
      notation:entry.notation
    })),
    measures:baseNotation.measures.map(entry=>({
      target:addressEntityV3(score,entry.target.measureId),
      notation:entry.notation
    })),
    events:[
      {target:addressEntityV3(score,'e1'),notation:fourToThree('start')},
      {target:addressEntityV3(score,'e2'),notation:fourToThree('middle')},
      {target:addressEntityV3(score,'e3'),notation:fourToThree('middle')},
      {target:addressEntityV3(score,'e4'),notation:fourToThree('stop')}
    ],
    notes:[],
    graceEvents:[],
    graceNotes:[],
    crossStaffPlacements:[]
  });
  return {score,notation};
};

const intent=score=>({
  version:'1.0.0',
  type:'UNRETIMING_FOUR_TO_THREE_TO_STRAIGHT_FOUR',
  targets:['e1','e2','e3','e4'].map(id=>addressEntityV3(score,id))
});

test('P10-2C exposes exact 4:3 unretiming and atomically restores straight four timing',async()=>{
  const module=await import('../dist/packages/editor-four-to-three-tuplet-unretiming-authoring-v4/src/index.js').catch(()=>({}));
  assert.equal(
    typeof module.executeFourToThreeTupletToStraightFourUnretimingV4,
    'function',
    'P10-2C exact 4:3 authoring API must exist'
  );

  const {score,notation}=fixture();
  const beforeScore=structuredClone(score);
  const beforeNotation=structuredClone(notation);
  const result=module.executeFourToThreeTupletToStraightFourUnretimingV4(
    score,notation,intent(score),{nextRevisionId:'p10-2c-straight'}
  );

  const voice=result.score.parts[0].staves.find(staff=>staff.role==='standard').measures[0].voices[0];
  assert.equal(result.score.revision.id,'p10-2c-straight');
  assert.equal(result.score.revision.parentId,score.revision.id);
  assert.equal(result.notation.revisionId,'p10-2c-straight');
  assert.deepEqual(voice.events.map(event=>event.id),['e1','e2','e3','e4']);
  assert.deepEqual(voice.events.map(event=>event.onset),[
    {numerator:0,denominator:1},
    {numerator:1,denominator:8},
    {numerator:1,denominator:4},
    {numerator:3,denominator:8}
  ]);
  assert.deepEqual(voice.events.map(event=>event.duration),[
    {numerator:1,denominator:8},
    {numerator:1,denominator:8},
    {numerator:1,denominator:8},
    {numerator:1,denominator:8}
  ]);
  assert.deepEqual(voice.events.map(event=>event.note.id),['n1','n2','n3','n4']);
  assert.deepEqual(
    ['e1','e2','e3','e4'].map(eventId=>
      result.notation.events.find(entry=>entry.target.eventId===eventId)?.notation.tuplet??null
    ),
    [null,null,null,null]
  );
  assert.equal(result.selection.kind,'event');
  assert.equal(result.selection.eventId,'e1');
  assert.equal(result.selection.revisionId,'p10-2c-straight');
  assert.equal(result.admission.admitted,true);
  assert.equal(result.admission.reason,'ADMITTED_4_TO_3_TO_STRAIGHT_FOUR');
  assert.deepEqual(score,beforeScore);
  assert.deepEqual(notation,beforeNotation);
});
