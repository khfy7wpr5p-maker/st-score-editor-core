import test from 'node:test';
import assert from 'node:assert/strict';
import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { emptyNotationDocument } from '../dist/packages/notation-structure/src/index.js';
import { createRendererRequest, RendererContractError } from '../dist/packages/renderer-contract/src/index.js';
import { selectRenderToken } from '../dist/packages/editor-selection/src/index.js';

const makeScore = (revisionId='rev-1') => createScoreDocument({
  schemaVersion:'1.0.0', id:'doc-1', revision:{id:revisionId,parentId:revisionId==='rev-1'?null:'rev-1'}, source:{sha256:'a'.repeat(64),format:'canonical',byteLength:null},
  parts:[{id:'part-1',name:'Piano',staves:[{id:'staff-1',ordinal:1,measures:[{id:'measure-1',ordinal:1,displayNumber:'1',voices:[{id:'voice-1',ordinal:1,events:[{id:'event-1',kind:'note',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:4},note:{id:'note-1',pitch:{step:'C',alter:1,octave:4}}}]}]}]}]}]
});

test('render token resolves to immutable semantic selection and inspector', () => {
  const score=makeScore();
  const request=createRendererRequest(score,emptyNotationDocument(score),'osmd');
  const entry=request.manifest.entries.find((item)=>item.address.kind==='note');
  assert.ok(entry);
  const result=selectRenderToken(score,request,entry.token);
  assert.equal(result.selection.primary.kind,'note');
  assert.equal(result.selection.primary.noteId,'note-1');
  assert.equal(result.inspector.targetKind,'note');
  assert.equal(result.inspector.fields.find((field)=>field.key==='pitch').value,'C+14');
  assert.equal(result.inspector.fields.find((field)=>field.key==='duration').value,'1/4');
  assert.equal(Object.isFrozen(result),true);
  assert.equal(Object.isFrozen(result.inspector.fields),true);
});

test('stale render request cannot select a target in a newer revision', () => {
  const oldScore=makeScore('rev-1');
  const request=createRendererRequest(oldScore,emptyNotationDocument(oldScore),'osmd');
  const token=request.manifest.entries.find((item)=>item.address.kind==='note').token;
  const newScore=makeScore('rev-2');
  assert.throws(() => selectRenderToken(newScore,request,token), (error) => error instanceof RendererContractError && error.code==='STALE_RENDER_REQUEST');
});

test('selection API accepts an opaque token, not coordinates or DOM metadata', () => {
  const score=makeScore();
  const request=createRendererRequest(score,emptyNotationDocument(score),'osmd');
  assert.throws(() => selectRenderToken(score,request,'x=100;y=200;dom=note-1'), (error) => error instanceof RendererContractError && error.code==='UNKNOWN_RENDER_TOKEN');
});
