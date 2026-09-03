import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalPlaybackTransportV1, PlaybackTransportV1Error } from '../dist/packages/playback-web-audio/src/index.js';

const address=(eventId)=>({contractVersion:'3.0.0',kind:'event',documentId:'doc-1',revisionId:'rev-1',partId:'part-1',staffId:'staff-1',frameId:'frame-1',measureId:'measure-1',voiceId:'voice-1',eventId});
const plan={version:'1.0.0',documentId:'doc-1',revisionId:'rev-1',status:'READY',durationWholeNotes:1,omittedGraceEventCount:0,warnings:[],events:[
  {eventId:'event-1',address:address('event-1'),startWholeNotes:0,durationWholeNotes:0.25,pitches:[{pitch:{step:'A',alter:0,octave:4},frequencyHz:440}]},
  {eventId:'event-2',address:address('event-2'),startWholeNotes:0.5,durationWholeNotes:0.5,pitches:[{pitch:{step:'E',alter:0,octave:5},frequencyHz:659.255}]}
]};

const fakeHost=()=>{
  let time=10;let resumed=0;let disposed=0;const scheduled=[];
  return {
    api:{
      currentTime:()=>time,
      resume:async()=>{resumed+=1;},
      scheduleTone:(frequencyHz,startSeconds,durationSeconds,gain)=>{const item={frequencyHz,startSeconds,durationSeconds,gain,stopped:false};scheduled.push(item);return Object.freeze({stop:()=>{item.stopped=true;}});},
      dispose:async()=>{disposed+=1;}
    },
    scheduled,
    setTime:(value)=>{time=value;},
    resumed:()=>resumed,
    disposed:()=>disposed
  };
};

test('APP-07 transport schedules score-time events locally and keeps cursor semantic/non-mutating',async()=>{
  const host=fakeHost();
  const transport=createLocalPlaybackTransportV1(host.api,plan,{tempoBpm:120});
  const playing=await transport.play();
  assert.equal(playing.mode,'playing');
  assert.equal(host.resumed(),1);
  assert.equal(host.scheduled.length,2);
  assert.equal(host.scheduled[0].startSeconds,10);
  assert.equal(host.scheduled[0].durationSeconds,0.5);
  assert.equal(host.scheduled[1].startSeconds,11);
  host.setTime(10.25);
  const mid=transport.getSnapshot();
  assert.equal(mid.positionWholeNotes,0.125);
  assert.equal(mid.cursor.eventId,'event-1');
  const paused=transport.pause();
  assert.equal(paused.mode,'paused');
  assert.ok(host.scheduled.every(item=>item.stopped));
  const seeked=transport.seek(0.5);
  assert.equal(seeked.positionWholeNotes,0.5);
  assert.equal(seeked.cursor.eventId,'event-2');
  transport.setTempo(60);
  await transport.play();
  assert.equal(transport.getSnapshot().tempoBpm,60);
  assert.equal(host.scheduled.at(-1).startSeconds,10.25);
  transport.stop();
  assert.equal(transport.getSnapshot().positionWholeNotes,0);
  await transport.dispose();
  assert.equal(host.disposed(),1);
});

test('APP-07 transport rejects invalid tempo without changing score authority',()=>{
  const host=fakeHost();
  assert.throws(()=>createLocalPlaybackTransportV1(host.api,plan,{tempoBpm:999}),error=>error instanceof PlaybackTransportV1Error&&error.code==='INVALID_TEMPO');
});

test('APP-07 empty playback plan fails playback-specific only',async()=>{
  const host=fakeHost();
  const transport=createLocalPlaybackTransportV1(host.api,{...plan,status:'EMPTY',durationWholeNotes:0,events:[]});
  await assert.rejects(()=>transport.play(),error=>error instanceof PlaybackTransportV1Error&&error.code==='EMPTY_PLAN');
});
