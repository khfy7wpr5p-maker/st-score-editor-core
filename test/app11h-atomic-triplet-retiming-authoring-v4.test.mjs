import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createNewScoreEditorAppDocument } from '../dist/packages/score-editor-app-document/src/index.js';
import {
  executeStraightThreeToTripletAuthoringV4,
  TupletRetimingAuthoringV4Error
} from '../dist/packages/editor-tuplet-retiming-authoring-v4/src/index.js';

const ids=()=>{let n=0;return()=>`app11h-${++n}`;};
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
  const frames=baseNotation.frames.map(entry=>({target:addressEntityV3(score,entry.target.frameId),notation:entry.notation}));
  const measures=baseNotation.measures.map(entry=>({target:addressEntityV3(score,entry.target.measureId),notation:entry.notation}));
  const eventsNotation=Object.entries(eventNotationById).map(([eventId,notation])=>({target:addressEntityV3(score,eventId),notation}));
  const notesNotation=Object.entries(noteNotationById).map(([noteId,notation])=>({target:addressEntityV3(score,noteId),notation}));
  const placements=crossStaffPlacements.map(({eventId,displayStaffIndex})=>{
    const standard=score.parts[0].staves.filter(staff=>staff.role==='standard');
    return {source:addressEntityV3(score,eventId),displayStaffId:standard[displayStaffIndex].id};
  });
  const notation=createNotationDocumentV4(score,{
    contractVersion:'4.0.0',documentId:score.id,revisionId:score.revision.id,
    frames,measures,events:eventsNotation,notes:notesNotation,graceEvents:[],graceNotes:[],crossStaffPlacements:placements
  });
  return {score,notation};
};

const straightEighths=(tail=rest('tail',{numerator:3,denominator:8},{numerator:5,denominator:8}))=>[
  note('e1','n1',{numerator:0,denominator:1},{numerator:1,denominator:8},'C'),
  note('e2','n2',{numerator:1,denominator:8},{numerator:1,denominator:8},'D'),
  note('e3','n3',{numerator:1,denominator:4},{numerator:1,denominator:8},'E'),
  ...(tail===null?[]:[tail])
];

const intent=score=>({
  version:'1.0.0',
  type:'RETIMING_STRAIGHT_THREE_TO_TRIPLET',
  targets:['e1','e2','e3'].map(eventId=>addressEntityV3(score,eventId))
});

const execute=(score,notation,nextRevisionId='app11h-next')=>
  executeStraightThreeToTripletAuthoringV4(score,notation,intent(score),{nextRevisionId});

const firstVoice=score=>score.parts[0].staves.find(staff=>staff.role==='standard').measures[0].voices[0];
const notationForEvent=(notation,eventId)=>notation.events.find(entry=>entry.target.eventId===eventId)?.notation??null;
const notationForNote=(notation,noteId)=>notation.notes.find(entry=>entry.target.noteId===noteId)?.notation??null;

const expectedTuplets=[
  {actualNotes:3,normalNotes:2,marks:[{number:1,type:'start'}]},
  {actualNotes:3,normalNotes:2,marks:[]},
  {actualNotes:3,normalNotes:2,marks:[{number:1,type:'stop'}]}
];

const fnv1a64=value=>{
  let hash=14695981039346656037n;
  const mask=(1n<<64n)-1n;
  for(let i=0;i<value.length;i+=1){hash^=BigInt(value.charCodeAt(i));hash=(hash*1099511628211n)&mask;}
  return hash.toString(16).padStart(16,'0');
};

