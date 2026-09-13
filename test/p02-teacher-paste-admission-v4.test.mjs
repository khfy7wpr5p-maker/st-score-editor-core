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
  EDITOR_TEACHER_PASTE_ADMISSION_V4_VERSION,
  TeacherPasteAdmissionV4Error,
  analyzeTeacherPasteDestinationV4
} from '../dist/packages/editor-teacher-paste-admission-v4/src/index.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const pitch=(step='C',alter=0,octave=4)=>({step,alter,octave});
const note=(id,noteId,onset,duration,step='C')=>({id,kind:'note',onset,duration,note:{id:noteId,pitch:pitch(step)}});
const rest=(id,onset,duration)=>({id,kind:'rest',onset,duration});
const eventNotation=(overrides={})=>({dots:0,beams:[],tuplet:null,articulations:[],ornaments:[],...overrides});

const baseRaw=()=>{
  const app=createNewScoreEditorAppDocument({preset:'GUITAR_TREBLE'});
  return structuredClone(app.session.history.present.score);
};

const scoreWithDestination=(destinationDuration={numerator:3,denominator:4})=>{
  const raw=baseRaw();
  const staff=raw.parts[0].staves.find(candidate=>candidate.role==='standard');
  staff.measures[0].voices[0].events=[
    note('paste-src-a','paste-src-na',{numerator:0,denominator:1},{numerator:1,denominator:8},'C'),
    note('paste-src-b','paste-src-nb',{numerator:1,denominator:8},{numerator:1,denominator:8},'D'),
    rest('paste-destination',{numerator:1,denominator:4},destinationDuration)
  ];
  return createScoreDocumentV3(raw);
};

const copySnapshot=score=>{
  const notation=emptyNotationDocumentV4(score);
  const selection=createTeacherEventSpanSelectionV4(
    score,
    addressEntityV3(score,'paste-src-a'),
    addressEntityV3(score,'paste-src-b')
  );
  return createTeacherCopySnapshotV4(score,notation,selection);
};

test('P02-PASTE01 admits overwrite into a larger exact neutral destination rest and plans residual shrink only',()=>{
  const score=scoreWithDestination();
  const notation=emptyNotationDocumentV4(score);
  const snapshot=copySnapshot(score);
  const beforeScore=structuredClone(score);
  const beforeNotation=structuredClone(notation);
  const beforeSnapshot=structuredClone(snapshot);
  const destination=addressEntityV3(score,'paste-destination');
  const admission=analyzeTeacherPasteDestinationV4(score,notation,snapshot,destination);

  assert.equal(admission.version,EDITOR_TEACHER_PASTE_ADMISSION_V4_VERSION);
  assert.equal(admission.kind,'TEACHER_PASTE_ADMISSION');
  assert.equal(admission.admitted,true);
  assert.equal(admission.mode,'OVERWRITE_EXPLICIT_NEUTRAL_REST_PREFIX');
  assert.deepEqual(admission.pasteStart,{numerator:1,denominator:4});
  assert.deepEqual(admission.pasteExtent,{numerator:1,denominator:4});
  assert.deepEqual(admission.pasteEnd,{numerator:1,denominator:2});
  assert.equal(admission.restPlan.kind,'SHRINK_DESTINATION_REST_FORWARD');
  assert.deepEqual(admission.restPlan.residualOnset,{numerator:1,denominator:2});
  assert.deepEqual(admission.restPlan.residualDuration,{numerator:1,denominator:2});
  assert.equal(admission.identityAllocationRequired,true);
  assert.equal(admission.identityAllocationPerformed,false);
  assert.equal(admission.relationRemappingRequired,false);
  assert.equal(admission.canonicalMutationAuthority,false);
  assert.equal(admission.historyMutationAuthority,false);
  assert.deepEqual(score,beforeScore);
  assert.deepEqual(notation,beforeNotation);
  assert.deepEqual(snapshot,beforeSnapshot);
});

test('P02-PASTE01 admits exact destination-rest consumption without allocating identities',()=>{
  const score=scoreWithDestination({numerator:1,denominator:4});
  const notation=emptyNotationDocumentV4(score);
  const snapshot=copySnapshot(score);
  const admission=analyzeTeacherPasteDestinationV4(
    score,
    notation,
    snapshot,
    addressEntityV3(score,'paste-destination')
  );
  assert.equal(admission.restPlan.kind,'REMOVE_DESTINATION_REST');
  assert.equal(admission.restPlan.residualOnset,null);
  assert.equal(admission.restPlan.residualDuration,null);
});

test('P02-PASTE01 rejects insufficient destination rest space fail closed',()=>{
  const score=scoreWithDestination({numerator:1,denominator:8});
  const notation=emptyNotationDocumentV4(score);
  const snapshot=copySnapshot(score);
  assert.throws(
    ()=>analyzeTeacherPasteDestinationV4(score,notation,snapshot,addressEntityV3(score,'paste-destination')),
    error=>error instanceof TeacherPasteAdmissionV4Error&&error.code==='DESTINATION_SPACE_INSUFFICIENT'
  );
});

