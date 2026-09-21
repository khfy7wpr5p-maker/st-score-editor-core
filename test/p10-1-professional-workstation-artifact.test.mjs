import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';

const execFileAsync = promisify(execFile);
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));

for (const script of [
  'scripts/build-professional-browser.mjs',
  'scripts/build-p09d-keyboard-workstation-browser.mjs',
  'scripts/build-p10-1-professional-workstation-browser.mjs'
]) {
  const result = await execFileAsync(process.execPath, [script], {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024
  });
  if (result.stdout.length > 0) process.stdout.write(result.stdout);
  if (result.stderr.length > 0) process.stderr.write(result.stderr);
}

test('P10-1 combined professional workstation artifact is independently bounded and non-authoritative', async () => {
  const manifest = await readJson('dist/browser/st-score-editor-professional-workstation.manifest.json');
  const bundle = await readFile('dist/browser/st-score-editor-professional-workstation.js');
  const html = await readFile('dist/browser/st-score-editor-professional-workstation.html', 'utf8');

  assert.equal(manifest.contract, 'ST_SCORE_EDITOR_P10_1_PROFESSIONAL_WORKSTATION_BUNDLE');
  assert.equal(manifest.version, '1.0.0');
  assert.equal(manifest.artifactClass, 'optional-professional-workstation-composition');
  assert.equal(manifest.artifact, 'st-score-editor-professional-workstation.js');
  assert.equal(manifest.global, 'STScoreEditorProfessionalWorkstation');
  assert.equal(manifest.entryHtml, 'st-score-editor-professional-workstation.html');
  assert.equal(manifest.externalImports, 0);

  assert.equal(manifest.canonicalAuthority, false);
  assert.equal(manifest.historyAuthority, 'EditorHistoryV4');
  assert.equal(manifest.semanticTargetAuthority, 'SemanticAddressV3-current-revision');
  assert.equal(manifest.p08ProfessionalBundled, true);
  assert.equal(manifest.p09KeyboardBundled, true);
  assert.equal(manifest.app10AuthoringAvailable, true);
  assert.equal(manifest.app11AuthoringAvailable, true);
  assert.equal(manifest.rendererIntegrated, true);
  assert.equal(manifest.audioHostIntegrated, true);
  assert.equal(manifest.audioEngineBundled, false);
  assert.equal(manifest.externalAudioRuntimeRequired, true);
  assert.equal(manifest.rendererCoordinateAuthority, false);
  assert.equal(manifest.domAuthoringAuthority, false);
  assert.equal(manifest.keyboardCursorAuthority, false);
  assert.equal(manifest.professionalSelectionCanonicalAuthority, false);
  assert.equal(manifest.productionDefault, false);
  assert.equal(manifest.replacesDefaultApp, false);
  assert.equal(manifest.productionReleaseAuthorized, false);
  assert.equal(manifest.seslitabCutoverAuthorized, false);
  assert.equal(manifest.physicalDeviceValidationRequired, true);
  assert.equal(manifest.physicalDeviceValidationPassed, false);

  assert.equal(manifest.bundleBudgetRevision, 'P10-1-COMPOSITION-1');
  assert.equal(manifest.bytes, bundle.byteLength);
  assert.ok(manifest.bytes <= manifest.maxBytes);
  assert.ok(manifest.maxBytes - manifest.bytes <= 20_000);
  assert.equal(createHash('sha256').update(bundle).digest('hex'), manifest.sha256);
  assert.match(bundle.toString('utf8'), /STScoreEditorProfessionalWorkstation/);
  assert.match(html, /STScoreEditorProfessionalWorkstation\.createController/);
});

test('P10-1 combined artifact refuses silent default, P08 or P09 budget rebaselines', async () => {
  const defaultManifest = await readJson('dist/browser/st-score-editor-app.manifest.json');
  const p08Manifest = await readJson('dist/browser/st-score-editor-professional.manifest.json');
  const p09Manifest = await readJson('dist/browser/st-score-editor-keyboard-workstation.manifest.json');
  const p10Manifest = await readJson('dist/browser/st-score-editor-professional-workstation.manifest.json');

  assert.deepEqual(p10Manifest.retainedBudgets.defaultApp, {
    maxBytes: 542_720,
    bundleBudgetRevision: 'P06-AUDIO-V010-1'
  });
  assert.deepEqual(p10Manifest.retainedBudgets.p08Professional, {
    maxBytes: 615_000,
    bundleBudgetRevision: 'P08-E4-QUALIFIED-1'
  });
  assert.deepEqual(p10Manifest.retainedBudgets.p09Keyboard, {
    maxBytes: 552_960,
    bundleBudgetRevision: 'P09-D-QUALIFIED-1'
  });

  assert.equal(defaultManifest.maxBytes, p10Manifest.retainedBudgets.defaultApp.maxBytes);
  assert.equal(p08Manifest.maxBytes, p10Manifest.retainedBudgets.p08Professional.maxBytes);
  assert.equal(p09Manifest.maxBytes, p10Manifest.retainedBudgets.p09Keyboard.maxBytes);
});
