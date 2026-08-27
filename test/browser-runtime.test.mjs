import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserRuntime, browserRuntimeProfile } from '../dist/packages/browser-runtime/src/index.js';

const scoreInput = () => ({
  schemaVersion:'1.0.0',
  id:'doc-browser-1',
  revision:{id:'rev-1',parentId:null},
  source:{sha256:'b'.repeat(64),format:'synthetic',byteLength:null},
  parts:[{
    id:'part-1',name:'Fixture Part',staves:[{
      id:'staff-1',ordinal:1,measures:[{
        id:'measure-1',ordinal:1,displayNumber:'1',voices:[{
          id:'voice-1',ordinal:1,events:[{
            id:'event-1',kind:'note',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:4},note:{id:'note-1',pitch:{step:'C',alter:0,octave:4}}
          }]
        }]
      }]
    }]
  }]
});

test('browser runtime is a frozen non-production host surface',()=>{
  const runtime=createBrowserRuntime();
  assert.equal(runtime.runtimeVersion,'1.0.0');
  assert.equal(runtime.profile.productionRuntime,false);
  assert.equal(runtime.profile.networkCapable,false);
  assert.equal(runtime.profile.persistenceCapable,false);
  assert.equal(runtime.profile.browserMutationAuthority,false);
  assert.equal(runtime.profile.serverRevisionAuthority,false);
  assert.equal(runtime.profile.approvalAuthority,false);
  assert.equal(runtime.profile.publicationAuthority,false);
  assert.equal(Object.isFrozen(runtime),true);
  assert.equal(Object.isFrozen(browserRuntimeProfile),true);
});

test('browser runtime composes a local semantic edit session without server authority',()=>{
  const runtime=createBrowserRuntime();
  const score=runtime.createScoreDocument(scoreInput());
  let session=runtime.createEditorSession(score,runtime.emptyNotationDocument(score),'osmd');
  const token=session.renderRequest.manifest.entries.find((entry)=>entry.address.kind==='note')?.token;
  assert.ok(token);
  session=runtime.selectSessionRenderToken(session,token);
  session=runtime.commitSessionScoreIntent(
    session,
    {version:'1.0.0',type:'SET_PITCH',pitch:{step:'D',alter:0,octave:4}},
    {transactionId:'browser-tx-1',commandId:'browser-cmd-1',nextRevisionId:'browser-rev-2'}
  );
  assert.equal(session.history.present.score.revision.id,'browser-rev-2');
  assert.equal(session.history.present.score.parts[0].staves[0].measures[0].voices[0].events[0].note.pitch.step,'D');
  assert.equal(session.selection,null);
  session=runtime.navigateSessionHistory(session,'UNDO');
  assert.equal(session.history.present.score.revision.id,'rev-1');
});
