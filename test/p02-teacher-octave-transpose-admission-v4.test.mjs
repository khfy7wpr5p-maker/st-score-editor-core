import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4, emptyNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createNewScoreEditorAppDocument } from '../dist/packages/score-editor-app-document/src/index.js';
import { createTeacherEventSpanSelectionV4 } from '../dist/packages/editor-teacher-event-span-v4/src/index.js';
import {
  EDITOR_TEACHER_OCTAVE_TRANSPOSE_ADMISSION_V4_VERSION,
  TeacherOctaveTransposeAdmissionV4Error,
  analyzeTeacherOctaveTransposeV4
} from '../dist/packages/editor-teacher-octave-transpose-admission-v4/src/index.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const pitch=(step='C',alter=0,octave=4)=>({step,alter,octave});
const note=(id,noteId,onset,duration,p=pitch())=>({id,kind:'note',onset,duration,note:{id:noteId,pitch:p}});
const chord=(id,noteDefs,onset,duration)=>({
  id,kind:'chord',onset,duration,
  notes:noteDefs.map(([noteId,p])=>({id:noteId,pitch:p}))
});
const rest=(id,onset,duration)=>({id,kind:'rest',onset,duration});
const noteNotation=(overrides={})=>({accidental:null,ties:[],slurs:[],...overrides});

const scoreForTranspose=()=>{
  const app=createNewScoreEditorAppDocument({preset:'GUITAR_TREBLE'});
  const raw=structuredClone(app.session.history.present.score);
  const staff=raw.parts[0].staves.find(candidate=>candidate.role==='standard');
  staff.measures[0].voices[0].events=[
    note('transpose-a','transpose-na',{numerator:0,denominator:1},{numerator:1,denominator:4},pitch('C',1,4)),
    chord('transpose-b',[
      ['transpose-nb1',pitch('E',-1,4)],
      ['transpose-nb2',pitch('G',0,5)]
    ],{numerator:1,denominator:4},{numerator:1,denominator:4}),
    rest('transpose-rest',{numerator:1,denominator:2},{numerator:1,denominator:2})
  ];
  return createScoreDocumentV3(raw);
};

const selectionFor=score=>createTeacherEventSpanSelectionV4(
  score,
  addressEntityV3(score,'transpose-a'),
  addressEntityV3(score,'transpose-rest')
);

test('P02-TRANSPOSE01 admits octave-only bulk planning across note, chord and rest while preserving spelling',()=>{
  const score=scoreForTranspose();
  const notation=emptyNotationDocumentV4(score);
  const selection=selectionFor(score);
  const beforeScore=structuredClone(score);
  const beforeNotation=structuredClone(notation);
  const beforeSelection=structuredClone(selection);

  const admission=analyzeTeacherOctaveTransposeV4(score,notation,selection,1);

  assert.equal(admission.version,EDITOR_TEACHER_OCTAVE_TRANSPOSE_ADMISSION_V4_VERSION);
  assert.equal(admission.kind,'TEACHER_OCTAVE_TRANSPOSE_ADMISSION');
  assert.equal(admission.admitted,true);
  assert.equal(admission.octaveDelta,1);
  assert.equal(admission.selectedEventCount,3);
  assert.equal(admission.pitchedEventCount,2);
  assert.equal(admission.restEventCount,1);
  assert.equal(admission.noteCount,3);
  assert.deepEqual(admission.targetEventIds,['transpose-a','transpose-b','transpose-rest']);
  assert.deepEqual(admission.targetNotePlans.map(plan=>[plan.noteId,plan.sourcePitch,plan.targetPitch]),[
    ['transpose-na',pitch('C',1,4),pitch('C',1,5)],
    ['transpose-nb1',pitch('E',-1,4),pitch('E',-1,5)],
    ['transpose-nb2',pitch('G',0,5),pitch('G',0,6)]
  ]);
  assert.equal(admission.preservesStepAndAlter,true);
  assert.equal(admission.relationRemappingRequired,false);
  assert.equal(admission.canonicalMutationAuthority,false);
  assert.equal(admission.historyMutationAuthority,false);
  assert.deepEqual(score,beforeScore);
  assert.deepEqual(notation,beforeNotation);
  assert.deepEqual(selection,beforeSelection);
});

test('P02-TRANSPOSE01 rejects unsupported octave deltas',()=>{
  const score=scoreForTranspose();
  const notation=emptyNotationDocumentV4(score);
  const selection=selectionFor(score);
  for(const delta of [0,3,-3]){
    assert.throws(
      ()=>analyzeTeacherOctaveTransposeV4(score,notation,selection,delta),
      error=>error instanceof TeacherOctaveTransposeAdmissionV4Error&&error.code==='INVALID_OCTAVE_DELTA'
    );
  }
});

