import test from 'node:test';
import assert from 'node:assert/strict';
import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { emptyNotationDocument } from '../dist/packages/notation-structure/src/index.js';
import { createEditorSession, selectSessionRenderToken, commitSessionScoreIntent, commitSessionNotationIntent, navigateSessionHistory } from '../dist/packages/editor-session-controller/src/index.js';

const score=()=>createScoreDocument({
  schemaVersion:'1.0.0',id:'doc-1',revision:{id:'rev-1',parentId:null},source:{sha256:'a'.repeat(64),format:'canonical',byteLength:null},
  parts:[{id:'part-1',name:'Piano',staves:[{id:'staff-1',ordinal:1,measures:[{id:'measure-1',ordinal:1,displayNumber:'1',voices:[{id:'voice-1',ordinal:1,events:[{id:'event-1',kind:'note',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:4},note:{id:'note-1',pitch:{step:'C',alter:0,octave:4}}}]}]}]}]}]
});
const noteToken=(session)=>session.renderRequest.manifest.entries.find((entry)=>entry.address.kind==='note').token;

test('session composes render selection score edit rerender and undo without UI authority',()=>{
  const s=score();let session=createEditorSession(s,emptyNotationDocument(s),'osmd');
  assert.equal(session.renderRequest.revisionId,'rev-1');
  session=selectSessionRenderToken(session,noteToken(session));
  assert.equal(session.selection.primary.noteId,'note-1');
  assert.equal(session.inspector.targetKind,'note');
  session=commitSessionScoreIntent(session,{version:'1.0.0',type:'SET_PITCH',pitch:{step:'D',alter:0,octave:4}},{transactionId:'tx-1',commandId:'cmd-1',nextRevisionId:'rev-2'});
  assert.equal(session.history.present.score.revision.id,'rev-2');
  assert.equal(session.history.present.notation.revisionId,'rev-2');
  assert.equal(session.renderRequest.revisionId,'rev-2');
  assert.equal(session.selection,null);
  assert.equal(session.inspector,null);
  assert.equal(session.history.present.score.parts[0].staves[0].measures[0].voices[0].events[0].note.pitch.step,'D');
  session=navigateSessionHistory(session,'UNDO');
  assert.equal(session.history.present.score.revision.id,'rev-1');
  assert.equal(session.renderRequest.revisionId,'rev-1');
  assert.equal(session.selection,null);
});

test('session composes secure notation intent and regenerates render request',()=>{
  const s=score();let session=createEditorSession(s,emptyNotationDocument(s),'osmd');
  session=selectSessionRenderToken(session,noteToken(session));
  session=commitSessionNotationIntent(session,{version:'1.0.0',type:'SET_ACCIDENTAL',value:'natural'},{transactionId:'ntx-1',commandId:'ncmd-1',nextRevisionId:'rev-notation'});
  assert.equal(session.history.present.score.revision.id,'rev-notation');
  assert.equal(session.history.present.notation.revisionId,'rev-notation');
  assert.equal(session.history.present.notation.notes[0].notation.accidental,'natural');
  assert.ok(session.renderRequest.musicXml.includes('<accidental>natural</accidental>'));
  assert.equal(session.selection,null);
});
