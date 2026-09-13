import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleStableApp09BPreviewCli } from './assemble-app09b-preview-stable.mjs';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const defaultOutputDir = path.join(repoRoot, 'dist', 'browser');

const legacyMissGuard = `      if (hit.kind === 'MISS') {
        if (hit.reason !== 'NO_NOTE_OWNER') {
          mark('app09bLastHit', 'miss');
          return;
        }
        try {`;

const hardenedMissGuard = `      if (hit.kind === 'MISS') {
        const childDocument = frame.contentDocument;
        const ChildElement = childDocument?.defaultView?.Element;
        const initialElement = childDocument?.elementFromPoint?.(clientX, clientY) ?? null;
        let currentElement = ChildElement && initialElement instanceof ChildElement ? initialElement : null;
        let renderedStaveEntry = false;
        while (currentElement !== null) {
          if (currentElement.classList?.contains('vf-stavenote')) {
            renderedStaveEntry = true;
            break;
          }
          currentElement = currentElement.parentElement;
        }
        const boundedUnmappedRestEvidence = hit.reason === 'UNMAPPED_ELEMENT' && renderedStaveEntry;
        if (hit.reason !== 'NO_NOTE_OWNER' && !boundedUnmappedRestEvidence) {
          mark('app09bLastHit', 'miss-' + String(hit.reason).toLowerCase());
          return;
        }

        const outerViewport = root.querySelector('[data-st-score-editor-viewport]');
        const childScrollNodes = childDocument === null
          ? []
          : [
              childDocument.scrollingElement,
              childDocument.documentElement,
              childDocument.body,
              childDocument.getElementById('st-score-root')
            ].filter((node, index, nodes) => node !== null && nodes.indexOf(node) === index);
        const presentationScroll = Object.freeze({
          outer: outerViewport instanceof HTMLElement
            ? Object.freeze({ node: outerViewport, left: outerViewport.scrollLeft, top: outerViewport.scrollTop })
            : null,
          child: Object.freeze(childScrollNodes.map((node) => Object.freeze({
            node,
            left: node.scrollLeft,
            top: node.scrollTop
          })))
        });
        const restoreScrollEntry = (entry) => {
          const maxLeft = Math.max(0, entry.node.scrollWidth - entry.node.clientWidth);
          const maxTop = Math.max(0, entry.node.scrollHeight - entry.node.clientHeight);
          entry.node.scrollLeft = Math.max(0, Math.min(maxLeft, entry.left));
          entry.node.scrollTop = Math.max(0, Math.min(maxTop, entry.top));
        };
        const restorePresentationScroll = () => {
          if (presentationScroll.outer !== null) restoreScrollEntry(presentationScroll.outer);
          for (const entry of presentationScroll.child) restoreScrollEntry(entry);
        };

        try {`;

const legacySelectedRestMark = `            mark('app09bLastHit', 'selected-rest');`;
const hardenedSelectedRestMark = `            restorePresentationScroll();
            globalThis.requestAnimationFrame?.(() => restorePresentationScroll());
            frame.contentWindow?.requestAnimationFrame?.(() => restorePresentationScroll());
            mark('app09bLastHit', 'selected-rest-' + String(hit.reason).toLowerCase());
            mark('app09bRestScrollPreserved', 'true');`;

