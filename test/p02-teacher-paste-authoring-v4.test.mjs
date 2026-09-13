import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4, emptyNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createNewScoreEditorAppDocument } from '../dist/packages/score-editor-app-document/src/index.js';
import { createTeacherEventSpanSelectionV4 } from '../dist/packages/editor-teacher-event-span-v4/src/index.js';
import { createTeacherCopySnapshotV4 } from '../dist/packages/editor-teacher-copy-snapshot-v4/src/index.js';
import { analyzeTeacherPasteDestinationV4 } from '../dist/packages/editor-teacher-paste-admission-v4/src/index.js';
import { planTeacherPasteIdentitiesV4 } from '../dist/packages/editor-teacher-paste-identity-plan-v4/src/index.js';
import {
  EDITOR_TEACHER_PASTE_AUTHORING_V4_VERSION,
  TeacherPasteAuthoringV4Error,
  executeTeacherPasteOverwriteV4
} from '../dist/packages/editor-teacher-paste-authoring-v4/src/index.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const pitch=(step='C',alter=0,octave=4)=>({step,alter,octave});
const note=(id,noteId,onset,duration,step='C')=>({id,kind:'note',onset,duration,note:{id:noteId,pitch:pitch(step)}});
const rest=(id,onset,duration)=>({id,kind:'rest',onset,duration});
const eventNotation=(overrides={})=>({dots:0,beams:[],tuplet:null,articulations:[],ornaments:[],...overrides});
const noteNotation=(overrides={})=>({accidental:null,ties:[],slurs:[],...overrides});

const scoreForPaste=(destinationDuration={numerator:3,denominator:4})=>{
  const app=createNewScoreEditorAppDocument({preset:'GUITAR_TREBLE'});
  const raw=structuredClone(app.session.history.present.score);
  const staff=raw.parts[0].staves.find(candidate=>candidate.role==='standard');
  staff.measures[0].voices[0].events=[
    note('author-src-a','author-src-na',{numerator:0,denominator:1},{numerator:1,denominator:8},'C'),
    note('author-src-b','author-src-nb',{numerator:1,denominator:8},{numerator:1,denominator:8},'D'),
    rest('author-destination',{numerator:1,denominator:4},destinationDuration)
  ];
  return createScoreDocumentV3(raw);
};

const notationForPaste=score=>{
  const empty=emptyNotationDocumentV4(score);
  return createNotationDocumentV4(score,{
    ...empty,
    events:[
      {
        target:addressEntityV3(score,'author-src-a'),
        notation:eventNotation({articulations:[{kind:'staccato',placement:'auto',direction:null}]})
      },
      {
        target:addressEntityV3(score,'author-destination'),
        notation:eventNotation()
      }
    ],
    notes:[
      {
        target:addressEntityV3(score,'author-src-na'),
        notation:noteNotation({accidental:'natural'})
      }
    ]
  });
};

const context=(score,notation,nextRevisionId)=>{
  const selection=createTeacherEventSpanSelectionV4(
    score,
    addressEntityV3(score,'author-src-a'),
    addressEntityV3(score,'author-src-b')
  );
  const snapshot=createTeacherCopySnapshotV4(score,notation,selection);
  const admission=analyzeTeacherPasteDestinationV4(
    score,
    notation,
    snapshot,
    addressEntityV3(score,'author-destination')
  );
  const identityPlan=planTeacherPasteIdentitiesV4(score,notation,snapshot,admission,nextRevisionId);
  return {snapshot,admission,identityPlan};
};

