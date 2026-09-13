import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP09B_GENERIC_EVENT_RENDERER_SOURCE_REVISION = 'eaca00b6a6971cdd2f24ee72d4617d6739f63306';
export const APP09B_GENERIC_EVENT_OSMD_VERSION = '2.1.2';
export const APP09B_GENERIC_EVENT_RENDERER_CONTRACT_VERSION = '0.2.0';
export const APP09B_GENERIC_EVENT_PREVIEW_VERSION = '1.0.0';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const defaultOutputDir = path.join(repoRoot, 'dist', 'browser');

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function validateGenericEventRendererRuntimeManifest(manifest) {
  if (!isRecord(manifest)) throw new TypeError('APP09B generic-event renderer runtime manifest must be an object.');
  for (const field of ['rendererSourceRevision', 'scoreRendererContractVersion', 'vendor', 'files']) {
    if (!(field in manifest)) throw new Error(`APP09B generic-event renderer runtime manifest is missing ${field}.`);
  }
  if (manifest.rendererSourceRevision !== APP09B_GENERIC_EVENT_RENDERER_SOURCE_REVISION) {
    throw new Error(`APP09B generic-event renderer revision mismatch: ${String(manifest.rendererSourceRevision)}.`);
  }
  if (manifest.scoreRendererContractVersion !== APP09B_GENERIC_EVENT_RENDERER_CONTRACT_VERSION) {
    throw new Error(`APP09B generic-event renderer contract mismatch: ${String(manifest.scoreRendererContractVersion)}.`);
  }
  const osmd = isRecord(manifest.vendor) && isRecord(manifest.vendor.opensheetmusicdisplay)
    ? manifest.vendor.opensheetmusicdisplay
    : null;
  if (osmd === null || osmd.version !== APP09B_GENERIC_EVENT_OSMD_VERSION || osmd.license !== 'BSD-3-Clause') {
    throw new Error('APP09B generic-event renderer vendor profile must be exact OSMD 2.1.2 / BSD-3-Clause.');
  }
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error('APP09B generic-event renderer runtime manifest must list emitted files.');
  }
  const paths = new Set(manifest.files.map(entry => isRecord(entry) ? entry.path : null));
  for (const required of ['index.html', 'workstation-bootstrap.mjs', 'vendor/opensheetmusicdisplay.min.js']) {
    if (!paths.has(required)) throw new Error(`APP09B generic-event renderer runtime is missing ${required}.`);
  }
  return Object.freeze({
    rendererSourceRevision: APP09B_GENERIC_EVENT_RENDERER_SOURCE_REVISION,
    scoreRendererContractVersion: APP09B_GENERIC_EVENT_RENDERER_CONTRACT_VERSION,
    osmdVersion: APP09B_GENERIC_EVENT_OSMD_VERSION,
    osmdLicense: 'BSD-3-Clause'
  });
}

async function assertManifestFiles(runtimeDir, manifest) {
  for (const entry of manifest.files) {
    if (!isRecord(entry) || typeof entry.path !== 'string' || entry.path.length === 0) {
      throw new Error('APP09B generic-event renderer runtime contains an invalid file entry.');
    }
    const info = await stat(path.join(runtimeDir, entry.path));
    if (!info.isFile()) throw new Error(`APP09B generic-event renderer asset is not a regular file: ${entry.path}`);
  }
}

const sampleMusicXml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1"><measure number="1">
    <attributes><divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
    <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
    <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
    <note><rest/><duration>8</duration><voice>1</voice><type>half</type></note>
  </measure></part>
