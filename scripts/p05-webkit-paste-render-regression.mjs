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

const intersects = (rect, viewport) =>
  rect.width > 0 && rect.height > 0 &&
  rect.right > 0 && rect.bottom > 0 &&
  rect.left < viewport.width && rect.top < viewport.height;

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
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));

  await page.goto(`http://127.0.0.1:${address.port}/st-score-editor-app09b.html`, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForFunction(() =>
    document.documentElement.dataset.app09bRendererReady === 'true' &&
    document.documentElement.dataset.app09bGenericRenderedEventTargeting === 'true',
  null, { timeout: 30_000 });

  await page.evaluate(async musicXml => {
    await globalThis.STScoreEditorAppController.openMusicXml(musicXml, { title: 'P05 Physical-like Paste Render Regression' });
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

  const visualEvidence = async () => page.evaluate(() => {
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    if (!(frame instanceof HTMLIFrameElement) || frame.contentDocument === null || frame.contentWindow === null) return null;
    const child = frame.contentDocument;
    const viewport = root => ({ width: root.clientWidth, height: root.clientHeight });
    const childViewport = viewport(child.documentElement);
    const staveRects = [...child.querySelectorAll('.vf-stavenote')].map(node => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
    });
    const svg = child.querySelector('svg');
    const svgRectValue = svg?.getBoundingClientRect();
    const frameRectValue = frame.getBoundingClientRect();
    const outer = document.querySelector('[data-st-score-editor-viewport]');
    return {
      windowViewport: { width: innerWidth, height: innerHeight },
      childViewport,
      staveRects,
      frameRect: frameRectValue ? {
        left: frameRectValue.left, top: frameRectValue.top, right: frameRectValue.right, bottom: frameRectValue.bottom,
        width: frameRectValue.width, height: frameRectValue.height
      } : null,
      svgRect: svgRectValue ? {
        left: svgRectValue.left, top: svgRectValue.top, right: svgRectValue.right, bottom: svgRectValue.bottom,
        width: svgRectValue.width, height: svgRectValue.height
      } : null,
      outerScroll: outer instanceof HTMLElement ? { left: outer.scrollLeft, top: outer.scrollTop, width: outer.clientWidth, height: outer.clientHeight } : null,
      childScroll: {
        left: child.scrollingElement?.scrollLeft ?? null,
        top: child.scrollingElement?.scrollTop ?? null,
        width: child.scrollingElement?.clientWidth ?? null,
        height: child.scrollingElement?.clientHeight ?? null
      }
    };
  });

  const assertVisibleScore = (label, evidence, expectedEvents) => {
    if (evidence === null) throw new Error(`${label}: renderer frame evidence unavailable.`);
    if (evidence.staveRects.length < expectedEvents) throw new Error(`${label}: insufficient rendered events ${JSON.stringify(evidence)}`);
    if (evidence.frameRect === null || !intersects(evidence.frameRect, evidence.windowViewport)) {
      throw new Error(`${label}: renderer iframe left the physical viewport ${JSON.stringify(evidence)}`);
    }
    const checked = evidence.staveRects.slice(0, expectedEvents);
    if (!checked.every(rect => intersects(rect, evidence.childViewport))) {
      throw new Error(`${label}: one or more score events rendered outside the iPhone-like iframe viewport ${JSON.stringify(evidence)}`);
    }
    if (evidence.svgRect === null || evidence.svgRect.width <= 0 || evidence.svgRect.height <= 0) {
      throw new Error(`${label}: SVG layout is empty ${JSON.stringify(evidence)}`);
    }
  };

  await waitForCurrentRender(3);
  const original = await page.evaluate(() => {
    const documentValue = globalThis.STScoreEditorAppController.getDocument();
    return {
      revision: documentValue.session.history.present.score.revision.id,
      past: documentValue.session.history.past.length,
      future: documentValue.session.history.future.length
    };
  });
  const beforeVisual = await visualEvidence();
  assertVisibleScore('before', beforeVisual, 3);

  const scoreFrame = page.frameLocator('iframe[data-app09b-renderer-frame="true"]');
  const renderedEvents = scoreFrame.locator('.vf-stavenote');
  if (await renderedEvents.count() < 3) throw new Error('P05 fixture did not expose three rendered event surfaces.');

  // Physical-like sequence: renderer touch -> actual mobile teacher toolbar buttons.
  await renderedEvents.nth(0).click();
  await page.waitForFunction(() => document.documentElement.dataset.app09bLastHit === 'selected-note');
  await page.getByRole('button', { name: 'Capture teacher range start', exact: true }).click();

  await renderedEvents.nth(1).click();
  await page.waitForFunction(() => document.documentElement.dataset.app09bLastHit === 'selected-note');
  await page.getByRole('button', { name: 'Copy captured teacher range', exact: true }).click();

  await renderedEvents.nth(2).click();
  await page.waitForFunction(() => document.documentElement.dataset.app09bLastHit === 'selected-rest');
  const restSelection = await page.evaluate(() => {
    const documentValue = globalThis.STScoreEditorAppController.getDocument();
    const selection = documentValue.session.selection;
    if (selection?.kind !== 'event') return null;
    const score = documentValue.session.history.present.score;
    const event = score.parts
      .flatMap(part => part.staves)
      .filter(staff => staff.role !== 'tablature-linked')
      .flatMap(staff => staff.measures)
      .flatMap(measure => measure.voices)
      .flatMap(voice => voice.events)
      .find(candidate => candidate.id === selection.eventId);
    return { selectionKind: selection.kind, eventKind: event?.kind ?? null, eventId: selection.eventId };
  });
  if (restSelection?.eventKind !== 'rest') throw new Error(`P05 generic rendered REST did not select canonical rest: ${JSON.stringify(restSelection)}`);

  await page.getByRole('button', { name: 'Paste over selected rest', exact: true }).click();
  await waitForCurrentRender(4);

  const pasted = await page.evaluate(() => {
    const state = globalThis.STScoreEditorApp09B.getState();
    const documentValue = globalThis.STScoreEditorAppController.getDocument();
    return {
      snapshotRevision: state.snapshot.revisionId,
      renderedRevision: state.renderer.renderedRevisionId,
      renderEpoch: state.renderEvidence?.renderEpoch ?? null,
      projectionStatus: documentValue.session.renderRequest.projectionStatus,
      sourceProjectionStatus: documentValue.session.renderRequest.sourceProjectionStatus,
      eventCount: documentValue.session.history.present.score.parts[0].staves.find(staff => staff.role === 'standard').measures[0].voices[0].events.length,
      past: documentValue.session.history.past.length
    };
  });
  if (pasted.snapshotRevision === original.revision) throw new Error(`P05 toolbar Paste did not advance canonical revision: ${JSON.stringify(pasted)}`);
  if (pasted.projectionStatus !== 'V3_COMPATIBLE_XML' || pasted.sourceProjectionStatus !== 'V2_COMPATIBLE_XML' || pasted.eventCount !== 4) {
    throw new Error(`P05 toolbar Paste produced unexpected canonical/projection state: ${JSON.stringify(pasted)}`);
  }
  const pastedVisual = await visualEvidence();
  assertVisibleScore('after-paste', pastedVisual, 4);

  await page.getByRole('button', { name: 'Undo last edit', exact: true }).click();
  await waitForCurrentRender(3);
  const undone = await page.evaluate(() => {
    const state = globalThis.STScoreEditorApp09B.getState();
    const documentValue = globalThis.STScoreEditorAppController.getDocument();
    const voice = documentValue.session.history.present.score.parts[0].staves.find(staff => staff.role === 'standard').measures[0].voices[0];
    return {
      snapshotRevision: state.snapshot.revisionId,
      renderedRevision: state.renderer.renderedRevisionId,
      renderEpoch: state.renderEvidence?.renderEpoch ?? null,
      eventKinds: voice.events.map(event => event.kind),
      past: documentValue.session.history.past.length,
      future: documentValue.session.history.future.length
    };
  });
  if (undone.snapshotRevision !== original.revision || undone.renderedRevision !== original.revision) {
    throw new Error(`P05 toolbar Undo did not restore original canonical/rendered revision: ${JSON.stringify({ original, undone })}`);
  }
  if (JSON.stringify(undone.eventKinds) !== JSON.stringify(['note', 'note', 'rest'])) {
    throw new Error(`P05 toolbar Undo did not restore C-D-rest event structure: ${JSON.stringify(undone)}`);
  }
  const undoneVisual = await visualEvidence();
  assertVisibleScore('after-undo', undoneVisual, 3);

  if (errors.length > 0) throw new Error(`P05 WebKit console errors: ${errors.slice(-12).join(' | ')}`);

  console.log(`P05 WebKit physical-like paste/render/undo regression: PASS (${JSON.stringify({
    restSelection,
    original,
    pasted,
    undone,
    viewport: { before: beforeVisual, pasted: pastedVisual, undone: undoneVisual }
  })})`);
} finally {
  if (browser !== undefined) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
