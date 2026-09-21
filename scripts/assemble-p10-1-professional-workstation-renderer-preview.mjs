import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleStableApp09BPreviewCli } from './assemble-app09b-preview-stable.mjs';

export const P10_1_RENDERER_PREVIEW_VERSION = '1.0.0';
export const P10_1_RENDERER_PREVIEW_CONTRACT =
  'ST_SCORE_EDITOR_P10_1_RENDERER_QUALIFICATION_PREVIEW';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const defaultOutputDir = path.join(repoRoot, 'dist', 'browser');

const BASE_HTML = 'st-score-editor-app09b.html';
const BASE_BOOTSTRAP = 'st-score-editor-app09b-bootstrap.js';
const ENTRY_HTML = 'st-score-editor-professional-workstation-renderer.html';
const BOOTSTRAP = 'st-score-editor-professional-workstation-renderer-bootstrap.js';
const MANIFEST = 'st-score-editor-professional-workstation-renderer.manifest.json';
const EDITOR_ARTIFACT = 'st-score-editor-professional-workstation.js';

const patchBootstrap = source => {
  let next = source;

  const createNeedle =
    'globalThis.STScoreEditorApp.createController({ rendererProfile: integrationProfile })';
  if (!next.includes(createNeedle)) {
    throw new Error('P10_1_RENDERER_PREVIEW_CONTROLLER_CREATE_HOOK_MISSING');
  }
  next = next.replace(
    createNeedle,
    'globalThis.STScoreEditorProfessionalWorkstation.createController({ rendererProfile: integrationProfile })'
  );

  if (!next.includes('!globalThis.STScoreEditorApp')) {
    throw new Error('P10_1_RENDERER_PREVIEW_GLOBAL_GUARD_HOOK_MISSING');
  }
  next = next.replace(
    '!globalThis.STScoreEditorApp',
    '!globalThis.STScoreEditorProfessionalWorkstation'
  );

  const controllerGlobalOccurrences =
    next.split('STScoreEditorAppController').length - 1;
  if (controllerGlobalOccurrences < 1) {
    throw new Error('P10_1_RENDERER_PREVIEW_CONTROLLER_GLOBAL_HOOK_MISSING');
  }
  next = next.replaceAll(
    'STScoreEditorAppController',
    'STScoreEditorProfessionalWorkstationController'
  );

  next = next.replaceAll(
    'STScoreEditorApp09B',
    'STScoreEditorProfessionalWorkstationRendererPreview'
  );

  const seededMount = /  const initialSampleReady = controller\.openMusicXml\([^\n]+, \{ title: 'APP-09B Touch Test' \}\)\n    \.then\(\(\) => \{ controller\.mount\(root\); \}\);/;
  if (!seededMount.test(next)) {
    throw new Error('P10_1_RENDERER_PREVIEW_SAMPLE_SEED_HOOK_MISSING');
  }
  next = next.replace(
    seededMount,
    '  const initialSampleReady = Promise.resolve().then(() => { controller.mount(root); });'
  );

  return next;
};

const patchHtml = source => {
  if (!source.includes('<script src="./st-score-editor-app.js"></script>')) {
    throw new Error('P10_1_RENDERER_PREVIEW_EDITOR_SCRIPT_HOOK_MISSING');
  }
  if (!source.includes('<script src="./st-score-editor-app09b-bootstrap.js"></script>')) {
    throw new Error('P10_1_RENDERER_PREVIEW_BOOTSTRAP_SCRIPT_HOOK_MISSING');
  }

  return source
    .replace(
      '<script src="./st-score-editor-app.js"></script>',
      `<script src="./${EDITOR_ARTIFACT}"></script>`
    )
    .replace(
      '<script src="./st-score-editor-app09b-bootstrap.js"></script>',
      `<script src="./${BOOTSTRAP}"></script>`
    )
    .replace(
      '<title>ST Score Editor APP-09B Test</title>',
      '<title>ST Score Editor P10-1 Professional Workstation Renderer Qualification</title>'
    );
};

export async function assembleP10_1ProfessionalWorkstationRendererPreview({
  runtimeDir,
  outputDir = defaultOutputDir,
  refreshRendererRuntime = false
} = {}) {
  const base = await assembleStableApp09BPreviewCli({
    runtimeDir,
    outputDir,
    includeIosDiagnostic: false,
    refreshRendererRuntime
  });

  const baseBootstrap = await readFile(path.join(outputDir, BASE_BOOTSTRAP), 'utf8');
  const baseHtml = await readFile(path.join(outputDir, BASE_HTML), 'utf8');

  const bootstrap = patchBootstrap(baseBootstrap);
  const html = patchHtml(baseHtml);

  await writeFile(path.join(outputDir, BOOTSTRAP), bootstrap, 'utf8');
  await writeFile(path.join(outputDir, ENTRY_HTML), html, 'utf8');

  const manifest = Object.freeze({
    contract: P10_1_RENDERER_PREVIEW_CONTRACT,
    version: P10_1_RENDERER_PREVIEW_VERSION,
    editorArtifact: EDITOR_ARTIFACT,
    entryHtml: ENTRY_HTML,
    bootstrap: BOOTSTRAP,
    rendererRuntimeDirectory: 'renderer-runtime',
    renderer: base.renderer,
    rendererProfileOverride: base.rendererProfileOverride,
    rendererImplementationBundledIntoEditorCore: false,
    rendererRuntimeSameOriginIsolated: true,
    rendererHitRequiresExactRenderEpoch: true,
    rendererHitRequiresExactSourceId: true,
    combinedWorkstationRequired: true,
    canonicalAuthority: false,
    productionDefault: false,
    productionReleaseAuthorized: false,
    seslitabCutoverAuthorized: false,
    manualDeviceValidationRequired: true
  });

  await writeFile(
    path.join(outputDir, MANIFEST),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );

  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const runtimeDir = process.env.ST_SCORE_RENDERER_RUNTIME_DIR;
  const refreshRendererRuntime = process.env.ST_APP09B_REFRESH_RENDERER_RUNTIME === '1';
  const result = await assembleP10_1ProfessionalWorkstationRendererPreview({
    runtimeDir,
    refreshRendererRuntime
  });
  const source = refreshRendererRuntime ? 'refreshed exact renderer' : 'provided renderer';
  console.log(
    `P10-1 renderer qualification preview: PASS (${result.renderer.rendererSourceRevision}, OSMD ${result.renderer.osmdVersion}, ${source})`
  );
}
