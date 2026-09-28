import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webkit } from 'playwright';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const browserRoot = path.join(repoRoot, 'dist', 'browser');
const fixtureRoot = path.join(repoRoot, 'corpus', 'fixtures', 'musicxml-compatibility');
const [fullMusicXml, semanticOnlyMusicXml] = await Promise.all([
  readFile(path.join(fixtureRoot, 'p-mxml-ref-01-sorf-surrogate.musicxml'), 'utf8'),
  readFile(path.join(fixtureRoot, 'p-mxml-ref-01-sorf-surrogate-semantic-only.musicxml'), 'utf8')
]);
const unsupportedMusicXml = semanticOnlyMusicXml.replace(
  '<measure number="1">',
  '<measure number="1"><harmony><root/></harmony>'
);

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8']
]);

const resolveRequestPath = requestUrl => {
  const pathname = decodeURIComponent(new URL(requestUrl ?? '/', 'http://127.0.0.1').pathname);
  const resolved = path.resolve(browserRoot, pathname.replace(/^\/+/, '') || 'st-score-editor-app.html');
  if (resolved !== browserRoot && !resolved.startsWith(`${browserRoot}${path.sep}`)) {
    throw new Error('request escaped browser output root');
  }
  return resolved;
};

const server = createServer(async (request, response) => {
  try {
    const requestedPath = resolveRequestPath(request.url);
    const info = await stat(requestedPath);
    if (!info.isFile()) {
      response.writeHead(404).end('not found');
      return;
    }
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
  throw new Error('P-MXML-REF-01 WebKit server did not expose a TCP port.');
}

const canonicalSnapshot = async (page, musicXml) => page.evaluate(async xml => {
  const controller = globalThis.STScoreEditorAppController;
  if (!controller || typeof controller.openMusicXml !== 'function' || typeof controller.getDocument !== 'function') {
    throw new Error('P_MXML_REF_01_CONTROLLER_MISSING');
  }
  const snapshot = await controller.openMusicXml(xml, {
    title: 'P-MXML-REF-01 WebKit',
    documentId: 'doc:p-mxml-ref-01-webkit',
    revisionId: 'rev:p-mxml-ref-01-webkit'
  });
  const documentValue = controller.getDocument();
  if (!documentValue) throw new Error('P_MXML_REF_01_DOCUMENT_MISSING');
  const score = structuredClone(documentValue.session.history.present.score);
  score.source = { sha256: '<source>', format: score.source.format, byteLength: 0 };
  return {
    snapshot,
    canonical: {
      score,
      notation: structuredClone(documentValue.session.history.present.notation)
    }
  };
}, musicXml);

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
  const pageErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') pageErrors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', error => pageErrors.push(`pageerror: ${error.message}`));

  await page.goto(`http://127.0.0.1:${address.port}/st-score-editor-app.html`, {
    waitUntil: 'load',
    timeout: 30000
  });
  await page.waitForFunction(
    () => globalThis.STScoreEditorAppController &&
      typeof globalThis.STScoreEditorAppController.openMusicXml === 'function',
    null,
    { timeout: 30000 }
  );

  const full = await canonicalSnapshot(page, fullMusicXml);
  if (full.snapshot.error !== null || full.snapshot.origin !== 'MUSICXML') {
    throw new Error(`full surrogate did not open cleanly: ${JSON.stringify(full.snapshot)}`);
  }

  const semanticOnly = await canonicalSnapshot(page, semanticOnlyMusicXml);
  if (semanticOnly.snapshot.error !== null || semanticOnly.snapshot.origin !== 'MUSICXML') {
    throw new Error(`semantic-only twin did not open cleanly: ${JSON.stringify(semanticOnly.snapshot)}`);
  }

  if (JSON.stringify(full.canonical) !== JSON.stringify(semanticOnly.canonical)) {
    throw new Error('full surrogate and semantic-only twin produced different canonical V3/V4 state');
  }

  const score = full.canonical.score;
  const measures = score.parts?.[0]?.staves?.[0]?.measures ?? [];
  if (measures.length !== 2) throw new Error(`expected two measures, observed ${measures.length}`);
  if (JSON.stringify(measures[0]?.voices?.map(voice => voice.ordinal)) !== JSON.stringify([1, 2])) {
    throw new Error('expected preserved Voice 1 / Voice 2 material in first measure');
  }

  const beforeNegative = await page.evaluate(() => {
    const documentValue = globalThis.STScoreEditorAppController.getDocument();
    return {
      revisionId: documentValue?.session.history.present.score.revision.id ?? null,
      score: documentValue ? JSON.stringify(documentValue.session.history.present.score) : null
    };
  });

  const rejected = await page.evaluate(async xml => {
    const controller = globalThis.STScoreEditorAppController;
    const snapshot = await controller.openMusicXml(xml, {
      title: 'P-MXML-REF-01 Unsupported',
      documentId: 'doc:p-mxml-ref-01-unsupported',
      revisionId: 'rev:p-mxml-ref-01-unsupported'
    });
    const documentValue = controller.getDocument();
    return {
      snapshot,
      revisionId: documentValue?.session.history.present.score.revision.id ?? null,
      score: documentValue ? JSON.stringify(documentValue.session.history.present.score) : null
    };
  }, unsupportedMusicXml);

  if (rejected.snapshot.error?.code !== 'UNSUPPORTED_MUSICXML') {
    throw new Error(`unsupported semantic fixture did not fail closed: ${JSON.stringify(rejected.snapshot)}`);
  }
  if (rejected.revisionId !== beforeNegative.revisionId || rejected.score !== beforeNegative.score) {
    throw new Error('failed unsupported open mutated the active canonical document');
  }

  if (pageErrors.length !== 0) {
    throw new Error(`browser emitted errors: ${JSON.stringify(pageErrors)}`);
  }

  console.log('P-MXML-REF-01 mobile WebKit MusicXML compatibility regression: PASS');
  console.log(JSON.stringify({
    viewport: { width: 390, height: 844, deviceScaleFactor: 3, hasTouch: true, isMobile: true },
    fullOrigin: full.snapshot.origin,
    revisionId: full.snapshot.revisionId,
    measures: measures.length,
    firstMeasureVoices: measures[0]?.voices?.map(voice => voice.ordinal) ?? [],
    unsupportedCode: rejected.snapshot.error.code
  }));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
