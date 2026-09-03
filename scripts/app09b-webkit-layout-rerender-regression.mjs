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

function resolveRequestPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl ?? '/', 'http://127.0.0.1').pathname);
  const resolved = path.resolve(browserRoot, pathname.replace(/^\/+/, '') || 'st-score-editor-app09b.html');
  if (resolved !== browserRoot && !resolved.startsWith(`${browserRoot}${path.sep}`)) {
    throw new Error('request escaped browser output root');
  }
  return resolved;
}

const server = createServer(async (request, response) => {
  try {
    const requestedPath = resolveRequestPath(request.url);
    const info = await stat(requestedPath);
    if (!info.isFile()) return response.writeHead(404).end('not found');
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
if (address === null || typeof address === 'string') {
  server.close();
  throw new Error('APP-09B layout WebKit server did not expose a TCP port.');
}

async function currentState(page) {
  return page.evaluate(() => {
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    const state = globalThis.STScoreEditorApp09B?.getState?.() ?? null;
    return {
      frameStable: document.documentElement.dataset.app09bRendererFrameStable ?? null,
      revision: state?.snapshot?.revisionId ?? null,
      renderedRevision: state?.renderer?.renderedRevisionId ?? null,
      rendererStatus: state?.renderer?.status?.code ?? null,
      rendererAttached: state?.renderer?.attached ?? null,
      renderEpoch: state?.renderEvidence?.renderEpoch ?? null,
      sourceId: state?.renderEvidence?.sourceId ?? null,
      svgCount: frame instanceof HTMLIFrameElement ? (frame.contentDocument?.querySelectorAll('svg').length ?? 0) : -1,
      sameFrameWindow: frame instanceof HTMLIFrameElement && frame.contentWindow === globalThis.__APP09B_LAYOUT_FRAME_WINDOW__,
      sameRendererHost: frame instanceof HTMLIFrameElement && frame.contentWindow?.__ST_SCORE_RENDER_HOST__ === globalThis.__APP09B_LAYOUT_RENDERER_HOST__,
      controllerProfile: globalThis.STScoreEditorAppController?.profile ?? null,
      runtimeProfile: globalThis.STScoreEditorApp?.profile ?? null,
      events: globalThis.__APP09B_LAYOUT_EVENTS__ ?? null,
      viewport: { width: innerWidth, height: innerHeight, visualWidth: visualViewport?.width ?? null, visualHeight: visualViewport?.height ?? null }
    };
  });
}

async function waitForNewEpoch(page, previousEpoch, stage) {
  try {
    await page.waitForFunction((before) => {
      const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
      const state = globalThis.STScoreEditorApp09B?.getState?.() ?? null;
      return document.documentElement.dataset.app09bRendererFrameStable === 'true' &&
        state?.snapshot?.revisionId !== null &&
        state?.renderer?.renderedRevisionId === state?.snapshot?.revisionId &&
        state?.renderer?.status?.code === 'RENDERED_CURRENT_REVISION' &&
        typeof state?.renderEvidence?.renderEpoch === 'string' &&
        state.renderEvidence.renderEpoch !== before &&
        (frame instanceof HTMLIFrameElement ? (frame.contentDocument?.querySelectorAll('svg').length ?? 0) : 0) > 0;
    }, previousEpoch, { timeout: 5000 });
  } catch (error) {
    const diagnostic = await currentState(page);
    throw new Error(`APP-09B ${stage} produced no fresh renderEpoch after layout signal: ${JSON.stringify(diagnostic)}; ${String(error?.message ?? error)}`);
  }
}

async function probeAndTap(page, noteIndex) {
  const probe = await page.evaluate(async (index) => {
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    if (!(frame instanceof HTMLIFrameElement)) throw new Error('APP09B_LAYOUT_RENDERER_FRAME_MISSING');
    const child = frame.contentDocument;
    const api = frame.contentWindow?.__ST_SCORE_RENDER_HOST__;
    const evidence = globalThis.STScoreEditorApp09B?.getState?.().renderEvidence ?? null;
    if (!child || !api || !evidence) throw new Error('APP09B_LAYOUT_RENDERER_HOST_MISSING');

    const target = { partId: 'P1', measureIndex: 0, noteIndex: index, voice: 1 };
    await api.clearHighlights();
    await api.highlight({ target, className: 'st-score-layout-probe' });
    const highlighted = child.querySelector('[data-st-score-highlight="true"]');
    if (!(highlighted instanceof frame.contentWindow.Element)) {
      return { hit: null, reason: 'HIGHLIGHT_TARGET_MISSING' };
    }
    const rect = highlighted.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    for (const fx of [0.25, 0.5, 0.75]) {
      for (const fy of [0.25, 0.5, 0.75]) {
        const childX = rect.left + rect.width * fx;
        const childY = rect.top + rect.height * fy;
        const result = api.hitTestNoteDetailed({ clientX: childX, clientY: childY });
        if (result?.kind === 'HIT') {
          return {
            hit: {
              pageX: frameRect.left + childX,
              pageY: frameRect.top + childY,
              renderEpoch: result.renderEpoch,
              sourceId: result.sourceId ?? null,
              target: result.target
            },
            evidence
          };
        }
      }
    }
    return { hit: null, reason: 'NO_EXACT_HIT' };
  }, noteIndex);

  if (probe.hit === null) throw new Error(`APP-09B layout rerender produced no exact HIT: ${JSON.stringify(probe)}`);
  if (probe.hit.renderEpoch !== probe.evidence.renderEpoch || probe.hit.sourceId !== (probe.evidence.sourceId ?? null)) {
    throw new Error(`APP-09B layout rerender HIT evidence was stale: ${JSON.stringify(probe)}`);
  }

  await page.evaluate(async () => {
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    await frame?.contentWindow?.__ST_SCORE_RENDER_HOST__?.clearHighlights?.();
    delete document.documentElement.dataset.app09bLastHit;
  });
  await page.touchscreen.tap(probe.hit.pageX, probe.hit.pageY);
  await page.waitForFunction(() => document.documentElement.dataset.app09bLastHit === 'selected', null, { timeout: 5000 });

  const selected = await page.evaluate(() => {
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    const snapshot = globalThis.STScoreEditorAppController?.getSnapshot?.() ?? null;
    return {
      selectionKind: snapshot?.selectionKind ?? null,
      highlightedCount: frame instanceof HTMLIFrameElement ? (frame.contentDocument?.querySelectorAll('.st-score-highlight').length ?? 0) : -1
    };
  });
  if (selected.selectionKind === null || selected.highlightedCount < 1) {
    throw new Error(`APP-09B layout rerender touch selection failed: ${JSON.stringify(selected)}`);
  }
  return { probe, selected };
}

let browser;
try {
  browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${address.port}/st-score-editor-app09b.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => {
    const state = globalThis.STScoreEditorApp09B?.getState?.() ?? null;
    return document.documentElement.dataset.app09bRendererReady === 'true' &&
      document.documentElement.dataset.app09bRendererFrameStable === 'true' &&
      state?.renderer?.status?.code === 'RENDERED_CURRENT_REVISION' &&
      typeof state?.renderEvidence?.renderEpoch === 'string';
  }, null, { timeout: 30000 });

  const initial = await page.evaluate(() => {
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    if (!(frame instanceof HTMLIFrameElement)) throw new Error('APP09B_LAYOUT_RENDERER_FRAME_MISSING');
    globalThis.__APP09B_LAYOUT_FRAME_WINDOW__ = frame.contentWindow;
    globalThis.__APP09B_LAYOUT_RENDERER_HOST__ = frame.contentWindow?.__ST_SCORE_RENDER_HOST__;
    const events = { windowResize: 0, orientationchange: 0, visualViewportResize: 0 };
    globalThis.__APP09B_LAYOUT_EVENTS__ = events;
    addEventListener('resize', () => { events.windowResize += 1; });
    addEventListener('orientationchange', () => { events.orientationchange += 1; });
    visualViewport?.addEventListener('resize', () => { events.visualViewportResize += 1; });
    const state = globalThis.STScoreEditorApp09B?.getState?.() ?? null;
    return {
      renderEpoch: state?.renderEvidence?.renderEpoch ?? null,
      revision: state?.snapshot?.revisionId ?? null,
      controllerProfile: globalThis.STScoreEditorAppController?.profile ?? null,
      runtimeProfile: globalThis.STScoreEditorApp?.profile ?? null
    };
  });
  if (typeof initial.renderEpoch !== 'string' || initial.revision === null) throw new Error(`APP-09B initial evidence missing: ${JSON.stringify(initial)}`);

  await page.setViewportSize({ width: 844, height: 390 });
  await waitForNewEpoch(page, initial.renderEpoch, 'landscape');
  const landscape = await currentState(page);
  if (!landscape.sameFrameWindow || !landscape.sameRendererHost) throw new Error(`APP-09B renderer browsing context changed in landscape: ${JSON.stringify(landscape)}`);
  if (landscape.revision !== initial.revision || landscape.renderedRevision !== initial.revision) throw new Error(`APP-09B canonical revision changed during layout rerender: ${JSON.stringify({ initial, landscape })}`);
  const landscapeInteraction = await probeAndTap(page, 1);

  await page.setViewportSize({ width: 390, height: 844 });
  await waitForNewEpoch(page, landscape.renderEpoch, 'portrait-restore');
  const portrait = await currentState(page);
  if (!portrait.sameFrameWindow || !portrait.sameRendererHost) throw new Error(`APP-09B renderer browsing context changed after portrait restore: ${JSON.stringify(portrait)}`);
  if (portrait.revision !== initial.revision || portrait.renderedRevision !== initial.revision) throw new Error(`APP-09B canonical revision changed after portrait restore: ${JSON.stringify({ initial, portrait })}`);
  const portraitInteraction = await probeAndTap(page, 2);

  if (consoleErrors.length > 0) throw new Error(`APP-09B layout WebKit console errors: ${consoleErrors.slice(-12).join(' | ')}`);
  console.log(`APP-09B WebKit layout rerender regression: PASS (${JSON.stringify({ initial, landscape, landscapeInteraction, portrait, portraitInteraction })})`);
} finally {
  if (browser !== undefined) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
