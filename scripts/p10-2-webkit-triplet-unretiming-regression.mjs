import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webkit } from 'playwright';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const browserRoot = path.join(repoRoot, 'dist', 'browser');
const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8']
]);

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
    const file = path.resolve(
      browserRoot,
      pathname.replace(/^\\/+/, '') || 'st-score-editor-p10-2-workstation.html'
    );
    if (file !== browserRoot && !file.startsWith(`${browserRoot}${path.sep}`)) {
      throw new Error('escaped browser root');
    }
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');
    response.setHeader('Content-Type', types.get(path.extname(file)) ?? 'application/octet-stream');
    response.setHeader('Cache-Control', 'no-store');
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end('not found');
  }
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const address = server.address();
if (address === null || typeof address === 'string') throw new Error('P10_2_WEBKIT_SERVER_PORT_MISSING');

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
    `http://127.0.0.1:${address.port}/st-score-editor-p10-2-workstation.html`,
    { waitUntil: 'load', timeout: 30000 }
  );
  await page.waitForFunction(() =>
    Boolean(globalThis.STScoreEditorP10_2WorkstationController?.getTripletUnretimingState)
  );

  const boot = await page.evaluate(() => ({
    composed: globalThis.STScoreEditorP10_2Workstation?.profile?.p10_2WorkstationComposition ?? false,
    unretimingBundled: globalThis.STScoreEditorP10_2Workstation?.profile?.tripletUnretimingAuthoringBundled ?? false,
    p10_1Preserved: globalThis.STScoreEditorP10_2Workstation?.profile?.p10_1QualifiedBasePreserved ?? false,
    productionDefault: globalThis.STScoreEditorP10_2Workstation?.profile?.productionDefault ?? true,
    releaseAuthorized: globalThis.STScoreEditorP10_2Workstation?.profile?.productionReleaseAuthorized ?? true,
    cutoverAuthorized: globalThis.STScoreEditorP10_2Workstation?.profile?.seslitabCutoverAuthorized ?? true,
    keyboard: Boolean(globalThis.STScoreEditorP10_2WorkstationController?.getKeyboardWorkstationState),
    professional: Boolean(globalThis.STScoreEditorP10_2WorkstationController?.professional),
    audio: Boolean(globalThis.STScoreEditorP10_2WorkstationController?.getAudioHostState)
  }));
  if (
    !boot.composed || !boot.unretimingBundled || !boot.p10_1Preserved ||
    boot.productionDefault !== false || boot.releaseAuthorized !== false ||
    boot.cutoverAuthorized !== false || !boot.keyboard || !boot.professional || !boot.audio
  ) {
    throw new Error(`P10-2 bootstrap mismatch ${JSON.stringify(boot)}`);
  }

  const setup = await page.evaluate(async () => {
    const c = globalThis.STScoreEditorP10_2WorkstationController;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
<part-list><score-part id="P1"><part-name>Part</part-name></score-part></part-list>
<part id="P1"><measure number="1">
<attributes><divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
<note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type></note>
<note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type></note>
<note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type></note>
<note><rest/><duration>10</duration><voice>1</voice></note>
</measure></part></score-partwise>`;
    await c.openLocalFile({
      name: 'p10-2-webkit.musicxml',
      size: new TextEncoder().encode(xml).byteLength,
      type: 'application/vnd.recordare.musicxml+xml',
      text: async () => xml
    });
    const d = c.getDocument();
    const score = d.session.history.present.score;
    const part = score.parts[0];
    const staff = part.staves.find(item => item.role === 'standard');
    const measure = staff.measures[0];
    const voice = measure.voices[0];
    const notes = voice.events.filter(event => event.kind === 'note');
    const rest = voice.events.find(event => event.kind === 'rest');
    if (notes.length !== 3 || rest === undefined) {
      return { ok: false, notes: notes.length, hasRest: rest !== undefined };
    }
    const eventAddress = event => ({
      contractVersion: '3.0.0',
      kind: 'event',
      documentId: score.id,
      revisionId: score.revision.id,
      partId: part.id,
      staffId: staff.id,
      frameId: measure.frameId,
      measureId: measure.id,
      voiceId: voice.id,
      eventId: event.id
    });
    return {
      ok: true,
      past: d.session.history.past.length,
      ids: notes.map(event => event.id),
      straightCanonical: JSON.stringify({
        score: d.session.history.present.score,
        notation: d.session.history.present.notation
      }),
      addresses: notes.map(eventAddress)
    };
  });
  if (!setup.ok) throw new Error(`P10-2 import setup mismatch ${JSON.stringify(setup)}`);

  const captureThree = async () => {
    for (let index = 0; index < 3; index += 1) {
      await page.evaluate(({ eventId }) => {
        const c = globalThis.STScoreEditorP10_2WorkstationController;
        const d = c.getDocument();
        const address = d.session.renderRequest.manifest.entries
          .find(entry => entry.address.kind === 'event' && entry.address.eventId === eventId)?.address;
        if (!address) throw new Error(`P10_2_CAPTURE_ADDRESS_MISSING:${eventId}`);
        c.select(address);
      }, { eventId: setup.ids[index] });
      const capture = page.getByRole('button', {
        name: 'Capture selected event as next triplet member',
        exact: true
      });
      if (await capture.isDisabled()) throw new Error(`P10-2 capture ${index + 1} unexpectedly disabled`);
      await capture.click();
    }
  };

  await captureThree();

  const retiming = await page.evaluate(() => ({
    authoring: globalThis.STScoreEditorP10_2WorkstationController.getTripletAuthoringState(),
    retiming: globalThis.STScoreEditorP10_2WorkstationController.getTripletRetimingState()
  }));
  if (
    retiming.authoring.capturedEventIds.length !== 3 ||
    !retiming.retiming.canApplyRetimedTriplet ||
    retiming.retiming.admissionReason !== 'ADMITTED_STRAIGHT_THREE_TO_TRIPLET'
  ) {
    throw new Error(`P10-2 forward preflight mismatch ${JSON.stringify(retiming)}`);
  }

  const retimeButton = page.getByRole('button', {
    name: 'Convert three captured straight events to triplet timing',
    exact: true
  });
  if (await retimeButton.isDisabled()) throw new Error('P10-2 forward retiming button unexpectedly disabled');
  await retimeButton.click();

  const triplet = await page.evaluate(() => {
    const c = globalThis.STScoreEditorP10_2WorkstationController;
    const d = c.getDocument();
    return {
      canonical: JSON.stringify({
        score: d.session.history.present.score,
        notation: d.session.history.present.notation
      }),
      past: d.session.history.past.length,
      status: d.session.status.code
    };
  });
  if (triplet.past !== setup.past + 1 || triplet.status !== 'TRIPLET_RETIMING_COMMITTED') {
    throw new Error(`P10-2 forward apply mismatch ${JSON.stringify(triplet)}`);
  }

  await captureThree();

  const preRemove = await page.evaluate(() => ({
    state: globalThis.STScoreEditorP10_2WorkstationController.getTripletUnretimingState(),
    past: globalThis.STScoreEditorP10_2WorkstationController.getDocument().session.history.past.length
  }));
  if (
    !preRemove.state.canRemoveTriplet ||
    preRemove.state.admissionReason !== 'ADMITTED_TRIPLET_TO_STRAIGHT_THREE' ||
    preRemove.past !== triplet.past
  ) {
    throw new Error(`P10-2 inverse preflight mismatch ${JSON.stringify(preRemove)}`);
  }

  const removeButton = page.locator('[data-st-triplet-unretiming="1.0.0"]');
  if (await removeButton.count() !== 1) {
    throw new Error(`P10-2 Remove Triplet control count mismatch: ${await removeButton.count()}`);
  }
  if ((await removeButton.textContent())?.trim() !== 'Remove Triplet') {
    throw new Error(`P10-2 Remove Triplet label mismatch: ${await removeButton.textContent()}`);
  }
  if (await removeButton.getAttribute('aria-label') !== 'Restore straight timing') {
    throw new Error(`P10-2 Remove Triplet aria mismatch: ${await removeButton.getAttribute('aria-label')}`);
  }
  if (await removeButton.isDisabled()) throw new Error('P10-2 Remove Triplet must enable for an admitted current triplet');

  await removeButton.click();

  const removed = await page.evaluate(() => {
    const c = globalThis.STScoreEditorP10_2WorkstationController;
    const d = c.getDocument();
    return {
      canonical: JSON.stringify({
        score: d.session.history.present.score,
        notation: d.session.history.present.notation
      }),
      past: d.session.history.past.length,
      status: d.session.status.code,
      captured: c.getTripletAuthoringState().capturedEventIds
    };
  });
  if (
    removed.canonical !== setup.straightCanonical ||
    removed.past !== triplet.past + 1 ||
    removed.status !== 'TRIPLET_UNRETIMING_COMMITTED' ||
    removed.captured.length !== 0
  ) {
    throw new Error(`P10-2 remove mismatch ${JSON.stringify(removed)}`);
  }

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  const undone = await page.evaluate(() => {
    const d = globalThis.STScoreEditorP10_2WorkstationController.getDocument();
    return {
      canonical: JSON.stringify({ score: d.session.history.present.score, notation: d.session.history.present.notation }),
      past: d.session.history.past.length
    };
  });
  if (undone.canonical !== triplet.canonical || undone.past !== triplet.past) {
    throw new Error(`P10-2 Undo mismatch ${JSON.stringify(undone)}`);
  }

  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  const redone = await page.evaluate(() => {
    const d = globalThis.STScoreEditorP10_2WorkstationController.getDocument();
    return {
      canonical: JSON.stringify({ score: d.session.history.present.score, notation: d.session.history.present.notation }),
      past: d.session.history.past.length
    };
  });
  if (redone.canonical !== removed.canonical || redone.past !== removed.past) {
    throw new Error(`P10-2 Redo mismatch ${JSON.stringify(redone)}`);
  }

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await captureThree();
  const beforeRemount = await page.evaluate(() => {
    const c = globalThis.STScoreEditorP10_2WorkstationController;
    const root = document.getElementById('st-score-editor-p10-2-workstation-root');
    c.unmount();
    c.mount(root);
    return c.getDocument().session.history.past.length;
  });

  const remountButton = page.locator('[data-st-triplet-unretiming="1.0.0"]');
  if (await remountButton.count() !== 1 || await remountButton.isDisabled()) {
    throw new Error(`P10-2 remount control mismatch: count=${await remountButton.count()} disabled=${await remountButton.isDisabled()}`);
  }
  await remountButton.click();
  const afterRemount = await page.evaluate(() => ({
    past: globalThis.STScoreEditorP10_2WorkstationController.getDocument().session.history.past.length,
    canonical: JSON.stringify({
      score: globalThis.STScoreEditorP10_2WorkstationController.getDocument().session.history.present.score,
      notation: globalThis.STScoreEditorP10_2WorkstationController.getDocument().session.history.present.notation
    })
  }));
  if (afterRemount.past !== beforeRemount + 1 || afterRemount.canonical !== removed.canonical) {
    throw new Error(`P10-2 remount duplicate-listener mismatch ${JSON.stringify({ beforeRemount, afterRemount })}`);
  }

  if (errors.length !== 0) throw new Error(`P10-2 browser console errors ${JSON.stringify(errors)}`);
  console.log('P10-2 Triplet Unretiming WebKit regression: PASS');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
