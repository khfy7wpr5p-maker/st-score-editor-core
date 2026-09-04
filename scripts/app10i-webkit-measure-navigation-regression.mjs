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
if (address === null || typeof address === 'string') throw new Error('APP-10I WebKit server did not expose a TCP port.');

let browser;
try {
  browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => consoleErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${address.port}/st-score-editor-app.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => Boolean(globalThis.STScoreEditorAppController?.getMeasureNavigationState));
  const bootstrap = await page.evaluate(() => ({
    bundled: globalThis.STScoreEditorApp?.profile?.measureNavigationBundled ?? false,
    runtime: globalThis.STScoreEditorApp?.measureNavigation?.bundled ?? false,
    selection: globalThis.STScoreEditorApp?.profile?.measureNavigationSelection ?? null,
    historyAuthority: globalThis.STScoreEditorApp?.profile?.measureNavigationHistoryMutationAuthority ?? null,
    voiceAuthority: globalThis.STScoreEditorApp?.profile?.measureNavigationVoiceMaterializationAuthority ?? null,
    imported: globalThis.STScoreEditorApp?.profile?.importedMusicXmlMeasureNavigation ?? null,
    coordinateAuthority: globalThis.STScoreEditorApp?.profile?.measureNavigationRendererCoordinateAuthority ?? null,
    release: globalThis.STScoreEditorApp?.profile?.standaloneReleaseGatePassed ?? null,
    cutover: globalThis.STScoreEditorApp?.profile?.seslitabCutoverAuthorized ?? null
  }));
  if (!bootstrap.bundled || !bootstrap.runtime || bootstrap.selection !== 'same-part-same-staff-adjacent-frame-semantic-only' ||
      bootstrap.historyAuthority !== false || bootstrap.voiceAuthority !== false || bootstrap.imported !== true ||
      bootstrap.coordinateAuthority !== false || bootstrap.release !== false || bootstrap.cutover !== false) {
    throw new Error(`APP-10I bootstrap mismatch: ${JSON.stringify(bootstrap)}`);
  }

  await page.getByRole('combobox', { name: 'New score type', exact: true }).selectOption('GUITAR_TREBLE');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('button', { name: 'Add measure', exact: true }).click();
  await page.getByRole('button', { name: 'Add measure', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-st-active-measure]')?.textContent === 'M3/3');

  const beforeNavigation = await page.evaluate(() => {
    const d = globalThis.STScoreEditorAppController.getDocument();
    return { frameId: d.session.selection?.frameId ?? null, past: d.session.history.past.length };
  });
  if (beforeNavigation.frameId !== 'frame:3' || beforeNavigation.past !== 2) {
    throw new Error(`APP-10I Guitar pre-navigation mismatch: ${JSON.stringify(beforeNavigation)}`);
  }

  await page.getByRole('button', { name: 'Previous measure', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-st-active-measure]')?.textContent === 'M2/3');
  const afterPrevious = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const d = controller.getDocument();
    return {
      frameId: d.session.selection?.frameId ?? null,
      kind: d.session.selection?.kind ?? null,
      staffId: d.session.selection?.staffId ?? null,
      past: d.session.history.past.length,
      state: controller.getMeasureNavigationState()
    };
  });
  if (afterPrevious.frameId !== 'frame:2' || afterPrevious.kind !== 'event' || afterPrevious.past !== 2 ||
      !afterPrevious.state.canPrevious || !afterPrevious.state.canNext) {
    throw new Error(`APP-10I Guitar previous mismatch: ${JSON.stringify(afterPrevious)}`);
  }

  await page.getByRole('button', { name: 'Pitch D', exact: true }).click();
  await page.getByRole('button', { name: 'Duration 1/4', exact: true }).click();
  await page.getByRole('button', { name: 'Enter note at selected event time', exact: true }).click();
  await page.getByRole('button', { name: 'Pitch E', exact: true }).click();
  await page.getByRole('button', { name: 'Apply palette pitch to selected note', exact: true }).click();
  const editAfterNavigation = await page.evaluate(() => {
    const d = globalThis.STScoreEditorAppController.getDocument();
    const staff = d.session.history.present.score.parts[0].staves.find(item => item.role === 'standard');
    const event = staff?.measures[1]?.voices[0]?.events[0];
    return {
      frameId: d.session.selection?.frameId ?? null,
      kind: event?.kind ?? null,
      pitch: event?.kind === 'note' ? event.note.pitch : null,
      past: d.session.history.past.length
    };
  });
  if (editAfterNavigation.frameId !== 'frame:2' || editAfterNavigation.kind !== 'note' ||
      JSON.stringify(editAfterNavigation.pitch) !== JSON.stringify({ step: 'E', alter: 0, octave: 4 }) || editAfterNavigation.past !== 4) {
    throw new Error(`APP-10I edit-after-navigation mismatch: ${JSON.stringify(editAfterNavigation)}`);
  }

  await page.getByRole('button', { name: 'Next measure', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-st-active-measure]')?.textContent === 'M3/3');
  const afterNext = await page.evaluate(() => {
    const d = globalThis.STScoreEditorAppController.getDocument();
    return { frameId: d.session.selection?.frameId ?? null, past: d.session.history.past.length };
  });
  if (afterNext.frameId !== 'frame:3' || afterNext.past !== 4) {
    throw new Error(`APP-10I Guitar next mismatch: ${JSON.stringify(afterNext)}`);
  }

  await page.getByRole('combobox', { name: 'New score type', exact: true }).selectOption('PIANO_GRAND_STAFF');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('button', { name: 'Add measure', exact: true }).click();
  await page.getByRole('button', { name: 'Add measure', exact: true }).click();
  await page.getByRole('button', { name: 'Staff 2', exact: true }).click();
  await page.getByRole('button', { name: 'Voice 5', exact: true }).click();
  await page.getByRole('button', { name: 'Pitch C', exact: true }).click();
  await page.getByRole('button', { name: 'Duration 1/4', exact: true }).click();
  await page.getByRole('button', { name: 'Enter note at selected event time', exact: true }).click();

  const pianoBefore = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const d = controller.getDocument();
    return {
      frameId: d.session.selection?.frameId ?? null,
      staff: controller.getActiveStaffState().activeStaffOrdinal,
      voice: controller.getAuthoringState().activeVoiceOrdinal,
      past: d.session.history.past.length
    };
  });
  if (pianoBefore.frameId !== 'frame:3' || pianoBefore.staff !== 2 || pianoBefore.voice !== 5 || pianoBefore.past !== 4) {
    throw new Error(`APP-10I Piano pre-navigation mismatch: ${JSON.stringify(pianoBefore)}`);
  }

  await page.getByRole('button', { name: 'Previous measure', exact: true }).click();
  const pianoPrevious = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const d = controller.getDocument();
    const staves = d.session.history.present.score.parts[0].staves.filter(staff => staff.role === 'standard');
    return {
      frameId: d.session.selection?.frameId ?? null,
      selectionKind: d.session.selection?.kind ?? null,
      staff: controller.getActiveStaffState().activeStaffOrdinal,
      voice: controller.getAuthoringState().activeVoiceOrdinal,
      lowerMeasure2VoiceCount: staves[1]?.measures[1]?.voices.length ?? 0,
      past: d.session.history.past.length
    };
  });
  if (pianoPrevious.frameId !== 'frame:2' || pianoPrevious.selectionKind !== 'measure' || pianoPrevious.staff !== 2 ||
      pianoPrevious.voice !== 5 || pianoPrevious.lowerMeasure2VoiceCount !== 1 || pianoPrevious.past !== 4) {
    throw new Error(`APP-10I Piano missing-Voice fallback mismatch: ${JSON.stringify(pianoPrevious)}`);
  }

  await page.getByRole('button', { name: 'Voice 5', exact: true }).click();
  const pianoExplicitVoice = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const d = controller.getDocument();
    const staves = d.session.history.present.score.parts[0].staves.filter(staff => staff.role === 'standard');
    return {
      frameId: d.session.selection?.frameId ?? null,
      staff: controller.getActiveStaffState().activeStaffOrdinal,
      voice: controller.getAuthoringState().activeVoiceOrdinal,
      lowerMeasure2Voice5: staves[1]?.measures[1]?.voices.some(voice => voice.ordinal === 5) ?? false,
      past: d.session.history.past.length
    };
  });
  if (pianoExplicitVoice.frameId !== 'frame:2' || pianoExplicitVoice.staff !== 2 || pianoExplicitVoice.voice !== 5 ||
      !pianoExplicitVoice.lowerMeasure2Voice5 || pianoExplicitVoice.past !== 5) {
    throw new Error(`APP-10I Piano explicit Voice materialization mismatch: ${JSON.stringify(pianoExplicitVoice)}`);
  }

  if (consoleErrors.length !== 0) throw new Error(`APP-10I browser console errors: ${JSON.stringify(consoleErrors)}`);
  console.log('APP-10I WebKit semantic measure navigation regression: PASS');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
