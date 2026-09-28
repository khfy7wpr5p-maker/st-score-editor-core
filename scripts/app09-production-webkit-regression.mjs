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
  const resolved = path.resolve(browserRoot, pathname.replace(/^\/+/, '') || 'index.html');
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
  throw new Error('APP-09 production WebKit server did not expose a TCP port.');
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
  const browserErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${address.port}/index.html`, {
    waitUntil: 'load',
    timeout: 30000
  });

  await page.waitForFunction(() => {
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    const child = frame instanceof HTMLIFrameElement ? frame.contentDocument : null;
    return document.documentElement.dataset.app09bRendererReady === 'true' &&
      document.documentElement.dataset.app09bRenderStatus === 'current' &&
      globalThis.STScoreEditorAudioEngine !== undefined &&
      document.getElementById('st-score-audio-instrument') instanceof HTMLSelectElement &&
      (child?.querySelectorAll('svg').length ?? 0) > 0;
  }, null, { timeout: 30000 });

  const state = await page.evaluate(() => {
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    const child = frame instanceof HTMLIFrameElement ? frame.contentDocument : null;
    return {
      rendererReady: document.documentElement.dataset.app09bRendererReady ?? null,
      renderStatus: document.documentElement.dataset.app09bRenderStatus ?? null,
      svgCount: child?.querySelectorAll('svg').length ?? -1,
      audioEngineAttached: globalThis.STScoreEditorAudioEngine !== undefined,
      selectorPresent: document.getElementById('st-score-audio-instrument') instanceof HTMLSelectElement
    };
  });

  if (browserErrors.length > 0) {
    throw new Error(`APP-09 production WebKit browser errors: ${browserErrors.slice(-12).join(' | ')}`);
  }
  if (state.rendererReady !== 'true' || state.renderStatus !== 'current' || state.svgCount < 1) {
    throw new Error(`APP-09 production renderer did not produce visible SVG: ${JSON.stringify(state)}`);
  }
  if (!state.audioEngineAttached || !state.selectorPresent) {
    throw new Error(`APP-09 production audio host did not initialize: ${JSON.stringify(state)}`);
  }

  console.log(`APP-09 production WebKit regression: PASS (${JSON.stringify(state)})`);
} finally {
  if (browser !== undefined) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
