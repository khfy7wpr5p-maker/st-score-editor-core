import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4, emptyNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createNewScoreEditorAppDocument } from '../dist/packages/score-editor-app-document/src/index.js';
import { createTeacherEventSpanSelectionV4 } from '../dist/packages/editor-teacher-event-span-v4/src/index.js';
import { createTeacherCopySnapshotV4 } from '../dist/packages/editor-teacher-copy-snapshot-v4/src/index.js';
import {
  EDITOR_TEACHER_INSERT_ADMISSION_V4_VERSION,
  TeacherInsertAdmissionV4Error,
  analyzeTeacherInsertAfterEventV4
} from '../dist/packages/editor-teacher-insert-admission-v4/src/index.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const pitch=(step='C',alter=0,octave=4)=>({step,alter,octave});
const note=(id,noteId,onset,duration,step='C')=>({id,kind:'note',onset,duration,note:{id:noteId,pitch:pitch(step)}});
const rest=(id,onset,duration)=>({id,kind:'rest',onset,duration});
const eventNotation=(overrides={})=>({dots:0,beams:[],tuplet:null,articulations:[],ornaments:[],...overrides});
const playback=()=>({stealTimePreviousPercent:null,stealTimeFollowingPercent:null,makeTime:null});

const baseRaw=()=>{
  const app=createNewScoreEditorAppDocument({preset:'GUITAR_TREBLE'});
  return structuredClone(app.session.history.present.score);
};

const scoreRemoveCapacity=()=>{
  const raw=baseRaw();
  const voice=raw.parts[0].staves.find(candidate=>candidate.role==='standard').measures[0].voices[0];
  voice.events=[
    note('insert-src-a','insert-src-na',{numerator:0,denominator:1},{numerator:1,denominator:8},'C'),
    note('insert-src-b','insert-src-nb',{numerator:1,denominator:8},{numerator:1,denominator:8},'D'),
    note('insert-anchor','insert-anchor-note',{numerator:1,denominator:4},{numerator:1,denominator:4},'E'),
    note('insert-suffix','insert-suffix-note',{numerator:1,denominator:2},{numerator:1,denominator:4},'F'),
    rest('insert-tail',{numerator:3,denominator:4},{numerator:1,denominator:4})
  ];
  voice.graceGroups=[];
  return createScoreDocumentV3(raw);
};

const scoreShrinkCapacity=()=>{
  const raw=baseRaw();
  const voice=raw.parts[0].staves.find(candidate=>candidate.role==='standard').measures[0].voices[0];
  voice.events=[
    note('insert-src-a','insert-src-na',{numerator:0,denominator:1},{numerator:1,denominator:16},'C'),
    note('insert-src-b','insert-src-nb',{numerator:1,denominator:16},{numerator:1,denominator:16},'D'),
    note('insert-anchor','insert-anchor-note',{numerator:1,denominator:8},{numerator:1,denominator:4},'E'),
    note('insert-suffix','insert-suffix-note',{numerator:3,denominator:8},{numerator:1,denominator:8},'F'),
    rest('insert-tail',{numerator:1,denominator:2},{numerator:1,denominator:2})
  ];
  voice.graceGroups=[];
  return createScoreDocumentV3(raw);
};

const snapshotFor=score=>{
  const notation=emptyNotationDocumentV4(score);
  const selection=createTeacherEventSpanSelectionV4(
    score,
    addressEntityV3(score,'insert-src-a'),
    addressEntityV3(score,'insert-src-b')
  );
  return createTeacherCopySnapshotV4(score,notation,selection);
};

const admissionFor=(score,notation=emptyNotationDocumentV4(score),snapshot=snapshotFor(score),anchorId='insert-anchor')=>
  analyzeTeacherInsertAfterEventV4(score,notation,snapshot,addressEntityV3(score,anchorId));

