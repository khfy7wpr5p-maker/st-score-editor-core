import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4, emptyNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createNewScoreEditorAppDocument } from '../dist/packages/score-editor-app-document/src/index.js';
import { createTeacherEventSpanSelectionV4 } from '../dist/packages/editor-teacher-event-span-v4/src/index.js';
import { createTeacherCopySnapshotV4 } from '../dist/packages/editor-teacher-copy-snapshot-v4/src/index.js';
import { analyzeTeacherInsertAfterEventV4 } from '../dist/packages/editor-teacher-insert-admission-v4/src/index.js';
import {
  EDITOR_TEACHER_INSERT_AUTHORING_V4_VERSION,
  TeacherInsertAuthoringV4Error,
  executeTeacherInsertAfterEventV4
} from '../dist/packages/editor-teacher-insert-authoring-v4/src/index.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const pitch=(step='C',alter=0,octave=4)=>({step,alter,octave});
const note=(id,noteId,onset,duration,step='C')=>({id,kind:'note',onset,duration,note:{id:noteId,pitch:pitch(step)}});
const rest=(id,onset,duration)=>({id,kind:'rest',onset,duration});
const eventNotation=(overrides={})=>({dots:0,beams:[],tuplet:null,articulations:[],ornaments:[],...overrides});
const noteNotation=(overrides={})=>({accidental:null,ties:[],slurs:[],...overrides});

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

const snapshotFor=(score,notation=emptyNotationDocumentV4(score))=>{
  const selection=createTeacherEventSpanSelectionV4(
    score,
    addressEntityV3(score,'insert-src-a'),
    addressEntityV3(score,'insert-src-b')
  );
  return createTeacherCopySnapshotV4(score,notation,selection);
};

const prepared=(score,notation=emptyNotationDocumentV4(score))=>{
  const snapshot=snapshotFor(score,notation);
  const admission=analyzeTeacherInsertAfterEventV4(score,notation,snapshot,addressEntityV3(score,'insert-anchor'));
  return {snapshot,admission};
};

const voiceOf=score=>score.parts[0].staves.find(candidate=>candidate.role==='standard').measures[0].voices[0];

test('P02-INSERT02 atomically inserts copied events, shifts suffix and removes exactly consumed trailing rest',()=>{
  const score=scoreRemoveCapacity();
  const notation=emptyNotationDocumentV4(score);
  const {snapshot,admission}=prepared(score,notation);
  const beforeScore=structuredClone(score);
  const beforeNotation=structuredClone(notation);
  const beforeSnapshot=structuredClone(snapshot);
  const beforeAdmission=structuredClone(admission);

  const result=executeTeacherInsertAfterEventV4(score,notation,snapshot,admission,'rev:insert-02-a');
  const voice=voiceOf(result.score);

  assert.equal(result.version,EDITOR_TEACHER_INSERT_AUTHORING_V4_VERSION);
  assert.equal(result.score.revision.id,'rev:insert-02-a');
  assert.equal(result.score.revision.parentId,score.revision.id);
  assert.equal(result.insertedEventIds.length,2);
  assert.equal(result.insertedNoteIds.length,2);
  assert.equal(result.historyMutationAuthority,false);
  assert.equal(result.identityPlan.canonicalMutationAuthority,false);
  assert.equal(result.identityPlan.historyMutationAuthority,false);
  assert.deepEqual(voice.events.map(event=>event.id),[
    'insert-src-a','insert-src-b','insert-anchor',
    result.insertedEventIds[0],result.insertedEventIds[1],
    'insert-suffix'
  ]);
  assert.deepEqual(voice.events.map(event=>event.onset),[
    {numerator:0,denominator:1},
    {numerator:1,denominator:8},
    {numerator:1,denominator:4},
    {numerator:1,denominator:2},
    {numerator:5,denominator:8},
    {numerator:3,denominator:4}
  ]);
  assert.equal(voice.events.some(event=>event.id==='insert-tail'),false);
  assert.equal(result.selection.kind,'event');
  assert.equal(result.selection.eventId,result.insertedEventIds[0]);
  assert.deepEqual(score,beforeScore);
  assert.deepEqual(notation,beforeNotation);
  assert.deepEqual(snapshot,beforeSnapshot);
  assert.deepEqual(admission,beforeAdmission);
});

test('P02-INSERT02 shrinks trailing rest forward when capacity exceeds inserted extent',()=>{
  const score=scoreShrinkCapacity();
  const notation=emptyNotationDocumentV4(score);
  const {snapshot,admission}=prepared(score,notation);
  const result=executeTeacherInsertAfterEventV4(score,notation,snapshot,admission,'rev:insert-02-b');
  const voice=voiceOf(result.score);
  const tail=voice.events.find(event=>event.id==='insert-tail');
  assert.ok(tail);
  assert.equal(tail.kind,'rest');
  assert.deepEqual(tail.onset,{numerator:5,denominator:8});
  assert.deepEqual(tail.duration,{numerator:3,denominator:8});
  assert.deepEqual(voice.events.find(event=>event.id==='insert-suffix').onset,{numerator:1,denominator:2});
  assert.deepEqual(voice.events.find(event=>event.id===result.insertedEventIds[0]).onset,{numerator:3,denominator:8});
  assert.deepEqual(voice.events.find(event=>event.id===result.insertedEventIds[1]).onset,{numerator:7,denominator:16});
});

