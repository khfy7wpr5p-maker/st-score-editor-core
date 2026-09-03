import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assembleStableApp09BPreview } from './assemble-app09b-preview-stable.mjs';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const defaultOutputDir = path.join(repoRoot, 'dist', 'browser');

export const APP09B_IOS_DEVICE_DIAGNOSTIC_VERSION = '1.0.0';

export const iosDeviceDiagnosticSource = `(() => {
  'use strict';

  const STATUS_ID = 'st-app09b-ios-device-diagnostic';
  const frameSelector = '[data-app09b-renderer-frame]';
  const status = document.createElement('output');
  status.id = STATUS_ID;
  status.setAttribute('aria-live', 'polite');
  status.style.position = 'fixed';
  status.style.left = '8px';
  status.style.right = '8px';
  status.style.bottom = '8px';
  status.style.zIndex = '2147483647';
  status.style.padding = '6px 8px';
  status.style.borderRadius = '6px';
  status.style.background = 'rgba(0,0,0,.78)';
  status.style.color = 'white';
  status.style.font = '12px/1.25 -apple-system,BlinkMacSystemFont,sans-serif';
  status.style.pointerEvents = 'none';
  status.textContent = 'iPhone tanı: renderer bekleniyor';
  document.body.append(status);

  const setStatus = (value) => {
    const text = String(value).slice(0, 220);
    status.textContent = 'iPhone tanı: ' + text;
    document.documentElement.dataset.app09bIosDiagnostic = text;
  };

  let selectedAt = 0;
  let selectedX = Number.NaN;
  let selectedY = Number.NaN;
  const recentlySelected = (x, y) => {
    if (Date.now() - selectedAt > 700) return false;
    return Number.isFinite(selectedX) && Number.isFinite(selectedY) && Math.hypot(x - selectedX, y - selectedY) <= 12;
  };

  const pointFromEvent = (event) => {
    if (event.type === 'touchend') {
      const touch = event.changedTouches?.[0];
      if (!touch) return null;
      return { clientX: touch.clientX, clientY: touch.clientY };
    }
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return null;
    return { clientX: event.clientX, clientY: event.clientY };
  };

  const describeElementAt = (doc, x, y) => {
    const element = doc.elementFromPoint(x, y);
    if (!(element instanceof Element)) return 'none';
    const tag = element.tagName.toLowerCase();
    const cls = typeof element.getAttribute === 'function' ? element.getAttribute('class') : null;
    return cls ? tag + '.' + String(cls).trim().split(/\\s+/).slice(0, 2).join('.') : tag;
  };

  const handleInteraction = async (event) => {
    const point = pointFromEvent(event);
    if (point === null) {
      setStatus(event.type + ': koordinat yok');
      return;
    }
    if (recentlySelected(point.clientX, point.clientY)) return;

    const frame = document.querySelector(frameSelector);
    const child = frame instanceof HTMLIFrameElement ? frame.contentWindow : null;
    const doc = frame instanceof HTMLIFrameElement ? frame.contentDocument : null;
    const api = child?.__ST_SCORE_RENDER_HOST__;
    const bridge = globalThis.STScoreEditorApp09B;
    const controller = globalThis.STScoreEditorAppController;
    if (!doc || !api || !bridge || !controller) {
      setStatus(event.type + ': bridge unavailable');
      return;
    }

    const x = point.clientX;
    const y = point.clientY;
    const landed = describeElementAt(doc, x, y);
    setStatus(event.type + ': event ' + Math.round(x) + ',' + Math.round(y) + ' on ' + landed);

    const evidence = bridge.getState?.().renderEvidence ?? null;
    if (!evidence) {
      setStatus(event.type + ': render evidence yok');
      return;
    }

    let hit;
    try {
      hit = api.hitTestNoteDetailed({ clientX: x, clientY: y });
    } catch (error) {
      setStatus(event.type + ': hit rejected ' + String(error?.message ?? error));
      return;
    }

    if (!hit || hit.kind !== 'HIT') {
      setStatus(event.type + ': MISS ' + String(hit?.reason ?? 'unknown') + ' on ' + landed);
      return;
    }
    if (hit.renderEpoch !== evidence.renderEpoch || (hit.sourceId ?? null) !== (evidence.sourceId ?? null)) {
      setStatus(event.type + ': STALE hit');
      return;
    }

    try {
      controller.selectRenderedScoreNoteRef(hit.target);
      await api.clearHighlights();
      await api.highlight({ target: hit.target, className: 'st-score-highlight' });
      selectedAt = Date.now();
      selectedX = x;
      selectedY = y;
      document.documentElement.dataset.app09bLastHit = 'selected';
      setStatus(
        'SELECTED via ' + event.type + ' ' +
        String(hit.target?.partId ?? '?') + '/m' + String(hit.target?.measureIndex ?? '?') + '/n' + String(hit.target?.noteIndex ?? '?')
      );
    } catch (error) {
      setStatus(event.type + ': selection rejected ' + String(error?.code ?? error?.message ?? error));
    }
  };

  const attach = () => {
    const frame = document.querySelector(frameSelector);
    const doc = frame instanceof HTMLIFrameElement ? frame.contentDocument : null;
    const api = frame instanceof HTMLIFrameElement ? frame.contentWindow?.__ST_SCORE_RENDER_HOST__ : null;
    if (!doc || !api || !globalThis.STScoreEditorAppController || !globalThis.STScoreEditorApp09B) {
      setTimeout(attach, 100);
      return;
    }
    if (doc.documentElement.dataset.app09bIosDiagnosticAttached === 'true') return;
    doc.documentElement.dataset.app09bIosDiagnosticAttached = 'true';
    doc.addEventListener('pointerup', handleInteraction, true);
    doc.addEventListener('touchend', handleInteraction, true);
    doc.addEventListener('click', handleInteraction, true);
    setStatus('hazır — bir notaya dokun');
  };

  attach();
})();
`;

