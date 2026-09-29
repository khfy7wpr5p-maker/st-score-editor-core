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
  ['.json', 'application/json; charset=utf-8']
]);

const resolveRequestPath = requestUrl => {
  const pathname = decodeURIComponent(new URL(requestUrl ?? '/', 'http://127.0.0.1').pathname);
  const resolved = path.resolve(browserRoot, pathname.replace(/^\/+/, '') || 'st-score-editor-app.html');
  if (resolved !== browserRoot && !resolved.startsWith(`${browserRoot}${path.sep}`)) {
    throw new Error('request escaped browser output root');
  }
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
if (address === null || typeof address === 'string') {
  throw new Error('SES-82 WebKit server did not expose a TCP port.');
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

  await page.goto(`http://127.0.0.1:${address.port}/st-score-editor-app.html`, {
    waitUntil: 'load',
    timeout: 30000
  });
  await page.getByRole('button', { name: 'New', exact: true }).click();

  const result = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const appBefore = document.querySelector('[data-st-score-editor-app]');
    if (!(appBefore instanceof HTMLElement)) throw new Error('SES82_APP_BEFORE_MISSING');

    const sentinel = document.createElement('span');
    sentinel.setAttribute('data-ses82-shell-sentinel', '1');
    sentinel.hidden = true;
    appBefore.append(sentinel);

    const documentBefore = controller.getDocument();
    const event = documentBefore.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events[0];
    const target = documentBefore.session.renderRequest.manifest.entries.find(entry =>
      entry.address.kind === 'event' && entry.address.eventId === event.id
    )?.address;
    if (!target) throw new Error('SES82_EVENT_TARGET_MISSING');
    const historyBefore = documentBefore.session.history.past.length;
    controller.select(target);

    const documentAfter = controller.getDocument();
    const appAfter = document.querySelector('[data-st-score-editor-app]');
    return {
      sameAppNode: appAfter === appBefore,
      sentinelPreserved: sentinel.isConnected && appAfter?.contains(sentinel) === true,
      selectionKind: documentAfter.session.selection?.kind ?? null,
      inspectorText: appAfter?.querySelector('.stse-inspector')?.textContent ?? null,
      statusCode: appAfter?.querySelector('.stse-status strong')?.textContent ?? null,
      historyBefore,
      historyAfter: documentAfter.session.history.past.length
    };
  });

  if (result.selectionKind !== 'event' || result.historyAfter !== result.historyBefore) {
    throw new Error(`SES-82 selection semantics changed: ${JSON.stringify(result)}`);
  }
  if (!result.inspectorText?.includes('selection: event:') || result.statusCode !== 'SELECTION_CHANGED') {
    throw new Error(`SES-82 presentation-only selection left stale shell state: ${JSON.stringify(result)}`);
  }
  if (!result.sameAppNode || !result.sentinelPreserved) {
    throw new Error(`SES-82 presentation-only selection rebuilt the full shell: ${JSON.stringify(result)}`);
  }

  console.log('SES-82 WebKit presentation-only shell regression: PASS');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
