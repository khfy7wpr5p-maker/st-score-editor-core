import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { emptyNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createMeasureFrameAuthoringStandaloneScoreEditorController } from '../dist/packages/score-editor-browser-app/src/measure-frame-authoring.js';
import { createEventSpanProfessionalSelectionV1 } from '../dist/packages/editor-professional-selection-v1/src/index.js';
import {
  ProfessionalRangeReplaceV1Error,
  analyzeProfessionalRangeReplaceV1,
  createProfessionalRangeCopySnapshotV1,
  planProfessionalRangeReplaceIdentitiesV1
} from '../dist/packages/editor-professional-range-replace-v1/src/index.js';

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

const fixture=()=>{
  const controller=createMeasureFrameAuthoringStandaloneScoreEditorController();
  controller.newDocument({preset:'GUITAR_TREBLE'});
  controller.appendMeasure();
  const raw=structuredClone(controller.getDocument().session.history.present.score);
  raw.revision={id:'p10-3b-id-rev-1',parentId:'p10-3b-id-parent'};
  const staff=raw.parts[0].staves.find(item=>item.role==='standard');
  staff.measures[0].voices[0].events=[
    note('src-a','src-na',q(0,1),q(1,4),'C'),
    chord('src-b',q(1,4),q(1,4),[['src-nb1','E'],['src-nb2','G']]),
    note('dst-a','dst-na',q(1,2),q(1,8),'A'),
    rest('dst-b',q(5,8),q(1,8)),
    chord('dst-c',q(3,4),q(1,8),[['dst-nc1','C'],['dst-nc2','E']]),
    note('dst-d','dst-nd',q(7,8),q(1,8),'B')
  ];
  staff.measures[1].voices[0].events=[
    note('m2-a','m2-na',q(0,1),q(1,2),'D'),
    note('m2-b','m2-nb',q(1,2),q(1,2),'F')
  ];
  return createScoreDocumentV3(raw);
};

const span=(score,start,stop)=>createEventSpanProfessionalSelectionV1(
  score,
  addressEntityV3(score,start),
  addressEntityV3(score,stop)
);

const facts=score=>{
  const notation=emptyNotationDocumentV4(score);
  const source=span(score,'src-a','src-b');
  const destination=span(score,'dst-a','dst-d');
  const snapshot=createProfessionalRangeCopySnapshotV1(score,notation,source);
  const admission=analyzeProfessionalRangeReplaceV1(score,notation,snapshot,destination);
  return {notation,source,destination,snapshot,admission};
};

test('P10-3B identity plan allocates deterministic fresh event and note identities for 2-to-4 replacement',()=>{
  const score=fixture();
  const {notation,destination,snapshot,admission}=facts(score);
  const plan=planProfessionalRangeReplaceIdentitiesV1(
    score,notation,snapshot,destination,admission,'p10-3b-id-rev-2'
  );

  assert.equal(plan.kind,'PROFESSIONAL_RANGE_REPLACE_IDENTITY_PLAN');
  assert.equal(plan.documentId,score.id);
  assert.equal(plan.sourceRevisionId,score.revision.id);
  assert.equal(plan.nextRevisionId,'p10-3b-id-rev-2');
  assert.equal(plan.destinationStartEventId,'dst-a');
  assert.equal(plan.destinationStopEventId,'dst-d');
  assert.equal(plan.eventIdentityCount,2);
  assert.equal(plan.noteIdentityCount,3);
  assert.equal(plan.relationIdentityCount,0);
  assert.equal(plan.identityAllocationPerformed,false);
  assert.equal(plan.canonicalMutationAuthority,false);
  assert.equal(plan.historyMutationAuthority,false);
  assert.deepEqual(plan.events.map(item=>item.sourceEventId),['src-a','src-b']);

  const canonicalIds=new Set([
    'src-a','src-b','src-na','src-nb1','src-nb2',
    'dst-a','dst-b','dst-c','dst-d','dst-na','dst-nc1','dst-nc2','dst-nd'
  ]);
  const generated=[
    ...plan.events.map(item=>item.destinationEventId),
    ...plan.events.flatMap(item=>item.notes.map(notePlan=>notePlan.destinationNoteId))
  ];
  assert.equal(new Set(generated).size,generated.length);
  assert.equal(generated.every(id=>id.startsWith('replace-')),true);
  assert.equal(generated.every(id=>!canonicalIds.has(id)),true);

  const repeated=planProfessionalRangeReplaceIdentitiesV1(
    score,notation,snapshot,destination,admission,'p10-3b-id-rev-2'
  );
  assert.deepEqual(repeated,plan);

  const differentRevision=planProfessionalRangeReplaceIdentitiesV1(
    score,notation,snapshot,destination,admission,'p10-3b-id-rev-3'
  );
  assert.notDeepEqual(
    differentRevision.events.map(item=>item.destinationEventId),
    plan.events.map(item=>item.destinationEventId)
  );
});

