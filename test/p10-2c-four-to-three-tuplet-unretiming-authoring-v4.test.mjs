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

const fixture=(options={})=>{
  const restDuration=options.restDuration??{numerator:1,denominator:8};
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
      {target:addressEntityV3(score,'e1'),notation:{...fourToThree('start'),...(options.eventNotationById?.e1??{})}},
      {target:addressEntityV3(score,'e2'),notation:{...fourToThree('middle'),...(options.eventNotationById?.e2??{})}},
      {target:addressEntityV3(score,'e3'),notation:{...fourToThree('middle'),...(options.eventNotationById?.e3??{})}},
      {target:addressEntityV3(score,'e4'),notation:{...fourToThree('stop'),...(options.eventNotationById?.e4??{})}},
      ...(options.extraEvents??[]).map(({eventId,notation:value})=>({target:addressEntityV3(score,eventId),notation:eventNotation(value) }))
    ],
    notes:Object.entries(options.noteNotationById??{}).map(([noteId,value])=>({
      target:addressEntityV3(score,noteId),
      notation:{accidental:null,ties:[],slurs:[],...value}
    })),
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


test('P10-2C shrinks a larger admitted adjacent rest forward without changing its identity',async()=>{
  const module=await import('../dist/packages/editor-four-to-three-tuplet-unretiming-authoring-v4/src/index.js');
  const {score,notation}=fixture({restDuration:{numerator:3,denominator:8}});
  const result=module.executeFourToThreeTupletToStraightFourUnretimingV4(
    score,notation,intent(score),{nextRevisionId:'p10-2c-shrink'}
  );
  const voice=result.score.parts[0].staves.find(staff=>staff.role==='standard').measures[0].voices[0];
  assert.deepEqual(voice.events.map(event=>event.id),['e1','e2','e3','e4','r1']);
  const tail=voice.events[4];
  assert.equal(tail.kind,'rest');
  assert.equal(tail.id,'r1');
  assert.deepEqual(tail.onset,{numerator:1,denominator:2});
  assert.deepEqual(tail.duration,{numerator:1,denominator:4});
  assert.equal(result.admission.restPlan.action,'SHRINK_ADJACENT_REST_FORWARD');
});

test('P10-2C removes only owned 4:3 metadata and preserves unrelated event/note notation',async()=>{
  const module=await import('../dist/packages/editor-four-to-three-tuplet-unretiming-authoring-v4/src/index.js');
  const {score,notation}=fixture({
    eventNotationById:{
      e1:{articulations:[{kind:'accent',placement:'above',direction:null}]},
      e2:{ornaments:[{kind:'trill-mark',placement:'above',accidentalMarks:[]}]}
    },
    noteNotationById:{
      n1:{accidental:'natural',slurs:[{number:1,type:'start'}]},
      n4:{slurs:[{number:1,type:'stop'}]}
    }
  });
  const result=module.executeFourToThreeTupletToStraightFourUnretimingV4(
    score,notation,intent(score),{nextRevisionId:'p10-2c-preserve'}
  );
  assert.deepEqual(
    result.notation.events.find(entry=>entry.target.eventId==='e1').notation.articulations,
    [{kind:'accent',placement:'above',direction:null}]
  );
  assert.deepEqual(
    result.notation.events.find(entry=>entry.target.eventId==='e2').notation.ornaments,
    [{kind:'trill-mark',placement:'above',accidentalMarks:[]}]
  );
  assert.deepEqual(
    result.notation.notes.find(entry=>entry.target.noteId==='n1').notation,
    {accidental:'natural',ties:[],slurs:[{number:1,type:'start'}]}
  );
  assert.deepEqual(
    result.notation.notes.find(entry=>entry.target.noteId==='n4').notation,
    {accidental:null,ties:[],slurs:[{number:1,type:'stop'}]}
  );
});

