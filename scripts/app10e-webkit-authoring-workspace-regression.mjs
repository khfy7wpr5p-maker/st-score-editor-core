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
if (address === null || typeof address === 'string') {
  server.close();
  throw new Error('APP-10E WebKit server did not expose a TCP port.');
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
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => consoleErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${address.port}/st-score-editor-app.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => Boolean(globalThis.STScoreEditorAppController?.getAuthoringState));

  const bootstrap = await page.evaluate(() => ({
    bundled: globalThis.STScoreEditorApp?.profile?.authoringWorkspaceBundled ?? false,
    voices: [...(globalThis.STScoreEditorApp?.authoringWorkspace?.activeVoiceOrdinals ?? [])],
    palette: Boolean(document.querySelector('[data-st-authoring-palette]')),
    voiceButtons: document.querySelectorAll('[data-st-authoring-palette] button[aria-label^="Voice "]').length
  }));
  if (!bootstrap.bundled || JSON.stringify(bootstrap.voices) !== JSON.stringify([1,2,3,4,5]) || !bootstrap.palette || bootstrap.voiceButtons !== 5) {
    throw new Error(`APP-10E authoring bootstrap mismatch: ${JSON.stringify(bootstrap)}`);
  }

  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.waitForFunction(() => globalThis.STScoreEditorAppController?.getSnapshot?.().hasDocument === true);
  await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const documentValue = controller.getDocument();
    const entry = documentValue.session.renderRequest.manifest.entries.find(item => item.address.kind === 'event');
    if (!entry) throw new Error('APP10E_GUITAR_EVENT_MISSING');
    controller.select(entry.address);
  });

  await page.getByRole('button', { name: 'Voice 5', exact: true }).click();
  await page.waitForFunction(() => {
    const state = globalThis.STScoreEditorAppController?.getAuthoringState?.();
    return state?.activeVoiceOrdinal === 5 && state.availableVoices.includes(5);
  });

  await page.getByRole('button', { name: 'Pitch F', exact: true }).click();
  await page.getByRole('button', { name: 'Sharp', exact: true }).click();
  await page.getByRole('combobox', { name: 'Octave', exact: true }).selectOption('5');
  await page.getByRole('button', { name: 'Duration 1/8', exact: true }).click();
  await page.getByRole('button', { name: 'Enter note at selected event time', exact: true }).click();
  await page.waitForFunction(() => globalThis.STScoreEditorAppController?.getAuthoringState?.().status?.code === 'NOTE_ENTERED');

  const guitar = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const documentValue = controller.getDocument();
    const measure = documentValue.session.history.present.score.parts[0].staves[0].measures[0];
    const voice5 = measure.voices.find(voice => voice.ordinal === 5);
    const first = voice5?.events[0] ?? null;
    const xml = controller.exportMusicXml();
    return {
      historyPast: documentValue.session.history.past.length,
      voiceOrdinals: measure.voices.map(voice => voice.ordinal),
      firstKind: first?.kind ?? null,
      pitch: first?.kind === 'note' ? first.note.pitch : null,
      duration: first?.duration ?? null,
      xmlHasVoice5: /<voice>5<\/voice>/.test(xml),
      activeVoice: controller.getAuthoringState().activeVoiceOrdinal
    };
  });
  if (guitar.historyPast !== 2 || !guitar.voiceOrdinals.includes(5) || guitar.firstKind !== 'note' ||
      JSON.stringify(guitar.pitch) !== JSON.stringify({ step: 'F', alter: 1, octave: 5 }) ||
      JSON.stringify(guitar.duration) !== JSON.stringify({ numerator: 1, denominator: 8 }) ||
      !guitar.xmlHasVoice5 || guitar.activeVoice !== 5) {
    throw new Error(`APP-10E Guitar Voice-5 entry mismatch: ${JSON.stringify(guitar)}`);
  }

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  const afterUndo = await page.evaluate(() => {
    const d = globalThis.STScoreEditorAppController.getDocument();
    const v5 = d.session.history.present.score.parts[0].staves[0].measures[0].voices.find(v => v.ordinal === 5);
    return { past: d.session.history.past.length, kind: v5?.events[0]?.kind ?? null };
  });
  if (afterUndo.past !== 1 || afterUndo.kind !== 'rest') throw new Error(`APP-10E note undo mismatch: ${JSON.stringify(afterUndo)}`);

  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  const afterRedo = await page.evaluate(() => {
    const d = globalThis.STScoreEditorAppController.getDocument();
    const v5 = d.session.history.present.score.parts[0].staves[0].measures[0].voices.find(v => v.ordinal === 5);
    return { past: d.session.history.past.length, kind: v5?.events[0]?.kind ?? null };
  });
  if (afterRedo.past !== 2 || afterRedo.kind !== 'note') throw new Error(`APP-10E note redo mismatch: ${JSON.stringify(afterRedo)}`);

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  const afterVoiceUndo = await page.evaluate(() => {
    const d = globalThis.STScoreEditorAppController.getDocument();
    return {
      past: d.session.history.past.length,
      voiceOrdinals: d.session.history.present.score.parts[0].staves[0].measures[0].voices.map(v => v.ordinal)
    };
  });
  if (afterVoiceUndo.past !== 0 || JSON.stringify(afterVoiceUndo.voiceOrdinals) !== JSON.stringify([1])) {
    throw new Error(`APP-10E Voice materialization undo mismatch: ${JSON.stringify(afterVoiceUndo)}`);
  }

  await page.getByRole('combobox', { name: 'New score type', exact: true }).selectOption('PIANO_GRAND_STAFF');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.waitForFunction(() => globalThis.STScoreEditorAppController?.getDocument?.()?.session?.history?.present?.score?.parts?.[0]?.staves?.length === 2);
  await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const documentValue = controller.getDocument();
    const lower = documentValue.session.history.present.score.parts[0].staves[1];
    const eventId = lower.measures[0].voices[0].events[0].id;
    const entry = documentValue.session.renderRequest.manifest.entries.find(item => item.address.kind === 'event' && item.address.eventId === eventId);
    if (!entry) throw new Error('APP10E_PIANO_LOWER_EVENT_MISSING');
    controller.select(entry.address);
  });
  await page.getByRole('button', { name: 'Voice 5', exact: true }).click();
  await page.getByRole('button', { name: 'Enter note at selected event time', exact: true }).click();
  await page.waitForFunction(() => globalThis.STScoreEditorAppController?.getAuthoringState?.().status?.code === 'NOTE_ENTERED');

  const piano = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const d = controller.getDocument();
    const score = d.session.history.present.score;
    const upper = score.parts[0].staves[0].measures[0];
    const lower = score.parts[0].staves[1].measures[0];
    const v5 = lower.voices.find(v => v.ordinal === 5);
    return {
      upper: upper.voices.map(v => v.ordinal),
      lower: lower.voices.map(v => v.ordinal),
      lowerVoice5Kind: v5?.events[0]?.kind ?? null,
      selectionStaffId: d.session.selection?.kind === 'note' || d.session.selection?.kind === 'event' ? d.session.selection.staffId : null,
      lowerStaffId: score.parts[0].staves[1].id,
      historyPast: d.session.history.past.length
    };
  });
  if (JSON.stringify(piano.upper) !== JSON.stringify([1]) || !piano.lower.includes(5) || piano.lowerVoice5Kind !== 'note' ||
      piano.selectionStaffId !== piano.lowerStaffId || piano.historyPast !== 2) {
    throw new Error(`APP-10E Piano lower-staff isolation mismatch: ${JSON.stringify(piano)}`);
  }

  if (consoleErrors.length !== 0) throw new Error(`APP-10E browser console errors: ${JSON.stringify(consoleErrors)}`);
  console.log('APP-10E WebKit authoring workspace regression: PASS');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
