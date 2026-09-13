import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import {
  canonicalPitchToMidiV1,
  createEditorAuditionRequestV1
} from '../dist/packages/editor-audition-v1/src/index.js';

const score = (revisionId = 'rev-audio-1') => createScoreDocumentV3({
  schemaVersion:'3.0.0',
  id:'doc-audio',
  revision:{id:revisionId,parentId:null},
  source:{sha256:'a'.repeat(64),format:'synthetic',byteLength:null},
  measureFrames:[{id:'frame-1',ordinal:1,displayNumber:'1'}],
  parts:[{
    id:'part-1',ordinal:1,name:'Piano',instrument:{id:'instrument-1',name:'Piano',shortName:'Pno.'},
    staves:[{
      id:'staff-1',ordinal:1,role:'standard',
      measures:[{
        id:'measure-1',frameId:'frame-1',
        voices:[{
          id:'voice-1',ordinal:1,graceGroups:[],events:[
            {id:'event-note',kind:'note',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:4},note:{id:'note-1',pitch:{step:'C',alter:1,octave:4}}},
            {id:'event-rest',kind:'rest',onset:{numerator:1,denominator:4},duration:{numerator:3,denominator:4}}
          ]
        }]
      }]
    }]
  }]
});

test('AUDIO-01C canonical pitch conversion is exact and bounded', () => {
  assert.equal(canonicalPitchToMidiV1({step:'C',alter:0,octave:4}),60);
  assert.equal(canonicalPitchToMidiV1({step:'C',alter:1,octave:4}),61);
  assert.equal(canonicalPitchToMidiV1({step:'B',alter:-1,octave:3}),58);
});

test('AUDIO-01C NOTE produces an immutable request from current canonical ScoreDocumentV3 state', () => {
  const value=score();
  const before=structuredClone(value);
  const address=addressEntityV3(value,'note-1');
  const request=createEditorAuditionRequestV1(value,address,{requestId:'audition-1',instrumentId:'GRAND_PIANO',durationMs:350});
  assert.ok(request);
  assert.equal(request.pitch.midi,61);
  assert.equal(request.sourceRevisionId,'rev-audio-1');
  assert.equal(request.sourceEventId,'event-note');
  assert.equal(request.instrumentId,'GRAND_PIANO');
  assert.equal(Object.isFrozen(request),true);
  assert.equal(Object.isFrozen(request.pitch),true);
  assert.deepEqual(value,before);
});

test('AUDIO-01C REST/event target produces zero audition request', () => {
  const value=score();
  const restEvent=addressEntityV3(value,'event-rest');
  assert.equal(createEditorAuditionRequestV1(value,restEvent,{requestId:'audition-rest',instrumentId:'GRAND_PIANO'}),null);
});

test('AUDIO-01C stale SemanticAddressV3 fails closed before request creation', () => {
  const original=score('rev-old');
  const noteAddress=addressEntityV3(original,'note-1');
  const current=createScoreDocumentV3({...structuredClone(original),revision:{id:'rev-new',parentId:'rev-old'}});
  assert.throws(
    ()=>createEditorAuditionRequestV1(current,noteAddress,{requestId:'audition-stale',instrumentId:'GRAND_PIANO'}),
    error=>error?.code==='STALE_REVISION'
  );
});

test('AUDIO-01C optional guitar string/fret is copied only from exact host evidence', () => {
  const value=score();
  const noteAddress=addressEntityV3(value,'note-1');
  const pitchOnly=createEditorAuditionRequestV1(value,noteAddress,{requestId:'guitar-1',instrumentId:'CLASSICAL_GUITAR'});
  assert.ok(pitchOnly);
  assert.equal('stringNumber' in pitchOnly,false);
  assert.equal('fret' in pitchOnly,false);
  const exact=createEditorAuditionRequestV1(value,noteAddress,{requestId:'guitar-2',instrumentId:'CLASSICAL_GUITAR',stringNumber:2,fret:1});
  assert.ok(exact);
  assert.equal(exact.stringNumber,2);
  assert.equal(exact.fret,1);
});
