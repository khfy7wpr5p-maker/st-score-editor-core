import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createNewScoreEditorAppDocument } from '../dist/packages/score-editor-app-document/src/index.js';
import {
  analyzeTripletToStraightThreeUnretimingV4,
  TupletUnretimingAdmissionV4Error
} from '../dist/packages/editor-tuplet-unretiming-admission-v4/src/index.js';

const ids=()=>{let n=0;return()=>`app11j-${++n}`;};
const pitch=(step='C',alter=0,octave=4)=>({step,alter,octave});
const note=(id,noteId,onset,duration,step='C')=>({id,kind:'note',onset,duration,note:{id:noteId,pitch:pitch(step)}});
const rest=(id,onset,duration)=>({id,kind:'rest',onset,duration});
const eventNotation=(overrides={})=>({dots:0,beams:[],tuplet:null,articulations:[],ornaments:[],...overrides});
const noteNotation=(overrides={})=>({accidental:null,ties:[],slurs:[],...overrides});
const triplet=(position,number=1)=>eventNotation({
  tuplet:{actualNotes:3,normalNotes:2,marks:position==='middle'?[]:[{number,type:position}]}
});

const state=({
  events,
  eventNotationById={},
  noteNotationById={},
  preset='GUITAR_TREBLE',
  crossStaffPlacements=[]
})=>{
  const document=createNewScoreEditorAppDocument({idFactory:ids(),preset});
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
  const notesNotation=Object.entries(noteNotationById).map(([noteId,notation])=>({
    target:addressEntityV3(score,noteId),notation
  }));
  const placements=crossStaffPlacements.map(({eventId,displayStaffIndex})=>{
    const part=score.parts[0];
    const standard=part.staves.filter(staff=>staff.role==='standard');
    return {source:addressEntityV3(score,eventId),displayStaffId:standard[displayStaffIndex].id};
  });
  const notation=createNotationDocumentV4(score,{
    contractVersion:'4.0.0',
    documentId:score.id,
    revisionId:score.revision.id,
    frames,
    measures,
    events:eventsNotation,
    notes:notesNotation,
    graceEvents:[],
    graceNotes:[],
    crossStaffPlacements:placements
  });
  return {score,notation};
};

const targets=(score,...eventIds)=>eventIds.map(eventId=>{
  const target=addressEntityV3(score,eventId);
  assert.equal(target.kind,'event');
  return target;
});

const tripletNotationById=()=>({
  e1:triplet('start'),
  e2:triplet('middle'),
  e3:triplet('stop')
});

const eighthTriplet=(restDuration={numerator:1,denominator:8})=>[
  note('e1','n1',{numerator:0,denominator:1},{numerator:1,denominator:12},'C'),
  note('e2','n2',{numerator:1,denominator:12},{numerator:1,denominator:12},'D'),
  note('e3','n3',{numerator:1,denominator:6},{numerator:1,denominator:12},'E'),
  rest('r1',{numerator:1,denominator:4},restDuration)
];

const analyze=(score,notation,ids=['e1','e2','e3'])=>
  analyzeTripletToStraightThreeUnretimingV4(score,notation,targets(score,...ids));

