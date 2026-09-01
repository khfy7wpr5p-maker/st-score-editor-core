import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { notationForEvent, notationForNote } from '../dist/packages/notation-structure/src/index.js';
import { createBrowserRuntime } from '../dist/packages/browser-runtime/src/index.js';

const action=(actionId)=>({version:'1.0.0',actionId});
const identity=(transactionId,nextRevisionId)=>({version:'1.0.0',transactionId,nextRevisionId});

const score=()=>createScoreDocument({
  schemaVersion:'1.0.0',id:'doc-final-kp',revision:{id:'rev-1',parentId:null},source:{sha256:'8'.repeat(64),format:'canonical',byteLength:null},
  parts:[{id:'part-1',name:'Part',staves:[{id:'staff-1',ordinal:1,measures:[{id:'measure-1',ordinal:1,displayNumber:'1',voices:[{id:'voice-1',ordinal:1,events:[
    {id:'event-1',kind:'note',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:4},note:{id:'note-1',pitch:{step:'C',alter:0,octave:4}}}
  ]}]}]}]}]
});

const eventOf=(session)=>session.history.present.score.parts[0].staves[0].measures[0].voices[0].events[0];
const noteToken=(session)=>session.renderRequest.manifest.entries.find((entry)=>entry.address.kind==='note')?.token;
const selectedSession=()=>{
  const runtime=createBrowserRuntime();
  const s=score();
  let session=runtime.createEditorSession(s,runtime.emptyNotationDocument(s),'osmd');
  const token=noteToken(session);assert.ok(token);
  session=runtime.selectSessionRenderToken(session,token);
  return {runtime,s,session};
};

test('SEC-KP-10 quarter -> eighth -> 16th uses chained safe selection and undo restores exact unified revisions',()=>{
  const {runtime,s}=selectedSession();
  let {session}=selectedSession();
  session=runtime.commitKeypadAction(session,action('duration.eighth'),identity('final-eighth','rev-2')).session;
  assert.deepEqual(eventOf(session).duration,{numerator:1,denominator:8});
  assert.equal(session.selection.primary.revisionId,'rev-2');
  session=runtime.commitKeypadAction(session,action('duration.16th'),identity('final-16th','rev-3')).session;
  assert.deepEqual(eventOf(session).duration,{numerator:1,denominator:16});
  assert.equal(session.history.present.notation.revisionId,'rev-3');

  session=runtime.navigateSessionHistory(session,'UNDO');
  assert.equal(session.history.present.score.revision.id,'rev-2');
  assert.equal(session.history.present.notation.revisionId,'rev-2');
  assert.deepEqual(eventOf(session).duration,{numerator:1,denominator:8});
  assert.equal(session.selection,null);

  session=runtime.navigateSessionHistory(session,'UNDO');
  assert.equal(session.history.present.score.revision.id,'rev-1');
  assert.equal(session.history.present.notation.revisionId,'rev-1');
  assert.deepEqual(eventOf(session).duration,{numerator:1,denominator:4});
  assert.deepEqual(session.history.present.score.source,s.source);
});

test('SEC-KP-10 note -> eighth rest -> undo restores the note and immutable source evidence',()=>{
  const {runtime,s}=selectedSession();
  let {session}=selectedSession();
  const sourceBefore=JSON.stringify(session.history.present.score.source);
  const result=runtime.commitKeypadAction(session,action('rest.eighth'),identity('final-rest','rev-rest'));
  assert.equal(result.ok,true);session=result.session;
  assert.equal(eventOf(session).kind,'rest');
  assert.deepEqual(eventOf(session).duration,{numerator:1,denominator:8});
  assert.equal(session.selection,null);
  assert.equal(JSON.stringify(session.history.present.score.source),sourceBefore);
  session=runtime.navigateSessionHistory(session,'UNDO');
  assert.equal(eventOf(session).kind,'note');
  assert.deepEqual(eventOf(session).duration,{numerator:1,denominator:4});
  assert.deepEqual(session.history.present.score,s);
});

