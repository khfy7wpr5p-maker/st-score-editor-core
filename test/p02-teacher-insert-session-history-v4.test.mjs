import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { emptyNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createNewScoreEditorAppDocument } from '../dist/packages/score-editor-app-document/src/index.js';
import { createTeacherEventSpanSelectionV4 } from '../dist/packages/editor-teacher-event-span-v4/src/index.js';
import { createTeacherCopySnapshotV4 } from '../dist/packages/editor-teacher-copy-snapshot-v4/src/index.js';
import { analyzeTeacherInsertAfterEventV4 } from '../dist/packages/editor-teacher-insert-admission-v4/src/index.js';
import {
  createEditorSessionV4,
  commitSessionTeacherInsertAfterEventV4,
  navigateSessionHistoryV4
} from '../dist/packages/editor-session-controller-v4/src/index.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const pitch=(step='C',alter=0,octave=4)=>({step,alter,octave});
const note=(id,noteId,onset,duration,step='C')=>({id,kind:'note',onset,duration,note:{id:noteId,pitch:pitch(step)}});
const rest=(id,onset,duration)=>({id,kind:'rest',onset,duration});

const context=()=>{
  const app=createNewScoreEditorAppDocument({preset:'GUITAR_TREBLE'});
  const raw=structuredClone(app.session.history.present.score);
  const voice=raw.parts[0].staves.find(candidate=>candidate.role==='standard').measures[0].voices[0];
  voice.events=[
    note('insert3-src-a','insert3-src-na',{numerator:0,denominator:1},{numerator:1,denominator:8},'C'),
    note('insert3-src-b','insert3-src-nb',{numerator:1,denominator:8},{numerator:1,denominator:8},'D'),
    note('insert3-anchor','insert3-anchor-note',{numerator:1,denominator:4},{numerator:1,denominator:4},'E'),
    note('insert3-suffix','insert3-suffix-note',{numerator:1,denominator:2},{numerator:1,denominator:4},'F'),
    rest('insert3-tail',{numerator:3,denominator:4},{numerator:1,denominator:4})
  ];
  voice.graceGroups=[];
  const score=createScoreDocumentV3(raw);
  const notation=emptyNotationDocumentV4(score);
  const selection=createTeacherEventSpanSelectionV4(
    score,
    addressEntityV3(score,'insert3-src-a'),
    addressEntityV3(score,'insert3-src-b')
  );
  const snapshot=createTeacherCopySnapshotV4(score,notation,selection);
  const admission=analyzeTeacherInsertAfterEventV4(
    score,notation,snapshot,addressEntityV3(score,'insert3-anchor')
  );
  return {score,notation,snapshot,admission};
};

test('P02-INSERT03 commits bounded insert once and Undo/Redo restores exact canonical pairs',()=>{
  const {score,notation,snapshot,admission}=context();
  const session=createEditorSessionV4(score,notation);
  const before=structuredClone(session.history.present);
  const committed=commitSessionTeacherInsertAfterEventV4(
    session,snapshot,admission,'rev:insert3-next'
  );
  const after=structuredClone(committed.history.present);

  assert.equal(committed.status.code,'TEACHER_INSERT_EDIT_COMMITTED');
  assert.equal(committed.history.past.length,1);
  assert.deepEqual(committed.history.past[0],before);
  assert.equal(committed.history.future.length,0);
  assert.equal(committed.history.present.score.revision.id,'rev:insert3-next');
  assert.equal(committed.selection.kind,'event');
  assert.equal(committed.selection.revisionId,'rev:insert3-next');
  assert.equal(committed.renderRequest.revisionId,'rev:insert3-next');

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

test('P02-INSERT03 rejected tampered admission leaves unified session history unchanged',()=>{
  const {score,notation,snapshot,admission}=context();
  const session=createEditorSessionV4(score,notation);
  const before=structuredClone(session);
  const tampered=structuredClone(admission);
  tampered.suffixShift[0].targetOnset={numerator:7,denominator:8};

  assert.throws(()=>commitSessionTeacherInsertAfterEventV4(
    session,snapshot,tampered,'rev:insert3-reject'
  ));
  assert.deepEqual(session,before);
  assert.equal(session.history.past.length,0);
  assert.equal(session.history.future.length,0);
});
