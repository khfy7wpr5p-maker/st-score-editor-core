import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleStableApp09BPreviewCli } from './assemble-app09b-preview-stable.mjs';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const defaultOutputDir = path.join(repoRoot, 'dist', 'browser');

const legacyMissGuard = `      if (hit.kind === 'MISS') {
        if (hit.reason !== 'NO_NOTE_OWNER') {
          mark('app09bLastHit', 'miss');
          return;
        }
        try {`;

const hardenedMissGuard = `      if (hit.kind === 'MISS') {
        const childDocument = frame.contentDocument;
        const ChildElement = childDocument?.defaultView?.Element;
        const initialElement = childDocument?.elementFromPoint?.(clientX, clientY) ?? null;
        let currentElement = ChildElement && initialElement instanceof ChildElement ? initialElement : null;
        let renderedStaveEntry = false;
        while (currentElement !== null) {
          if (currentElement.classList?.contains('vf-stavenote')) {
            renderedStaveEntry = true;
            break;
          }
          currentElement = currentElement.parentElement;
        }
        const boundedUnmappedRestEvidence = hit.reason === 'UNMAPPED_ELEMENT' && renderedStaveEntry;
        if (hit.reason !== 'NO_NOTE_OWNER' && !boundedUnmappedRestEvidence) {
          mark('app09bLastHit', 'miss-' + String(hit.reason).toLowerCase());
          return;
        }
        try {`;

const legacySelectedRestMark = `            mark('app09bLastHit', 'selected-rest');`;
const hardenedSelectedRestMark = `            mark('app09bLastHit', 'selected-rest-' + String(hit.reason).toLowerCase());`;

export const hardenStableRestTouchEvidence = (bootstrap) => {
  const guardOccurrences = bootstrap.split(legacyMissGuard).length - 1;
  if (guardOccurrences !== 1) {
    throw new Error(`APP09B rest-touch v2 expected one legacy MISS guard, observed ${guardOccurrences}.`);
  }
  const selectedOccurrences = bootstrap.split(legacySelectedRestMark).length - 1;
  if (selectedOccurrences !== 1) {
    throw new Error(`APP09B rest-touch v2 expected one selected-rest marker, observed ${selectedOccurrences}.`);
  }
  return bootstrap
    .replace(legacyMissGuard, hardenedMissGuard)
    .replace(legacySelectedRestMark, hardenedSelectedRestMark);
};

export async function assembleStableRestV2PreviewCli({
  runtimeDir,
  outputDir = defaultOutputDir,
  includeIosDiagnostic = process.env.ST_APP09B_IOS_DEVICE_DIAGNOSTIC === '1',
  refreshRendererRuntime = process.env.ST_APP09B_REFRESH_RENDERER_RUNTIME === '1'
} = {}) {
  const result = await assembleStableApp09BPreviewCli({
    runtimeDir,
    outputDir,
    includeIosDiagnostic,
    refreshRendererRuntime
  });
  const bootstrapPath = path.join(outputDir, 'st-score-editor-app09b-bootstrap.js');
  const bootstrap = await readFile(bootstrapPath, 'utf8');
  const hardened = hardenStableRestTouchEvidence(bootstrap);
  await writeFile(bootstrapPath, hardened, 'utf8');
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const runtimeDir = process.env.ST_SCORE_RENDERER_RUNTIME_DIR;
  const includeIosDiagnostic = process.env.ST_APP09B_IOS_DEVICE_DIAGNOSTIC === '1';
  const refreshRendererRuntime = process.env.ST_APP09B_REFRESH_RENDERER_RUNTIME === '1';
  const result = await assembleStableRestV2PreviewCli({ runtimeDir, includeIosDiagnostic, refreshRendererRuntime });
  const source = refreshRendererRuntime ? 'refreshed exact renderer' : 'provided renderer';
  console.log(`APP-09B stable rest-touch v2 assembly: PASS (${result.renderer.rendererSourceRevision}, OSMD ${result.renderer.osmdVersion}, ${source}, unique-rest fail-closed)`);
}
