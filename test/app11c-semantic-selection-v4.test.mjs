import test from 'node:test';
import assert from 'node:assert/strict';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import {
  createNewScoreEditorAppDocument,
  commitAppBasicAuthoringIntent
} from '../dist/packages/score-editor-app-document/src/index.js';
import { executeEditorKeypadActionV4 } from '../dist/packages/editor-keypad-execution-v4/src/index.js';
import {
  EDITOR_SEMANTIC_SELECTION_V4_VERSION,
  SemanticSelectionV4Error,
  createSingleSemanticSelectionV4,
  createNotePairSemanticSelectionV4,
  createEventRangeSemanticSelectionV4,
  semanticSelectionPrimaryV4,
  toEditorKeypadNotePairTargetV4,
  toEditorKeypadTripletTargetV4
} from '../dist/packages/editor-semantic-selection-v4/src/index.js';

const ids=()=>{let n=0;return()=>`s-${++n}`;};
const action=actionId=>({version:'1.0.0',actionId});
const pitch=(step='C',alter=0,octave=4)=>({step,alter,octave});

const pitched=()=>{
  let doc=createNewScoreEditorAppDocument({idFactory:ids()});
  const score=doc.session.history.present.score;
  const rest=score.parts[0].staves[0].measures[0].voices[0].events[0];
  doc=commitAppBasicAuthoringIntent(doc,{version:'1.0.0',type:'REPLACE_REST_WITH_NOTE',target:addressEntityV3(score,rest.id),noteId:'selection-note',pitch:pitch()},{nextRevisionId:'rev-selection-note'});
  return doc;
};

const scoreWithEvents=(events)=>{
  const doc=pitched();
  const raw=structuredClone(doc.session.history.present.score);
  raw.parts[0].staves[0].measures[0].voices[0].events=events;
  const score=createScoreDocumentV3(raw);
  const old=doc.session.history.present.notation;
  const notation=createNotationDocumentV4(score,{...old,documentId:score.id,revisionId:score.revision.id});
  return {score,notation};
};

const tiePair=()=>scoreWithEvents([
  {id:'pair-1',kind:'note',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:2},note:{id:'pair-n1',pitch:pitch('G')}},
  {id:'pair-2',kind:'note',onset:{numerator:1,denominator:2},duration:{numerator:1,denominator:2},note:{id:'pair-n2',pitch:pitch('G')}}
]);

const tripletEvents=()=>scoreWithEvents([
  {id:'range-1',kind:'note',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:12},note:{id:'range-n1',pitch:pitch('C')}},
  {id:'range-2',kind:'note',onset:{numerator:1,denominator:12},duration:{numerator:1,denominator:12},note:{id:'range-n2',pitch:pitch('D')}},
  {id:'range-3',kind:'note',onset:{numerator:1,denominator:6},duration:{numerator:1,denominator:12},note:{id:'range-n3',pitch:pitch('E')}}
]);

test('APP-11C single semantic selection is exact revision-bound and history-free',()=>{
  const doc=pitched();
  const score=doc.session.history.present.score;
  const before=structuredClone(score);
  const address=addressEntityV3(score,'selection-note');
  const selection=createSingleSemanticSelectionV4(score,address);
  assert.equal(selection.version,EDITOR_SEMANTIC_SELECTION_V4_VERSION);
  assert.equal(selection.kind,'SINGLE');
  assert.equal(selection.primary.kind,'note');
  assert.equal(selection.primary.noteId,'selection-note');
  assert.equal(semanticSelectionPrimaryV4(selection).noteId,'selection-note');
  assert.equal(Object.isFrozen(selection),true);
  assert.equal(Object.isFrozen(selection.primary),true);
  assert.deepEqual(score,before);

  const raw=structuredClone(score);
  raw.revision={id:'rev-selection-newer',parentId:score.revision.id};
  const newer=createScoreDocumentV3(raw);
  assert.throws(
    ()=>createSingleSemanticSelectionV4(newer,address),
    error=>error instanceof SemanticSelectionV4Error&&error.code==='STALE_SELECTION'
  );
});

