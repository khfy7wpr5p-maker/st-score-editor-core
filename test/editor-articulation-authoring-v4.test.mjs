import test from 'node:test';
import assert from 'node:assert/strict';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import {
  createNewScoreEditorAppDocument,
  commitAppBasicAuthoringIntent,
  commitAppGraceAuthoringIntent,
  commitAppArticulationAuthoringIntent,
  navigateAppDocumentHistory
} from '../dist/packages/score-editor-app-document/src/index.js';

const ids=()=>{let n=0;return()=>`a-${++n}`;};
const pitch={step:'C',alter:0,octave:4};
const staccato={kind:'staccato',placement:'auto',direction:null};
const accent={kind:'accent',placement:'above',direction:null};
const graceEvent={id:'art-ge',kind:'note',writtenDuration:{numerator:1,denominator:8},playback:{stealTimePreviousPercent:null,stealTimeFollowingPercent:null,makeTime:null},note:{id:'art-gn',pitch:{step:'D',alter:0,octave:4}}};

const base=()=>{
  let document=createNewScoreEditorAppDocument({idFactory:ids()});
  let score=document.session.history.present.score;
  const rest=score.parts[0].staves[0].measures[0].voices[0].events[0];
  document=commitAppBasicAuthoringIntent(document,{version:'1.0.0',type:'REPLACE_REST_WITH_NOTE',target:addressEntityV3(score,rest.id),noteId:'art-anchor-note',pitch},{nextRevisionId:'rev-art-note'});
  return document;
};

test('APP-02B2 toggles articulation on a normal event in unified V4 history',()=>{
  let document=base();
  let score=document.session.history.present.score;
  const event=score.parts[0].staves[0].measures[0].voices[0].events[0];
  document=commitAppArticulationAuthoringIntent(document,{version:'1.0.0',type:'TOGGLE_ARTICULATION',target:addressEntityV3(score,event.id),value:staccato},{nextRevisionId:'rev-art-staccato'});
  assert.equal(document.session.history.present.notation.events[0].notation.articulations[0].kind,'staccato');
  assert.equal(document.session.selection.kind,'event');
  document=navigateAppDocumentHistory(document,'UNDO');
  assert.equal(document.session.history.present.notation.events.length,0);
});

test('APP-02B2 articulation authoring also targets grace events without a parallel history',()=>{
  let document=base();
  let score=document.session.history.present.score;
  const anchor=score.parts[0].staves[0].measures[0].voices[0].events[0];
  document=commitAppGraceAuthoringIntent(document,{version:'1.0.0',type:'CREATE_GRACE_GROUP',target:addressEntityV3(score,anchor.id),placement:'before',groupId:'art-gg',firstEvent:graceEvent},{nextRevisionId:'rev-art-grace'});
  score=document.session.history.present.score;
  document=commitAppArticulationAuthoringIntent(document,{version:'1.0.0',type:'SET_ARTICULATIONS',target:addressEntityV3(score,'art-ge'),value:[accent]},{nextRevisionId:'rev-art-grace-accent'});
  assert.equal(document.session.history.present.notation.graceEvents[0].notation.articulations[0].kind,'accent');
  assert.equal(document.session.selection.kind,'grace-event');
});

test('APP-02B2 invalid articulation payload fails through canonical notation validation',()=>{
  const document=base();
  const score=document.session.history.present.score;
  const event=score.parts[0].staves[0].measures[0].voices[0].events[0];
  assert.throws(()=>commitAppArticulationAuthoringIntent(document,{version:'1.0.0',type:'SET_ARTICULATIONS',target:addressEntityV3(score,event.id),value:[{kind:'staccato',placement:'auto',direction:'up'}]},{nextRevisionId:'rev-art-invalid'}));
});
