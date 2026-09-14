import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const OUT_DIR = 'dist/browser';
const ARTIFACT = 'st-score-editor-professional.js';
const MANIFEST_FILE = 'st-score-editor-professional.manifest.json';
const ENTRY_HTML = 'st-score-editor-professional.html';
const GLOBAL_NAME = 'STScoreEditorProfessionalApp';
const PROFESSIONAL_APP_BUNDLE_MAX_BYTES = 615_000;
const PROFESSIONAL_APP_BUNDLE_BUDGET_REVISION = 'P08-E4-QUALIFIED-1';
const DEFAULT_APP_BUNDLE_MAX_BYTES = 542_720;
const DEFAULT_APP_BUNDLE_BUDGET_REVISION = 'P06-AUDIO-V010-1';
const FORBIDDEN_TOKENS = [
  'node:',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'navigator.sendBeacon',
  'localStorage',
  'sessionStorage',
  'document.cookie'
];

await mkdir(OUT_DIR, { recursive: true });

const defaultManifest = JSON.parse(await readFile(`${OUT_DIR}/st-score-editor-app.manifest.json`, 'utf8'));
if (
  defaultManifest.maxBytes !== DEFAULT_APP_BUNDLE_MAX_BYTES ||
  defaultManifest.bundleBudgetRevision !== DEFAULT_APP_BUNDLE_BUDGET_REVISION
) {
  throw new Error(
    `P08-E4 refuses a silent default-app budget change: ${defaultManifest.maxBytes}/${defaultManifest.bundleBudgetRevision}`
  );
}

const outFile = `${OUT_DIR}/${ARTIFACT}`;
const result = await build({
  entryPoints: ['packages/score-editor-browser-professional-app-v1/src/global-entry.ts'],
  outfile: outFile,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2022'],
  minify: true,
  sourcemap: false,
  legalComments: 'eof',
  metafile: true,
  logLevel: 'warning'
});

const externalImports = Object.values(result.metafile.outputs)
  .flatMap((output) => output.imports)
  .filter((entry) => entry.external === true);
if (externalImports.length !== 0) {
  throw new Error(`P08-E4 professional browser bundle contains external imports: ${JSON.stringify(externalImports)}`);
}

const bundle = await readFile(outFile);
const text = bundle.toString('utf8');
for (const token of FORBIDDEN_TOKENS) {
  if (text.includes(token)) {
    throw new Error(`P08-E4 professional browser bundle contains forbidden capability token: ${token}`);
  }
}
if (!text.includes(GLOBAL_NAME)) {
  throw new Error(`P08-E4 professional browser bundle does not expose ${GLOBAL_NAME}.`);
}
if (bundle.byteLength > PROFESSIONAL_APP_BUNDLE_MAX_BYTES) {
  throw new Error(
    `P08-E4 professional browser bundle exceeds qualification budget: ${bundle.byteLength} > ${PROFESSIONAL_APP_BUNDLE_MAX_BYTES}`
  );
}

const sha256 = createHash('sha256').update(bundle).digest('hex');
const manifest = Object.freeze({
  contract: 'ST_SCORE_EDITOR_PROFESSIONAL_BROWSER_BUNDLE',
  version: '1.0.0',
  runtimeVersion: '1.0.0',
  artifactClass: 'optional-professional-browser-surface',
  artifact: ARTIFACT,
  format: 'iife',
  target: 'es2022',
  global: GLOBAL_NAME,
  entryHtml: ENTRY_HTML,
  bundler: Object.freeze({ package: 'esbuild', version: '0.28.2', license: 'MIT' }),
  externalImports: 0,
  bundleBudgetRevision: PROFESSIONAL_APP_BUNDLE_BUDGET_REVISION,
  maxBytes: PROFESSIONAL_APP_BUNDLE_MAX_BYTES,
  bytes: bundle.byteLength,
  sha256,
  productionDefault: false,
  replacesDefaultApp: false,
  defaultAppBundleBudgetModified: false,
  defaultAppBundleMaxBytes: DEFAULT_APP_BUNDLE_MAX_BYTES,
  defaultAppBundleBudgetRevision: DEFAULT_APP_BUNDLE_BUDGET_REVISION,
  canonicalAuthority: false,
  historyAuthority: 'EditorHistoryV4',
  semanticTargetAuthority: 'SemanticAddressV3-current-revision',
  professionalRangeToolbarBundled: true,
  professionalStructureInspectorBundled: true,
  rangeMutationAuthority: 'P08-D-professional-workstation',
  structureMutationAuthority: 'P08-D-professional-workstation',
  minimumTouchTargetPx: 44,
  networkAuthority: false,
  rendererCoordinateAuthority: false,
  domAuthoringAuthority: false,
  audioEngineBundled: false,
  audioHostIntegrated: false,
  physicalDeviceValidationRequired: true,
  physicalDeviceValidationPassed: false,
  productionReleaseAuthorized: false,
  seslitabCutoverAuthorized: false
});
await writeFile(`${OUT_DIR}/${MANIFEST_FILE}`, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>ST Score Editor Professional Qualification</title>
<style>html,body,#st-score-editor-professional-root{margin:0;width:100%;height:100%;min-height:100%;}body{overflow:hidden;overscroll-behavior:none;}@supports(height:100dvh){html,body,#st-score-editor-professional-root{height:100dvh;min-height:100dvh;}}</style>
</head>
<body>
<div id="st-score-editor-professional-root"></div>
<script src="./${ARTIFACT}"></script>
<script>
(() => {
  const root = document.getElementById('st-score-editor-professional-root');
  const controller = globalThis.${GLOBAL_NAME}.createController();
  controller.mount(root);
  globalThis.STScoreEditorProfessionalAppController = controller;
})();
</script>
</body>
</html>\n`;
await writeFile(`${OUT_DIR}/${ENTRY_HTML}`, html, 'utf8');

console.log(
  `P08-E4 professional browser bundle: PASS (${manifest.bytes} bytes, max ${manifest.maxBytes}, sha256 ${manifest.sha256})`
);