import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

import {
  runPartituraIsolationQualification,
  createSes91V2FallbackLoader
} from '../scripts/p-mxml-ref-03-release-qualification.mjs';
import {
  createFileEnabledStandaloneScoreEditorController
} from '../dist/packages/score-editor-browser-app/src/file-enabled.js';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('SES-91 release qualification keeps Partitura isolated and release physically gated', async () => {
  await Promise.all([
    access(new URL('../scripts/p-mxml-ref-03-release-qualification.mjs', import.meta.url)),
    access(new URL('../docs/p-mxml-ref-03-release-qualification.json', import.meta.url))
  ]);

  const result = await runPartituraIsolationQualification();
  assert.equal(result.version, '1.0.0');
  assert.equal(result.open.route, 'PARTITURA_FALLBACK');
  assert.equal(result.open.fallbackCalls, 1);
  assert.equal(result.interaction.fallbackCallsBefore, 1);
  assert.equal(result.interaction.fallbackCallsAfter, 1);
  assert.equal(result.interaction.fallbackCallsDuringInteraction, 0);
  assert.equal(result.interaction.selectionPreservesRevision, true);
  assert.equal(result.interaction.editCreatesOneRevision, true);
  assert.equal(result.interaction.undoRestoresImportedRevision, true);
  assert.equal(result.interaction.redoRestoresEditedRevision, true);
  assert.equal(result.interaction.renderProducedMusicXml, true);
  assert.equal(result.timing.policy, 'INFORMATIONAL_SEPARATE_DOMAINS');
  assert.ok(Number.isFinite(result.timing.openImportMs));
  assert.ok(Number.isFinite(result.timing.interactionMs));

  const [manifestText, packageText, appText, browserText] = await Promise.all([
    read('docs/p-mxml-ref-03-release-qualification.json'),
    read('package.json'),
    read('packages/score-editor-app-document/src/index.ts'),
    read('packages/score-editor-browser-app/src/index.ts')
  ]);
  const manifest = JSON.parse(manifestText);

  assert.equal(manifest.status, 'AUTOMATED_PASS_PHYSICAL_DEVICE_PENDING');
  assert.equal(manifest.automated.partituraIsolationTrace, true);
  assert.equal(manifest.automated.partituraTimingSeparatedFromInteractionTiming, true);
  assert.equal(manifest.automated.fileEnabledFallbackLoaderForwarding, true);
  assert.equal(manifest.automated.node18_20_22Required, true);
  assert.equal(manifest.automated.dedicatedMusicXmlWebKitRequired, true);
  assert.equal(manifest.security.browserRuntimePythonDependency, false);
  assert.equal(manifest.security.browserRuntimeNetworkFallbackDependency, false);
  assert.equal(manifest.security.newRenderServiceOrUrl, false);
  assert.equal(manifest.integration.fallbackProviderConfiguredByCore, false);
  assert.equal(manifest.integration.externalProviderEndpointHardcoded, false);
  assert.equal(manifest.integration.physicalProviderWiringRequiredBeforeDevicePass, true);
  assert.equal(manifest.physical.iPhoneSafari, 'PENDING_EXACT_REFERENCE_FILE_RERUN');
  assert.equal(manifest.physical.androidChrome, 'PENDING_EXACT_REFERENCE_FILE_RERUN');
  assert.equal(manifest.release.productionReleaseAuthorized, false);
  assert.equal(manifest.release.seslitabCutoverAuthorized, false);
  assert.equal(manifest.release.mergeAuthorizedBySes91, false);

  const pkg = JSON.parse(packageText);
  assert.deepEqual(Object.keys(pkg.dependencies ?? {}).sort(), ['saxes', 'xmlchars']);
  assert.doesNotMatch(packageText, /partitura|python|axios|node-fetch/i);
  assert.doesNotMatch(appText, /from ['"]\.\.\/\.\.\/musicxml-import-router\/src\/index\.js['"]/);
  assert.doesNotMatch(browserText, /partitura|python|render\.com|axios|node-fetch/i);
});


test('SES-91 real file-enabled open path forwards the configured fallback loader exactly once', async () => {
  const xml = await read('corpus/fixtures/musicxml-compatibility/ses-90-guitar-tab-technical.musicxml');
  let calls = 0;
  const loader = createSes91V2FallbackLoader(() => { calls += 1; });
  const controller = createFileEnabledStandaloneScoreEditorController({
    musicXmlImportLoader: loader
  });
  const file = {
    name: 'ses-91-guitar.musicxml',
    size: new TextEncoder().encode(xml).byteLength,
    type: 'application/vnd.recordare.musicxml+xml',
    text: async () => xml
  };

  const opened = await controller.openLocalFile(file);
  assert.equal(opened.error, null);
  assert.equal(opened.origin, 'MUSICXML');
  assert.equal(calls, 1);

  const before = calls;
  controller.undo();
  controller.redo();
  controller.exportMusicXml();
  assert.equal(calls, before);
});
