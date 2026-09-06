import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createNewScoreEditorAppDocument } from '../dist/packages/score-editor-app-document/src/index.js';
import {
  analyzeStraightThreeToTripletRetimingV4,
  TupletRetimingAdmissionV4Error
} from '../dist/packages/editor-tuplet-retiming-admission-v4/src/index.js';

const ids=()=>{let n=0;return()=>`app11g-${++n}`;};
const pitch=(step='C',alter=0,octave=4)=>({step,alter,octave});
const note=(id,noteId,onset,duration,step='C')=>({id,kind:'note',onset,duration,note:{id:noteId,pitch:pitch(step)}});
const rest=(id,onset,duration)=>({id,kind:'rest',onset,duration});
const chord=(id,noteIds,onset,duration)=>({
  id,kind:'chord',onset,duration,
  notes:noteIds.map((noteId,index)=>({id:noteId,pitch:pitch(index===0?'C':'E')}))
});
const eventNotation=(overrides={})=>({dots:0,beams:[],tuplet:null,articulations:[],ornaments:[],...overrides});
const noteNotation=(overrides={})=>({accidental:null,ties:[],slurs:[],...overrides});

const state=({
  events,
  sourceFormat='synthetic',
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
  raw.source=sourceFormat==='musicxml'
    ?{sha256:'a'.repeat(64),format:'musicxml',byteLength:128}
    :{sha256:'0'.repeat(64),format:'synthetic',byteLength:null};
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

const straightEighths=(withRest=true)=>[
  note('e1','n1',{numerator:0,denominator:1},{numerator:1,denominator:8},'C'),
  note('e2','n2',{numerator:1,denominator:8},{numerator:1,denominator:8},'D'),
  note('e3','n3',{numerator:1,denominator:4},{numerator:1,denominator:8},'E'),
  ...(withRest?[rest('r1',{numerator:3,denominator:8},{numerator:5,denominator:8})]:[])
];

const analyze=(score,notation,ids=['e1','e2','e3'])=>
  analyzeStraightThreeToTripletRetimingV4(score,notation,targets(score,...ids));

test('APP-11G plans straight eighths as canonical eighth-note triplet timing without mutation',()=>{
  const {score,notation}=state({events:straightEighths()});
  const beforeScore=structuredClone(score);
  const beforeNotation=structuredClone(notation);
  const result=analyze(score,notation);
  assert.equal(result.admitted,true);
  assert.equal(result.reason,'ADMITTED_STRAIGHT_THREE_TO_TRIPLET');
  assert.deepEqual(result.targetEventIds,['e1','e2','e3']);
  assert.deepEqual(result.writtenBase,{numerator:1,denominator:8});
  assert.deepEqual(result.canonicalTripletDuration,{numerator:1,denominator:12});
  assert.deepEqual(result.eventPlans.map(plan=>({id:plan.eventId,onset:plan.proposedOnset,duration:plan.proposedDuration})),[
    {id:'e1',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:12}},
    {id:'e2',onset:{numerator:1,denominator:12},duration:{numerator:1,denominator:12}},
    {id:'e3',onset:{numerator:1,denominator:6},duration:{numerator:1,denominator:12}}
  ]);
  assert.deepEqual(result.currentGroupEnd,{numerator:3,denominator:8});
  assert.deepEqual(result.proposedGroupEnd,{numerator:1,denominator:4});
  assert.deepEqual(result.releasedInterval,{
    onset:{numerator:1,denominator:4},
    duration:{numerator:1,denominator:8},
    end:{numerator:3,denominator:8}
  });
  assert.equal(result.nextEventId,'r1');
  assert.deepEqual(result.nextEventOnset,{numerator:3,denominator:8});
  assert.equal(result.balancePolicy,'CREATE_OR_EXTEND_EXPLICIT_RESIDUAL_REST');
  assert.equal(result.atomicMutationRequired,true);
  assert.equal(result.historyMutationAuthority,false);
  assert.equal(result.rendererCoordinateAuthority,false);
  assert.equal(Object.isFrozen(result),true);
  assert.equal(Object.isFrozen(result.eventPlans),true);
  assert.deepEqual(score,beforeScore);
  assert.deepEqual(notation,beforeNotation);
});

test('APP-11G admits the same contraction plan for imported MusicXML because no trailing growth is invented',()=>{
  const {score,notation}=state({events:straightEighths(),sourceFormat:'musicxml'});
  const result=analyze(score,notation);
  assert.equal(score.source.format,'musicxml');
  assert.equal(result.admitted,true);
  assert.deepEqual(result.releasedInterval?.duration,{numerator:1,denominator:8});
});

test('APP-11G supports mixed note/chord/rest timed events when the exact range is otherwise uncoupled',()=>{
  const {score,notation}=state({events:[
    chord('e1',['n1','n1b'],{numerator:0,denominator:1},{numerator:1,denominator:4}),
    rest('e2',{numerator:1,denominator:4},{numerator:1,denominator:4}),
    note('e3','n3',{numerator:1,denominator:2},{numerator:1,denominator:4},'G')
  ]});
  const result=analyze(score,notation);
  assert.equal(result.admitted,true);
  assert.deepEqual(result.canonicalTripletDuration,{numerator:1,denominator:6});
  assert.deepEqual(result.proposedGroupEnd,{numerator:1,denominator:2});
  assert.deepEqual(result.releasedInterval?.duration,{numerator:1,denominator:4});
});

test('APP-11G rejects unequal duration and non-contiguous current timing before any plan is authorized',()=>{
  let current=state({events:[
    note('e1','n1',{numerator:0,denominator:1},{numerator:1,denominator:8}),
    note('e2','n2',{numerator:1,denominator:8},{numerator:1,denominator:4}),
    note('e3','n3',{numerator:3,denominator:8},{numerator:1,denominator:8})
  ]});
  let result=analyze(current.score,current.notation);
  assert.equal(result.admitted,false);
  assert.equal(result.reason,'BLOCKED_UNEQUAL_DURATIONS');

  current=state({events:[
    note('e1','n1',{numerator:0,denominator:1},{numerator:1,denominator:8}),
    note('e2','n2',{numerator:1,denominator:4},{numerator:1,denominator:8}),
    note('e3','n3',{numerator:3,denominator:8},{numerator:1,denominator:8})
  ]});
  result=analyze(current.score,current.notation);
  assert.equal(result.admitted,false);
  assert.equal(result.reason,'BLOCKED_CURRENT_TIMING_INVALID');
});

test('APP-11G refuses a reordered or non-consecutive exact event range',()=>{
  const {score,notation}=state({events:[
    ...straightEighths(false),
    note('e4','n4',{numerator:3,denominator:8},{numerator:1,denominator:8},'F')
  ]});
  let result=analyze(score,notation,['e1','e3','e4']);
  assert.equal(result.admitted,false);
  assert.equal(result.reason,'BLOCKED_RANGE_NOT_EXACT');
  result=analyze(score,notation,['e2','e1','e3']);
  assert.equal(result.admitted,false);
  assert.equal(result.reason,'BLOCKED_RANGE_NOT_EXACT');
});

test('APP-11G leaves already-canonical 1/12 triplet timing to APP-11F metadata-only authoring',()=>{
  const {score,notation}=state({events:[
    note('e1','n1',{numerator:0,denominator:1},{numerator:1,denominator:12}),
    note('e2','n2',{numerator:1,denominator:12},{numerator:1,denominator:12}),
    note('e3','n3',{numerator:1,denominator:6},{numerator:1,denominator:12})
  ]});
  const result=analyze(score,notation);
  assert.equal(result.admitted,false);
  assert.equal(result.reason,'BLOCKED_WRITTEN_BASE_UNSUPPORTED');
  assert.deepEqual(result.writtenBase,{numerator:1,denominator:12});
});

test('APP-11G fails closed on dots, beams, existing tuplets and ties but does not treat slur endpoints as timing coupling',()=>{
  let current=state({events:straightEighths(),eventNotationById:{e1:eventNotation({dots:1})}});
  let result=analyze(current.score,current.notation);
  assert.equal(result.reason,'BLOCKED_TIMING_COUPLED_NOTATION');
  assert.deepEqual(result.couplingReasons,['dots:e1']);

  current=state({events:straightEighths(),eventNotationById:{e2:eventNotation({beams:[{number:1,value:'continue'}]})}});
  result=analyze(current.score,current.notation);
  assert.equal(result.reason,'BLOCKED_TIMING_COUPLED_NOTATION');
  assert.deepEqual(result.couplingReasons,['beams:e2']);

  current=state({events:straightEighths(),eventNotationById:{e3:eventNotation({tuplet:{actualNotes:3,normalNotes:2,marks:[{number:1,type:'stop'}]}})}});
  result=analyze(current.score,current.notation);
  assert.equal(result.reason,'BLOCKED_TIMING_COUPLED_NOTATION');
  assert.deepEqual(result.couplingReasons,['tuplet:e3']);

  current=state({events:straightEighths(),noteNotationById:{n1:noteNotation({ties:[{number:1,type:'start'}]})}});
  result=analyze(current.score,current.notation);
  assert.equal(result.reason,'BLOCKED_TIMING_COUPLED_NOTATION');
  assert.deepEqual(result.couplingReasons,['tie:n1']);

  current=state({events:straightEighths(),noteNotationById:{n1:noteNotation({slurs:[{number:1,type:'start'}]}),n3:noteNotation({slurs:[{number:1,type:'stop'}]})}});
  result=analyze(current.score,current.notation);
  assert.equal(result.admitted,true);
  assert.deepEqual(result.couplingReasons,[]);
});

test('APP-11G blocks selected cross-staff events until an atomic cross-staff retiming contract is admitted',()=>{
  const {score,notation}=state({
    preset:'PIANO_GRAND_STAFF',
    events:straightEighths(),
    crossStaffPlacements:[{eventId:'e2',displayStaffIndex:1}]
  });
  const result=analyze(score,notation);
  assert.equal(result.admitted,false);
  assert.equal(result.reason,'BLOCKED_CROSS_STAFF_TARGET');
});

test('APP-11G rejects already-overlapping surrounding voice timing',()=>{
  const {score,notation}=state({events:[
    note('p0','p0n',{numerator:0,denominator:1},{numerator:1,denominator:4}),
    note('e1','n1',{numerator:1,denominator:8},{numerator:1,denominator:8}),
    note('e2','n2',{numerator:1,denominator:4},{numerator:1,denominator:8}),
    note('e3','n3',{numerator:3,denominator:8},{numerator:1,denominator:8})
  ]});
  const result=analyze(score,notation);
  assert.equal(result.admitted,false);
  assert.equal(result.reason,'BLOCKED_CURRENT_TIMING_INVALID');
});

test('APP-11G validates exact cardinality, distinct current-revision event targets and stale addresses',()=>{
  const {score,notation}=state({events:straightEighths()});
  const exact=targets(score,'e1','e2','e3');
  assert.throws(
    ()=>analyzeStraightThreeToTripletRetimingV4(score,notation,exact.slice(0,2)),
    error=>error instanceof TupletRetimingAdmissionV4Error&&error.code==='INVALID_RANGE'
  );
  assert.throws(
    ()=>analyzeStraightThreeToTripletRetimingV4(score,notation,[exact[0],exact[0],exact[2]]),
    error=>error instanceof TupletRetimingAdmissionV4Error&&error.code==='INVALID_RANGE'
  );
  const raw=structuredClone(score);
  raw.revision={id:'app11g-newer-rev',parentId:score.revision.id};
  const newer=createScoreDocumentV3(raw);
  const newerNotation=createNotationDocumentV4(newer,{
    ...structuredClone(notation),
    documentId:newer.id,
    revisionId:newer.revision.id,
    frames:notation.frames.map(entry=>({target:addressEntityV3(newer,entry.target.frameId),notation:entry.notation})),
    measures:notation.measures.map(entry=>({target:addressEntityV3(newer,entry.target.measureId),notation:entry.notation})),
    events:[],notes:[],graceEvents:[],graceNotes:[],crossStaffPlacements:[]
  });
  assert.throws(
    ()=>analyzeStraightThreeToTripletRetimingV4(newer,newerNotation,exact),
    error=>error instanceof TupletRetimingAdmissionV4Error&&error.code==='STALE_TARGET'
  );
});
