import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createNewScoreEditorAppDocument } from '../dist/packages/score-editor-app-document/src/index.js';
import {
  analyzeGeneralizedTupletToStraightV4,
  FOUR_TO_THREE_TUPLET_PROFILE_V4
} from '../dist/packages/editor-generalized-tuplet-admission-v4/src/index.js';

const ids=()=>{let n=0;return()=>`p10-2b-${++n}`;};
const pitch=(step='C',alter=0,octave=4)=>({step,alter,octave});
const note=(id,noteId,onset,duration,step='C')=>({id,kind:'note',onset,duration,note:{id:noteId,pitch:pitch(step)}});
const rest=(id,onset,duration)=>({id,kind:'rest',onset,duration});
const eventNotation=(overrides={})=>({dots:0,beams:[],tuplet:null,articulations:[],ornaments:[],...overrides});

const fourToThree=(position,number=1)=>eventNotation({
  tuplet:{
    actualNotes:4,
    normalNotes:3,
    marks:position==='middle'?[]:[{number,type:position}]
  }
});

const state=({
  events,
  eventNotationById={}
})=>{
  const document=createNewScoreEditorAppDocument({idFactory:ids(),preset:'GUITAR_TREBLE'});
  const baseScore=document.session.history.present.score;
  const baseNotation=document.session.history.present.notation;
  const raw=structuredClone(baseScore);
  const sourceStaff=raw.parts[0].staves.find(staff=>staff.role==='standard');
  sourceStaff.measures[0].voices[0].events=events;
  const score=createScoreDocumentV3(raw);
  const frames=baseNotation.frames.map(entry=>({
    target:addressEntityV3(score,entry.target.frameId),
    notation:entry.notation
  }));
  const measures=baseNotation.measures.map(entry=>({
    target:addressEntityV3(score,entry.target.measureId),
    notation:entry.notation
  }));
  const eventsNotation=Object.entries(eventNotationById).map(([eventId,notation])=>({
    target:addressEntityV3(score,eventId),notation
  }));
  const notation=createNotationDocumentV4(score,{
    contractVersion:'4.0.0',
    documentId:score.id,
    revisionId:score.revision.id,
    frames,
    measures,
    events:eventsNotation,
    notes:[],
    graceEvents:[],
    graceNotes:[],
    crossStaffPlacements:[]
  });
  return {score,notation};
};

const targets=(score,...eventIds)=>eventIds.map(eventId=>{
  const target=addressEntityV3(score,eventId);
  assert.equal(target.kind,'event');
  return target;
});

const eighthFourToThree=(restDuration={numerator:1,denominator:8})=>[
  note('e1','n1',{numerator:0,denominator:1},{numerator:3,denominator:32},'C'),
  note('e2','n2',{numerator:3,denominator:32},{numerator:3,denominator:32},'D'),
  note('e3','n3',{numerator:3,denominator:16},{numerator:3,denominator:32},'E'),
  note('e4','n4',{numerator:9,denominator:32},{numerator:3,denominator:32},'F'),
  rest('r1',{numerator:3,denominator:8},restDuration)
];

const fourToThreeNotationById=()=>({
  e1:fourToThree('start'),
  e2:fourToThree('middle'),
  e3:fourToThree('middle'),
  e4:fourToThree('stop')
});

test('P10-2B admits exact four-event 4:3 timing and returns immutable straight-four evidence',()=>{
  const {score,notation}=state({
    events:eighthFourToThree(),
    eventNotationById:fourToThreeNotationById()
  });
  const beforeScore=structuredClone(score);
  const beforeNotation=structuredClone(notation);
  const result=analyzeGeneralizedTupletToStraightV4(
    score,
    notation,
    targets(score,'e1','e2','e3','e4'),
    FOUR_TO_THREE_TUPLET_PROFILE_V4
  );

  assert.equal(result.admitted,true);
  assert.equal(result.reason,'ADMITTED_4_TO_3_TO_STRAIGHT_FOUR');
  assert.deepEqual(result.currentTupletDuration,{numerator:3,denominator:32});
  assert.deepEqual(result.restoredWrittenBase,{numerator:1,denominator:8});
  assert.deepEqual(result.eventPlans.map(plan=>({
    id:plan.eventId,
    onset:plan.proposedOnset,
    duration:plan.proposedDuration
  })),[
    {id:'e1',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:8}},
    {id:'e2',onset:{numerator:1,denominator:8},duration:{numerator:1,denominator:8}},
    {id:'e3',onset:{numerator:1,denominator:4},duration:{numerator:1,denominator:8}},
    {id:'e4',onset:{numerator:3,denominator:8},duration:{numerator:1,denominator:8}}
  ]);
  assert.deepEqual(result.currentGroupEnd,{numerator:3,denominator:8});
  assert.deepEqual(result.proposedGroupEnd,{numerator:1,denominator:2});
  assert.deepEqual(result.requiredGrowthInterval,{
    onset:{numerator:3,denominator:8},
    duration:{numerator:1,denominator:8},
    end:{numerator:1,denominator:2}
  });
  assert.equal(result.atomicMutationRequired,true);
  assert.equal(result.canonicalMutationAuthority,false);
  assert.equal(result.historyMutationAuthority,false);
  assert.equal(result.rendererCoordinateAuthority,false);
  assert.equal(Object.isFrozen(result),true);
  assert.deepEqual(score,beforeScore);
  assert.deepEqual(notation,beforeNotation);
});
