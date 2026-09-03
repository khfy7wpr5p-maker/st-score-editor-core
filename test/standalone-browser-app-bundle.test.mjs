import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const appBundlePath = new URL('../dist/browser/st-score-editor-app.js', import.meta.url);
const appManifestPath = new URL('../dist/browser/st-score-editor-app.manifest.json', import.meta.url);
const appHtmlPath = new URL('../dist/browser/st-score-editor-app.html', import.meta.url);
const coreBundlePath = new URL('../dist/browser/st-score-editor-core.runtime.js', import.meta.url);

const readAppArtifact = async () => ({
  bundle: await readFile(appBundlePath),
  manifest: JSON.parse(await readFile(appManifestPath, 'utf8'))
});

test('APP-05C standalone browser artifact is recovery-enabled without canonical persistence authority', async () => {
  const { bundle, manifest } = await readAppArtifact();
  assert.equal(manifest.contract, 'ST_SCORE_EDITOR_APP_BROWSER_BUNDLE');
  assert.equal(manifest.version, '1.0.0');
  assert.equal(manifest.runtimeVersion, '1.0.0');
  assert.equal(manifest.artifact, 'st-score-editor-app.js');
  assert.equal(manifest.entryHtml, 'st-score-editor-app.html');
  assert.equal(manifest.global, 'STScoreEditorApp');
  assert.equal(manifest.format, 'iife');
  assert.equal(manifest.target, 'es2022');
  assert.equal(manifest.standaloneProduct, true);
  assert.equal(manifest.canonicalAuthority, false);
  assert.equal(manifest.networkCapable, false);
  assert.equal(manifest.persistenceCapable, false);
  assert.equal(manifest.rendererAuthority, false);
  assert.equal(manifest.rendererBundled, false);
  assert.equal(manifest.fileWorkflowBundled, true);
  assert.equal(manifest.recoveryAutosaveBundled, true);
  assert.equal(manifest.browserLocalRecoveryStorage, 'indexedDB');
  assert.equal(manifest.recoveryCanonicalAuthority, false);
  assert.equal(manifest.recoveryAutoRestore, false);
  assert.equal(manifest.recoveryMaxDocuments, 8);
  assert.equal(manifest.playbackBundled, false);
  assert.equal(manifest.serverRevisionAuthority, false);
  assert.equal(manifest.publicationAuthority, false);
  assert.equal(manifest.externalImports, 0);
  assert.equal(manifest.bytes, bundle.byteLength);
  assert.equal(manifest.sha256, createHash('sha256').update(bundle).digest('hex'));
});

test('APP-05C IndexedDB admission is isolated to standalone recovery bundle, never legacy core', async () => {
  const { bundle } = await readAppArtifact();
  const coreBundle = await readFile(coreBundlePath);
  assert.match(bundle.toString('utf8'), /indexedDB/);
  assert.doesNotMatch(coreBundle.toString('utf8'), /indexedDB/);
});

test('APP-03–05 standalone HTML bootstrap stays local and contains no silent recovery script', async () => {
  const html = await readFile(appHtmlPath, 'utf8');
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /st-score-editor-app\.js/);
  assert.match(html, /STScoreEditorApp\.createController\(\)/);
  assert.match(html, /controller\.mount\(root\)/);
  assert.doesNotMatch(html, /XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|prepareRecovery|restoreRecovery/);
});

test('APP-05C global exposes recovery API and degrades safely when IndexedDB is unavailable', async () => {
  const { bundle } = await readAppArtifact();
  const context = vm.createContext({ TextEncoder, Blob, URL: class URL {} });
  vm.runInContext(bundle.toString('utf8'), context, { filename: 'st-score-editor-app.js' });
  const app = context.STScoreEditorApp;
  assert.ok(app.recovery);
  assert.equal(app.profile.recoveryAutosaveBundled, true);
  assert.equal(app.profile.recoveryAutoRestore, false);
  assert.equal(app.recovery.autoRestore, false);
  assert.equal(typeof app.recovery.createIndexedDbStore, 'function');
  assert.equal(typeof app.recovery.scanStore, 'function');
  const controller = app.createController();
  assert.equal(typeof controller.flushRecovery, 'function');
  assert.equal(typeof controller.scanRecoveries, 'function');
  assert.equal(typeof controller.prepareRecovery, 'function');
  assert.equal(typeof controller.deleteRecovery, 'function');
  assert.equal(controller.getRecoveryState().storageAvailable, false);
  assert.equal(controller.getRecoveryState().autosaveAvailable, false);
  assert.equal(controller.getRecoveryState().status.code, 'RECOVERY_UNAVAILABLE');
  assert.equal(Object.isFrozen(controller), true);
});

test('APP-03A app and legacy core globals coexist without authority collision', async () => {
  const { bundle } = await readAppArtifact();
  const coreBundle = await readFile(coreBundlePath);
  const context = vm.createContext({ TextEncoder, Blob, URL: class URL {} });
  vm.runInContext(coreBundle.toString('utf8'), context, { filename: 'st-score-editor-core.runtime.js' });
  vm.runInContext(bundle.toString('utf8'), context, { filename: 'st-score-editor-app.js' });
  assert.ok(context.STScoreEditorCoreRuntime);
  assert.ok(context.STScoreEditorApp);
  assert.notEqual(context.STScoreEditorCoreRuntime, context.STScoreEditorApp);
  assert.equal(context.STScoreEditorApp.profile.canonicalAuthority, false);
  assert.equal(context.STScoreEditorApp.profile.persistenceCapable, false);
  assert.equal(context.STScoreEditorApp.profile.recoveryCanonicalAuthority, false);
  const descriptor = Object.getOwnPropertyDescriptor(context, 'STScoreEditorApp');
  assert.equal(descriptor?.writable, false);
  assert.equal(descriptor?.configurable, false);
  assert.throws(() => vm.runInContext(bundle.toString('utf8'), context), /ST_SCORE_EDITOR_APP_ALREADY_DEFINED/);
});
