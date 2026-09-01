import test from 'node:test';
import assert from 'node:assert/strict';

import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { emptyNotationDocument } from '../dist/packages/notation-structure/src/index.js';
import { createRendererRequest } from '../dist/packages/renderer-contract/src/index.js';
import {
  EditorRendererSelectionBridgeError,
  createExternalRendererHit,
  parseExternalRendererHit,
  resolveExternalRendererHit
} from '../dist/packages/editor-renderer-selection-bridge/src/index.js';

const score=()=>createScoreDocument({
  schemaVersion:'1.0.0',id:'doc-bridge',revision:{id:'rev-1',parentId:null},source:{sha256:'9'.repeat(64),format:'synthetic',byteLength:null},
  parts:[{id:'part-1',name:'Part',staves:[{id:'staff-1',ordinal:1,measures:[{id:'measure-1',ordinal:1,displayNumber:'1',voices:[{id:'voice-1',ordinal:1,events:[
    {id:'event-1',kind:'note',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:4},note:{id:'note-1',pitch:{step:'C',alter:0,octave:4}}}
  ]}]}]}]}]
});

const requestFor=(s)=>createRendererRequest(s,emptyNotationDocument(s),'osmd');
const noteToken=(request)=>request.manifest.entries.find((entry)=>entry.address.kind==='note')?.token;

test('SEC-KP-09 external hit resolves only through the current opaque manifest token into editor-owned selection',()=>{
  const s=score();const request=requestFor(s);const token=noteToken(request);assert.ok(token);
  const hit=createExternalRendererHit(request,token);
  assert.deepEqual(Object.keys(hit).sort(),[
    'contractVersion','documentId','opaqueHitToken','renderManifestVersion','renderRequestVersion','rendererFamily','revisionId'
  ]);
  const result=resolveExternalRendererHit(s,request,hit);
  assert.equal(result.selection.primary.kind,'note');
  assert.equal(result.selection.primary.noteId,'note-1');
  assert.equal(result.selection.primary.revisionId,'rev-1');
  assert.equal(result.inspector.targetId,'note-1');
});

test('SEC-KP-09 coordinates DOM/SVG ids SemanticAddress and ScoreNoteRef-shaped fields are rejected at the bridge boundary',()=>{
  const s=score();const request=requestFor(s);const token=noteToken(request);assert.ok(token);
  const base=createExternalRendererHit(request,token);
  for(const [field,value] of [
    ['x',12],['y',34],['domId','note-node'],['svgId','svg-note'],['semanticAddress',{kind:'note'}],['scoreNoteRef',{measure:1,note:1}]
  ]){
    assert.throws(
      ()=>parseExternalRendererHit({...base,[field]:value}),
      (error)=>error instanceof EditorRendererSelectionBridgeError&&error.code==='INVALID_EXTERNAL_HIT'
    );
  }
});

test('SEC-KP-09 stale hit and renderer-family mismatch fail closed before selection',()=>{
  const s=score();const request=requestFor(s);const token=noteToken(request);assert.ok(token);
  const base=createExternalRendererHit(request,token);
  assert.throws(
    ()=>resolveExternalRendererHit(s,request,{...base,revisionId:'rev-stale'}),
    (error)=>error instanceof EditorRendererSelectionBridgeError&&error.code==='STALE_EXTERNAL_HIT'
  );
  assert.throws(
    ()=>resolveExternalRendererHit(s,request,{...base,rendererFamily:'alphatab'}),
    (error)=>error instanceof EditorRendererSelectionBridgeError&&error.code==='RENDERER_FAMILY_MISMATCH'
  );
});

test('SEC-KP-09 unknown opaque token is rejected by the existing canonical renderer manifest resolver',()=>{
  const s=score();const request=requestFor(s);const token=noteToken(request);assert.ok(token);
  const hit={...createExternalRendererHit(request,token),opaqueHitToken:'stse-r1-does-not-exist'};
  assert.throws(()=>resolveExternalRendererHit(s,request,hit),(error)=>error?.code==='UNKNOWN_RENDER_TOKEN');
});
