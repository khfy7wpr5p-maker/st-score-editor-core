import test from 'node:test';
import assert from 'node:assert/strict';
import { addressEntityV2 } from '../dist/packages/addressing-v2/src/index.js';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV2 } from '../dist/packages/score-model-v2/src/index.js';
import { createNotationDocumentV2 } from '../dist/packages/notation-structure-v2/src/index.js';
import { migrateScoreNotationV2ToV3 } from '../dist/packages/schema-migration-v2-v3/src/index.js';
import { migrateNotationV3ToV4 } from '../dist/packages/schema-migration-v3-v4/src/index.js';
import { executeCrossStaffAuthoringV4 } from '../dist/packages/editor-cross-staff-authoring-v4/src/index.js';
import { createRendererRequestV4, RendererContractV4Error } from '../dist/packages/renderer-contract-v4/src/index.js';
import {
  createExternalRendererHitV4,
  resolveExternalRendererHitV4,
  EditorRendererSelectionBridgeV4Error
} from '../dist/packages/editor-renderer-selection-bridge-v4/src/index.js';
import {
  createRendererHitEnabledStandaloneScoreEditorController,
  RendererSemanticHitBridgeControllerError
} from '../dist/packages/score-editor-browser-app/src/renderer-hit-enabled.js';

const idFactory = () => { let index = 0; return () => `hit-${++index}`; };
const memoryStore = () => {
  const values = new Map();
  return Object.freeze({
    put: async record => { values.set(record.documentId, structuredClone(record)); },
    list: async () => [...values.values()].map(value => structuredClone(value)),
    delete: async documentId => { values.delete(documentId); },
    clear: async () => { values.clear(); }
  });
};
const host = () => ({
  packageName: 'opensheetmusicdisplay', packageVersion: '2.1.1', license: 'BSD-3-Clause',
  instance: { async load() {}, render() {}, clear() {} }
});
const controller = () => createRendererHitEnabledStandaloneScoreEditorController({
  store: memoryStore(), autosaveDelayMs: 60_000, sha256Hex: async () => 'a'.repeat(64)
});
const currentEventHit = value => {
  const document = value.getDocument(); assert.ok(document);
  const score = document.session.history.present.score;
  const staff = score.parts[0]?.staves[0]; assert.ok(staff && staff.role !== 'tablature-linked');
  const event = staff.measures[0]?.voices[0]?.events[0]; assert.ok(event);
  const entry = document.session.renderRequest.manifest.entries.find(item => item.address.kind === 'event' && item.address.eventId === event.id);
  assert.ok(entry);
  return { hit: createExternalRendererHitV4(document.session.renderRequest, entry.token), eventId: event.id };
};
const renamePart = (value, revisionId) => {
  const document = value.getDocument(); assert.ok(document);
  const score = document.session.history.present.score;
  const part = score.parts[0]; assert.ok(part);
  const result = value.commitTopology({ version:'1.0.0', type:'RENAME_PART_OR_INSTRUMENT', target:addressEntityV3(score,part.id), partName:'Changed Piano', instrumentName:'Changed Piano', instrumentShortName:'Pno.' }, { nextRevisionId: revisionId });
  assert.equal(result.error, null);
};

test('APP-06B valid opaque renderer hit changes selection only and keypad edit creates one V4 history revision', async () => {
  const value = controller();
  value.newDocument({ idFactory: idFactory() });
  value.attachOsmdRenderer(host());
  await value.renderCurrent();
  const { hit, eventId } = currentEventHit(value);
  const before = value.getDocument(); assert.ok(before);
  const beforePair = structuredClone(before.session.history.present);
  const selected = value.selectRendererHit(hit);
  assert.equal(selected.error, null);
  const afterHit = value.getDocument(); assert.ok(afterHit);
  assert.equal(afterHit.session.selection?.kind, 'event');
  assert.equal(afterHit.session.selection?.eventId, eventId);
  assert.equal(afterHit.session.history.present.score.revision.id, before.session.history.present.score.revision.id);
  assert.equal(afterHit.session.history.past.length, before.session.history.past.length);
  assert.deepEqual(afterHit.session.history.present, beforePair);
  const edited = value.commitKeypad({ version:'1.0.0', actionId:'duration.quarter' }, null, { nextRevisionId:'rev:app06b-edit1' });
  assert.equal(edited.error, null);
  const afterEdit = value.getDocument(); assert.ok(afterEdit);
  assert.equal(afterEdit.session.history.present.score.revision.id, 'rev:app06b-edit1');
  assert.equal(afterEdit.session.history.past.length, before.session.history.past.length + 1);
  assert.equal(afterEdit.session.history.present.score.revision.parentId, before.session.history.present.score.revision.id);
  value.unmount();
});