test('P02-INSERT01 admits exact insert-after-anchor by shifting suffix and consuming the trailing neutral rest',()=>{
  const score=scoreRemoveCapacity();
  const notation=emptyNotationDocumentV4(score);
  const snapshot=snapshotFor(score);
  const beforeScore=structuredClone(score);
  const beforeNotation=structuredClone(notation);
  const beforeSnapshot=structuredClone(snapshot);
  const admission=admissionFor(score,notation,snapshot);

  assert.equal(admission.version,EDITOR_TEACHER_INSERT_ADMISSION_V4_VERSION);
  assert.equal(admission.kind,'TEACHER_INSERT_ADMISSION');
  assert.equal(admission.admitted,true);
  assert.equal(admission.mode,'INSERT_AFTER_EVENT_USING_TRAILING_NEUTRAL_REST_CAPACITY');
  assert.equal(admission.destinationAnchorEventId,'insert-anchor');
  assert.deepEqual(admission.insertStart,{numerator:1,denominator:2});
  assert.deepEqual(admission.insertExtent,{numerator:1,denominator:4});
  assert.deepEqual(admission.insertEnd,{numerator:3,denominator:4});
  assert.deepEqual(admission.suffixShift,[{
    eventId:'insert-suffix',
    sourceOnset:{numerator:1,denominator:2},
    targetOnset:{numerator:3,denominator:4}
  }]);
  assert.equal(admission.trailingRestPlan.kind,'REMOVE_TRAILING_REST');
  assert.equal(admission.trailingRestPlan.restEventId,'insert-tail');
  assert.equal(admission.identityAllocationRequired,true);
  assert.equal(admission.relationRemappingRequired,false);
  assert.equal(admission.canonicalMutationAuthority,false);
  assert.equal(admission.historyMutationAuthority,false);
  assert.deepEqual(score,beforeScore);
  assert.deepEqual(notation,beforeNotation);
  assert.deepEqual(snapshot,beforeSnapshot);
});

test('P02-INSERT01 plans exact trailing-rest shrink when capacity exceeds inserted extent',()=>{
  const score=scoreShrinkCapacity();
  const admission=admissionFor(score);
  assert.deepEqual(admission.insertExtent,{numerator:1,denominator:8});
  assert.deepEqual(admission.suffixShift,[{
    eventId:'insert-suffix',
    sourceOnset:{numerator:3,denominator:8},
    targetOnset:{numerator:1,denominator:2}
  }]);
  assert.equal(admission.trailingRestPlan.kind,'SHRINK_TRAILING_REST_FORWARD');
  assert.deepEqual(admission.trailingRestPlan.targetOnset,{numerator:5,denominator:8});
  assert.deepEqual(admission.trailingRestPlan.targetDuration,{numerator:3,denominator:8});
});

test('P02-INSERT01 rejects insufficient trailing-rest capacity instead of growing the measure implicitly',()=>{
  const raw=structuredClone(scoreRemoveCapacity());
  const voice=raw.parts[0].staves.find(candidate=>candidate.role==='standard').measures[0].voices[0];
  voice.events[3].duration={numerator:3,denominator:8};
  voice.events[4].onset={numerator:7,denominator:8};
  voice.events[4].duration={numerator:1,denominator:8};
  const score=createScoreDocumentV3(raw);
  assert.throws(
    ()=>admissionFor(score),
    error=>error instanceof TeacherInsertAdmissionV4Error&&error.code==='TRAILING_CAPACITY_INSUFFICIENT'
  );
});

test('P02-INSERT01 rejects a notation-coupled trailing rest',()=>{
  const score=scoreRemoveCapacity();
  const empty=emptyNotationDocumentV4(score);
  const notation=createNotationDocumentV4(score,{
    ...empty,
    events:[{target:addressEntityV3(score,'insert-tail'),notation:eventNotation({dots:1})}]
  });
  assert.throws(
    ()=>admissionFor(score,notation),
    error=>error instanceof TeacherInsertAdmissionV4Error&&error.code==='TRAILING_REST_NOT_NEUTRAL'
  );
});

test('P02-INSERT01 rejects hidden destination suffix gaps or overlaps',()=>{
  const raw=structuredClone(scoreRemoveCapacity());
  const voice=raw.parts[0].staves.find(candidate=>candidate.role==='standard').measures[0].voices[0];
  voice.events[3].onset={numerator:9,denominator:16};
  const score=createScoreDocumentV3(raw);
  assert.throws(
    ()=>admissionFor(score),
    error=>error instanceof TeacherInsertAdmissionV4Error&&error.code==='DESTINATION_TIMING_GAP_OR_OVERLAP'
  );
});

test('P02-INSERT01 rejects relation-coupled anchor/suffix content before any timing shift is authorized',()=>{
  const score=scoreRemoveCapacity();
  const empty=emptyNotationDocumentV4(score);
  const notation=createNotationDocumentV4(score,{
    ...empty,
    events:[
      {target:addressEntityV3(score,'insert-anchor'),notation:eventNotation({beams:[{number:1,value:'begin'}]})},
      {target:addressEntityV3(score,'insert-suffix'),notation:eventNotation({beams:[{number:1,value:'end'}]})}
    ]
  });
  assert.throws(
    ()=>admissionFor(score,notation),
    error=>error instanceof TeacherInsertAdmissionV4Error&&error.code==='RELATION_COUPLED_DESTINATION'
  );
});

