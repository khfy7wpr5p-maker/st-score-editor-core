import test from 'node:test';
import assert from 'node:assert/strict';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import {
  createRendererEnabledStandaloneScoreEditorController,
  RendererLifecycleError
} from '../dist/packages/score-editor-browser-app/src/renderer-enabled.js';

const idFactory = () => {
  let index = 0;
  return () => `renderer-life-${++index}`;
};
const memoryStore = () => {
  const values = new Map();
  return Object.freeze({
    put: async record => { values.set(record.documentId, structuredClone(record)); },
    list: async () => [...values.values()].map(value => structuredClone(value)),
    delete: async documentId => { values.delete(documentId); },
    clear: async () => { values.clear(); }
  });
};
const host = (overrides = {}) => {
  const calls = { loads: [], renders: 0, clears: 0 };
  const value = {
    packageName: 'opensheetmusicdisplay',
    packageVersion: '2.1.1',
    license: 'BSD-3-Clause',
    instance: {
      async load(xml) { calls.loads.push(xml); },
      render() { calls.renders += 1; },
      clear() { calls.clears += 1; },
      ...overrides
    }
  };
  return { value, calls };
};
const controller = () => createRendererEnabledStandaloneScoreEditorController({
  store: memoryStore(),
  autosaveDelayMs: 60_000,
  sha256Hex: async () => 'a'.repeat(64)
});
const renamePart = (value, revisionId, name) => {
  const document = value.getDocument();
  assert.ok(document);
  const score = document.session.history.present.score;
  const part = score.parts[0];
  assert.ok(part);
  const result = value.commitTopology({
    version: '1.0.0',
    type: 'RENAME_PART_OR_INSTRUMENT',
    target: addressEntityV3(score, part.id),
    partName: name,
    instrumentName: name,
    instrumentShortName: 'Pno.'
  }, { nextRevisionId: revisionId });
  assert.equal(result.error, null);
};

test('APP-06A renders the current admitted V4 projection through exact OSMD host', async () => {
  const value = controller();
  value.newDocument({ title: 'Renderer Life', idFactory: idFactory() });
  const osmd = host();
  value.attachOsmdRenderer(osmd.value);
  const rendered = await value.renderCurrent();
  assert.equal(rendered.attached, true);
  assert.equal(rendered.family, 'osmd');
  assert.equal(rendered.renderedRevisionId, value.getSnapshot().revisionId);
  assert.equal(rendered.status.code, 'RENDERED_CURRENT_REVISION');
  assert.equal(osmd.calls.loads.length, 1);
  assert.match(osmd.calls.loads[0], /score-partwise/);
  assert.equal(osmd.calls.renders, 1);
  value.unmount();
});

test('APP-06A canonical revision change clears the previous presentation identity', async () => {
  const value = controller();
  value.newDocument({ idFactory: idFactory() });
  const osmd = host();
  value.attachOsmdRenderer(osmd.value);
  await value.renderCurrent();
  renamePart(value, 'renderer-life-rev-2', 'Changed Piano');
  const state = value.getRendererState();
  assert.equal(state.renderedRevisionId, null);
  assert.equal(state.status.code, 'RENDERER_STALE');
  assert.equal(osmd.calls.clears, 1);
  value.unmount();
});

test('APP-06A rejects a renderer completion if the canonical revision changed while load was in flight', async () => {
  let resolveLoad;
  const loadGate = new Promise(resolve => { resolveLoad = resolve; });
  const value = controller();
  value.newDocument({ idFactory: idFactory() });
  const osmd = host({ async load() { await loadGate; } });
  value.attachOsmdRenderer(osmd.value);
  const rendering = value.renderCurrent();
  renamePart(value, 'renderer-life-rev-race', 'Race Piano');
  resolveLoad();
  await assert.rejects(
    () => rendering,
    error => error instanceof RendererLifecycleError && error.code === 'RENDERER_STALE_RESULT'
  );
  assert.equal(value.getRendererState().renderedRevisionId, null);
  assert.ok(osmd.calls.clears >= 1);
  value.unmount();
});

test('APP-06A refuses pending V4 projection instead of silently flattening it for OSMD', async () => {
  const value = controller();
  value.newDocument({ idFactory: idFactory() });
  const osmd = host();
  value.attachOsmdRenderer(osmd.value);
  renamePart(value, 'renderer-life-rev-pending', 'Projection Pending');
  assert.notEqual(value.getDocument().session.renderRequest.projectionStatus, 'V3_COMPATIBLE_XML');
  await assert.rejects(
    () => value.renderCurrent(),
    error => error instanceof RendererLifecycleError && error.code === 'RENDERER_RENDER_FAILED'
  );
  assert.equal(osmd.calls.loads.length, 0);
  assert.equal(osmd.calls.renders, 0);
  assert.equal(value.getRendererState().renderedRevisionId, null);
  value.unmount();
});
