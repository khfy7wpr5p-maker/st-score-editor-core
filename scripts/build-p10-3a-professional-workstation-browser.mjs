import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const OUT_DIR = 'dist/browser';
const ARTIFACT = 'st-score-editor-p10-3a-workstation.js';
const MANIFEST_FILE = 'st-score-editor-p10-3a-workstation.manifest.json';
const ENTRY_HTML = 'st-score-editor-p10-3a-workstation.html';
const GLOBAL_NAME = 'STScoreEditorP10_3AWorkstation';
const MAX_BYTES = 655_360;
const BUDGET_REVISION = 'P10-3A-PITCH-TRANSPOSE-1';
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

const P10_1_RETAINED = Object.freeze({
  file: 'st-score-editor-professional-workstation.manifest.json',
  maxBytes: 604_160,
  revision: 'P10-1-COMPOSITION-1'
});
const P10_2_RETAINED = Object.freeze({
  file: 'st-score-editor-p10-2-workstation.manifest.json',
  maxBytes: 624_640,
  revision: 'P10-2-UNRETIMING-1'
});

await mkdir(OUT_DIR, { recursive: true });

const p10_1Manifest = JSON.parse(await readFile(`${OUT_DIR}/${P10_1_RETAINED.file}`, 'utf8'));
if (
  p10_1Manifest.maxBytes !== P10_1_RETAINED.maxBytes ||
  p10_1Manifest.bundleBudgetRevision !== P10_1_RETAINED.revision
) {
  throw new Error(
    `P10-3A refuses a silent P10-1 budget change: ${p10_1Manifest.maxBytes}/${p10_1Manifest.bundleBudgetRevision}`
  );
}

const p10_2Manifest = JSON.parse(await readFile(`${OUT_DIR}/${P10_2_RETAINED.file}`, 'utf8'));
if (
  p10_2Manifest.maxBytes !== P10_2_RETAINED.maxBytes ||
  p10_2Manifest.bundleBudgetRevision !== P10_2_RETAINED.revision
) {
  throw new Error(
    `P10-3A refuses a silent P10-2 budget change: ${p10_2Manifest.maxBytes}/${p10_2Manifest.bundleBudgetRevision}`
  );
}

const outFile = `${OUT_DIR}/${ARTIFACT}`;
const result = await build({
  entryPoints: ['packages/score-editor-browser-professional-workstation-p10-3a-v1/src/global-entry.ts'],
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
  throw new Error(
    `P10-3A workstation bundle contains external imports: ${JSON.stringify(externalImports)}`
  );
}

const bundle = await readFile(outFile);
const text = bundle.toString('utf8');
for (const token of FORBIDDEN_TOKENS) {
  if (text.includes(token)) {
    throw new Error(`P10-3A workstation bundle contains forbidden capability token: ${token}`);
  }
}
if (!text.includes(GLOBAL_NAME)) {
  throw new Error(`P10-3A workstation bundle does not expose ${GLOBAL_NAME}.`);
}
if (bundle.byteLength > MAX_BYTES) {
  throw new Error(
    `P10-3A workstation bundle exceeds bounded budget: ${bundle.byteLength} > ${MAX_BYTES}`
  );
}

const sha256 = createHash('sha256').update(bundle).digest('hex');
const manifest = Object.freeze({
  contract: 'ST_SCORE_EDITOR_P10_3A_PROFESSIONAL_WORKSTATION_BUNDLE',
  version: '1.0.0',
  artifactClass: 'optional-p10-3a-professional-pitch-transpose-composition',
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
    p10_1Workstation: Object.freeze({
      maxBytes: P10_1_RETAINED.maxBytes,
      bundleBudgetRevision: P10_1_RETAINED.revision
    }),
    p10_2Workstation: Object.freeze({
      maxBytes: P10_2_RETAINED.maxBytes,
      bundleBudgetRevision: P10_2_RETAINED.revision
    })
  }),
  p10_1QualifiedBasePreserved: true,
  p10_2QualifiedBasePreserved: true,
  semitoneTransposeBundled: true,
  diatonicTransposeBundled: true,
  canonicalAuthority: false,
  historyAuthority: 'EditorHistoryV4',
  semanticTargetAuthority: 'SemanticAddressV3-current-revision',
  rendererIntegrated: true,
  audioHostIntegrated: true,
  audioEngineBundled: false,
  externalAudioRuntimeRequired: true,
  rendererCoordinateAuthority: false,
  domAuthoringAuthority: false,
  productionDefault: false,
  replacesP10_1Artifact: false,
  replacesP10_2Artifact: false,
  productionReleaseAuthorized: false,
  seslitabCutoverAuthorized: false,
  physicalDeviceValidationRequired: true,
  physicalDeviceValidationPassed: false
});
await writeFile(
  `${OUT_DIR}/${MANIFEST_FILE}`,
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8'
);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>ST Score Editor P10-3A Workstation Qualification</title>
<style>html,body,#st-score-editor-p10-3a-workstation-root{margin:0;width:100%;height:100%;min-height:100%;}body{overflow:hidden;overscroll-behavior:none;}@supports(height:100dvh){html,body,#st-score-editor-p10-3a-workstation-root{height:100dvh;min-height:100dvh;}}</style>
</head>
<body>
<div id="st-score-editor-p10-3a-workstation-root"></div>
<script src="./${ARTIFACT}"></script>
<script>
(() => {
  const root = document.getElementById('st-score-editor-p10-3a-workstation-root');
  const controller = globalThis.${GLOBAL_NAME}.createController();
  controller.mount(root);
  Object.defineProperty(globalThis, 'STScoreEditorP10_3AWorkstationController', {
    value: controller,
    writable: false,
    configurable: false
  });
})();
</script>
</body>
</html>
`;
await writeFile(`${OUT_DIR}/${ENTRY_HTML}`, html, 'utf8');

console.log(
  `P10-3A workstation bundle: PASS (${manifest.bytes} bytes, max ${manifest.maxBytes}, sha256 ${manifest.sha256})`
);
