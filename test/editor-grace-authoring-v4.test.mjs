import test from 'node:test';
import assert from 'node:assert/strict';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import {
  createNewScoreEditorAppDocument,
  commitAppBasicAuthoringIntent,
  commitAppGraceAuthoringIntent,
  navigateAppDocumentHistory
} from '../dist/packages/score-editor-app-document/src/index.js';
import { GraceAuthoringV4Error } from '../dist/packages/editor-grace-authoring-v4/src/index.js';

const ids=()=>{let n=0;return()=>`g-${++n}`;};
const pitch=(step='C',octave=4)=>({step,alter:0,octave});
const graceEvent=(id,noteId,step='D')=>({id,kind:'note',writtenDuration:{numerator:1,denominator:8},playback:{stealTimePreviousPercent:null,stealTimeFollowingPercent:null,makeTime:null},note:{id:noteId,pitch:pitch(step,4)}});

const pitchedDocument=()=>{
  let document=createNewScoreEditorAppDocument({idFactory:ids()});
  let score=document.session.history.present.score;
  const rest=score.parts[0].staves[0].measures[0].voices[0].events[0];
  document=commitAppBasicAuthoringIntent(document,{version:'1.0.0',type:'REPLACE_REST_WITH_NOTE',target:addressEntityV3(score,rest.id),noteId:'anchor-note',pitch:pitch('C',4)},{nextRevisionId:'rev-anchor-note'});
  return document;
};

test('APP-02B1 creates and edits grace material in the same V4 history',()=>{
  let document=pitchedDocument();
  let score=document.session.history.present.score;
  const anchor=score.parts[0].staves[0].measures[0].voices[0].events[0];
  document=commitAppGraceAuthoringIntent(document,{version:'1.0.0',type:'CREATE_GRACE_GROUP',target:addressEntityV3(score,anchor.id),placement:'before',groupId:'gg-1',firstEvent:graceEvent('ge-1','gn-1','D')},{nextRevisionId:'rev-grace-1'});
  assert.equal(document.session.history.present.score.parts[0].staves[0].measures[0].voices[0].graceGroups.length,1);
  score=document.session.history.present.score;
  document=commitAppGraceAuthoringIntent(document,{version:'1.0.0',type:'ADD_GRACE_EVENT',target:addressEntityV3(score,'gg-1'),index:1,event:graceEvent('ge-2','gn-2','E')},{nextRevisionId:'rev-grace-2'});
  score=document.session.history.present.score;
  document=commitAppGraceAuthoringIntent(document,{version:'1.0.0',type:'SET_GRACE_NOTE_PITCH',target:addressEntityV3(score,'gn-2'),pitch:pitch('F',4)},{nextRevisionId:'rev-grace-3'});
  const group=document.session.history.present.score.parts[0].staves[0].measures[0].voices[0].graceGroups[0];
  assert.equal(group.events[1].note.pitch.step,'F');
  assert.equal(document.session.selection.kind,'grace-note');
  document=navigateAppDocumentHistory(document,'UNDO');
  const undone=document.session.history.present.score.parts[0].staves[0].measures[0].voices[0].graceGroups[0];
  assert.equal(undone.events[1].note.pitch.step,'E');
});

test('APP-02B1 forbids deleting the final grace event implicitly',()=>{
  let document=pitchedDocument();
  let score=document.session.history.present.score;
  const anchor=score.parts[0].staves[0].measures[0].voices[0].events[0];
  document=commitAppGraceAuthoringIntent(document,{version:'1.0.0',type:'CREATE_GRACE_GROUP',target:addressEntityV3(score,anchor.id),placement:'before',groupId:'gg-only',firstEvent:graceEvent('ge-only','gn-only')},{nextRevisionId:'rev-only-1'});
  score=document.session.history.present.score;
  assert.throws(()=>commitAppGraceAuthoringIntent(document,{version:'1.0.0',type:'REMOVE_GRACE_EVENT',target:addressEntityV3(score,'ge-only')},{nextRevisionId:'rev-only-2'}),error=>error instanceof GraceAuthoringV4Error&&error.code==='EMPTY_GROUP_FORBIDDEN');
});

test('APP-02B1 stale grace targets fail closed',()=>{
  let document=pitchedDocument();
  const score=document.session.history.present.score;
  const anchor=score.parts[0].staves[0].measures[0].voices[0].events[0];
  const stale=addressEntityV3(score,anchor.id);
  document=commitAppGraceAuthoringIntent(document,{version:'1.0.0',type:'CREATE_GRACE_GROUP',target:stale,placement:'before',groupId:'gg-stale',firstEvent:graceEvent('ge-stale','gn-stale')},{nextRevisionId:'rev-stale-1'});
  assert.throws(()=>commitAppGraceAuthoringIntent(document,{version:'1.0.0',type:'CREATE_GRACE_GROUP',target:stale,placement:'after',groupId:'gg-stale-2',firstEvent:graceEvent('ge-stale-2','gn-stale-2')},{nextRevisionId:'rev-stale-2'}),error=>error instanceof GraceAuthoringV4Error&&error.code==='STALE_TARGET');
});
