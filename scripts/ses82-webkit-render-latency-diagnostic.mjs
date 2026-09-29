import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webkit } from 'playwright';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const browserRoot = path.join(repoRoot, 'dist', 'browser');
const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.xml', 'application/xml; charset=utf-8'],
  ['.musicxml', 'application/xml; charset=utf-8']
]);

const resolveRequestPath = requestUrl => {
  const pathname = decodeURIComponent(new URL(requestUrl ?? '/', 'http://127.0.0.1').pathname);
  const resolved = path.resolve(browserRoot, pathname.replace(/^\/+/, '') || 'st-score-editor-app09b.html');
  if (resolved !== browserRoot && !resolved.startsWith(`${browserRoot}${path.sep}`)) throw new Error('request escaped browser output root');
  return resolved;
};

const server = createServer(async (request, response) => {
  try {
    const requestedPath = resolveRequestPath(request.url);
    const info = await stat(requestedPath);
    if (!info.isFile()) return void response.writeHead(404).end('not found');
    response.setHeader('Content-Type', contentTypes.get(path.extname(requestedPath)) ?? 'application/octet-stream');
    response.setHeader('Cache-Control', 'no-store');
    createReadStream(requestedPath).pipe(response);
  } catch {
    response.writeHead(404).end('not found');
  }
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const address = server.address();
if (address === null || typeof address === 'string') throw new Error('SES-82 diagnostic server did not expose a TCP port.');

let browser;
try {
  browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const page = await context.newPage();

  await page.goto(`http://127.0.0.1:${address.port}/st-score-editor-app09b.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.documentElement.dataset.app09bRendererReady === 'true', null, { timeout: 30000 });
  await page.waitForFunction(() => {
    const state = globalThis.STScoreEditorApp09B?.getState?.();
    return state?.snapshot?.revisionId !== null &&
      state?.snapshot?.revisionId === state?.renderer?.renderedRevisionId &&
      state?.renderer?.status?.code === 'RENDERED_CURRENT_REVISION';
  }, null, { timeout: 30000 });

  const selection = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const documentValue = controller.getDocument();
    const event = documentValue.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events[0];
    const target = documentValue.session.renderRequest.manifest.entries.find(entry => entry.address.kind === 'event' && entry.address.eventId === event.id)?.address;
    if (!target) throw new Error('SES82_DIAGNOSTIC_EVENT_TARGET_MISSING');
    const revisionBefore = controller.getSnapshot().revisionId;
    const appBefore = document.querySelector('[data-st-score-editor-app]');
    const startedAt = performance.now();
    const result = controller.select(target);
    const durationMs = performance.now() - startedAt;
    const appAfter = document.querySelector('[data-st-score-editor-app]');
    return {
      durationMs,
      revisionBefore,
      revisionAfter: result.revisionId,
      shellStable: appBefore === appAfter,
      target
    };
  });
  if (!selection.shellStable || selection.revisionBefore !== selection.revisionAfter) {
    throw new Error(`SES-82 selection invariant failed: ${JSON.stringify(selection)}`);
  }

  const edit = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const documentValue = controller.getDocument();
    const target = documentValue.session.selection;
    if (!target || (target.kind !== 'event' && target.kind !== 'note')) throw new Error('SES82_DIAGNOSTIC_SELECTION_MISSING');
    const eventTarget = target.kind === 'event'
      ? target
      : documentValue.session.renderRequest.manifest.entries.find(entry => entry.address.kind === 'event' && entry.address.eventId === target.eventId)?.address;
    if (!eventTarget || eventTarget.kind !== 'event') throw new Error('SES82_DIAGNOSTIC_EVENT_SELECTION_MISSING');
    globalThis.__SES82_EDIT_STARTED_AT__ = performance.now();
    const startedAt = performance.now();
    const result = controller.commitArticulation({
      version: '1.0.0',
      type: 'TOGGLE_ARTICULATION',
      target: eventTarget,
      value: { kind: 'staccato', placement: 'above', direction: null }
    }, { nextRevisionId: 'rev:ses82-diagnostic-edit' });
    return {
      dispatchMs: performance.now() - startedAt,
      revisionId: result.revisionId,
      error: result.error
    };
  });
  if (edit.error !== null) throw new Error(`SES-82 diagnostic edit failed: ${JSON.stringify(edit)}`);

  await page.waitForFunction(revisionId => {
    const state = globalThis.STScoreEditorApp09B?.getState?.();
    return state?.renderer?.renderedRevisionId === revisionId &&
      state?.renderer?.status?.code === 'RENDERED_CURRENT_REVISION';
  }, edit.revisionId, { timeout: 30000 });
  const editToRenderedMs = await page.evaluate(() => performance.now() - globalThis.__SES82_EDIT_STARTED_AT__);

  const isolated = await page.evaluate(async () => {
    const controller = globalThis.STScoreEditorAppController;
    const exportStartedAt = performance.now();
    const musicxml = controller.exportMusicXml();
    const exportMusicXmlMs = performance.now() - exportStartedAt;

    const controllerRenderStartedAt = performance.now();
    await controller.renderCurrent();
    const controllerRenderCurrentMs = performance.now() - controllerRenderStartedAt;

    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    const api = frame instanceof HTMLIFrameElement ? frame.contentWindow?.__ST_SCORE_RENDER_HOST__ : null;
    if (!api || typeof api.renderMusicXml !== 'function') throw new Error('SES82_DIAGNOSTIC_RENDER_HOST_MISSING');
    const rendererStartedAt = performance.now();
    const rendered = await api.renderMusicXml({
      contractVersion: '0.2.0',
      musicxml,
      ticket: 'ses82-diagnostic-direct',
      pageMode: 'continuous',
      autoResize: false,
      drawTitle: true,
      drawComposer: true
    });
    const rendererHostMs = performance.now() - rendererStartedAt;
    if (!rendered || typeof rendered.renderEpoch !== 'string') throw new Error('SES82_DIAGNOSTIC_DIRECT_RENDER_FAILED');
    return { exportMusicXmlMs, controllerRenderCurrentMs, rendererHostMs, musicxmlBytes: new TextEncoder().encode(musicxml).byteLength };
  });

  const undo = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    globalThis.__SES82_UNDO_STARTED_AT__ = performance.now();
    const startedAt = performance.now();
    const result = controller.undo();
    return { dispatchMs: performance.now() - startedAt, revisionId: result.revisionId, error: result.error };
  });
  if (undo.error !== null) throw new Error(`SES-82 diagnostic undo failed: ${JSON.stringify(undo)}`);
  await page.waitForFunction(revisionId => globalThis.STScoreEditorApp09B?.getState?.()?.renderer?.renderedRevisionId === revisionId, undo.revisionId, { timeout: 30000 });
  const undoToRenderedMs = await page.evaluate(() => performance.now() - globalThis.__SES82_UNDO_STARTED_AT__);

  const redo = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    globalThis.__SES82_REDO_STARTED_AT__ = performance.now();
    const startedAt = performance.now();
    const result = controller.redo();
    return { dispatchMs: performance.now() - startedAt, revisionId: result.revisionId, error: result.error };
  });
  if (redo.error !== null) throw new Error(`SES-82 diagnostic redo failed: ${JSON.stringify(redo)}`);
  await page.waitForFunction(revisionId => globalThis.STScoreEditorApp09B?.getState?.()?.renderer?.renderedRevisionId === revisionId, redo.revisionId, { timeout: 30000 });
  const redoToRenderedMs = await page.evaluate(() => performance.now() - globalThis.__SES82_REDO_STARTED_AT__);

  const result = {
    environment: 'WebKit CI diagnostic; not physical-device evidence',
    selectionDispatchMs: selection.durationMs,
    editDispatchMs: edit.dispatchMs,
    editToRenderedMs,
    exportMusicXmlMs: isolated.exportMusicXmlMs,
    controllerRenderCurrentMs: isolated.controllerRenderCurrentMs,
    rendererHostMs: isolated.rendererHostMs,
    musicxmlBytes: isolated.musicxmlBytes,
    undoDispatchMs: undo.dispatchMs,
    undoToRenderedMs,
    redoDispatchMs: redo.dispatchMs,
    redoToRenderedMs
  };

  for (const [name, value] of Object.entries(result)) {
    if (name === 'environment') continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`SES-82 invalid diagnostic metric ${name}: ${String(value)}`);
  }
  console.log(`SES-82 render latency diagnostic: ${JSON.stringify(result)}`);
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