const controllerPublishedMarker = `  Object.defineProperty(globalThis, 'STScoreEditorAppController', { value: controller, writable: false, configurable: false });`;
const teacherActionScrollPatch = `${controllerPublishedMarker}

  const captureTeacherActionPresentation = () => {
    const outerViewport = root.querySelector('[data-st-score-editor-viewport]');
    const toolbar = root.querySelector('[data-st-mobile-teacher-toolbar]');
    const childDocument = frame.contentDocument;
    const childScrollNodes = childDocument === null
      ? []
      : [
          childDocument.scrollingElement,
          childDocument.documentElement,
          childDocument.body,
          childDocument.getElementById('st-score-root')
        ].filter((node, index, nodes) => node !== null && nodes.indexOf(node) === index);
    return Object.freeze({
      outer: outerViewport instanceof HTMLElement
        ? Object.freeze({ node: outerViewport, left: outerViewport.scrollLeft, top: outerViewport.scrollTop })
        : null,
      toolbar: toolbar instanceof HTMLElement
        ? Object.freeze({ left: toolbar.scrollLeft, top: toolbar.scrollTop })
        : null,
      child: Object.freeze(childScrollNodes.map((node) => Object.freeze({
        node,
        left: node.scrollLeft,
        top: node.scrollTop
      })))
    });
  };

  const restoreTeacherActionEntry = (entry) => {
    const maxLeft = Math.max(0, entry.node.scrollWidth - entry.node.clientWidth);
    const maxTop = Math.max(0, entry.node.scrollHeight - entry.node.clientHeight);
    entry.node.scrollLeft = Math.max(0, Math.min(maxLeft, entry.left));
    entry.node.scrollTop = Math.max(0, Math.min(maxTop, entry.top));
  };

  const restoreTeacherActionPresentation = (snapshot) => {
    if (snapshot.outer !== null) restoreTeacherActionEntry(snapshot.outer);
    for (const entry of snapshot.child) restoreTeacherActionEntry(entry);
    const currentToolbar = root.querySelector('[data-st-mobile-teacher-toolbar]');
    if (snapshot.toolbar !== null && currentToolbar instanceof HTMLElement) {
      const maxLeft = Math.max(0, currentToolbar.scrollWidth - currentToolbar.clientWidth);
      const maxTop = Math.max(0, currentToolbar.scrollHeight - currentToolbar.clientHeight);
      currentToolbar.scrollLeft = Math.max(0, Math.min(maxLeft, snapshot.toolbar.left));
      currentToolbar.scrollTop = Math.max(0, Math.min(maxTop, snapshot.toolbar.top));
    }
  };

  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('[data-st-mobile-teacher-toolbar] button');
    if (!(button instanceof HTMLElement) || button.hasAttribute('disabled')) return;
    const snapshot = captureTeacherActionPresentation();
    queueMicrotask(() => {
      restoreTeacherActionPresentation(snapshot);
      globalThis.requestAnimationFrame?.(() => restoreTeacherActionPresentation(snapshot));
      frame.contentWindow?.requestAnimationFrame?.(() => restoreTeacherActionPresentation(snapshot));
      globalThis.setTimeout?.(() => restoreTeacherActionPresentation(snapshot), 50);
      mark('app09bTeacherActionScrollPreserved', 'true');
    });
  }, true);`;

export const hardenStableRestTouchEvidence = (bootstrap) => {
  const guardOccurrences = bootstrap.split(legacyMissGuard).length - 1;
  if (guardOccurrences !== 1) {
    throw new Error(`APP09B rest-touch v2 expected one legacy MISS guard, observed ${guardOccurrences}.`);
  }
  const selectedOccurrences = bootstrap.split(legacySelectedRestMark).length - 1;
  if (selectedOccurrences !== 1) {
    throw new Error(`APP09B rest-touch v2 expected one selected-rest marker, observed ${selectedOccurrences}.`);
  }
  return bootstrap
    .replace(legacyMissGuard, hardenedMissGuard)
    .replace(legacySelectedRestMark, hardenedSelectedRestMark);
};

export const preserveMobileTeacherActionScroll = (bootstrap) => {
  const occurrences = bootstrap.split(controllerPublishedMarker).length - 1;
  if (occurrences !== 1) {
    throw new Error(`APP09B teacher-action scroll patch expected one controller publication marker, observed ${occurrences}.`);
  }
  return bootstrap.replace(controllerPublishedMarker, teacherActionScrollPatch);
};

export async function assembleStableRestV2PreviewCli({
  runtimeDir,
  outputDir = defaultOutputDir,
  includeIosDiagnostic = process.env.ST_APP09B_IOS_DEVICE_DIAGNOSTIC === '1',
  refreshRendererRuntime = process.env.ST_APP09B_REFRESH_RENDERER_RUNTIME === '1'
} = {}) {
  const result = await assembleStableApp09BPreviewCli({
    runtimeDir,
    outputDir,
    includeIosDiagnostic,
    refreshRendererRuntime
  });
  const bootstrapPath = path.join(outputDir, 'st-score-editor-app09b-bootstrap.js');
  const bootstrap = await readFile(bootstrapPath, 'utf8');
  const hardened = hardenStableRestTouchEvidence(bootstrap);
  const preserved = preserveMobileTeacherActionScroll(hardened);
  await writeFile(bootstrapPath, preserved, 'utf8');
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const runtimeDir = process.env.ST_SCORE_RENDERER_RUNTIME_DIR;
  const includeIosDiagnostic = process.env.ST_APP09B_IOS_DEVICE_DIAGNOSTIC === '1';
  const refreshRendererRuntime = process.env.ST_APP09B_REFRESH_RENDERER_RUNTIME === '1';
  const result = await assembleStableRestV2PreviewCli({ runtimeDir, includeIosDiagnostic, refreshRendererRuntime });
  const source = refreshRendererRuntime ? 'refreshed exact renderer' : 'provided renderer';
  console.log(`APP-09B stable rest-touch v2 assembly: PASS (${result.renderer.rendererSourceRevision}, OSMD ${result.renderer.osmdVersion}, ${source}, unique-rest fail-closed, mobile-scroll-preserved, teacher-actions-scroll-preserved)`);
}
