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
  if (resolved !== browserRoot && !resolved.startsWith(`${browserRoot}${path.sep}`)) throw new Error('request escaped browser output root');
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
if (address === null || typeof address === 'string') throw new Error('APP-11B WebKit server did not expose a TCP port.');

let browser;
try {
  browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => consoleErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${address.port}/st-score-editor-app.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => Boolean(globalThis.STScoreEditorAppController?.getDocument));

  const bootstrap = await page.evaluate(() => ({
    release: globalThis.STScoreEditorApp?.profile?.standaloneReleaseGatePassed ?? null,
    cutover: globalThis.STScoreEditorApp?.profile?.seslitabCutoverAuthorized ?? null
  }));
  if (bootstrap.release !== false || bootstrap.cutover !== false) {
    throw new Error(`APP-11B release boundary mismatch: ${JSON.stringify(bootstrap)}`);
  }

  await page.getByRole('button', { name: 'New' }).click();
  await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const d = controller.getDocument();
    const event = d.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events[0];
    const entry = d.session.renderRequest.manifest.entries.find(item => item.address.kind === 'event' && item.address.eventId === event.id);
    if (!entry) throw new Error('APP11B_INITIAL_EVENT_MISSING');
    controller.select(entry.address);
  });

  await page.getByRole('button', { name: 'Pitch C', exact: true }).click();
  await page.getByRole('button', { name: 'Natural', exact: true }).click();
  await page.getByRole('combobox', { name: 'Octave' }).selectOption('4');
  await page.getByRole('button', { name: 'Duration 1/4', exact: true }).click();
  await page.getByRole('button', { name: 'Enter note at selected event time', exact: true }).click();
  await page.waitForFunction(() => globalThis.STScoreEditorAppController?.getDocument?.()?.session?.selection?.kind === 'note');

  const entered = await page.evaluate(() => {
    const d = globalThis.STScoreEditorAppController.getDocument();
    const events = d.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events;
    return {
      selectionKind: d.session.selection?.kind ?? null,
      selectionNoteId: d.session.selection?.kind === 'note' ? d.session.selection.noteId : null,
      past: d.session.history.past.length,
      events: events.map(event => ({ id: event.id, kind: event.kind, onset: event.onset, duration: event.duration }))
    };
  });
  if (entered.selectionKind !== 'note' || entered.past !== 1 || entered.events.length !== 2 || entered.events[0].kind !== 'note' || entered.events[1].kind !== 'rest' ||
      JSON.stringify(entered.events[0].duration) !== JSON.stringify({ numerator: 1, denominator: 4 }) ||
      JSON.stringify(entered.events[1].onset) !== JSON.stringify({ numerator: 1, denominator: 4 }) ||
      JSON.stringify(entered.events[1].duration) !== JSON.stringify({ numerator: 3, denominator: 4 })) {
    throw new Error(`APP-11B entry baseline mismatch: ${JSON.stringify(entered)}`);
  }
  const originalRestId = entered.events[1].id;
  const selectedNoteId = entered.selectionNoteId;

  await page.getByRole('button', { name: 'Duration 1/8', exact: true }).click();
  await page.getByRole('button', { name: 'Apply palette duration to selected pitched event', exact: true }).click();
  const contracted = await page.evaluate(() => {
    const d = globalThis.STScoreEditorAppController.getDocument();
    const events = d.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events;
    return {
      selectionKind: d.session.selection?.kind ?? null,
      selectionNoteId: d.session.selection?.kind === 'note' ? d.session.selection.noteId : null,
      past: d.session.history.past.length,
      events: events.map(event => ({ id: event.id, kind: event.kind, onset: event.onset, duration: event.duration }))
    };
  });
  if (contracted.selectionKind !== 'note' || contracted.selectionNoteId !== selectedNoteId || contracted.past !== 2 || contracted.events.length !== 2 ||
      contracted.events[1].id !== originalRestId ||
      JSON.stringify(contracted.events[0].duration) !== JSON.stringify({ numerator: 1, denominator: 8 }) ||
      JSON.stringify(contracted.events[1].onset) !== JSON.stringify({ numerator: 1, denominator: 8 }) ||
      JSON.stringify(contracted.events[1].duration) !== JSON.stringify({ numerator: 7, denominator: 8 })) {
    throw new Error(`APP-11B contraction/rest-extension mismatch: ${JSON.stringify(contracted)}`);
  }

  await page.getByRole('button', { name: 'Duration 1/2', exact: true }).click();
  await page.getByRole('button', { name: 'Apply palette duration to selected pitched event', exact: true }).click();
  const grown = await page.evaluate(() => {
    const d = globalThis.STScoreEditorAppController.getDocument();
    const events = d.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events;
    return {
      selectionKind: d.session.selection?.kind ?? null,
      selectionNoteId: d.session.selection?.kind === 'note' ? d.session.selection.noteId : null,
      past: d.session.history.past.length,
      events: events.map(event => ({ id: event.id, kind: event.kind, onset: event.onset, duration: event.duration }))
    };
  });
  if (grown.selectionKind !== 'note' || grown.selectionNoteId !== selectedNoteId || grown.past !== 3 || grown.events.length !== 2 || grown.events[1].id !== originalRestId ||
      JSON.stringify(grown.events[0].duration) !== JSON.stringify({ numerator: 1, denominator: 2 }) ||
      JSON.stringify(grown.events[1].onset) !== JSON.stringify({ numerator: 1, denominator: 2 }) ||
      JSON.stringify(grown.events[1].duration) !== JSON.stringify({ numerator: 1, denominator: 2 })) {
    throw new Error(`APP-11B adjacent-rest consumption mismatch: ${JSON.stringify(grown)}`);
  }

  await page.getByRole('button', { name: 'Duration 1/1', exact: true }).click();
  await page.getByRole('button', { name: 'Apply palette duration to selected pitched event', exact: true }).click();
  const consumed = await page.evaluate(() => {
    const d = globalThis.STScoreEditorAppController.getDocument();
    const events = d.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events;
    return {
      selectionKind: d.session.selection?.kind ?? null,
      selectionNoteId: d.session.selection?.kind === 'note' ? d.session.selection.noteId : null,
      past: d.session.history.past.length,
      events: events.map(event => ({ id: event.id, kind: event.kind, onset: event.onset, duration: event.duration }))
    };
  });
  if (consumed.selectionKind !== 'note' || consumed.selectionNoteId !== selectedNoteId || consumed.past !== 4 || consumed.events.length !== 1 ||
      JSON.stringify(consumed.events[0].duration) !== JSON.stringify({ numerator: 1, denominator: 1 })) {
    throw new Error(`APP-11B full-rest consumption mismatch: ${JSON.stringify(consumed)}`);
  }

  await page.getByRole('button', { name: 'Undo' }).click();
  const undo = await page.evaluate(() => {
    const d = globalThis.STScoreEditorAppController.getDocument();
    const events = d.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events;
    return {
      past: d.session.history.past.length,
      events: events.map(event => ({ id: event.id, kind: event.kind, onset: event.onset, duration: event.duration }))
    };
  });
  if (undo.past !== 3 || undo.events.length !== 2 || undo.events[1].id !== originalRestId ||
      JSON.stringify(undo.events[0].duration) !== JSON.stringify({ numerator: 1, denominator: 2 }) ||
      JSON.stringify(undo.events[1].onset) !== JSON.stringify({ numerator: 1, denominator: 2 }) ||
      JSON.stringify(undo.events[1].duration) !== JSON.stringify({ numerator: 1, denominator: 2 })) {
    throw new Error(`APP-11B undo mismatch: ${JSON.stringify(undo)}`);
  }

  if (consoleErrors.length !== 0) throw new Error(`APP-11B browser console errors: ${JSON.stringify(consoleErrors)}`);
  console.log('APP-11B WebKit rhythm timing regression: PASS');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
