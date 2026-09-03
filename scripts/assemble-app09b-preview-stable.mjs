import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleApp09BPreview } from './assemble-app09b-preview.mjs';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const defaultOutputDir = path.join(repoRoot, 'dist', 'browser');

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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const runtimeDir = process.env.ST_SCORE_RENDERER_RUNTIME_DIR;
  const result = await assembleStableApp09BPreview({ runtimeDir });
  console.log(`APP-09B stable preview assembly: PASS (${result.renderer.rendererSourceRevision}, OSMD ${result.renderer.osmdVersion})`);
}
