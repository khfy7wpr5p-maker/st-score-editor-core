import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { emptyNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createNewScoreEditorAppDocument } from '../dist/packages/score-editor-app-document/src/index.js';
import { createTeacherEventSpanSelectionV4 } from '../dist/packages/editor-teacher-event-span-v4/src/index.js';
import { createTeacherCopySnapshotV4 } from '../dist/packages/editor-teacher-copy-snapshot-v4/src/index.js';
import { analyzeTeacherPasteDestinationV4 } from '../dist/packages/editor-teacher-paste-admission-v4/src/index.js';
import {
  EDITOR_TEACHER_PASTE_IDENTITY_PLAN_V4_VERSION,
  TeacherPasteIdentityPlanV4Error,
  planTeacherPasteIdentitiesV4
} from '../dist/packages/editor-teacher-paste-identity-plan-v4/src/index.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const pitch=(step='C',alter=0,octave=4)=>({step,alter,octave});
const note=(id,noteId,onset,duration,step='C')=>({id,kind:'note',onset,duration,note:{id:noteId,pitch:pitch(step)}});
const rest=(id,onset,duration)=>({id,kind:'rest',onset,duration});

const baseRaw=()=>{
  const app=createNewScoreEditorAppDocument({preset:'GUITAR_TREBLE'});
  const raw=structuredClone(app.session.history.present.score);
  const staff=raw.parts[0].staves.find(candidate=>candidate.role==='standard');
  staff.measures[0].voices[0].events=[
    note('id-src-a','id-src-na',{numerator:0,denominator:1},{numerator:1,denominator:8},'C'),
    note('id-src-b','id-src-nb',{numerator:1,denominator:8},{numerator:1,denominator:8},'D'),
    rest('id-destination',{numerator:1,denominator:4},{numerator:3,denominator:4})
  ];
  return raw;
};

const context=score=>{
  const notation=emptyNotationDocumentV4(score);
  const selection=createTeacherEventSpanSelectionV4(
    score,
    addressEntityV3(score,'id-src-a'),
    addressEntityV3(score,'id-src-b')
  );
  const snapshot=createTeacherCopySnapshotV4(score,notation,selection);
  const admission=analyzeTeacherPasteDestinationV4(
    score,
    notation,
    snapshot,
    addressEntityV3(score,'id-destination')
  );
  return {notation,snapshot,admission};
};

const fnv1a64=value=>{
  let hash=14695981039346656037n;
  const mask=(1n<<64n)-1n;
  for(let i=0;i<value.length;i+=1){hash^=BigInt(value.charCodeAt(i));hash=(hash*1099511628211n)&mask;}
  return hash.toString(16).padStart(16,'0');
};

test('P02-ID01 deterministically plans fresh event/note identities without mutating canonical state',()=>{
  const score=createScoreDocumentV3(baseRaw());
  const {notation,snapshot,admission}=context(score);
  const beforeScore=structuredClone(score);
  const beforeNotation=structuredClone(notation);
  const beforeSnapshot=structuredClone(snapshot);
  const beforeAdmission=structuredClone(admission);
  const first=planTeacherPasteIdentitiesV4(score,notation,snapshot,admission,'rev:paste-id-next');
  const second=planTeacherPasteIdentitiesV4(score,notation,snapshot,admission,'rev:paste-id-next');

  assert.equal(first.version,EDITOR_TEACHER_PASTE_IDENTITY_PLAN_V4_VERSION);
  assert.equal(first.kind,'TEACHER_PASTE_IDENTITY_PLAN');
  assert.equal(first.eventIdentityCount,2);
  assert.equal(first.noteIdentityCount,2);
  assert.equal(first.relationIdentityCount,0);
  assert.equal(first.identityAllocationPerformed,false);
  assert.equal(first.canonicalMutationAuthority,false);
  assert.equal(first.historyMutationAuthority,false);
  assert.deepEqual(first,second);
  assert.equal(new Set(first.events.map(item=>item.destinationEventId)).size,2);
  assert.equal(new Set(first.events.flatMap(item=>item.notes.map(note=>note.destinationNoteId))).size,2);
  assert.ok(first.events.every(item=>item.destinationEventId.startsWith('paste-event:')));
  assert.ok(first.events.flatMap(item=>item.notes).every(item=>item.destinationNoteId.startsWith('paste-note:')));
  assert.deepEqual(score,beforeScore);
  assert.deepEqual(notation,beforeNotation);
  assert.deepEqual(snapshot,beforeSnapshot);
  assert.deepEqual(admission,beforeAdmission);
});