test('P10-2C propagates fresh P10-2B admission failures without mutating inputs',async()=>{
  const module=await import('../dist/packages/editor-four-to-three-tuplet-unretiming-authoring-v4/src/index.js');
  let current=fixture();
  let beforeScore=structuredClone(current.score);
  let beforeNotation=structuredClone(current.notation);
  assert.throws(
    ()=>module.executeFourToThreeTupletToStraightFourUnretimingV4(
      current.score,current.notation,
      {...intent(current.score),targets:[...intent(current.score).targets].reverse()},
      {nextRevisionId:'p10-2c-reordered'}
    ),
    error=>error?.code==='TIMING_NOT_ADMITTED'&&
      error?.details?.reason==='BLOCKED_REORDERED_OR_NONCONSECUTIVE_TARGET'
  );
  assert.deepEqual(current.score,beforeScore);
  assert.deepEqual(current.notation,beforeNotation);

  current=fixture({eventNotationById:{e1:{dots:1}}});
  assert.throws(
    ()=>module.executeFourToThreeTupletToStraightFourUnretimingV4(
      current.score,current.notation,intent(current.score),{nextRevisionId:'p10-2c-dotted'}
    ),
    error=>error?.code==='TIMING_NOT_ADMITTED'&&
      error?.details?.reason==='BLOCKED_TIMING_COUPLED_DOTS'
  );

  current=fixture({restDuration:{numerator:1,denominator:16}});
  assert.throws(
    ()=>module.executeFourToThreeTupletToStraightFourUnretimingV4(
      current.score,current.notation,intent(current.score),{nextRevisionId:'p10-2c-short-rest'}
    ),
    error=>error?.code==='TIMING_NOT_ADMITTED'&&
      error?.details?.reason==='BLOCKED_ADJACENT_REST_INSUFFICIENT'
  );

  current=fixture();
  assert.throws(
    ()=>module.executeFourToThreeTupletToStraightFourUnretimingV4(
      current.score,current.notation,intent(current.score),{nextRevisionId:current.score.revision.id}
    ),
    error=>error?.code==='INVALID_REVISION_ID'
  );
});

test('P10-2C internal apply rejects stale/tampered admitted paths with bounded authoring errors',async()=>{
  const publicModule=await import('../dist/packages/editor-four-to-three-tuplet-unretiming-authoring-v4/src/index.js');
  const internal=await import('../dist/packages/editor-four-to-three-tuplet-unretiming-authoring-v4/src/apply-admission.js');
  const admissionModule=await import('../dist/packages/editor-generalized-tuplet-admission-v4/src/index.js');
  const {score,notation}=fixture();
  const admission=admissionModule.analyzeGeneralizedTupletToStraightV4(
    score,notation,intent(score).targets,admissionModule.FOUR_TO_THREE_TUPLET_PROFILE_V4
  );
  assert.equal(admission.admitted,true);

  const missingFirst=structuredClone(admission);
  missingFirst.targetEventIds[0]='missing-event';
  assert.throws(
    ()=>internal.applyFreshFourToThreeTupletAdmissionV4(
      score,notation,missingFirst,'p10-2c-tamper-missing'
    ),
    error=>error instanceof publicModule.FourToThreeTupletUnretimingAuthoringV4Error &&
      error.code==='TARGET_PATH_INVALID'
  );

  const incomplete=structuredClone(admission);
  incomplete.eventPlans=incomplete.eventPlans.slice(0,3);
  assert.throws(
    ()=>internal.applyFreshFourToThreeTupletAdmissionV4(
      score,notation,incomplete,'p10-2c-tamper-plan'
    ),
    error=>error?.code==='RESULT_INVALID'
  );

  const fakeAction=structuredClone(admission);
  fakeAction.restPlan.action='FAKE_ACTION';
  assert.throws(
    ()=>internal.applyFreshFourToThreeTupletAdmissionV4(
      score,notation,fakeAction,'p10-2c-tamper-action'
    ),
    error=>error?.code==='RESULT_INVALID'
  );
});


