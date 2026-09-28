import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { webkit } from 'playwright';

const browserRoot = path.resolve('dist/browser');
const mimeFor = file => ({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml'
}[path.extname(file)] ?? 'application/octet-stream');

const server = createServer((request, response) => {
  void (async () => {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://local.test').pathname);
    const candidate = path.resolve(browserRoot, pathname.replace(/^\/+/, '') || 'index.html');
    if (candidate !== browserRoot && !candidate.startsWith(`${browserRoot}${path.sep}`)) {
      response.writeHead(404).end('not found');
      return;
    }
    try {
      const body = await readFile(candidate);
      response.writeHead(200, { 'Content-Type': mimeFor(candidate), 'Cache-Control': 'no-store' }).end(body);
    } catch {
      response.writeHead(404).end('not found');
    }
  })();
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const address = server.address();
if (address === null || typeof address === 'string') throw new Error('APP09_PRODUCTION_WEBKIT_PORT_MISSING');

let browser;
try {
  browser = await webkit.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true
  });
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));

  await page.goto(`http://127.0.0.1:${address.port}/index.html`, { waitUntil: 'load', timeout: 30000 });
  try {
    await page.waitForFunction(() => {
      const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
      const child = frame instanceof HTMLIFrameElement ? frame.contentDocument : null;
      return document.documentElement.dataset.app09bRendererReady === 'true' &&
        document.documentElement.dataset.app09bRenderStatus === 'current' &&
        globalThis.STScoreEditorAudioEngine !== undefined &&
        document.getElementById('st-score-audio-instrument') instanceof HTMLSelectElement &&
        (child?.querySelectorAll('svg').length ?? 0) > 0;
    }, null, { timeout: 30000 });
  } catch (error) {
    throw new Error(`APP09_PRODUCTION_RENDER_TIMEOUT: ${errors.slice(-8).join(' | ') || error.message}`);
  }

  const state = await page.evaluate(() => {
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    const child = frame instanceof HTMLIFrameElement ? frame.contentDocument : null;
    return {
      rendererReady: document.documentElement.dataset.app09bRendererReady ?? null,
      renderStatus: document.documentElement.dataset.app09bRenderStatus ?? null,
      svgCount: child?.querySelectorAll('svg').length ?? -1,
      audioAttached: globalThis.STScoreEditorAudioEngine !== undefined,
      selectorPresent: document.getElementById('st-score-audio-instrument') instanceof HTMLSelectElement
    };
  });

  if (errors.length) throw new Error(`APP09_PRODUCTION_BROWSER_ERRORS: ${errors.slice(-8).join(' | ')}`);
  if (state.rendererReady !== 'true' || state.renderStatus !== 'current' || state.svgCount < 1) {
    throw new Error(`APP09_PRODUCTION_RENDER_NOT_VISIBLE: ${JSON.stringify(state)}`);
  }
  if (!state.audioAttached || !state.selectorPresent) {
    throw new Error(`APP09_PRODUCTION_AUDIO_NOT_READY: ${JSON.stringify(state)}`);
  }
  console.log(`APP-09 production WebKit regression: PASS (${JSON.stringify(state)})`);
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
