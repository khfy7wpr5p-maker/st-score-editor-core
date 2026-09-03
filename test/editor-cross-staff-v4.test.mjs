import test from 'node:test';
import assert from 'node:assert/strict';
import { createScoreDocumentV2 } from '../dist/packages/score-model-v2/src/index.js';
import { createNotationDocumentV2 } from '../dist/packages/notation-structure-v2/src/index.js';
import { addressEntityV2 } from '../dist/packages/addressing-v2/src/index.js';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { migrateScoreNotationV2ToV3 } from '../dist/packages/schema-migration-v2-v3/src/index.js';
import { createNotationDocumentV4, NotationV4Error } from '../dist/packages/notation-structure-v4/src/index.js';
import { migrateNotationV3ToV4, downgradeNotationV4ToV3, MigrationV3V4Error } from '../dist/packages/schema-migration-v3-v4/src/index.js';
import { executeCrossStaffAuthoringV4 } from '../dist/packages/editor-cross-staff-authoring-v4/src/index.js';
import { executeTopologyAuthoringV4, TopologyAuthoringV4Error } from '../dist/packages/editor-topology-authoring-v4/src/index.js';
import { createRendererRequestV4, renderableMusicXmlV4, RendererContractV4Error } from '../dist/packages/renderer-contract-v4/src/index.js';
import { createEditorSessionV4FromV3, commitSessionCrossStaffIntentV4, navigateSessionHistoryV4 } from '../dist/packages/editor-session-controller-v4/src/index.js';

const note = (eventId, noteId, onset, step) => ({ id:eventId, kind:'note', onset, duration:{numerator:1,denominator:4}, note:{id:noteId,pitch:{step,alter:0,octave:4}} });
const rest = (id) => ({ id, kind:'rest', onset:{numerator:0,denominator:1}, duration:{numerator:1,denominator:2} });
const measure = (id, voiceId, events) => ({ id, ordinal:1, displayNumber:'1', voices:[{id:voiceId,ordinal:1,events,graceGroups:[]}] });
const raw = () => ({
  schemaVersion:'2.0.0', id:'doc-cross-staff', revision:{id:'rev-1',parentId:null}, source:{sha256:'f'.repeat(64),format:'synthetic',byteLength:null},
  parts:[{ id:'part-1', name:'Piano', staves:[
    { id:'staff-1', ordinal:1, measures:[measure('m1s1','voice-1',[note('e1','n1',{numerator:0,denominator:1},'C'),note('e2','n2',{numerator:1,denominator:4},'D')])]},
    { id:'staff-2', ordinal:2, measures:[measure('m1s2','voice-2',[rest('r3')])]} ] }]
});
const eventNotation = (beams) => ({dots:0,beams,tuplet:null,articulations:[],ornaments:[]});
const base = () => {
  const score = createScoreDocumentV2(raw());
  const notation = createNotationDocumentV2(score,{contractVersion:'2.0.0',documentId:score.id,revisionId:score.revision.id,measures:[
    {target:addressEntityV2(score,'m1s1'),notation:{timeSignature:{beats:4,beatType:4},keySignature:null,clef:null,barlines:[]}}
  ],events:[
    {target:addressEntityV2(score,'e1'),notation:eventNotation([{number:1,value:'begin'}])},
    {target:addressEntityV2(score,'e2'),notation:eventNotation([{number:1,value:'end'}])}
  ],notes:[],graceEvents:[],graceNotes:[]});
  return migrateScoreNotationV2ToV3(score,notation);
};

const place = (score, notation, nextRevisionId='rev-2') => executeCrossStaffAuthoringV4(score,notation,{
  version:'1.0.0',type:'SET_CROSS_STAFF_PLACEMENT',target:addressEntityV3(score,'e2'),displayStaffId:'staff-2'
},{nextRevisionId});

test('SSE-10 V3 notation migrates additively to V4 and clean V4 downgrades losslessly',()=>{
  const v3=base();const v4=migrateNotationV3ToV4(v3.score,v3.notation);
  assert.equal(v4.contractVersion,'4.0.0');assert.deepEqual(v4.crossStaffPlacements,[]);
  const back=downgradeNotationV4ToV3(v3.score,v4);assert.deepEqual(back,v3.notation);
});