test('P02-ID01 changes deterministic destination identities when next revision changes',()=>{
  const score=createScoreDocumentV3(baseRaw());
  const {notation,snapshot,admission}=context(score);
  const first=planTeacherPasteIdentitiesV4(score,notation,snapshot,admission,'rev:paste-id-a');
  const second=planTeacherPasteIdentitiesV4(score,notation,snapshot,admission,'rev:paste-id-b');
  assert.notDeepEqual(first.events.map(item=>item.destinationEventId),second.events.map(item=>item.destinationEventId));
  assert.notDeepEqual(
    first.events.flatMap(item=>item.notes.map(note=>note.destinationNoteId)),
    second.events.flatMap(item=>item.notes.map(note=>note.destinationNoteId))
  );
});

test('P02-ID01 rejects current and immediate-parent revision identity reuse',()=>{
  const initial=createScoreDocumentV3(baseRaw());
  const raw=structuredClone(initial);
  raw.revision={id:'rev:id-current',parentId:'rev:id-parent'};
  const score=createScoreDocumentV3(raw);
  const {notation,snapshot,admission}=context(score);
  for(const reused of ['rev:id-current','rev:id-parent']){
    assert.throws(
      ()=>planTeacherPasteIdentitiesV4(score,notation,snapshot,admission,reused),
      error=>error instanceof TeacherPasteIdentityPlanV4Error&&error.code==='INVALID_REVISION_ID'
    );
  }
});

test('P02-ID01 rejects tampered admission facts',()=>{
  const score=createScoreDocumentV3(baseRaw());
  const {notation,snapshot,admission}=context(score);
  const tampered=structuredClone(admission);
  tampered.pasteEnd={numerator:7,denominator:8};
  assert.throws(
    ()=>planTeacherPasteIdentitiesV4(score,notation,snapshot,tampered,'rev:paste-id-tamper'),
    error=>error instanceof TeacherPasteIdentityPlanV4Error&&error.code==='ADMISSION_STALE_OR_INVALID'
  );
});

test('P02-ID01 detects deterministic event-id collision against current canonical identities',()=>{
  const raw=baseRaw();
  const nextRevisionId='rev:paste-id-collision';
  const expected=`paste-event:${fnv1a64(`${raw.id}|${raw.revision.id}|id-destination|${nextRevisionId}|event|0|id-src-a`)}`;
  const staff=raw.parts[0].staves.find(candidate=>candidate.role==='standard');
  staff.measures[0].voices[0].events=[
    note('id-src-a','id-src-na',{numerator:0,denominator:1},{numerator:1,denominator:8},'C'),
    note('id-src-b','id-src-nb',{numerator:1,denominator:8},{numerator:1,denominator:8},'D'),
    rest('id-destination',{numerator:1,denominator:4},{numerator:1,denominator:4}),
    rest(expected,{numerator:1,denominator:2},{numerator:1,denominator:2})
  ];
  const score=createScoreDocumentV3(raw);
  const {notation,snapshot,admission}=context(score);
  assert.throws(
    ()=>planTeacherPasteIdentitiesV4(score,notation,snapshot,admission,nextRevisionId),
    error=>error instanceof TeacherPasteIdentityPlanV4Error&&error.code==='ID_COLLISION'
  );
});
