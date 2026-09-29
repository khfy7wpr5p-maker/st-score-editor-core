import { createServer } from 'node:http';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const browserRoot = path.join(repoRoot, 'dist', 'browser');
const artifactRoot = path.join(repoRoot, 'artifacts', 'ses-111');
const browserName = process.env.ST_CE_E2E_BROWSER ?? 'webkit';
const qualificationMode = process.env.ST_CE_E2E_MODE ?? 'preview';
const entryHtml = process.env.ST_CE_E2E_ENTRY ?? 'st-score-editor-app09b.html';
const browserType = browserName === 'chromium' ? chromium : browserName === 'webkit' ? webkit : null;
if (browserType === null) throw new Error('ST_CE_E2E_BROWSER must be chromium or webkit.');

const overfullMusicXml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>4</divisions><time><beats>2</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>8</duration><voice>1</voice><type>half</type></note>
    </measure>
  </part>
</score-partwise>`;

const correctedMusicXml = overfullMusicXml.replace(
  '<note><pitch><step>F</step><octave>4</octave></pitch><duration>8</duration><voice>1</voice><type>half</type></note>',
  '<note><pitch><step>F</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>'
);

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
  ['.musicxml', 'application/vnd.recordare.musicxml+xml; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.css', 'text/css; charset=utf-8']
]);

const loadBrowserArtifacts = async () => {
  const files = new Map();
  const visit = async (directory, relativePrefix = '') => {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const relative = relativePrefix.length === 0 ? entry.name : `${relativePrefix}/${entry.name}`;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute, relative);
      } else if (entry.isFile()) {
        const urlPath = `/${relative.split(path.sep).join('/')}`;
        files.set(urlPath, Object.freeze({
          body: await readFile(absolute),
          contentType: contentTypes.get(path.extname(entry.name).toLowerCase()) ?? 'application/octet-stream'
        }));
      }
    }
  };
  await visit(browserRoot);
  return files;
};

const startLoopbackArtifactServer = async () => {
  const files = await loadBrowserArtifacts();
  const server = createServer((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' }).end();
      return;
    }
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const requestPath = url.pathname === '/' ? `/${entryHtml}` : url.pathname;
    const asset = files.get(requestPath);
    if (!asset) {
      response.writeHead(404, { 'Cache-Control': 'no-store' }).end('not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': asset.contentType,
      'Content-Length': asset.body.byteLength,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    });
    if (request.method === 'HEAD') response.end();
    else response.end(asset.body);
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    await new Promise((resolve) => server.close(resolve));
    throw new Error('SES-111 loopback server did not expose a TCP port.');
  }
  return Object.freeze({
    port: address.port,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    })
  });
};

const previewServer = await startLoopbackArtifactServer();
const traversalProbe = await fetch(`http://127.0.0.1:${previewServer.port}/%2e%2e/package.json`, { redirect: 'manual' });
if (traversalProbe.status !== 404) {
  throw new Error(`SES-111 static server exposed a path outside the artifact table: ${traversalProbe.status}`);
}
let browser;
try {
  browser = await browserType.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = [];
  const blockedStyleDiagnostics = [];
  const blockedStyleByCsp = (value) =>
    value.includes('Refused to apply a stylesheet') &&
    value.includes('style-src directive of the Content Security Policy');
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const location = message.location();
      const value = `${message.text()} @ ${location.url || 'unknown'}:${location.lineNumber ?? 0}:${location.columnNumber ?? 0}`;
      if (blockedStyleByCsp(message.text())) blockedStyleDiagnostics.push(value);
      else consoleErrors.push(value);
    }
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto(`http://127.0.0.1:10080/${entryHtml}`, {
    waitUntil: 'load',
    timeout: 30000
  });
  await page.waitForFunction(
    () => document.documentElement.dataset.app09bRendererReady === 'true',
    null,
    { timeout: 30000 }
  );

  await page.evaluate(() => {
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    const child = frame instanceof HTMLIFrameElement ? frame.contentDocument : null;
    const childWindow = frame instanceof HTMLIFrameElement ? frame.contentWindow : null;
    if (!child || !childWindow) throw new Error('SES111_RENDERER_DOCUMENT_UNAVAILABLE');
    childWindow.__SES111_STYLE_MUTATIONS__ = [];
    const observer = new childWindow.MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.target instanceof childWindow.Element) {
          childWindow.__SES111_STYLE_MUTATIONS__.push({
            kind: 'attribute',
            tag: mutation.target.tagName,
            style: mutation.target.getAttribute('style'),
            html: mutation.target.outerHTML.slice(0, 500)
          });
        }
        for (const node of mutation.addedNodes ?? []) {
          if (node instanceof childWindow.HTMLStyleElement) {
            childWindow.__SES111_STYLE_MUTATIONS__.push({
              kind: 'style-element',
              text: node.textContent?.slice(0, 500) ?? '',
              html: node.outerHTML.slice(0, 700)
            });
          }
        }
      }
    });
    observer.observe(child, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
    childWindow.__SES111_STYLE_OBSERVER__ = observer;
  });

  const result = await page.evaluate(async (musicxml) => {
    const api = globalThis.STScoreEditorApp09B;
    if (!api || typeof api.openMusicXmlWithCorrectionAnalysis !== 'function') {
      throw new Error('APP09B_CORRECTION_E2E_API_MISSING');
    }
    return api.openMusicXmlWithCorrectionAnalysis(musicxml, { title: 'SES-111 overfull measure' });
  }, overfullMusicXml);
  if (result?.openResult?.error) throw new Error(`score open failed: ${JSON.stringify(result.openResult.error)}`);
  if (result?.analysisError !== null) throw new Error(`correction analysis failed: ${result.analysisError}`);

  await page.waitForFunction(() => {
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    const child = frame instanceof HTMLIFrameElement ? frame.contentDocument : null;
    return document.documentElement.dataset.app09bCorrectionStatus === 'applied'
      && (child?.querySelectorAll('[data-st-score-measure-highlight="true"]').length ?? 0) === 1;
  }, null, { timeout: 30000 });

  const probe = await page.evaluate(() => {
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    const child = frame instanceof HTMLIFrameElement ? frame.contentDocument : null;
    const state = globalThis.STScoreEditorApp09B?.getState?.() ?? null;
    const overlays = [...(child?.querySelectorAll('[data-st-score-measure-highlight="true"]') ?? [])];
    return {
      overlayCount: overlays.length,
      overlayMeasureIndexes: overlays.map((element) => Number(element.getAttribute('data-st-score-measure-index'))),
      overlayPartIds: overlays.map((element) => element.getAttribute('data-st-score-measure-part-id')),
      noteErrorHighlightCount: child?.querySelectorAll('[data-st-score-highlight="true"]').length ?? -1,
      suspiciousMeasureIndexes: state?.correctionAnalysis?.analysis?.suspiciousMeasures?.map((item) => item.measureIndex) ?? null,
      suspiciousMeasureNumbers: state?.correctionAnalysis?.analysis?.suspiciousMeasures?.map((item) => item.measureNumber) ?? null,
      authority: {
        automaticApplyAuthority: state?.correctionAnalysis?.analysis?.automaticApplyAuthority ?? null,
        musicXmlWriteBackAuthority: state?.correctionAnalysis?.analysis?.musicXmlWriteBackAuthority ?? null,
      },
      presentationInvariant: state?.correctionAnalysis?.presentationInvariant ?? null,
      rendererStyleMutations: frame?.contentWindow?.__SES111_STYLE_MUTATIONS__ ?? []
    };
  });

  if (JSON.stringify(probe.overlayMeasureIndexes) !== JSON.stringify([1])) {
    throw new Error(`wrong highlighted measures: ${JSON.stringify(probe)}`);
  }
  if (JSON.stringify(probe.overlayPartIds) !== JSON.stringify(['P1'])) {
    throw new Error(`wrong highlighted part: ${JSON.stringify(probe)}`);
  }
  if (JSON.stringify(probe.suspiciousMeasureIndexes) !== JSON.stringify([1]) ||
      JSON.stringify(probe.suspiciousMeasureNumbers) !== JSON.stringify(['2'])) {
    throw new Error(`Engine measure analysis mismatch: ${JSON.stringify(probe)}`);
  }
  if (probe.noteErrorHighlightCount !== 0) throw new Error(`notes were recolored as errors: ${JSON.stringify(probe)}`);
  if (probe.authority.automaticApplyAuthority !== false || probe.authority.musicXmlWriteBackAuthority !== false) {
    throw new Error(`forbidden Correction Engine authority detected: ${JSON.stringify(probe)}`);
  }
  if (probe.presentationInvariant?.revisionUnchanged !== true || probe.presentationInvariant?.historyUnchanged !== true) {
    throw new Error(`highlight mutated canonical editor state: ${JSON.stringify(probe)}`);
  }

  await mkdir(artifactRoot, { recursive: true });
  const screenshotPath = path.join(artifactRoot, `ses-111-${qualificationMode}-${browserName}-red-measure.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const cleared = await page.evaluate(async (musicxml) => {
    return globalThis.STScoreEditorApp09B.openMusicXmlWithCorrectionAnalysis(
      musicxml,
      { title: 'SES-111 corrected measure' }
    );
  }, correctedMusicXml);
  if (cleared?.openResult?.error || cleared?.analysisError !== null) {
    throw new Error(`corrected score analysis failed: ${JSON.stringify(cleared)}`);
  }
  await page.waitForFunction(() => {
    const frame = document.querySelector('iframe[data-app09b-renderer-frame="true"]');
    const child = frame instanceof HTMLIFrameElement ? frame.contentDocument : null;
    return (child?.querySelectorAll('[data-st-score-measure-highlight="true"]').length ?? -1) === 0;
  }, null, { timeout: 30000 });

  const failureProbe = await page.evaluate(async (musicxml) => {
    const original = globalThis.STOmrCorrectionAnalysisRuntime;
    globalThis.STOmrCorrectionAnalysisRuntime = Object.freeze({
      analyzeMusicXmlSuspiciousMeasures() {
        throw new Error('SES111_FORCED_ANALYSIS_FAILURE');
      }
    });
    try {
      const value = await globalThis.STScoreEditorApp09B.openMusicXmlWithCorrectionAnalysis(
        musicxml,
        { title: 'SES-111 analysis failure keeps score open' }
      );
      const snapshot = globalThis.STScoreEditorAppController?.getSnapshot?.() ?? null;
      return {
        openError: value?.openResult?.error ?? null,
        analysis: value?.analysis ?? null,
        analysisError: value?.analysisError ?? null,
        revisionId: snapshot?.revisionId ?? null,
        status: document.documentElement.dataset.app09bCorrectionStatus ?? null
      };
    } finally {
      globalThis.STOmrCorrectionAnalysisRuntime = original;
    }
  }, correctedMusicXml);

  if (
    failureProbe.openError !== null ||
    failureProbe.analysis !== null ||
    !String(failureProbe.analysisError).includes('SES111_FORCED_ANALYSIS_FAILURE') ||
    failureProbe.revisionId === null ||
    failureProbe.status !== 'APP09B_CORRECTION_ANALYSIS_FAILED'
  ) {
    throw new Error(`analysis failure blocked score opening: ${JSON.stringify(failureProbe)}`);
  }

  if (consoleErrors.length > 0) {
    throw new Error(`SES-111 ${qualificationMode} ${browserName} console errors: ${consoleErrors.slice(-12).join(' | ')}`);
  }

  console.log(`SES-111 ${qualificationMode} ${browserName} correction E2E: PASS (${JSON.stringify({ probe, failureProbe, blockedStyleDiagnostics: blockedStyleDiagnostics.length, screenshotPath })})`);
} finally {
  if (browser !== undefined) await browser.close();
}
