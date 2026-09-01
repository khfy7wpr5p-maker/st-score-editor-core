import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserRuntime } from '../dist/packages/browser-runtime/src/index.js';

const rendererProfile = Object.freeze({
  family:'osmd',
  packageName:'opensheetmusicdisplay',
  packageVersion:'2.1.2',
  license:'BSD-3-Clause'
});

const scoreInput = () => ({
  schemaVersion:'1.0.0',
  id:'doc-browser-notation',
  revision:{id:'rev-source',parentId:null},
  source:{sha256:'c'.repeat(64),format:'canonical',byteLength:128},
  parts:[{
    id:'part-1',name:'Guitar',staves:[{
      id:'staff-1',ordinal:1,measures:[{
        id:'measure-1',ordinal:1,displayNumber:'1',voices:[{
          id:'voice-1',ordinal:1,events:[{
            id:'event-1',kind:'note',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:12},note:{id:'note-1',pitch:{step:'C',alter:1,octave:4}}
          }]
        }]
      }]
    }]
  }]
});

const eventAddress = (score, overrides = {}) => ({
  contractVersion:'1.0.0',
  kind:'event',
  documentId:score.id,
  revisionId:score.revision.id,
  partId:'part-1',
  staffId:'staff-1',
  measureId:'measure-1',
  voiceId:'voice-1',
  eventId:'event-1',
  ...overrides
});

const noteAddress = (score, overrides = {}) => ({
  contractVersion:'1.0.0',
  kind:'note',
  documentId:score.id,
  revisionId:score.revision.id,
  partId:'part-1',
  staffId:'staff-1',
  measureId:'measure-1',
  voiceId:'voice-1',
  eventId:'event-1',
  noteId:'note-1',
  ...overrides
});

const notationInput = (score) => ({
  contractVersion:'1.0.0',
  documentId:score.id,
  revisionId:score.revision.id,
  measures:[],
  events:[{
    target:eventAddress(score),
    notation:{
      dots:1,
      beams:[],
      tuplet:{actualNotes:3,normalNotes:2,marks:[{number:1,type:'start'}]}
    }
  }],
  notes:[{
    target:noteAddress(score),
    notation:{
      accidental:'sharp',
      ties:[{number:1,type:'start'}],
      slurs:[{number:2,type:'start'}]
    }
  }]
});

test('browser runtime exposes the validated non-empty notation constructor',()=>{
  const runtime=createBrowserRuntime();
  const score=runtime.createScoreDocument(scoreInput());
  const notation=runtime.createNotationDocument(score,notationInput(score));

  assert.equal(Object.isFrozen(notation),true);
  assert.equal(notation.documentId,score.id);
  assert.equal(notation.revisionId,score.revision.id);
  assert.deepEqual(notation.events[0].notation,{
    dots:1,
    beams:[],
    tuplet:{actualNotes:3,normalNotes:2,marks:[{number:1,type:'start'}]}
  });
  assert.deepEqual(notation.notes[0].notation,{
    accidental:'sharp',
    ties:[{number:1,type:'start'}],
    slurs:[{number:2,type:'start'}]
  });

  const session=runtime.createEditorSessionWithRendererProfile(score,notation,rendererProfile);
  assert.equal(session.history.present.score.revision.id,'rev-source');
  assert.equal(session.history.present.notation.revisionId,'rev-source');
  assert.equal(session.history.present.notation.events[0].notation.dots,1);
  assert.equal(session.history.present.notation.notes[0].notation.ties[0].type,'start');
  assert.equal(session.renderRequest.renderer.family,'osmd');
  assert.equal(session.renderRequest.renderer.packageVersion,'2.1.2');
});

test('browser notation rehydration rejects stale revision binding',()=>{
  const runtime=createBrowserRuntime();
  const score=runtime.createScoreDocument(scoreInput());
  const input=notationInput(score);
  input.revisionId='rev-stale';
  assert.throws(
    ()=>runtime.createNotationDocument(score,input),
    (error)=>error?.code==='STALE_NOTATION'
  );
});

test('browser notation rehydration rejects stale target addresses',()=>{
  const runtime=createBrowserRuntime();
  const score=runtime.createScoreDocument(scoreInput());
  const input=notationInput(score);
  input.events[0].target=eventAddress(score,{revisionId:'rev-stale'});
  assert.throws(
    ()=>runtime.createNotationDocument(score,input),
    (error)=>error?.code==='STALE_REVISION'
  );
});

test('browser notation rehydration rejects duplicate semantic targets',()=>{
  const runtime=createBrowserRuntime();
  const score=runtime.createScoreDocument(scoreInput());
  const input=notationInput(score);
  input.notes.push({
    target:noteAddress(score),
    notation:{accidental:null,ties:[],slurs:[]}
  });
  assert.throws(
    ()=>runtime.createNotationDocument(score,input),
    (error)=>error?.code==='DUPLICATE_TARGET'
  );
});

test('browser notation rehydration rejects target kind mismatch',()=>{
  const runtime=createBrowserRuntime();
  const score=runtime.createScoreDocument(scoreInput());
  const input=notationInput(score);
  input.notes[0].target=eventAddress(score);
  assert.throws(
    ()=>runtime.createNotationDocument(score,input),
    (error)=>error?.code==='TARGET_KIND_MISMATCH'
  );
});
