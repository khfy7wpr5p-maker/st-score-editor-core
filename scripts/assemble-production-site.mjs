import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleStableApp09BPreviewCli } from './assemble-app09b-preview-stable.mjs';
import { ensureProductionAudioRuntime } from './ensure-production-audio-runtime.mjs';

export const PRODUCTION_SITE_VERSION = '1.2.0';
export const AUDIO_RELEASE = 'v0.1.1';
export const AUDIO_RELEASE_COMMIT = '61d2b0a161d949588bb1bbd3c01caf819f03ec72';
export const AUDIO_RELEASE_ASSET_SHA256 = 'd997c6de77436ac3d7463e079904e5d29e52a06a30460330a6f1444ac0469092';
export const AUDIO_RELEASE_URL = 'https://github.com/khfy7wpr5p-maker/st-score-audio-engine/releases/download/v0.1.1/st-score-audio-engine.browser.v0.1.1.js';
export const AUDIO_BUNDLE = 'st-score-audio-engine.js';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const defaultOutputDir = path.join(repoRoot, 'dist', 'browser');

const ensureRegularFile = async absolute => {
  const info = await stat(absolute);
  if (!info.isFile()) throw new Error(`Expected regular file: ${absolute}`);
};

const patchBootstrap = source => {
  const controllerAnchor = "  Object.defineProperty(globalThis, 'STScoreEditorAppController', { value: controller, writable: false, configurable: false });";
  const controllerOccurrences = source.split(controllerAnchor).length - 1;
  if (controllerOccurrences !== 1) {
    throw new Error(`PRODUCTION_AUDIO_CONTROLLER_HOOK_MISSING:${controllerOccurrences}`);
  }
  const controllerPatch = `${controllerAnchor}\n\n  const audioApi = globalThis.STScoreAudioEngine;\n  if (!audioApi || audioApi.version !== '0.1.1' || typeof audioApi.createAudioEngine !== 'function' || typeof controller.attachAudioPort !== 'function') {\n    throw new Error('PRODUCTION_AUDIO_ENGINE_HOST_UNAVAILABLE');\n  }\n  const audioEngine = audioApi.createAudioEngine({ defaultInstrument: 'GRAND_PIANO' });\n  controller.attachAudioPort(audioEngine);\n  Object.defineProperty(globalThis, 'STScoreEditorAudioEngine', { value: audioEngine, writable: false, configurable: false });\n  let latestAudioInteractionSequence = 0;\n  if (typeof audioEngine.prepare === 'function') {\n    document.documentElement.dataset.stScoreAudioWarmup = 'loading';\n    void audioEngine.prepare().then(\n      () => { document.documentElement.dataset.stScoreAudioWarmup = 'ready'; },\n      () => { document.documentElement.dataset.stScoreAudioWarmup = 'failed'; }\n    );\n  }`;

  const selectionNeedle = "        controller.selectRenderedScoreNoteRef(hit.target);\n";
  const selectionOccurrences = source.split(selectionNeedle).length - 1;
  if (selectionOccurrences !== 1) {
    throw new Error(`PRODUCTION_AUDIO_SELECTION_HOOK_MISSING:${selectionOccurrences}`);
  }
  const selectionPatch = "        const audioInteractionSequence = ++latestAudioInteractionSequence;\n        const audioInteractionStartedAt = globalThis.performance?.now?.() ?? Date.now();\n        const auditionPromise = controller.selectRenderedScoreNoteRefWithAudition(hit.target);\n        document.documentElement.dataset.stScoreSelectionDispatchMs = String(Math.max(0, (globalThis.performance?.now?.() ?? Date.now()) - audioInteractionStartedAt));\n        void auditionPromise.then(\n          (auditionResult) => {\n            if (audioInteractionSequence !== latestAudioInteractionSequence) return;\n            document.documentElement.dataset.stScoreAudioStatus = auditionResult.audioStatus.toLowerCase();\n            if (auditionResult.audioError) document.documentElement.dataset.stScoreAudioError = auditionResult.audioError.code;\n            else delete document.documentElement.dataset.stScoreAudioError;\n            document.documentElement.dataset.stScoreAudioLatencyMs = String(Math.max(0, (globalThis.performance?.now?.() ?? Date.now()) - audioInteractionStartedAt));\n          },\n          () => {\n            if (audioInteractionSequence !== latestAudioInteractionSequence) return;\n            document.documentElement.dataset.stScoreAudioStatus = 'failed';\n            document.documentElement.dataset.stScoreAudioError = 'AUDIO_AUDITION_REJECTED';\n            document.documentElement.dataset.stScoreAudioLatencyMs = String(Math.max(0, (globalThis.performance?.now?.() ?? Date.now()) - audioInteractionStartedAt));\n          }\n        );\n";

  return source.replace(controllerAnchor, controllerPatch).replace(selectionNeedle, selectionPatch);
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
  runtimeDir,
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
    runtimeDir,
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
      releaseUrl: AUDIO_RELEASE_URL,
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
      sampleHosts: Object.freeze(['https://raw.githubusercontent.com']),
      latencyHardening: Object.freeze({
        selectionCriticalPath: 'non-blocking-audio',
        preloadStrategy: 'grand-piano-raw-prepare-plus-decoded-warm-cache',
        decodedWarmCache: 'audio-engine-v0.1.1-after-unlock',
        inflightDedupe: 'raw-fetch-and-audio-decode',
        rapidTapStatusPolicy: 'latest-request-wins',
        selectionDispatchMetric: 'stScoreSelectionDispatchMs',
        audioLatencyMetric: 'stScoreAudioLatencyMs'
      })
    }),
    productionDeploymentAuthorized: true,
    seslitabCutoverAuthorized: false,
    manualDeviceValidationRequired: true
  });
  await writeFile(path.join(outputDir, 'st-score-editor-production.manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const audioRuntimeDir = process.env.ST_SCORE_AUDIO_RUNTIME_DIR;
  const ensured = await ensureProductionAudioRuntime({
    audioRuntimeDir,
    bundleName: AUDIO_BUNDLE,
    releaseUrl: AUDIO_RELEASE_URL,
    expectedSha256: AUDIO_RELEASE_ASSET_SHA256
  });
  console.log(`ST Score Editor production audio runtime: ${ensured.source} (${ensured.sha256})`);
  const result = await assembleProductionSite({
    runtimeDir: process.env.ST_SCORE_RENDERER_RUNTIME_DIR,
    audioRuntimeDir,
    outputDir: process.env.ST_PRODUCTION_OUTPUT_DIR || defaultOutputDir,
    refreshRendererRuntime: process.env.ST_PRODUCTION_REFRESH_RENDERER_RUNTIME !== '0'
  });
  console.log(`ST Score Editor production assembly: PASS (${result.audio.release}, renderer ${result.renderer.rendererSourceRevision})`);
}