test('P10-2C preserves P10-2B fail-closed reasons for stale, ratio, boundary, beam and tie cases',async()=>{
  const module=await import('../dist/packages/editor-four-to-three-tuplet-unretiming-authoring-v4/src/index.js');

  let current=fixture();
  const staleTargets=intent(current.score).targets.map((target,index)=>
    index===0?{...target,revisionId:'stale-revision'}:target
  );
  assert.throws(
    ()=>module.executeFourToThreeTupletToStraightFourUnretimingV4(
      current.score,current.notation,
      {version:'1.0.0',type:'UNRETIMING_FOUR_TO_THREE_TO_STRAIGHT_FOUR',targets:staleTargets},
      {nextRevisionId:'p10-2c-stale'}
    ),
    error=>error?.code==='TIMING_NOT_ADMITTED'&&error?.details?.reason==='BLOCKED_STALE_TARGET'
  );

  current=fixture({eventNotationById:{
    e1:{tuplet:{actualNotes:5,normalNotes:4,marks:[{number:1,type:'start'}]}}
  }});
  assert.throws(
    ()=>module.executeFourToThreeTupletToStraightFourUnretimingV4(
      current.score,current.notation,intent(current.score),{nextRevisionId:'p10-2c-wrong-ratio'}
    ),
    error=>error?.code==='TIMING_NOT_ADMITTED'&&
      error?.details?.reason==='BLOCKED_TUPLET_PROFILE_UNSUPPORTED'
  );

  current=fixture({eventNotationById:{
    e4:{tuplet:{actualNotes:4,normalNotes:3,marks:[{number:2,type:'stop'}]}}
  }});
  assert.throws(
    ()=>module.executeFourToThreeTupletToStraightFourUnretimingV4(
      current.score,current.notation,intent(current.score),{nextRevisionId:'p10-2c-boundary'}
    ),
    error=>error?.code==='TIMING_NOT_ADMITTED'&&
      error?.details?.reason==='BLOCKED_TUPLET_BOUNDARY_INVALID'
  );

  current=fixture({eventNotationById:{
    e2:{beams:[{number:1,value:'continue'}]}
  }});
  assert.throws(
    ()=>module.executeFourToThreeTupletToStraightFourUnretimingV4(
      current.score,current.notation,intent(current.score),{nextRevisionId:'p10-2c-beam'}
    ),
    error=>error?.code==='TIMING_NOT_ADMITTED'&&
      error?.details?.reason==='BLOCKED_TIMING_COUPLED_BEAMS'
  );

  current=fixture({noteNotationById:{
    n3:{ties:[{number:1,type:'start'}]}
  }});
  assert.throws(
    ()=>module.executeFourToThreeTupletToStraightFourUnretimingV4(
      current.score,current.notation,intent(current.score),{nextRevisionId:'p10-2c-tie'}
    ),
    error=>error?.code==='TIMING_NOT_ADMITTED'&&
      error?.details?.reason==='BLOCKED_TIMING_COUPLED_TIES'
  );

  current=fixture();
  assert.throws(
    ()=>module.executeFourToThreeTupletToStraightFourUnretimingV4(
      current.score,current.notation,
      {...intent(current.score),extra:true},
      {nextRevisionId:'p10-2c-malformed'}
    ),
    error=>error?.code==='INVALID_INTENT'
  );
});


test('P10-2C rejects structurally malformed semantic target records as INVALID_INTENT',async()=>{
  const module=await import('../dist/packages/editor-four-to-three-tuplet-unretiming-authoring-v4/src/index.js');
  const {score,notation}=fixture();
  const valid=intent(score).targets;
  assert.throws(
    ()=>module.executeFourToThreeTupletToStraightFourUnretimingV4(
      score,
      notation,
      {
        version:'1.0.0',
        type:'UNRETIMING_FOUR_TO_THREE_TO_STRAIGHT_FOUR',
        targets:[{},valid[1],valid[2],valid[3]]
      },
      {nextRevisionId:'p10-2c-malformed-target'}
    ),
    error=>error?.code==='INVALID_INTENT'
  );
});