test('P02-PASTE01 rejects a destination event that belongs to the source snapshot',()=>{
  const score=scoreWithDestination();
  const notation=emptyNotationDocumentV4(score);
  const snapshot=copySnapshot(score);
  assert.throws(
    ()=>analyzeTeacherPasteDestinationV4(score,notation,snapshot,addressEntityV3(score,'paste-src-a')),
    error=>error instanceof TeacherPasteAdmissionV4Error&&error.code==='DESTINATION_IN_SOURCE_SNAPSHOT'
  );
});

test('P02-PASTE01 separately rejects a pitched destination outside the source snapshot',()=>{
  const raw=baseRaw();
  const staff=raw.parts[0].staves.find(candidate=>candidate.role==='standard');
  staff.measures[0].voices[0].events=[
    note('paste-src-a','paste-src-na',{numerator:0,denominator:1},{numerator:1,denominator:8},'C'),
    note('paste-src-b','paste-src-nb',{numerator:1,denominator:8},{numerator:1,denominator:8},'D'),
    note('paste-pitched-destination','paste-pitched-note',{numerator:1,denominator:4},{numerator:3,denominator:4},'E')
  ];
  const score=createScoreDocumentV3(raw);
  const notation=emptyNotationDocumentV4(score);
  const snapshot=copySnapshot(score);
  assert.throws(
    ()=>analyzeTeacherPasteDestinationV4(score,notation,snapshot,addressEntityV3(score,'paste-pitched-destination')),
    error=>error instanceof TeacherPasteAdmissionV4Error&&error.code==='DESTINATION_NOT_REST'
  );
});

test('P02-PASTE01 rejects a notation-coupled destination rest',()=>{
  const score=scoreWithDestination();
  const empty=emptyNotationDocumentV4(score);
  const notation=createNotationDocumentV4(score,{
    ...empty,
    events:[{target:addressEntityV3(score,'paste-destination'),notation:eventNotation({dots:1})}]
  });
  const snapshot=copySnapshot(score);
  assert.throws(
    ()=>analyzeTeacherPasteDestinationV4(score,notation,snapshot,addressEntityV3(score,'paste-destination')),
    error=>error instanceof TeacherPasteAdmissionV4Error&&error.code==='DESTINATION_NOT_NEUTRAL'
  );
});

test('P02-PASTE01 rejects a snapshot after the destination document revision changes',()=>{
  const score=scoreWithDestination();
  const snapshot=copySnapshot(score);
  const raw=structuredClone(score);
  raw.revision={id:'rev:paste-newer',parentId:score.revision.id};
  const newer=createScoreDocumentV3(raw);
  const notation=emptyNotationDocumentV4(newer);
  assert.throws(
    ()=>analyzeTeacherPasteDestinationV4(newer,notation,snapshot,addressEntityV3(newer,'paste-destination')),
    error=>error instanceof TeacherPasteAdmissionV4Error&&error.code==='SNAPSHOT_STALE_FOR_DESTINATION'
  );
});

test('P02-PASTE01 explicitly blocks cross-measure snapshots in its first profile',()=>{
  const score=scoreWithDestination();
  const notation=emptyNotationDocumentV4(score);
  const original=copySnapshot(score);
  const snapshot=structuredClone(original);
  snapshot.crossesMeasureBoundary=true;
  snapshot.segments.push({...structuredClone(snapshot.segments[0]),frameOffset:1});
  assert.throws(
    ()=>analyzeTeacherPasteDestinationV4(score,notation,snapshot,addressEntityV3(score,'paste-destination')),
    error=>error instanceof TeacherPasteAdmissionV4Error&&error.code==='CROSS_MEASURE_SNAPSHOT_UNSUPPORTED'
  );
});

test('P02-PASTE01 rejects hidden source timing gaps instead of creating implicit destination gaps',()=>{
  const score=scoreWithDestination();
  const notation=emptyNotationDocumentV4(score);
  const snapshot=structuredClone(copySnapshot(score));
  snapshot.segments[0].events[1].onsetFromSegmentOrigin={numerator:3,denominator:16};
  assert.throws(
    ()=>analyzeTeacherPasteDestinationV4(score,notation,snapshot,addressEntityV3(score,'paste-destination')),
    error=>error instanceof TeacherPasteAdmissionV4Error&&error.code==='SOURCE_GAPS_UNSUPPORTED'
  );
});

test('P02-PASTE01 rejects overwriting a source rest with the snapshot that contains it',()=>{
  const score=scoreWithDestination();
  const notation=emptyNotationDocumentV4(score);
  const selection=createTeacherEventSpanSelectionV4(
    score,
    addressEntityV3(score,'paste-src-a'),
    addressEntityV3(score,'paste-destination')
  );
  const snapshot=createTeacherCopySnapshotV4(score,notation,selection);
  assert.throws(
    ()=>analyzeTeacherPasteDestinationV4(score,notation,snapshot,addressEntityV3(score,'paste-destination')),
    error=>error instanceof TeacherPasteAdmissionV4Error&&error.code==='DESTINATION_IN_SOURCE_SNAPSHOT'
  );
});