test('P02-PASTE02 atomically inserts copied events into admitted rest prefix and keeps residual rest identity',()=>{
  const score=scoreForPaste();
  const notation=notationForPaste(score);
  const {snapshot,admission,identityPlan}=context(score,notation,'rev:author-paste-next');
  const beforeScore=structuredClone(score);
  const beforeNotation=structuredClone(notation);
  const beforeSnapshot=structuredClone(snapshot);
  const beforeAdmission=structuredClone(admission);
  const beforeIdentityPlan=structuredClone(identityPlan);

  const result=executeTeacherPasteOverwriteV4(score,notation,snapshot,admission,identityPlan);
  assert.equal(result.version,EDITOR_TEACHER_PASTE_AUTHORING_V4_VERSION);
  assert.equal(result.historyMutationAuthority,false);
  assert.equal(result.score.revision.id,'rev:author-paste-next');
  assert.equal(result.score.revision.parentId,score.revision.id);
  assert.equal(result.restPlan.kind,'SHRINK_DESTINATION_REST_FORWARD');
  assert.equal(result.selection.eventId,identityPlan.events[0].destinationEventId);
  assert.equal(result.selection.revisionId,'rev:author-paste-next');

  const staff=result.score.parts[0].staves.find(candidate=>candidate.role==='standard');
  const events=staff.measures[0].voices[0].events;
  assert.deepEqual(events.map(event=>event.id),[
    'author-src-a',
    'author-src-b',
    identityPlan.events[0].destinationEventId,
    identityPlan.events[1].destinationEventId,
    'author-destination'
  ]);
  assert.deepEqual(events[2].onset,{numerator:1,denominator:4});
  assert.deepEqual(events[3].onset,{numerator:3,denominator:8});
  assert.deepEqual(events[4],{
    id:'author-destination',
    kind:'rest',
    onset:{numerator:1,denominator:2},
    duration:{numerator:1,denominator:2}
  });
  assert.equal(events[2].kind,'note');
  assert.equal(events[2].note.id,identityPlan.events[0].notes[0].destinationNoteId);
  assert.deepEqual(events[2].note.pitch,pitch('C'));

  const copiedEventNotation=result.notation.events.find(entry=>entry.target.eventId===identityPlan.events[0].destinationEventId);
  assert.equal(copiedEventNotation.notation.articulations[0].kind,'staccato');
  const copiedNoteNotation=result.notation.notes.find(entry=>entry.target.noteId===identityPlan.events[0].notes[0].destinationNoteId);
  assert.equal(copiedNoteNotation.notation.accidental,'natural');
  const residualRestNotation=result.notation.events.find(entry=>entry.target.eventId==='author-destination');
  assert.ok(residualRestNotation);
  assert.equal(residualRestNotation.target.revisionId,'rev:author-paste-next');

  assert.deepEqual(score,beforeScore);
  assert.deepEqual(notation,beforeNotation);
  assert.deepEqual(snapshot,beforeSnapshot);
  assert.deepEqual(admission,beforeAdmission);
  assert.deepEqual(identityPlan,beforeIdentityPlan);
});

test('P02-PASTE02 removes exactly consumed destination rest and its neutral notation entry',()=>{
  const score=scoreForPaste({numerator:1,denominator:4});
  const notation=notationForPaste(score);
  const {snapshot,admission,identityPlan}=context(score,notation,'rev:author-paste-exact');
  const result=executeTeacherPasteOverwriteV4(score,notation,snapshot,admission,identityPlan);
  const staff=result.score.parts[0].staves.find(candidate=>candidate.role==='standard');
  const events=staff.measures[0].voices[0].events;
  assert.deepEqual(events.map(event=>event.id),[
    'author-src-a',
    'author-src-b',
    identityPlan.events[0].destinationEventId,
    identityPlan.events[1].destinationEventId
  ]);
  assert.equal(result.restPlan.kind,'REMOVE_DESTINATION_REST');
  assert.equal(result.notation.events.some(entry=>entry.target.eventId==='author-destination'),false);
});

test('P02-PASTE02 rejects a tampered identity plan before producing a canonical candidate',()=>{
  const score=scoreForPaste();
  const notation=notationForPaste(score);
  const {snapshot,admission,identityPlan}=context(score,notation,'rev:author-paste-tamper');
  const tampered=structuredClone(identityPlan);
  tampered.events[0].destinationEventId='paste-event:ffffffffffffffff';
  const before=structuredClone(score);
  assert.throws(
    ()=>executeTeacherPasteOverwriteV4(score,notation,snapshot,admission,tampered),
    error=>error instanceof TeacherPasteAuthoringV4Error&&error.code==='IDENTITY_PLAN_STALE_OR_INVALID'
  );
  assert.deepEqual(score,before);
});

test('P02-PASTE02 rejects a tampered admission before producing a canonical candidate',()=>{
  const score=scoreForPaste();
  const notation=notationForPaste(score);
  const {snapshot,admission,identityPlan}=context(score,notation,'rev:author-paste-admission-tamper');
  const tampered=structuredClone(admission);
  tampered.pasteEnd={numerator:7,denominator:8};
  assert.throws(
    ()=>executeTeacherPasteOverwriteV4(score,notation,snapshot,tampered,identityPlan),
    error=>error instanceof TeacherPasteAuthoringV4Error&&error.code==='ADMISSION_STALE_OR_INVALID'
  );
});