test('P02-TRANSPOSE01 rejects selected tied notes until relation closure is implemented',()=>{
  const score=scoreForTranspose();
  const empty=emptyNotationDocumentV4(score);
  const notation=createNotationDocumentV4(score,{
    ...empty,
    notes:[{
      target:addressEntityV3(score,'transpose-na'),
      notation:noteNotation({ties:[{number:1,type:'start'}]})
    }]
  });
  assert.throws(
    ()=>analyzeTeacherOctaveTransposeV4(score,notation,selectionFor(score),1),
    error=>error instanceof TeacherOctaveTransposeAdmissionV4Error&&error.code==='TIE_RELATION_UNSUPPORTED'
  );
});

test('P02-TRANSPOSE01 rejects selected pitched events with anchored grace groups',()=>{
  const score=scoreForTranspose();
  const raw=structuredClone(score);
  const staff=raw.parts[0].staves.find(candidate=>candidate.role==='standard');
  staff.measures[0].voices[0].graceGroups=[{
    id:'transpose-grace-group',
    anchorEventId:'transpose-a',
    placement:'before',
    events:[{
      id:'transpose-grace-event',
      kind:'note',
      writtenDuration:{numerator:1,denominator:16},
      playback:{stealTimePreviousPercent:null,stealTimeFollowingPercent:null,makeTime:null},
      note:{id:'transpose-grace-note',pitch:pitch('B',0,3)}
    }]
  }];
  const withGrace=createScoreDocumentV3(raw);
  const notation=emptyNotationDocumentV4(withGrace);
  const selection=createTeacherEventSpanSelectionV4(
    withGrace,
    addressEntityV3(withGrace,'transpose-a'),
    addressEntityV3(withGrace,'transpose-rest')
  );
  assert.throws(
    ()=>analyzeTeacherOctaveTransposeV4(withGrace,notation,selection,1),
    error=>error instanceof TeacherOctaveTransposeAdmissionV4Error&&error.code==='GRACE_RELATION_UNSUPPORTED'
  );
});

test('P02-TRANSPOSE01 rejects octave range overflow and underflow',()=>{
  for(const [octave,delta] of [[9,1],[-1,-1]]){
    const score=scoreForTranspose();
    const raw=structuredClone(score);
    const staff=raw.parts[0].staves.find(candidate=>candidate.role==='standard');
    staff.measures[0].voices[0].events[0].note.pitch.octave=octave;
    const ranged=createScoreDocumentV3(raw);
    const notation=emptyNotationDocumentV4(ranged);
    const selection=createTeacherEventSpanSelectionV4(
      ranged,
      addressEntityV3(ranged,'transpose-a'),
      addressEntityV3(ranged,'transpose-rest')
    );
    assert.throws(
      ()=>analyzeTeacherOctaveTransposeV4(ranged,notation,selection,delta),
      error=>error instanceof TeacherOctaveTransposeAdmissionV4Error&&error.code==='PITCH_RANGE_EXCEEDED'
    );
  }
});

test('P02-TRANSPOSE01 rejects an all-rest span because there is no pitched bulk target',()=>{
  const score=scoreForTranspose();
  const raw=structuredClone(score);
  const staff=raw.parts[0].staves.find(candidate=>candidate.role==='standard');
  staff.measures[0].voices[0].events=[
    rest('transpose-rest-a',{numerator:0,denominator:1},{numerator:1,denominator:2}),
    rest('transpose-rest-b',{numerator:1,denominator:2},{numerator:1,denominator:2})
  ];
  const rests=createScoreDocumentV3(raw);
  const notation=emptyNotationDocumentV4(rests);
  const selection=createTeacherEventSpanSelectionV4(
    rests,
    addressEntityV3(rests,'transpose-rest-a'),
    addressEntityV3(rests,'transpose-rest-b')
  );
  assert.throws(
    ()=>analyzeTeacherOctaveTransposeV4(rests,notation,selection,1),
    error=>error instanceof TeacherOctaveTransposeAdmissionV4Error&&error.code==='NO_PITCHED_TARGETS'
  );
});

test('P02-TRANSPOSE01 rejects tampered and stale teacher span selections fail closed',()=>{
  const score=scoreForTranspose();
  const notation=emptyNotationDocumentV4(score);
  const selection=selectionFor(score);
  const tampered=structuredClone(selection);
  tampered.targets=[tampered.targets[0],tampered.targets[2]];
  assert.throws(
    ()=>analyzeTeacherOctaveTransposeV4(score,notation,tampered,1),
    error=>error instanceof TeacherOctaveTransposeAdmissionV4Error&&error.code==='SELECTION_TAMPERED'
  );

  const raw=structuredClone(score);
  raw.revision={id:'rev:transpose-newer',parentId:score.revision.id};
  const newer=createScoreDocumentV3(raw);
  const newerNotation=emptyNotationDocumentV4(newer);
  assert.throws(
    ()=>analyzeTeacherOctaveTransposeV4(newer,newerNotation,selection,1),
    error=>error instanceof TeacherOctaveTransposeAdmissionV4Error&&error.code==='STALE_SELECTION'
  );
});
