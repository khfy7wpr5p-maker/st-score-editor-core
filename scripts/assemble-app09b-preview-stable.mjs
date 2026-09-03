import { execFile } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  APP09B_RENDERER_SOURCE_REVISION,
  assembleApp09BPreview
} from './assemble-app09b-preview.mjs';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const defaultOutputDir = path.join(repoRoot, 'dist', 'browser');
const execFileAsync = promisify(execFile);
const rendererRepo = 'https://github.com/khfy7wpr5p-maker/st-score-rendering-layer.git';

const movingBridge = `  const nativeReplaceChildren = root.replaceChildren.bind(root);
  root.replaceChildren = (...nodes) => {
    if (frame.isConnected && root.contains(frame)) parking.append(frame);
    nativeReplaceChildren(...nodes);
    const viewport = root.querySelector('[data-st-score-editor-viewport]');
    if (viewport instanceof HTMLElement) {
      viewport.replaceChildren(frame);
      viewport.setAttribute('data-app09b-exact-renderer-mounted', 'true');
    } else if (!frame.isConnected) {
      parking.append(frame);
    }
  };`;

const stableBridge = `  const nativeReplaceChildren = root.replaceChildren.bind(root);
  const reconcileStableRendererShell = (nextApp) => {
    const currentApp = root.querySelector(':scope > .stse-app');
    const currentViewport = root.querySelector('[data-st-score-editor-viewport]');
    if (!(currentApp instanceof HTMLElement) || !(currentViewport instanceof HTMLElement) || !currentViewport.contains(frame)) return false;
    if (!(nextApp instanceof HTMLElement) || !nextApp.classList.contains('stse-app')) return false;

    for (const selector of ['.stse-toolbar', '.stse-keypad', '.stse-side', '.stse-status']) {
      const currentNode = currentApp.querySelector(selector);
      const nextNode = nextApp.querySelector(selector);
      if (!(currentNode instanceof HTMLElement) || !(nextNode instanceof HTMLElement)) return false;
      currentNode.replaceWith(nextNode);
    }
    currentApp.className = nextApp.className;
    for (const attribute of [...currentApp.attributes]) {
      if (attribute.name !== 'class' && !nextApp.hasAttribute(attribute.name)) currentApp.removeAttribute(attribute.name);
    }
    for (const attribute of [...nextApp.attributes]) {
      if (attribute.name !== 'class') currentApp.setAttribute(attribute.name, attribute.value);
    }
    currentViewport.setAttribute('data-app09b-exact-renderer-mounted', 'true');
    return true;
  };

  root.replaceChildren = (...nodes) => {
    if (nodes.length === 1 && reconcileStableRendererShell(nodes[0])) {
      document.documentElement.dataset.app09bRendererFrameStable = 'true';
      return;
    }
    if (nodes.length === 0) {
      if (frame.isConnected && root.contains(frame)) parking.append(frame);
      nativeReplaceChildren();
      return;
    }
    if (root.querySelector('[data-st-score-editor-viewport]')?.contains(frame)) {
      throw new Error('APP09B_RENDERER_FRAME_REPARENT_BLOCKED');
    }
    nativeReplaceChildren(...nodes);
    const viewport = root.querySelector('[data-st-score-editor-viewport]');
    if (!(viewport instanceof HTMLElement)) throw new Error('APP09B_RENDERER_VIEWPORT_MISSING');
    viewport.replaceChildren(frame);
    viewport.setAttribute('data-app09b-exact-renderer-mounted', 'true');
    document.documentElement.dataset.app09bRendererFrameStable = 'armed';
  };`;

export async function assembleStableApp09BPreview({ runtimeDir, outputDir = defaultOutputDir } = {}) {
  const manifest = await assembleApp09BPreview({ runtimeDir, outputDir });
  const bootstrapPath = path.join(outputDir, 'st-score-editor-app09b-bootstrap.js');
  const bootstrap = await readFile(bootstrapPath, 'utf8');
  const occurrences = bootstrap.split(movingBridge).length - 1;
  if (occurrences !== 1) {
    throw new Error(`APP09B stable iframe patch expected one moving bridge, observed ${occurrences}.`);
  }
  const patched = bootstrap.replace(movingBridge, stableBridge);
  await writeFile(bootstrapPath, patched, 'utf8');
  return manifest;
}

async function refreshExactRendererRuntime() {
  const root = path.join(process.env.TMPDIR || '/tmp', 'st-score-rendering-layer-app09b-exact');
  await rm(root, { recursive: true, force: true });
  await execFileAsync('git', ['clone', rendererRepo, root], { cwd: repoRoot, maxBuffer: 8 * 1024 * 1024 });
  await execFileAsync('git', ['checkout', '--detach', APP09B_RENDERER_SOURCE_REVISION], {
    cwd: root,
    maxBuffer: 8 * 1024 * 1024
  });
  await execFileAsync(
    'npm',
    ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock'],
    { cwd: root, maxBuffer: 16 * 1024 * 1024 }
  );
  await execFileAsync('npm', ['run', 'export:workstation-runtime'], {
    cwd: root,
    maxBuffer: 16 * 1024 * 1024,
    env: {
      ...process.env,
      ST_SCORE_RENDERER_SOURCE_REVISION: APP09B_RENDERER_SOURCE_REVISION
    }
  });
  return path.join(root, 'dist', 'workstation-runtime');
}

export async function assembleStableApp09BPreviewCli({
  runtimeDir,
  outputDir = defaultOutputDir,
  includeIosDiagnostic = process.env.ST_APP09B_IOS_DEVICE_DIAGNOSTIC === '1',
  refreshRendererRuntime = process.env.ST_APP09B_REFRESH_RENDERER_RUNTIME === '1'
} = {}) {
  const exactRuntimeDir = refreshRendererRuntime ? await refreshExactRendererRuntime() : runtimeDir;
  if (!includeIosDiagnostic) return assembleStableApp09BPreview({ runtimeDir: exactRuntimeDir, outputDir });

  await execFileAsync(
    process.execPath,
    [path.join(repoRoot, 'scripts', 'assemble-app09b-ios-device-diagnostic.mjs')],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        ST_SCORE_RENDERER_RUNTIME_DIR: exactRuntimeDir ?? '',
        ST_APP09B_OUTPUT_DIR: outputDir
      }
    }
  );

  const manifest = JSON.parse(
    await readFile(path.join(outputDir, 'st-score-editor-app09b.manifest.json'), 'utf8')
  );
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const runtimeDir = process.env.ST_SCORE_RENDERER_RUNTIME_DIR;
  const includeIosDiagnostic = process.env.ST_APP09B_IOS_DEVICE_DIAGNOSTIC === '1';
  const refreshRendererRuntime = process.env.ST_APP09B_REFRESH_RENDERER_RUNTIME === '1';
  const result = await assembleStableApp09BPreviewCli({ runtimeDir, includeIosDiagnostic, refreshRendererRuntime });
  const mode = includeIosDiagnostic ? 'stable preview + iOS device diagnostic' : 'stable preview';
  const source = refreshRendererRuntime ? 'refreshed exact renderer' : 'provided renderer';
  console.log(`APP-09B ${mode} assembly: PASS (${result.renderer.rendererSourceRevision}, OSMD ${result.renderer.osmdVersion}, ${source}, autoResize=false controlled-host)`);
}