test('APP-11J plans exact eighth-note triplet removal back to straight eighths without mutation',()=>{
  const {score,notation}=state({events:eighthTriplet(),eventNotationById:tripletNotationById()});
  const beforeScore=structuredClone(score);
  const beforeNotation=structuredClone(notation);
  const result=analyze(score,notation);
  assert.equal(result.admitted,true);
  assert.equal(result.reason,'ADMITTED_TRIPLET_TO_STRAIGHT_THREE');
  assert.deepEqual(result.currentTripletDuration,{numerator:1,denominator:12});
  assert.deepEqual(result.restoredWrittenBase,{numerator:1,denominator:8});
  assert.deepEqual(result.eventPlans.map(plan=>({id:plan.eventId,onset:plan.proposedOnset,duration:plan.proposedDuration})),[
    {id:'e1',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:8}},
    {id:'e2',onset:{numerator:1,denominator:8},duration:{numerator:1,denominator:8}},
    {id:'e3',onset:{numerator:1,denominator:4},duration:{numerator:1,denominator:8}}
  ]);
  assert.deepEqual(result.currentGroupEnd,{numerator:1,denominator:4});
  assert.deepEqual(result.proposedGroupEnd,{numerator:3,denominator:8});
  assert.deepEqual(result.requiredGrowthInterval,{
    onset:{numerator:1,denominator:4},
    duration:{numerator:1,denominator:8},
    end:{numerator:3,denominator:8}
  });
  assert.deepEqual(result.restPlan,{
    action:'REMOVE_ADJACENT_REST',
    restEventId:'r1',
    currentOnset:{numerator:1,denominator:4},
    currentDuration:{numerator:1,denominator:8},
    proposedOnset:null,
    proposedDuration:null
  });
  assert.equal(result.balancePolicy,'CONSUME_EXACT_ADJACENT_NEUTRAL_REST');
  assert.equal(result.atomicMutationRequired,true);
  assert.equal(result.historyMutationAuthority,false);
  assert.equal(result.rendererCoordinateAuthority,false);
  assert.equal(Object.isFrozen(result),true);
  assert.equal(Object.isFrozen(result.eventPlans),true);
  assert.deepEqual(score,beforeScore);
  assert.deepEqual(notation,beforeNotation);
});

test('APP-11J plans forward shrink when the adjacent neutral rest is larger than required growth',()=>{
  const {score,notation}=state({
    events:eighthTriplet({numerator:3,denominator:4}),
    eventNotationById:tripletNotationById()
  });
  const result=analyze(score,notation);
  assert.equal(result.admitted,true);
  assert.deepEqual(result.restPlan,{
    action:'SHRINK_ADJACENT_REST_FORWARD',
    restEventId:'r1',
    currentOnset:{numerator:1,denominator:4},
    currentDuration:{numerator:3,denominator:4},
    proposedOnset:{numerator:3,denominator:8},
    proposedDuration:{numerator:5,denominator:8}
  });
});

test('APP-11J requires an exact adjacent neutral rest and refuses topology invention',()=>{
  let current=state({
    events:[...eighthTriplet().slice(0,3),note('e4','n4',{numerator:1,denominator:4},{numerator:3,denominator:4},'F')],
    eventNotationById:tripletNotationById()
  });
  let result=analyze(current.score,current.notation);
  assert.equal(result.admitted,false);
  assert.equal(result.reason,'BLOCKED_ADJACENT_REST_REQUIRED');

  current=state({
    events:eighthTriplet(),
    eventNotationById:{...tripletNotationById(),r1:eventNotation({articulations:[{kind:'staccato',placement:'auto',direction:null}]})}
  });
  result=analyze(current.score,current.notation);
  assert.equal(result.admitted,false);
  assert.equal(result.reason,'BLOCKED_ADJACENT_REST_REQUIRED');
});

test('APP-11J refuses an adjacent rest that cannot cover the full straightening growth',()=>{
  const {score,notation}=state({
    events:eighthTriplet({numerator:1,denominator:16}),
    eventNotationById:tripletNotationById()
  });
  const result=analyze(score,notation);
  assert.equal(result.admitted,false);
  assert.equal(result.reason,'BLOCKED_ADJACENT_REST_INSUFFICIENT');
  assert.deepEqual(result.requiredGrowthInterval?.duration,{numerator:1,denominator:8});
});

test('APP-11J validates one exact 3:2 triplet boundary instead of accepting loose tuplet metadata',()=>{
  let current=state({
    events:eighthTriplet(),
    eventNotationById:{e1:triplet('start',1),e2:triplet('middle'),e3:triplet('stop',2)}
  });
  let result=analyze(current.score,current.notation);
  assert.equal(result.admitted,false);
  assert.equal(result.reason,'BLOCKED_TRIPLET_NOTATION_INVALID');

  current=state({
    events:eighthTriplet(),
    eventNotationById:{
      e1:eventNotation({tuplet:{actualNotes:5,normalNotes:4,marks:[{number:1,type:'start'}]}}),
      e2:eventNotation({tuplet:{actualNotes:5,normalNotes:4,marks:[]}}),
      e3:eventNotation({tuplet:{actualNotes:5,normalNotes:4,marks:[{number:1,type:'stop'}]}})
    }
  });
  result=analyze(current.score,current.notation);
  assert.equal(result.admitted,false);
  assert.equal(result.reason,'BLOCKED_TRIPLET_NOTATION_INVALID');
});

