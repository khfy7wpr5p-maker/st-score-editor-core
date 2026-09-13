import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4, emptyNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createNewScoreEditorAppDocument } from '../dist/packages/score-editor-app-document/src/index.js';
import { createTeacherEventSpanSelectionV4 } from '../dist/packages/editor-teacher-event-span-v4/src/index.js';
import { analyzeTeacherOctaveTransposeV4 } from '../dist/packages/editor-teacher-octave-transpose-admission-v4/src/index.js';
import {
  EDITOR_TEACHER_OCTAVE_TRANSPOSE_AUTHORING_V4_VERSION,
  TeacherOctaveTransposeAuthoringV4Error,
  executeTeacherOctaveTransposeV4
} from '../dist/packages/editor-teacher-octave-transpose-authoring-v4/src/index.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const pitch=(step='C',alter=0,octave=4)=>({step,alter,octave});
const note=(id,noteId,onset,duration,p=pitch())=>({id,kind:'note',onset,duration,note:{id:noteId,pitch:p}});
const chord=(id,noteDefs,onset,duration)=>({id,kind:'chord',onset,duration,notes:noteDefs.map(([noteId,p])=>({id:noteId,pitch:p}))});
const rest=(id,onset,duration)=>({id,kind:'rest',onset,duration});
const eventNotation=(overrides={})=>({dots:0,beams:[],tuplet:null,articulations:[],ornaments:[],...overrides});
const noteNotation=(overrides={})=>({accidental:null,ties:[],slurs:[],...overrides});

const scoreForTranspose=()=>{
  const app=createNewScoreEditorAppDocument({preset:'GUITAR_TREBLE'});
  const raw=structuredClone(app.session.history.present.score);
  const staff=raw.parts[0].staves.find(candidate=>candidate.role==='standard');
  staff.measures[0].voices[0].events=[
    note('transpose2-a','transpose2-na',{numerator:0,denominator:1},{numerator:1,denominator:4},pitch('C',1,4)),
    chord('transpose2-b',[
      ['transpose2-nb1',pitch('E',-1,4)],
      ['transpose2-nb2',pitch('G',0,5)]
    ],{numerator:1,denominator:4},{numerator:1,denominator:4}),
    rest('transpose2-rest',{numerator:1,denominator:2},{numerator:1,denominator:2})
  ];
  return createScoreDocumentV3(raw);
};

const notationFor=score=>{
  const empty=emptyNotationDocumentV4(score);
  return createNotationDocumentV4(score,{
    ...empty,
    events:[{
      target:addressEntityV3(score,'transpose2-a'),
      notation:eventNotation({articulations:[{kind:'staccato',placement:'auto',direction:null}]})
    }],
    notes:[{
      target:addressEntityV3(score,'transpose2-na'),
      notation:noteNotation({accidental:'sharp'})
    }]
  });
};

const facts=(score,notation)=>{
  const selection=createTeacherEventSpanSelectionV4(
    score,
    addressEntityV3(score,'transpose2-a'),
    addressEntityV3(score,'transpose2-rest')
  );
  const admission=analyzeTeacherOctaveTransposeV4(score,notation,selection,1);
  return {selection,admission};
};

