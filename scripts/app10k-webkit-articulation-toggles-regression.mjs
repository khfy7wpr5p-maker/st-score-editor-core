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
if (address === null || typeof address === 'string') throw new Error('APP-10K WebKit server did not expose a TCP port.');

let browser;
try {
  browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => consoleErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${address.port}/st-score-editor-app.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => Boolean(globalThis.STScoreEditorAppController?.getArticulationTogglesState));
  const bootstrap = await page.evaluate(() => ({
    bundled: globalThis.STScoreEditorApp?.profile?.articulationTogglesBundled ?? false,
    runtime: globalThis.STScoreEditorApp?.articulationToggles?.bundled ?? false,
    kinds: globalThis.STScoreEditorApp?.profile?.articulationToggleKinds ?? null,
    target: globalThis.STScoreEditorApp?.profile?.articulationToggleTarget ?? null,
    ambiguous: globalThis.STScoreEditorApp?.profile?.articulationAmbiguousKindFailClosed ?? null,
    coordinateAuthority: globalThis.STScoreEditorApp?.profile?.articulationRendererCoordinateAuthority ?? null,
    release: globalThis.STScoreEditorApp?.profile?.standaloneReleaseGatePassed ?? null,
    cutover: globalThis.STScoreEditorApp?.profile?.seslitabCutoverAuthorized ?? null
  }));
  if (!bootstrap.bundled || !bootstrap.runtime || JSON.stringify(bootstrap.kinds) !== JSON.stringify(['staccato', 'accent', 'tenuto']) ||
      bootstrap.target !== 'exact-selected-pitched-event-or-note-parent-event' || bootstrap.ambiguous !== true ||
      bootstrap.coordinateAuthority !== false || bootstrap.release !== false || bootstrap.cutover !== false) {
    throw new Error(`APP-10K bootstrap mismatch: ${JSON.stringify(bootstrap)}`);
  }

  await page.getByRole('combobox', { name: 'New score type', exact: true }).selectOption('GUITAR_TREBLE');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const disabledOnRest = await page.getByRole('button', { name: 'Toggle staccato on selected pitched event', exact: true }).isDisabled();
  if (!disabledOnRest) throw new Error('APP-10K articulation action must be disabled on explicit rest selection.');

  await page.getByRole('button', { name: 'Pitch C', exact: true }).click();
  await page.getByRole('button', { name: 'Duration 1/4', exact: true }).click();
  await page.getByRole('button', { name: 'Enter note at selected event time', exact: true }).click();
  await page.getByRole('button', { name: 'Pitch E', exact: true }).click();
  await page.getByRole('button', { name: 'Add palette pitch as chord tone to selected pitched event', exact: true }).click();
  await page.getByRole('button', { name: 'Toggle staccato on selected pitched event', exact: true }).click();

  const firstMeasure = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const d = controller.getDocument();
    const event = d.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events[0];
    const notation = d.session.history.present.notation.events.find(entry => entry.target.eventId === event.id)?.notation;
    return {
      kind: event.kind,
      pitches: event.kind === 'chord' ? event.notes.map(note => note.pitch) : [],
      articulations: notation?.articulations ?? [],
      selectionKind: d.session.selection?.kind ?? null,
      activeKinds: controller.getArticulationTogglesState().activeKinds,
      past: d.session.history.past.length
    };
  });
  if (firstMeasure.kind !== 'chord' || JSON.stringify(firstMeasure.pitches) !== JSON.stringify([
    { step: 'C', alter: 0, octave: 4 },
    { step: 'E', alter: 0, octave: 4 }
  ]) || JSON.stringify(firstMeasure.articulations) !== JSON.stringify([{ kind: 'staccato', placement: 'auto', direction: null }]) ||
      firstMeasure.selectionKind !== 'event' || JSON.stringify(firstMeasure.activeKinds) !== JSON.stringify(['staccato']) || firstMeasure.past !== 3) {
    throw new Error(`APP-10K Guitar chord articulation mismatch: ${JSON.stringify(firstMeasure)}`);
  }
  const pressed = await page.getByRole('button', { name: 'Toggle staccato on selected pitched event', exact: true }).getAttribute('aria-pressed');
  if (pressed !== 'true') throw new Error(`APP-10K staccato pressed state mismatch: ${pressed}`);

  await page.getByRole('button', { name: 'Add measure', exact: true }).click();
  await page.getByRole('button', { name: 'Pitch D', exact: true }).click();
  await page.getByRole('button', { name: 'Enter note at selected event time', exact: true }).click();
  await page.getByRole('button', { name: 'Toggle accent on selected pitched event', exact: true }).click();
  await page.getByRole('button', { name: 'Previous measure', exact: true }).click();

  const multiMeasure = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const d = controller.getDocument();
    const staff = d.session.history.present.score.parts[0].staves[0];
    const first = staff.measures[0].voices[0].events[0];
    const second = staff.measures[1].voices[0].events[0];
    const notationFor = eventId => d.session.history.present.notation.events.find(entry => entry.target.eventId === eventId)?.notation.articulations ?? [];
    return {
      selectedFrame: d.session.selection?.frameId ?? null,
      first: notationFor(first.id),
      second: notationFor(second.id),
      past: d.session.history.past.length
    };
  });
  if (multiMeasure.selectedFrame !== 'frame:1' ||
      JSON.stringify(multiMeasure.first) !== JSON.stringify([{ kind: 'staccato', placement: 'auto', direction: null }]) ||
      JSON.stringify(multiMeasure.second) !== JSON.stringify([{ kind: 'accent', placement: 'auto', direction: null }]) ||
      multiMeasure.past !== 6) {
    throw new Error(`APP-10K multi-measure articulation mismatch: ${JSON.stringify(multiMeasure)}`);
  }

  await page.getByRole('combobox', { name: 'New score type', exact: true }).selectOption('PIANO_GRAND_STAFF');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('button', { name: 'Staff 2', exact: true }).click();
  await page.getByRole('button', { name: 'Voice 5', exact: true }).click();
  await page.getByRole('button', { name: 'Pitch C', exact: true }).click();
  await page.getByRole('button', { name: 'Duration 1/4', exact: true }).click();
  await page.getByRole('button', { name: 'Enter note at selected event time', exact: true }).click();
  await page.getByRole('button', { name: 'Toggle tenuto on selected pitched event', exact: true }).click();

  const piano = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const d = controller.getDocument();
    const staves = d.session.history.present.score.parts[0].staves.filter(staff => staff.role === 'standard');
    const lowerVoice5 = staves[1].measures[0].voices.find(voice => voice.ordinal === 5);
    const lowerEvent = lowerVoice5?.events[0];
    const notation = lowerEvent === undefined ? null : d.session.history.present.notation.events.find(entry => entry.target.eventId === lowerEvent.id)?.notation;
    return {
      activeStaff: controller.getActiveStaffState().activeStaffOrdinal,
      activeVoice: controller.getAuthoringState().activeVoiceOrdinal,
      lowerKind: lowerEvent?.kind ?? null,
      lowerArticulations: notation?.articulations ?? [],
      upperNotationCount: d.session.history.present.notation.events.filter(entry => entry.target.staffId === staves[0].id).length,
      upperVoiceCount: staves[0].measures[0].voices.length,
      past: d.session.history.past.length
    };
  });
  if (piano.activeStaff !== 2 || piano.activeVoice !== 5 || piano.lowerKind !== 'note' ||
      JSON.stringify(piano.lowerArticulations) !== JSON.stringify([{ kind: 'tenuto', placement: 'auto', direction: null }]) ||
      piano.upperNotationCount !== 0 || piano.upperVoiceCount !== 1 || piano.past !== 3) {
    throw new Error(`APP-10K Piano Staff-2 Voice-5 articulation mismatch: ${JSON.stringify(piano)}`);
  }

  if (consoleErrors.length !== 0) throw new Error(`APP-10K browser console errors: ${JSON.stringify(consoleErrors)}`);
  console.log('APP-10K WebKit bounded articulation toggles regression: PASS');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