test('APP-11C NOTE_PAIR preserves exact note identity and adapts into existing tie primitive',()=>{
  const {score,notation}=tiePair();
  const start=addressEntityV3(score,'pair-n1');
  const stop=addressEntityV3(score,'pair-n2');
  const selection=createNotePairSemanticSelectionV4(score,start,stop);
  assert.equal(selection.kind,'NOTE_PAIR');
  assert.equal(selection.start.noteId,'pair-n1');
  assert.equal(selection.stop.noteId,'pair-n2');
  assert.equal(semanticSelectionPrimaryV4(selection).noteId,'pair-n1');
  const target=toEditorKeypadNotePairTargetV4(selection);
  assert.deepEqual(target,{version:'1.0.0',kind:'NOTE_PAIR',start:selection.start,stop:selection.stop});

  const result=executeEditorKeypadActionV4(
    score,
    notation,
    semanticSelectionPrimaryV4(selection),
    action('tie.edit'),
    target,
    {nextRevisionId:'rev-selection-tie'}
  );
  assert.deepEqual(result.notation.notes.find(item=>item.target.noteId==='pair-n1').notation.ties,[{number:1,type:'start'}]);
  assert.deepEqual(result.notation.notes.find(item=>item.target.noteId==='pair-n2').notation.ties,[{number:1,type:'stop'}]);
});

test('APP-11C NOTE_PAIR rejects duplicate or reversed canonical endpoints before relation execution',()=>{
  const {score}=tiePair();
  const start=addressEntityV3(score,'pair-n1');
  const stop=addressEntityV3(score,'pair-n2');
  assert.throws(
    ()=>createNotePairSemanticSelectionV4(score,start,start),
    error=>error instanceof SemanticSelectionV4Error&&error.code==='DUPLICATE_TARGET'
  );
  assert.throws(
    ()=>createNotePairSemanticSelectionV4(score,stop,start),
    error=>error instanceof SemanticSelectionV4Error&&error.code==='SELECTION_ORDER_INVALID'
  );
});

test('APP-11C EVENT_RANGE preserves exact canonical order and adapts into existing triplet primitive',()=>{
  const {score,notation}=tripletEvents();
  const addresses=['range-1','range-2','range-3'].map(id=>addressEntityV3(score,id));
  const selection=createEventRangeSemanticSelectionV4(score,addresses);
  assert.equal(selection.kind,'EVENT_RANGE');
  assert.deepEqual(selection.targets.map(item=>item.eventId),['range-1','range-2','range-3']);
  assert.equal(Object.isFrozen(selection.targets),true);
  assert.equal(semanticSelectionPrimaryV4(selection).eventId,'range-1');
  const target=toEditorKeypadTripletTargetV4(selection);
  assert.deepEqual(target.targets.map(item=>item.eventId),['range-1','range-2','range-3']);

  const result=executeEditorKeypadActionV4(
    score,
    notation,
    semanticSelectionPrimaryV4(selection),
    action('tuplet.triplet'),
    target,
    {nextRevisionId:'rev-selection-triplet'}
  );
  assert.deepEqual(result.notation.events.map(item=>item.notation.tuplet.actualNotes),[3,3,3]);
});

test('APP-11C EVENT_RANGE fails closed on duplicate, reversed, non-contiguous and non-triplet cardinality',()=>{
  const {score}=tripletEvents();
  const first=addressEntityV3(score,'range-1');
  const second=addressEntityV3(score,'range-2');
  const third=addressEntityV3(score,'range-3');
  assert.throws(
    ()=>createEventRangeSemanticSelectionV4(score,[first,first]),
    error=>error instanceof SemanticSelectionV4Error&&error.code==='DUPLICATE_TARGET'
  );
  assert.throws(
    ()=>createEventRangeSemanticSelectionV4(score,[second,first]),
    error=>error instanceof SemanticSelectionV4Error&&error.code==='SELECTION_ORDER_INVALID'
  );
  assert.throws(
    ()=>createEventRangeSemanticSelectionV4(score,[first,third]),
    error=>error instanceof SemanticSelectionV4Error&&error.code==='RANGE_NOT_CONTIGUOUS'
  );
  const two=createEventRangeSemanticSelectionV4(score,[first,second]);
  assert.throws(
    ()=>toEditorKeypadTripletTargetV4(two),
    error=>error instanceof SemanticSelectionV4Error&&error.code==='RANGE_CARDINALITY_UNSUPPORTED'
  );
});

test('APP-11C advanced-target adapters reject the wrong semantic selection kind',()=>{
  const {score}=tiePair();
  const single=createSingleSemanticSelectionV4(score,addressEntityV3(score,'pair-n1'));
  assert.throws(
    ()=>toEditorKeypadNotePairTargetV4(single),
    error=>error instanceof SemanticSelectionV4Error&&error.code==='SELECTION_KIND'
  );
  assert.throws(
    ()=>toEditorKeypadTripletTargetV4(single),
    error=>error instanceof SemanticSelectionV4Error&&error.code==='SELECTION_KIND'
  );
});
