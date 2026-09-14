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

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>8</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>eighth</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>eighth</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>8</duration><voice>1</voice><type>quarter</type></note>
      <note><rest/><duration>16</duration><voice>1</voice><type>half</type></note>
    </measure>
  </part>
</score-partwise>`;

const resolveRequestPath = (requestUrl) => {
  const pathname = decodeURIComponent(new URL(requestUrl ?? '/', 'http://127.0.0.1').pathname);
  const resolved = path.resolve(browserRoot, pathname.replace(/^\/+/, '') || 'st-score-editor-professional.html');
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
  throw new Error('P08-E4 WebKit server did not expose a TCP port.');
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

  await page.goto(`http://127.0.0.1:${address.port}/st-score-editor-professional.html`, {
    waitUntil: 'load',
    timeout: 30000
  });
  await page.waitForFunction(() => Boolean(
    globalThis.STScoreEditorProfessionalAppController?.getProfessionalStructureInspectorState
  ));

  const bootstrap = await page.evaluate(() => ({
    professionalGlobal: Boolean(globalThis.STScoreEditorProfessionalApp),
    rangeAvailable: globalThis.STScoreEditorProfessionalApp?.professionalRangeToolbar?.available ?? false,
    structureAvailable: globalThis.STScoreEditorProfessionalApp?.professionalStructureInspector?.available ?? false,
    rangeToolbar: Boolean(document.querySelector('[data-st-professional-range-toolbar]')),
    structureInspector: Boolean(document.querySelector('[data-st-professional-structure-inspector]')),
    canonicalAuthority: globalThis.STScoreEditorProfessionalApp?.professionalStructureInspector?.canonicalAuthority ?? null,
    rendererCoordinateAuthority: globalThis.STScoreEditorProfessionalApp?.professionalStructureInspector?.rendererCoordinateAuthority ?? null,
    networkAuthority: globalThis.STScoreEditorProfessionalApp?.professionalStructureInspector?.networkAuthority ?? null
  }));
  if (!bootstrap.professionalGlobal || !bootstrap.rangeAvailable || !bootstrap.structureAvailable ||
      !bootstrap.rangeToolbar || !bootstrap.structureInspector || bootstrap.canonicalAuthority !== false ||
      bootstrap.rendererCoordinateAuthority !== false || bootstrap.networkAuthority !== false) {
    throw new Error(`P08-E4 professional bootstrap mismatch: ${JSON.stringify(bootstrap)}`);
  }

  const opened = await page.evaluate(async (musicXml) => {
    const controller = globalThis.STScoreEditorProfessionalAppController;
    return controller.openMusicXml(musicXml, {
      documentId: 'doc:p08e4-webkit',
      revisionId: 'rev:p08e4-webkit-saved',
      title: 'P08-E4 WebKit',
      sha256Hex: async () => '4'.repeat(64)
    });
  }, xml);
  if (opened?.error !== null) throw new Error(`P08-E4 MusicXML open failed: ${JSON.stringify(opened)}`);

  const rangeResult = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorProfessionalAppController;
    const entries = controller.getDocument().session.renderRequest.manifest.entries
      .filter(entry => entry.address.kind === 'event');
    if (entries.length < 2) throw new Error('P08E4_EVENT_RANGE_MISSING');
    controller.select(entries[0].address);
    controller.captureTeacherRangeStartAtSelection();
    controller.select(entries[1].address);
    const ready = controller.getProfessionalRangeToolbarState();
    const result = controller.clearProfessionalRangeToRest();
    const documentValue = controller.getDocument();
    const events = documentValue.session.history.present.score.parts[0].staves
      .find(staff => staff.role === 'standard').measures[0].voices[0].events;
    return {
      rangeWasReady: ready.rangeReady,
      error: result.error,
      historyPast: documentValue.session.history.past.length,
      kinds: events.slice(0, 2).map(event => event.kind),
      rangeReadyAfter: controller.getProfessionalRangeToolbarState().rangeReady,
      professionalSelectionAfter: controller.getProfessionalRangeToolbarState().professionalSelectionKind
    };
  });
  if (!rangeResult.rangeWasReady || rangeResult.error !== null || rangeResult.historyPast !== 1 ||
      JSON.stringify(rangeResult.kinds) !== JSON.stringify(['rest', 'rest']) || rangeResult.rangeReadyAfter ||
      rangeResult.professionalSelectionAfter !== null) {
    throw new Error(`P08-E4 professional Clear mismatch: ${JSON.stringify(rangeResult)}`);
  }

  const undoRange = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorProfessionalAppController;
    controller.undo();
    const documentValue = controller.getDocument();
    const events = documentValue.session.history.present.score.parts[0].staves
      .find(staff => staff.role === 'standard').measures[0].voices[0].events;
    return {
      historyPast: documentValue.session.history.past.length,
      kinds: events.slice(0, 2).map(event => event.kind)
    };
  });
  if (undoRange.historyPast !== 0 || JSON.stringify(undoRange.kinds) !== JSON.stringify(['note', 'note'])) {
    throw new Error(`P08-E4 professional Clear undo mismatch: ${JSON.stringify(undoRange)}`);
  }

  const structureResult = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorProfessionalAppController;
    const entry = controller.getDocument().session.renderRequest.manifest.entries
      .find(item => item.address.kind === 'note');
    if (!entry) throw new Error('P08E4_NOTE_TARGET_MISSING');
    controller.select(entry.address);
    const before = controller.getProfessionalStructureInspectorState();
    const result = controller.setProfessionalKeySignature(-2);
    const after = controller.getProfessionalStructureInspectorState();
    return {
      beforeCanEdit: before.canEditStaffStructure,
      error: result.error,
      historyPast: controller.getDocument().session.history.past.length,
      keySignature: after.keySignature,
      selectionKind: after.selectionKind
    };
  });
  if (!structureResult.beforeCanEdit || structureResult.error !== null || structureResult.historyPast !== 1 ||
      JSON.stringify(structureResult.keySignature) !== JSON.stringify({ fifths: -2 }) ||
      structureResult.selectionKind !== 'measure') {
    throw new Error(`P08-E4 professional structure mismatch: ${JSON.stringify(structureResult)}`);
  }

  const undoStructure = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorProfessionalAppController;
    controller.undo();
    const state = controller.getProfessionalStructureInspectorState();
    return {
      historyPast: controller.getDocument().session.history.past.length,
      keySignature: state.keySignature
    };
  });
  if (undoStructure.historyPast !== 0 || JSON.stringify(undoStructure.keySignature) !== JSON.stringify({ fifths: 0 })) {
    throw new Error(`P08-E4 professional structure undo mismatch: ${JSON.stringify(undoStructure)}`);
  }

  const controls = await page.evaluate(() => ({
    clearTouchTarget: getComputedStyle(document.querySelector('[data-st-professional-range-action="clear-to-rest-mobile"]')).minHeight,
    structureButtons: [...document.querySelectorAll('[data-st-professional-structure-inspector] button')]
      .every(button => Number.parseFloat(getComputedStyle(button).minHeight) >= 44)
  }));
  if (Number.parseFloat(controls.clearTouchTarget) < 44 || !controls.structureButtons) {
    throw new Error(`P08-E4 touch-target mismatch: ${JSON.stringify(controls)}`);
  }

  if (consoleErrors.length !== 0) {
    throw new Error(`P08-E4 browser console errors: ${JSON.stringify(consoleErrors)}`);
  }
  console.log('P08-E4 professional browser artifact WebKit regression: PASS');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
