import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP09B_RENDERER_SOURCE_REVISION = 'effc13c82eb1e537773541e5a659f435ecb71583';
export const APP09B_OSMD_VERSION = '2.1.2';
export const APP09B_RENDERER_CONTRACT_VERSION = '0.2.0';
export const APP09B_PREVIEW_VERSION = '1.0.0';
export const APP09B_CORRECTION_ENGINE_SOURCE_REVISION = 'bdaeb1e6fec8aee27d1cc72347f5be735af3cf30';
export const APP09B_CORRECTION_ANALYSIS_CONTRACT = 'ST_OMR_CORRECTION_ENGINE_ANALYSIS_BROWSER';
export const APP09B_CORRECTION_ANALYSIS_CONTRACT_VERSION = '1.0.0';

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

async function validateCorrectionAnalysisRuntime(runtimeDir) {
  const manifestPath = path.join(runtimeDir, 'ce-analysis-browser-runtime.manifest.json');
  const artifactPath = path.join(runtimeDir, 'ce-analysis-browser-runtime.js');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!isRecord(manifest)) throw new TypeError('APP09B correction analysis manifest must be an object.');
  if (
    manifest.contract !== APP09B_CORRECTION_ANALYSIS_CONTRACT ||
    manifest.contractVersion !== APP09B_CORRECTION_ANALYSIS_CONTRACT_VERSION ||
    manifest.runtimeVersion !== APP09B_CORRECTION_ANALYSIS_CONTRACT_VERSION
  ) throw new Error('APP09B correction analysis contract/version mismatch.');
  if (manifest.engineSourceRevision !== APP09B_CORRECTION_ENGINE_SOURCE_REVISION) {
    throw new Error('APP09B correction analysis engine revision mismatch.');
  }
  if (
    manifest.artifact !== 'ce-analysis-browser-runtime.js' ||
    manifest.global !== 'STOmrCorrectionAnalysisRuntime' ||
    manifest.format !== 'iife' ||
    manifest.target !== 'es2022' ||
    manifest.externalImports !== 0
  ) throw new Error('APP09B correction analysis export surface mismatch.');
  for (const field of [
    'networkCapable',
    'persistenceCapable',
    'authenticationAuthority',
    'automaticApplyAuthority',
    'learningAuthority',
    'musicXmlWriteBackAuthority'
  ]) {
    if (manifest[field] !== false) throw new Error(`APP09B correction analysis forbidden authority enabled: ${field}.`);
  }
  const artifact = await readFile(artifactPath);
  if (!Number.isInteger(manifest.bytes) || manifest.bytes !== artifact.byteLength) {
    throw new Error('APP09B correction analysis artifact byte size mismatch.');
  }
  const digest = createHash('sha256').update(artifact).digest('hex');
  if (manifest.sha256 !== digest) throw new Error('APP09B correction analysis artifact digest mismatch.');
  return Object.freeze({
    enabled: true,
    engineSourceRevision: manifest.engineSourceRevision,
    contract: manifest.contract,
    contractVersion: manifest.contractVersion,
    runtimeVersion: manifest.runtimeVersion,
    artifact: manifest.artifact,
    sha256: manifest.sha256,
    automaticApplyAuthority: false,
    musicXmlWriteBackAuthority: false
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
  frame.style.visibility = 'hidden';
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
        if (
          host &&
          typeof host.renderMusicXml === 'function' &&
          typeof host.hitTestNoteDetailed === 'function' &&
          typeof host.highlight === 'function' &&
          typeof host.highlightMeasure === 'function' &&
          typeof host.clearMeasureHighlights === 'function' &&
          typeof host.dispose === 'function'
        ) {
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
  let lastLoadSucceeded = false;
  let lastRenderedRevision = null;
  let lastAttemptRevision = null;
  let renderScheduled = false;
  let suspiciousMeasureState = null;
  let correctionAnalysisState = null;
  let correctionInputState = null;

  const mark = (name, value) => {
    document.documentElement.dataset[name] = value;
  };

  const isBoundedId = (value) => typeof value === 'string' && value.length > 0 && value.length <= 256 && value === value.trim();

  const applySuspiciousMeasureFindings = async (input) => {
    const documentState = controller.getDocument?.();
    const score = documentState?.session?.history?.present?.score;
    const current = input?.current;
    const evidence = renderEvidence;
    if (
      rendererApi === null ||
      evidence === null ||
      !score ||
      !current ||
      current.documentId !== score.id ||
      current.revisionId !== score.revision.id ||
      current.renderEpoch !== evidence.renderEpoch ||
      (current.sourceId ?? null) !== evidence.sourceId ||
      !Array.isArray(input?.findings)
    ) {
      throw new Error('APP09B_SUSPICIOUS_MEASURE_PRESENTATION_MISMATCH');
    }

    const unique = new Map();
    for (const finding of input.findings) {
      if (
        !finding ||
        finding.documentId !== current.documentId ||
        finding.revisionId !== current.revisionId ||
        finding.renderEpoch !== current.renderEpoch ||
        (finding.sourceId ?? null) !== (current.sourceId ?? null) ||
        !Array.isArray(finding.measureTargets) ||
        finding.measureTargets.length !== 1
      ) continue;
      const target = finding.measureTargets[0];
      if (
        !target ||
        !isBoundedId(target.partId) ||
        !Number.isSafeInteger(target.measureIndex) ||
        target.measureIndex < 0
      ) continue;
      unique.set(target.partId + '\\u0000' + target.measureIndex, Object.freeze({
        partId: target.partId,
        measureIndex: target.measureIndex
      }));
    }

    const targets = Object.freeze([...unique.values()].sort((left, right) =>
      left.partId === right.partId
        ? left.measureIndex - right.measureIndex
        : left.partId.localeCompare(right.partId)
    ));
    await rendererApi.clearMeasureHighlights();
    try {
      for (const target of targets) {
        await rendererApi.highlightMeasure({ target, className: 'st-score-suspicious-measure' });
      }
    } catch (error) {
      suspiciousMeasureState = null;
      try { await rendererApi.clearMeasureHighlights(); } catch {}
      throw error;
    }
    suspiciousMeasureState = Object.freeze({
      documentId: current.documentId,
      revisionId: current.revisionId,
      renderEpoch: current.renderEpoch,
      ...(current.sourceId === undefined ? {} : { sourceId: current.sourceId }),
      targets
    });
    return suspiciousMeasureState;
  };

  const clearSuspiciousMeasureHighlights = async () => {
    suspiciousMeasureState = null;
    if (rendererApi !== null) await rendererApi.clearMeasureHighlights();
  };

  Object.defineProperty(globalThis, 'STScoreCorrectionHighlightBridge', {
    value: Object.freeze({
      applyFindings: applySuspiciousMeasureFindings,
      clear: clearSuspiciousMeasureHighlights,
      getState: () => suspiciousMeasureState
    }),
    writable: false,
    configurable: false
  });

  const waitForCurrentRender = async (revisionId) => {
    const started = Date.now();
    while (Date.now() - started <= 15000) {
      const renderer = controller.getRendererState?.();
      if (
        renderer?.renderedRevisionId === revisionId &&
        renderer?.status?.code === 'RENDERED_CURRENT_REVISION' &&
        renderEvidence !== null
      ) return renderEvidence;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error('APP09B_CORRECTION_RENDER_TIMEOUT');
  };

  const analyzeMusicXmlAndHighlight = async (musicxml) => {
    const revisionId = controller.getSnapshot().revisionId;
    if (
      correctionInputState === null ||
      correctionInputState.revisionId !== revisionId ||
      correctionInputState.musicxml !== musicxml
    ) throw new Error('APP09B_CORRECTION_INPUT_REVISION_MISMATCH');
    const runtime = globalThis.STOmrCorrectionAnalysisRuntime;
    if (!runtime || typeof runtime.analyzeMusicXmlSuspiciousMeasures !== 'function') {
      throw new Error('APP09B_CORRECTION_ANALYSIS_RUNTIME_UNAVAILABLE');
    }
    const analysis = runtime.analyzeMusicXmlSuspiciousMeasures({
      musicxml,
      sourceId: 'app09b-current-musicxml'
    });
    if (
      !analysis ||
      analysis.mode !== 'SHADOW_ONLY' ||
      analysis.automaticApplyAuthority !== false ||
      analysis.musicXmlWriteBackAuthority !== false ||
      analysis.unmappedFindingCount !== 0 ||
      !isBoundedId(analysis.partId) ||
      !Number.isSafeInteger(analysis.measureCount) ||
      analysis.measureCount < 1 ||
      !Array.isArray(analysis.suspiciousMeasures)
    ) throw new Error('APP09B_CORRECTION_ANALYSIS_AUTHORITY_REJECTED');

    const documentState = controller.getDocument?.();
    const score = documentState?.session?.history?.present?.score;
    const evidence = renderEvidence;
    if (!score || evidence === null) throw new Error('APP09B_CORRECTION_PRESENTATION_UNAVAILABLE');
    const current = Object.freeze({
      documentId: score.id,
      revisionId: score.revision.id,
      renderEpoch: evidence.renderEpoch,
      ...(evidence.sourceId === null ? {} : { sourceId: evidence.sourceId })
    });
    const findings = analysis.suspiciousMeasures.map((item, index) => {
      if (
        !item ||
        !Number.isSafeInteger(item.measureIndex) ||
        item.measureIndex < 0 ||
        item.measureIndex >= analysis.measureCount
      ) {
        throw new Error('APP09B_CORRECTION_MEASURE_MAPPING_INVALID');
      }
      return Object.freeze({
        findingId: Array.isArray(item.findingIds) && isBoundedId(item.findingIds[0])
          ? item.findingIds[0]
          : 'ce-measure-' + item.measureIndex + '-' + index,
        ...current,
        measureTargets: Object.freeze([Object.freeze({
          partId: analysis.partId,
          measureIndex: item.measureIndex
        })])
      });
    });
    const beforeHistory = documentState.session.history;
    const before = Object.freeze({
      revisionId: beforeHistory.present.score.revision.id,
      pastLength: beforeHistory.past.length,
      futureLength: beforeHistory.future.length
    });
    const presentation = await applySuspiciousMeasureFindings({ current, findings });
    const afterDocument = controller.getDocument?.();
    const afterHistory = afterDocument?.session?.history;
    const presentationInvariant = Object.freeze({
      revisionUnchanged: afterHistory?.present?.score?.revision?.id === before.revisionId,
      historyUnchanged:
        afterHistory?.past?.length === before.pastLength &&
        afterHistory?.future?.length === before.futureLength
    });
    if (!presentationInvariant.revisionUnchanged || !presentationInvariant.historyUnchanged) {
      throw new Error('APP09B_CORRECTION_PRESENTATION_MUTATED_HISTORY');
    }
    correctionAnalysisState = Object.freeze({ analysis, presentation, presentationInvariant });
    mark('app09bCorrectionStatus', 'applied');
    return correctionAnalysisState;
  };

  const openMusicXmlWithCorrectionAnalysis = async (musicxml, options = {}) => {
    const openResult = await controller.openMusicXml(musicxml, options);
    if (openResult?.error) return Object.freeze({ openResult, analysis: null, analysisError: null });
    const revisionId = controller.getSnapshot().revisionId;
    correctionInputState = Object.freeze({ revisionId, musicxml });
    try {
      scheduleRenderCurrent();
      await waitForCurrentRender(revisionId);
      const analysis = await analyzeMusicXmlAndHighlight(musicxml);
      return Object.freeze({ openResult, analysis, analysisError: null });
    } catch (error) {
      correctionAnalysisState = null;
      mark('app09bCorrectionStatus', 'APP09B_CORRECTION_ANALYSIS_FAILED');
      try { await clearSuspiciousMeasureHighlights(); } catch {}
      return Object.freeze({
        openResult,
        analysis: null,
        analysisError: String(error?.message ?? error)
      });
    }
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
          suspiciousMeasureState = null;
          correctionAnalysisState = null;
          lastLoadSucceeded = true;
        },
        render() {
          if (!lastLoadSucceeded) throw new Error('APP09B_RENDER_WITHOUT_SUCCESSFUL_LOAD');
          frame.style.visibility = 'visible';
        },
        getRenderEvidence() {
          return renderEvidence;
        },
        async highlightMeasure(highlight) {
          return api.highlightMeasure(highlight);
        },
        async clearMeasureHighlights() {
          return api.clearMeasureHighlights();
        },
        clear() {
          renderEvidence = null;
          suspiciousMeasureState = null;
          correctionAnalysisState = null;
          correctionInputState = null;
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
      analyzeMusicXmlAndHighlight,
      openMusicXmlWithCorrectionAnalysis,
      clearCorrectionHighlights: clearSuspiciousMeasureHighlights,
      getState: () => Object.freeze({
        snapshot: controller.getSnapshot(),
        renderer: controller.getRendererState(),
        renderEvidence,
        suspiciousMeasures: suspiciousMeasureState,
        correctionAnalysis: correctionAnalysisState
      })
    }),
    writable: false,
    configurable: false
  });
})();
`;

const previewHtml = (correctionEnabled) => `<!doctype html>
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
${correctionEnabled ? '<script src="./correction-runtime/ce-analysis-browser-runtime.js"></script>' : ''}
<script src="./st-score-editor-app09b-bootstrap.js"></script>
</body>
</html>
`;

export async function assembleApp09BPreview({ runtimeDir, correctionRuntimeDir = null, outputDir = defaultOutputDir } = {}) {
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

  let correctionAnalysis = Object.freeze({ enabled: false });
  const correctionTarget = path.join(outputDir, 'correction-runtime');
  await rm(correctionTarget, { recursive: true, force: true });
  if (correctionRuntimeDir !== null) {
    if (typeof correctionRuntimeDir !== 'string' || correctionRuntimeDir.length === 0) {
      throw new TypeError('APP09B correction runtime directory must be a non-empty string when provided.');
    }
    correctionAnalysis = await validateCorrectionAnalysisRuntime(correctionRuntimeDir);
    await cp(correctionRuntimeDir, correctionTarget, { recursive: true });
  }

  await writeFile(path.join(outputDir, 'st-score-editor-app09b-bootstrap.js'), previewBootstrap, 'utf8');
  await writeFile(path.join(outputDir, 'st-score-editor-app09b.html'), previewHtml(correctionAnalysis.enabled), 'utf8');
  await writeFile(path.join(outputDir, 'app09b-touch-test.musicxml'), sampleMusicXml, 'utf8');

  const previewManifest = Object.freeze({
    contract: 'ST_SCORE_EDITOR_APP09B_PREVIEW',
    version: APP09B_PREVIEW_VERSION,
    editorArtifact: 'st-score-editor-app.js',
    entryHtml: 'st-score-editor-app09b.html',
    sampleMusicXml: 'app09b-touch-test.musicxml',
    rendererRuntimeDirectory: 'renderer-runtime',
    renderer,
    correctionAnalysis,
    rendererProfileOverride: Object.freeze({
      family: 'osmd', packageName: 'opensheetmusicdisplay', packageVersion: APP09B_OSMD_VERSION, license: 'BSD-3-Clause'
    }),
    rendererImplementationBundledIntoEditorCore: false,
    rendererRuntimeSameOriginIsolated: true,
    interactiveRendererAutoResize: false,
    resizeOrientationControlledRendererRerender: true,
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
  const correctionRuntimeDir = process.env.ST_OMR_CORRECTION_ANALYSIS_RUNTIME_DIR ?? null;
  const result = await assembleApp09BPreview({ runtimeDir, correctionRuntimeDir });
  console.log(`APP-09B preview assembly: PASS (${result.renderer.rendererSourceRevision}, OSMD ${result.renderer.osmdVersion}, autoResize=false controlled-host)`);
}
