import test from 'node:test';
import assert from 'node:assert/strict';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import {
  createNewScoreEditorAppDocument,
  markScoreEditorAppDocumentSaved,
  commitAppBasicAuthoringIntent,
  commitAppTopologyIntent,
  commitAppCrossStaffIntent,
  navigateAppDocumentHistory
} from '../dist/packages/score-editor-app-document/src/index.js';
import { BasicAuthoringV4Error } from '../dist/packages/editor-basic-authoring-v4/src/index.js';

const idFactory=()=>{let i=0;return()=>`basic-id-${++i}`;};
const pitch=(step,octave=4)=>({step,alter:0,octave});
const firstContent=(document)=>{
  const score=document.session.history.present.score;
  const staff=score.parts[0].staves.find(item=>item.role!=='tablature-linked');
  const measure=staff.measures[0];const voice=measure.voices[0];return {score,staff,measure,voice,event:voice.events[0]};
};
const plans=(score,prefix)=>score.measureFrames.map((frame,index)=>({frameId:frame.id,measureId:`${prefix}-m${index}`,voiceId:`${prefix}-v${index}`,restEventId:`${prefix}-r${index}`}));

test('APP-02A rest -> note -> pitch/duration -> chord -> tone remove stays in one V4 history',()=>{
  let document=createNewScoreEditorAppDocument({idFactory:idFactory()});document=markScoreEditorAppDocumentSaved(document);
  let current=firstContent(document);const restId=current.event.id;
  document=commitAppBasicAuthoringIntent(document,{version:'1.0.0',type:'REPLACE_REST_WITH_NOTE',target:addressEntityV3(current.score,restId),noteId:'note-a',pitch:pitch('C')},{nextRevisionId:'rev-basic-1'});
  assert.equal(document.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events[0].kind,'note');assert.equal(document.session.selection.kind,'note');assert.equal(document.session.selection.noteId,'note-a');assert.equal(document.dirty,true);
  current=firstContent(document);
  document=commitAppBasicAuthoringIntent(document,{version:'1.0.0',type:'SET_NOTE_PITCH',target:addressEntityV3(current.score,'note-a'),pitch:pitch('D')},{nextRevisionId:'rev-basic-2'});
  current=firstContent(document);
  document=commitAppBasicAuthoringIntent(document,{version:'1.0.0',type:'SET_EVENT_DURATION',target:addressEntityV3(current.score,restId),duration:{numerator:1,denominator:2}},{nextRevisionId:'rev-basic-3'});
  current=firstContent(document);
  document=commitAppBasicAuthoringIntent(document,{version:'1.0.0',type:'ADD_CHORD_TONE',target:addressEntityV3(current.score,restId),noteId:'note-b',pitch:pitch('F')},{nextRevisionId:'rev-basic-4'});
  current=firstContent(document);assert.equal(current.event.kind,'chord');assert.deepEqual(current.event.notes.map(n=>[n.id,n.pitch.step]),[['note-a','D'],['note-b','F']]);assert.deepEqual(current.event.duration,{numerator:1,denominator:2});
  document=commitAppBasicAuthoringIntent(document,{version:'1.0.0',type:'REMOVE_CHORD_TONE',target:addressEntityV3(current.score,'note-b')},{nextRevisionId:'rev-basic-5'});
  current=firstContent(document);assert.equal(current.event.kind,'note');assert.equal(current.event.note.id,'note-a');assert.equal(document.session.history.past.length,5);
  document=navigateAppDocumentHistory(document,'UNDO');assert.equal(firstContent(document).event.kind,'chord');assert.equal(document.session.history.present.score.revision.id,'rev-basic-4');
});

test('APP-02A stale target and duplicate note identity fail closed',()=>{
  let document=createNewScoreEditorAppDocument({idFactory:idFactory()});const current=firstContent(document);const stale=addressEntityV3(current.score,current.event.id);
  document=commitAppBasicAuthoringIntent(document,{version:'1.0.0',type:'REPLACE_REST_WITH_NOTE',target:stale,noteId:'fresh-note',pitch:pitch('E')},{nextRevisionId:'rev-stale-1'});
  assert.throws(()=>commitAppBasicAuthoringIntent(document,{version:'1.0.0',type:'SET_EVENT_DURATION',target:stale,duration:{numerator:1,denominator:2}},{nextRevisionId:'rev-stale-2'}),e=>e instanceof BasicAuthoringV4Error&&e.code==='STALE_TARGET');
  const after=firstContent(document);assert.throws(()=>commitAppBasicAuthoringIntent(document,{version:'1.0.0',type:'ADD_CHORD_TONE',target:addressEntityV3(after.score,after.event.id),noteId:'fresh-note',pitch:pitch('G')},{nextRevisionId:'rev-stale-3'}),e=>e instanceof BasicAuthoringV4Error&&e.code==='IDENTITY_COLLISION');
});

test('APP-02A does not silently destroy cross-staff placement when pitched event becomes rest',()=>{
  let document=createNewScoreEditorAppDocument({idFactory:idFactory()});let current=firstContent(document);
  document=commitAppTopologyIntent(document,{version:'1.0.0',type:'ADD_STANDARD_OR_PERCUSSION_STAFF',target:addressEntityV3(current.score,current.score.parts[0].id),index:1,staffId:'staff-display',staffRole:'standard',frameRestIds:plans(current.score,'display')},{nextRevisionId:'rev-cross-1'});
  current=firstContent(document);document=commitAppBasicAuthoringIntent(document,{version:'1.0.0',type:'REPLACE_REST_WITH_NOTE',target:addressEntityV3(current.score,current.event.id),noteId:'cross-note',pitch:pitch('A')},{nextRevisionId:'rev-cross-2'});
  current=firstContent(document);document=commitAppCrossStaffIntent(document,{version:'1.0.0',type:'SET_CROSS_STAFF_PLACEMENT',target:addressEntityV3(current.score,current.event.id),displayStaffId:'staff-display'},{nextRevisionId:'rev-cross-3'});
  current=firstContent(document);assert.equal(document.session.history.present.notation.crossStaffPlacements.length,1);
  assert.throws(()=>commitAppBasicAuthoringIntent(document,{version:'1.0.0',type:'REPLACE_PITCHED_EVENT_WITH_REST',target:addressEntityV3(current.score,current.event.id)},{nextRevisionId:'rev-cross-4'}),e=>e instanceof BasicAuthoringV4Error&&e.code==='CROSS_STAFF_CONFLICT');
  assert.equal(document.session.history.present.score.revision.id,'rev-cross-3');assert.equal(document.session.history.present.notation.crossStaffPlacements.length,1);
});
