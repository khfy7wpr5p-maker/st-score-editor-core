import test from 'node:test';
import assert from 'node:assert/strict';
import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { emptyNotationDocument } from '../dist/packages/notation-structure/src/index.js';
import {
  createSesliTabEditorHost,
  createSesliTabHostSnapshot,
  selectSesliTabRenderToken,
  commitSesliTabScoreIntent,
  navigateSesliTabHistory,
  sesliTabEditorHostProfile
} from '../dist/packages/seslitab-editor-host/src/index.js';

const score=()=>createScoreDocument({schemaVersion:'1.0.0',id:'doc-seslitab',revision:{id:'rev-1',parentId:null},source:{sha256:'c'.repeat(64),format:'synthetic',byteLength:null},parts:[{id:'part-1',name:'Part',staves:[{id:'staff-1',ordinal:1,measures:[{id:'measure-1',ordinal:1,displayNumber:'1',voices:[{id:'voice-1',ordinal:1,events:[{id:'event-1',kind:'note',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:4},note:{id:'note-1',pitch:{step:'C',alter:0,octave:4}}}]}]}]}]}]});
const selectedHost=(mode)=>{const s=score();let host=createSesliTabEditorHost(s,emptyNotationDocument(s),'osmd');const token=host.session.renderRequest.manifest.entries.find((entry)=>entry.address.kind==='note')?.token;assert.ok(token);const selected=selectSesliTabRenderToken(host,token,mode);assert.equal(selected.ok,true);return selected.host;};
const commitPitch=(host,mode,nextRevisionId)=>commitSesliTabScoreIntent(host,{version:'1.0.0',type:'SET_PITCH',pitch:{step:'D',alter:0,octave:4}},{transactionId:`tx-${mode}`,commandId:`cmd-${mode}`,nextRevisionId},mode);

test('SEC-NE-09 host exposes one canonical editor session and no host/renderer authority',()=>{
  const s=score(),host=createSesliTabEditorHost(s,emptyNotationDocument(s));const snapshot=createSesliTabHostSnapshot(host);
  assert.equal(snapshot.documentId,s.id);assert.equal(snapshot.revisionId,'rev-1');assert.equal(snapshot.capabilities.canonicalStateCount,1);
  assert.equal(sesliTabEditorHostProfile.hostDualWriteAllowed,false);assert.equal(sesliTabEditorHostProfile.rendererMutationAuthority,false);assert.equal(sesliTabEditorHostProfile.domCoordinateMutationAuthority,false);
  assert.equal(sesliTabEditorHostProfile.networkAuthority,false);assert.equal(sesliTabEditorHostProfile.persistenceAuthority,false);assert.equal(sesliTabEditorHostProfile.productionAuthority,false);
  assert.equal(sesliTabEditorHostProfile.playbackOwnedByHost,true);assert.equal(sesliTabEditorHostProfile.editorAdmissionControlsPlayback,false);
});

test('pointer and touch converge on the same semantic score-edit path',()=>{
  const pointer=commitPitch(selectedHost('pointer'),'pointer','rev-pointer');const touch=commitPitch(selectedHost('touch'),'touch','rev-touch');
  assert.equal(pointer.ok,true);assert.equal(touch.ok,true);
  const pointerEvent=pointer.host.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events[0];const touchEvent=touch.host.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events[0];
  assert.deepEqual(pointerEvent.note.pitch,touchEvent.note.pitch);assert.equal(pointer.host.lastInputMode,'pointer');assert.equal(touch.host.lastInputMode,'touch');
  assert.equal(pointer.host.session.selection,null);assert.equal(touch.host.session.selection,null);
});

test('history stays inside the same session and rejected operations return typed host errors',()=>{
  const committed=commitPitch(selectedHost('keyboard'),'keyboard','rev-2');assert.equal(committed.ok,true);
  const undone=navigateSesliTabHistory(committed.host,'UNDO','keyboard');assert.equal(undone.ok,true);assert.equal(undone.host.session.history.present.score.revision.id,'rev-1');
  const rejected=commitSesliTabScoreIntent(undone.host,{version:'1.0.0',type:'SET_PITCH',pitch:{step:'E',alter:0,octave:4}},{transactionId:'tx-reject',commandId:'cmd-reject',nextRevisionId:'rev-3'},'touch');
  assert.equal(rejected.ok,false);assert.equal(typeof rejected.error.code,'string');assert.ok(rejected.error.message.length>0);
});
