#!/usr/bin/env bash
set -euo pipefail

readonly RENDERER_REVISION="effc13c82eb1e537773541e5a659f435ecb71583"
readonly CORRECTION_REVISION="bdaeb1e6fec8aee27d1cc72347f5be735af3cf30"
readonly WORK_ROOT="${RUNNER_TEMP:-/tmp}/ses-111-correction-e2e"
readonly RENDERER_ROOT="${WORK_ROOT}/st-score-rendering-layer"
readonly CORRECTION_ROOT="${WORK_ROOT}/st-omr-correction-engine"
readonly AUDIO_ROOT="${WORK_ROOT}/st-score-audio-runtime"
readonly SERVER_LOG="${WORK_ROOT}/app09b-server.log"

rm -rf "${WORK_ROOT}"
mkdir -p "${WORK_ROOT}"

bash scripts/setup-editor-webkit-ci.sh
node node_modules/playwright/cli.js install --with-deps chromium
npm run build:browser

git clone --filter=blob:none https://github.com/khfy7wpr5p-maker/st-score-rendering-layer.git "${RENDERER_ROOT}"
git -C "${RENDERER_ROOT}" checkout --detach "${RENDERER_REVISION}"
(
  cd "${RENDERER_ROOT}"
  npm install --ignore-scripts --no-audit --no-fund --no-package-lock
  ST_SCORE_RENDERER_SOURCE_REVISION="${RENDERER_REVISION}" npm run export:workstation-runtime
)

git clone --filter=blob:none https://github.com/khfy7wpr5p-maker/st-omr-correction-engine.git "${CORRECTION_ROOT}"
git -C "${CORRECTION_ROOT}" checkout --detach "${CORRECTION_REVISION}"
(
  cd "${CORRECTION_ROOT}"
  npm install --ignore-scripts --no-audit --no-fund --package-lock=false
  npm run build:ce-analysis-browser
)

ST_SCORE_RENDERER_RUNTIME_DIR="${RENDERER_ROOT}/dist/workstation-runtime" \
CORRECTION_ROOT="${CORRECTION_ROOT}" \
node --input-type=module <<'NODE'
import { readFile } from 'node:fs/promises';
import { assembleStableApp09BPreviewCli } from './scripts/assemble-app09b-preview-stable.mjs';

const correctionRoot = process.env.CORRECTION_ROOT;
const manifest = JSON.parse(await readFile(
  correctionRoot + '/dist/browser-analysis/ce-analysis-browser-runtime.manifest.json',
  'utf8'
));
const artifact = await readFile(
  correctionRoot + '/dist/browser-analysis/ce-analysis-browser-runtime.js'
);
await assembleStableApp09BPreviewCli({
  runtimeDir: process.env.ST_SCORE_RENDERER_RUNTIME_DIR,
  correctionRuntime: { manifest, artifact }
});
NODE

PORT=10080 node scripts/serve-app09b-preview.mjs > "${SERVER_LOG}" 2>&1 &
server_pid=$!
cleanup() {
  if kill -0 "${server_pid}" 2>/dev/null; then
    kill "${server_pid}" || true
    wait "${server_pid}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

for _ in $(seq 1 30); do
  if curl --fail --silent --show-error "http://127.0.0.1:10080/st-score-editor-app09b.html" > /dev/null; then
    break
  fi
  sleep 0.2
done
curl --fail --silent --show-error "http://127.0.0.1:10080/st-score-editor-app09b.html" > /dev/null

ST_CE_E2E_BROWSER=webkit node scripts/ses111-correction-analysis-e2e.mjs
ST_CE_E2E_BROWSER=chromium node scripts/ses111-correction-analysis-e2e.mjs

mkdir -p "${AUDIO_ROOT}"
cat > "${AUDIO_ROOT}/st-score-audio-engine.js" <<'EOF'
globalThis.STScoreAudioEngine = Object.freeze({
  version: '0.1.2',
  createAudioEngine() {
    return Object.freeze({
      prepare: async () => {},
      setInstrument: async () => {},
      audition: async () => Object.freeze({ ok: true })
    });
  }
});
EOF

ST_SCORE_RENDERER_RUNTIME_DIR="${RENDERER_ROOT}/dist/workstation-runtime" \
ST_SCORE_AUDIO_RUNTIME_DIR="${AUDIO_ROOT}" \
CORRECTION_ROOT="${CORRECTION_ROOT}" \
node --input-type=module <<'NODE'
import { readFile } from 'node:fs/promises';
import { assembleProductionSite } from './scripts/assemble-production-site.mjs';

const correctionRoot = process.env.CORRECTION_ROOT;
const manifest = JSON.parse(await readFile(
  correctionRoot + '/dist/browser-analysis/ce-analysis-browser-runtime.manifest.json',
  'utf8'
));
const artifact = await readFile(
  correctionRoot + '/dist/browser-analysis/ce-analysis-browser-runtime.js'
);
await assembleProductionSite({
  runtimeDir: process.env.ST_SCORE_RENDERER_RUNTIME_DIR,
  audioRuntimeDir: process.env.ST_SCORE_AUDIO_RUNTIME_DIR,
  correctionRuntime: { manifest, artifact },
  outputDir: 'dist/browser',
  refreshRendererRuntime: false
});
NODE

ST_CE_E2E_BROWSER=webkit ST_CE_E2E_MODE=production ST_CE_E2E_ENTRY=index.html \
  node scripts/ses111-correction-analysis-e2e.mjs
ST_CE_E2E_BROWSER=chromium ST_CE_E2E_MODE=production ST_CE_E2E_ENTRY=index.html \
  node scripts/ses111-correction-analysis-e2e.mjs
