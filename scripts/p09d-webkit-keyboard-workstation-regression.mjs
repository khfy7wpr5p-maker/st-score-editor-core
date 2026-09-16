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
if (address === null || typeof address === 'string') {
  server.close();
  throw new Error('P09-D WebKit server did not expose a TCP port.');
}

let browser;
try {
  browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => consoleErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${address.port}/st-score-editor-app.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => Boolean(globalThis.STScoreEditorAppController?.getKeyboardWorkstationState));

  const bootstrap = await page.evaluate(() => ({
    bundled: globalThis.STScoreEditorApp?.profile?.keyboardWorkstationBundled ?? false,
    authority: globalThis.STScoreEditorApp?.profile?.keyboardWorkstationCanonicalAuthority ?? true,
    state: globalThis.STScoreEditorAppController.getKeyboardWorkstationState()
  }));
  if (!bootstrap.bundled || bootstrap.authority !== false || bootstrap.state.intentVersion !== '1.0.0' || bootstrap.state.bindingCount !== 6 || !bootstrap.state.mounted) {
    throw new Error(`P09-D keyboard bootstrap mismatch: ${JSON.stringify(bootstrap)}`);
  }

  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.waitForFunction(() => globalThis.STScoreEditorAppController?.getSnapshot?.().hasDocument === true);
  await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const d = controller.getDocument();
    const score = d.session.history.present.score;
    const event = score.parts[0].staves.find(staff => staff.role === 'standard').measures[0].voices[0].events[0];
    const entry = d.session.renderRequest.manifest.entries.find(item => item.address.kind === 'event' && item.address.eventId === event.id);
    if (!entry) throw new Error('P09D_EVENT_MISSING');
    controller.select(entry.address);
    controller.dispatchKeyboardIntent({ version: '1.0.0', type: 'SET_ENTRY_PITCH', pitch: { step: 'C', alter: 0, octave: 4 } });
    controller.dispatchKeyboardIntent({ version: '1.0.0', type: 'SET_ENTRY_DURATION', duration: { numerator: 1, denominator: 4 } });
  });

  const viewport = page.locator('[data-st-score-editor-viewport]');
  await viewport.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => globalThis.STScoreEditorAppController?.getAuthoringState?.().status?.code === 'NOTE_ENTERED');

  const entered = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const d = controller.getDocument();
    const event = d.session.history.present.score.parts[0].staves.find(staff => staff.role === 'standard').measures[0].voices[0].events[0];
    return {
      kind: event.kind,
      pitch: event.kind === 'note' ? event.note.pitch : null,
      duration: event.duration,
      past: d.session.history.past.length,
      selectionKind: d.session.selection?.kind ?? null,
      selectionRevision: d.session.selection?.revisionId ?? null,
      revision: d.session.history.present.score.revision.id
    };
  });
  if (entered.kind !== 'note' || JSON.stringify(entered.pitch) !== JSON.stringify({ step: 'C', alter: 0, octave: 4 }) ||
      JSON.stringify(entered.duration) !== JSON.stringify({ numerator: 1, denominator: 4 }) || entered.past !== 1 ||
      entered.selectionKind !== 'note' || entered.selectionRevision !== entered.revision) {
    throw new Error(`P09-D Enter note mismatch: ${JSON.stringify(entered)}`);
  }

  await viewport.focus();
  await page.keyboard.press('Control+z');
  const undone = await page.evaluate(() => {
    const d = globalThis.STScoreEditorAppController.getDocument();
    const event = d.session.history.present.score.parts[0].staves.find(staff => staff.role === 'standard').measures[0].voices[0].events[0];
    return { kind: event.kind, past: d.session.history.past.length, future: d.session.history.future.length, selection: d.session.selection };
  });
  if (undone.kind !== 'rest' || undone.past !== 0 || undone.future !== 1 || undone.selection !== null) {
    throw new Error(`P09-D keyboard Undo mismatch: ${JSON.stringify(undone)}`);
  }

  await viewport.focus();
  await page.keyboard.press('Control+y');
  const redone = await page.evaluate(() => {
    const d = globalThis.STScoreEditorAppController.getDocument();
    const event = d.session.history.present.score.parts[0].staves.find(staff => staff.role === 'standard').measures[0].voices[0].events[0];
    return { kind: event.kind, past: d.session.history.past.length, future: d.session.history.future.length };
  });
  if (redone.kind !== 'note' || redone.past !== 1 || redone.future !== 0) {
    throw new Error(`P09-D keyboard Redo mismatch: ${JSON.stringify(redone)}`);
  }

  const editableBefore = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const root = document.getElementById('st-score-editor-app-root');
    const input = document.createElement('input');
    input.setAttribute('data-p09d-editable-probe', 'true');
    root.append(input);
    input.focus();
    const d = controller.getDocument();
    return d.session.history.past.length;
  });
  await page.keyboard.press('Enter');
  const editableAfter = await page.evaluate(() => globalThis.STScoreEditorAppController.getDocument().session.history.past.length);
  if (editableAfter !== editableBefore) throw new Error(`P09-D editable target was hijacked: ${editableBefore} -> ${editableAfter}`);

  await viewport.focus();
  const beforePan = await page.evaluate(() => ({
    x: globalThis.STScoreEditorAppController.getViewportState().scrollX,
    past: globalThis.STScoreEditorAppController.getDocument().session.history.past.length
  }));
  await page.keyboard.press('ArrowRight');
  const afterPan = await page.evaluate(() => ({
    x: globalThis.STScoreEditorAppController.getViewportState().scrollX,
    past: globalThis.STScoreEditorAppController.getDocument().session.history.past.length
  }));
  if (afterPan.x <= beforePan.x || afterPan.past !== beforePan.past) {
    throw new Error(`P09-D viewport coexistence mismatch: ${JSON.stringify({ beforePan, afterPan })}`);
  }

  const navigationSetup = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    controller.appendMeasure();
    const d = controller.getDocument();
    return { past: d.session.history.past.length, frameId: d.session.selection?.frameId ?? null, frames: d.session.history.present.score.measureFrames.map(frame => frame.id) };
  });
  await viewport.focus();
  await page.keyboard.press('[');
  const previous = await page.evaluate(() => {
    const d = globalThis.STScoreEditorAppController.getDocument();
    return { past: d.session.history.past.length, frameId: d.session.selection?.frameId ?? null };
  });
  if (previous.frameId !== navigationSetup.frames[0] || previous.past !== navigationSetup.past) {
    throw new Error(`P09-D previous-measure keyboard mismatch: ${JSON.stringify({ navigationSetup, previous })}`);
  }
  await viewport.focus();
  await page.keyboard.press(']');
  const next = await page.evaluate(() => {
    const d = globalThis.STScoreEditorAppController.getDocument();
    return { past: d.session.history.past.length, frameId: d.session.selection?.frameId ?? null };
  });
  if (next.frameId !== navigationSetup.frames[1] || next.past !== navigationSetup.past) {
    throw new Error(`P09-D next-measure keyboard mismatch: ${JSON.stringify({ navigationSetup, next })}`);
  }

  await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const root = document.getElementById('st-score-editor-app-root');
    controller.unmount();
    controller.mount(root);
  });
  const remounted = await page.evaluate(() => globalThis.STScoreEditorAppController.getKeyboardWorkstationState());
  if (!remounted.mounted || remounted.bindingCount !== 6) throw new Error(`P09-D remount mismatch: ${JSON.stringify(remounted)}`);

  if (consoleErrors.length !== 0) throw new Error(`P09-D browser console errors: ${JSON.stringify(consoleErrors)}`);
  console.log('P09-D WebKit keyboard workstation regression: PASS');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
