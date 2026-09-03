import test from 'node:test';
import assert from 'node:assert/strict';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import {
  createNewScoreEditorAppDocument,
  commitAppBasicAuthoringIntent,
  selectAppSemanticAddress,
  commitAppKeypadAction
} from '../dist/packages/score-editor-app-document/src/index.js';
import { executeEditorKeypadActionV4, EditorKeypadExecutionV4Error } from '../dist/packages/editor-keypad-execution-v4/src/index.js';

const ids=()=>{let n=0;return()=>`k-${++n}`;};
const action=actionId=>({version:'1.0.0',actionId});
const pitch=(step='C',alter=0,octave=4)=>({step,alter,octave});
const pitched=()=>{
  let doc=createNewScoreEditorAppDocument({idFactory:ids()});
  const score=doc.session.history.present.score;
  const rest=score.parts[0].staves[0].measures[0].voices[0].events[0];
  doc=commitAppBasicAuthoringIntent(doc,{version:'1.0.0',type:'REPLACE_REST_WITH_NOTE',target:addressEntityV3(score,rest.id),noteId:'key-note',pitch:pitch()},{nextRevisionId:'rev-key-note'});
  return doc;
};

test('APP-02C accidental updates canonical alter and display accidental in one V4 revision',()=>{
  let doc=pitched();
  let score=doc.session.history.present.score;
  doc=selectAppSemanticAddress(doc,addressEntityV3(score,'key-note'));
  const before=score.revision.id;
  doc=commitAppKeypadAction(doc,action('accidental.sharp'),null,{nextRevisionId:'rev-key-sharp'});
  score=doc.session.history.present.score;
  assert.equal(score.revision.parentId,before);
  assert.equal(score.parts[0].staves[0].measures[0].voices[0].events[0].note.pitch.alter,1);
  assert.equal(doc.session.history.present.notation.notes[0].notation.accidental,'sharp');
  assert.equal(doc.session.selection.kind,'note');
  assert.equal(doc.session.selection.revisionId,'rev-key-sharp');
});

test('APP-02C simple duration clears dots and dot action changes canonical duration atomically',()=>{
  let doc=pitched();
  let score=doc.session.history.present.score;
  const event=score.parts[0].staves[0].measures[0].voices[0].events[0];
  doc=selectAppSemanticAddress(doc,addressEntityV3(score,event.id));
  doc=commitAppKeypadAction(doc,action('duration.quarter'),null,{nextRevisionId:'rev-key-quarter'});
  assert.deepEqual(doc.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events[0].duration,{numerator:1,denominator:4});
  assert.equal(doc.session.history.present.notation.events[0].notation.dots,0);
  doc=commitAppKeypadAction(doc,action('dot.set.1'),null,{nextRevisionId:'rev-key-dot'});
  assert.deepEqual(doc.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events[0].duration,{numerator:3,denominator:8});
  assert.equal(doc.session.history.present.notation.events[0].notation.dots,1);
});

test('APP-02C rest action converts a pitched event and sets duration in one revision',()=>{
  let doc=pitched();
  let score=doc.session.history.present.score;
  const event=score.parts[0].staves[0].measures[0].voices[0].events[0];
  doc=selectAppSemanticAddress(doc,addressEntityV3(score,event.id));
  doc=commitAppKeypadAction(doc,action('rest.eighth'),null,{nextRevisionId:'rev-key-rest'});
  const next=doc.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events[0];
  assert.equal(next.kind,'rest');
  assert.deepEqual(next.duration,{numerator:1,denominator:8});
  assert.equal(doc.session.selection.kind,'event');
});

test('APP-02C rest action refuses implicit deletion of note notation',()=>{
  let doc=pitched();
  let score=doc.session.history.present.score;
  doc=selectAppSemanticAddress(doc,addressEntityV3(score,'key-note'));
  doc=commitAppKeypadAction(doc,action('accidental.flat'),null,{nextRevisionId:'rev-key-flat'});
  score=doc.session.history.present.score;
  doc=selectAppSemanticAddress(doc,addressEntityV3(score,score.parts[0].staves[0].measures[0].voices[0].events[0].id));
  assert.throws(()=>commitAppKeypadAction(doc,action('rest.quarter'),null,{nextRevisionId:'rev-key-rest-blocked'}),e=>e instanceof EditorKeypadExecutionV4Error&&e.code==='NOTATION_ORPHAN_RISK');
});

