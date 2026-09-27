import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createEditorSessionV4,
  navigateSessionHistoryV4
} from '../dist/packages/editor-session-controller-v4/src/index.js';
import {
  createFourToThreeFixture as fixture,
  exactFourToThreeIntent as intent
} from './helpers/four-to-three-tuplet-fixture.mjs';

test('P10-2C session commits exact 4:3 unretiming as one history revision with exact Undo and Redo',async()=>{
  const module=await import('../dist/packages/editor-session-four-to-three-tuplet-unretiming-v4/src/index.js').catch(()=>({}));
  assert.equal(
    typeof module.commitSessionFourToThreeTupletToStraightFourV4,
    'function',
    'P10-2C session wrapper must exist'
  );

  const {score,notation}=fixture({idPrefix:'p10-2c-session'});
  let session=createEditorSessionV4(score,notation);
  const beforeScore=structuredClone(session.history.present.score);
  const beforeNotation=structuredClone(session.history.present.notation);

  session=module.commitSessionFourToThreeTupletToStraightFourV4(
    session,intent(score),{nextRevisionId:'p10-2c-session-straight'}
  );
  const afterScore=structuredClone(session.history.present.score);
  const afterNotation=structuredClone(session.history.present.notation);

  assert.equal(session.history.past.length,1);
  assert.equal(session.history.future.length,0);
  assert.equal(session.status.code,'FOUR_TO_THREE_TUPLET_UNRETIMING_COMMITTED');
  assert.equal(
    session.status.message,
    'Atomic 4:3 tuplet to straight-four unretiming committed in the unified V4 history.'
  );
  assert.equal(session.selection.kind,'event');
  assert.equal(session.selection.eventId,'e1');
  assert.equal(session.selection.revisionId,'p10-2c-session-straight');
  assert.equal(session.renderRequest.revisionId,'p10-2c-session-straight');

  session=navigateSessionHistoryV4(session,'UNDO');
  assert.deepEqual(session.history.present.score,beforeScore);
  assert.deepEqual(session.history.present.notation,beforeNotation);
  assert.equal(session.history.past.length,0);
  assert.equal(session.history.future.length,1);

  session=navigateSessionHistoryV4(session,'REDO');
  assert.deepEqual(session.history.present.score,afterScore);
  assert.deepEqual(session.history.present.notation,afterNotation);
  assert.equal(session.history.past.length,1);
  assert.equal(session.history.future.length,0);
});

test('P10-2C session rejection leaves the immutable session/history/render state unchanged',async()=>{
  const module=await import('../dist/packages/editor-session-four-to-three-tuplet-unretiming-v4/src/index.js');
  const {score,notation}=fixture();
  const session=createEditorSessionV4(score,notation);
  const before=structuredClone(session);
  const reversed={...intent(score),targets:[...intent(score).targets].reverse()};

  assert.throws(
    ()=>module.commitSessionFourToThreeTupletToStraightFourV4(
      session,reversed,{nextRevisionId:'p10-2c-session-rejected'}
    ),
    error=>error?.code==='TIMING_NOT_ADMITTED'
  );
  assert.deepEqual(session,before);

  assert.throws(
    ()=>module.commitSessionFourToThreeTupletToStraightFourV4(
      session,intent(score),{nextRevisionId:score.revision.id}
    ),
    error=>error?.code==='INVALID_REVISION_ID'
  );
  assert.deepEqual(session,before);
});
