import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP09B_RENDERER_SOURCE_REVISION = 'bfd8efe04b90896012ee14d33895420f816beaa6';
export const APP09B_OSMD_VERSION = '2.1.2';
export const APP09B_RENDERER_CONTRACT_VERSION = '0.2.0';
export const APP09B_PREVIEW_VERSION = '1.0.0';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const defaultOutputDir = path.join(repoRoot, 'dist', 'browser');

const requiredManifestFields = Object.freeze([
  'rendererSourceRevision',
  'scoreRendererContractVersion',
  'vendor',
  'files'
]);

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function validateRendererRuntimeManifest(manifest) {
  if (!isRecord(manifest)) throw new TypeError('APP09B renderer runtime manifest must be an object.');
  for (const field of requiredManifestFields) {
    if (!(field in manifest)) throw new Error(`APP09B renderer runtime manifest is missing ${field}.`);
  }
  if (manifest.rendererSourceRevision !== APP09B_RENDERER_SOURCE_REVISION) {
    throw new Error(`APP09B renderer revision mismatch: ${String(manifest.rendererSourceRevision)}.`);
  }
  if (manifest.scoreRendererContractVersion !== APP09B_RENDERER_CONTRACT_VERSION) {
    throw new Error(`APP09B renderer contract mismatch: ${String(manifest.scoreRendererContractVersion)}.`);
  }
  const osmd = isRecord(manifest.vendor) && isRecord(manifest.vendor.opensheetmusicdisplay)
    ? manifest.vendor.opensheetmusicdisplay
    : null;
  if (osmd === null || osmd.version !== APP09B_OSMD_VERSION || osmd.license !== 'BSD-3-Clause') {
    throw new Error('APP09B renderer vendor profile must be exact OSMD 2.1.2 / BSD-3-Clause.');
  }
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error('APP09B renderer runtime manifest must list emitted files.');
  }
  const paths = new Set(manifest.files.map((entry) => isRecord(entry) ? entry.path : null));
  for (const required of ['index.html', 'workstation-bootstrap.mjs', 'vendor/opensheetmusicdisplay.min.js']) {
    if (!paths.has(required)) throw new Error(`APP09B renderer runtime manifest is missing ${required}.`);
  }
  return Object.freeze({
    rendererSourceRevision: APP09B_RENDERER_SOURCE_REVISION,
    scoreRendererContractVersion: APP09B_RENDERER_CONTRACT_VERSION,
    osmdVersion: APP09B_OSMD_VERSION,
    osmdLicense: 'BSD-3-Clause'
  });
}

async function assertManifestFiles(runtimeDir, manifest) {
  for (const entry of manifest.files) {
    if (!isRecord(entry) || typeof entry.path !== 'string' || entry.path.length === 0) {
      throw new Error('APP09B renderer runtime manifest contains an invalid file entry.');
    }
    const absolute = path.join(runtimeDir, entry.path);
    const info = await stat(absolute);
    if (!info.isFile()) throw new Error(`APP09B renderer runtime asset is not a regular file: ${entry.path}`);
  }
}

