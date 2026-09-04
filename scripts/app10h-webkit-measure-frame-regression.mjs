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
if (address === null || typeof address === 'string') throw new Error('APP-10H WebKit server did not expose a TCP port.');

let browser;
try {
  browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => consoleErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${address.port}/st-score-editor-app.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => Boolean(globalThis.STScoreEditorAppController?.getMeasureFrameAuthoringState));
  const bootstrap = await page.evaluate(() => ({
    bundled: globalThis.STScoreEditorApp?.profile?.measureFrameAuthoringBundled ?? false,
    runtime: globalThis.STScoreEditorApp?.measureFrameAuthoring?.bundled ?? false,
    append: globalThis.STScoreEditorApp?.profile?.measureFrameAppend ?? null,
    meterProof: globalThis.STScoreEditorApp?.profile?.measureFrameMeterProofRequired ?? null,
    importedGrowth: globalThis.STScoreEditorApp?.profile?.importedMusicXmlAutomaticMeasureGrowth ?? null,
    coordinateAuthority: globalThis.STScoreEditorApp?.profile?.measureFrameRendererCoordinateAuthority ?? null,
    release: globalThis.STScoreEditorApp?.profile?.standaloneReleaseGatePassed ?? null,
    cutover: globalThis.STScoreEditorApp?.profile?.seslitabCutoverAuthorized ?? null
  }));
  if (!bootstrap.bundled || !bootstrap.runtime || bootstrap.append !== 'synthetic-new-score-end-only' || bootstrap.meterProof !== true ||
      bootstrap.importedGrowth !== false || bootstrap.coordinateAuthority !== false || bootstrap.release !== false || bootstrap.cutover !== false) {
    throw new Error(`APP-10H bootstrap mismatch: ${JSON.stringify(bootstrap)}`);
  }

  await page.getByRole('combobox', { name: 'New score type', exact: true }).selectOption('GUITAR_TREBLE');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('button', { name: 'Duration 1/4', exact: true }).click();
  await page.getByRole('button', { name: 'Pitch C', exact: true }).click();
  await page.getByRole('button', { name: 'Enter note at selected event time', exact: true }).click();
  await page.getByRole('button', { name: 'Add measure', exact: true }).click();

  const afterAppend = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const d = controller.getDocument();
    const score = d.session.history.present.score;
    const staff = score.parts[0].staves.find(item => item.role === 'standard');
    return {
      frames: score.measureFrames.length,
      measures: staff?.measures.length ?? 0,
      selectionKind: d.session.selection?.kind ?? null,
      selectionFrameId: d.session.selection?.frameId ?? null,
      lastFrameId: score.measureFrames.at(-1)?.id ?? null,
      past: d.session.history.past.length,
      state: controller.getMeasureFrameAuthoringState()
    };
  });
  if (afterAppend.frames !== 2 || afterAppend.measures !== 2 || afterAppend.selectionKind !== 'event' ||
      afterAppend.selectionFrameId !== afterAppend.lastFrameId || afterAppend.past !== 2 || !afterAppend.state.canAppendMeasure) {
    throw new Error(`APP-10H Guitar append mismatch: ${JSON.stringify(afterAppend)}`);
  }

  await page.getByRole('button', { name: 'Pitch D', exact: true }).click();
  await page.getByRole('button', { name: 'Enter note at selected event time', exact: true }).click();
  const authoredMeasure2 = await page.evaluate(() => {
    const d = globalThis.STScoreEditorAppController.getDocument();
    const score = d.session.history.present.score;
    const staff = score.parts[0].staves.find(item => item.role === 'standard');
    return {
      hasNote: staff?.measures[1]?.voices[0]?.events.some(event => event.kind === 'note') ?? false,
      frames: score.measureFrames.length,
      past: d.session.history.past.length
    };
  });
  if (!authoredMeasure2.hasNote || authoredMeasure2.frames !== 2 || authoredMeasure2.past !== 3) {
    throw new Error(`APP-10H measure-2 authoring mismatch: ${JSON.stringify(authoredMeasure2)}`);
  }

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  const afterUndo = await page.evaluate(() => {
    const d = globalThis.STScoreEditorAppController.getDocument();
    const staff = d.session.history.present.score.parts[0].staves.find(item => item.role === 'standard');
    return { frames: d.session.history.present.score.measureFrames.length, hasNote: staff?.measures[1]?.voices[0]?.events.some(event => event.kind === 'note') ?? false };
  });
  if (afterUndo.frames !== 2 || afterUndo.hasNote) throw new Error(`APP-10H undo mismatch: ${JSON.stringify(afterUndo)}`);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  const afterRedo = await page.evaluate(() => {
    const d = globalThis.STScoreEditorAppController.getDocument();
    const staff = d.session.history.present.score.parts[0].staves.find(item => item.role === 'standard');
    return { frames: d.session.history.present.score.measureFrames.length, hasNote: staff?.measures[1]?.voices[0]?.events.some(event => event.kind === 'note') ?? false };
  });
  if (afterRedo.frames !== 2 || !afterRedo.hasNote) throw new Error(`APP-10H redo mismatch: ${JSON.stringify(afterRedo)}`);

  await page.getByRole('combobox', { name: 'New score type', exact: true }).selectOption('PIANO_GRAND_STAFF');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('button', { name: 'Add measure', exact: true }).click();
  await page.getByRole('button', { name: 'Staff 2', exact: true }).click();
  await page.getByRole('button', { name: 'Voice 5', exact: true }).click();
  await page.getByRole('button', { name: 'Pitch C', exact: true }).click();
  await page.getByRole('button', { name: 'Duration 1/4', exact: true }).click();
  await page.getByRole('button', { name: 'Enter note at selected event time', exact: true }).click();

  const lowerVoice5 = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const d = controller.getDocument();
    const score = d.session.history.present.score;
    const staves = score.parts[0].staves.filter(staff => staff.role === 'standard');
    const upper = staves[0], lower = staves[1];
    const frame = score.measureFrames[1];
    const voice5 = lower?.measures[1]?.voices.find(voice => voice.ordinal === 5);
    return {
      frames: score.measureFrames.length,
      upperFrame: upper?.measures[1]?.frameId ?? null,
      lowerFrame: lower?.measures[1]?.frameId ?? null,
      frameId: frame?.id ?? null,
      lowerVoice5HasNote: voice5?.events.some(event => event.kind === 'note') ?? false,
      upperMeasure2Voices: upper?.measures[1]?.voices.length ?? 0,
      activeStaff: controller.getActiveStaffState().activeStaffOrdinal,
      activeVoice: controller.getAuthoringState().activeVoiceOrdinal
    };
  });
  if (lowerVoice5.frames !== 2 || lowerVoice5.upperFrame !== lowerVoice5.frameId || lowerVoice5.lowerFrame !== lowerVoice5.frameId ||
      !lowerVoice5.lowerVoice5HasNote || lowerVoice5.upperMeasure2Voices !== 1 || lowerVoice5.activeStaff !== 2 || lowerVoice5.activeVoice !== 5) {
    throw new Error(`APP-10H Piano Staff-2 Voice-5 mismatch: ${JSON.stringify(lowerVoice5)}`);
  }

  await page.getByRole('button', { name: 'Staff 1', exact: true }).click();
  const upperReturn = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const d = controller.getDocument();
    const staves = d.session.history.present.score.parts[0].staves.filter(staff => staff.role === 'standard');
    return {
      activeStaff: controller.getActiveStaffState().activeStaffOrdinal,
      activeVoice: controller.getAuthoringState().activeVoiceOrdinal,
      upperMeasure2Voices: staves[0]?.measures[1]?.voices.length ?? 0,
      selectionFrameId: d.session.selection?.frameId ?? null,
      frameId: d.session.history.present.score.measureFrames[1]?.id ?? null
    };
  });
  if (upperReturn.activeStaff !== 1 || upperReturn.activeVoice !== 5 || upperReturn.upperMeasure2Voices !== 1 || upperReturn.selectionFrameId !== upperReturn.frameId) {
    throw new Error(`APP-10H Piano return-to-upper mismatch: ${JSON.stringify(upperReturn)}`);
  }

  if (consoleErrors.length !== 0) throw new Error(`APP-10H browser console errors: ${JSON.stringify(consoleErrors)}`);
  console.log('APP-10H WebKit measure-frame authoring regression: PASS');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
