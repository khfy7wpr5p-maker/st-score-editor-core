import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createEditorSessionV4,
  navigateSessionHistoryV4
} from '../dist/packages/editor-session-controller-v4/src/index.js';
import {
  commitSessionProfessionalRangeReplaceV1
} from '../dist/packages/editor-session-professional-range-replace-v1/src/index.js';
import {
  createBasicRangeReplaceNotation,
  createCompactRangeReplaceScore,
  prepareRangeReplaceFacts
} from './helpers/p10-3b-fixtures.mjs';

const prepared=()=>{
  const score=createCompactRangeReplaceScore({
    revisionId:'p10-3b-session-rev-1',
    parentId:'p10-3b-session-parent'
  });
  const notation=createBasicRangeReplaceNotation(score);
  const facts=prepareRangeReplaceFacts({
    score,
    notation,
    nextRevisionId:'p10-3b-session-rev-2'
  });
  return {...facts,session:createEditorSessionV4(score,notation)};
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