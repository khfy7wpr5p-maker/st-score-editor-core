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
const resolveRequestPath = (requestUrl) => {
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
if (address === null || typeof address === 'string') throw new Error('APP-10F WebKit server did not expose a TCP port.');

let browser;
try {
  browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => consoleErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${address.port}/st-score-editor-app.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => Boolean(globalThis.STScoreEditorAppController?.getSelectedNoteEditingState));
  const bootstrap = await page.evaluate(() => ({
    bundled: globalThis.STScoreEditorApp?.profile?.selectedNoteEditingBundled ?? false,
    runtime: globalThis.STScoreEditorApp?.selectedNoteEditing?.bundled ?? false,
    buttons: document.querySelectorAll('[data-st-selected-note-editing] button').length,
    release: globalThis.STScoreEditorApp?.profile?.standaloneReleaseGatePassed ?? null,
    cutover: globalThis.STScoreEditorApp?.profile?.seslitabCutoverAuthorized ?? null
  }));
  if (!bootstrap.bundled || !bootstrap.runtime || bootstrap.buttons !== 3 || bootstrap.release !== false || bootstrap.cutover !== false) {
    throw new Error(`APP-10F bootstrap mismatch: ${JSON.stringify(bootstrap)}`);
  }

  await page.getByRole('button', { name: 'New' }).click();
  await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const d = controller.getDocument();
    const event = d.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events[0];
    const entry = d.session.renderRequest.manifest.entries.find(item => item.address.kind === 'event' && item.address.eventId === event.id);
    if (!entry) throw new Error('APP10F_INITIAL_EVENT_MISSING');
    controller.select(entry.address);
  });

  await page.getByRole('button', { name: 'Pitch C', exact: true }).click();
  await page.getByRole('button', { name: 'Natural', exact: true }).click();
  await page.getByRole('combobox', { name: 'Octave' }).selectOption('4');
  await page.getByRole('button', { name: 'Duration 1/4', exact: true }).click();
  await page.getByRole('button', { name: 'Enter note at selected event time', exact: true }).click();
  await page.waitForFunction(() => globalThis.STScoreEditorAppController?.getDocument?.()?.session?.selection?.kind === 'note');

  await page.getByRole('button', { name: 'Pitch G', exact: true }).click();
  await page.getByRole('button', { name: 'Sharp', exact: true }).click();
  await page.getByRole('combobox', { name: 'Octave' }).selectOption('5');
  await page.getByRole('button', { name: 'Apply palette pitch to selected note', exact: true }).click();
  await page.getByRole('button', { name: 'Duration 1/8', exact: true }).click();
  await page.getByRole('button', { name: 'Apply palette duration to selected pitched event', exact: true }).click();

  const edited = await page.evaluate(() => {
    const d = globalThis.STScoreEditorAppController.getDocument();
    const event = d.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events[0];
    return { kind: event.kind, pitch: event.kind === 'note' ? event.note.pitch : null, duration: event.duration, past: d.session.history.past.length };
  });
  if (edited.kind !== 'note' || JSON.stringify(edited.pitch) !== JSON.stringify({ step: 'G', alter: 1, octave: 5 }) ||
      JSON.stringify(edited.duration) !== JSON.stringify({ numerator: 1, denominator: 8 }) || edited.past !== 3) {
    throw new Error(`APP-10F selected edit mismatch: ${JSON.stringify(edited)}`);
  }

  await page.getByRole('button', { name: 'Delete selected pitched content', exact: true }).click();
  const deleted = await page.evaluate(() => {
    const d = globalThis.STScoreEditorAppController.getDocument();
    return { kind: d.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events[0].kind, past: d.session.history.past.length };
  });
  if (deleted.kind !== 'rest' || deleted.past !== 4) throw new Error(`APP-10F delete mismatch: ${JSON.stringify(deleted)}`);

  await page.getByRole('button', { name: 'Undo' }).click();
  const undo = await page.evaluate(() => {
    const d = globalThis.STScoreEditorAppController.getDocument();
    const event = d.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events[0];
    return { kind: event.kind, pitch: event.kind === 'note' ? event.note.pitch : null, duration: event.duration, past: d.session.history.past.length };
  });
  if (undo.kind !== 'note' || undo.past !== 3 || JSON.stringify(undo.pitch) !== JSON.stringify({ step: 'G', alter: 1, octave: 5 })) {
    throw new Error(`APP-10F undo mismatch: ${JSON.stringify(undo)}`);
  }

  await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const d = controller.getDocument();
    const event = d.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events[0];
    const target = d.session.renderRequest.manifest.entries.find(item => item.address.kind === 'event' && item.address.eventId === event.id)?.address;
    if (!target) throw new Error('APP10F_CHORD_EVENT_TARGET_MISSING');
    const result = controller.commitBasic({ version:'1.0.0', type:'ADD_CHORD_TONE', target, noteId:'note:app10f-webkit-tone', pitch:{ step:'B', alter:0, octave:5 } }, { nextRevisionId:'rev:app10f-webkit-chord' });
    if (result.error) throw new Error(result.error.message);
  });
  await page.waitForFunction(() => globalThis.STScoreEditorAppController?.getSelectedNoteEditingState?.().deleteScope === 'CHORD_TONE');
  await page.getByRole('button', { name: 'Delete selected pitched content', exact: true }).click();
  const chordDelete = await page.evaluate(() => {
    const d = globalThis.STScoreEditorAppController.getDocument();
    const event = d.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events[0];
    return { kind: event.kind, pitch: event.kind === 'note' ? event.note.pitch : null };
  });
  if (chordDelete.kind !== 'note' || JSON.stringify(chordDelete.pitch) !== JSON.stringify({ step: 'G', alter: 1, octave: 5 })) {
    throw new Error(`APP-10F chord-tone delete mismatch: ${JSON.stringify(chordDelete)}`);
  }

  if (consoleErrors.length !== 0) throw new Error(`APP-10F browser console errors: ${JSON.stringify(consoleErrors)}`);
  console.log('APP-10F WebKit selected-note editing regression: PASS');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
