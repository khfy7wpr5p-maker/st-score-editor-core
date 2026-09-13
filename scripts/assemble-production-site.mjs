import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleStableApp09BPreviewCli } from './assemble-app09b-preview-stable.mjs';

export const PRODUCTION_SITE_VERSION = '1.0.0';
export const AUDIO_RELEASE = 'v0.1.0';
export const AUDIO_RELEASE_COMMIT = 'd11a2dd9141169ddfec5901f3cadc4cce0d7b345';
export const AUDIO_RELEASE_ASSET_SHA256 = '0f25713f481c42d7a1909e15f968635202d3247203402d8f9f95c19a0a0fb99c';
export const AUDIO_BUNDLE = 'st-score-audio-engine.js';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const defaultOutputDir = path.join(repoRoot, 'dist', 'browser');

const ensureRegularFile = async absolute => {
  const info = await stat(absolute);
  if (!info.isFile()) throw new Error(`Expected regular file: ${absolute}`);
};

const patchBootstrap = source => {
  const controllerNeedle = "  const controller = globalThis.STScoreEditorApp.createController({ rendererProfile: integrationProfile });\n  controller.mount(root);\n";
  if (!source.includes(controllerNeedle)) throw new Error('PRODUCTION_AUDIO_CONTROLLER_HOOK_MISSING');
  const controllerPatch = `${controllerNeedle}\n  const audioApi = globalThis.STScoreAudioEngine;\n  if (!audioApi || audioApi.version !== '0.1.0' || typeof audioApi.createAudioEngine !== 'function' || typeof controller.attachAudioPort !== 'function') {\n    throw new Error('PRODUCTION_AUDIO_ENGINE_HOST_UNAVAILABLE');\n  }\n  const audioEngine = audioApi.createAudioEngine({ defaultInstrument: 'GRAND_PIANO' });\n  controller.attachAudioPort(audioEngine);\n  Object.defineProperty(globalThis, 'STScoreEditorAudioEngine', { value: audioEngine, writable: false, configurable: false });\n`;

  const selectionNeedle = "        controller.selectRenderedScoreNoteRef(hit.target);\n";
  if (!source.includes(selectionNeedle)) throw new Error('PRODUCTION_AUDIO_SELECTION_HOOK_MISSING');
  const selectionPatch = "        const auditionResult = await controller.selectRenderedScoreNoteRefWithAudition(hit.target);\n        document.documentElement.dataset.stScoreAudioStatus = auditionResult.audioStatus.toLowerCase();\n        if (auditionResult.audioError) document.documentElement.dataset.stScoreAudioError = auditionResult.audioError.code;\n        else delete document.documentElement.dataset.stScoreAudioError;\n";

  return source.replace(controllerNeedle, controllerPatch).replace(selectionNeedle, selectionPatch);
};

const patchHtml = source => {
  const editorScript = '<script src="./st-score-editor-app.js"></script>';
  if (!source.includes(editorScript)) throw new Error('PRODUCTION_AUDIO_EDITOR_SCRIPT_HOOK_MISSING');
  return source
    .replace(editorScript, '<script src="./audio-runtime/st-score-audio-engine.js"></script>\n<script src="./st-score-editor-app.js"></script>')
    .replace("connect-src 'none';", "connect-src https://raw.githubusercontent.com;")
    .replace('./st-score-editor-app09b-bootstrap.js', './st-score-editor-production-bootstrap.js')
    .replace('<title>ST Score Editor APP-09B Test</title>', '<title>ST Score Editor</title>');
};

export async function assembleProductionSite({
  audioRuntimeDir,
  outputDir = defaultOutputDir,
  refreshRendererRuntime = true
} = {}) {
  if (typeof audioRuntimeDir !== 'string' || audioRuntimeDir.length === 0) {
    throw new TypeError('Production audio runtime directory is required.');
  }
  const audioBundlePath = path.join(audioRuntimeDir, AUDIO_BUNDLE);
  await ensureRegularFile(audioBundlePath);

  const baseManifest = await assembleStableApp09BPreviewCli({
    outputDir,
    includeIosDiagnostic: false,
    refreshRendererRuntime
  });

  const audioTarget = path.join(outputDir, 'audio-runtime');
  await mkdir(audioTarget, { recursive: true });
  await cp(audioBundlePath, path.join(audioTarget, AUDIO_BUNDLE));

  const baseBootstrapPath = path.join(outputDir, 'st-score-editor-app09b-bootstrap.js');
  const baseHtmlPath = path.join(outputDir, 'st-score-editor-app09b.html');
  const bootstrap = patchBootstrap(await readFile(baseBootstrapPath, 'utf8'));
  const html = patchHtml(await readFile(baseHtmlPath, 'utf8'));

  await writeFile(path.join(outputDir, 'st-score-editor-production-bootstrap.js'), bootstrap, 'utf8');
  await writeFile(path.join(outputDir, 'index.html'), html, 'utf8');

  const manifest = Object.freeze({
    contract: 'ST_SCORE_EDITOR_PRODUCTION_SITE',
    version: PRODUCTION_SITE_VERSION,
    editorSource: 'main',
    entryHtml: 'index.html',
    renderer: baseManifest.renderer,
    audio: Object.freeze({
      release: AUDIO_RELEASE,
      releaseCommit: AUDIO_RELEASE_COMMIT,
      releaseAssetSha256: AUDIO_RELEASE_ASSET_SHA256,
      runtimeDirectory: 'audio-runtime',
      artifact: AUDIO_BUNDLE,
      global: 'STScoreAudioEngine',
      attachedByHost: true,
      qualifiedInstruments: Object.freeze(['GRAND_PIANO']),
      suspendedInstruments: Object.freeze(['CLASSICAL_GUITAR']),
      restAudition: 'no-request',
      staleRevision: 'fail-closed',
      canonicalMutationAuthority: false,
      historyMutationAuthority: false,
      rendererAuthority: false,
      sampleHosts: Object.freeze(['https://raw.githubusercontent.com'])
    }),
    productionDeploymentAuthorized: true,
    seslitabCutoverAuthorized: false,
    manualDeviceValidationRequired: true
  });
  await writeFile(path.join(outputDir, 'st-score-editor-production.manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await assembleProductionSite({
    audioRuntimeDir: process.env.ST_SCORE_AUDIO_RUNTIME_DIR,
    outputDir: process.env.ST_PRODUCTION_OUTPUT_DIR || defaultOutputDir,
    refreshRendererRuntime: process.env.ST_PRODUCTION_REFRESH_RENDERER_RUNTIME !== '0'
  });
  console.log(`ST Score Editor production assembly: PASS (${result.audio.release}, renderer ${result.renderer.rendererSourceRevision})`);
}
