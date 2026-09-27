import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createNewScoreEditorAppDocument } from '../dist/packages/score-editor-app-document/src/index.js';
import {
  createEditorSessionV4,
  navigateSessionHistoryV4
} from '../dist/packages/editor-session-controller-v4/src/index.js';

const ids=()=>{let n=0;return()=>`p10-2c-session-${++n}`;};
const note=(id,noteId,onset,duration,step)=>({
  id,kind:'note',onset,duration,note:{id:noteId,pitch:{step,alter:0,octave:4}}
});
const rest=(id,onset,duration)=>({id,kind:'rest',onset,duration});
const tuple=(position,number=1)=>({
  dots:0,
  beams:[],
  tuplet:{
    actualNotes:4,
    normalNotes:3,
    marks:position==='middle'?[]:[{number,type:position}]
  },
  articulations:[],
  ornaments:[]
});

const fixture=()=>{
  const document=createNewScoreEditorAppDocument({idFactory:ids(),preset:'GUITAR_TREBLE'});
  const baseScore=document.session.history.present.score;
  const baseNotation=document.session.history.present.notation;
  const raw=structuredClone(baseScore);
  const staff=raw.parts[0].staves.find(candidate=>candidate.role==='standard');
  staff.measures[0].voices[0].events=[
    note('e1','n1',{numerator:0,denominator:1},{numerator:3,denominator:32},'C'),
    note('e2','n2',{numerator:3,denominator:32},{numerator:3,denominator:32},'D'),
    note('e3','n3',{numerator:3,denominator:16},{numerator:3,denominator:32},'E'),
    note('e4','n4',{numerator:9,denominator:32},{numerator:3,denominator:32},'F'),
    rest('r1',{numerator:3,denominator:8},{numerator:1,denominator:8})
  ];
  const score=createScoreDocumentV3(raw);
  const notation=createNotationDocumentV4(score,{
    contractVersion:'4.0.0',
    documentId:score.id,
    revisionId:score.revision.id,
    frames:baseNotation.frames.map(entry=>({
      target:addressEntityV3(score,entry.target.frameId),
      notation:entry.notation
    })),
    measures:baseNotation.measures.map(entry=>({
      target:addressEntityV3(score,entry.target.measureId),
      notation:entry.notation
    })),
    events:[
      {target:addressEntityV3(score,'e1'),notation:tuple('start')},
      {target:addressEntityV3(score,'e2'),notation:tuple('middle')},
      {target:addressEntityV3(score,'e3'),notation:tuple('middle')},
      {target:addressEntityV3(score,'e4'),notation:tuple('stop')}
    ],
    notes:[],
    graceEvents:[],
    graceNotes:[],
    crossStaffPlacements:[]
  });
  return {score,notation};
};

const intent=score=>({
  version:'1.0.0',
  type:'UNRETIMING_FOUR_TO_THREE_TO_STRAIGHT_FOUR',
  targets:['e1','e2','e3','e4'].map(id=>addressEntityV3(score,id))
});

test('P10-2C session commits exact 4:3 unretiming as one history revision with exact Undo and Redo',async()=>{
  const module=await import('../dist/packages/editor-session-four-to-three-tuplet-unretiming-v4/src/index.js').catch(()=>({}));
  assert.equal(
    typeof module.commitSessionFourToThreeTupletToStraightFourV4,
    'function',
    'P10-2C session wrapper must exist'
  );

  const {score,notation}=fixture();
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
