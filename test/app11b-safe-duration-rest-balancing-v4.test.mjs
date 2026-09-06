import test from 'node:test';
import assert from 'node:assert/strict';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import {
  createNewScoreEditorAppDocument,
  commitAppBasicAuthoringIntent,
  commitAppKeypadAction,
  selectAppSemanticAddress,
  navigateAppDocumentHistory
} from '../dist/packages/score-editor-app-document/src/index.js';
import { BasicAuthoringV4Error } from '../dist/packages/editor-basic-authoring-v4/src/index.js';
import { SafeEditorKeypadExecutionV4Error } from '../dist/packages/editor-keypad-rhythm-safe-v4/src/index.js';

const ids=()=>{let n=0;return()=>`app11b-${++n}`;};
const action=actionId=>({version:'1.0.0',actionId});
const firstVoice=document=>document.session.history.present.score.parts[0].staves[0].measures[0].voices[0];
const firstEvent=document=>firstVoice(document).events[0];
const eventById=(document,id)=>firstVoice(document).events.find(event=>event.id===id);
const pitch=(step='C',alter=0,octave=4)=>({step,alter,octave});

const pitchedWhole=()=>{
  let document=createNewScoreEditorAppDocument({idFactory:ids(),preset:'GUITAR_TREBLE'});
  const score=document.session.history.present.score;
  const rest=firstEvent(document);
  document=commitAppBasicAuthoringIntent(document,{version:'1.0.0',type:'REPLACE_REST_WITH_NOTE',target:addressEntityV3(score,rest.id),noteId:'app11b-note',pitch:pitch()},{nextRevisionId:'app11b-rev-note'});
  return document;
};

test('APP-11B basic duration contraction creates deterministic explicit residual rest in one history revision',()=>{
  let document=pitchedWhole();
  const before=document.session.history.past.length;
  const score=document.session.history.present.score;
  const event=firstEvent(document);
  document=commitAppBasicAuthoringIntent(document,{version:'1.0.0',type:'SET_EVENT_DURATION',target:addressEntityV3(score,event.id),duration:{numerator:1,denominator:4}},{nextRevisionId:'app11b-rev-quarter'});
  const events=firstVoice(document).events;
  assert.equal(document.session.history.past.length,before+1);
  assert.equal(events.length,2);
  assert.equal(events[0].id,event.id);
  assert.deepEqual(events[0].duration,{numerator:1,denominator:4});
  assert.equal(events[1].kind,'rest');
  assert.match(events[1].id,/^rhythm-rest:[0-9a-f]{16}$/);
  assert.deepEqual(events[1].onset,{numerator:1,denominator:4});
  assert.deepEqual(events[1].duration,{numerator:3,denominator:4});
});

test('APP-11B basic duration growth consumes only adjacent explicit rest and keeps coverage exact',()=>{
  let document=pitchedWhole();
  let score=document.session.history.present.score;
  let event=firstEvent(document);
  document=commitAppBasicAuthoringIntent(document,{version:'1.0.0',type:'SET_EVENT_DURATION',target:addressEntityV3(score,event.id),duration:{numerator:1,denominator:4}},{nextRevisionId:'app11b-grow-quarter'});
  score=document.session.history.present.score;event=firstEvent(document);
  const restId=firstVoice(document).events[1].id;
  document=commitAppBasicAuthoringIntent(document,{version:'1.0.0',type:'SET_EVENT_DURATION',target:addressEntityV3(score,event.id),duration:{numerator:1,denominator:2}},{nextRevisionId:'app11b-grow-half'});
  const events=firstVoice(document).events;
  assert.equal(events.length,2);
  assert.equal(events[1].id,restId);
  assert.deepEqual(events[0].duration,{numerator:1,denominator:2});
  assert.deepEqual(events[1].onset,{numerator:1,denominator:2});
  assert.deepEqual(events[1].duration,{numerator:1,denominator:2});
});

test('APP-11B session keypad dot edits use shared rhythm authority and preserve exact note selection',()=>{
  let document=pitchedWhole();
  let score=document.session.history.present.score;
  let event=firstEvent(document);
  document=commitAppBasicAuthoringIntent(document,{version:'1.0.0',type:'SET_EVENT_DURATION',target:addressEntityV3(score,event.id),duration:{numerator:1,denominator:2}},{nextRevisionId:'app11b-dot-half'});
  score=document.session.history.present.score;
  document=selectAppSemanticAddress(document,addressEntityV3(score,'app11b-note'));
  document=commitAppKeypadAction(document,action('dot.set.1'),null,{nextRevisionId:'app11b-dot-on'});
  assert.equal(document.session.selection.kind,'note');
  assert.equal(document.session.selection.noteId,'app11b-note');
  let events=firstVoice(document).events;
  assert.deepEqual(events[0].duration,{numerator:3,denominator:4});
  assert.deepEqual(events[1].onset,{numerator:3,denominator:4});
  assert.deepEqual(events[1].duration,{numerator:1,denominator:4});
  assert.equal(document.session.history.present.notation.events.find(entry=>entry.target.eventId===events[0].id)?.notation.dots,1);

  document=commitAppKeypadAction(document,action('dot.set.0'),null,{nextRevisionId:'app11b-dot-off'});
  events=firstVoice(document).events;
  assert.equal(document.session.selection.kind,'note');
  assert.deepEqual(events[0].duration,{numerator:1,denominator:2});
  assert.deepEqual(events[1].onset,{numerator:1,denominator:2});
  assert.deepEqual(events[1].duration,{numerator:1,denominator:2});
  assert.equal(document.session.history.present.notation.events.find(entry=>entry.target.eventId===events[0].id)?.notation.dots,0);
});

