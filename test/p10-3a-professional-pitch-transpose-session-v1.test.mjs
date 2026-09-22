import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4, emptyNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createEventSpanProfessionalSelectionV1 } from '../dist/packages/editor-professional-selection-v1/src/index.js';
import {
  ProfessionalPitchTransposeV1Error,
  analyzeProfessionalSemitoneTransposeV1
} from '../dist/packages/editor-professional-pitch-transpose-v1/src/index.js';
import {
  commitSessionProfessionalPitchTransposeV1
} from '../dist/packages/editor-session-professional-pitch-transpose-v1/src/index.js';
import {
  createEditorSessionV4,
  navigateSessionHistoryV4
} from '../dist/packages/editor-session-controller-v4/src/index.js';

const q=(numerator,denominator)=>({numerator,denominator});
const score=()=>createScoreDocumentV3({
  schemaVersion:'3.0.0',
  id:'p10-3a-session-score',
  revision:{id:'p10-3a-session-r1',parentId:null},
  source:{sha256:'4'.repeat(64),format:'synthetic',byteLength:null},
  measureFrames:[{id:'frame-1',ordinal:1,displayNumber:'1'}],
  parts:[{
    id:'part-1',ordinal:1,name:'Piano',
    instrument:{id:'instrument-1',name:'Piano',shortName:'Pno.'},
    staves:[{
      id:'staff-1',ordinal:1,role:'standard',
      measures:[{
        id:'measure-1',frameId:'frame-1',
        voices:[{
          id:'voice-1',ordinal:1,graceGroups:[],
          events:[
            {id:'event-1',kind:'note',onset:q(0,1),duration:q(1,4),note:{id:'note-1',pitch:{step:'C',alter:0,octave:4}}},
            {id:'event-2',kind:'note',onset:q(1,4),duration:q(1,4),note:{id:'note-2',pitch:{step:'D',alter:0,octave:4}}}
          ]
        }]
      }]
    }]
  }]
});

const notation=s=>{
  const empty=emptyNotationDocumentV4(s);
  return createNotationDocumentV4(s,{
    ...empty,
    measures:[{
      target:addressEntityV3(s,'measure-1'),
      notation:{keySignature:{fifths:0},clef:null}
    }]
  });
};

const selection=s=>createEventSpanProfessionalSelectionV1(
  s,
  addressEntityV3(s,'event-1'),
  addressEntityV3(s,'event-2')
);

test('P10-3A session commit creates exactly one unified V4 history revision',()=>{
  const s=score();
  const n=notation(s);
  const sel=selection(s);
  const session=createEditorSessionV4(s,n);
  const admission=analyzeProfessionalSemitoneTransposeV1(s,n,sel,1);

  const result=commitSessionProfessionalPitchTransposeV1(
    session,
    sel,
    admission,
    {nextRevisionId:'p10-3a-session-r2'}
  );

  assert.equal(result.historyCommitCount,1);
  assert.equal(result.historyAuthority,'EditorHistoryV4');
  assert.equal(result.session.history.past.length,1);
  assert.equal(result.session.history.present.score.revision.id,'p10-3a-session-r2');
  assert.equal(result.session.history.present.score.revision.parentId,'p10-3a-session-r1');
  assert.equal(result.session.status.code,'PROFESSIONAL_PITCH_TRANSPOSE_EDIT_COMMITTED');
  assert.equal(result.professionalSelection.anchor.revisionId,'p10-3a-session-r2');

  const undone=navigateSessionHistoryV4(result.session,'UNDO');
  assert.deepEqual(undone.history.present.score,s);
  assert.deepEqual(undone.history.present.notation,n);

  const redone=navigateSessionHistoryV4(undone,'REDO');
  assert.deepEqual(redone.history.present.score,result.session.history.present.score);
  assert.deepEqual(redone.history.present.notation,result.session.history.present.notation);
});

test('P10-3A session boundary rejects a tampered admission without history mutation',()=>{
  const s=score();
  const n=notation(s);
  const sel=selection(s);
  const session=createEditorSessionV4(s,n);
  const admission=structuredClone(analyzeProfessionalSemitoneTransposeV1(s,n,sel,1));
  admission.sourceRevisionId='tampered-revision';

  assert.throws(
    ()=>commitSessionProfessionalPitchTransposeV1(
      session,
      sel,
      admission,
      {nextRevisionId:'p10-3a-session-tampered'}
    ),
    error=>error instanceof ProfessionalPitchTransposeV1Error &&
      error.code==='ADMISSION_STALE_OR_TAMPERED'
  );
  assert.equal(session.history.past.length,0);
  assert.equal(session.history.present.score.revision.id,'p10-3a-session-r1');
});
