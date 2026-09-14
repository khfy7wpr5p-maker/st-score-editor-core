import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import process from 'node:process';
import { webkit } from 'playwright';

const root = process.cwd();
const outDir = join(root, 'dist', 'browser');
const htmlPath = join(outDir, 'st-score-editor-professional.html');
await stat(htmlPath);

const mime = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8']
]);
const server = createServer(async (request, response) => {
  try {
    const requestPath = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    const relative = requestPath === '/' ? 'st-score-editor-professional.html' : requestPath.slice(1);
    const file = normalize(join(outDir, relative));
    if (!file.startsWith(outDir)) {
      response.writeHead(403).end('forbidden');
      return;
    }
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': mime.get(extname(file)) ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end('not found');
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('P08-E4 server address missing.');

let browser;
try {
  browser = await webkit.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const consoleErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => consoleErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${address.port}/st-score-editor-professional.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => globalThis.STScoreEditorProfessionalAppController !== undefined);
  await page.evaluate(async () => {
    const controller = globalThis.STScoreEditorProfessionalAppController;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>8</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>eighth</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>eighth</type></note>
      <note><rest/><duration>8</duration><voice>1</voice><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`;
    await controller.openMusicXml(xml, {
      documentId: 'doc:p08e4-qualification',
      revisionId: 'rev:p08e4-saved',
      title: 'P08-E4 Professional Qualification',
      sha256Hex: async () => '8'.repeat(64)
    });
  });
  await page.waitForFunction(() =>
    globalThis.STScoreEditorProfessionalAppController?.getDocument?.()?.session !== undefined
  );

  const boot = await page.evaluate(() => {
    const runtime = globalThis.STScoreEditorProfessionalApp;
    const controller = globalThis.STScoreEditorProfessionalAppController;
    return {
      rangeVersion: runtime.professionalRangeToolbar?.version ?? null,
      rangeAvailable: runtime.professionalRangeToolbar?.available ?? false,
      structureVersion: runtime.professionalStructureInspector?.version ?? null,
      structureAvailable: runtime.professionalStructureInspector?.available ?? false,
      hasApp: Boolean(document.querySelector('[data-st-score-editor-app]')),
      hasRange: Boolean(document.querySelector('[data-st-professional-range-toolbar]')),
      hasStructure: Boolean(document.querySelector('[data-st-professional-structure-inspector]')),
      historyPast: controller.getDocument().session.history.past.length
    };
  });
  if (
    boot.rangeVersion !== '1.0.0' ||
    !boot.rangeAvailable ||
    boot.structureVersion !== '1.0.0' ||
    !boot.structureAvailable ||
    !boot.hasApp ||
    !boot.hasRange ||
    !boot.hasStructure ||
    boot.historyPast !== 0
  ) {
    throw new Error(`P08-E4 boot mismatch: ${JSON.stringify(boot)}`);
  }

  const rangeReady = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorProfessionalAppController;
    const entries = controller.getDocument().session.renderRequest.manifest.entries
      .filter(item => item.address.kind === 'note')
      .slice(0, 2);
    if (entries.length !== 2) throw new Error('P08E4_RANGE_TARGETS_MISSING');
    controller.select(entries[0].address);
    controller.captureProfessionalRangeStart();
    controller.select(entries[1].address);
    return controller.getProfessionalRangeState();
  });
  if (!rangeReady.ready || rangeReady.startEventId === null || rangeReady.endEventId === null) {
    throw new Error(`P08-E4 range preparation mismatch: ${JSON.stringify(rangeReady)}`);
  }

  const clearResult = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorProfessionalAppController;
    const result = controller.clearProfessionalRangeToRest();
    const documentValue = controller.getDocument();
    const events = documentValue.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events;
    return {
      ok: result.ok,
      error: result.error,
      historyPast: documentValue.session.history.past.length,
      kinds: events.slice(0, 2).map(event => event.kind)
    };
  });
  if (!clearResult.ok || clearResult.error !== null || clearResult.historyPast !== 1 ||
      JSON.stringify(clearResult.kinds) !== JSON.stringify(['rest', 'rest'])) {
    throw new Error(`P08-E4 professional Clear mismatch: ${JSON.stringify(clearResult)}`);
  }

  const undoRange = await page.evaluate(() => {
    const controller = globalThis.STScoreEditorProfessionalAppController;
    controller.undo();
    const documentValue = controller.getDocument();
    const events = documentValue.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events;
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
  if (undoStructure.historyPast !== 0 || undoStructure.keySignature !== null) {
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