test('APP-11B duration growth can consume the whole adjacent rest and undo restores exact pair',()=>{
  let document=pitchedWhole();
  let score=document.session.history.present.score;
  let event=firstEvent(document);
  document=commitAppBasicAuthoringIntent(document,{version:'1.0.0',type:'SET_EVENT_DURATION',target:addressEntityV3(score,event.id),duration:{numerator:1,denominator:2}},{nextRevisionId:'app11b-full-prep'});
  score=document.session.history.present.score;
  document=selectAppSemanticAddress(document,addressEntityV3(score,'app11b-note'));
  document=commitAppKeypadAction(document,action('duration.whole'),null,{nextRevisionId:'app11b-full'});
  assert.equal(firstVoice(document).events.length,1);
  assert.deepEqual(firstEvent(document).duration,{numerator:1,denominator:1});
  document=navigateAppDocumentHistory(document,'UNDO');
  const events=firstVoice(document).events;
  assert.equal(events.length,2);
  assert.deepEqual(events[0].duration,{numerator:1,denominator:2});
  assert.equal(events[1].kind,'rest');
  assert.deepEqual(events[1].onset,{numerator:1,denominator:2});
});

test('APP-11B timing-safe keypad delegates same-duration rest conversion without inventing timing',()=>{
  let document=pitchedWhole();
  let score=document.session.history.present.score;
  let event=firstEvent(document);
  document=commitAppBasicAuthoringIntent(document,{version:'1.0.0',type:'SET_EVENT_DURATION',target:addressEntityV3(score,event.id),duration:{numerator:1,denominator:4}},{nextRevisionId:'app11b-rest-prep'});
  score=document.session.history.present.score;event=firstEvent(document);
  document=selectAppSemanticAddress(document,addressEntityV3(score,event.id));
  document=commitAppKeypadAction(document,action('rest.quarter'),null,{nextRevisionId:'app11b-rest-same-duration'});
  assert.equal(firstEvent(document).kind,'rest');
  assert.deepEqual(firstEvent(document).duration,{numerator:1,denominator:4});
  assert.equal(firstVoice(document).events.length,2);
});

test('APP-11B growth into pitched occupancy fails closed through both basic and keypad paths',()=>{
  let document=pitchedWhole();
  let score=document.session.history.present.score;
  let first=firstEvent(document);
  document=commitAppBasicAuthoringIntent(document,{version:'1.0.0',type:'SET_EVENT_DURATION',target:addressEntityV3(score,first.id),duration:{numerator:1,denominator:4}},{nextRevisionId:'app11b-overlap-quarter'});
  score=document.session.history.present.score;
  const residual=firstVoice(document).events[1];
  document=commitAppBasicAuthoringIntent(document,{version:'1.0.0',type:'REPLACE_REST_WITH_NOTE',target:addressEntityV3(score,residual.id),noteId:'app11b-note-2',pitch:pitch('E')},{nextRevisionId:'app11b-overlap-note2'});
  score=document.session.history.present.score;first=firstEvent(document);
  const target=addressEntityV3(score,first.id);
  assert.throws(()=>commitAppBasicAuthoringIntent(document,{version:'1.0.0',type:'SET_EVENT_DURATION',target,duration:{numerator:1,denominator:2}},{nextRevisionId:'app11b-overlap-basic'}),error=>error instanceof BasicAuthoringV4Error&&error.code==='RHYTHM_TIMING_REJECTED');

  document=selectAppSemanticAddress(document,target);
  assert.throws(()=>commitAppKeypadAction(document,action('duration.half'),null,{nextRevisionId:'app11b-overlap-keypad'}),error=>error instanceof SafeEditorKeypadExecutionV4Error&&error.code==='RHYTHM_TIMING_REJECTED');
  assert.deepEqual(firstEvent(document).duration,{numerator:1,denominator:4});
});

test('APP-11B non-timing keypad actions still delegate to the existing V4 primitive',()=>{
  let document=pitchedWhole();
  let score=document.session.history.present.score;
  document=selectAppSemanticAddress(document,addressEntityV3(score,'app11b-note'));
  document=commitAppKeypadAction(document,action('accidental.sharp'),null,{nextRevisionId:'app11b-sharp'});
  const event=firstEvent(document);
  assert.equal(event.kind,'note');
  assert.equal(event.note.pitch.alter,1);
  assert.equal(document.session.history.present.notation.notes.find(entry=>entry.target.noteId==='app11b-note')?.notation.accidental,'sharp');
});