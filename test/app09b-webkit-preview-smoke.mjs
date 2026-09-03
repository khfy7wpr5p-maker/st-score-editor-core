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
  ['.musicxml', 'application/xml; charset=utf-8'],
]);

function resolveRequestPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl ?? '/', 'http://127.0.0.1').pathname);
  const relative = pathname.replace(/^\/+/, '');
  const resolved = path.resolve(browserRoot, relative || 'st-score-editor-app09b.html');
  if (resolved !== browserRoot && !resolved.startsWith(`${browserRoot}${path.sep}`)) {
    throw new Error('request escaped browser output root');
  }
  return resolved;
}

const server = createServer(async (request, response) => {
  try {
    const requestedPath = resolveRequestPath(request.url);
    const info = await stat(requestedPath);
    if (!info.isFile()) {
      response.writeHead(404).end('not found');
      return;
    }
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
  throw new Error('APP-09B WebKit server did not expose a TCP port.');
}

let browser;
try {
  browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${address.port}/st-score-editor-app09b.html`, {
    waitUntil: 'load',
    timeout: 30_000,
  });

  await page.waitForFunction(() => {
    const ready = document.documentElement.dataset.app09bRendererReady;
    return ready === 'true' || ready === 'false';
  }, null, { timeout: 30_000 });

  await page.waitForFunction(() => {
    const status = document.documentElement.dataset.app09bRenderStatus;
    return status === 'current' || status === 'failed';
  }, null, { timeout: 30_000 }).catch(() => undefined);

  const evidence = await page.evaluate(() => {
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    const child = frame instanceof HTMLIFrameElement ? frame.contentDocument : null;
    const state = globalThis.STScoreEditorApp09B?.getState?.() ?? null;
    return {
      rendererReady: document.documentElement.dataset.app09bRendererReady ?? null,
      renderStatus: document.documentElement.dataset.app09bRenderStatus ?? null,
      lastHit: document.documentElement.dataset.app09bLastHit ?? null,
      frameMounted: frame instanceof HTMLIFrameElement,
      frameConnected: frame?.isConnected ?? false,
      viewportOwnsFrame: frame instanceof HTMLIFrameElement && frame.parentElement?.matches('[data-st-score-editor-viewport]') === true,
      svgCount: child?.querySelectorAll('svg').length ?? -1,
      childReady: child?.documentElement.dataset.stScoreRuntimeReady ?? null,
      childText: child?.body?.innerText?.slice(0, 500) ?? null,
      snapshot: state?.snapshot ?? null,
      renderer: state?.renderer ?? null,
      renderEvidence: state?.renderEvidence ?? null,
    };
  });

  console.log(`APP-09B WebKit evidence: ${JSON.stringify(evidence)}`);
  if (evidence.rendererReady !== 'true' || evidence.renderStatus !== 'current' || evidence.svgCount < 1) {
    const diagnostics = consoleErrors.length === 0 ? 'none' : consoleErrors.slice(-12).join(' | ');
    throw new Error(`APP-09B WebKit preview failed: ${JSON.stringify(evidence)}; console=${diagnostics}`);
  }

  await page.close();
  await context.close();
  console.log('APP-09B WebKit preview smoke PASS. This is WebKit engine evidence, not physical iPhone Safari acceptance.');
} finally {
  if (browser !== undefined) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
