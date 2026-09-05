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
if (address === null || typeof address === 'string') throw new Error('APP-10M WebKit server did not expose a TCP port.');

let browser;
try {
  browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => consoleErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${address.port}/st-score-editor-app.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => Boolean(globalThis.STScoreEditorAppController?.getExplicitAccidentalsState));
  const bootstrap = await page.evaluate(() => ({
    bundled: globalThis.STScoreEditorApp?.profile?.explicitAccidentalsBundled ?? false,
    runtime: globalThis.STScoreEditorApp?.explicitAccidentals?.bundled ?? false,
    kinds: globalThis.STScoreEditorApp?.profile?.explicitAccidentalKinds ?? null,
    target: globalThis.STScoreEditorApp?.profile?.explicitAccidentalTarget ?? null,
    mutation: globalThis.STScoreEditorApp?.profile?.explicitAccidentalMutation ?? null,
    stepOctaveAuthority: globalThis.STScoreEditorApp?.profile?.explicitAccidentalStepOctaveMutationAuthority ?? null,
    advancedAuthority: globalThis.STScoreEditorApp?.profile?.explicitAccidentalAdvancedKeypadTargetAuthority ?? null,
    coordinateAuthority: globalThis.STScoreEditorApp?.profile?.explicitAccidentalRendererCoordinateAuthority ?? null,
    release: globalThis.STScoreEditorApp?.profile?.standaloneReleaseGatePassed ?? null,
    cutover: globalThis.STScoreEditorApp?.profile?.seslitabCutoverAuthorized ?? null
  }));
  if (!bootstrap.bundled || !bootstrap.runtime || JSON.stringify(bootstrap.kinds) !== JSON.stringify(['flat', 'natural', 'sharp']) ||
      bootstrap.target !== 'exact-selected-note-only' ||
      bootstrap.mutation !== 'canonical-pitch-alter-plus-note-notation-accidental-atomic' ||
      bootstrap.stepOctaveAuthority !== false || bootstrap.advancedAuthority !== false || bootstrap.coordinateAuthority !== false ||
      bootstrap.release !== false || bootstrap.cutover !== false) {
    throw new Error(`APP-10M bootstrap mismatch: ${JSON.stringify(bootstrap)}`);
  }

  await page.getByRole('combobox', { name: 'New score type', exact: true }).selectOption('GUITAR_TREBLE');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const disabledOnRest = await page.getByRole('button', { name: 'Set explicit sharp on selected note', exact: true }).isDisabled();
  if (!disabledOnRest) throw new Error('APP-10M explicit accidental must be disabled without exact note selection.');

  await page.getByRole('button', { name: 'Pitch C', exact: true }).click();
  await page.getByRole('button', { name: 'Duration 1/4', exact: true }).click();
  await page.getByRole('button', { name: 'Enter note at selected event time', exact: true }).click();
  await page.getByRole('button', { name: 'Set explicit sharp on selected note', exact: true }).click();

  let guitar = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const d = controller.getDocument();
    const event = d.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events[0];
    const note = event.kind === 'note' ? event.note : null;
    const noteNotation = note === null ? null : d.session.history.present.notation.notes.find(entry => entry.target.noteId === note.id)?.notation ?? null;
    return {
      kind: event.kind,
      pitch: note?.pitch ?? null,
      accidental: noteNotation?.accidental ?? null,
      selectionKind: d.session.selection?.kind ?? null,
      state: controller.getExplicitAccidentalsState(),
      past: d.session.history.past.length
    };
  });
  if (guitar.kind !== 'note' || JSON.stringify(guitar.pitch) !== JSON.stringify({ step: 'C', alter: 1, octave: 4 }) ||
      guitar.accidental !== 'sharp' || guitar.selectionKind !== 'note' || guitar.state.explicitAccidental !== 'sharp' || guitar.past !== 2) {
    throw new Error(`APP-10M Guitar sharp mismatch: ${JSON.stringify(guitar)}`);
  }
  const sharpPressed = await page.getByRole('button', { name: 'Set explicit sharp on selected note', exact: true }).getAttribute('aria-pressed');
  if (sharpPressed !== 'true') throw new Error(`APP-10M sharp pressed state mismatch: ${sharpPressed}`);

  await page.getByRole('button', { name: 'Pitch E', exact: true }).click();
  await page.getByRole('button', { name: 'Add palette pitch as chord tone to selected pitched event', exact: true }).click();
  await page.getByRole('button', { name: 'Set explicit flat on selected note', exact: true }).click();

  guitar = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const d = controller.getDocument();
    const event = d.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events[0];
    const notations = event.kind === 'chord' ? event.notes.map(note => ({
      id: note.id,
      pitch: note.pitch,
      accidental: d.session.history.present.notation.notes.find(entry => entry.target.noteId === note.id)?.notation.accidental ?? null
    })) : [];
    return { kind: event.kind, notations, selectedNoteId: d.session.selection?.kind === 'note' ? d.session.selection.noteId : null, past: d.session.history.past.length };
  });
  if (guitar.kind !== 'chord' || guitar.notations.length !== 2 ||
      JSON.stringify(guitar.notations.map(item => item.pitch)) !== JSON.stringify([
        { step: 'C', alter: 1, octave: 4 },
        { step: 'E', alter: -1, octave: 4 }
      ]) || guitar.notations[0].accidental !== 'sharp' || guitar.notations[1].accidental !== 'flat' ||
      guitar.selectedNoteId !== guitar.notations[1].id || guitar.past !== 4) {
    throw new Error(`APP-10M exact chord-tone isolation mismatch: ${JSON.stringify(guitar)}`);
  }

  await page.getByRole('button', { name: 'Add measure', exact: true }).click();
  const disabledAfterAppend = await page.getByRole('button', { name: 'Set explicit natural on selected note', exact: true }).isDisabled();
  if (!disabledAfterAppend) throw new Error('APP-10M accidental must stay disabled on post-append rest selection.');
  await page.getByRole('button', { name: 'Pitch D', exact: true }).click();
  await page.getByRole('button', { name: 'Enter note at selected event time', exact: true }).click();
  await page.getByRole('button', { name: 'Set explicit natural on selected note', exact: true }).click();
  await page.getByRole('button', { name: 'Previous measure', exact: true }).click();

  const multiMeasure = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const d = controller.getDocument();
    const staff = d.session.history.present.score.parts[0].staves[0];
    const first = staff.measures[0].voices[0].events[0];
    const second = staff.measures[1].voices[0].events[0];
    const notesFor = event => event.kind === 'note' ? [event.note] : event.kind === 'chord' ? event.notes : [];
    const accidentalFor = noteId => d.session.history.present.notation.notes.find(entry => entry.target.noteId === noteId)?.notation.accidental ?? null;
    return {
      selectedFrame: d.session.selection?.frameId ?? null,
      first: notesFor(first).map(note => ({ pitch: note.pitch, accidental: accidentalFor(note.id) })),
      second: notesFor(second).map(note => ({ pitch: note.pitch, accidental: accidentalFor(note.id) })),
      canSetAfterNavigation: controller.getExplicitAccidentalsState().canSetExplicitAccidental,
      past: d.session.history.past.length
    };
  });
  if (multiMeasure.selectedFrame !== 'frame:1' ||
      JSON.stringify(multiMeasure.first.map(item => item.pitch)) !== JSON.stringify([
        { step: 'C', alter: 1, octave: 4 },
        { step: 'E', alter: -1, octave: 4 }
      ]) || multiMeasure.first[0].accidental !== 'sharp' || multiMeasure.first[1].accidental !== 'flat' ||
      JSON.stringify(multiMeasure.second) !== JSON.stringify([{ pitch: { step: 'D', alter: 0, octave: 4 }, accidental: 'natural' }]) ||
      multiMeasure.canSetAfterNavigation !== false || multiMeasure.past !== 7) {
    throw new Error(`APP-10M multi-measure accidental mismatch: ${JSON.stringify(multiMeasure)}`);
  }

  await page.getByRole('combobox', { name: 'New score type', exact: true }).selectOption('PIANO_GRAND_STAFF');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('button', { name: 'Staff 2', exact: true }).click();
  await page.getByRole('button', { name: 'Voice 5', exact: true }).click();
  await page.getByRole('button', { name: 'Pitch C', exact: true }).click();
  await page.getByRole('button', { name: 'Duration 1/4', exact: true }).click();
  await page.getByRole('button', { name: 'Enter note at selected event time', exact: true }).click();
  await page.getByRole('button', { name: 'Set explicit flat on selected note', exact: true }).click();

  const piano = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorAppController;
    const d = controller.getDocument();
    const staves = d.session.history.present.score.parts[0].staves.filter(staff => staff.role === 'standard');
    const lowerVoice5 = staves[1].measures[0].voices.find(voice => voice.ordinal === 5);
    const lowerEvent = lowerVoice5?.events[0];
    const lowerNote = lowerEvent?.kind === 'note' ? lowerEvent.note : null;
    const lowerNotation = lowerNote === null ? null : d.session.history.present.notation.notes.find(entry => entry.target.noteId === lowerNote.id)?.notation ?? null;
    return {
      activeStaff: controller.getActiveStaffState().activeStaffOrdinal,
      activeVoice: controller.getAuthoringState().activeVoiceOrdinal,
      lowerPitch: lowerNote?.pitch ?? null,
      lowerAccidental: lowerNotation?.accidental ?? null,
      upperNoteNotationCount: d.session.history.present.notation.notes.filter(entry => entry.target.staffId === staves[0].id).length,
      upperVoiceCount: staves[0].measures[0].voices.length,
      past: d.session.history.past.length
    };
  });
  if (piano.activeStaff !== 2 || piano.activeVoice !== 5 ||
      JSON.stringify(piano.lowerPitch) !== JSON.stringify({ step: 'C', alter: -1, octave: 4 }) || piano.lowerAccidental !== 'flat' ||
      piano.upperNoteNotationCount !== 0 || piano.upperVoiceCount !== 1 || piano.past !== 3) {
    throw new Error(`APP-10M Piano Staff-2 Voice-5 accidental mismatch: ${JSON.stringify(piano)}`);
  }

  if (consoleErrors.length !== 0) throw new Error(`APP-10M browser console errors: ${JSON.stringify(consoleErrors)}`);
  console.log('APP-10M WebKit bounded explicit accidentals regression: PASS');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