test('APP-11H atomically retimes three straight eighths, writes triplet semantics and extends adjacent neutral rest',()=>{
  const {score,notation}=state({events:straightEighths()});
  const beforeScore=structuredClone(score);
  const beforeNotation=structuredClone(notation);
  const result=execute(score,notation);
  const events=firstVoice(result.score).events;
  assert.equal(result.score.revision.id,'app11h-next');
  assert.equal(result.score.revision.parentId,score.revision.id);
  assert.equal(result.notation.revisionId,'app11h-next');
  assert.deepEqual(events.map(event=>event.id),['e1','e2','e3','tail']);
  assert.deepEqual(events.slice(0,3).map(event=>event.onset),[
    {numerator:0,denominator:1},{numerator:1,denominator:12},{numerator:1,denominator:6}
  ]);
  assert.deepEqual(events.slice(0,3).map(event=>event.duration),[
    {numerator:1,denominator:12},{numerator:1,denominator:12},{numerator:1,denominator:12}
  ]);
  assert.equal(events[3].kind,'rest');
  assert.deepEqual(events[3].onset,{numerator:1,denominator:4});
  assert.deepEqual(events[3].duration,{numerator:3,denominator:4});
  assert.deepEqual(['e1','e2','e3'].map(id=>notationForEvent(result.notation,id).tuplet),expectedTuplets);
  assert.deepEqual(result.restBalance,{kind:'EXTENDED_ADJACENT_REST',restEventId:'tail'});
  assert.equal(result.selection.kind,'event');
  assert.equal(result.selection.eventId,'e1');
  assert.equal(result.selection.revisionId,'app11h-next');
  assert.equal(result.admission.admitted,true);
  assert.deepEqual(score,beforeScore);
  assert.deepEqual(notation,beforeNotation);
});

test('APP-11H creates a deterministic residual rest when the following event is pitched',()=>{
  const tail=note('next','next-note',{numerator:3,denominator:8},{numerator:1,denominator:8},'F');
  const {score,notation}=state({events:straightEighths(tail)});
  const result=execute(score,notation,'app11h-create-rest');
  const events=firstVoice(result.score).events;
  const expectedId=`tuplet-rest:${fnv1a64(`${score.id}|${score.revision.id}|e1|e2|e3|app11h-create-rest`)}`;
  assert.deepEqual(events.map(event=>event.id),['e1','e2','e3',expectedId,'next']);
  const residual=events[3];
  assert.equal(residual.kind,'rest');
  assert.deepEqual(residual.onset,{numerator:1,denominator:4});
  assert.deepEqual(residual.duration,{numerator:1,denominator:8});
  assert.deepEqual(result.restBalance,{kind:'CREATED_RESIDUAL_REST',restEventId:expectedId});
  assert.equal(notationForEvent(result.notation,expectedId),null);
});

test('APP-11H does not absorb a notation-coupled adjacent rest and instead creates a separate residual rest',()=>{
  const {score,notation}=state({
    events:straightEighths(),
    eventNotationById:{tail:eventNotation({articulations:[{kind:'staccato',placement:'auto',direction:null}]})}
  });
  const result=execute(score,notation,'app11h-coupled-tail');
  const events=firstVoice(result.score).events;
  assert.equal(events.length,5);
  assert.equal(events[3].kind,'rest');
  assert.match(events[3].id,/^tuplet-rest:[0-9a-f]{16}$/);
  assert.equal(events[4].id,'tail');
  assert.deepEqual(events[4].onset,{numerator:3,denominator:8});
  assert.deepEqual(events[4].duration,{numerator:5,denominator:8});
  assert.deepEqual(notationForEvent(result.notation,'tail').articulations,[{kind:'staccato',placement:'auto',direction:null}]);
  assert.equal(result.restBalance.kind,'CREATED_RESIDUAL_REST');
});

