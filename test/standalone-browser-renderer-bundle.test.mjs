import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const bundlePath = new URL('../dist/browser/st-score-editor-app.js', import.meta.url);
const manifestPath = new URL('../dist/browser/st-score-editor-app.manifest.json', import.meta.url);

test('APP-06B manifest admits semantic hit bridge without renderer or canonical authority', async () => {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.equal(manifest.rendererAuthority, false);
  assert.equal(manifest.rendererBundled, false);
  assert.equal(manifest.rendererLifecycleBundled, true);
  assert.equal(manifest.rendererImplementationBundled, false);
  assert.equal(manifest.rendererAutoRender, false);
  assert.equal(manifest.rendererFamily, 'osmd');
  assert.equal(manifest.rendererExactHostVersion, '2.1.1');
  assert.equal(manifest.staleRenderResultRejected, true);
  assert.equal(manifest.semanticRendererHitBridgeBundled, true);
  assert.equal(manifest.rendererHitCanonicalInput, 'opaque-renderer-request-v4-manifest-token');
  assert.equal(manifest.rendererDomSvgCoordinateAuthority, false);
  assert.equal(manifest.staleRendererHitRejected, true);
  assert.equal(manifest.persistenceCapable, false);
  assert.equal(manifest.networkCapable, false);
});

test('APP-06B global exposes guarded renderer lifecycle plus semantic hit selection only', async () => {
  const bundle = await readFile(bundlePath);
  const context = vm.createContext({ TextEncoder, Blob, URL: class URL {} });
  vm.runInContext(bundle.toString('utf8'), context, { filename: 'st-score-editor-app.js' });
  const app = context.STScoreEditorApp;
  assert.ok(app.renderer);
  assert.equal(app.renderer.family, 'osmd');
  assert.equal(app.renderer.implementationBundled, false);
  assert.equal(app.renderer.autoRender, false);
  assert.equal(app.renderer.canonicalAuthority, false);
  assert.equal(app.renderer.semanticHitBridgeVersion, '4.0.0');
  assert.equal(app.renderer.hitCanonicalInput, 'opaque-renderer-request-v4-manifest-token');
  assert.equal(app.renderer.domSvgCoordinateAuthority, false);
  const controller = app.createController();
  assert.equal(typeof controller.attachOsmdRenderer, 'function');
  assert.equal(typeof controller.detachRenderer, 'function');
  assert.equal(typeof controller.renderCurrent, 'function');
  assert.equal(typeof controller.getRendererState, 'function');
  assert.equal(typeof controller.selectRendererHit, 'function');
  assert.equal(controller.profile.semanticRendererHitBridgeBundled, true);
  assert.equal(controller.profile.rendererDomSvgCoordinateAuthority, false);
  assert.equal(controller.getRendererState().attached, false);
  assert.equal(controller.getRendererState().status.code, 'RENDERER_DETACHED');
  controller.unmount();
});
