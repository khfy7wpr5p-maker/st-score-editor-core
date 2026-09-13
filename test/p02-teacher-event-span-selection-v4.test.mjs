import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNewScoreEditorAppDocument } from '../dist/packages/score-editor-app-document/src/index.js';
import { createMeasureFrameAuthoringStandaloneScoreEditorController } from '../dist/packages/score-editor-browser-app/src/measure-frame-authoring.js';
import {
  EDITOR_TEACHER_EVENT_SPAN_V4_VERSION,
  TeacherEventSpanSelectionV4Error,
  createTeacherEventSpanSelectionV4
} from '../dist/packages/editor-teacher-event-span-v4/src/index.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const pitch=(step='C',alter=0,octave=4)=>({step,alter,octave});
const note=(id,noteId,onset,duration,step='C')=>({id,kind:'note',onset,duration,note:{id:noteId,pitch:pitch(step)}});
const rest=(id)=>({id,kind:'rest',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:1}});

const multiMeasureScore=()=>{
  const controller=createMeasureFrameAuthoringStandaloneScoreEditorController();
  controller.newDocument({preset:'GUITAR_TREBLE'});
  controller.appendMeasure();
  controller.appendMeasure();
  const raw=structuredClone(controller.getDocument().session.history.present.score);
  const staff=raw.parts[0].staves.find(candidate=>candidate.role==='standard');
  staff.measures[0].voices[0].events=[
    note('m1-a','m1-na',{numerator:0,denominator:1},{numerator:1,denominator:4},'C'),
    note('m1-b','m1-nb',{numerator:1,denominator:4},{numerator:1,denominator:4},'D'),
    note('m1-c','m1-nc',{numerator:1,denominator:2},{numerator:1,denominator:2},'E')
  ];
  staff.measures[1].voices[0].events=[
    note('m2-a','m2-na',{numerator:0,denominator:1},{numerator:1,denominator:2},'F'),
    note('m2-b','m2-nb',{numerator:1,denominator:2},{numerator:1,denominator:2},'G')
  ];
  staff.measures[2].voices[0].events=[
    note('m3-a','m3-na',{numerator:0,denominator:1},{numerator:1,denominator:4},'A'),
    note('m3-b','m3-nb',{numerator:1,denominator:4},{numerator:3,denominator:4},'B')
  ];
  return createScoreDocumentV3(raw);
};

const voiceGapScore=()=>{
  const score=multiMeasureScore();
  const raw=structuredClone(score);
  const staff=raw.parts[0].staves.find(candidate=>candidate.role==='standard');
  staff.measures[0].voices.push({id:'voice2-m1',ordinal:2,events:[rest('v2-m1')],graceGroups:[]});
  staff.measures[2].voices.push({id:'voice2-m3',ordinal:2,events:[rest('v2-m3')],graceGroups:[]});
  return createScoreDocumentV3(raw);
};

test('P02 teacher event span selects an exact same-measure canonical slice without mutation',()=>{
  const score=multiMeasureScore();
  const before=structuredClone(score);
  const start=addressEntityV3(score,'m1-b');
  const stop=addressEntityV3(score,'m1-c');
  const selection=createTeacherEventSpanSelectionV4(score,start,stop);
  assert.equal(selection.version,EDITOR_TEACHER_EVENT_SPAN_V4_VERSION);
  assert.equal(selection.kind,'TEACHER_EVENT_SPAN');
  assert.equal(selection.crossesMeasureBoundary,false);
  assert.equal(selection.voiceOrdinal,1);
  assert.deepEqual(selection.targets.map(item=>item.eventId),['m1-b','m1-c']);
  assert.deepEqual(selection.measureIds,[start.measureId]);
  assert.deepEqual(selection.frameIds,[start.frameId]);
  assert.equal(Object.isFrozen(selection),true);
  assert.equal(Object.isFrozen(selection.targets),true);
  assert.equal(Object.isFrozen(selection.targets[0]),true);
  assert.deepEqual(score,before);
});