test('APP-11H preserves event articulations/ornaments and note accidental/slur semantics while adding tuplets',()=>{
  const {score,notation}=state({
    events:straightEighths(),
    eventNotationById:{
      e1:eventNotation({articulations:[{kind:'accent',placement:'above',direction:null}]}),
      e2:eventNotation({ornaments:[{kind:'trill-mark',placement:'above',accidentalMarks:[]}]})
    },
    noteNotationById:{
      n1:noteNotation({accidental:'natural',slurs:[{number:1,type:'start'}]}),
      n3:noteNotation({slurs:[{number:1,type:'stop'}]})
    }
  });
  const result=execute(score,notation,'app11h-preserve');
  assert.deepEqual(notationForEvent(result.notation,'e1').articulations,[{kind:'accent',placement:'above',direction:null}]);
  assert.deepEqual(notationForEvent(result.notation,'e2').ornaments,[{kind:'trill-mark',placement:'above',accidentalMarks:[]}]);
  assert.deepEqual(notationForNote(result.notation,'n1'),{accidental:'natural',ties:[],slurs:[{number:1,type:'start'}]});
  assert.deepEqual(notationForNote(result.notation,'n3'),{accidental:null,ties:[],slurs:[{number:1,type:'stop'}]});
  assert.deepEqual(['e1','e2','e3'].map(id=>notationForEvent(result.notation,id).tuplet),expectedTuplets);
});

test('APP-11H supports a mixed note/chord/rest selected range without changing canonical identities',()=>{
  const {score,notation}=state({events:[
    chord('e1',['n1','n1b'],{numerator:0,denominator:1},{numerator:1,denominator:4}),
    rest('e2',{numerator:1,denominator:4},{numerator:1,denominator:4}),
    note('e3','n3',{numerator:1,denominator:2},{numerator:1,denominator:4},'G'),
    rest('tail',{numerator:3,denominator:4},{numerator:1,denominator:4})
  ]});
  const result=execute(score,notation,'app11h-mixed');
  const events=firstVoice(result.score).events;
  assert.deepEqual(events.slice(0,3).map(event=>event.id),['e1','e2','e3']);
  assert.equal(events[0].kind,'chord');
  assert.deepEqual(events[0].notes.map(note=>note.id),['n1','n1b']);
  assert.equal(events[1].kind,'rest');
  assert.deepEqual(events.slice(0,3).map(event=>event.duration),Array(3).fill(null).map(()=>({numerator:1,denominator:6})));
  assert.deepEqual(events[3].onset,{numerator:1,denominator:2});
  assert.deepEqual(events[3].duration,{numerator:1,denominator:2});
});

test('APP-11H admits imported MusicXML contraction without inventing measure or Voice topology',()=>{
  const {score,notation}=state({events:straightEighths(),sourceFormat:'musicxml'});
  const beforeParts=score.parts.length;
  const beforeStaves=score.parts[0].staves.length;
  const beforeMeasures=score.parts[0].staves[0].measures.length;
  const beforeVoices=score.parts[0].staves[0].measures[0].voices.length;
  const result=execute(score,notation,'app11h-imported');
  assert.equal(result.score.source.format,'musicxml');
  assert.equal(result.score.parts.length,beforeParts);
  assert.equal(result.score.parts[0].staves.length,beforeStaves);
  assert.equal(result.score.parts[0].staves[0].measures.length,beforeMeasures);
  assert.equal(result.score.parts[0].staves[0].measures[0].voices.length,beforeVoices);
  assert.equal(result.restBalance.kind,'EXTENDED_ADJACENT_REST');
});

test('APP-11H propagates APP-11G fail-closed timing/coupling admission without mutation',()=>{
  let current=state({events:straightEighths(),eventNotationById:{e2:eventNotation({beams:[{number:1,value:'continue'}]})}});
  let before=structuredClone(current.score);
  assert.throws(
    ()=>execute(current.score,current.notation,'app11h-beam'),
    error=>error instanceof TupletRetimingAuthoringV4Error&&error.code==='TIMING_NOT_ADMITTED'&&error.details.reason==='BLOCKED_TIMING_COUPLED_NOTATION'
  );
  assert.deepEqual(current.score,before);

  current=state({
    preset:'PIANO_GRAND_STAFF',events:straightEighths(),crossStaffPlacements:[{eventId:'e2',displayStaffIndex:1}]
  });
  before=structuredClone(current.score);
  assert.throws(
    ()=>execute(current.score,current.notation,'app11h-cross'),
    error=>error instanceof TupletRetimingAuthoringV4Error&&error.code==='TIMING_NOT_ADMITTED'&&error.details.reason==='BLOCKED_CROSS_STAFF_TARGET'
  );
  assert.deepEqual(current.score,before);
});

