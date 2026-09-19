import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const OUT_DIR = 'dist/browser';
const ARTIFACT = 'st-score-editor-keyboard-workstation.js';
const MANIFEST = 'st-score-editor-keyboard-workstation.manifest.json';
const HTML = 'p09d-keyboard-workstation.html';
const MAX_BYTES = 552_960;
const BUDGET_REVISION = 'P09-D-QUALIFIED-1';
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
const outFile = `${OUT_DIR}/${ARTIFACT}`;
const result = await build({
  entryPoints: ['packages/score-editor-browser-app/src/keyboard-workstation-global-entry.ts'],
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
if (externalImports.length !== 0) throw new Error(`P09-D qualification bundle contains external imports: ${JSON.stringify(externalImports)}`);

const bundle = await readFile(outFile);
const text = bundle.toString('utf8');
for (const token of FORBIDDEN_TOKENS) {
  if (text.includes(token)) throw new Error(`P09-D qualification bundle contains forbidden capability token: ${token}`);
}
if (!text.includes('STScoreEditorKeyboardWorkstation')) throw new Error('P09-D qualification bundle does not expose STScoreEditorKeyboardWorkstation.');
if (bundle.byteLength > MAX_BYTES) throw new Error(`P09-D qualification bundle exceeds bounded budget: ${bundle.byteLength} > ${MAX_BYTES}`);

const sha256 = createHash('sha256').update(bundle).digest('hex');
const manifest = Object.freeze({
  contract: 'ST_SCORE_EDITOR_P09D_KEYBOARD_WORKSTATION_QUALIFICATION_BUNDLE',
  version: '1.0.0',
  stage: 'P09-D',
  productionExposureAuthorized: false,
  defaultStandaloneCutover: false,
  canonicalAuthority: false,
  historyAuthority: false,
  rendererAuthority: false,
  cursorAuthority: false,
  keyboardIntentVersion: '1.0.0',
  mutationRouting: 'existing-controller-session-authorities',
  bundleBudgetRevision: BUDGET_REVISION,
  maxBytes: MAX_BYTES,
  bytes: bundle.byteLength,
  externalImports: 0,
  sha256
});
await writeFile(`${OUT_DIR}/${MANIFEST}`, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P09-D Keyboard Workstation Qualification</title></head>
<body>
<div id="st-score-editor-keyboard-workstation-root" style="height:100vh"></div>
<script src="./${ARTIFACT}"></script>
<script>
(() => {
  const root = document.getElementById('st-score-editor-keyboard-workstation-root');
  const controller = globalThis.STScoreEditorKeyboardWorkstation.createController();
  controller.mount(root);
  Object.defineProperty(globalThis, 'STScoreEditorKeyboardWorkstationController', { value: controller, writable: false, configurable: false });
})();
</script>
</body>
</html>`;
await writeFile(`${OUT_DIR}/${HTML}`, html, 'utf8');
console.log(`P09-D keyboard workstation qualification bundle: PASS (${bundle.byteLength} bytes, sha256 ${sha256})`);