</score-partwise>`;

const previewBootstrap = `(() => {
  'use strict';
  const EXPECTED = Object.freeze({
    previewVersion: '${APP09B_GENERIC_EVENT_PREVIEW_VERSION}',
    rendererSourceRevision: '${APP09B_GENERIC_EVENT_RENDERER_SOURCE_REVISION}',
    rendererContractVersion: '${APP09B_GENERIC_EVENT_RENDERER_CONTRACT_VERSION}',
    rendererPackageName: 'opensheetmusicdisplay',
    rendererPackageVersion: '${APP09B_GENERIC_EVENT_OSMD_VERSION}',
    rendererLicense: 'BSD-3-Clause',
    genericRenderedEventTargetVersion: '1.0.0'
  });
  const root = document.getElementById('st-score-editor-app-root');
  if (!(root instanceof HTMLElement) || !globalThis.STScoreEditorApp) throw new Error('APP09B_GENERIC_EVENT_BOOTSTRAP_UNAVAILABLE');

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
  frame.style.visibility = 'hidden';
  parking.append(frame);

  const nativeReplaceChildren = root.replaceChildren.bind(root);
  const reconcileStableRendererShell = nextApp => {
    const currentApp = root.querySelector(':scope > .stse-app');
    const currentViewport = root.querySelector('[data-st-score-editor-viewport]');
    if (!(currentApp instanceof HTMLElement) || !(currentViewport instanceof HTMLElement) || !currentViewport.contains(frame)) return false;
    if (!(nextApp instanceof HTMLElement) || !nextApp.classList.contains('stse-app')) return false;
    for (const selector of ['.stse-toolbar', '.stse-keypad', '.stse-side', '.stse-status']) {
      const currentNode = currentApp.querySelector(selector);
      const nextNode = nextApp.querySelector(selector);
      if (!(currentNode instanceof HTMLElement) || !(nextNode instanceof HTMLElement)) return false;
      currentNode.replaceWith(nextNode);
    }
    currentApp.className = nextApp.className;
    for (const attribute of [...currentApp.attributes]) {
      if (attribute.name !== 'class' && !nextApp.hasAttribute(attribute.name)) currentApp.removeAttribute(attribute.name);
    }
    for (const attribute of [...nextApp.attributes]) {
      if (attribute.name !== 'class') currentApp.setAttribute(attribute.name, attribute.value);
    }
    currentViewport.setAttribute('data-app09b-exact-renderer-mounted', 'true');
    return true;
  };

  root.replaceChildren = (...nodes) => {
    if (nodes.length === 1 && reconcileStableRendererShell(nodes[0])) {
      document.documentElement.dataset.app09bRendererFrameStable = 'true';
      return;
    }
    if (nodes.length === 0) {
      if (frame.isConnected && root.contains(frame)) parking.append(frame);
      nativeReplaceChildren();
      return;
    }
    if (root.querySelector('[data-st-score-editor-viewport]')?.contains(frame)) {
      throw new Error('APP09B_RENDERER_FRAME_REPARENT_BLOCKED');
    }
    nativeReplaceChildren(...nodes);
    const viewport = root.querySelector('[data-st-score-editor-viewport]');
    if (!(viewport instanceof HTMLElement)) throw new Error('APP09B_RENDERER_VIEWPORT_MISSING');
    viewport.replaceChildren(frame);
    viewport.setAttribute('data-app09b-exact-renderer-mounted', 'true');
    document.documentElement.dataset.app09bRendererFrameStable = 'armed';
  };

  const integrationProfile = Object.freeze({
    family: 'osmd',
    packageName: EXPECTED.rendererPackageName,
    packageVersion: EXPECTED.rendererPackageVersion,
    license: EXPECTED.rendererLicense
  });
  const controller = globalThis.STScoreEditorApp.createController({ rendererProfile: integrationProfile });
  const initialSampleReady = controller.openMusicXml(${JSON.stringify(sampleMusicXml)}, { title: 'APP-09B Generic Event Touch Test' })
    .then(() => { controller.mount(root); });
  Object.defineProperty(globalThis, 'STScoreEditorAppController', { value: controller, writable: false, configurable: false });

  const waitForRendererHost = () => new Promise((resolve, reject) => {
    const started = Date.now();
    const inspect = () => {
      try {
        const host = frame.contentWindow?.__ST_SCORE_RENDER_HOST__;
        if (
          host && typeof host.renderMusicXml === 'function' &&
          typeof host.hitTestRenderedEventDetailed === 'function' &&
          typeof host.hitTestNoteDetailed === 'function' &&
          typeof host.highlight === 'function' && typeof host.dispose === 'function'
        ) {
          resolve(host);
          return;
        }
      } catch {
        // Same-origin renderer may still be booting.
      }
      if (Date.now() - started > 15000) return reject(new Error('APP09B_GENERIC_EVENT_RENDERER_HOST_TIMEOUT'));
      setTimeout(inspect, 50);
    };
    frame.addEventListener('load', inspect, { once: true });
    inspect();
  });

  let rendererApi = null;
  let renderEvidence = null;
  let renderTicket = 0;
  let lastLoadSucceeded = false;
  let lastRenderedRevision = null;
  let lastAttemptRevision = null;
  let renderScheduled = false;

  const mark = (name, value) => { document.documentElement.dataset[name] = value; };
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
        console.error('APP09B generic-event render failed', error);
      }
    });
  };
  controller.subscribe(() => { scheduleRenderCurrent(); });

  waitForRendererHost().then(async api => {
    await initialSampleReady;
    rendererApi = api;
    const host = Object.freeze({
      packageName: EXPECTED.rendererPackageName,
      packageVersion: EXPECTED.rendererPackageVersion,
      license: EXPECTED.rendererLicense,
      instance: Object.freeze({
        async load(musicxml) {
          const ticket = String(++renderTicket);
          const result = await api.renderMusicXml({
            contractVersion: EXPECTED.rendererContractVersion,
            musicxml,
            ticket,
            pageMode: 'continuous',
            autoResize: false,
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
          frame.style.visibility = 'visible';
        },
        clear() {
          renderEvidence = null;
          lastLoadSucceeded = false;
          lastRenderedRevision = null;
          frame.style.visibility = 'hidden';
          mark('app09bRenderStatus', 'stale');
        }
      })
    });
    controller.attachOsmdRenderer(host);

    const onHit = async (clientX, clientY) => {
      const evidence = renderEvidence;
      if (evidence === null) return;
      let hit;
      try {
        hit = api.hitTestRenderedEventDetailed({ clientX, clientY });
      } catch {
        mark('app09bLastHit', 'rejected');
        return;
      }
      const currentEvidence = hit && hit.renderEpoch === evidence.renderEpoch && (hit.sourceId ?? null) === evidence.sourceId;
      if (!currentEvidence) {
        mark('app09bLastHit', 'stale');
        return;
      }
      if (hit.kind !== 'HIT') {
        mark('app09bLastHit', hit?.kind === 'MISS' ? 'miss-' + String(hit.reason).toLowerCase() : 'rejected');
        return;
      }
      try {
        controller.selectRenderedScoreEventRef(hit.target);
        await api.clearHighlights();
        if (hit.target.kind === 'NOTE') {
          const noteTarget = hit.target.voice === undefined
            ? { partId: hit.target.partId, measureIndex: hit.target.measureIndex, noteIndex: hit.target.eventIndex }
            : { partId: hit.target.partId, measureIndex: hit.target.measureIndex, noteIndex: hit.target.eventIndex, voice: hit.target.voice };
          await api.highlight({ target: noteTarget, className: 'st-score-highlight' });
          mark('app09bLastHit', 'selected-note');
        } else {
          mark('app09bLastHit', 'selected-rest');
        }
      } catch (error) {
        console.error('APP09B generic-event selection rejected', error);
        mark('app09bLastHit', 'rejected');
      }
    };

    const childDocument = frame.contentDocument;
    if (childDocument) {
      if ('PointerEvent' in frame.contentWindow) childDocument.addEventListener('pointerup', event => { void onHit(event.clientX, event.clientY); });
      else childDocument.addEventListener('click', event => { void onHit(event.clientX, event.clientY); });
    }

    mark('app09bRendererReady', 'true');
    mark('app09bGenericRenderedEventTargeting', 'true');
    scheduleRenderCurrent();
  }).catch(error => {
    mark('app09bRendererReady', 'false');
    console.error('APP09B generic-event renderer host unavailable', error);
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
<title>ST Score Editor APP-09B Generic Event Test</title>
<style>html,body,#st-score-editor-app-root{margin:0;width:100%;height:100%;min-height:100%;}body{overflow:hidden;overscroll-behavior:none;}@supports(height:100dvh){html,body,#st-score-editor-app-root{height:100dvh;min-height:100dvh;}}</style>
</head>
<body>
<div id="st-score-editor-app-root"></div>
<script src="./st-score-editor-app.js"></script>
<script src="./st-score-editor-app09b-bootstrap.js"></script>
</body>
</html>`;

export async function assembleGenericEventApp09BPreview({ runtimeDir, outputDir = defaultOutputDir } = {}) {
  if (typeof runtimeDir !== 'string' || runtimeDir.length === 0) {
    throw new TypeError('APP09B generic-event renderer runtime directory is required.');
  }
  const runtimeManifestPath = path.join(runtimeDir, 'runtime-manifest.json');
  const manifest = JSON.parse(await readFile(runtimeManifestPath, 'utf8'));
  const renderer = validateGenericEventRendererRuntimeManifest(manifest);
  await assertManifestFiles(runtimeDir, manifest);

  await mkdir(outputDir, { recursive: true });
  const rendererTarget = path.join(outputDir, 'renderer-runtime');
  await rm(rendererTarget, { recursive: true, force: true });
  await cp(runtimeDir, rendererTarget, { recursive: true });

  await writeFile(path.join(outputDir, 'st-score-editor-app09b-bootstrap.js'), previewBootstrap, 'utf8');
  await writeFile(path.join(outputDir, 'st-score-editor-app09b.html'), previewHtml, 'utf8');
  await writeFile(path.join(outputDir, 'app09b-touch-test.musicxml'), sampleMusicXml, 'utf8');

  const previewManifest = Object.freeze({
    contract: 'ST_SCORE_EDITOR_APP09B_GENERIC_EVENT_PREVIEW',
    version: APP09B_GENERIC_EVENT_PREVIEW_VERSION,
    editorArtifact: 'st-score-editor-app.js',
    entryHtml: 'st-score-editor-app09b.html',
    sampleMusicXml: 'app09b-touch-test.musicxml',
    rendererRuntimeDirectory: 'renderer-runtime',
    renderer,
    rendererProfileOverride: Object.freeze({
      family: 'osmd', packageName: 'opensheetmusicdisplay', packageVersion: APP09B_GENERIC_EVENT_OSMD_VERSION, license: 'BSD-3-Clause'
    }),
    genericRenderedEventTargetingBundled: true,
    genericRenderedEventTargetKinds: Object.freeze(['NOTE', 'REST']),
    restTouchPath: 'generic-rendered-rest-target-to-current-semantic-address',
    legacyUniqueRestFallbackBundled: false,
    teacherActionScrollRestoreHackBundled: false,
    rendererImplementationBundledIntoEditorCore: false,
    rendererRuntimeSameOriginIsolated: true,
    interactiveRendererAutoResize: false,
    rendererHitRequiresExactRenderEpoch: true,
    rendererHitRequiresExactSourceId: true,
    rendererDomSvgCoordinateAuthority: false,
    manualDeviceValidationRequired: true,
    standaloneReleaseGatePassed: false,
    seslitabCutoverAuthorized: false
  });
  await writeFile(path.join(outputDir, 'st-score-editor-app09b.manifest.json'), `${JSON.stringify(previewManifest, null, 2)}\n`, 'utf8');
  return previewManifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const runtimeDir = process.env.ST_SCORE_RENDERER_RUNTIME_DIR;
  const result = await assembleGenericEventApp09BPreview({ runtimeDir });
  console.log(`APP-09B generic-event preview assembly: PASS (${result.renderer.rendererSourceRevision}, NOTE+REST exact targeting, no rest fallback/scroll hack)`);
}