const sampleMusicXml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>
`;

const previewBootstrap = `(() => {
  'use strict';
  const EXPECTED = Object.freeze({
    previewVersion: '${APP09B_PREVIEW_VERSION}',
    rendererSourceRevision: '${APP09B_RENDERER_SOURCE_REVISION}',
    rendererContractVersion: '${APP09B_RENDERER_CONTRACT_VERSION}',
    rendererPackageName: 'opensheetmusicdisplay',
    rendererPackageVersion: '${APP09B_OSMD_VERSION}',
    rendererLicense: 'BSD-3-Clause'
  });
  const root = document.getElementById('st-score-editor-app-root');
  if (!(root instanceof HTMLElement) || !globalThis.STScoreEditorApp) {
    throw new Error('APP09B_PREVIEW_BOOTSTRAP_UNAVAILABLE');
  }

  const parking = document.createElement('div');
  parking.hidden = true;
  parking.setAttribute('data-app09b-renderer-parking', 'true');
  document.body.append(parking);

  const frame = document.createElement('iframe');
  frame.src = './renderer-runtime/index.html';
  frame.title = 'ST Score Rendering Layer';
  frame.setAttribute('data-app09b-renderer-frame', 'true');
  frame.style.width = '100%';
  frame.style.height = '100%';
  frame.style.minHeight = '220px';
  frame.style.border = '0';
  frame.style.display = 'block';
  parking.append(frame);

  const nativeReplaceChildren = root.replaceChildren.bind(root);
  root.replaceChildren = (...nodes) => {
    if (frame.isConnected && root.contains(frame)) parking.append(frame);
    nativeReplaceChildren(...nodes);
    const viewport = root.querySelector('[data-st-score-editor-viewport]');
    if (viewport instanceof HTMLElement) {
      viewport.replaceChildren(frame);
      viewport.setAttribute('data-app09b-exact-renderer-mounted', 'true');
    } else if (!frame.isConnected) {
      parking.append(frame);
    }
  };

  const integrationProfile = Object.freeze({
    family: 'osmd',
    packageName: EXPECTED.rendererPackageName,
    packageVersion: EXPECTED.rendererPackageVersion,
    license: EXPECTED.rendererLicense
  });
  const controller = globalThis.STScoreEditorApp.createController({ rendererProfile: integrationProfile });
  controller.mount(root);
  Object.defineProperty(globalThis, 'STScoreEditorAppController', { value: controller, writable: false, configurable: false });

  const waitForRendererHost = () => new Promise((resolve, reject) => {
    const started = Date.now();
    const inspect = () => {
      try {
        const child = frame.contentWindow;
        const host = child?.__ST_SCORE_RENDER_HOST__;
        if (host && typeof host.renderMusicXml === 'function' && typeof host.hitTestNoteDetailed === 'function' && typeof host.highlight === 'function' && typeof host.dispose === 'function') {
          resolve(host);
          return;
        }
      } catch {
        // Same-origin runtime may still be booting.
      }
      if (Date.now() - started > 15000) {
        reject(new Error('APP09B_RENDERER_HOST_TIMEOUT'));
        return;
      }
      setTimeout(inspect, 50);
    };
    frame.addEventListener('load', inspect, { once: true });
    inspect();
  });

  let rendererApi = null;
  let renderEvidence = null;
  let renderTicket = 0;
  let pendingClear = Promise.resolve();
  let lastLoadSucceeded = false;
  let lastRenderedRevision = null;
  let lastAttemptRevision = null;
  let renderScheduled = false;

  const mark = (name, value) => {
    document.documentElement.dataset[name] = value;
  };

  const scheduleRenderCurrent = () => {
    const revision = controller.getSnapshot().revisionId;
    if (revision === null || revision === lastRenderedRevision || revision === lastAttemptRevision || renderScheduled || rendererApi === null) return;
    renderScheduled = true;
    queueMicrotask(async () => {
      renderScheduled = false;
      const currentRevision = controller.getSnapshot().revisionId;
      if (currentRevision === null || currentRevision === lastRenderedRevision || currentRevision === lastAttemptRevision) return;
      lastAttemptRevision = currentRevision;
      try {
        await controller.renderCurrent();
        lastRenderedRevision = currentRevision;
        mark('app09bRenderStatus', 'current');
      } catch (error) {
        mark('app09bRenderStatus', 'failed');
        console.error('APP09B render failed', error);
      }
    });
  };

  controller.subscribe(() => { scheduleRenderCurrent(); });

  waitForRendererHost().then(async (api) => {
    rendererApi = api;
    const host = Object.freeze({
      packageName: EXPECTED.rendererPackageName,
      packageVersion: EXPECTED.rendererPackageVersion,
      license: EXPECTED.rendererLicense,
      instance: Object.freeze({
        async load(musicxml) {
          await pendingClear;
          const ticket = String(++renderTicket);
          const result = await api.renderMusicXml({
            contractVersion: EXPECTED.rendererContractVersion,
            musicxml,
            ticket,
            pageMode: 'continuous',
            autoResize: true,
            drawTitle: true,
            drawComposer: true
          });
          if (!result || typeof result.renderEpoch !== 'string' || result.renderEpoch.length === 0) {
            throw new Error('APP09B_RENDER_EPOCH_MISSING');
          }
          renderEvidence = Object.freeze({ renderEpoch: result.renderEpoch, sourceId: result.sourceId ?? null });
          lastLoadSucceeded = true;
        },
        render() {
          if (!lastLoadSucceeded) throw new Error('APP09B_RENDER_WITHOUT_SUCCESSFUL_LOAD');
        },
        clear() {
          renderEvidence = null;
          lastLoadSucceeded = false;
          lastRenderedRevision = null;
          pendingClear = pendingClear.then(() => api.dispose()).catch(() => undefined);
        }
      })
    });
    controller.attachOsmdRenderer(host);

    const onHit = async (clientX, clientY) => {
      const evidence = renderEvidence;
      if (evidence === null) return;
      let hit;
      try {
        hit = api.hitTestNoteDetailed({ clientX, clientY });
      } catch {
        mark('app09bLastHit', 'rejected');
        return;
      }
      if (!hit || hit.kind !== 'HIT' || hit.renderEpoch !== evidence.renderEpoch || (hit.sourceId ?? null) !== evidence.sourceId) {
        mark('app09bLastHit', hit?.kind === 'MISS' ? 'miss' : 'stale');
        return;
      }
      try {
        controller.selectRenderedScoreNoteRef(hit.target);
        await api.clearHighlights();
        await api.highlight({ target: hit.target, className: 'st-score-highlight' });
        mark('app09bLastHit', 'selected');
      } catch {
        mark('app09bLastHit', 'rejected');
      }
    };

    const childDocument = frame.contentDocument;
    if (childDocument) {
      if ('PointerEvent' in frame.contentWindow) {
        childDocument.addEventListener('pointerup', (event) => { void onHit(event.clientX, event.clientY); });
      } else {
        childDocument.addEventListener('click', (event) => { void onHit(event.clientX, event.clientY); });
      }
    }

    mark('app09bRendererReady', 'true');
    await controller.openMusicXml(${JSON.stringify(sampleMusicXml)}, { title: 'APP-09B Touch Test' });
    scheduleRenderCurrent();
  }).catch((error) => {
    mark('app09bRendererReady', 'false');
    console.error('APP09B renderer host unavailable', error);
  });

  Object.defineProperty(globalThis, 'STScoreEditorApp09B', {
    value: Object.freeze({
      ...EXPECTED,
      releaseGatePassed: false,
      seslitabCutoverAuthorized: false,
      getState: () => Object.freeze({
        snapshot: controller.getSnapshot(),
        renderer: controller.getRendererState(),
        renderEvidence
      })
    }),
    writable: false,
    configurable: false
  });
})();
`;

const previewHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src data:; font-src data:; frame-src 'self'; connect-src 'none'; media-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'">
<title>ST Score Editor APP-09B Test</title>
<style>html,body,#st-score-editor-app-root{margin:0;width:100%;height:100%;min-height:100%;}body{overflow:hidden;overscroll-behavior:none;}@supports(height:100dvh){html,body,#st-score-editor-app-root{height:100dvh;min-height:100dvh;}}</style>
</head>
<body>
<div id="st-score-editor-app-root"></div>
<script src="./st-score-editor-app.js"></script>
<script src="./st-score-editor-app09b-bootstrap.js"></script>
</body>
</html>
`;

