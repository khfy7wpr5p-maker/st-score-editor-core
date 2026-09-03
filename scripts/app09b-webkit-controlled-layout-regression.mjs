import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webkit } from 'playwright';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const browserRoot = path.join(repoRoot, 'dist', 'browser');
const types = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'], ['.musicxml', 'application/xml; charset=utf-8']
]);

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
    const file = path.resolve(browserRoot, pathname.replace(/^\/+/, '') || 'st-score-editor-app09b.html');
    if (file !== browserRoot && !file.startsWith(`${browserRoot}${path.sep}`)) throw new Error('escaped root');
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not file');
    response.setHeader('Content-Type', types.get(path.extname(file)) ?? 'application/octet-stream');
    response.setHeader('Cache-Control', 'no-store');
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end('not found');
  }
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const address = server.address();
if (address === null || typeof address === 'string') throw new Error('APP09B_LAYOUT_SERVER_PORT_MISSING');

const readState = (page) => page.evaluate(() => {
  const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
  const state = globalThis.STScoreEditorApp09B?.getState?.() ?? null;
  return {
    revision: state?.snapshot?.revisionId ?? null,
    renderedRevision: state?.renderer?.renderedRevisionId ?? null,
    status: state?.renderer?.status?.code ?? null,
    renderEpoch: state?.renderEvidence?.renderEpoch ?? null,
    sourceId: state?.renderEvidence?.sourceId ?? null,
    sameFrame: frame instanceof HTMLIFrameElement && frame.contentWindow === globalThis.__APP09B_LAYOUT_FRAME__,
    sameHost: frame instanceof HTMLIFrameElement && frame.contentWindow?.__ST_SCORE_RENDER_HOST__ === globalThis.__APP09B_LAYOUT_HOST__,
    svgCount: frame instanceof HTMLIFrameElement ? (frame.contentDocument?.querySelectorAll('svg').length ?? 0) : -1
  };
});

async function waitForFreshEvidence(page, before) {
  await page.waitForFunction((previous) => {
    const state = globalThis.STScoreEditorApp09B?.getState?.() ?? null;
    const epoch = state?.renderEvidence?.renderEpoch ?? null;
    const sourceId = state?.renderEvidence?.sourceId ?? null;
    return state?.renderer?.status?.code === 'RENDERED_CURRENT_REVISION' &&
      state?.renderer?.renderedRevisionId === state?.snapshot?.revisionId &&
      typeof epoch === 'string' &&
      (epoch !== previous.renderEpoch || sourceId !== previous.sourceId);
  }, before, { timeout: 5000 });
}

async function exactHitAndBridge(page, noteIndex) {
  const result = await page.evaluate(async (index) => {
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    if (!(frame instanceof HTMLIFrameElement)) throw new Error('APP09B_LAYOUT_FRAME_MISSING');
    const win = frame.contentWindow;
    const child = frame.contentDocument;
    const api = win?.__ST_SCORE_RENDER_HOST__;
    const evidence = globalThis.STScoreEditorApp09B?.getState?.().renderEvidence ?? null;
    if (!win || !child || !api || !evidence) throw new Error('APP09B_LAYOUT_HOST_MISSING');

    const target = { partId: 'P1', measureIndex: 0, noteIndex: index, voice: 1 };
    await api.clearHighlights();
    await api.highlight({ target, className: 'st-score-layout-probe' });
    const highlighted = child.querySelector('[data-st-score-highlight="true"]');
    if (!(highlighted instanceof win.Element)) throw new Error('APP09B_LAYOUT_HIGHLIGHT_MISSING');
    const rect = highlighted.getBoundingClientRect();
    let hit = null;
    let point = null;
    for (const fx of [0.25, 0.5, 0.75]) {
      for (const fy of [0.25, 0.5, 0.75]) {
        const clientX = rect.left + rect.width * fx;
        const clientY = rect.top + rect.height * fy;
        const candidate = api.hitTestNoteDetailed({ clientX, clientY });
        if (candidate?.kind === 'HIT') {
          hit = candidate;
          point = { clientX, clientY };
          break;
        }
      }
      if (hit !== null) break;
    }
    if (hit === null || point === null) throw new Error('APP09B_LAYOUT_EXACT_HIT_MISSING');
    if (hit.renderEpoch !== evidence.renderEpoch || (hit.sourceId ?? null) !== (evidence.sourceId ?? null)) {
      throw new Error('APP09B_LAYOUT_STALE_HIT');
    }

    await api.clearHighlights();
    delete document.documentElement.dataset.app09bLastHit;
    const EventCtor = win.PointerEvent ?? win.MouseEvent;
    child.dispatchEvent(new EventCtor('pointerup', {
      bubbles: true,
      cancelable: true,
      clientX: point.clientX,
      clientY: point.clientY,
      pointerType: 'touch'
    }));
    return { target: hit.target, renderEpoch: hit.renderEpoch, sourceId: hit.sourceId ?? null };
  }, noteIndex);

  await page.waitForFunction(() => document.documentElement.dataset.app09bLastHit === 'selected', null, { timeout: 5000 });
  const selection = await page.evaluate(() => {
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    const snapshot = globalThis.STScoreEditorAppController?.getSnapshot?.() ?? null;
    return {
      selectionKind: snapshot?.selectionKind ?? null,
      highlighted: frame instanceof HTMLIFrameElement ? (frame.contentDocument?.querySelectorAll('.st-score-highlight').length ?? 0) : -1
    };
  });
  if (selection.selectionKind !== 'note' || selection.highlighted < 1) {
    throw new Error(`APP09B_LAYOUT_SELECTION_FAILED ${JSON.stringify(selection)}`);
  }
  return { result, selection };
}

