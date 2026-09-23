import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4, emptyNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createMeasureFrameAuthoringStandaloneScoreEditorController } from '../dist/packages/score-editor-browser-app/src/measure-frame-authoring.js';
import { createEventSpanProfessionalSelectionV1 } from '../dist/packages/editor-professional-selection-v1/src/index.js';
import {
  analyzeProfessionalRangeReplaceV1,
  createProfessionalRangeCopySnapshotV1,
  planProfessionalRangeReplaceIdentitiesV1
} from '../dist/packages/editor-professional-range-replace-v1/src/index.js';
import {
  createEditorSessionV4,
  navigateSessionHistoryV4
} from '../dist/packages/editor-session-controller-v4/src/index.js';
import {
  commitSessionProfessionalRangeReplaceV1
} from '../dist/packages/editor-session-professional-range-replace-v1/src/index.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const q=(numerator,denominator)=>({numerator,denominator});
const pitch=(step='C',alter=0,octave=4)=>({step,alter,octave});
const note=(id,noteId,onset,duration,step='C')=>({
  id,kind:'note',onset,duration,note:{id:noteId,pitch:pitch(step)}
});
const rest=(id,onset,duration)=>({id,kind:'rest',onset,duration});
const chord=(id,onset,duration,defs)=>({
  id,kind:'chord',onset,duration,
  notes:defs.map(([noteId,step])=>({id:noteId,pitch:pitch(step)}))
});
const eventNotation=(overrides={})=>({
  dots:0,beams:[],tuplet:null,articulations:[],ornaments:[],...overrides
});
const noteNotation=(overrides={})=>({
  accidental:null,ties:[],slurs:[],...overrides
});

const fixture=()=>{
  const controller=createMeasureFrameAuthoringStandaloneScoreEditorController();
  controller.newDocument({preset:'GUITAR_TREBLE'});
  const raw=structuredClone(controller.getDocument().session.history.present.score);
  raw.revision={id:'p10-3b-session-rev-1',parentId:'p10-3b-session-parent'};
  const staff=raw.parts[0].staves.find(item=>item.role==='standard');
  staff.measures[0].voices[0].events=[
    note('src-a','src-na',q(0,1),q(1,8),'C'),
    chord('src-b',q(1,8),q(1,8),[['src-nb1','E'],['src-nb2','G']]),
    note('dst-a','dst-na',q(1,4),q(1,16),'A'),
    rest('dst-b',q(5,16),q(1,16)),
    chord('dst-c',q(3,8),q(1,16),[['dst-nc1','C'],['dst-nc2','E']]),
    note('dst-d','dst-nd',q(7,16),q(1,16),'B'),
    note('tail','tail-note',q(1,2),q(1,2),'F')
  ];
  return createScoreDocumentV3(raw);
};

const span=(score,start,stop)=>createEventSpanProfessionalSelectionV1(
  score,addressEntityV3(score,start),addressEntityV3(score,stop)
);

const notationFixture=score=>{
  const empty=emptyNotationDocumentV4(score);
  return createNotationDocumentV4(score,{
    ...empty,
    events:[
      {target:addressEntityV3(score,'src-a'),notation:eventNotation({
        articulations:[{kind:'staccato',placement:'auto',direction:null}]
      })},
      {target:addressEntityV3(score,'dst-a'),notation:eventNotation({
        articulations:[{kind:'tenuto',placement:'below',direction:null}]
      })}
    ],
    notes:[
      {target:addressEntityV3(score,'src-na'),notation:noteNotation({accidental:'natural'})},
      {target:addressEntityV3(score,'dst-na'),notation:noteNotation({accidental:'flat'})}
    ]
  });
};

const prepared=()=>{
  const score=fixture();
  const notation=notationFixture(score);
  const source=span(score,'src-a','src-b');
  const destination=span(score,'dst-a','dst-d');
  const snapshot=createProfessionalRangeCopySnapshotV1(score,notation,source);
  const admission=analyzeProfessionalRangeReplaceV1(score,notation,snapshot,destination);
  const identityPlan=planProfessionalRangeReplaceIdentitiesV1(
    score,notation,snapshot,destination,admission,'p10-3b-session-rev-2'
  );
  const session=createEditorSessionV4(score,notation);
  return {score,notation,source,destination,snapshot,admission,identityPlan,session};
};

test('P10-3B session commits one exact direct-child history revision and refreshes semantic selection/render request',()=>{
  const x=prepared();
  const result=commitSessionProfessionalRangeReplaceV1(
    x.session,x.destination,x.snapshot,x.admission,x.identityPlan
  );

  assert.equal(result.historyCommitCount,1);
  assert.equal(result.historyAuthority,'EditorHistoryV4');
  assert.equal(result.session.history.past.length,1);
  assert.equal(result.session.history.future.length,0);
  assert.equal(result.session.history.present.score.revision.id,'p10-3b-session-rev-2');
  assert.equal(result.session.history.present.score.revision.parentId,x.score.revision.id);
  assert.equal(result.session.status.code,'PROFESSIONAL_RANGE_REPLACE_EDIT_COMMITTED');
  assert.equal(result.session.renderRequest.revisionId,'p10-3b-session-rev-2');
  assert.equal(result.professionalSelection.kind,'EVENT_SPAN');
  assert.deepEqual(
    result.professionalSelection.targets.map(target=>target.eventId),
    result.insertedEventIds
  );
  assert.equal(result.session.selection.eventId,result.professionalSelection.focus.eventId);
});

test('P10-3B session Undo/Redo restores exact score+notation snapshots and Redo preserves generated identities',()=>{
  const x=prepared();
  const beforeScore=JSON.stringify(x.session.history.present.score);
  const beforeNotation=JSON.stringify(x.session.history.present.notation);
  const committed=commitSessionProfessionalRangeReplaceV1(
    x.session,x.destination,x.snapshot,x.admission,x.identityPlan
  );
  const afterScore=JSON.stringify(committed.session.history.present.score);
  const afterNotation=JSON.stringify(committed.session.history.present.notation);
  const afterIds=[...committed.insertedEventIds,...committed.insertedNoteIds];

  const undone=navigateSessionHistoryV4(committed.session,'UNDO');
  assert.equal(JSON.stringify(undone.history.present.score),beforeScore);
  assert.equal(JSON.stringify(undone.history.present.notation),beforeNotation);
  assert.equal(undone.selection,null);

  const redone=navigateSessionHistoryV4(undone,'REDO');
  assert.equal(JSON.stringify(redone.history.present.score),afterScore);
  assert.equal(JSON.stringify(redone.history.present.notation),afterNotation);
  assert.equal(redone.selection,null);
  const scoreJson=JSON.stringify(redone.history.present.score);
  for(const id of afterIds) assert.equal(scoreJson.includes(id),true);
});

test('P10-3B failed session replacement leaves the input history completely unchanged',()=>{
  const x=prepared();
  const before=JSON.stringify(x.session.history);
  const tampered=structuredClone(x.identityPlan);
  tampered.events[0].destinationEventId='replace-event:tampered';

  assert.throws(
    ()=>commitSessionProfessionalRangeReplaceV1(
      x.session,x.destination,x.snapshot,x.admission,tampered
    )
  );
  assert.equal(JSON.stringify(x.session.history),before);
  assert.equal(x.session.history.past.length,0);
  assert.equal(x.session.history.future.length,0);
});
