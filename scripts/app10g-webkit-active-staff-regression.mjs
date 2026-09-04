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
if (address === null || typeof address === 'string') throw new Error('APP-10G WebKit server did not expose a TCP port.');

let browser;
try {
  browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => consoleErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${address.port}/st-score-editor-app.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => Boolean(globalThis.STScoreEditorAppController?.getActiveStaffState));
  const bootstrap = await page.evaluate(() => ({
    bundled: globalThis.STScoreEditorApp?.profile?.activeStaffAuthoringBundled ?? false,
    runtime: globalThis.STScoreEditorApp?.activeStaffAuthoring?.bundled ?? false,
    selectionPolicy: globalThis.STScoreEditorApp?.profile?.activeStaffSelection ?? null,
    release: globalThis.STScoreEditorApp?.profile?.standaloneReleaseGatePassed ?? null,
    cutover: globalThis.STScoreEditorApp?.profile?.seslitabCutoverAuthorized ?? null
  }));
  if (!bootstrap.bundled || !bootstrap.runtime || bootstrap.selectionPolicy !== 'same-part-same-frame-semantic-only' || bootstrap.release !== false || bootstrap.cutover !== false) {
    throw new Error(`APP-10G bootstrap mismatch: ${JSON.stringify(bootstrap)}`);
  }

  await page.getByRole('combobox', { name: 'New score type', exact: true }).selectOption('PIANO_GRAND_STAFF');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-st-active-staff-authoring] button').length === 2);

  const initial = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const d = controller.getDocument();
    const staves = d.session.history.present.score.parts[0].staves.filter(staff => staff.role === 'standard');
    return {
      state: controller.getActiveStaffState(),
      selectionKind: d.session.selection?.kind ?? null,
      selectionStaffId: d.session.selection?.staffId ?? null,
      upperStaffId: staves[0]?.id ?? null,
      lowerStaffId: staves[1]?.id ?? null,
      past: d.session.history.past.length
    };
  });
  if (initial.state.activeStaffOrdinal !== 1 || initial.state.availableStaffs.length !== 2 || initial.selectionKind !== 'event' ||
      initial.selectionStaffId !== initial.upperStaffId || initial.past !== 0) {
    throw new Error(`APP-10G initial anchor mismatch: ${JSON.stringify(initial)}`);
  }

  await page.getByRole('button', { name: 'Staff 2', exact: true }).click();
  const lowerSelected = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const d = controller.getDocument();
    const staves = d.session.history.present.score.parts[0].staves.filter(staff => staff.role === 'standard');
    return {
      active: controller.getActiveStaffState().activeStaffOrdinal,
      selectionKind: d.session.selection?.kind ?? null,
      selectionStaffId: d.session.selection?.staffId ?? null,
      lowerStaffId: staves[1]?.id ?? null,
      past: d.session.history.past.length
    };
  });
  if (lowerSelected.active !== 2 || lowerSelected.selectionKind !== 'event' || lowerSelected.selectionStaffId !== lowerSelected.lowerStaffId || lowerSelected.past !== 0) {
    throw new Error(`APP-10G Staff 2 semantic switch mismatch: ${JSON.stringify(lowerSelected)}`);
  }

  await page.getByRole('button', { name: 'Voice 5', exact: true }).click();
  await page.getByRole('button', { name: 'Pitch C', exact: true }).click();
  await page.getByRole('button', { name: 'Natural', exact: true }).click();
  await page.getByRole('combobox', { name: 'Octave' }).selectOption('4');
  await page.getByRole('button', { name: 'Duration 1/4', exact: true }).click();
  await page.getByRole('button', { name: 'Enter note at selected event time', exact: true }).click();

  const lowerAuthored = await page.evaluate(() => {
    const d = globalThis.STScoreEditorAppController.getDocument();
    const staves = d.session.history.present.score.parts[0].staves.filter(staff => staff.role === 'standard');
    const upper = staves[0];
    const lower = staves[1];
    const voice5 = lower.measures[0].voices.find(voice => voice.ordinal === 5);
    return {
      upperVoiceCount: upper.measures[0].voices.length,
      lowerVoiceCount: lower.measures[0].voices.length,
      lowerVoice5HasNote: voice5?.events.some(event => event.kind === 'note') ?? false,
      selectionStaffId: d.session.selection?.staffId ?? null,
      lowerStaffId: lower.id,
      past: d.session.history.past.length
    };
  });
  if (lowerAuthored.upperVoiceCount !== 1 || lowerAuthored.lowerVoiceCount !== 2 || !lowerAuthored.lowerVoice5HasNote ||
      lowerAuthored.selectionStaffId !== lowerAuthored.lowerStaffId || lowerAuthored.past !== 2) {
    throw new Error(`APP-10G lower-staff Voice 5 authoring mismatch: ${JSON.stringify(lowerAuthored)}`);
  }

  await page.getByRole('button', { name: 'Staff 1', exact: true }).click();
  const upperReturn = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const d = controller.getDocument();
    const staves = d.session.history.present.score.parts[0].staves.filter(staff => staff.role === 'standard');
    return {
      active: controller.getActiveStaffState().activeStaffOrdinal,
      activeVoice: controller.getAuthoringState().activeVoiceOrdinal,
      upperVoiceCount: staves[0].measures[0].voices.length,
      selectionKind: d.session.selection?.kind ?? null,
      selectionStaffId: d.session.selection?.staffId ?? null,
      upperStaffId: staves[0].id,
      past: d.session.history.past.length
    };
  });
  if (upperReturn.active !== 1 || upperReturn.activeVoice !== 5 || upperReturn.upperVoiceCount !== 1 ||
      upperReturn.selectionKind !== 'measure' || upperReturn.selectionStaffId !== upperReturn.upperStaffId || upperReturn.past !== 2) {
    throw new Error(`APP-10G return-to-upper mismatch: ${JSON.stringify(upperReturn)}`);
  }

  if (consoleErrors.length !== 0) throw new Error(`APP-10G browser console errors: ${JSON.stringify(consoleErrors)}`);
  console.log('APP-10G WebKit active-staff authoring regression: PASS');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}