test('APP-06B stale revision rejects old hit and leaves the post-edit selection unchanged', async () => {
  const value = controller();
  value.newDocument({ idFactory: idFactory() }); value.attachOsmdRenderer(host()); await value.renderCurrent();
  const { hit } = currentEventHit(value);
  renamePart(value, 'rev:app06b-stale');
  const beforeSelection = structuredClone(value.getDocument()?.session.selection ?? null);
  assert.throws(() => value.selectRendererHit(hit), error => error instanceof RendererSemanticHitBridgeControllerError && error.code === 'NO_CURRENT_RENDER_PRESENTATION');
  assert.deepEqual(value.getDocument()?.session.selection ?? null, beforeSelection);
  value.unmount();
});

test('APP-06B unknown token, family mismatch, contract mismatch and coordinate/DOM injection fail closed', async () => {
  const value = controller();
  value.newDocument({ idFactory: idFactory() }); value.attachOsmdRenderer(host()); await value.renderCurrent();
  const { hit } = currentEventHit(value);
  const initialSelection = value.getDocument()?.session.selection ?? null;
  assert.throws(() => value.selectRendererHit({ ...hit, opaqueHitToken:'stse-r4-does-not-exist' }), error => error instanceof RendererContractV4Error && error.code === 'UNKNOWN_RENDER_TOKEN');
  assert.throws(() => value.selectRendererHit({ ...hit, rendererFamily:'alphatab' }), error => error instanceof EditorRendererSelectionBridgeV4Error && error.code === 'RENDERER_FAMILY_MISMATCH');
  assert.throws(() => value.selectRendererHit({ ...hit, renderManifestVersion:'3.0.0' }), error => error instanceof EditorRendererSelectionBridgeV4Error && error.code === 'RENDER_CONTRACT_MISMATCH');
  assert.throws(() => value.selectRendererHit({ ...hit, x:12, y:34, domId:'note-1', svgPath:'M0 0' }), error => error instanceof EditorRendererSelectionBridgeV4Error && error.code === 'INVALID_EXTERNAL_HIT');
  assert.deepEqual(value.getDocument()?.session.selection ?? null, initialSelection);
  value.unmount();
});

test('APP-06B cross-staff manifest token resolves to original source staff identity', () => {
  const raw = {
    schemaVersion:'2.0.0', id:'doc-cross-hit', revision:{id:'rev-1',parentId:null}, source:{sha256:'f'.repeat(64),format:'synthetic',byteLength:null},
    parts:[{ id:'part-1', name:'Piano', staves:[
      { id:'staff-1', ordinal:1, measures:[{id:'m1',ordinal:1,displayNumber:'1',voices:[{id:'v1',ordinal:1,events:[{id:'e1',kind:'note',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:4},note:{id:'n1',pitch:{step:'C',alter:0,octave:4}}}],graceGroups:[]}]}]},
      { id:'staff-2', ordinal:2, measures:[{id:'m2',ordinal:1,displayNumber:'1',voices:[{id:'v2',ordinal:1,events:[{id:'r1',kind:'rest',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:1}}],graceGroups:[]}]}]}
    ]}]
  };
  const scoreV2 = createScoreDocumentV2(raw);
  const notationV2 = createNotationDocumentV2(scoreV2,{contractVersion:'2.0.0',documentId:scoreV2.id,revisionId:scoreV2.revision.id,measures:[{target:addressEntityV2(scoreV2,'m1'),notation:{timeSignature:{beats:4,beatType:4},keySignature:null,clef:null,barlines:[]}}],events:[],notes:[],graceEvents:[],graceNotes:[]});
  const v3 = migrateScoreNotationV2ToV3(scoreV2,notationV2);
  const placed = executeCrossStaffAuthoringV4(v3.score,migrateNotationV3ToV4(v3.score,v3.notation),{version:'1.0.0',type:'SET_CROSS_STAFF_PLACEMENT',target:addressEntityV3(v3.score,'e1'),displayStaffId:'staff-2'},{nextRevisionId:'rev-2'});
  const request = createRendererRequestV4(placed.score,placed.notation);
  assert.equal(request.projectionStatus,'CROSS_STAFF_XML_PENDING');
  const entry = request.manifest.entries.find(item => item.address.kind === 'event' && item.address.eventId === 'e1'); assert.ok(entry);
  const resolved = resolveExternalRendererHitV4(placed.score,request,createExternalRendererHitV4(request,entry.token));
  assert.equal(resolved.kind,'event');
  assert.equal(resolved.staffId,'staff-1');
  assert.equal(resolved.eventId,'e1');
});