test('P02-INSERT01 rejects grace-coupled destination anchors',()=>{
  const raw=structuredClone(scoreRemoveCapacity());
  const voice=raw.parts[0].staves.find(candidate=>candidate.role==='standard').measures[0].voices[0];
  voice.graceGroups=[{
    id:'insert-grace-group',
    anchorEventId:'insert-anchor',
    placement:'before',
    events:[{
      id:'insert-grace-event',
      kind:'note',
      writtenDuration:{numerator:1,denominator:16},
      playback:playback(),
      note:{id:'insert-grace-note',pitch:pitch('G')}
    }]
  }];
  const score=createScoreDocumentV3(raw);
  assert.throws(
    ()=>admissionFor(score),
    error=>error instanceof TeacherInsertAdmissionV4Error&&error.code==='GRACE_COUPLED_DESTINATION'
  );
});

test('P02-INSERT01 rejects stale source snapshots after revision changes',()=>{
  const score=scoreRemoveCapacity();
  const snapshot=snapshotFor(score);
  const raw=structuredClone(score);
  raw.revision={id:'rev:insert-newer',parentId:score.revision.id};
  const newer=createScoreDocumentV3(raw);
  assert.throws(
    ()=>admissionFor(newer,emptyNotationDocumentV4(newer),snapshot),
    error=>error instanceof TeacherInsertAdmissionV4Error&&error.code==='SNAPSHOT_STALE_FOR_DESTINATION'
  );
});

test('P02-INSERT01 explicitly blocks cross-measure source snapshots in its first profile',()=>{
  const score=scoreRemoveCapacity();
  const snapshot=structuredClone(snapshotFor(score));
  snapshot.crossesMeasureBoundary=true;
  snapshot.segments.push({...structuredClone(snapshot.segments[0]),frameOffset:1});
  assert.throws(
    ()=>admissionFor(score,emptyNotationDocumentV4(score),snapshot),
    error=>error instanceof TeacherInsertAdmissionV4Error&&error.code==='CROSS_MEASURE_SNAPSHOT_UNSUPPORTED'
  );
});

test('P02-INSERT01 rejects hidden gaps in a tampered source snapshot',()=>{
  const score=scoreRemoveCapacity();
  const snapshot=structuredClone(snapshotFor(score));
  snapshot.segments[0].events[1].onsetFromSegmentOrigin={numerator:3,denominator:16};
  assert.throws(
    ()=>admissionFor(score,emptyNotationDocumentV4(score),snapshot),
    error=>error instanceof TeacherInsertAdmissionV4Error&&error.code==='SOURCE_GAPS_UNSUPPORTED'
  );
});

test('P02-INSERT01 rejects source overlap with the destination shift/capacity range',()=>{
  const score=scoreRemoveCapacity();
  const notation=emptyNotationDocumentV4(score);
  const selection=createTeacherEventSpanSelectionV4(
    score,
    addressEntityV3(score,'insert-src-a'),
    addressEntityV3(score,'insert-src-b')
  );
  const snapshot=createTeacherCopySnapshotV4(score,notation,selection);
  assert.throws(
    ()=>analyzeTeacherInsertAfterEventV4(score,notation,snapshot,addressEntityV3(score,'insert-src-b')),
    error=>error instanceof TeacherInsertAdmissionV4Error&&error.code==='DESTINATION_RANGE_IN_SOURCE_SNAPSHOT'
  );
});

test('P02-INSERT01 rejects voices without explicit trailing rest capacity',()=>{
  const raw=structuredClone(scoreRemoveCapacity());
  const voice=raw.parts[0].staves.find(candidate=>candidate.role==='standard').measures[0].voices[0];
  voice.events=[...voice.events.slice(0,-2),note('insert-suffix','insert-suffix-note',{numerator:1,denominator:2},{numerator:1,denominator:2},'F')];
  const score=createScoreDocumentV3(raw);
  assert.throws(
    ()=>admissionFor(score),
    error=>error instanceof TeacherInsertAdmissionV4Error&&error.code==='TRAILING_REST_MISSING'
  );
});