const threeEventPair=()=>{
  const doc=pitched();
  const raw=structuredClone(doc.session.history.present.score);
  const voice=raw.parts[0].staves[0].measures[0].voices[0];
  voice.events=[
    {id:'trip-1',kind:'note',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:12},note:{id:'trip-n1',pitch:pitch('C')}},
    {id:'trip-2',kind:'note',onset:{numerator:1,denominator:12},duration:{numerator:1,denominator:12},note:{id:'trip-n2',pitch:pitch('D')}},
    {id:'trip-3',kind:'note',onset:{numerator:1,denominator:6},duration:{numerator:1,denominator:12},note:{id:'trip-n3',pitch:pitch('E')}}
  ];
  const score=createScoreDocumentV3(raw);
  const old=doc.session.history.present.notation;
  const notation=createNotationDocumentV4(score,{...old,documentId:score.id,revisionId:score.revision.id});
  return {score,notation};
};

test('APP-02C triplet requires explicit exact range and adds 3:2 notation without retiming',()=>{
  const {score,notation}=threeEventPair();
  const targets=['trip-1','trip-2','trip-3'].map(id=>addressEntityV3(score,id));
  const result=executeEditorKeypadActionV4(score,notation,addressEntityV3(score,'trip-2'),action('tuplet.triplet'),{version:'1.0.0',kind:'EVENT_RANGE',targets},{nextRevisionId:'rev-key-triplet'});
  assert.deepEqual(result.score.parts[0].staves[0].measures[0].voices[0].events.map(e=>e.duration),[{numerator:1,denominator:12},{numerator:1,denominator:12},{numerator:1,denominator:12}]);
  assert.equal(result.notation.events.length,3);
  assert.deepEqual(result.notation.events.map(e=>e.notation.tuplet.actualNotes),[3,3,3]);
});

const tiePair=()=>{
  const doc=pitched();
  const raw=structuredClone(doc.session.history.present.score);
  const voice=raw.parts[0].staves[0].measures[0].voices[0];
  voice.events=[
    {id:'tie-1',kind:'note',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:2},note:{id:'tie-n1',pitch:pitch('G')}},
    {id:'tie-2',kind:'note',onset:{numerator:1,denominator:2},duration:{numerator:1,denominator:2},note:{id:'tie-n2',pitch:pitch('G')}}
  ];
  const score=createScoreDocumentV3(raw);
  const old=doc.session.history.present.notation;
  const notation=createNotationDocumentV4(score,{...old,documentId:score.id,revisionId:score.revision.id});
  return {score,notation};
};

test('APP-02C tie toggles exact same-pitch consecutive note pair with source-owned relation',()=>{
  const {score,notation}=tiePair();
  const start=addressEntityV3(score,'tie-n1'),stop=addressEntityV3(score,'tie-n2');
  let result=executeEditorKeypadActionV4(score,notation,start,action('tie.edit'),{version:'1.0.0',kind:'NOTE_PAIR',start,stop},{nextRevisionId:'rev-key-tie'});
  assert.equal(result.notation.notes.length,2);
  assert.deepEqual(result.notation.notes.find(e=>e.target.noteId==='tie-n1').notation.ties,[{number:1,type:'start'}]);
  assert.deepEqual(result.notation.notes.find(e=>e.target.noteId==='tie-n2').notation.ties,[{number:1,type:'stop'}]);
  const start2=addressEntityV3(result.score,'tie-n1'),stop2=addressEntityV3(result.score,'tie-n2');
  result=executeEditorKeypadActionV4(result.score,result.notation,start2,action('tie.edit'),{version:'1.0.0',kind:'NOTE_PAIR',start:start2,stop:stop2},{nextRevisionId:'rev-key-tie-off'});
  assert.deepEqual(result.notation.notes.find(e=>e.target.noteId==='tie-n1').notation.ties,[]);
  assert.deepEqual(result.notation.notes.find(e=>e.target.noteId==='tie-n2').notation.ties,[]);
});
