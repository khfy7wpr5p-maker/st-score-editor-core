import test from 'node:test';
import assert from 'node:assert/strict';

import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { emptyNotationDocument } from '../dist/packages/notation-structure/src/index.js';
import {
  createEditorSession,
  selectSessionRenderToken,
  commitSessionKeypadAction,
  navigateSessionHistory
} from '../dist/packages/editor-session-controller/src/index.js';
import { createBrowserRuntime } from '../dist/packages/browser-runtime/src/index.js';

const score=()=>createScoreDocument({
  schemaVersion:'1.0.0',id:'doc-kp-session',revision:{id:'rev-1',parentId:null},source:{sha256:'c'.repeat(64),format:'canonical',byteLength:null},
  parts:[{id:'part-1',name:'Part',staves:[{id:'staff-1',ordinal:1,measures:[{id:'measure-1',ordinal:1,displayNumber:'1',voices:[{id:'voice-1',ordinal:1,events:[{id:'event-1',kind:'note',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:4},note:{id:'note-1',pitch:{step:'C',alter:0,octave:4}}}]}]}]}]}]
});
const noteToken=(session)=>session.renderRequest.manifest.entries.find((entry)=>entry.address.kind==='note')?.token;
const action=(actionId)=>({version:'1.0.0',actionId});
const identity=(transactionId,nextRevisionId)=>({version:'1.0.0',transactionId,nextRevisionId});

test('SEC-KP-07 surviving exact note selection is rebound to each new revision for chained keypad edits',()=>{
  const s=score();
  let session=createEditorSession(s,emptyNotationDocument(s),'osmd');
  const token=noteToken(session);assert.ok(token);
  session=selectSessionRenderToken(session,token);
  const firstAddress=session.selection.primary;
  assert.equal(firstAddress.kind,'note');
  assert.equal(firstAddress.revisionId,'rev-1');

  session=commitSessionKeypadAction(session,action('duration.eighth'),identity('kp-duration','rev-2'));
  assert.equal(session.history.present.score.revision.id,'rev-2');
  assert.equal(session.selection.primary.kind,'note');
  assert.equal(session.selection.primary.noteId,'note-1');
  assert.equal(session.selection.primary.revisionId,'rev-2');
  assert.equal(session.inspector.revisionId,'rev-2');
  assert.notEqual(session.selection.primary,firstAddress);
  assert.equal(firstAddress.revisionId,'rev-1');

  session=commitSessionKeypadAction(session,action('accidental.sharp'),identity('kp-sharp','rev-3'));
  assert.equal(session.selection.primary.noteId,'note-1');
  assert.equal(session.selection.primary.revisionId,'rev-3');
  assert.equal(session.inspector.fields.find((field)=>field.key==='pitch')?.value,'C+14');
  assert.equal(session.history.present.score.parts[0].staves[0].measures[0].voices[0].events[0].note.pitch.alter,1);
});

test('SEC-KP-07 note selection clears when note identity does not survive note-to-rest replacement and undo stays clear',()=>{
  const s=score();
  let session=createEditorSession(s,emptyNotationDocument(s),'osmd');
  const token=noteToken(session);assert.ok(token);
  session=selectSessionRenderToken(session,token);
  session=commitSessionKeypadAction(session,action('rest.eighth'),identity('kp-rest','rev-rest'));
  assert.equal(session.history.present.score.parts[0].staves[0].measures[0].voices[0].events[0].kind,'rest');
  assert.equal(session.selection,null);
  assert.equal(session.inspector,null);

  session=navigateSessionHistory(session,'UNDO');
  assert.equal(session.history.present.score.revision.id,'rev-1');
  assert.equal(session.selection,null);
  assert.equal(session.inspector,null);
});

test('SEC-KP-08 browser runtime exposes a frozen manifest and one typed bounded keypad commit entry point',()=>{
  const runtime=createBrowserRuntime();
  assert.equal(runtime.profile.networkCapable,false);
  assert.equal(runtime.profile.persistenceCapable,false);
  assert.equal(runtime.profile.rendererAuthority,false);
  assert.equal(runtime.profile.browserMutationAuthority,false);
  assert.equal(runtime.profile.keypadManifestAvailable,true);
  assert.equal(runtime.profile.keypadLocalCommitAvailable,true);
  assert.equal('commitSessionKeypadAction' in runtime,false);

  const manifest=runtime.getEditorKeypadManifest();
  assert.equal(manifest.semanticAuthority,'ACTION_ID_ONLY');
  assert.equal(manifest.rawGlyphCodepointsIncluded,false);
  assert.equal(Object.isFrozen(manifest),true);

  const s=runtime.createScoreDocument({
    schemaVersion:'1.0.0',id:'doc-browser-kp',revision:{id:'rev-1',parentId:null},source:{sha256:'d'.repeat(64),format:'synthetic',byteLength:null},
    parts:[{id:'part-1',name:'Part',staves:[{id:'staff-1',ordinal:1,measures:[{id:'measure-1',ordinal:1,displayNumber:'1',voices:[{id:'voice-1',ordinal:1,events:[{id:'event-1',kind:'note',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:4},note:{id:'note-1',pitch:{step:'C',alter:0,octave:4}}}]}]}]}]}]
  });
  let session=runtime.createEditorSession(s,runtime.emptyNotationDocument(s),'osmd');
  const browserToken=noteToken(session);assert.ok(browserToken);
  session=runtime.selectSessionRenderToken(session,browserToken);
  const result=runtime.commitKeypadAction(session,action('duration.16th'),identity('browser-kp','rev-browser-kp'));
  assert.equal(result.ok,true);
  assert.equal(result.session.history.present.score.revision.id,'rev-browser-kp');
  assert.equal(result.session.selection.primary.noteId,'note-1');
  assert.equal(result.session.selection.primary.revisionId,'rev-browser-kp');
});

test('SEC-KP-08 browser keypad errors are typed and do not alter the supplied immutable session',()=>{
  const runtime=createBrowserRuntime();
  const s=score();
  let session=runtime.createEditorSession(s,runtime.emptyNotationDocument(s),'osmd');
  const token=noteToken(session);assert.ok(token);
  session=runtime.selectSessionRenderToken(session,token);
  const beforeRevision=session.history.present.score.revision.id;
  const result=runtime.commitKeypadAction(session,{version:'1.0.0',actionId:'duration.64th'},identity('bad-kp','rev-bad'));
  assert.equal(result.ok,false);
  assert.equal(result.error.version,'1.0.0');
  assert.equal(result.error.code,'INVALID_ACTION');
  assert.ok(result.error.message.length>0);
  assert.equal(session.history.present.score.revision.id,beforeRevision);
  assert.equal(session.selection.primary.revisionId,'rev-1');
});