export async function assembleApp09BPreview({ runtimeDir, outputDir = defaultOutputDir } = {}) {
  if (typeof runtimeDir !== 'string' || runtimeDir.length === 0) {
    throw new TypeError('APP09B renderer runtime directory is required.');
  }
  const runtimeManifestPath = path.join(runtimeDir, 'runtime-manifest.json');
  const manifest = JSON.parse(await readFile(runtimeManifestPath, 'utf8'));
  const renderer = validateRendererRuntimeManifest(manifest);
  await assertManifestFiles(runtimeDir, manifest);

  await mkdir(outputDir, { recursive: true });
  const rendererTarget = path.join(outputDir, 'renderer-runtime');
  await rm(rendererTarget, { recursive: true, force: true });
  await cp(runtimeDir, rendererTarget, { recursive: true });

  await writeFile(path.join(outputDir, 'st-score-editor-app09b-bootstrap.js'), previewBootstrap, 'utf8');
  await writeFile(path.join(outputDir, 'st-score-editor-app09b.html'), previewHtml, 'utf8');
  await writeFile(path.join(outputDir, 'app09b-touch-test.musicxml'), sampleMusicXml, 'utf8');

  const previewManifest = Object.freeze({
    contract: 'ST_SCORE_EDITOR_APP09B_PREVIEW',
    version: APP09B_PREVIEW_VERSION,
    editorArtifact: 'st-score-editor-app.js',
    entryHtml: 'st-score-editor-app09b.html',
    sampleMusicXml: 'app09b-touch-test.musicxml',
    rendererRuntimeDirectory: 'renderer-runtime',
    renderer,
    rendererProfileOverride: Object.freeze({
      family: 'osmd', packageName: 'opensheetmusicdisplay', packageVersion: APP09B_OSMD_VERSION, license: 'BSD-3-Clause'
    }),
    rendererImplementationBundledIntoEditorCore: false,
    rendererRuntimeSameOriginIsolated: true,
    rendererHitRequiresExactRenderEpoch: true,
    rendererHitRequiresExactSourceId: true,
    rendererHitCanonicalInput: 'opaque-renderer-request-v4-manifest-token',
    manualDeviceValidationRequired: true,
    standaloneReleaseGatePassed: false,
    seslitabCutoverAuthorized: false
  });
  await writeFile(path.join(outputDir, 'st-score-editor-app09b.manifest.json'), `${JSON.stringify(previewManifest, null, 2)}\n`, 'utf8');
  return previewManifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const runtimeDir = process.env.ST_SCORE_RENDERER_RUNTIME_DIR;
  const result = await assembleApp09BPreview({ runtimeDir });
  console.log(`APP-09B preview assembly: PASS (${result.renderer.rendererSourceRevision}, OSMD ${result.renderer.osmdVersion})`);
}
