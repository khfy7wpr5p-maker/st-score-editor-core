import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4, emptyNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createMeasureFrameAuthoringStandaloneScoreEditorController } from '../dist/packages/score-editor-browser-app/src/measure-frame-authoring.js';
import { createNewScoreEditorAppDocument } from '../dist/packages/score-editor-app-document/src/index.js';
import { createTeacherEventSpanSelectionV4 } from '../dist/packages/editor-teacher-event-span-v4/src/index.js';
import {
  EDITOR_TEACHER_COPY_SNAPSHOT_V4_VERSION,
  TeacherCopySnapshotV4Error,
  createTeacherCopySnapshotV4
} from '../dist/packages/editor-teacher-copy-snapshot-v4/src/index.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const pitch=(step='C',alter=0,octave=4)=>({step,alter,octave});
const note=(id,noteId,onset,duration,step='C')=>({id,kind:'note',onset,duration,note:{id:noteId,pitch:pitch(step)}});
const chord=(id,onset,duration,notes)=>({id,kind:'chord',onset,duration,notes});
const eventNotation=(overrides={})=>({dots:0,beams:[],tuplet:null,articulations:[],ornaments:[],...overrides});
const noteNotation=(overrides={})=>({accidental:null,ties:[],slurs:[],...overrides});

const twoMeasureScore=()=>{
  const controller=createMeasureFrameAuthoringStandaloneScoreEditorController();
  controller.newDocument({preset:'GUITAR_TREBLE'});
  controller.appendMeasure();
  const raw=structuredClone(controller.getDocument().session.history.present.score);
  const staff=raw.parts[0].staves.find(candidate=>candidate.role==='standard');
  staff.measures[0].voices[0].events=[
    note('copy-m1-a','copy-m1-na',{numerator:0,denominator:1},{numerator:1,denominator:4},'C'),
    note('copy-m1-b','copy-m1-nb',{numerator:1,denominator:4},{numerator:3,denominator:4},'D')
  ];
  staff.measures[1].voices[0].events=[
    note('copy-m2-a','copy-m2-na',{numerator:0,denominator:1},{numerator:1,denominator:2},'E'),
    chord('copy-m2-b',{numerator:1,denominator:2},{numerator:1,denominator:2},[
      {id:'copy-m2-nb1',pitch:pitch('G')},
      {id:'copy-m2-nb2',pitch:pitch('B')}
    ])
  ];
  return createScoreDocumentV3(raw);
};

const notationWithLocalMarks=score=>{
  const empty=emptyNotationDocumentV4(score);
  return createNotationDocumentV4(score,{
    ...empty,
    events:[{
      target:addressEntityV3(score,'copy-m1-b'),
      notation:eventNotation({articulations:[{kind:'staccato',placement:'auto',direction:null}]})
    }],
    notes:[{
      target:addressEntityV3(score,'copy-m1-nb'),
      notation:noteNotation({accidental:'natural'})
    }]
  });
};

const span=(score,startId='copy-m1-b',stopId='copy-m2-b')=>
  createTeacherEventSpanSelectionV4(score,addressEntityV3(score,startId),addressEntityV3(score,stopId));

test('P02-COPY01 snapshots cross-measure source content with normalized segment timing and local notation without mutation',()=>{
  const score=twoMeasureScore();
  const notation=notationWithLocalMarks(score);
  const selection=span(score);
  const beforeScore=structuredClone(score);
  const beforeNotation=structuredClone(notation);
  const snapshot=createTeacherCopySnapshotV4(score,notation,selection);

  assert.equal(snapshot.version,EDITOR_TEACHER_COPY_SNAPSHOT_V4_VERSION);
  assert.equal(snapshot.kind,'TEACHER_COPY_SNAPSHOT');
  assert.equal(snapshot.eventCount,3);
  assert.equal(snapshot.noteCount,4);
  assert.equal(snapshot.segments.length,2);
  assert.equal(snapshot.crossesMeasureBoundary,true);
  assert.equal(snapshot.destinationIdentityAssigned,false);
  assert.equal(snapshot.canonicalMutationAuthority,false);
  assert.equal(snapshot.historyMutationAuthority,false);
  assert.deepEqual(snapshot.segments[0].events.map(item=>item.sourceEventId),['copy-m1-b']);
  assert.deepEqual(snapshot.segments[0].events[0].onsetFromSegmentOrigin,{numerator:0,denominator:1});
  assert.deepEqual(snapshot.segments[1].events.map(item=>item.sourceEventId),['copy-m2-a','copy-m2-b']);
  assert.deepEqual(snapshot.segments[1].events[0].onsetFromSegmentOrigin,{numerator:0,denominator:1});
  assert.deepEqual(snapshot.segments[1].events[1].onsetFromSegmentOrigin,{numerator:1,denominator:2});
  assert.equal(snapshot.segments[0].events[0].notation.articulations[0].kind,'staccato');
  assert.equal(snapshot.segments[0].events[0].notes[0].notation.accidental,'natural');
  assert.equal(snapshot.segments[1].events[1].notes.length,2);
  assert.equal(Object.isFrozen(snapshot),true);
  assert.equal(Object.isFrozen(snapshot.segments),true);
  assert.equal(Object.isFrozen(snapshot.segments[1].events[1].notes),true);
  assert.deepEqual(score,beforeScore);
  assert.deepEqual(notation,beforeNotation);
});

