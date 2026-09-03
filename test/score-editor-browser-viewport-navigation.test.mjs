import test from 'node:test';
import assert from 'node:assert/strict';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createExternalRendererHitV4 } from '../dist/packages/editor-renderer-selection-bridge-v4/src/index.js';
import {
  createViewportEnabledStandaloneScoreEditorController,
  resolveViewportKeyboardAction,
  VIEWPORT_ZOOM_STEP
} from '../dist/packages/score-editor-browser-app/src/viewport-enabled.js';
import { RendererSemanticHitBridgeControllerError } from '../dist/packages/score-editor-browser-app/src/renderer-hit-enabled.js';

const idFactory = () => { let index = 0; return () => `viewport-${++index}`; };
const memoryStore = () => {
  const values = new Map();
  return Object.freeze({
    put: async record => { values.set(record.documentId, structuredClone(record)); },
    list: async () => [...values.values()].map(value => structuredClone(value)),
    delete: async documentId => { values.delete(documentId); },
    clear: async () => { values.clear(); }
  });
};
const host = calls => ({
  packageName:'opensheetmusicdisplay', packageVersion:'2.1.1', license:'BSD-3-Clause',
  instance:{
    async load(xml){ calls.loads.push(xml); },
    render(){ calls.renders += 1; },
    clear(){ calls.clears += 1; }
  }
});
const controller = () => createViewportEnabledStandaloneScoreEditorController({
  store: memoryStore(), autosaveDelayMs:60_000, sha256Hex:async () => 'b'.repeat(64)
});
const eventHit = value => {
  const document = value.getDocument(); assert.ok(document);
  const score = document.session.history.present.score;
  const staff = score.parts[0]?.staves[0]; assert.ok(staff && staff.role !== 'tablature-linked');
  const event = staff.measures[0]?.voices[0]?.events[0]; assert.ok(event);
  const entry = document.session.renderRequest.manifest.entries.find(item => item.address.kind === 'event' && item.address.eventId === event.id); assert.ok(entry);
  return createExternalRendererHitV4(document.session.renderRequest, entry.token);
};

test('APP-06C zoom/pan/page state is presentation-only and creates no canonical revision/history entry', () => {
  const value = controller();
  value.newDocument({ idFactory:idFactory() });
  const before = value.getDocument(); assert.ok(before);
  const revisionId = before.session.history.present.score.revision.id;
  const past = before.session.history.past.length;
  const future = before.session.history.future.length;
  const canonicalPair = structuredClone(before.session.history.present);

  assert.equal(value.getViewportState().zoom, 1);
  assert.equal(value.zoomIn().zoom, 1 + VIEWPORT_ZOOM_STEP);
  assert.equal(value.panBy(120, 64).scrollX, 120);
  assert.equal(value.getViewportState().scrollY, 64);
  assert.equal(value.goToPage(12).pageIndex, 0);
  assert.equal(value.resetZoom().zoom, 1);

  const after = value.getDocument(); assert.ok(after);
  assert.equal(after.session.history.present.score.revision.id, revisionId);
  assert.equal(after.session.history.past.length, past);
  assert.equal(after.session.history.future.length, future);
  assert.deepEqual(after.session.history.present, canonicalPair);
  assert.throws(() => value.setViewport({ zoom:99, scrollX:0, scrollY:0 }), RangeError);
  value.unmount();
});

test('APP-06C rerender after zoom uses the current V4 revision and does not create a revision', async () => {
  const calls = { loads:[], renders:0, clears:0 };
  const value = controller();
  value.newDocument({ idFactory:idFactory() });
  value.attachOsmdRenderer(host(calls));
  await value.renderCurrent();
  const before = value.getDocument(); assert.ok(before);
  const revisionId = before.session.history.present.score.revision.id;
  value.zoomIn();
  await value.renderCurrent();
  const after = value.getDocument(); assert.ok(after);
  assert.equal(after.session.history.present.score.revision.id, revisionId);
  assert.equal(value.getRendererState().renderedRevisionId, revisionId);
  assert.equal(calls.loads.length, 2);
  assert.equal(calls.renders, 2);
  value.unmount();
});

test('APP-06C viewport navigation preserves APP-06B current-token semantics and stale hits still fail closed', async () => {
  const calls = { loads:[], renders:0, clears:0 };
  const value = controller();
  value.newDocument({ idFactory:idFactory() });
  value.attachOsmdRenderer(host(calls));
  await value.renderCurrent();
  const hit = eventHit(value);
  value.zoomIn();
  value.panBy(20, 30);
  const selected = value.selectRendererHit(hit);
  assert.equal(selected.error, null);

  const document = value.getDocument(); assert.ok(document);
  const score = document.session.history.present.score;
  const part = score.parts[0]; assert.ok(part);
  const edited = value.commitTopology({
    version:'1.0.0', type:'RENAME_PART_OR_INSTRUMENT', target:addressEntityV3(score,part.id),
    partName:'Viewport Piano', instrumentName:'Viewport Piano', instrumentShortName:'Pno.'
  }, { nextRevisionId:'rev:app06c-edit' });
  assert.equal(edited.error, null);
  assert.throws(() => value.selectRendererHit(hit), error => error instanceof RendererSemanticHitBridgeControllerError && error.code === 'NO_CURRENT_RENDER_PRESENTATION');
  assert.equal(value.getDocument()?.session.history.present.score.revision.id, 'rev:app06c-edit');
  value.unmount();
});

test('APP-06C keyboard contract maps zoom, pan and page navigation without semantic authoring actions', () => {
  assert.equal(resolveViewportKeyboardAction({ key:'+', ctrlKey:true }), 'ZOOM_IN');
  assert.equal(resolveViewportKeyboardAction({ key:'-', metaKey:true }), 'ZOOM_OUT');
  assert.equal(resolveViewportKeyboardAction({ key:'0', ctrlKey:true }), 'ZOOM_RESET');
  assert.equal(resolveViewportKeyboardAction({ key:'ArrowRight' }), 'PAN_RIGHT');
  assert.equal(resolveViewportKeyboardAction({ key:'PageDown' }), 'PAGE_NEXT');
  assert.equal(resolveViewportKeyboardAction({ key:'Home' }), 'PAGE_FIRST');
  assert.equal(resolveViewportKeyboardAction({ key:'a' }), null);
});