test('APP-11H rejects already-canonical triplet timing because APP-11F owns metadata-only authoring',()=>{
  const {score,notation}=state({events:[
    note('e1','n1',{numerator:0,denominator:1},{numerator:1,denominator:12}),
    note('e2','n2',{numerator:1,denominator:12},{numerator:1,denominator:12}),
    note('e3','n3',{numerator:1,denominator:6},{numerator:1,denominator:12})
  ]});
  assert.throws(
    ()=>execute(score,notation,'app11h-already-triplet'),
    error=>error instanceof TupletRetimingAuthoringV4Error&&error.code==='TIMING_NOT_ADMITTED'&&error.details.reason==='BLOCKED_WRITTEN_BASE_UNSUPPORTED'
  );
});

test('APP-11H validates fresh revision identity and stale target revisions',()=>{
  const {score,notation}=state({events:straightEighths()});
  assert.throws(
    ()=>executeStraightThreeToTripletAuthoringV4(score,notation,intent(score),{nextRevisionId:score.revision.id}),
    error=>error instanceof TupletRetimingAuthoringV4Error&&error.code==='INVALID_REVISION_ID'
  );
  const staleIntent=intent(score);
  const raw=structuredClone(score);
  raw.revision={id:'app11h-newer',parentId:score.revision.id};
  const newer=createScoreDocumentV3(raw);
  const newerNotation=createNotationDocumentV4(newer,{
    ...structuredClone(notation),documentId:newer.id,revisionId:newer.revision.id,
    frames:notation.frames.map(entry=>({target:addressEntityV3(newer,entry.target.frameId),notation:entry.notation})),
    measures:notation.measures.map(entry=>({target:addressEntityV3(newer,entry.target.measureId),notation:entry.notation})),
    events:[],notes:[],graceEvents:[],graceNotes:[],crossStaffPlacements:[]
  });
  assert.throws(
    ()=>executeStraightThreeToTripletAuthoringV4(newer,newerNotation,staleIntent,{nextRevisionId:'app11h-stale-next'}),
    error=>error?.code==='STALE_TARGET'
  );
});

test('APP-11H deterministic residual-rest collision fails closed',()=>{
  const nextRevisionId='app11h-collision-next';
  const base=state({events:straightEighths(null)});
  const expectedId=`tuplet-rest:${fnv1a64(`${base.score.id}|${base.score.revision.id}|e1|e2|e3|${nextRevisionId}`)}`;
  const raw=structuredClone(base.score);
  const voice=raw.parts[0].staves.find(staff=>staff.role==='standard').measures[0].voices[0];
  voice.events.push(note(expectedId,'collision-note',{numerator:3,denominator:8},{numerator:1,denominator:8},'F'));
  const score=createScoreDocumentV3(raw);
  const notation=createNotationDocumentV4(score,{
    ...structuredClone(base.notation),documentId:score.id,revisionId:score.revision.id,
    frames:base.notation.frames.map(entry=>({target:addressEntityV3(score,entry.target.frameId),notation:entry.notation})),
    measures:base.notation.measures.map(entry=>({target:addressEntityV3(score,entry.target.measureId),notation:entry.notation})),
    events:[],notes:[],graceEvents:[],graceNotes:[],crossStaffPlacements:[]
  });
  assert.throws(
    ()=>execute(score,notation,nextRevisionId),
    error=>error instanceof TupletRetimingAuthoringV4Error&&error.code==='REST_ID_COLLISION'&&error.details.id===expectedId
  );
});