test('APP-11J fails closed on dots, beams and ties while allowing slur endpoints',()=>{
  let current=state({
    events:eighthTriplet(),
    eventNotationById:{...tripletNotationById(),e1:triplet('start')}
  });
  current=state({
    events:eighthTriplet(),
    eventNotationById:{...tripletNotationById(),e1:eventNotation({...triplet('start'),dots:1})}
  });
  let result=analyze(current.score,current.notation);
  assert.equal(result.reason,'BLOCKED_TIMING_COUPLED_NOTATION');
  assert.deepEqual(result.couplingReasons,['dots:e1']);

  current=state({
    events:eighthTriplet(),
    eventNotationById:{...tripletNotationById(),e2:eventNotation({...triplet('middle'),beams:[{number:1,value:'continue'}]})}
  });
  result=analyze(current.score,current.notation);
  assert.equal(result.reason,'BLOCKED_TIMING_COUPLED_NOTATION');
  assert.deepEqual(result.couplingReasons,['beams:e2']);

  current=state({
    events:eighthTriplet(),
    eventNotationById:tripletNotationById(),
    noteNotationById:{n1:noteNotation({ties:[{number:1,type:'start'}]})}
  });
  result=analyze(current.score,current.notation);
  assert.equal(result.reason,'BLOCKED_TIMING_COUPLED_NOTATION');
  assert.deepEqual(result.couplingReasons,['tie:n1']);

  current=state({
    events:eighthTriplet(),
    eventNotationById:tripletNotationById(),
    noteNotationById:{
      n1:noteNotation({slurs:[{number:1,type:'start'}]}),
      n3:noteNotation({slurs:[{number:1,type:'stop'}]})
    }
  });
  result=analyze(current.score,current.notation);
  assert.equal(result.admitted,true);
  assert.deepEqual(result.couplingReasons,[]);
});

test('APP-11J blocks selected cross-staff triplet events until cross-staff timing mutation has its own authority',()=>{
  const {score,notation}=state({
    preset:'PIANO_GRAND_STAFF',
    events:eighthTriplet(),
    eventNotationById:tripletNotationById(),
    crossStaffPlacements:[{eventId:'e2',displayStaffIndex:1}]
  });
  const result=analyze(score,notation);
  assert.equal(result.admitted,false);
  assert.equal(result.reason,'BLOCKED_CROSS_STAFF_TARGET');
});

test('APP-11J rejects non-consecutive, duplicate and wrong-cardinality semantic ranges',()=>{
  const {score,notation}=state({
    events:[...eighthTriplet().slice(0,3),note('e4','n4',{numerator:1,denominator:4},{numerator:1,denominator:8},'F'),rest('r1',{numerator:3,denominator:8},{numerator:5,denominator:8})],
    eventNotationById:tripletNotationById()
  });
  let result=analyze(score,notation,['e1','e3','e4']);
  assert.equal(result.admitted,false);
  assert.equal(result.reason,'BLOCKED_RANGE_NOT_EXACT');
  const exact=targets(score,'e1','e2','e3');
  assert.throws(
    ()=>analyzeTripletToStraightThreeUnretimingV4(score,notation,[exact[0],exact[0],exact[2]]),
    error=>error instanceof TupletUnretimingAdmissionV4Error&&error.code==='INVALID_RANGE'
  );
  assert.throws(
    ()=>analyzeTripletToStraightThreeUnretimingV4(score,notation,exact.slice(0,2)),
    error=>error instanceof TupletUnretimingAdmissionV4Error&&error.code==='INVALID_RANGE'
  );
});
