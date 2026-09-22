import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webkit } from 'playwright';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const browserRoot = path.join(repoRoot, 'dist', 'browser');
const defaultRoute = '/st-score-editor-p10-3a-workstation.html';
const allowedAssets = new Map([
  [defaultRoute, Object.freeze({
    file: path.join(browserRoot, 'st-score-editor-p10-3a-workstation.html'),
    contentType: 'text/html; charset=utf-8'
  })],
  ['/st-score-editor-p10-3a-workstation.js', Object.freeze({
    file: path.join(browserRoot, 'st-score-editor-p10-3a-workstation.js'),
    contentType: 'text/javascript; charset=utf-8'
  })]
]);

const server = createServer(async (request, response) => {
  const requestPath = (request.url ?? '/').split('?', 1)[0];
  const route = requestPath === '/' ? defaultRoute : requestPath;
  const asset = allowedAssets.get(route);
  if (asset === undefined) {
    response.writeHead(404).end('not found');
    return;
  }
  try {
    const bytes = await readFile(asset.file);
    response.setHeader('Content-Type', asset.contentType);
    response.setHeader('Cache-Control', 'no-store');
    response.end(bytes);
  } catch {
    response.writeHead(404).end('not found');
  }
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const address = server.address();
if (address === null || typeof address === 'string') throw new Error('P10_3A_WEBKIT_SERVER_PORT_MISSING');

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
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));

  await page.goto(
    `http://127.0.0.1:${address.port}/st-score-editor-p10-3a-workstation.html`,
    { waitUntil: 'load', timeout: 30000 }
  );
  await page.waitForFunction(() =>
    Boolean(globalThis.STScoreEditorP10_3AWorkstationController?.getP10_3APitchTransposeState)
  );

  const boot = await page.evaluate(() => ({
    composed: globalThis.STScoreEditorP10_3AWorkstation?.profile?.p10_3aWorkstationComposition ?? false,
    p10_2Preserved: globalThis.STScoreEditorP10_3AWorkstation?.profile?.p10_2QualifiedBasePreserved ?? false,
    semitone: globalThis.STScoreEditorP10_3AWorkstation?.profile?.professionalSemitoneTransposeAvailable ?? false,
    diatonic: globalThis.STScoreEditorP10_3AWorkstation?.profile?.professionalDiatonicTransposeAvailable ?? false,
    canonicalAuthority: globalThis.STScoreEditorP10_3AWorkstation?.profile?.professionalPitchTransposeCanonicalAuthority ?? true,
    rendererAuthority: globalThis.STScoreEditorP10_3AWorkstation?.profile?.professionalPitchTransposeRendererCoordinateAuthority ?? true,
    productionDefault: globalThis.STScoreEditorP10_3AWorkstation?.profile?.productionDefault ?? true,
    releaseAuthorized: globalThis.STScoreEditorP10_3AWorkstation?.profile?.productionReleaseAuthorized ?? true,
    cutoverAuthorized: globalThis.STScoreEditorP10_3AWorkstation?.profile?.seslitabCutoverAuthorized ?? true
  }));
  if (
    !boot.composed || !boot.p10_2Preserved || !boot.semitone || !boot.diatonic ||
    boot.canonicalAuthority !== false || boot.rendererAuthority !== false ||
    boot.productionDefault !== false || boot.releaseAuthorized !== false ||
    boot.cutoverAuthorized !== false
  ) {
    throw new Error(`P10-3A bootstrap mismatch ${JSON.stringify(boot)}`);
  }

  const setup = await page.evaluate(async () => {
    const c = globalThis.STScoreEditorP10_3AWorkstationController;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
<part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
<part id="P1"><measure number="1">
<attributes>
<divisions>4</divisions>
<key><fifths>1</fifths></key>
<time><beats>4</beats><beat-type>4</beat-type></time>
<clef><sign>G</sign><line>2</line></clef>
</attributes>
<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
<note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
<note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
<note><rest/><duration>4</duration><voice>1</voice><type>quarter</type></note>
</measure></part>
</score-partwise>`;
    await c.openLocalFile({
      name: 'p10-3a-webkit.musicxml',
      size: new TextEncoder().encode(xml).byteLength,
      type: 'application/vnd.recordare.musicxml+xml',
      text: async () => xml
    });
    const d = c.getDocument();
    const score = d.session.history.present.score;
    const staff = score.parts[0].staves.find(item => item.role === 'standard');
    const events = staff.measures[0].voices[0].events;
    const notes = events.filter(event => event.kind === 'note');
    if (notes.length !== 3) return { ok: false, noteCount: notes.length };

    const addresses = notes.map(event =>
      d.session.renderRequest.manifest.entries
        .find(entry => entry.address.kind === 'event' && entry.address.eventId === event.id)?.address ?? null
    );
    return {
      ok: addresses.every(Boolean),
      eventIds: notes.map(event => event.id),
      noteIds: notes.map(event => event.note.id),
      addresses,
      beforeCanonical: JSON.stringify({
        score: d.session.history.present.score,
        notation: d.session.history.present.notation
      }),
      beforePast: d.session.history.past.length
    };
  });
  if (!setup.ok) throw new Error(`P10-3A import setup mismatch ${JSON.stringify(setup)}`);

  const controls = [
    'transpose-down-semitone-mobile',
    'transpose-up-semitone-mobile',
    'transpose-down-step-mobile',
    'transpose-up-step-mobile'
  ];
  for (const action of controls) {
    const button = page.locator(`[data-st-p10-3a-pitch-control="${action}"]`);
    if (await button.count() !== 1) {
      throw new Error(`P10-3A control count mismatch ${action}: ${await button.count()}`);
    }
    if (!(await button.isDisabled())) {
      throw new Error(`P10-3A control must be disabled before semantic range is ready: ${action}`);
    }
    const box = await button.boundingBox();
    if (box === null || box.height < 44 || box.width < 44) {
      throw new Error(`P10-3A control touch target mismatch ${action}: ${JSON.stringify(box)}`);
    }
  }

  const captureRange = async () => {
    await page.evaluate(({ firstId, lastId }) => {
      const c = globalThis.STScoreEditorP10_3AWorkstationController;
      const d = c.getDocument();
      const resolve = eventId => d.session.renderRequest.manifest.entries
        .find(entry => entry.address.kind === 'event' && entry.address.eventId === eventId)?.address;
      const first = resolve(firstId);
      const last = resolve(lastId);
      if (!first || !last) throw new Error('P10_3A_RANGE_ADDRESS_MISSING');
      c.select(first);
      c.captureTeacherRangeStartAtSelection();
      c.select(last);
    }, { firstId: setup.eventIds[0], lastId: setup.eventIds[2] });

    const state = await page.evaluate(() =>
      globalThis.STScoreEditorP10_3AWorkstationController.getProfessionalRangeToolbarState()
    );
    if (!state.rangeReady || !state.canTransposeRange) {
      throw new Error(`P10-3A semantic range not ready ${JSON.stringify(state)}`);
    }
  };

  await captureRange();

  for (const action of controls) {
    const button = page.locator(`[data-st-p10-3a-pitch-control="${action}"]`);
    if (await button.isDisabled()) {
      throw new Error(`P10-3A control must enable for current semantic range: ${action}`);
    }
  }

  await page.locator('[data-st-p10-3a-pitch-control="transpose-up-semitone-mobile"]').click();

  const semitone = await page.evaluate(({ noteIds }) => {
    const c = globalThis.STScoreEditorP10_3AWorkstationController;
    const d = c.getDocument();
    const score = d.session.history.present.score;
    const staff = score.parts[0].staves.find(item => item.role === 'standard');
    const notes = staff.measures[0].voices[0].events
      .filter(event => event.kind === 'note')
      .map(event => event.note.pitch);
    const accidental = noteId =>
      d.session.history.present.notation.notes
        .find(entry => entry.target.noteId === noteId)?.notation.accidental ?? null;
    return {
      notes,
      accidentals: noteIds.map(accidental),
      past: d.session.history.past.length,
      range: c.getProfessionalRangeToolbarState(),
      error: c.getP10_3APitchTransposeState().lastError
    };
  }, { noteIds: setup.noteIds });

  if (
    semitone.error !== null ||
    JSON.stringify(semitone.notes) !== JSON.stringify([
      { step: 'C', alter: 1, octave: 4 },
      { step: 'F', alter: 0, octave: 4 },
      { step: 'G', alter: 0, octave: 4 }
    ]) ||
    JSON.stringify(semitone.accidentals) !== JSON.stringify(['sharp', 'natural', null]) ||
    semitone.past !== setup.beforePast + 1 ||
    semitone.range.rangeReady !== false ||
    semitone.range.rangeStartEventId !== null
  ) {
    throw new Error(`P10-3A semitone mismatch ${JSON.stringify(semitone)}`);
  }

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  const undone = await page.evaluate(() => {
    const d = globalThis.STScoreEditorP10_3AWorkstationController.getDocument();
    return JSON.stringify({
      score: d.session.history.present.score,
      notation: d.session.history.present.notation
    });
  });
  if (undone !== setup.beforeCanonical) {
    throw new Error('P10-3A Undo did not restore exact canonical score+notation');
  }

  await captureRange();
  await page.locator('[data-st-p10-3a-pitch-control="transpose-up-step-mobile"]').click();

  const diatonic = await page.evaluate(() => {
    const c = globalThis.STScoreEditorP10_3AWorkstationController;
    const d = c.getDocument();
    const staff = d.session.history.present.score.parts[0].staves.find(item => item.role === 'standard');
    return {
      notes: staff.measures[0].voices[0].events
        .filter(event => event.kind === 'note')
        .map(event => event.note.pitch),
      past: d.session.history.past.length,
      future: d.session.history.future.length,
      rangeReady: c.getProfessionalRangeToolbarState().rangeReady,
      error: c.getP10_3APitchTransposeState().lastError
    };
  });
  if (
    diatonic.error !== null ||
    JSON.stringify(diatonic.notes) !== JSON.stringify([
      { step: 'D', alter: 0, octave: 4 },
      { step: 'F', alter: 1, octave: 4 },
      { step: 'G', alter: 0, octave: 4 }
    ]) ||
    diatonic.past !== 1 ||
    diatonic.future !== 0 ||
    diatonic.rangeReady !== false
  ) {
    throw new Error(`P10-3A diatonic mismatch ${JSON.stringify(diatonic)}`);
  }

  if (errors.length !== 0) {
    throw new Error(`P10-3A browser console errors ${JSON.stringify(errors)}`);
  }

  console.log('P10-3A Professional Pitch Transpose WebKit regression: PASS');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