test('P02 teacher event span expands start/stop endpoints across aligned measures in one voice ordinal',()=>{
  const score=multiMeasureScore();
  const start=addressEntityV3(score,'m1-b');
  const stop=addressEntityV3(score,'m3-a');
  const selection=createTeacherEventSpanSelectionV4(score,start,stop);
  assert.equal(selection.crossesMeasureBoundary,true);
  assert.deepEqual(selection.targets.map(item=>item.eventId),['m1-b','m1-c','m2-a','m2-b','m3-a']);
  assert.equal(selection.measureIds.length,3);
  assert.equal(selection.frameIds.length,3);
  assert.equal(selection.start.eventId,'m1-b');
  assert.equal(selection.stop.eventId,'m3-a');
});

test('P02 teacher event span rejects duplicate, reversed and stale endpoints fail closed',()=>{
  const score=multiMeasureScore();
  const first=addressEntityV3(score,'m1-b');
  const last=addressEntityV3(score,'m3-a');
  assert.throws(
    ()=>createTeacherEventSpanSelectionV4(score,first,first),
    error=>error instanceof TeacherEventSpanSelectionV4Error&&error.code==='DUPLICATE_ENDPOINT'
  );
  assert.throws(
    ()=>createTeacherEventSpanSelectionV4(score,last,first),
    error=>error instanceof TeacherEventSpanSelectionV4Error&&error.code==='SELECTION_ORDER_INVALID'
  );
  const raw=structuredClone(score);
  raw.revision={id:'rev:p02-newer',parentId:score.revision.id};
  const newer=createScoreDocumentV3(raw);
  assert.throws(
    ()=>createTeacherEventSpanSelectionV4(newer,first,last),
    error=>error instanceof TeacherEventSpanSelectionV4Error&&error.code==='STALE_ENDPOINT'
  );
});

test('P02 teacher event span rejects cross-staff endpoints',()=>{
  const documentValue=createNewScoreEditorAppDocument({preset:'PIANO_GRAND_STAFF'});
  const score=documentValue.session.history.present.score;
  const staves=score.parts[0].staves.filter(staff=>staff.role==='standard');
  const left=staves[0].measures[0].voices[0].events[0];
  const right=staves[1].measures[0].voices[0].events[0];
  const start=addressEntityV3(score,left.id);
  const stop=addressEntityV3(score,right.id);
  assert.throws(
    ()=>createTeacherEventSpanSelectionV4(score,start,stop),
    error=>error instanceof TeacherEventSpanSelectionV4Error&&error.code==='SELECTION_SCOPE_MISMATCH'
  );
});

test('P02 teacher event span rejects different voice ordinals',()=>{
  const documentValue=createNewScoreEditorAppDocument({preset:'GUITAR_TREBLE'});
  const raw=structuredClone(documentValue.session.history.present.score);
  const staff=raw.parts[0].staves.find(candidate=>candidate.role==='standard');
  staff.measures[0].voices.push({id:'voice2-single',ordinal:2,events:[rest('v2-single')],graceGroups:[]});
  const score=createScoreDocumentV3(raw);
  const start=addressEntityV3(score,staff.measures[0].voices[0].events[0].id);
  const stop=addressEntityV3(score,'v2-single');
  assert.throws(
    ()=>createTeacherEventSpanSelectionV4(score,start,stop),
    error=>error instanceof TeacherEventSpanSelectionV4Error&&error.code==='VOICE_ORDINAL_MISMATCH'
  );
});

test('P02 teacher event span rejects missing selected voice ordinal in an intermediate measure',()=>{
  const score=voiceGapScore();
  const start=addressEntityV3(score,'v2-m1');
  const stop=addressEntityV3(score,'v2-m3');
  assert.throws(
    ()=>createTeacherEventSpanSelectionV4(score,start,stop),
    error=>error instanceof TeacherEventSpanSelectionV4Error&&error.code==='VOICE_GAP_UNSUPPORTED'
  );
});
