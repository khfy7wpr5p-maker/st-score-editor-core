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
  const resolved = path.resolve(
    browserRoot,
    pathname.replace(/^\/+/, '') || 'st-score-editor-professional-workstation.html'
  );
  if (resolved !== browserRoot && !resolved.startsWith(`${browserRoot}${path.sep}`)) {
    throw new Error('request escaped browser output root');
  }
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
  throw new Error('P10-1 WebKit server did not expose a TCP port.');
}

let browser;
try {
  browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => consoleErrors.push(error.message));

  await page.goto(
    `http://127.0.0.1:${address.port}/st-score-editor-professional-workstation.html`,
    { waitUntil: 'load', timeout: 30000 }
  );
  await page.waitForFunction(() =>
    Boolean(globalThis.STScoreEditorProfessionalWorkstationController?.getKeyboardWorkstationState)
  );

  const boot = await page.evaluate(() => {
    const runtime = globalThis.STScoreEditorProfessionalWorkstation;
    const controller = globalThis.STScoreEditorProfessionalWorkstationController;
    return {
      combined: runtime?.profile?.professionalWorkstationComposition ?? false,
      keyboardBundled: runtime?.profile?.keyboardWorkstationBundled ?? false,
      rangeAvailable: runtime?.profile?.professionalRangeToolbarAvailable ?? false,
      structureAvailable: runtime?.profile?.professionalStructureInspectorAvailable ?? false,
      audioHostIntegrated: runtime?.profile?.audioHostIntegrated ?? false,
      canonicalAuthority: runtime?.profile?.canonicalAuthority ?? true,
      keyboardMounted: controller.getKeyboardWorkstationState().mounted,
      appMounted: Boolean(document.querySelector('[data-st-score-editor-app]')),
      rangeMounted: Boolean(document.querySelector('[data-st-professional-range-toolbar]')),
      structureMounted: Boolean(document.querySelector('[data-st-professional-structure-inspector]'))
    };
  });

  if (
    !boot.combined ||
    !boot.keyboardBundled ||
    !boot.rangeAvailable ||
    !boot.structureAvailable ||
    !boot.audioHostIntegrated ||
    boot.canonicalAuthority !== false ||
    !boot.keyboardMounted ||
    !boot.appMounted ||
    !boot.rangeMounted ||
    !boot.structureMounted
  ) {
    throw new Error(`P10-1 bootstrap mismatch: ${JSON.stringify(boot)}`);
  }

  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.waitForFunction(() =>
    globalThis.STScoreEditorProfessionalWorkstationController?.getSnapshot?.().hasDocument === true
  );

  const r0 = await page.evaluate(() => {
    const d = globalThis.STScoreEditorProfessionalWorkstationController.getDocument();
    return JSON.stringify({
      score: d.session.history.present.score,
      notation: d.session.history.present.notation
    });
  });

  await page.evaluate(() => {
    const controller = globalThis.STScoreEditorProfessionalWorkstationController;
    const documentValue = controller.getDocument();
    const score = documentValue.session.history.present.score;
    const staff = score.parts[0].staves.find(candidate => candidate.role === 'standard');
    const event = staff.measures[0].voices[0].events[0];
    const address = documentValue.session.renderRequest.manifest.entries
      .find(entry => entry.address.kind === 'event' && entry.address.eventId === event.id)?.address;
    if (!address) throw new Error('P10_1_EVENT_TARGET_MISSING');
    controller.select(address);
    controller.dispatchKeyboardIntent({
      version: '1.0.0',
      type: 'SET_ENTRY_PITCH',
      pitch: { step: 'C', alter: 0, octave: 4 }
    });
    controller.dispatchKeyboardIntent({
      version: '1.0.0',
      type: 'SET_ENTRY_DURATION',
      duration: { numerator: 1, denominator: 4 }
    });
  });

  const viewport = page.locator('[data-st-score-editor-viewport]');
  await viewport.focus();
  await page.keyboard.press('Enter');

  const afterKeyboard = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorProfessionalWorkstationController;
    const documentValue = controller.getDocument();
    const staff = documentValue.session.history.present.score.parts[0].staves
      .find(candidate => candidate.role === 'standard');
    const event = staff.measures[0].voices[0].events[0];
    return {
      canonical: JSON.stringify({
        score: documentValue.session.history.present.score,
        notation: documentValue.session.history.present.notation
      }),
      kind: event.kind,
      pitch: event.kind === 'note' ? event.note.pitch : null,
      past: documentValue.session.history.past.length
    };
  });
  if (
    afterKeyboard.kind !== 'note' ||
    JSON.stringify(afterKeyboard.pitch) !== JSON.stringify({ step: 'C', alter: 0, octave: 4 }) ||
    afterKeyboard.past !== 1 ||
    afterKeyboard.canonical === r0
  ) {
    throw new Error(`P10-1 keyboard edit mismatch: ${JSON.stringify(afterKeyboard)}`);
  }

  const afterProfessional = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorProfessionalWorkstationController;
    const documentValue = controller.getDocument();
    const events = documentValue.session.history.present.score.parts[0].staves
      .find(candidate => candidate.role === 'standard').measures[0].voices[0].events;
    if (events.length < 2) throw new Error('P10_1_RANGE_EVENTS_MISSING');
    const entries = events.map(event =>
      documentValue.session.renderRequest.manifest.entries
        .find(entry => entry.address.kind === 'event' && entry.address.eventId === event.id)?.address
    );
    const first = entries[0];
    const last = entries[entries.length - 1];
    if (!first || !last) throw new Error('P10_1_RANGE_ADDRESSES_MISSING');
    const selected = controller.professional.selectEventSpan(first, last);
    if (selected.error !== null) throw new Error(selected.error.message);
    const beforePast = controller.getDocument().session.history.past.length;
    const cleared = controller.professional.clearToRest({ nextRevisionId: 'p10-1-webkit-r2' });
    if (cleared.error !== null) throw new Error(cleared.error.message);
    const current = controller.getDocument();
    return {
      canonical: JSON.stringify({
        score: current.session.history.present.score,
        notation: current.session.history.present.notation
      }),
      beforePast,
      afterPast: current.session.history.past.length,
      selection: controller.professional.getProfessionalSelection()
    };
  });
  if (
    afterProfessional.beforePast !== 1 ||
    afterProfessional.afterPast !== 2 ||
    afterProfessional.canonical === afterKeyboard.canonical
  ) {
    throw new Error(`P10-1 professional edit mismatch: ${JSON.stringify(afterProfessional)}`);
  }

  await viewport.focus();
  await page.keyboard.press('Control+z');
  const undo1 = await page.evaluate(() => {
    const d = globalThis.STScoreEditorProfessionalWorkstationController.getDocument();
    return {
      canonical: JSON.stringify({ score: d.session.history.present.score, notation: d.session.history.present.notation }),
      past: d.session.history.past.length
    };
  });
  if (undo1.canonical !== afterKeyboard.canonical || undo1.past !== 1) {
    throw new Error(`P10-1 first Undo mismatch: ${JSON.stringify(undo1)}`);
  }

  await viewport.focus();
  await page.keyboard.press('Control+z');
  const undo2 = await page.evaluate(() => {
    const d = globalThis.STScoreEditorProfessionalWorkstationController.getDocument();
    return {
      canonical: JSON.stringify({ score: d.session.history.present.score, notation: d.session.history.present.notation }),
      past: d.session.history.past.length
    };
  });
  if (undo2.canonical !== r0 || undo2.past !== 0) {
    throw new Error(`P10-1 second Undo mismatch: ${JSON.stringify(undo2)}`);
  }

  await viewport.focus();
  await page.keyboard.press('Control+y');
  const redo1 = await page.evaluate(() => {
    const d = globalThis.STScoreEditorProfessionalWorkstationController.getDocument();
    return {
      canonical: JSON.stringify({ score: d.session.history.present.score, notation: d.session.history.present.notation }),
      past: d.session.history.past.length
    };
  });
  if (redo1.canonical !== afterKeyboard.canonical || redo1.past !== 1) {
    throw new Error(`P10-1 first Redo mismatch: ${JSON.stringify(redo1)}`);
  }

  await viewport.focus();
  await page.keyboard.press('Control+y');
  const redo2 = await page.evaluate(() => {
    const d = globalThis.STScoreEditorProfessionalWorkstationController.getDocument();
    return {
      canonical: JSON.stringify({ score: d.session.history.present.score, notation: d.session.history.present.notation }),
      past: d.session.history.past.length
    };
  });
  if (redo2.canonical !== afterProfessional.canonical || redo2.past !== 2) {
    throw new Error(`P10-1 second Redo mismatch: ${JSON.stringify(redo2)}`);
  }

  const editablePast = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorProfessionalWorkstationController;
    const root = document.getElementById('st-score-editor-professional-workstation-root');
    const input = document.createElement('input');
    input.setAttribute('data-p10-1-editable-probe', 'true');
    root.append(input);
    input.focus();
    return controller.getDocument().session.history.past.length;
  });
  await page.keyboard.press('Control+z');
  const editableAfter = await page.evaluate(() =>
    globalThis.STScoreEditorProfessionalWorkstationController.getDocument().session.history.past.length
  );
  if (editableAfter !== editablePast) {
    throw new Error(`P10-1 editable target was hijacked: ${editablePast} -> ${editableAfter}`);
  }

  const touchTargets = await page.evaluate(() => ({
    clearMobile: Number.parseFloat(
      getComputedStyle(document.querySelector('[data-st-professional-range-action="clear-to-rest-mobile"]')).minHeight
    ),
    structure: [...document.querySelectorAll('[data-st-professional-structure-inspector] button')]
      .every(button => Number.parseFloat(getComputedStyle(button).minHeight) >= 44)
  }));
  if (touchTargets.clearMobile < 44 || !touchTargets.structure) {
    throw new Error(`P10-1 touch-target mismatch: ${JSON.stringify(touchTargets)}`);
  }

  const remountBefore = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorProfessionalWorkstationController;
    const root = document.getElementById('st-score-editor-professional-workstation-root');
    controller.unmount();
    controller.mount(root);
    return {
      mounted: controller.getKeyboardWorkstationState().mounted,
      past: controller.getDocument().session.history.past.length
    };
  });
  if (!remountBefore.mounted) throw new Error('P10-1 keyboard adapter did not remount.');

  await viewport.focus();
  await page.keyboard.press('Control+z');
  const remountAfter = await page.evaluate(() =>
    globalThis.STScoreEditorProfessionalWorkstationController.getDocument().session.history.past.length
  );
  if (remountAfter !== remountBefore.past - 1) {
    throw new Error(`P10-1 remount duplicated history navigation: ${remountBefore.past} -> ${remountAfter}`);
  }

  if (consoleErrors.length !== 0) {
    throw new Error(`P10-1 browser console errors: ${JSON.stringify(consoleErrors)}`);
  }

  console.log('P10-1 professional workstation WebKit regression: PASS');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
