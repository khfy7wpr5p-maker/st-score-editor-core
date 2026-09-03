import test from 'node:test';
import assert from 'node:assert/strict';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createPlaybackPlanV1, pitchFrequencyHzV1 } from '../dist/packages/playback-plan-v1/src/index.js';

const playback=()=>({stealTimePreviousPercent:null,stealTimeFollowingPercent:null,makeTime:null});
const note=(id,eventId,onset,duration,step='C',octave=4)=>({id:eventId,kind:'note',onset,duration,note:{id,pitch:{step,alter:0,octave}}});
const rest=(id,onset,duration)=>({id,kind:'rest',onset,duration});
const chord=(eventId,onset,duration)=>({id:eventId,kind:'chord',onset,duration,notes:[{id:`${eventId}-a`,pitch:{step:'A',alter:0,octave:4}},{id:`${eventId}-e`,pitch:{step:'E',alter:0,octave:5}}]});
const score=()=>createScoreDocumentV3({
  schemaVersion:'3.0.0',id:'doc-playback',revision:{id:'rev-playback-1',parentId:null},source:{sha256:'a'.repeat(64),format:'synthetic',byteLength:null},
  measureFrames:[{id:'frame-1',ordinal:1,displayNumber:'1'},{id:'frame-2',ordinal:2,displayNumber:'2'}],
  parts:[{id:'part-1',ordinal:1,name:'Piano',instrument:{id:'instrument-1',name:'Piano',shortName:'Pno.'},staves:[{
    id:'staff-1',ordinal:1,role:'standard',measures:[
      {id:'measure-1',frameId:'frame-1',voices:[{id:'voice-1',ordinal:1,events:[note('note-c4','event-c4',{numerator:0,denominator:1},{numerator:1,denominator:4}),rest('rest-1',{numerator:1,denominator:4},{numerator:1,denominator:4})],graceGroups:[{id:'grace-group-1',anchorEventId:'event-c4',placement:'before',events:[{id:'grace-event-1',kind:'note',writtenDuration:{numerator:1,denominator:16},playback:playback(),note:{id:'grace-note-1',pitch:{step:'D',alter:0,octave:4}}}]}]}]},
      {id:'measure-2',frameId:'frame-2',voices:[{id:'voice-2',ordinal:1,events:[chord('event-chord',{numerator:0,denominator:1},{numerator:1,denominator:2})],graceGroups:[]}]}
    ]
  }]}]
});

test('APP-07 playback plan is revision-bound, deterministic and uses source score timing rather than renderer geometry',()=>{
  const value=createPlaybackPlanV1(score());
  assert.equal(value.documentId,'doc-playback');
  assert.equal(value.revisionId,'rev-playback-1');
  assert.equal(value.status,'PARTIAL');
  assert.equal(value.durationWholeNotes,1);
  assert.equal(value.events.length,2);
  assert.equal(value.events[0].eventId,'event-c4');
  assert.equal(value.events[0].startWholeNotes,0);
  assert.equal(value.events[1].eventId,'event-chord');
  assert.equal(value.events[1].startWholeNotes,0.5);
  assert.equal(value.events[0].address.kind,'event');
  assert.equal(value.events[0].address.revisionId,'rev-playback-1');
  assert.equal(value.omittedGraceEventCount,1);
  assert.deepEqual(value.warnings.map(item=>item.code),['GRACE_PLAYBACK_DEFERRED']);
  assert.equal(Object.isFrozen(value),true);
  assert.equal(Object.isFrozen(value.events),true);
});

test('APP-07 pitch conversion is deterministic and A4 remains 440 Hz',()=>{
  assert.equal(pitchFrequencyHzV1({step:'A',alter:0,octave:4}),440);
  assert.ok(Math.abs(pitchFrequencyHzV1({step:'C',alter:0,octave:4})-261.625565)<0.001);
});

test('APP-07 empty frame remains explicit partial zero-extent evidence instead of inventing canonical meter duration',()=>{
  const value=structuredClone(score());
  value.parts[0].staves[0].measures[1].voices[0].events=[];
  const plan=createPlaybackPlanV1(value);
  assert.equal(plan.status,'PARTIAL');
  assert.ok(plan.warnings.some(item=>item.code==='EMPTY_FRAME_ZERO_EXTENT'));
  assert.equal(plan.durationWholeNotes,0.5);
});