test('SEC-KP-10 natural sharp flat correction sequence remains canonical plus display-atomic',()=>{
  const {runtime}=selectedSession();
  let {session}=selectedSession();
  for(const [actionId,alter,display,revision] of [
    ['accidental.sharp',1,'sharp','rev-sharp'],
    ['accidental.natural',0,'natural','rev-natural-1'],
    ['accidental.flat',-1,'flat','rev-flat'],
    ['accidental.natural',0,'natural','rev-natural-2']
  ]){
    const result=runtime.commitKeypadAction(session,action(actionId),identity(`final-${display}-${revision}`,revision));
    assert.equal(result.ok,true);session=result.session;
    assert.equal(eventOf(session).note.pitch.alter,alter);
    assert.equal(notationForNote(session.history.present.notation,'note-1').accidental,display);
    assert.equal(session.history.present.score.revision.id,session.history.present.notation.revisionId);
    assert.equal(session.selection.primary.noteId,'note-1');
  }
});

test('SEC-KP-10 one-dot and two-dot edits keep canonical timing aligned and undo restores the prior dotted revision',()=>{
  const {runtime}=selectedSession();
  let {session}=selectedSession();
  let result=runtime.commitKeypadAction(session,action('dot.set.1'),identity('final-dot-1','rev-dot-1'));
  assert.equal(result.ok,true);session=result.session;
  assert.deepEqual(eventOf(session).duration,{numerator:3,denominator:8});
  assert.equal(notationForEvent(session.history.present.notation,'event-1').dots,1);
  result=runtime.commitKeypadAction(session,action('dot.set.2'),identity('final-dot-2','rev-dot-2'));
  assert.equal(result.ok,true);session=result.session;
  assert.deepEqual(eventOf(session).duration,{numerator:7,denominator:16});
  assert.equal(notationForEvent(session.history.present.notation,'event-1').dots,2);
  session=runtime.navigateSessionHistory(session,'UNDO');
  assert.deepEqual(eventOf(session).duration,{numerator:3,denominator:8});
  assert.equal(notationForEvent(session.history.present.notation,'event-1').dots,1);
});

test('SEC-KP-10 missing glyph presentation cannot change keypad semantics or accessibility labels',()=>{
  const {runtime}=selectedSession();
  let {session}=selectedSession();
  const descriptor=runtime.getEditorKeypadManifest().groups.flatMap((group)=>group.actions).find((item)=>item.actionId==='duration.eighth');
  assert.ok(descriptor);
  assert.ok(descriptor.accessibleLabelKey.length>0);
  const hostPresentation={...descriptor,glyph:null};
  assert.equal(hostPresentation.glyph,null);
  const result=runtime.commitKeypadAction(session,action(hostPresentation.actionId),identity('final-no-glyph','rev-no-glyph'));
  assert.equal(result.ok,true);session=result.session;
  assert.deepEqual(eventOf(session).duration,{numerator:1,denominator:8});
});

test('SEC-KP-10 authority regressions keep renderer browser AI and Guitar Workspace non-authoritative',async()=>{
  const runtime=createBrowserRuntime();
  const architecture=JSON.parse(await readFile(new URL('../contracts/editor-core-v1.json',import.meta.url),'utf8'));
  const authority=JSON.parse(await readFile(new URL('../contracts/authority-boundary-v1.json',import.meta.url),'utf8'));
  assert.equal(runtime.profile.networkCapable,false);
  assert.equal(runtime.profile.persistenceCapable,false);
  assert.equal(runtime.profile.rendererAuthority,false);
  assert.equal(runtime.profile.browserMutationAuthority,false);
  assert.equal(architecture.rendering.coordinatesAuthoritative,false);
  assert.equal(architecture.rendering.domIdsAuthoritative,false);
  assert.equal(architecture.guitarWorkspace.authority,'DERIVATIVE_ONLY');
  assert.equal(architecture.guitarWorkspace.reverseWriteToCanonicalAllowed,false);
  assert.equal(authority.ai.advisoryOnly,true);
  assert.equal(authority.ai.mayMutateCanonicalScore,false);
  assert.equal(authority.renderer.mayMutateCanonicalScore,false);
});