export function createIosDeviceDiagnosticHtml(baseHtml) {
  const marker = '<script src="./st-score-editor-app09b-bootstrap.js"></script>';
  const occurrences = baseHtml.split(marker).length - 1;
  if (occurrences !== 1) {
    throw new Error(`APP09B iOS diagnostic HTML expected one bootstrap marker, observed ${occurrences}.`);
  }
  return baseHtml.replace(
    marker,
    `${marker}\n<script src="./st-score-editor-app09b-ios-device-diagnostic.js"></script>`,
  );
}

export async function assembleIosDeviceDiagnosticApp09BPreview({ runtimeDir, outputDir = defaultOutputDir } = {}) {
  const manifest = await assembleStableApp09BPreview({ runtimeDir, outputDir });
  const baseHtml = await readFile(path.join(outputDir, 'st-score-editor-app09b.html'), 'utf8');
  const diagnosticHtml = createIosDeviceDiagnosticHtml(baseHtml);
  await writeFile(
    path.join(outputDir, 'st-score-editor-app09b-ios-device-diagnostic.js'),
    iosDeviceDiagnosticSource,
    'utf8',
  );
  await writeFile(
    path.join(outputDir, 'st-score-editor-app09b-ios-device-diagnostic.html'),
    diagnosticHtml,
    'utf8',
  );
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const runtimeDir = process.env.ST_SCORE_RENDERER_RUNTIME_DIR;
  const outputDir = process.env.ST_APP09B_OUTPUT_DIR || defaultOutputDir;
  const result = await assembleIosDeviceDiagnosticApp09BPreview({ runtimeDir, outputDir });
  console.log(
    `APP-09B iOS device diagnostic assembly: PASS (${result.renderer.rendererSourceRevision}, OSMD ${result.renderer.osmdVersion})`,
  );
}