let browser;
try {
  browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`http://127.0.0.1:${address.port}/st-score-editor-app09b.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => {
    const state = globalThis.STScoreEditorApp09B?.getState?.() ?? null;
    return document.documentElement.dataset.app09bRendererFrameStable === 'true' &&
      state?.renderer?.status?.code === 'RENDERED_CURRENT_REVISION' &&
      typeof state?.renderEvidence?.renderEpoch === 'string';
  }, null, { timeout: 30000 });

  const initial = await page.evaluate(() => {
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    if (!(frame instanceof HTMLIFrameElement)) throw new Error('APP09B_LAYOUT_FRAME_MISSING');
    globalThis.__APP09B_LAYOUT_FRAME__ = frame.contentWindow;
    globalThis.__APP09B_LAYOUT_HOST__ = frame.contentWindow?.__ST_SCORE_RENDER_HOST__;
    const state = globalThis.STScoreEditorApp09B?.getState?.() ?? null;
    return {
      revision: state?.snapshot?.revisionId ?? null,
      renderEpoch: state?.renderEvidence?.renderEpoch ?? null,
      sourceId: state?.renderEvidence?.sourceId ?? null
    };
  });
  if (initial.revision === null || typeof initial.renderEpoch !== 'string') throw new Error('APP09B_LAYOUT_INITIAL_EVIDENCE_MISSING');

  await page.setViewportSize({ width: 844, height: 390 });
  await waitForFreshEvidence(page, { renderEpoch: initial.renderEpoch, sourceId: initial.sourceId });
  const landscape = await readState(page);
  if (!landscape.sameFrame || !landscape.sameHost || landscape.revision !== initial.revision || landscape.renderedRevision !== initial.revision || landscape.svgCount < 1) {
    throw new Error(`APP09B_LAYOUT_LANDSCAPE_INVARIANT_FAILED ${JSON.stringify({ initial, landscape })}`);
  }
  const landscapeInteraction = await exactHitAndBridge(page, 1);

  await page.setViewportSize({ width: 390, height: 844 });
  await waitForFreshEvidence(page, { renderEpoch: landscape.renderEpoch, sourceId: landscape.sourceId });
  const portrait = await readState(page);
  if (!portrait.sameFrame || !portrait.sameHost || portrait.revision !== initial.revision || portrait.renderedRevision !== initial.revision || portrait.svgCount < 1) {
    throw new Error(`APP09B_LAYOUT_PORTRAIT_INVARIANT_FAILED ${JSON.stringify({ initial, portrait })}`);
  }
  const portraitInteraction = await exactHitAndBridge(page, 2);

  if (errors.length > 0) throw new Error(`APP09B_LAYOUT_CONSOLE_ERRORS ${errors.slice(-10).join(' | ')}`);
  console.log(`APP-09B WebKit controlled layout regression: PASS (${JSON.stringify({ initial, landscape, landscapeInteraction, portrait, portraitInteraction })})`);
} finally {
  if (browser !== undefined) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
