import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createNewScoreEditorAppDocument } from '../dist/packages/score-editor-app-document/src/index.js';
import { analyzeTripletToStraightThreeUnretimingV4 } from '../dist/packages/editor-tuplet-unretiming-admission-v4/src/index.js';

const ids=()=>{let n=0;return()=>`app11j-reg-${++n}`;};
const pitch=(step='C')=>({step,alter:0,octave:4});
const note=(id,noteId,onset,duration,step='C')=>({id,kind:'note',onset,duration,note:{id:noteId,pitch:pitch(step)}});
const rest=(id,onset,duration)=>({id,kind:'rest',onset,duration});
const eventNotation=(overrides={})=>({dots:0,beams:[],tuplet:null,articulations:[],ornaments:[],...overrides});
const triplet=(position)=>eventNotation({tuplet:{actualNotes:3,normalNotes:2,marks:position==='middle'?[]:[{number:1,type:position}]}});

const tripletEvents=()=>[
  note('e1','n1',{numerator:0,denominator:1},{numerator:1,denominator:12},'C'),
  note('e2','n2',{numerator:1,denominator:12},{numerator:1,denominator:12},'D'),
  note('e3','n3',{numerator:1,denominator:6},{numerator:1,denominator:12},'E'),
  rest('r1',{numerator:1,denominator:4},{numerator:1,denominator:2})
];

const state=(events,{sourceFormat='synthetic'}={})=>{
  const document=createNewScoreEditorAppDocument({idFactory:ids(),preset:'GUITAR_TREBLE'});
  const baseScore=document.session.history.present.score;
  const baseNotation=document.session.history.present.notation;
  const raw=structuredClone(baseScore);
  raw.source={...raw.source,format:sourceFormat};
  const sourceStaff=raw.parts[0].staves.find(staff=>staff.role==='standard');
  sourceStaff.measures[0].voices[0].events=events;
  const score=createScoreDocumentV3(raw);
  const notation=createNotationDocumentV4(score,{
    contractVersion:'4.0.0',
    documentId:score.id,
    revisionId:score.revision.id,
    frames:baseNotation.frames.map(entry=>({target:addressEntityV3(score,entry.target.frameId),notation:entry.notation})),
    measures:baseNotation.measures.map(entry=>({target:addressEntityV3(score,entry.target.measureId),notation:entry.notation})),
    events:[
      {target:addressEntityV3(score,'e1'),notation:triplet('start')},
      {target:addressEntityV3(score,'e2'),notation:triplet('middle')},
      {target:addressEntityV3(score,'e3'),notation:triplet('stop')}
    ],
    notes:[],
    graceEvents:[],
    graceNotes:[],
    crossStaffPlacements:[]
  });
  const targets=['e1','e2','e3'].map(eventId=>addressEntityV3(score,eventId));
  return {score,notation,targets};
};

test('APP-11J blocks MusicXML expansion while current measure semantics are not supplied to V4 admission',()=>{
  const {score,notation,targets}=state(tripletEvents(),{sourceFormat:'musicxml'});
  const result=analyzeTripletToStraightThreeUnretimingV4(score,notation,targets);
  assert.equal(result.admitted,false);
  assert.equal(result.reason,'BLOCKED_MEASURE_SEMANTICS_UNPROVEN');
});

test('APP-11J blocks a later event that overlaps the proposed growth interval',()=>{
  const events=[
    ...tripletEvents(),
    note('e4','n4',{numerator:1,denominator:3},{numerator:1,denominator:8},'F')
  ];
  const {score,notation,targets}=state(events);
  const result=analyzeTripletToStraightThreeUnretimingV4(score,notation,targets);
  assert.equal(result.admitted,false);
  assert.equal(result.reason,'BLOCKED_CURRENT_TIMING_INVALID');
});
