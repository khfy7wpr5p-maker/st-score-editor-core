import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleApp09BPreview } from './assemble-app09b-preview.mjs';

export const APP09B_AUDIO_PREVIEW_VERSION = '1.0.0';
export const APP09B_AUDIO_BUNDLE = 'st-score-audio-engine.js';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const defaultOutputDir = path.join(repoRoot, 'dist', 'browser');

const ensureRegularFile = async absolute => {
  const info = await stat(absolute);
  if (!info.isFile()) throw new Error(`Expected regular file: ${absolute}`);
};

const patchBootstrap = source => {
  const controllerNeedle = "  const controller = globalThis.STScoreEditorApp.createController({ rendererProfile: integrationProfile });\n  controller.mount(root);\n";
  if (!source.includes(controllerNeedle)) throw new Error('APP09B_AUDIO_CONTROLLER_HOOK_MISSING');
  const controllerPatch = `${controllerNeedle}\n  const audioApi = globalThis.STScoreAudioEngine;\n  if (!audioApi || typeof audioApi.createAudioEngine !== 'function' || typeof controller.attachAudioPort !== 'function') {\n    throw new Error('APP09B_AUDIO_ENGINE_HOST_UNAVAILABLE');\n  }\n  const audioEngine = audioApi.createAudioEngine();\n  controller.attachAudioPort(Object.freeze({\n    unlockFromUserGesture: () => audioEngine.unlockFromUserGesture(),\n    setInstrument: instrumentId => audioEngine.setInstrument(instrumentId),\n    audition: request => audioEngine.audition(request)\n  }));\n  Object.defineProperty(globalThis, 'STScoreEditorAudioEngine', { value: audioEngine, writable: false, configurable: false });\n`;

  const selectionNeedle = "        controller.selectRenderedScoreNoteRef(hit.target);\n";
  if (!source.includes(selectionNeedle)) throw new Error('APP09B_AUDIO_SELECTION_HOOK_MISSING');
  const selectionPatch = "        const auditionResult = await controller.selectRenderedScoreNoteRefWithAudition(hit.target);\n        document.documentElement.dataset.app09bAudioStatus = auditionResult.audioStatus.toLowerCase();\n        if (auditionResult.audioError) document.documentElement.dataset.app09bAudioError = auditionResult.audioError.code;\n        else delete document.documentElement.dataset.app09bAudioError;\n";

  return source.replace(controllerNeedle, controllerPatch).replace(selectionNeedle, selectionPatch);
};

const patchHtml = source => {
  const editorScript = '<script src="./st-score-editor-app.js"></script>';
  if (!source.includes(editorScript)) throw new Error('APP09B_AUDIO_EDITOR_SCRIPT_HOOK_MISSING');
  const withAudioScript = source.replace(
    editorScript,
    '<script src="./audio-runtime/st-score-audio-engine.js"></script>\n<script src="./st-score-editor-app.js"></script>'
  );
  return withAudioScript
    .replace("connect-src 'none';", "connect-src https://raw.githubusercontent.com;")
    .replace('./st-score-editor-app09b-bootstrap.js', './st-score-editor-app09b-audio-bootstrap.js')
    .replace('<title>ST Score Editor APP-09B Test</title>', '<title>ST Score Editor APP-09B Audio Test</title>');
};

export async function assembleApp09BAudioPreview({ runtimeDir, audioRuntimeDir, outputDir = defaultOutputDir } = {}) {
  if (typeof audioRuntimeDir !== 'string' || audioRuntimeDir.length === 0) {
    throw new TypeError('APP09B audio runtime directory is required.');
  }
  const audioBundlePath = path.join(audioRuntimeDir, APP09B_AUDIO_BUNDLE);
  await ensureRegularFile(audioBundlePath);

  const baseManifest = await assembleApp09BPreview({ runtimeDir, outputDir });
  const audioTarget = path.join(outputDir, 'audio-runtime');
  await mkdir(audioTarget, { recursive: true });
  await cp(audioBundlePath, path.join(audioTarget, APP09B_AUDIO_BUNDLE));

  const baseBootstrapPath = path.join(outputDir, 'st-score-editor-app09b-bootstrap.js');
  const baseHtmlPath = path.join(outputDir, 'st-score-editor-app09b.html');
  const patchedBootstrap = patchBootstrap(await readFile(baseBootstrapPath, 'utf8'));
  const patchedHtml = patchHtml(await readFile(baseHtmlPath, 'utf8'));
  await writeFile(path.join(outputDir, 'st-score-editor-app09b-audio-bootstrap.js'), patchedBootstrap, 'utf8');
  await writeFile(path.join(outputDir, 'st-score-editor-app09b-audio.html'), patchedHtml, 'utf8');

  const manifest = Object.freeze({
    ...baseManifest,
    contract: 'ST_SCORE_EDITOR_APP09B_AUDIO_PREVIEW',
    version: APP09B_AUDIO_PREVIEW_VERSION,
    entryHtml: 'st-score-editor-app09b-audio.html',
    audioRuntimeDirectory: 'audio-runtime',
    audioArtifact: APP09B_AUDIO_BUNDLE,
    audioGlobal: 'STScoreAudioEngine',
    audioEngineBundledIntoEditorCore: false,
    audioHostAttachedByPreview: true,
    noteTouchAudition: 'canonical-note-only',
    auditionInstruments: Object.freeze(['GRAND_PIANO', 'CLASSICAL_GUITAR']),
    restAudition: 'no-request',
    auditionHistoryMutationAuthority: false,
    rendererAudioAuthority: false,
    sampleHosts: Object.freeze(['https://raw.githubusercontent.com'])
  });
  await writeFile(path.join(outputDir, 'st-score-editor-app09b-audio.manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}
