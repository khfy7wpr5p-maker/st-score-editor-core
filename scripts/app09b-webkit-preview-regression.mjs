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

const replacementMusicXml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1"><measure number="1"><attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
    <note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
    <note><pitch><step>A</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
    <note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
    <note><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
  </measure></part>
</score-partwise>`;

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
    isMobile: true
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${address.port}/st-score-editor-app09b.html`, {
    waitUntil: 'load',
    timeout: 30000
  });
  await page.waitForFunction(
    () => document.documentElement.dataset.app09bRendererReady === 'true',
    null,
    { timeout: 30000 }
  );
  await page.waitForFunction(() => {
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    const child = frame instanceof HTMLIFrameElement ? frame.contentDocument : null;
    return document.documentElement.dataset.app09bRenderStatus === 'current' &&
      document.documentElement.dataset.app09bRendererFrameStable === 'true' &&
      (child?.querySelectorAll('svg').length ?? 0) > 0;
  }, null, { timeout: 30000 });

  const initial = await page.evaluate(() => {
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    const child = frame instanceof HTMLIFrameElement ? frame.contentDocument : null;
    const state = globalThis.STScoreEditorApp09B?.getState?.() ?? null;
    return {
      rendererReady: document.documentElement.dataset.app09bRendererReady ?? null,
      renderStatus: document.documentElement.dataset.app09bRenderStatus ?? null,
      frameStable: document.documentElement.dataset.app09bRendererFrameStable ?? null,
      childReady: child?.documentElement.dataset.stScoreRuntimeReady ?? null,
      svgCount: child?.querySelectorAll('svg').length ?? -1,
      snapshotRevision: state?.snapshot?.revisionId ?? null,
      renderedRevision: state?.renderer?.renderedRevisionId ?? null,
      rendererStatus: state?.renderer?.status?.code ?? null,
      renderEpoch: state?.renderEvidence?.renderEpoch ?? null,
      sourceId: state?.renderEvidence?.sourceId ?? null
    };
  });

  if (initial.rendererReady !== 'true') throw new Error(`renderer was not ready: ${JSON.stringify(initial)}`);
  if (initial.renderStatus !== 'current') throw new Error(`render was not current: ${JSON.stringify(initial)}`);
  if (initial.frameStable !== 'true') throw new Error(`renderer frame was not stable: ${JSON.stringify(initial)}`);
  if (initial.childReady !== 'true') throw new Error(`renderer runtime was not ready: ${JSON.stringify(initial)}`);
  if (initial.svgCount < 1) throw new Error(`renderer produced no SVG: ${JSON.stringify(initial)}`);
  if (initial.snapshotRevision === null || initial.renderedRevision !== initial.snapshotRevision) {
    throw new Error(`renderer revision mismatch: ${JSON.stringify(initial)}`);
  }
  if (initial.rendererStatus !== 'RENDERED_CURRENT_REVISION') {
    throw new Error(`renderer did not report current revision: ${JSON.stringify(initial)}`);
  }
  if (typeof initial.renderEpoch !== 'string' || initial.renderEpoch.length === 0) {
    throw new Error(`render epoch evidence missing: ${JSON.stringify(initial)}`);
  }

  const exactTargetProbe = await page.evaluate(async () => {
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    if (!(frame instanceof HTMLIFrameElement)) throw new Error('APP09B_RENDERER_FRAME_MISSING');
    const child = frame.contentDocument;
    const api = frame.contentWindow?.__ST_SCORE_RENDER_HOST__;
    if (!child || !api || typeof api.hitTestNoteDetailed !== 'function' || typeof api.highlight !== 'function') {
      throw new Error('APP09B_RENDERER_HIT_HOST_MISSING');
    }

    const target = { partId: 'P1', measureIndex: 0, noteIndex: 0, voice: 1 };
    let highlightError = null;
    try {
      await api.clearHighlights();
      await api.highlight({ target, className: 'st-score-diagnostic-target' });
    } catch (error) {
      highlightError = String(error?.message ?? error);
    }

    const highlighted = child.querySelector('[data-st-score-highlight="true"]');
    if (!(highlighted instanceof frame.contentWindow.Element)) {
      return { target, highlightError, highlighted: false, hitPoint: null, missReasons: {}, landed: [] };
    }

    const rect = highlighted.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const missReasons = {};
    const landed = [];
    const fractions = [0.2, 0.35, 0.5, 0.65, 0.8];
    for (const fx of fractions) {
      for (const fy of fractions) {
        const childX = rect.left + rect.width * fx;
        const childY = rect.top + rect.height * fy;
        const surface = child.elementFromPoint(childX, childY);
        if (landed.length < 8) {
          landed.push({
            tag: surface?.tagName ?? null,
            inSvg: surface instanceof frame.contentWindow.Element && surface.closest('svg') !== null,
            inHighlighted: surface instanceof frame.contentWindow.Element && (surface === highlighted || highlighted.contains(surface))
          });
        }
        let result;
        try {
          result = api.hitTestNoteDetailed({ clientX: childX, clientY: childY });
        } catch (error) {
          const key = `THREW:${String(error?.message ?? error)}`;
          missReasons[key] = (missReasons[key] ?? 0) + 1;
          continue;
        }
        if (result?.kind === 'HIT') {
          return {
            target,
            highlightError,
            highlighted: true,
            rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
            missReasons,
            landed,
            hitPoint: {
              childX,
              childY,
              pageX: frameRect.left + childX,
              pageY: frameRect.top + childY,
              target: result.target,
              renderEpoch: result.renderEpoch,
              sourceId: result.sourceId ?? null
            }
          };
        }
        const reason = result?.reason ?? 'UNKNOWN_MISS';
        missReasons[reason] = (missReasons[reason] ?? 0) + 1;
      }
    }
    return {
      target,
      highlightError,
      highlighted: true,
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      hitPoint: null,
      missReasons,
      landed
    };
  });

  if (exactTargetProbe.hitPoint === null) {
    throw new Error(`APP-09B exact highlighted note produced no renderer HIT: ${JSON.stringify(exactTargetProbe)}`);
  }
  const hitPoint = exactTargetProbe.hitPoint;
  if (hitPoint.renderEpoch !== initial.renderEpoch || hitPoint.sourceId !== initial.sourceId) {
    throw new Error(`APP-09B exact hit evidence was stale before touch: ${JSON.stringify({ hitPoint, initial })}`);
  }

  await page.evaluate(async () => {
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    await frame?.contentWindow?.__ST_SCORE_RENDER_HOST__?.clearHighlights?.();
  });
  await page.touchscreen.tap(hitPoint.pageX, hitPoint.pageY);
  await page.waitForFunction(() => document.documentElement.dataset.app09bLastHit !== undefined, null, { timeout: 5000 });
  const interaction = await page.evaluate(() => {
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    const child = frame instanceof HTMLIFrameElement ? frame.contentDocument : null;
    const snapshot = globalThis.STScoreEditorAppController?.getSnapshot?.() ?? null;
    return {
      lastHit: document.documentElement.dataset.app09bLastHit ?? null,
      selectionKind: snapshot?.selectionKind ?? null,
      highlightedCount: child?.querySelectorAll('.st-score-highlight').length ?? -1
    };
  });
  if (interaction.lastHit !== 'selected') {
    throw new Error(`APP-09B touch did not complete selection bridge: ${JSON.stringify({ hitPoint, interaction })}`);
  }
  if (interaction.selectionKind === null) {
    throw new Error(`APP-09B touch reported selected but canonical selection stayed empty: ${JSON.stringify(interaction)}`);
  }
  if (interaction.highlightedCount < 1) {
    throw new Error(`APP-09B touch selected canonically but produced no renderer highlight: ${JSON.stringify(interaction)}`);
  }

  const persistence = await page.evaluate(async (musicxml) => {
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    if (!(frame instanceof HTMLIFrameElement)) throw new Error('APP09B_RENDERER_FRAME_MISSING');
    const beforeWindow = frame.contentWindow;
    const beforeHost = beforeWindow?.__ST_SCORE_RENDER_HOST__;
    if (!beforeWindow || !beforeHost) throw new Error('APP09B_RENDERER_HOST_MISSING');
    await globalThis.STScoreEditorAppController.openMusicXml(musicxml, { title: 'APP-09B WebKit Persistence Test' });
    return {
      sameWindow: frame.contentWindow === beforeWindow,
      sameHost: frame.contentWindow?.__ST_SCORE_RENDER_HOST__ === beforeHost
    };
  }, replacementMusicXml);

  if (!persistence.sameWindow || !persistence.sameHost) {
    throw new Error(`renderer browsing context changed during editor UI update: ${JSON.stringify(persistence)}`);
  }

  await page.waitForFunction(() => {
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    const child = frame instanceof HTMLIFrameElement ? frame.contentDocument : null;
    const state = globalThis.STScoreEditorApp09B?.getState?.() ?? null;
    return document.documentElement.dataset.app09bRenderStatus === 'current' &&
      state?.snapshot?.revisionId !== null &&
      state?.renderer?.renderedRevisionId === state?.snapshot?.revisionId &&
      state?.renderer?.status?.code === 'RENDERED_CURRENT_REVISION' &&
      (child?.querySelectorAll('svg').length ?? 0) > 0;
  }, null, { timeout: 30000 });

  if (consoleErrors.length > 0) {
    throw new Error(`APP-09B WebKit console errors: ${consoleErrors.slice(-12).join(' | ')}`);
  }

  console.log(`APP-09B WebKit regression: PASS (${JSON.stringify({ initial, exactTargetProbe, hitPoint, interaction, persistence })})`);
} finally {
  if (browser !== undefined) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
