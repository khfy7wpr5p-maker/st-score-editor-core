import test from 'node:test';
import assert from 'node:assert/strict';

import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { addressEntity, createSelectionSnapshot } from '../dist/packages/addressing/src/index.js';
import { emptyNotationDocument, notationForEvent, notationForNote } from '../dist/packages/notation-structure/src/index.js';
import { serializeNotationMusicXml } from '../dist/packages/musicxml/src/index.js';
import { executeAdvancedEditorKeypadAction } from '../dist/packages/editor-keypad-advanced/src/index.js';
import { createEditorSession, selectSessionRenderToken, commitSessionKeypadAction } from '../dist/packages/editor-session-controller/src/index.js';
import { createBrowserRuntime } from '../dist/packages/browser-runtime/src/index.js';

const action=(actionId)=>({version:'1.0.0',actionId});
const identity=(transactionId,nextRevisionId)=>({version:'1.0.0',transactionId,nextRevisionId});
const eventRange=(score,...ids)=>({version:'1.0.0',kind:'EVENT_RANGE',targets:ids.map((id)=>addressEntity(score,id))});
const notePair=(score,start,stop)=>({version:'1.0.0',kind:'NOTE_PAIR',start:addressEntity(score,start),stop:addressEntity(score,stop)});

const tripletScore=(duration={numerator:1,denominator:12})=>createScoreDocument({
  schemaVersion:'1.0.0',id:'doc-triplet',revision:{id:'rev-1',parentId:null},source:{sha256:'e'.repeat(64),format:'synthetic',byteLength:null},
  parts:[{id:'part-1',name:'Part',staves:[{id:'staff-1',ordinal:1,measures:[{id:'measure-1',ordinal:1,displayNumber:'1',voices:[{id:'voice-1',ordinal:1,events:[
    {id:'event-1',kind:'note',onset:{numerator:0,denominator:1},duration,note:{id:'note-1',pitch:{step:'C',alter:0,octave:4}}},
    {id:'event-2',kind:'note',onset:duration,duration,note:{id:'note-2',pitch:{step:'D',alter:0,octave:4}}},
    {id:'event-3',kind:'note',onset:{numerator:duration.numerator*2,denominator:duration.denominator},duration,note:{id:'note-3',pitch:{step:'E',alter:0,octave:4}}}
  ]}]}]}]}]
});

const connectionScore=()=>createScoreDocument({
  schemaVersion:'1.0.0',id:'doc-connections',revision:{id:'rev-1',parentId:null},source:{sha256:'f'.repeat(64),format:'synthetic',byteLength:null},
  parts:[{id:'part-1',name:'Part',staves:[{id:'staff-1',ordinal:1,measures:[{id:'measure-1',ordinal:1,displayNumber:'1',voices:[{id:'voice-1',ordinal:1,events:[
    {id:'event-1',kind:'note',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:4},note:{id:'note-1',pitch:{step:'C',alter:0,octave:4}}},
    {id:'event-2',kind:'note',onset:{numerator:1,denominator:4},duration:{numerator:1,denominator:4},note:{id:'note-2',pitch:{step:'C',alter:0,octave:4}}},
    {id:'event-3',kind:'note',onset:{numerator:1,denominator:2},duration:{numerator:1,denominator:4},note:{id:'note-3',pitch:{step:'E',alter:0,octave:4}}}
  ]}]}]}]}]
});

const selectNote=(score,noteId)=>createSelectionSnapshot(score,addressEntity(score,noteId));
const noteToken=(session,noteId)=>session.renderRequest.manifest.entries.find((entry)=>entry.address.kind==='note'&&entry.address.noteId===noteId)?.token;

test('SEC-KP-05 adds triplet metadata only to an explicit exact 3:2 canonical range',()=>{
  const score=tripletScore();
  const notation=emptyNotationDocument(score);
  const selection=selectNote(score,'note-1');
  const result=executeAdvancedEditorKeypadAction(
    score,notation,selection,action('tuplet.triplet'),identity('triplet-create','rev-triplet'),eventRange(score,'event-1','event-2','event-3')
  );
  assert.equal(result.score.revision.id,'rev-triplet');
  assert.equal(result.notation.revisionId,'rev-triplet');
  assert.deepEqual(notationForEvent(result.notation,'event-1')?.tuplet,{actualNotes:3,normalNotes:2,marks:[{number:1,type:'start'}]});
  assert.deepEqual(notationForEvent(result.notation,'event-2')?.tuplet,{actualNotes:3,normalNotes:2,marks:[]});
  assert.deepEqual(notationForEvent(result.notation,'event-3')?.tuplet,{actualNotes:3,normalNotes:2,marks:[{number:1,type:'stop'}]});
  const xml=serializeNotationMusicXml(result.score,result.notation);
  assert.equal((xml.match(/<time-modification>/g)??[]).length,3);
  assert.ok(xml.includes('<actual-notes>3</actual-notes>'));
  assert.ok(xml.includes('<normal-notes>2</normal-notes>'));
  assert.ok(xml.includes('<tuplet type="start" number="1"/>'));
  assert.ok(xml.includes('<tuplet type="stop" number="1"/>'));
});

