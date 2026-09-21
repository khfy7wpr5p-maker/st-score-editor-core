import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  assembleP10_1ProfessionalWorkstationRendererPreview
} from '../scripts/assemble-p10-1-professional-workstation-renderer-preview.mjs';

const rendererRevision = '70c21ad73c0b2e9c71e415cc3272a10673df9d60';

test('P10-1 renderer qualification preview binds exact renderer runtime to the combined workstation global', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'p10-1-renderer-preview-'));
  const runtimeDir = path.join(temp, 'runtime');
  const outputDir = path.join(temp, 'out');
  await mkdir(path.join(runtimeDir, 'vendor'), { recursive: true });

  const files = [
    { path: 'index.html' },
    { path: 'workstation-bootstrap.mjs' },
    { path: 'vendor/opensheetmusicdisplay.min.js' }
  ];
  await writeFile(path.join(runtimeDir, 'runtime-manifest.json'), JSON.stringify({
    rendererSourceRevision: rendererRevision,
    scoreRendererContractVersion: '0.2.0',
    vendor: { opensheetmusicdisplay: { version: '2.1.2', license: 'BSD-3-Clause' } },
    files
  }));
  await writeFile(path.join(runtimeDir, 'index.html'), '<!doctype html><html></html>');
  await writeFile(path.join(runtimeDir, 'workstation-bootstrap.mjs'), 'export {};');
  await writeFile(path.join(runtimeDir, 'vendor/opensheetmusicdisplay.min.js'), '/* osmd */');

  try {
    const manifest = await assembleP10_1ProfessionalWorkstationRendererPreview({ runtimeDir, outputDir });
    const html = await readFile(path.join(outputDir, 'st-score-editor-professional-workstation-renderer.html'), 'utf8');
    const bootstrap = await readFile(path.join(outputDir, 'st-score-editor-professional-workstation-renderer-bootstrap.js'), 'utf8');

    assert.equal(manifest.contract, 'ST_SCORE_EDITOR_P10_1_RENDERER_QUALIFICATION_PREVIEW');
    assert.equal(manifest.editorArtifact, 'st-score-editor-professional-workstation.js');
    assert.equal(manifest.entryHtml, 'st-score-editor-professional-workstation-renderer.html');
    assert.equal(manifest.renderer.rendererSourceRevision, rendererRevision);
    assert.equal(manifest.productionReleaseAuthorized, false);
    assert.equal(manifest.seslitabCutoverAuthorized, false);

    assert.match(html, /st-score-editor-professional-workstation\.js/);
    assert.match(html, /st-score-editor-professional-workstation-renderer-bootstrap\.js/);
    assert.doesNotMatch(html, /st-score-editor-app\.js/);

    assert.match(bootstrap, /STScoreEditorProfessionalWorkstation\.createController/);
    assert.match(bootstrap, /STScoreEditorProfessionalWorkstationController/);
    assert.match(bootstrap, /renderer-runtime\/index\.html/);
    assert.doesNotMatch(bootstrap, /STScoreEditorApp\.createController/);
    assert.doesNotMatch(bootstrap, /STScoreEditorAppController/);
    assert.doesNotMatch(bootstrap, /openMusicXml\([^\n]+APP-09B Touch Test/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
