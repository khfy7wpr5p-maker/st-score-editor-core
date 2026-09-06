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
  createEditorSessionV4,
  commitSessionTeacherPasteOverwriteV4,
  navigateSessionHistoryV4
} from '../dist/packages/editor-session-controller-v4/src/index.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const pitch=(step='C',alter=0,octave=4)=>({step,alter,octave});
const note=(id,noteId,onset,duration,step='C')=>({id,kind:'note',onset,duration,note:{id:noteId,pitch:pitch(step)}});
const rest=(id,onset,duration)=>({id,kind:'rest',onset,duration});
const eventNotation=(overrides={})=>({dots:0,beams:[],tuplet:null,articulations:[],ornaments:[],...overrides});
const noteNotation=(overrides={})=>({accidental:null,ties:[],slurs:[],...overrides});

const scoreForSessionPaste=()=>{
  const app=createNewScoreEditorAppDocument({preset:'GUITAR_TREBLE'});
  const raw=structuredClone(app.session.history.present.score);
  const staff=raw.parts[0].staves.find(candidate=>candidate.role==='standard');
  staff.measures[0].voices[0].events=[
    note('session-src-a','session-src-na',{numerator:0,denominator:1},{numerator:1,denominator:8},'C'),
    note('session-src-b','session-src-nb',{numerator:1,denominator:8},{numerator:1,denominator:8},'D'),
    rest('session-destination',{numerator:1,denominator:4},{numerator:3,denominator:4})
  ];
  return createScoreDocumentV3(raw);
};

const notationForSessionPaste=score=>{
  const empty=emptyNotationDocumentV4(score);
  return createNotationDocumentV4(score,{
    ...empty,
    events:[
      {
        target:addressEntityV3(score,'session-src-a'),
        notation:eventNotation({articulations:[{kind:'staccato',placement:'auto',direction:null}]})
      }
    ],
    notes:[
      {
        target:addressEntityV3(score,'session-src-na'),
        notation:noteNotation({accidental:'natural'})
      }
    ]
  });
};

const pasteFacts=(score,notation,nextRevisionId)=>{
  const selection=createTeacherEventSpanSelectionV4(
    score,
    addressEntityV3(score,'session-src-a'),
    addressEntityV3(score,'session-src-b')
  );
  const snapshot=createTeacherCopySnapshotV4(score,notation,selection);
  const admission=analyzeTeacherPasteDestinationV4(
    score,
    notation,
    snapshot,
    addressEntityV3(score,'session-destination')
  );
  const identityPlan=planTeacherPasteIdentitiesV4(score,notation,snapshot,admission,nextRevisionId);
  return {snapshot,admission,identityPlan};
};

test('P02-PASTE03 commits one atomic paste revision into EditorSessionV4 history',()=>{
  const score=scoreForSessionPaste();
  const notation=notationForSessionPaste(score);
  const initial=createEditorSessionV4(score,notation);
  const beforePair=structuredClone(initial.history.present);
  const {snapshot,admission,identityPlan}=pasteFacts(score,notation,'rev:session-paste-next');

  const committed=commitSessionTeacherPasteOverwriteV4(initial,snapshot,admission,identityPlan);

  assert.equal(committed.status.code,'TEACHER_PASTE_EDIT_COMMITTED');
  assert.equal(committed.history.past.length,1);
  assert.equal(committed.history.future.length,0);
  assert.deepEqual(committed.history.past[0],beforePair);
  assert.equal(committed.history.present.score.revision.id,'rev:session-paste-next');
  assert.equal(committed.history.present.score.revision.parentId,score.revision.id);
  assert.equal(committed.selection.kind,'event');
  assert.equal(committed.selection.eventId,identityPlan.events[0].destinationEventId);
  assert.equal(committed.selection.revisionId,'rev:session-paste-next');
  assert.equal(committed.renderRequest.scoreRevisionId,'rev:session-paste-next');

  assert.deepEqual(initial.history.present,beforePair);
  assert.equal(initial.history.past.length,0);
});

test('P02-PASTE03 undo and redo restore exact canonical score+notation pairs',()=>{
  const score=scoreForSessionPaste();
  const notation=notationForSessionPaste(score);
  const initial=createEditorSessionV4(score,notation);
  const beforePair=structuredClone(initial.history.present);
  const {snapshot,admission,identityPlan}=pasteFacts(score,notation,'rev:session-paste-undo-redo');
  const committed=commitSessionTeacherPasteOverwriteV4(initial,snapshot,admission,identityPlan);
  const afterPair=structuredClone(committed.history.present);

  const undone=navigateSessionHistoryV4(committed,'UNDO');
  assert.equal(undone.status.code,'UNDO_COMMITTED');
  assert.deepEqual(undone.history.present,beforePair);
  assert.equal(undone.history.past.length,0);
  assert.equal(undone.history.future.length,1);
  assert.deepEqual(undone.history.future[0],afterPair);
  assert.equal(undone.selection,null);
  assert.equal(undone.renderRequest.scoreRevisionId,beforePair.score.revision.id);

  const redone=navigateSessionHistoryV4(undone,'REDO');
  assert.equal(redone.status.code,'REDO_COMMITTED');
  assert.deepEqual(redone.history.present,afterPair);
  assert.equal(redone.history.past.length,1);
  assert.deepEqual(redone.history.past[0],beforePair);
  assert.equal(redone.history.future.length,0);
  assert.equal(redone.selection,null);
  assert.equal(redone.renderRequest.scoreRevisionId,afterPair.score.revision.id);
});

test('P02-PASTE03 failed stale/tampered paste does not mutate session history',()=>{
  const score=scoreForSessionPaste();
  const notation=notationForSessionPaste(score);
  const initial=createEditorSessionV4(score,notation);
  const before=structuredClone(initial);
  const {snapshot,admission,identityPlan}=pasteFacts(score,notation,'rev:session-paste-reject');
  const tampered=structuredClone(admission);
  tampered.pasteEnd={numerator:7,denominator:8};

  assert.throws(()=>commitSessionTeacherPasteOverwriteV4(initial,snapshot,tampered,identityPlan));
  assert.deepEqual(initial,before);
  assert.equal(initial.history.past.length,0);
  assert.equal(initial.history.future.length,0);
});