test('SEC-KP-05 refuses to retime ordinary events because onset mutation is not an admitted primitive',()=>{
  const score=tripletScore({numerator:1,denominator:8});
  const notation=emptyNotationDocument(score);
  const selection=selectNote(score,'note-1');
  assert.throws(()=>executeAdvancedEditorKeypadAction(
    score,notation,selection,action('tuplet.triplet'),identity('triplet-reject','rev-reject'),eventRange(score,'event-1','event-2','event-3')
  ),(error)=>error?.code==='TUPLET_TIMING_INCONSISTENT');
  assert.equal(score.revision.id,'rev-1');
  assert.equal(notation.revisionId,'rev-1');
});

test('SEC-KP-05 refuses non-consecutive or reordered explicit ranges instead of inferring nearest events',()=>{
  const score=tripletScore();
  const notation=emptyNotationDocument(score);
  const selection=selectNote(score,'note-1');
  assert.throws(()=>executeAdvancedEditorKeypadAction(
    score,notation,selection,action('tuplet.triplet'),identity('triplet-order','rev-order'),eventRange(score,'event-1','event-3','event-2')
  ),(error)=>error?.code==='RANGE_NOT_EXACT');
});

test('SEC-KP-06 tie.edit atomically creates then removes one explicit exact-pitch consecutive relation',()=>{
  const score=connectionScore();
  let session=createEditorSession(score,emptyNotationDocument(score),'osmd');
  const token=noteToken(session,'note-1');assert.ok(token);
  session=selectSessionRenderToken(session,token);
  session=commitSessionKeypadAction(session,action('tie.edit'),identity('tie-create','rev-tie'),notePair(score,'note-1','note-2'));
  assert.equal(session.history.present.score.revision.id,'rev-tie');
  assert.deepEqual(notationForNote(session.history.present.notation,'note-1')?.ties,[{number:1,type:'start'}]);
  assert.deepEqual(notationForNote(session.history.present.notation,'note-2')?.ties,[{number:1,type:'stop'}]);
  assert.equal(session.selection.primary.noteId,'note-1');
  assert.equal(session.selection.primary.revisionId,'rev-tie');
  let xml=serializeNotationMusicXml(session.history.present.score,session.history.present.notation);
  assert.ok(xml.includes('<tie type="start"/>'));
  assert.ok(xml.includes('<tied type="start" number="1"/>'));

  const current=session.history.present.score;
  session=commitSessionKeypadAction(session,action('tie.edit'),identity('tie-remove','rev-tie-removed'),notePair(current,'note-1','note-2'));
  assert.deepEqual(notationForNote(session.history.present.notation,'note-1')?.ties,[]);
  assert.deepEqual(notationForNote(session.history.present.notation,'note-2')?.ties,[]);
  xml=serializeNotationMusicXml(session.history.present.score,session.history.present.notation);
  assert.equal(xml.includes('<tie type="start"/>'),false);
});

test('SEC-KP-06 tie.edit rejects a non-consecutive explicit target instead of retargeting to the nearest matching note',()=>{
  const score=connectionScore();
  const notation=emptyNotationDocument(score);
  const selection=selectNote(score,'note-1');
  assert.throws(()=>executeAdvancedEditorKeypadAction(
    score,notation,selection,action('tie.edit'),identity('tie-far','rev-far'),notePair(score,'note-1','note-3')
  ),(error)=>error?.code==='RELATION_ENDPOINT_INVALID');
});

test('SEC-KP-06 slur.edit uses the explicit forward endpoint and supports exact-pair removal',()=>{
  const score=connectionScore();
  let session=createEditorSession(score,emptyNotationDocument(score),'osmd');
  const token=noteToken(session,'note-1');assert.ok(token);
  session=selectSessionRenderToken(session,token);
  session=commitSessionKeypadAction(session,action('slur.edit'),identity('slur-create','rev-slur'),notePair(score,'note-1','note-3'));
  assert.deepEqual(notationForNote(session.history.present.notation,'note-1')?.slurs,[{number:1,type:'start'}]);
  assert.deepEqual(notationForNote(session.history.present.notation,'note-3')?.slurs,[{number:1,type:'stop'}]);
  assert.equal(notationForNote(session.history.present.notation,'note-2'),null);
  const current=session.history.present.score;
  session=commitSessionKeypadAction(session,action('slur.edit'),identity('slur-remove','rev-slur-removed'),notePair(current,'note-1','note-3'));
  assert.deepEqual(notationForNote(session.history.present.notation,'note-1')?.slurs,[]);
  assert.deepEqual(notationForNote(session.history.present.notation,'note-3')?.slurs,[]);
});

test('advanced browser action requires an explicit revision-bound target and leaves input session unchanged on failure',()=>{
  const runtime=createBrowserRuntime();
  const score=connectionScore();
  let session=runtime.createEditorSession(score,runtime.emptyNotationDocument(score),'osmd');
  const token=noteToken(session,'note-1');assert.ok(token);
  session=runtime.selectSessionRenderToken(session,token);
  const result=runtime.commitKeypadAction(session,action('tie.edit'),identity('tie-no-target','rev-no-target'));
  assert.equal(result.ok,false);
  assert.equal(result.error.code,'EXPLICIT_TARGET_REQUIRED');
  assert.equal(session.history.present.score.revision.id,'rev-1');
  assert.equal(session.selection.primary.noteId,'note-1');
});
