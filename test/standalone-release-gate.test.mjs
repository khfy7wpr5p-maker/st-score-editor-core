import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const appBundlePath = new URL('../dist/browser/st-score-editor-app.js', import.meta.url);
const appManifestPath = new URL('../dist/browser/st-score-editor-app.manifest.json', import.meta.url);
const appHtmlPath = new URL('../dist/browser/st-score-editor-app.html', import.meta.url);

test('APP-09 standalone artifact enforces automated hardening and bundle budget without release authorization', async () => {
  const bundle = await readFile(appBundlePath);
  const manifest = JSON.parse(await readFile(appManifestPath, 'utf8'));
  assert.equal(manifest.releaseHardeningBundled, true);
  assert.equal(manifest.hardeningCanonicalAuthority, false);
  assert.equal(manifest.hardeningHistoryMutationAuthority, false);
  assert.equal(manifest.hardeningNetworkAuthority, false);
  assert.equal(manifest.dynamicViewportUnits, true);
  assert.equal(manifest.safeAreaInsets, true);
  assert.equal(manifest.coarsePointerTargetMinCssPx, 44);
  assert.equal(manifest.focusVisibleStyling, true);
  assert.equal(manifest.reducedMotionStyling, true);
  assert.equal(manifest.resizeOrientationReapplyPresentation, true);
  assert.equal(manifest.pageHideRecoveryFlush, true);
  assert.equal(manifest.accessibilityStatusLiveRegion, true);
  assert.deepEqual(manifest.browserContractTargets, ['ios-safari', 'ipad-safari', 'desktop-safari', 'chromium', 'firefox']);
  assert.equal(manifest.maxBytes, 524288);
  assert.ok(bundle.byteLength <= manifest.maxBytes);
  assert.equal(manifest.manualDeviceValidationRequired, true);
  assert.equal(manifest.standaloneReleaseGatePassed, false);
  assert.equal(manifest.seslitabCutoverAuthorized, false);
  assert.equal(manifest.canonicalAuthority, false);
  assert.equal(manifest.serverRevisionAuthority, false);
  assert.equal(manifest.publicationAuthority, false);
});

test('APP-09 standalone HTML keeps iOS viewport-fit and dynamic viewport root hardening local', async () => {
  const html = await readFile(appHtmlPath, 'utf8');
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /100dvh/);
  assert.match(html, /overscroll-behavior:none/);
  assert.doesNotMatch(html, /XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage/);
});

test('APP-09 global advertises manual device gate rather than falsely claiming Safari release validation', async () => {
  const bundle = await readFile(appBundlePath);
  const context = vm.createContext({ TextEncoder, Blob, URL: class URL {} });
  vm.runInContext(bundle.toString('utf8'), context, { filename: 'st-score-editor-app.js' });
  const app = context.STScoreEditorApp;
  assert.ok(app.releaseHardening);
  assert.equal(app.releaseHardening.bundled, true);
  assert.equal(app.releaseHardening.canonicalAuthority, false);
  assert.equal(app.releaseHardening.manualDeviceValidationRequired, true);
  assert.equal(app.releaseHardening.standaloneReleaseGatePassed, false);
  assert.equal(app.releaseHardening.seslitabCutoverAuthorized, false);
  const controller = app.createController();
  assert.equal(Object.isFrozen(controller), true);
  assert.equal(controller.profile.releaseHardeningBundled, true);
  assert.equal(controller.profile.canonicalAuthority, false);
});
