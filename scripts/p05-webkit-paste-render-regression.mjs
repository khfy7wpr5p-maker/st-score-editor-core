import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webkit } from 'playwright';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const browserRoot = path.join(repoRoot, 'dist', 'browser');
const fixture = await readFile(path.join(repoRoot, 'corpus/fixtures/p05-synthetic-teacher-edit.musicxml'), 'utf8');
const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.xml', 'application/xml; charset=utf-8'],
  ['.musicxml', 'application/xml; charset=utf-8']
]);

const requestPath = requestUrl => {
  const pathname = decodeURIComponent(new URL(requestUrl ?? '/', 'http://127.0.0.1').pathname);
  const resolved = path.resolve(browserRoot, pathname.replace(/^\/+/, '') || 'st-score-editor-app09b.html');
  if (resolved !== browserRoot && !resolved.startsWith(`${browserRoot}${path.sep}`)) {
    throw new Error('request escaped browser output root');
  }
  return resolved;
};

const server = createServer(async (request, response) => {
  try {
    const resolved = requestPath(request.url);
    const info = await stat(resolved);
    if (!info.isFile()) return void response.writeHead(404).end('not found');
    response.setHeader('Content-Type', contentTypes.get(path.extname(resolved)) ?? 'application/octet-stream');
    response.setHeader('Cache-Control', 'no-store');
    createReadStream(resolved).pipe(response);
  } catch {
    response.writeHead(404).end('not found');
  }
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const address = server.address();
if (address === null || typeof address === 'string') throw new Error('P05 WebKit server port unavailable.');

let browser;
try {
  browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));

  await page.goto(`http://127.0.0.1:${address.port}/st-score-editor-app09b.html`, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForFunction(() => document.documentElement.dataset.app09bRendererReady === 'true', null, { timeout: 30_000 });
  await page.evaluate(async musicXml => {
    await globalThis.STScoreEditorAppController.openMusicXml(musicXml, { title: 'P05 Paste Render Regression' });
  }, fixture);

  const waitForCurrentRender = async expectedEvents => page.waitForFunction(eventCount => {
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    const child = frame instanceof HTMLIFrameElement ? frame.contentDocument : null;
    const state = globalThis.STScoreEditorApp09B?.getState?.();
    const documentValue = globalThis.STScoreEditorAppController?.getDocument?.();
    const voice = documentValue?.session?.history?.present?.score?.parts?.[0]?.staves?.find(staff => staff.role === 'standard')?.measures?.[0]?.voices?.[0];
    return document.documentElement.dataset.app09bRenderStatus === 'current' &&
      state?.renderer?.renderedRevisionId === state?.snapshot?.revisionId &&
      state?.renderer?.status?.code === 'RENDERED_CURRENT_REVISION' &&
      voice?.events?.length === eventCount &&
      (child?.querySelectorAll('svg').length ?? 0) > 0 &&
      (child?.querySelectorAll('.vf-stavenote').length ?? 0) >= eventCount;
  }, expectedEvents, { timeout: 30_000 });

  await waitForCurrentRender(3);
  const original = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const documentValue = controller.getDocument();
    const score = documentValue.session.history.present.score;
    const staff = score.parts[0].staves.find(candidate => candidate.role === 'standard');
    const measure = staff.measures[0];
    const voice = measure.voices[0];
    const addressFor = event => ({
      contractVersion: '3.0.0', kind: 'event', documentId: score.id, revisionId: score.revision.id,
      partId: score.parts[0].id, staffId: staff.id, frameId: measure.frameId,
      measureId: measure.id, voiceId: voice.id, eventId: event.id
    });
    controller.select(addressFor(voice.events[0]));
    controller.captureTeacherRangeStartAtSelection();
    controller.select(addressFor(voice.events[1]));
    controller.copyTeacherRangeToSelection();
    controller.select(addressFor(voice.events[2]));
    const beforeRevision = score.revision.id;
    controller.pasteTeacherClipboardOverwriteAtSelection();
    const after = controller.getDocument();
    return {
      beforeRevision,
      afterRevision: after.session.history.present.score.revision.id,
      projectionStatus: after.session.renderRequest.projectionStatus,
      sourceProjectionStatus: after.session.renderRequest.sourceProjectionStatus,
      musicXml: after.session.renderRequest.musicXml
    };
  });

  if (original.afterRevision === original.beforeRevision) throw new Error('P05 paste did not advance canonical revision.');
  if (original.projectionStatus !== 'V3_COMPATIBLE_XML' || original.sourceProjectionStatus !== 'V2_COMPATIBLE_XML') {
    throw new Error(`P05 pasted projection was not renderable: ${JSON.stringify(original)}`);
  }
  await waitForCurrentRender(4);

  const pasted = await page.evaluate(() => {
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    const child = frame instanceof HTMLIFrameElement ? frame.contentDocument : null;
    const state = globalThis.STScoreEditorApp09B.getState();
    return {
      snapshotRevision: state.snapshot.revisionId,
      renderedRevision: state.renderer.renderedRevisionId,
      renderEpoch: state.renderEvidence?.renderEpoch ?? null,
      svgCount: child?.querySelectorAll('svg').length ?? -1,
      staveNoteCount: child?.querySelectorAll('.vf-stavenote').length ?? -1,
      frameDisplay: frame instanceof HTMLIFrameElement ? frame.style.display : null
    };
  });
  if (pasted.staveNoteCount < 4) throw new Error(`P05 pasted score did not visibly render four events: ${JSON.stringify(pasted)}`);

  await page.evaluate(() => { globalThis.STScoreEditorAppController.undo(); });
  await waitForCurrentRender(3);
  const undone = await page.evaluate(() => {
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    const child = frame instanceof HTMLIFrameElement ? frame.contentDocument : null;
    const state = globalThis.STScoreEditorApp09B.getState();
    return {
      snapshotRevision: state.snapshot.revisionId,
      renderedRevision: state.renderer.renderedRevisionId,
      renderEpoch: state.renderEvidence?.renderEpoch ?? null,
      svgCount: child?.querySelectorAll('svg').length ?? -1,
      staveNoteCount: child?.querySelectorAll('.vf-stavenote').length ?? -1
    };
  });
  if (undone.snapshotRevision !== original.beforeRevision || undone.staveNoteCount < 3) {
    throw new Error(`P05 Undo did not restore the original visible score: ${JSON.stringify({ original, undone })}`);
  }
  if (errors.length > 0) throw new Error(`P05 WebKit console errors: ${errors.slice(-12).join(' | ')}`);

  console.log(`P05 WebKit paste render regression: PASS (${JSON.stringify({ pasted, undone })})`);
} finally {
  if (browser !== undefined) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
