import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createNewScoreEditorAppDocument } from '../dist/packages/score-editor-app-document/src/index.js';

const ids=()=>{let n=0;return()=>`p10-2-t1-${++n}`;};
const pitch=(step='C',alter=0,octave=4)=>({step,alter,octave});
const note=(id,noteId,onset,duration,step='C')=>({id,kind:'note',onset,duration,note:{id:noteId,pitch:pitch(step)}});
const rest=(id,onset,duration)=>({id,kind:'rest',onset,duration});
const eventNotation=(overrides={})=>({dots:0,beams:[],tuplet:null,articulations:[],ornaments:[],...overrides});
const noteNotation=(overrides={})=>({accidental:null,ties:[],slurs:[],...overrides});
const triplet=(position,number=1)=>eventNotation({
  tuplet:{actualNotes:3,normalNotes:2,marks:position==='middle'?[]:[{number,type:position}]}
});

const fixture=(restDuration={numerator:1,denominator:8},extras={})=>{
  const document=createNewScoreEditorAppDocument({idFactory:ids(),preset:'GUITAR_TREBLE'});
  const baseScore=document.session.history.present.score;
  const baseNotation=document.session.history.present.notation;
  const raw=structuredClone(baseScore);
  const staff=raw.parts[0].staves.find(candidate=>candidate.role==='standard');
  staff.measures[0].voices[0].events=[
    note('e1','n1',{numerator:0,denominator:1},{numerator:1,denominator:12},'C'),
    note('e2','n2',{numerator:1,denominator:12},{numerator:1,denominator:12},'D'),
    note('e3','n3',{numerator:1,denominator:6},{numerator:1,denominator:12},'E'),
    rest('r1',{numerator:1,denominator:4},restDuration),
    ...(extras.afterRestEvents??[])
  ];
  const score=createScoreDocumentV3(raw);
  const notation=createNotationDocumentV4(score,{
    contractVersion:'4.0.0',
    documentId:score.id,
    revisionId:score.revision.id,
    frames:baseNotation.frames.map(entry=>({target:addressEntityV3(score,entry.target.frameId),notation:entry.notation})),
    measures:baseNotation.measures.map(entry=>({target:addressEntityV3(score,entry.target.measureId),notation:entry.notation})),
    events:[
      {target:addressEntityV3(score,'e1'),notation:{...triplet('start'),...(extras.eventNotationById?.e1??{})}},
      {target:addressEntityV3(score,'e2'),notation:{...triplet('middle'),...(extras.eventNotationById?.e2??{})}},
      {target:addressEntityV3(score,'e3'),notation:{...triplet('stop'),...(extras.eventNotationById?.e3??{})}},
      ...Object.entries(extras.eventNotationById??{})
        .filter(([eventId])=>!['e1','e2','e3'].includes(eventId))
        .map(([eventId,value])=>({target:addressEntityV3(score,eventId),notation:eventNotation(value)})
    ],
    notes:Object.entries(extras.noteNotationById??{}).map(([noteId,value])=>({
      target:addressEntityV3(score,noteId),
      notation:noteNotation(value)
    })),
    graceEvents:[],
    graceNotes:[],
    crossStaffPlacements:[]
  });
  return {score,notation};
};

const targets=score=>['e1','e2','e3'].map(eventId=>addressEntityV3(score,eventId));

test('P10-2 atomically restores an admitted exact eighth-triplet and removes the exactly consumed adjacent rest',async()=>{
  const module=await import('../dist/packages/editor-tuplet-unretiming-authoring-v4/src/index.js').catch(()=>({}));
  assert.equal(
    typeof module.executeTripletToStraightThreeUnretimingV4,
    'function',
    'P10-2 inverse authoring API must exist before behavior can pass'
  );

  const {score,notation}=fixture();
  const beforeScore=structuredClone(score);
  const beforeNotation=structuredClone(notation);
  const result=module.executeTripletToStraightThreeUnretimingV4(
    score,
    notation,
    {
      version:'1.0.0',
      type:'UNRETIMING_TRIPLET_TO_STRAIGHT_THREE',
      targets:targets(score)
    },
    {nextRevisionId:'p10-2-unretime-r1'}
  );

  const voice=result.score.parts[0].staves.find(staff=>staff.role==='standard').measures[0].voices[0];
  assert.equal(result.score.revision.id,'p10-2-unretime-r1');
  assert.equal(result.score.revision.parentId,score.revision.id);
  assert.equal(result.notation.revisionId,'p10-2-unretime-r1');
  assert.deepEqual(voice.events.map(event=>event.id),['e1','e2','e3']);
  assert.deepEqual(voice.events.map(event=>event.onset),[
    {numerator:0,denominator:1},
    {numerator:1,denominator:8},
    {numerator:1,denominator:4}
  ]);
  assert.deepEqual(voice.events.map(event=>event.duration),[
    {numerator:1,denominator:8},
    {numerator:1,denominator:8},
    {numerator:1,denominator:8}
  ]);
  assert.deepEqual(
    ['e1','e2','e3'].map(eventId=>
      result.notation.events.find(entry=>entry.target.eventId===eventId)?.notation.tuplet??null
    ),
    [null,null,null]
  );
  assert.equal(result.selection.kind,'event');
  assert.equal(result.selection.eventId,'e1');
  assert.equal(result.selection.revisionId,'p10-2-unretime-r1');
  assert.equal(result.admission.admitted,true);
  assert.equal(result.admission.restPlan.action,'REMOVE_ADJACENT_REST');
  assert.deepEqual(score,beforeScore);
  assert.deepEqual(notation,beforeNotation);
});


test('P10-2 shrinks a larger admitted adjacent rest forward without changing its identity',async()=>{
  const module=await import('../dist/packages/editor-tuplet-unretiming-authoring-v4/src/index.js');
  const {score,notation}=fixture({numerator:3,denominator:4});
  const result=module.executeTripletToStraightThreeUnretimingV4(
    score,
    notation,
    {
      version:'1.0.0',
      type:'UNRETIMING_TRIPLET_TO_STRAIGHT_THREE',
      targets:targets(score)
    },
    {nextRevisionId:'p10-2-unretime-shrink'}
  );

  const voice=result.score.parts[0].staves.find(staff=>staff.role==='standard').measures[0].voices[0];
  assert.deepEqual(voice.events.map(event=>event.id),['e1','e2','e3','r1']);
  const tail=voice.events[3];
  assert.equal(tail.kind,'rest');
  assert.deepEqual(tail.onset,{numerator:3,denominator:8});
  assert.deepEqual(tail.duration,{numerator:5,denominator:8});
  assert.equal(result.admission.restPlan.action,'SHRINK_ADJACENT_REST_FORWARD');
});


test('P10-2 preserves unrelated notation and removes a neutral notation entry with an exactly consumed rest',async()=>{
  const module=await import('../dist/packages/editor-tuplet-unretiming-authoring-v4/src/index.js');
  const after=note('e4','n4',{numerator:3,denominator:8},{numerator:1,denominator:8},'F');
  const {score,notation}=fixture(
    {numerator:1,denominator:8},
    {
      afterRestEvents:[after],
      eventNotationById:{
        e1:{articulations:[{kind:'accent',placement:'above',direction:null}]},
        e2:{ornaments:[{kind:'trill-mark',placement:'above',accidentalMarks:[]}]},
        r1:{},
        e4:{articulations:[{kind:'staccato',placement:'auto',direction:null}]}
      },
      noteNotationById:{
        n1:{accidental:'natural',slurs:[{number:1,type:'start'}]},
        n3:{slurs:[{number:1,type:'stop'}]}
      }
    }
  );
  const result=module.executeTripletToStraightThreeUnretimingV4(
    score,notation,
    {version:'1.0.0',type:'UNRETIMING_TRIPLET_TO_STRAIGHT_THREE',targets:targets(score)},
    {nextRevisionId:'p10-2-unretime-preserve'}
  );
  const voice=result.score.parts[0].staves.find(staff=>staff.role==='standard').measures[0].voices[0];
  assert.deepEqual(voice.events.map(event=>event.id),['e1','e2','e3','e4']);
  assert.equal(result.notation.events.some(entry=>entry.target.eventId==='r1'),false);
  assert.deepEqual(
    result.notation.events.find(entry=>entry.target.eventId==='e1').notation.articulations,
    [{kind:'accent',placement:'above',direction:null}]
  );
  assert.deepEqual(
    result.notation.events.find(entry=>entry.target.eventId==='e2').notation.ornaments,
    [{kind:'trill-mark',placement:'above',accidentalMarks:[]}]
  );
  assert.deepEqual(
    result.notation.events.find(entry=>entry.target.eventId==='e4').notation.articulations,
    [{kind:'staccato',placement:'auto',direction:null}]
  );
  assert.deepEqual(
    result.notation.notes.find(entry=>entry.target.noteId==='n1').notation,
    {accidental:'natural',ties:[],slurs:[{number:1,type:'start'}]}
  );
  assert.deepEqual(
    result.notation.notes.find(entry=>entry.target.noteId==='n3').notation,
    {accidental:null,ties:[],slurs:[{number:1,type:'stop'}]}
  );
});

test('P10-2 propagates APP-11J timing-coupling rejection without mutating inputs',async()=>{
  const module=await import('../dist/packages/editor-tuplet-unretiming-authoring-v4/src/index.js');
  const {score,notation}=fixture(
    {numerator:1,denominator:8},
    {eventNotationById:{e1:{dots:1}}}
  );
  const beforeScore=structuredClone(score);
  const beforeNotation=structuredClone(notation);
  assert.throws(
    ()=>module.executeTripletToStraightThreeUnretimingV4(
      score,notation,
      {version:'1.0.0',type:'UNRETIMING_TRIPLET_TO_STRAIGHT_THREE',targets:targets(score)},
      {nextRevisionId:'p10-2-blocked-dot'}
    ),
    error=>error?.code==='TIMING_NOT_ADMITTED'&&error?.details?.reason==='BLOCKED_TIMING_COUPLED_NOTATION'
  );
  assert.deepEqual(score,beforeScore);
  assert.deepEqual(notation,beforeNotation);
});

test('P10-2 rejects malformed intent and non-fresh revision ids before mutation',async()=>{
  const module=await import('../dist/packages/editor-tuplet-unretiming-authoring-v4/src/index.js');
  const {score,notation}=fixture();
  assert.throws(
    ()=>module.executeTripletToStraightThreeUnretimingV4(
      score,notation,
      {version:'1.0.0',type:'UNRETIMING_TRIPLET_TO_STRAIGHT_THREE',targets:targets(score).slice(0,2)},
      {nextRevisionId:'p10-2-invalid-intent'}
    ),
    error=>error?.code==='INVALID_INTENT'
  );
  assert.throws(
    ()=>module.executeTripletToStraightThreeUnretimingV4(
      score,notation,
      {version:'1.0.0',type:'UNRETIMING_TRIPLET_TO_STRAIGHT_THREE',targets:targets(score)},
      {nextRevisionId:score.revision.id}
    ),
    error=>error?.code==='INVALID_REVISION_ID'
  );
});