test('P10-3B identity plan rejects current and immediate-parent revision reuse',()=>{
  const score=fixture();
  const {notation,destination,snapshot,admission}=facts(score);
  for(const nextRevisionId of [score.revision.id,score.revision.parentId]){
    assert.throws(
      ()=>planProfessionalRangeReplaceIdentitiesV1(
        score,notation,snapshot,destination,admission,nextRevisionId
      ),
      error=>error instanceof ProfessionalRangeReplaceV1Error&&error.code==='INVALID_REVISION_ID'
    );
  }
});

test('P10-3B identity plan rejects malformed revision identity',()=>{
  const score=fixture();
  const {notation,destination,snapshot,admission}=facts(score);
  assert.throws(
    ()=>planProfessionalRangeReplaceIdentitiesV1(
      score,notation,snapshot,destination,admission,' bad revision '
    ),
    error=>error instanceof ProfessionalRangeReplaceV1Error&&error.code==='INVALID_REVISION_ID'
  );
});

test('P10-3B identity plan revalidates admission and rejects tampered facts',()=>{
  const score=fixture();
  const {notation,destination,snapshot,admission}=facts(score);
  const tampered=structuredClone(admission);
  tampered.destinationExtent={numerator:3,denominator:4};
  assert.throws(
    ()=>planProfessionalRangeReplaceIdentitiesV1(
      score,notation,snapshot,destination,tampered,'p10-3b-id-rev-2'
    ),
    error=>error instanceof ProfessionalRangeReplaceV1Error&&error.code==='ADMISSION_STALE_OR_TAMPERED'
  );
});

test('P10-3B identity plan fails closed when a deterministic generated identity is already canonical',()=>{
  const score=fixture();
  const first=facts(score);
  const initial=planProfessionalRangeReplaceIdentitiesV1(
    score,first.notation,first.snapshot,first.destination,first.admission,'p10-3b-id-rev-2'
  );
  const collisionId=initial.events[0].destinationEventId;

  const raw=structuredClone(score);
  const staff=raw.parts[0].staves.find(item=>item.role==='standard');
  staff.measures[1].voices[0].events[0].id=collisionId;
  const collided=createScoreDocumentV3(raw);
  const current=facts(collided);

  assert.throws(
    ()=>planProfessionalRangeReplaceIdentitiesV1(
      collided,
      current.notation,
      current.snapshot,
      current.destination,
      current.admission,
      'p10-3b-id-rev-2'
    ),
    error=>error instanceof ProfessionalRangeReplaceV1Error&&error.code==='ID_COLLISION'
  );
});

test('P10-3B identity plan maps every source chord tone once and never allocates relation identities',()=>{
  const score=fixture();
  const {notation,destination,snapshot,admission}=facts(score);
  const plan=planProfessionalRangeReplaceIdentitiesV1(
    score,notation,snapshot,destination,admission,'p10-3b-id-rev-2'
  );
  const chordPlan=plan.events.find(item=>item.sourceEventId==='src-b');
  assert.ok(chordPlan);
  assert.deepEqual(chordPlan.notes.map(item=>item.sourceNoteId),['src-nb1','src-nb2']);
  assert.equal(chordPlan.notes.every(item=>item.destinationNoteId!==item.sourceNoteId),true);
  assert.equal(plan.relationIdentityCount,0);
});
