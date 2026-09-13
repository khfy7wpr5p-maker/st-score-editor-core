import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { emptyNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createNewScoreEditorAppDocument } from '../dist/packages/score-editor-app-document/src/index.js';
import { createTeacherEventSpanSelectionV4 } from '../dist/packages/editor-teacher-event-span-v4/src/index.js';
import { analyzeTeacherOctaveTransposeV4 } from '../dist/packages/editor-teacher-octave-transpose-admission-v4/src/index.js';
import {
  createEditorSessionV4,
  commitSessionTeacherOctaveTransposeV4,
  navigateSessionHistoryV4
} from '../dist/packages/editor-session-controller-v4/src/index.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const pitch=(step='C',alter=0,octave=4)=>({step,alter,octave});
const note=(id,noteId,onset,duration,p=pitch())=>({id,kind:'note',onset,duration,note:{id:noteId,pitch:p}});
const chord=(id,noteDefs,onset,duration)=>({id,kind:'chord',onset,duration,notes:noteDefs.map(([noteId,p])=>({id:noteId,pitch:p}))});
const rest=(id,onset,duration)=>({id,kind:'rest',onset,duration});

const context=()=>{
  const app=createNewScoreEditorAppDocument({preset:'GUITAR_TREBLE'});
  const raw=structuredClone(app.session.history.present.score);
  const staff=raw.parts[0].staves.find(candidate=>candidate.role==='standard');
  staff.measures[0].voices[0].events=[
    note('transpose3-a','transpose3-na',{numerator:0,denominator:1},{numerator:1,denominator:4},pitch('C',0,4)),
    chord('transpose3-b',[
      ['transpose3-nb1',pitch('E',0,4)],
      ['transpose3-nb2',pitch('G',0,4)]
    ],{numerator:1,denominator:4},{numerator:1,denominator:4}),
    rest('transpose3-rest',{numerator:1,denominator:2},{numerator:1,denominator:2})
  ];
  const score=createScoreDocumentV3(raw);
  const notation=emptyNotationDocumentV4(score);
  const selection=createTeacherEventSpanSelectionV4(
    score,
    addressEntityV3(score,'transpose3-a'),
    addressEntityV3(score,'transpose3-rest')
  );
  const admission=analyzeTeacherOctaveTransposeV4(score,notation,selection,1);
  return {score,notation,selection,admission};
};

test('P02-TRANSPOSE03 commits octave bulk transpose once and Undo/Redo restores exact pairs',()=>{
  const {score,notation,selection,admission}=context();
  const session=createEditorSessionV4(score,notation);
  const before=structuredClone(session.history.present);
  const committed=commitSessionTeacherOctaveTransposeV4(
    session,selection,admission,{nextRevisionId:'rev:transpose3-next'}
  );
  const after=structuredClone(committed.history.present);

  assert.equal(committed.status.code,'TEACHER_OCTAVE_TRANSPOSE_EDIT_COMMITTED');
  assert.equal(committed.history.past.length,1);
  assert.deepEqual(committed.history.past[0],before);
  assert.equal(committed.history.future.length,0);
  assert.equal(committed.history.present.score.revision.id,'rev:transpose3-next');
  assert.equal(committed.selection.kind,'event');
  assert.equal(committed.selection.eventId,'transpose3-a');
  assert.equal(committed.renderRequest.revisionId,'rev:transpose3-next');

  const undone=navigateSessionHistoryV4(committed,'UNDO');
  assert.deepEqual(undone.history.present,before);
  assert.equal(undone.history.past.length,0);
  assert.deepEqual(undone.history.future[0],after);
  assert.equal(undone.selection,null);

  const redone=navigateSessionHistoryV4(undone,'REDO');
  assert.deepEqual(redone.history.present,after);
  assert.deepEqual(redone.history.past[0],before);
  assert.equal(redone.history.future.length,0);
  assert.equal(redone.selection,null);
});

test('P02-TRANSPOSE03 rejected tampered admission leaves session history unchanged',()=>{
  const {score,notation,selection,admission}=context();
  const session=createEditorSessionV4(score,notation);
  const before=structuredClone(session);
  const tampered=structuredClone(admission);
  tampered.targetNotePlans[0].targetPitch.octave=9;

  assert.throws(()=>commitSessionTeacherOctaveTransposeV4(
    session,selection,tampered,{nextRevisionId:'rev:transpose3-reject'}
  ));
  assert.deepEqual(session,before);
  assert.equal(session.history.past.length,0);
  assert.equal(session.history.future.length,0);
});