test('P02-INSERT02 preserves unrelated notation and clones admitted local source notation onto new identities',()=>{
  const score=scoreRemoveCapacity();
  const empty=emptyNotationDocumentV4(score);
  const notation=createNotationDocumentV4(score,{
    ...empty,
    events:[
      {target:addressEntityV3(score,'insert-src-b'),notation:eventNotation({articulations:[{kind:'staccato',placement:'auto',direction:null}]})},
      {target:addressEntityV3(score,'insert-suffix'),notation:eventNotation({articulations:[{kind:'accent',placement:'auto',direction:null}]})}
    ],
    notes:[
      {target:addressEntityV3(score,'insert-src-nb'),notation:noteNotation({accidental:'natural'})},
      {target:addressEntityV3(score,'insert-suffix-note'),notation:noteNotation({accidental:'sharp'})}
    ]
  });
  const {snapshot,admission}=prepared(score,notation);
  const result=executeTeacherInsertAfterEventV4(score,notation,snapshot,admission,'rev:insert-02-c');
  const copiedEvent=result.notation.events.find(entry=>entry.target.eventId===result.insertedEventIds[1]);
  const copiedNote=result.notation.notes.find(entry=>entry.target.noteId===result.insertedNoteIds[1]);
  const suffixEvent=result.notation.events.find(entry=>entry.target.eventId==='insert-suffix');
  const suffixNote=result.notation.notes.find(entry=>entry.target.noteId==='insert-suffix-note');
  assert.equal(copiedEvent.notation.articulations[0].kind,'staccato');
  assert.equal(copiedNote.notation.accidental,'natural');
  assert.equal(suffixEvent.notation.articulations[0].kind,'accent');
  assert.equal(suffixNote.notation.accidental,'sharp');
  assert.equal(suffixEvent.target.revisionId,'rev:insert-02-c');
  assert.equal(suffixNote.target.revisionId,'rev:insert-02-c');
});

test('P02-INSERT02 deterministic destination identities are stable for the same canonical inputs and revision id',()=>{
  const score=scoreRemoveCapacity();
  const notation=emptyNotationDocumentV4(score);
  const {snapshot,admission}=prepared(score,notation);
  const first=executeTeacherInsertAfterEventV4(score,notation,snapshot,admission,'rev:insert-02-d');
  const second=executeTeacherInsertAfterEventV4(score,notation,snapshot,admission,'rev:insert-02-d');
  assert.deepEqual(first.identityPlan,second.identityPlan);
  assert.deepEqual(first.insertedEventIds,second.insertedEventIds);
  assert.deepEqual(first.insertedNoteIds,second.insertedNoteIds);
});

test('P02-INSERT02 rejects tampered admission facts before canonical mutation',()=>{
  const score=scoreRemoveCapacity();
  const notation=emptyNotationDocumentV4(score);
  const {snapshot,admission}=prepared(score,notation);
  const tampered=structuredClone(admission);
  tampered.insertExtent={numerator:1,denominator:8};
  assert.throws(
    ()=>executeTeacherInsertAfterEventV4(score,notation,snapshot,tampered,'rev:insert-02-e'),
    error=>error instanceof TeacherInsertAuthoringV4Error&&error.code==='ADMISSION_STALE_OR_INVALID'
  );
  assert.equal(score.revision.id,admission.sourceRevisionId);
});

test('P02-INSERT02 rejects current and immediate-parent revision identity reuse',()=>{
  const score=scoreRemoveCapacity();
  const notation=emptyNotationDocumentV4(score);
  const {snapshot,admission}=prepared(score,notation);
  assert.throws(
    ()=>executeTeacherInsertAfterEventV4(score,notation,snapshot,admission,score.revision.id),
    error=>error instanceof TeacherInsertAuthoringV4Error&&error.code==='INVALID_REVISION_ID'
  );
  const raw=structuredClone(score);
  raw.revision={id:'rev:insert-current',parentId:'rev:insert-parent'};
  const withParent=createScoreDocumentV3(raw);
  const parentNotation=emptyNotationDocumentV4(withParent);
  const parentSnapshot=snapshotFor(withParent,parentNotation);
  const parentAdmission=analyzeTeacherInsertAfterEventV4(withParent,parentNotation,parentSnapshot,addressEntityV3(withParent,'insert-anchor'));
  assert.throws(
    ()=>executeTeacherInsertAfterEventV4(withParent,parentNotation,parentSnapshot,parentAdmission,'rev:insert-parent'),
    error=>error instanceof TeacherInsertAuthoringV4Error&&error.code==='INVALID_REVISION_ID'
  );
});

test('P02-INSERT02 rejects relation-coupled notation smuggled into a tampered snapshot',()=>{
  const score=scoreRemoveCapacity();
  const notation=emptyNotationDocumentV4(score);
  const {snapshot,admission}=prepared(score,notation);
  const tampered=structuredClone(snapshot);
  tampered.segments[0].events[0].notation=eventNotation({beams:[{number:1,value:'begin'}]});
  const tamperedAdmission=analyzeTeacherInsertAfterEventV4(score,notation,tampered,addressEntityV3(score,'insert-anchor'));
  assert.throws(
    ()=>executeTeacherInsertAfterEventV4(score,notation,tampered,tamperedAdmission,'rev:insert-02-f'),
    error=>error instanceof TeacherInsertAuthoringV4Error&&error.code==='SNAPSHOT_CONTENT_INVALID'
  );
});
