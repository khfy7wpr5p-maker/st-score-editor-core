import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserRuntime } from '../dist/packages/browser-runtime/src/index.js';
import {
  rendererProfile,
  rendererProfileForIntegration
} from '../dist/packages/renderer-contract/src/index.js';

const scoreInput = () => ({
  schemaVersion:'1.0.0',
  id:'doc-renderer-profile-1',
  revision:{id:'rev-1',parentId:null},
  source:{sha256:'c'.repeat(64),format:'synthetic',byteLength:null},
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

const stRenderingLayerProfile = Object.freeze({
  family:'osmd',
  packageName:'opensheetmusicdisplay',
  packageVersion:'2.1.2',
  license:'BSD-3-Clause'
});

test('legacy osmd family bootstrap remains pinned to 2.1.1',()=>{
  assert.deepEqual(rendererProfile('osmd'),{
    family:'osmd',packageName:'opensheetmusicdisplay',packageVersion:'2.1.1',license:'BSD-3-Clause'
  });
  const runtime=createBrowserRuntime();
  const score=runtime.createScoreDocument(scoreInput());
  const session=runtime.createEditorSession(score,runtime.emptyNotationDocument(score),'osmd');
  assert.equal(session.renderRequest.renderer.packageVersion,'2.1.1');
});

test('ST Rendering Layer integration profile is explicitly admitted as OSMD 2.1.2',()=>{
  assert.deepEqual(rendererProfileForIntegration('st-score-rendering-layer'),stRenderingLayerProfile);
  const runtime=createBrowserRuntime();
  const score=runtime.createScoreDocument(scoreInput());
  let session=runtime.createEditorSessionWithRendererProfile(score,runtime.emptyNotationDocument(score),stRenderingLayerProfile);
  assert.deepEqual(session.renderRequest.renderer,stRenderingLayerProfile);

  const token=session.renderRequest.manifest.entries.find((entry)=>entry.address.kind==='note')?.token;
  assert.ok(token);
  session=runtime.selectSessionRenderToken(session,token);
  session=runtime.commitSessionScoreIntent(
    session,
    {version:'1.0.0',type:'SET_PITCH',pitch:{step:'D',alter:0,octave:4}},
    {transactionId:'profile-tx-1',commandId:'profile-cmd-1',nextRevisionId:'rev-2'}
  );
  assert.equal(session.renderRequest.renderer.packageVersion,'2.1.2');
  assert.equal(session.history.present.score.revision.id,'rev-2');

  session=runtime.navigateSessionHistory(session,'UNDO');
  assert.equal(session.renderRequest.renderer.packageVersion,'2.1.2');
  assert.equal(session.history.present.score.revision.id,'rev-1');
});

test('unreviewed OSMD versions remain fail-closed',()=>{
  const runtime=createBrowserRuntime();
  const score=runtime.createScoreDocument(scoreInput());
  assert.throws(
    ()=>runtime.createEditorSessionWithRendererProfile(score,runtime.emptyNotationDocument(score),{
      family:'osmd',packageName:'opensheetmusicdisplay',packageVersion:'2.1.3',license:'BSD-3-Clause'
    }),
    (error)=>error?.code==='INVALID_RENDERER_PROFILE'
  );
});
