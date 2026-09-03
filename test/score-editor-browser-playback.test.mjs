import test from 'node:test';
import assert from 'node:assert/strict';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createPlaybackEnabledStandaloneScoreEditorController } from '../dist/packages/score-editor-browser-app/src/playback-enabled.js';

const deterministicIds=()=>{let n=0;return()=>`id-${++n}`;};
const fakeHost=()=>{
  let time=5;const scheduled=[];
  return {api:{currentTime:()=>time,resume:async()=>{},scheduleTone:(frequencyHz,startSeconds,durationSeconds,gain)=>{const item={frequencyHz,startSeconds,durationSeconds,gain,stopped:false};scheduled.push(item);return Object.freeze({stop:()=>{item.stopped=true;}});},dispose:async()=>{}},scheduled,setTime:value=>{time=value;}};
};
const create=()=>{const host=fakeHost();const controller=createPlaybackEnabledStandaloneScoreEditorController({playbackHostFactory:()=>host.api,playbackTempoBpm:120});controller.newDocument({idFactory:deterministicIds()});return {controller,host};};
const replaceBlankRest=(controller)=>{
  const score=controller.getDocument().session.history.present.score;
  const rest=score.parts[0].staves[0].measures[0].voices[0].events[0];
  controller.commitBasic({version:'1.0.0',type:'REPLACE_REST_WITH_NOTE',target:addressEntityV3(score,rest.id),noteId:'note-playback',pitch:{step:'C',alter:0,octave:4}},{nextRevisionId:'rev-playback-note'});
};

test('APP-07 browser playback is local/noncanonical and transport operations do not create V4 history',async()=>{
  const {controller,host}=create();
  replaceBlankRest(controller);
  const before=controller.getDocument();
  const beforeRevision=before.session.history.present.score.revision.id;
  const beforePast=before.session.history.past.length;
  const playing=await controller.playbackPlay();
  assert.equal(playing.mode,'playing');
  assert.equal(playing.status.code,'PLAYBACK_PLAYING');
  assert.equal(host.scheduled.length,1);
  assert.equal(controller.profile.playbackCanonicalAuthority,false);
  assert.equal(controller.profile.playbackEditorAdmissionCoupled,false);
  controller.playbackSetTempo(90);
  controller.playbackSeek(0.25);
  controller.playbackPause();
  controller.playbackStop();
  const after=controller.getDocument();
  assert.equal(after.session.history.present.score.revision.id,beforeRevision);
  assert.equal(after.session.history.past.length,beforePast);
  assert.equal(after.session.history.future.length,before.session.history.future.length);
  assert.equal(controller.getPlaybackState().cursor,null);
});

test('APP-07 canonical revision change stops stale playback without blocking the edit/history operation',async()=>{
  const {controller}=create();
  replaceBlankRest(controller);
  await controller.playbackPlay();
  assert.equal(controller.getPlaybackState().mode,'playing');
  const currentRevision=controller.getDocument().session.history.present.score.revision.id;
  controller.undo();
  const after=controller.getDocument();
  assert.notEqual(after.session.history.present.score.revision.id,currentRevision);
  assert.equal(controller.getPlaybackState().mode,'idle');
  assert.equal(controller.getPlaybackState().status.code,'PLAYBACK_STALE_REVISION_STOPPED');
});

test('APP-07 no playable events is playback-specific and does not disable authoring',async()=>{
  const {controller}=create();
  const result=await controller.playbackPlay();
  assert.equal(result.status.code,'PLAYBACK_NO_PLAYABLE_EVENTS');
  assert.equal(controller.getSnapshot().error,null);
  replaceBlankRest(controller);
  assert.equal(controller.getDocument().session.history.present.score.revision.id,'rev-playback-note');
  const playing=await controller.playbackPlay();
  assert.equal(playing.mode,'playing');
});
