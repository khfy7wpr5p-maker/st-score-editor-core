import test from 'node:test';
import assert from 'node:assert/strict';

import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { emptyNotationDocument } from '../dist/packages/notation-structure/src/index.js';
import { RendererContractError, createRendererRequest, resolveRenderToken } from '../dist/packages/renderer-contract/src/index.js';

const score = createScoreDocument({
  schemaVersion:'1.0.0',id:'doc-sec',revision:{id:'rev-sec',parentId:null},source:{sha256:'b'.repeat(64),format:'canonical',byteLength:null},
  parts:[{id:'part-sec',name:'Security',staves:[{id:'staff-sec',ordinal:1,measures:[{id:'measure-sec',ordinal:1,displayNumber:'1',voices:[{id:'voice-sec',ordinal:1,events:[
    {id:'event-sec-1',kind:'note',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:4},note:{id:'note-sec-1',pitch:{step:'C',alter:0,octave:4}}},
    {id:'event-sec-2',kind:'note',onset:{numerator:1,denominator:4},duration:{numerator:1,denominator:4},note:{id:'note-sec-2',pitch:{step:'D',alter:0,octave:4}}}
  ]}]}]}]}]
});

test('browser cannot remap an opaque render token to another valid semantic target', () => {
  const request=createRendererRequest(score,emptyNotationDocument(score),'osmd');
  const first=request.manifest.entries.find((entry)=>entry.address.kind==='note'&&entry.address.noteId==='note-sec-1');
  const second=request.manifest.entries.find((entry)=>entry.address.kind==='note'&&entry.address.noteId==='note-sec-2');
  assert.ok(first&&second);
  const forged={
    ...request,
    manifest:{...request.manifest,entries:request.manifest.entries.map((entry)=>entry.token===first.token?{token:entry.token,address:second.address}:entry)}
  };
  assert.throws(
    ()=>resolveRenderToken(score,forged,first.token),
    (error)=>error instanceof RendererContractError&&error.code==='RENDER_TOKEN_PATH_MISMATCH'
  );
});

test('browser cannot add coordinate fields to the renderer request envelope', () => {
  const request=createRendererRequest(score,emptyNotationDocument(score),'osmd');
  const token=request.manifest.entries[0].token;
  const forged={...request,x:99,y:101};
  assert.throws(
    ()=>resolveRenderToken(score,forged,token),
    (error)=>error instanceof RendererContractError&&error.code==='INVALID_RENDER_REQUEST'
  );
});
