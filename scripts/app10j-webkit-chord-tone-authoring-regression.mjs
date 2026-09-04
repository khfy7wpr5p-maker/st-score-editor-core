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
if (address === null || typeof address === 'string') throw new Error('APP-10J WebKit server did not expose a TCP port.');

let browser;
try {
  browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => consoleErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${address.port}/st-score-editor-app.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => Boolean(globalThis.STScoreEditorAppController?.getChordToneAuthoringState));
  const bootstrap = await page.evaluate(() => ({
    bundled: globalThis.STScoreEditorApp?.profile?.chordToneAuthoringBundled ?? false,
    runtime: globalThis.STScoreEditorApp?.chordToneAuthoring?.bundled ?? false,
    add: globalThis.STScoreEditorApp?.profile?.chordToneAdd ?? null,
    selectionAfterAdd: globalThis.STScoreEditorApp?.profile?.chordToneSelectionAfterAdd ?? null,
    coordinateAuthority: globalThis.STScoreEditorApp?.profile?.chordToneRendererCoordinateAuthority ?? null,
    release: globalThis.STScoreEditorApp?.profile?.standaloneReleaseGatePassed ?? null,
    cutover: globalThis.STScoreEditorApp?.profile?.seslitabCutoverAuthorized ?? null
  }));
  if (!bootstrap.bundled || !bootstrap.runtime || bootstrap.add !== 'exact-pitched-event-palette-pitch-one-tone-per-action' ||
      bootstrap.selectionAfterAdd !== 'new-exact-note' || bootstrap.coordinateAuthority !== false ||
      bootstrap.release !== false || bootstrap.cutover !== false) {
    throw new Error(`APP-10J bootstrap mismatch: ${JSON.stringify(bootstrap)}`);
  }

  await page.getByRole('combobox', { name: 'New score type', exact: true }).selectOption('GUITAR_TREBLE');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const disabledOnRest = await page.getByRole('button', { name: 'Add palette pitch as chord tone to selected pitched event', exact: true }).isDisabled();
  if (!disabledOnRest) throw new Error('APP-10J chord-tone action must be disabled on an explicit rest selection.');

  await page.getByRole('button', { name: 'Pitch C', exact: true }).click();
  await page.getByRole('button', { name: 'Duration 1/4', exact: true }).click();
  await page.getByRole('button', { name: 'Enter note at selected event time', exact: true }).click();
  await page.getByRole('button', { name: 'Pitch E', exact: true }).click();
  await page.getByRole('button', { name: 'Add palette pitch as chord tone to selected pitched event', exact: true }).click();

  let guitarChord = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const d = controller.getDocument();
    const event = d.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events[0];
    return {
      kind: event.kind,
      pitches: event.kind === 'chord' ? event.notes.map(note => note.pitch) : [],
      selectionKind: d.session.selection?.kind ?? null,
      selectionNoteId: d.session.selection?.kind === 'note' ? d.session.selection.noteId : null,
      lastNoteId: event.kind === 'chord' ? event.notes.at(-1)?.id ?? null : null,
      toneCount: controller.getChordToneAuthoringState().selectedToneCount,
      past: d.session.history.past.length
    };
  });
  if (guitarChord.kind !== 'chord' || JSON.stringify(guitarChord.pitches) !== JSON.stringify([
    { step: 'C', alter: 0, octave: 4 },
    { step: 'E', alter: 0, octave: 4 }
  ]) || guitarChord.selectionKind !== 'note' || guitarChord.selectionNoteId !== guitarChord.lastNoteId ||
      guitarChord.toneCount !== 2 || guitarChord.past !== 2) {
    throw new Error(`APP-10J Guitar first chord mismatch: ${JSON.stringify(guitarChord)}`);
  }

  await page.getByRole('button', { name: 'Pitch G', exact: true }).click();
  await page.getByRole('button', { name: 'Add palette pitch as chord tone to selected pitched event', exact: true }).click();
  await page.getByRole('button', { name: 'Delete selected pitched content', exact: true }).click();
  guitarChord = await page.evaluate(() => {
    const d = globalThis.STScoreEditorAppController.getDocument();
    const event = d.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events[0];
    return {
      kind: event.kind,
      pitches: event.kind === 'chord' ? event.notes.map(note => note.pitch) : [],
      past: d.session.history.past.length
    };
  });
  if (guitarChord.kind !== 'chord' || JSON.stringify(guitarChord.pitches) !== JSON.stringify([
    { step: 'C', alter: 0, octave: 4 },
    { step: 'E', alter: 0, octave: 4 }
  ]) || guitarChord.past !== 4) {
    throw new Error(`APP-10J Guitar add/delete mismatch: ${JSON.stringify(guitarChord)}`);
  }

  await page.getByRole('button', { name: 'Add measure', exact: true }).click();
  await page.getByRole('button', { name: 'Pitch D', exact: true }).click();
  await page.getByRole('button', { name: 'Enter note at selected event time', exact: true }).click();
  await page.getByRole('button', { name: 'Pitch F', exact: true }).click();
  await page.getByRole('button', { name: 'Add palette pitch as chord tone to selected pitched event', exact: true }).click();
  await page.getByRole('button', { name: 'Previous measure', exact: true }).click();
  const multiMeasure = await page.evaluate(() => {
    const d = globalThis.STScoreEditorAppController.getDocument();
    const staff = d.session.history.present.score.parts[0].staves[0];
    const first = staff.measures[0].voices[0].events[0];
    const second = staff.measures[1].voices[0].events[0];
    return {
      selectedFrame: d.session.selection?.frameId ?? null,
      firstKind: first.kind,
      firstPitches: first.kind === 'chord' ? first.notes.map(note => note.pitch) : [],
      secondKind: second.kind,
      secondPitches: second.kind === 'chord' ? second.notes.map(note => note.pitch) : [],
      past: d.session.history.past.length
    };
  });
  if (multiMeasure.selectedFrame !== 'frame:1' || multiMeasure.firstKind !== 'chord' || multiMeasure.secondKind !== 'chord' ||
      JSON.stringify(multiMeasure.firstPitches) !== JSON.stringify([{ step: 'C', alter: 0, octave: 4 }, { step: 'E', alter: 0, octave: 4 }]) ||
      JSON.stringify(multiMeasure.secondPitches) !== JSON.stringify([{ step: 'D', alter: 0, octave: 4 }, { step: 'F', alter: 0, octave: 4 }]) ||
      multiMeasure.past !== 7) {
    throw new Error(`APP-10J multi-measure chord mismatch: ${JSON.stringify(multiMeasure)}`);
  }

  await page.getByRole('combobox', { name: 'New score type', exact: true }).selectOption('PIANO_GRAND_STAFF');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('button', { name: 'Staff 2', exact: true }).click();
  await page.getByRole('button', { name: 'Voice 5', exact: true }).click();
  await page.getByRole('button', { name: 'Pitch C', exact: true }).click();
  await page.getByRole('button', { name: 'Duration 1/4', exact: true }).click();
  await page.getByRole('button', { name: 'Enter note at selected event time', exact: true }).click();
  await page.getByRole('button', { name: 'Pitch E', exact: true }).click();
  await page.getByRole('button', { name: 'Add palette pitch as chord tone to selected pitched event', exact: true }).click();

  const pianoChord = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const d = controller.getDocument();
    const staves = d.session.history.present.score.parts[0].staves.filter(staff => staff.role === 'standard');
    const lowerVoice5 = staves[1].measures[0].voices.find(voice => voice.ordinal === 5);
    const event = lowerVoice5?.events[0];
    return {
      activeStaff: controller.getActiveStaffState().activeStaffOrdinal,
      activeVoice: controller.getAuthoringState().activeVoiceOrdinal,
      lowerKind: event?.kind ?? null,
      lowerPitches: event?.kind === 'chord' ? event.notes.map(note => note.pitch) : [],
      upperVoiceCount: staves[0].measures[0].voices.length,
      past: d.session.history.past.length
    };
  });
  if (pianoChord.activeStaff !== 2 || pianoChord.activeVoice !== 5 || pianoChord.lowerKind !== 'chord' ||
      JSON.stringify(pianoChord.lowerPitches) !== JSON.stringify([{ step: 'C', alter: 0, octave: 4 }, { step: 'E', alter: 0, octave: 4 }]) ||
      pianoChord.upperVoiceCount !== 1 || pianoChord.past !== 3) {
    throw new Error(`APP-10J Piano Staff-2 Voice-5 chord mismatch: ${JSON.stringify(pianoChord)}`);
  }

  if (consoleErrors.length !== 0) throw new Error(`APP-10J browser console errors: ${JSON.stringify(consoleErrors)}`);
  console.log('APP-10J WebKit bounded chord-tone authoring regression: PASS');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
