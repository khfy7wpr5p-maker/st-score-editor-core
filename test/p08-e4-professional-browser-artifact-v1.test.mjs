import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';

const execFileAsync = promisify(execFile);
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const professionalBuild = await execFileAsync(process.execPath, ['scripts/build-professional-browser.mjs'], {
  cwd: process.cwd(),
  maxBuffer: 1024 * 1024
});
if (professionalBuild.stdout.length > 0) process.stdout.write(professionalBuild.stdout);
if (professionalBuild.stderr.length > 0) process.stderr.write(professionalBuild.stderr);

test('P08-E4 professional artifact is independently bounded and integrity described', async () => {
  const manifest = await readJson('dist/browser/st-score-editor-professional.manifest.json');
  const bundle = await readFile('dist/browser/st-score-editor-professional.js');
  const html = await readFile('dist/browser/st-score-editor-professional.html', 'utf8');

  assert.equal(manifest.contract, 'ST_SCORE_EDITOR_PROFESSIONAL_BROWSER_BUNDLE');
  assert.equal(manifest.version, '1.0.0');
  assert.equal(manifest.runtimeVersion, '1.0.0');
  assert.equal(manifest.artifactClass, 'optional-professional-browser-surface');
  assert.equal(manifest.artifact, 'st-score-editor-professional.js');
  assert.equal(manifest.global, 'STScoreEditorProfessionalApp');
  assert.equal(manifest.entryHtml, 'st-score-editor-professional.html');
  assert.equal(manifest.productionDefault, false);
  assert.equal(manifest.replacesDefaultApp, false);
  assert.equal(manifest.defaultAppBundleBudgetModified, false);
  assert.equal(manifest.canonicalAuthority, false);
  assert.equal(manifest.historyAuthority, 'EditorHistoryV4');
  assert.equal(manifest.semanticTargetAuthority, 'SemanticAddressV3-current-revision');
  assert.equal(manifest.professionalRangeToolbarBundled, true);
  assert.equal(manifest.professionalStructureInspectorBundled, true);
  assert.equal(manifest.rangeMutationAuthority, 'P08-D-professional-workstation');
  assert.equal(manifest.structureMutationAuthority, 'P08-D-professional-workstation');
  assert.equal(manifest.minimumTouchTargetPx, 44);
  assert.equal(manifest.networkAuthority, false);
  assert.equal(manifest.rendererCoordinateAuthority, false);
  assert.equal(manifest.domAuthoringAuthority, false);
  assert.equal(manifest.audioEngineBundled, false);
  assert.equal(manifest.audioHostIntegrated, false);
  assert.equal(manifest.physicalDeviceValidationRequired, true);
  assert.equal(manifest.physicalDeviceValidationPassed, false);
  assert.equal(manifest.productionReleaseAuthorized, false);
  assert.equal(manifest.seslitabCutoverAuthorized, false);
  assert.equal(manifest.externalImports, 0);
  assert.equal(manifest.bytes, bundle.byteLength);
  assert.ok(manifest.maxBytes >= bundle.byteLength);
  assert.ok(manifest.maxBytes <= 700_000);
  assert.match(manifest.bundleBudgetRevision, /^P08-E4-/);
  assert.match(manifest.sha256, /^[a-f0-9]{64}$/);
  assert.equal(createHash('sha256').update(bundle).digest('hex'), manifest.sha256);
  assert.match(bundle.toString('utf8'), /STScoreEditorProfessionalApp/);
  assert.match(html, /STScoreEditorProfessionalApp\.createController/);
});

test('P08-E4 does not rebaseline the qualified default STScoreEditorApp budget', async () => {
  const defaultManifest = await readJson('dist/browser/st-score-editor-app.manifest.json');
  const professionalManifest = await readJson('dist/browser/st-score-editor-professional.manifest.json');

  assert.equal(defaultManifest.maxBytes, 542_720);
  assert.equal(defaultManifest.bundleBudgetRevision, 'P06-AUDIO-V010-1');
  assert.equal(defaultManifest.seslitabCutoverAuthorized, false);
  assert.equal(professionalManifest.defaultAppBundleMaxBytes, 542_720);
  assert.equal(professionalManifest.defaultAppBundleBudgetRevision, 'P06-AUDIO-V010-1');
  assert.equal(professionalManifest.defaultAppBundleBudgetModified, false);
});
