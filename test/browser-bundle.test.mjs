import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const bundlePath = new URL('../dist/browser/st-score-editor-core.runtime.js', import.meta.url);
const manifestPath = new URL('../dist/browser/st-score-editor-core.runtime.manifest.json', import.meta.url);

const readArtifact = async () => ({
  bundle: await readFile(bundlePath),
  manifest: JSON.parse(await readFile(manifestPath, 'utf8'))
});

test('E7-H browser artifact is self-contained and integrity-described', async () => {
  const { bundle, manifest } = await readArtifact();
  assert.equal(manifest.contract, 'ST_SCORE_EDITOR_CORE_BROWSER_BUNDLE');
  assert.equal(manifest.version, '1.0.0');
  assert.equal(manifest.runtimeVersion, '1.0.0');
  assert.deepEqual(manifest.bundler, { package: 'esbuild', version: '0.28.2', license: 'MIT' });
  assert.equal(manifest.artifact, 'st-score-editor-core.runtime.js');
  assert.equal(manifest.format, 'iife');
  assert.equal(manifest.target, 'es2022');
  assert.equal(manifest.global, 'STScoreEditorCoreRuntime');
  assert.equal(manifest.externalImports, 0);
  assert.equal(manifest.networkCapable, false);
  assert.equal(manifest.persistenceCapable, false);
  assert.equal(manifest.serverRevisionAuthority, false);
  assert.equal(manifest.approvalAuthority, false);
  assert.equal(manifest.publicationAuthority, false);
  assert.equal(manifest.bytes, bundle.byteLength);
  assert.equal(manifest.sha256, createHash('sha256').update(bundle).digest('hex'));
});

test('E7-H bundle installs one frozen fail-closed runtime global', async () => {
  const { bundle } = await readArtifact();
  const context = vm.createContext({});
  vm.runInContext(bundle.toString('utf8'), context, { filename: 'st-score-editor-core.runtime.js' });

  const runtime = context.STScoreEditorCoreRuntime;
  assert.ok(runtime);
  assert.equal(runtime.runtimeVersion, '1.0.0');
  assert.equal(runtime.profile.productionRuntime, false);
  assert.equal(runtime.profile.networkCapable, false);
  assert.equal(runtime.profile.persistenceCapable, false);
  assert.equal(runtime.profile.rendererAuthority, false);
  assert.equal(runtime.profile.browserMutationAuthority, false);
  assert.equal(runtime.profile.serverRevisionAuthority, false);
  assert.equal(runtime.profile.approvalAuthority, false);
  assert.equal(runtime.profile.publicationAuthority, false);
  assert.equal(Object.isFrozen(runtime), true);
  assert.equal(Object.isFrozen(runtime.profile), true);

  const descriptor = Object.getOwnPropertyDescriptor(context, 'STScoreEditorCoreRuntime');
  assert.equal(descriptor?.writable, false);
  assert.equal(descriptor?.configurable, false);
  assert.throws(
    () => vm.runInContext(bundle.toString('utf8'), context),
    /ST_SCORE_EDITOR_CORE_RUNTIME_ALREADY_DEFINED/
  );
});