test('SSE-10 placement changes display staff only and preserves source ownership plus beam semantics',()=>{
  const v3=base();const v4=migrateNotationV3ToV4(v3.score,v3.notation);const result=place(v3.score,v4);
  assert.deepEqual(result.score.parts,v3.score.parts);assert.deepEqual(result.score.source,v3.score.source);
  const source=addressEntityV3(result.score,'e2');assert.equal(source.kind,'event');assert.equal(source.staffId,'staff-1');assert.equal(source.voiceId,'voice-1');
  assert.equal(result.notation.crossStaffPlacements[0].displayStaffId,'staff-2');assert.equal(result.notation.crossStaffPlacements[0].source.staffId,'staff-1');
  assert.deepEqual(result.notation.events.map(entry=>entry.notation.beams),v4.events.map(entry=>entry.notation.beams));
  assert.equal(result.score.revision.parentId,'rev-1');
});

test('SSE-10 V4 validator rejects same-staff and rest placement instead of inferring another target',()=>{
  const v3=base();const v4=migrateNotationV3ToV4(v3.score,v3.notation);
  assert.throws(()=>createNotationDocumentV4(v3.score,{...v4,crossStaffPlacements:[{source:addressEntityV3(v3.score,'e1'),displayStaffId:'staff-1'}]}),e=>e instanceof NotationV4Error&&e.code==='INVALID_CROSS_STAFF_DISPLAY_STAFF');
  assert.throws(()=>createNotationDocumentV4(v3.score,{...v4,crossStaffPlacements:[{source:addressEntityV3(v3.score,'r3'),displayStaffId:'staff-1'}]}),e=>e instanceof NotationV4Error&&e.code==='INVALID_CROSS_STAFF_SOURCE');
});

test('SSE-10 non-empty V4 placement blocks downgrade and MusicXML projection fail-closed',()=>{
  const v3=base();const placed=place(v3.score,migrateNotationV3ToV4(v3.score,v3.notation));
  assert.throws(()=>downgradeNotationV4ToV3(placed.score,placed.notation),e=>e instanceof MigrationV3V4Error&&e.code==='DOWNGRADE_UNREPRESENTABLE');
  const request=createRendererRequestV4(placed.score,placed.notation);assert.equal(request.projectionStatus,'CROSS_STAFF_XML_PENDING');assert.equal(request.musicXml,null);
  assert.throws(()=>renderableMusicXmlV4(request),e=>e instanceof RendererContractV4Error);
});

test('SSE-10 V4-aware topology rejects display-staff removal but preserves placement across reorder',()=>{
  const v3=base();const placed=place(v3.score,migrateNotationV3ToV4(v3.score,v3.notation));
  assert.throws(()=>executeTopologyAuthoringV4(placed.score,placed.notation,{version:'1.0.0',type:'REMOVE_CONTENT_STAFF',target:addressEntityV3(placed.score,'staff-2')},{nextRevisionId:'rev-3'}),e=>e instanceof TopologyAuthoringV4Error&&e.code==='CROSS_STAFF_ORPHAN_RISK');
  const reordered=executeTopologyAuthoringV4(placed.score,placed.notation,{version:'1.0.0',type:'REORDER_STAFF',target:addressEntityV3(placed.score,'staff-2'),toIndex:0},{nextRevisionId:'rev-3'});
  assert.equal(reordered.score.parts[0].staves[0].id,'staff-2');assert.equal(reordered.notation.crossStaffPlacements[0].displayStaffId,'staff-2');assert.equal(reordered.notation.crossStaffPlacements[0].source.staffId,'staff-1');
});

test('SSE-10 V4 session keeps source selection and unified undo restores exact pre-placement pair',()=>{
  const v3=base();let session=createEditorSessionV4FromV3(v3.score,v3.notation);assert.equal(session.renderRequest.projectionStatus,'V3_COMPATIBLE_XML');assert.ok(renderableMusicXmlV4(session.renderRequest).includes('<score-partwise'));
  session=commitSessionCrossStaffIntentV4(session,{version:'1.0.0',type:'SET_CROSS_STAFF_PLACEMENT',target:addressEntityV3(v3.score,'e2'),displayStaffId:'staff-2'},{nextRevisionId:'rev-2'});
  assert.equal(session.selection.kind,'event');assert.equal(session.selection.staffId,'staff-1');assert.equal(session.history.present.notation.crossStaffPlacements.length,1);assert.equal(session.renderRequest.projectionStatus,'CROSS_STAFF_XML_PENDING');
  session=navigateSessionHistoryV4(session,'UNDO');assert.equal(session.history.present.score.revision.id,'rev-1');assert.deepEqual(session.history.present.notation.crossStaffPlacements,[]);assert.equal(session.selection,null);
});