test('P02-COPY01 refuses valid tie-coupled source instead of silently dropping relation semantics',()=>{
  const score=twoMeasureScore();
  const empty=emptyNotationDocumentV4(score);
  const notation=createNotationDocumentV4(score,{
    ...empty,
    notes:[
      {target:addressEntityV3(score,'copy-m1-nb'),notation:noteNotation({ties:[{number:1,type:'start'}]})},
      {target:addressEntityV3(score,'copy-m2-na'),notation:noteNotation({ties:[{number:1,type:'stop'}]})}
    ]
  });
  assert.throws(
    ()=>createTeacherCopySnapshotV4(score,notation,span(score,'copy-m1-b','copy-m2-a')),
    error=>error instanceof TeacherCopySnapshotV4Error&&error.code==='RELATION_COUPLED_SOURCE'
  );
});

test('P02-COPY01 refuses beam-coupled source before any destination identity exists',()=>{
  const score=twoMeasureScore();
  const empty=emptyNotationDocumentV4(score);
  const notation=createNotationDocumentV4(score,{
    ...empty,
    events:[
      {target:addressEntityV3(score,'copy-m2-a'),notation:eventNotation({beams:[{number:1,value:'begin'}]})},
      {target:addressEntityV3(score,'copy-m2-b'),notation:eventNotation({beams:[{number:1,value:'end'}]})}
    ]
  });
  assert.throws(
    ()=>createTeacherCopySnapshotV4(score,notation,span(score,'copy-m2-a','copy-m2-b')),
    error=>error instanceof TeacherCopySnapshotV4Error&&error.code==='RELATION_COUPLED_SOURCE'
  );
});

test('P02-COPY01 refuses cross-staff placement coupling',()=>{
  const app=createNewScoreEditorAppDocument({preset:'PIANO_GRAND_STAFF'});
  const raw=structuredClone(app.session.history.present.score);
  const staves=raw.parts[0].staves.filter(staff=>staff.role==='standard');
  staves[0].measures[0].voices[0].events=[
    note('cross-copy-a','cross-copy-na',{numerator:0,denominator:1},{numerator:1,denominator:2},'C'),
    note('cross-copy-b','cross-copy-nb',{numerator:1,denominator:2},{numerator:1,denominator:2},'D')
  ];
  const score=createScoreDocumentV3(raw);
  const empty=emptyNotationDocumentV4(score);
  const notation=createNotationDocumentV4(score,{
    ...empty,
    crossStaffPlacements:[{source:addressEntityV3(score,'cross-copy-a'),displayStaffId:staves[1].id}]
  });
  const selection=createTeacherEventSpanSelectionV4(score,addressEntityV3(score,'cross-copy-a'),addressEntityV3(score,'cross-copy-b'));
  assert.throws(
    ()=>createTeacherCopySnapshotV4(score,notation,selection),
    error=>error instanceof TeacherCopySnapshotV4Error&&error.code==='RELATION_COUPLED_SOURCE'
  );
});

test('P02-COPY01 refuses grace-coupled source',()=>{
  const score0=twoMeasureScore();
  const raw=structuredClone(score0);
  const staff=raw.parts[0].staves.find(candidate=>candidate.role==='standard');
  staff.measures[0].voices[0].graceGroups=[{
    id:'copy-grace-group',
    anchorEventId:'copy-m1-b',
    placement:'before',
    events:[{
      id:'copy-grace-event',
      kind:'note',
      writtenDuration:{numerator:1,denominator:8},
      playback:{stealTimePreviousPercent:null,stealTimeFollowingPercent:null,makeTime:null},
      note:{id:'copy-grace-note',pitch:pitch('C')}
    }]
  }];
  const score=createScoreDocumentV3(raw);
  const notation=emptyNotationDocumentV4(score);
  const selection=span(score);
  assert.throws(
    ()=>createTeacherCopySnapshotV4(score,notation,selection),
    error=>error instanceof TeacherCopySnapshotV4Error&&error.code==='GRACE_COUPLED_SOURCE'
  );
});

test('P02-COPY01 rejects stale notation before building a snapshot',()=>{
  const score=twoMeasureScore();
  const notation=emptyNotationDocumentV4(score);
  const selection=span(score);
  const raw=structuredClone(score);
  raw.revision={id:'rev:copy-newer',parentId:score.revision.id};
  const newer=createScoreDocumentV3(raw);
  assert.throws(
    ()=>createTeacherCopySnapshotV4(newer,notation,selection),
    error=>error instanceof TeacherCopySnapshotV4Error&&error.code==='NOTATION_STALE_OR_INVALID'
  );
});
