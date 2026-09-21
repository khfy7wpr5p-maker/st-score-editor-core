import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webkit } from 'playwright';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const browserRoot = path.join(repoRoot, 'dist', 'browser');

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
    const file = path.resolve(
      browserRoot,
      pathname.replace(/^\/+/, '') || 'st-score-editor-professional-workstation-renderer.html'
    );
    if (file !== browserRoot && !file.startsWith(`${browserRoot}${path.sep}`)) {
      throw new Error('escaped root');
    }
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not file');
    const ext = path.extname(file);
    const type = ext === '.html' ? 'text/html; charset=utf-8'
      : ext === '.js' || ext === '.mjs' ? 'text/javascript; charset=utf-8'
      : ext === '.json' ? 'application/json; charset=utf-8'
      : 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
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
if (address === null || typeof address === 'string') throw new Error('P10_1_RENDERER_PREVIEW_SERVER_FAILED');

let browser;
try {
  browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => consoleErrors.push(error.message));

  await page.goto(
    `http://127.0.0.1:${address.port}/st-score-editor-professional-workstation-renderer.html`,
    { waitUntil: 'load', timeout: 30000 }
  );

  await page.waitForFunction(() =>
    Boolean(globalThis.STScoreEditorProfessionalWorkstationController?.getDocument) &&
    document.documentElement.dataset.app09bRendererReady === 'true'
  , null, { timeout: 30000 });

  const boot = await page.evaluate(() => ({
    combined: globalThis.STScoreEditorProfessionalWorkstation?.profile?.professionalWorkstationComposition ?? false,
    controller: Boolean(globalThis.STScoreEditorProfessionalWorkstationController),
    preview: Boolean(globalThis.STScoreEditorProfessionalWorkstationRendererPreview),
    rendererReady: document.documentElement.dataset.app09bRendererReady ?? null,
    exactFrame: Boolean(document.querySelector('iframe[data-app09b-renderer-frame="true"]')),
    placeholderText: document.querySelector('.stse-viewport-placeholder')?.textContent ?? null
  }));
  if (!boot.combined || !boot.controller || !boot.preview || boot.rendererReady !== 'true' || !boot.exactFrame) {
    throw new Error(`P10-1 renderer preview bootstrap mismatch: ${JSON.stringify(boot)}`);
  }

  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.waitForFunction(() =>
    globalThis.STScoreEditorProfessionalWorkstationController?.getSnapshot?.().hasDocument === true
  );

  await page.evaluate(() => {
    const c = globalThis.STScoreEditorProfessionalWorkstationController;
    c.dispatchKeyboardIntent({
      version: '1.0.0',
      type: 'SET_ENTRY_PITCH',
      pitch: { step: 'C', alter: 0, octave: 4 }
    });
    c.dispatchKeyboardIntent({
      version: '1.0.0',
      type: 'SET_ENTRY_DURATION',
      duration: { numerator: 1, denominator: 4 }
    });
    c.dispatchKeyboardIntent({ version: '1.0.0', type: 'ENTER_NOTE' });
  });

  await page.waitForFunction(() => {
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    const child = frame instanceof HTMLIFrameElement ? frame.contentDocument : null;
    const c = globalThis.STScoreEditorProfessionalWorkstationController;
    const d = c?.getDocument?.();
    return document.documentElement.dataset.app09bRenderStatus === 'current' &&
      d?.session?.history?.present?.score?.revision?.id != null &&
      c?.getRendererState?.()?.status?.code === 'RENDERED_CURRENT_REVISION' &&
      (child?.querySelectorAll('svg').length ?? 0) > 0;
  }, null, { timeout: 30000 });

  const rendered = await page.evaluate(async () => {
    const c = globalThis.STScoreEditorProfessionalWorkstationController;
    const d = c.getDocument();
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    if (!(frame instanceof HTMLIFrameElement)) throw new Error('P10_1_RENDERER_FRAME_MISSING');
    const child = frame.contentDocument;
    const api = frame.contentWindow?.__ST_SCORE_RENDER_HOST__;
    if (!child || !api) throw new Error('P10_1_RENDERER_HOST_MISSING');

    const noteAddress = d.session.renderRequest.manifest.entries
      .find(entry => entry.address.kind === 'note')?.address;
    if (!noteAddress || noteAddress.kind !== 'note') throw new Error('P10_1_NOTE_ADDRESS_MISSING');

    const target = c.resolveRenderedScoreNoteRef(noteAddress);
    if (!target) throw new Error('P10_1_RENDERED_REF_MISSING');

    await api.clearHighlights();
    await api.highlight({ target, className: 'st-score-diagnostic-target' });
    const highlighted = child.querySelector('[data-st-score-highlight="true"]');
    if (!(highlighted instanceof frame.contentWindow.Element)) {
      throw new Error('P10_1_RENDERER_HIGHLIGHT_MISSING');
    }

    const rect = highlighted.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const fractions = [0.2, 0.35, 0.5, 0.65, 0.8];
    for (const fx of fractions) {
      for (const fy of fractions) {
        const childX = rect.left + rect.width * fx;
        const childY = rect.top + rect.height * fy;
        const hit = api.hitTestNoteDetailed({ clientX: childX, clientY: childY });
        if (hit?.kind === 'HIT') {
          return {
            svgCount: child.querySelectorAll('svg').length,
            pageX: frameRect.left + childX,
            pageY: frameRect.top + childY,
            noteId: noteAddress.noteId,
            hitNoteId: hit.target?.noteId ?? null,
            rendererStatus: c.getRendererState().status.code
          };
        }
      }
    }
    throw new Error('P10_1_RENDERER_HIT_MISSING');
  });

  if (
    rendered.svgCount < 1 ||
    rendered.rendererStatus !== 'RENDERED_CURRENT_REVISION' ||
    rendered.hitNoteId !== rendered.noteId
  ) {
    throw new Error(`P10-1 rendered evidence mismatch: ${JSON.stringify(rendered)}`);
  }

  await page.evaluate(async () => {
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    await frame?.contentWindow?.__ST_SCORE_RENDER_HOST__?.clearHighlights?.();
  });
  await page.touchscreen.tap(rendered.pageX, rendered.pageY);
  await page.waitForFunction(() =>
    document.documentElement.dataset.app09bLastHit === 'selected'
  , null, { timeout: 5000 });

  const interaction = await page.evaluate(() => {
    const c = globalThis.STScoreEditorProfessionalWorkstationController;
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    const child = frame instanceof HTMLIFrameElement ? frame.contentDocument : null;
    return {
      lastHit: document.documentElement.dataset.app09bLastHit ?? null,
      selectionKind: c.getDocument()?.session?.selection?.kind ?? null,
      highlighted: child?.querySelectorAll('.st-score-highlight').length ?? -1,
      rangeToolbar: Boolean(document.querySelector('[data-st-professional-range-toolbar]')),
      structureInspector: Boolean(document.querySelector('[data-st-professional-structure-inspector]'))
    };
  });

  if (
    interaction.lastHit !== 'selected' ||
    interaction.selectionKind !== 'note' ||
    interaction.highlighted < 1 ||
    !interaction.rangeToolbar ||
    !interaction.structureInspector
  ) {
    throw new Error(`P10-1 renderer touch bridge mismatch: ${JSON.stringify(interaction)}`);
  }

  if (consoleErrors.length !== 0) {
    throw new Error(`P10-1 renderer preview console errors: ${JSON.stringify(consoleErrors)}`);
  }

  console.log(`P10-1 renderer qualification WebKit: PASS (${JSON.stringify({ boot, rendered, interaction })})`);
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
