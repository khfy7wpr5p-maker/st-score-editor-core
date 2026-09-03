import test from 'node:test';
import assert from 'node:assert/strict';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import {
  createNewScoreEditorAppDocument,
  commitAppBasicAuthoringIntent,
  commitAppOrnamentAuthoringIntent
} from '../dist/packages/score-editor-app-document/src/index.js';
import { executeOrnamentAuthoringV4, OrnamentAuthoringV4Error } from '../dist/packages/editor-ornament-authoring-v4/src/index.js';

const ids=()=>{let n=0;return()=>`o-${++n}`;};
const pitch=(step='C',octave=4)=>({step,alter:0,octave});
const trill={kind:'trill-mark',placement:'auto',accidentalMarks:[]};

const pitchedApp=()=>{
  let document=createNewScoreEditorAppDocument({idFactory:ids()});
  const score=document.session.history.present.score;
  const rest=score.parts[0].staves[0].measures[0].voices[0].events[0];
  document=commitAppBasicAuthoringIntent(document,{version:'1.0.0',type:'REPLACE_REST_WITH_NOTE',target:addressEntityV3(score,rest.id),noteId:'orn-note',pitch:pitch('C')},{nextRevisionId:'rev-orn-note'});
  return document;
};

test('APP-02B3 toggles a local ornament through the unified app session',()=>{
  let document=pitchedApp();
  let score=document.session.history.present.score;
  const event=score.parts[0].staves[0].measures[0].voices[0].events[0];
  document=commitAppOrnamentAuthoringIntent(document,{version:'1.0.0',type:'TOGGLE_LOCAL_ORNAMENT',target:addressEntityV3(score,event.id),value:trill},{nextRevisionId:'rev-orn-trill'});
  assert.equal(document.session.history.present.notation.events[0].notation.ornaments[0].kind,'trill-mark');
  score=document.session.history.present.score;
  document=commitAppOrnamentAuthoringIntent(document,{version:'1.0.0',type:'TOGGLE_LOCAL_ORNAMENT',target:addressEntityV3(score,event.id),value:trill},{nextRevisionId:'rev-orn-trill-off'});
  assert.equal(document.session.history.present.notation.events[0].notation.ornaments.length,0);
});

const twoEventPair=()=>{
  const document=pitchedApp();
  const baseScore=document.session.history.present.score;
  const raw=structuredClone(baseScore);
  const voice=raw.parts[0].staves[0].measures[0].voices[0];
  const first=voice.events[0];
  first.duration={numerator:1,denominator:2};
  voice.events=[first,{id:'orn-event-2',kind:'note',onset:{numerator:1,denominator:2},duration:{numerator:1,denominator:2},note:{id:'orn-note-2',pitch:pitch('E')}}];
  const score=createScoreDocumentV3(raw);
  const old=document.session.history.present.notation;
  const notation=createNotationDocumentV4(score,{...old,documentId:score.id,revisionId:score.revision.id});
  return {score,notation,firstId:first.id,secondId:'orn-event-2'};
};

test('APP-02B3 creates and removes an exact spanning tremolo relation',()=>{
  let {score,notation,firstId,secondId}=twoEventPair();
  let result=executeOrnamentAuthoringV4(score,notation,{version:'1.0.0',type:'CREATE_TREMOLO_RELATION',start:addressEntityV3(score,firstId),stop:addressEntityV3(score,secondId),number:1,marks:3,placement:'auto'},{nextRevisionId:'rev-orn-tremolo'});
  assert.equal(result.notation.events.length,2);
  assert.equal(result.notation.events.flatMap(e=>e.notation.ornaments).filter(o=>o.kind==='tremolo').length,2);
  score=result.score;notation=result.notation;
  result=executeOrnamentAuthoringV4(score,notation,{version:'1.0.0',type:'REMOVE_TREMOLO_RELATION',start:addressEntityV3(score,firstId),stop:addressEntityV3(score,secondId),number:1},{nextRevisionId:'rev-orn-tremolo-off'});
  assert.equal(result.notation.events.flatMap(e=>e.notation.ornaments).filter(o=>o.kind==='tremolo').length,0);
});

test('APP-02B3 rejects relation-number reuse',()=>{
  const {score,notation,firstId,secondId}=twoEventPair();
  const result=executeOrnamentAuthoringV4(score,notation,{version:'1.0.0',type:'CREATE_WAVY_LINE_RELATION',targets:[addressEntityV3(score,firstId),addressEntityV3(score,secondId)],number:2,placement:'above'},{nextRevisionId:'rev-orn-wavy'});
  assert.throws(()=>executeOrnamentAuthoringV4(result.score,result.notation,{version:'1.0.0',type:'CREATE_WAVY_LINE_RELATION',targets:[addressEntityV3(result.score,firstId),addressEntityV3(result.score,secondId)],number:2,placement:'above'},{nextRevisionId:'rev-orn-wavy-dup'}),error=>error instanceof OrnamentAuthoringV4Error&&error.code==='RELATION_NUMBER_IN_USE');
});