test('P02-TRANSPOSE02 applies all admitted note/chord octave changes in one canonical revision',()=>{
  const score=scoreForTranspose();
  const notation=notationFor(score);
  const {selection,admission}=facts(score,notation);
  const beforeScore=structuredClone(score);
  const beforeNotation=structuredClone(notation);
  const beforeSelection=structuredClone(selection);
  const beforeAdmission=structuredClone(admission);

  const result=executeTeacherOctaveTransposeV4(
    score,notation,selection,admission,{nextRevisionId:'rev:transpose2-next'}
  );

  assert.equal(result.version,EDITOR_TEACHER_OCTAVE_TRANSPOSE_AUTHORING_V4_VERSION);
  assert.equal(result.historyMutationAuthority,false);
  assert.equal(result.score.revision.id,'rev:transpose2-next');
  assert.equal(result.score.revision.parentId,score.revision.id);
  assert.deepEqual(result.changedEventIds,['transpose2-a','transpose2-b']);
  assert.deepEqual(result.changedNoteIds,['transpose2-na','transpose2-nb1','transpose2-nb2']);
  assert.equal(result.selection.kind,'event');
  assert.equal(result.selection.eventId,'transpose2-a');
  assert.equal(result.selection.revisionId,'rev:transpose2-next');

  const staff=result.score.parts[0].staves.find(candidate=>candidate.role==='standard');
  const events=staff.measures[0].voices[0].events;
  assert.deepEqual(events[0].note.pitch,pitch('C',1,5));
  assert.deepEqual(events[1].notes.map(item=>item.pitch),[pitch('E',-1,5),pitch('G',0,6)]);
  assert.deepEqual(events[2],beforeScore.parts[0].staves.find(candidate=>candidate.role==='standard').measures[0].voices[0].events[2]);

  const eventNotationAfter=result.notation.events.find(entry=>entry.target.eventId==='transpose2-a');
  assert.equal(eventNotationAfter.target.revisionId,'rev:transpose2-next');
  assert.equal(eventNotationAfter.notation.articulations[0].kind,'staccato');
  const noteNotationAfter=result.notation.notes.find(entry=>entry.target.noteId==='transpose2-na');
  assert.equal(noteNotationAfter.target.revisionId,'rev:transpose2-next');
  assert.equal(noteNotationAfter.notation.accidental,'sharp');

  assert.deepEqual(score,beforeScore);
  assert.deepEqual(notation,beforeNotation);
  assert.deepEqual(selection,beforeSelection);
  assert.deepEqual(admission,beforeAdmission);
});

test('P02-TRANSPOSE02 rejects a tampered admission before producing a candidate',()=>{
  const score=scoreForTranspose();
  const notation=notationFor(score);
  const {selection,admission}=facts(score,notation);
  const tampered=structuredClone(admission);
  tampered.targetNotePlans[0].targetPitch.octave=8;
  const before=structuredClone(score);
  assert.throws(
    ()=>executeTeacherOctaveTransposeV4(score,notation,selection,tampered,{nextRevisionId:'rev:transpose2-tamper'}),
    error=>error instanceof TeacherOctaveTransposeAuthoringV4Error&&error.code==='ADMISSION_STALE_OR_INVALID'
  );
  assert.deepEqual(score,before);
});

test('P02-TRANSPOSE02 rejects current or immediate-parent revision identity reuse',()=>{
  const score=scoreForTranspose();
  const notation=notationFor(score);
  const {selection,admission}=facts(score,notation);
  for(const nextRevisionId of [score.revision.id]){
    assert.throws(
      ()=>executeTeacherOctaveTransposeV4(score,notation,selection,admission,{nextRevisionId}),
      error=>error instanceof TeacherOctaveTransposeAuthoringV4Error&&error.code==='INVALID_REVISION_ID'
    );
  }

  const raw=structuredClone(score);
  raw.revision={id:'rev:transpose2-current',parentId:'rev:transpose2-parent'};
  const child=createScoreDocumentV3(raw);
  const childNotation=emptyNotationDocumentV4(child);
  const childSelection=createTeacherEventSpanSelectionV4(
    child,
    addressEntityV3(child,'transpose2-a'),
    addressEntityV3(child,'transpose2-rest')
  );
  const childAdmission=analyzeTeacherOctaveTransposeV4(child,childNotation,childSelection,1);
  assert.throws(
    ()=>executeTeacherOctaveTransposeV4(child,childNotation,childSelection,childAdmission,{nextRevisionId:'rev:transpose2-parent'}),
    error=>error instanceof TeacherOctaveTransposeAuthoringV4Error&&error.code==='INVALID_REVISION_ID'
  );
});
