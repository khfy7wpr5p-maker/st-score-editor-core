import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const OUT_DIR = 'dist/browser';
const ARTIFACT = 'st-score-editor-professional-workstation.js';
const MANIFEST_FILE = 'st-score-editor-professional-workstation.manifest.json';
const ENTRY_HTML = 'st-score-editor-professional-workstation.html';
const GLOBAL_NAME = 'STScoreEditorProfessionalWorkstation';
const MAX_BYTES = 604_160;
const BUDGET_REVISION = 'P10-1-COMPOSITION-1';
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

const RETAINED = Object.freeze({
  defaultApp: Object.freeze({ file: 'st-score-editor-app.manifest.json', maxBytes: 542_720, revision: 'P06-AUDIO-V010-1' }),
  p08Professional: Object.freeze({ file: 'st-score-editor-professional.manifest.json', maxBytes: 615_000, revision: 'P08-E4-QUALIFIED-1' }),
  p09Keyboard: Object.freeze({ file: 'st-score-editor-keyboard-workstation.manifest.json', maxBytes: 552_960, revision: 'P09-D-QUALIFIED-1' })
});

await mkdir(OUT_DIR, { recursive: true });

for (const [name, expected] of Object.entries(RETAINED)) {
  const manifest = JSON.parse(await readFile(`${OUT_DIR}/${expected.file}`, 'utf8'));
  if (manifest.maxBytes !== expected.maxBytes || manifest.bundleBudgetRevision !== expected.revision) {
    throw new Error(
      `P10-1 refuses a silent ${name} budget change: ${manifest.maxBytes}/${manifest.bundleBudgetRevision}`
    );
  }
}

const outFile = `${OUT_DIR}/${ARTIFACT}`;
const result = await build({
  entryPoints: ['packages/score-editor-browser-professional-workstation-v1/src/global-entry.ts'],
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
  .flatMap(output => output.imports)
  .filter(entry => entry.external === true);
if (externalImports.length !== 0) {
  throw new Error(`P10-1 professional workstation bundle contains external imports: ${JSON.stringify(externalImports)}`);
}

const bundle = await readFile(outFile);
const text = bundle.toString('utf8');
for (const token of FORBIDDEN_TOKENS) {
  if (text.includes(token)) {
    throw new Error(`P10-1 professional workstation bundle contains forbidden capability token: ${token}`);
  }
}
if (!text.includes(GLOBAL_NAME)) {
  throw new Error(`P10-1 professional workstation bundle does not expose ${GLOBAL_NAME}.`);
}
if (bundle.byteLength > MAX_BYTES) {
  throw new Error(
    `P10-1 professional workstation bundle exceeds bounded budget: ${bundle.byteLength} > ${MAX_BYTES}`
  );
}

const sha256 = createHash('sha256').update(bundle).digest('hex');
const manifest = Object.freeze({
  contract: 'ST_SCORE_EDITOR_P10_1_PROFESSIONAL_WORKSTATION_BUNDLE',
  version: '1.0.0',
  artifactClass: 'optional-professional-workstation-composition',
  artifact: ARTIFACT,
  format: 'iife',
  target: 'es2022',
  global: GLOBAL_NAME,
  entryHtml: ENTRY_HTML,
  bundler: Object.freeze({ package: 'esbuild', version: '0.28.2', license: 'MIT' }),
  externalImports: 0,
  bundleBudgetRevision: BUDGET_REVISION,
  maxBytes: MAX_BYTES,
  bytes: bundle.byteLength,
  sha256,
  retainedBudgets: Object.freeze({
    defaultApp: Object.freeze({
      maxBytes: RETAINED.defaultApp.maxBytes,
      bundleBudgetRevision: RETAINED.defaultApp.revision
    }),
    p08Professional: Object.freeze({
      maxBytes: RETAINED.p08Professional.maxBytes,
      bundleBudgetRevision: RETAINED.p08Professional.revision
    }),
    p09Keyboard: Object.freeze({
      maxBytes: RETAINED.p09Keyboard.maxBytes,
      bundleBudgetRevision: RETAINED.p09Keyboard.revision
    })
  }),
  canonicalAuthority: false,
  historyAuthority: 'EditorHistoryV4',
  semanticTargetAuthority: 'SemanticAddressV3-current-revision',
  p08ProfessionalBundled: true,
  p09KeyboardBundled: true,
  app10AuthoringAvailable: true,
  app11AuthoringAvailable: true,
  rendererIntegrated: true,
  audioHostIntegrated: true,
  audioEngineBundled: false,
  externalAudioRuntimeRequired: true,
  rendererCoordinateAuthority: false,
  domAuthoringAuthority: false,
  keyboardCursorAuthority: false,
  professionalSelectionCanonicalAuthority: false,
  productionDefault: false,
  replacesDefaultApp: false,
  productionReleaseAuthorized: false,
  seslitabCutoverAuthorized: false,
  physicalDeviceValidationRequired: true,
  physicalDeviceValidationPassed: false
});
await writeFile(`${OUT_DIR}/${MANIFEST_FILE}`, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>ST Score Editor Professional Workstation Qualification</title>
<style>html,body,#st-score-editor-professional-workstation-root{margin:0;width:100%;height:100%;min-height:100%;}body{overflow:hidden;overscroll-behavior:none;}@supports(height:100dvh){html,body,#st-score-editor-professional-workstation-root{height:100dvh;min-height:100dvh;}}</style>
</head>
<body>
<div id="st-score-editor-professional-workstation-root"></div>
<script src="./${ARTIFACT}"></script>
<script>
(() => {
  const root = document.getElementById('st-score-editor-professional-workstation-root');
  const controller = globalThis.${GLOBAL_NAME}.createController();
  controller.mount(root);
  Object.defineProperty(globalThis, 'STScoreEditorProfessionalWorkstationController', {
    value: controller,
    writable: false,
    configurable: false
  });
})();
</script>
</body>
</html>\n`;
await writeFile(`${OUT_DIR}/${ENTRY_HTML}`, html, 'utf8');

console.log(
  `P10-1 professional workstation bundle: PASS (${manifest.bytes} bytes, max ${manifest.maxBytes}, sha256 ${manifest.sha256})`
);
