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

test('APP-03A standalone browser artifact is self-contained and non-authoritative', async () => {
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
  assert.equal(manifest.fileWorkflowBundled, false);
  assert.equal(manifest.playbackBundled, false);
  assert.equal(manifest.serverRevisionAuthority, false);
  assert.equal(manifest.publicationAuthority, false);
  assert.equal(manifest.externalImports, 0);
  assert.equal(manifest.bytes, bundle.byteLength);
  assert.equal(manifest.sha256, createHash('sha256').update(bundle).digest('hex'));
});

test('APP-03A emits an independently openable HTML bootstrap without taking canonical authority', async () => {
  const html = await readFile(appHtmlPath, 'utf8');
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /st-score-editor-app\.js/);
  assert.match(html, /STScoreEditorApp\.createController\(\)/);
  assert.match(html, /controller\.mount\(root\)/);
  assert.doesNotMatch(html, /XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB/);
});

test('APP-03A app and legacy core globals coexist without authority collision', async () => {
  const { bundle } = await readAppArtifact();
  const coreBundle = await readFile(coreBundlePath);
  const context = vm.createContext({});
  vm.runInContext(coreBundle.toString('utf8'), context, { filename: 'st-score-editor-core.runtime.js' });
  vm.runInContext(bundle.toString('utf8'), context, { filename: 'st-score-editor-app.js' });

  assert.ok(context.STScoreEditorCoreRuntime);
  assert.ok(context.STScoreEditorApp);
  assert.notEqual(context.STScoreEditorCoreRuntime, context.STScoreEditorApp);
  assert.equal(context.STScoreEditorApp.runtimeVersion, '1.0.0');
  assert.equal(context.STScoreEditorApp.profile.standaloneProduct, true);
  assert.equal(context.STScoreEditorApp.profile.canonicalAuthority, false);
  assert.equal(typeof context.STScoreEditorApp.createController, 'function');
  assert.equal(Object.isFrozen(context.STScoreEditorApp), true);
  assert.equal(Object.isFrozen(context.STScoreEditorApp.profile), true);

  const descriptor = Object.getOwnPropertyDescriptor(context, 'STScoreEditorApp');
  assert.equal(descriptor?.writable, false);
  assert.equal(descriptor?.configurable, false);
  assert.throws(() => vm.runInContext(bundle.toString('utf8'), context), /ST_SCORE_EDITOR_APP_ALREADY_DEFINED/);
});
