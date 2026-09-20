import { mkdir, readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const OUT_DIR = 'dist/browser';
const ARTIFACT = 'st-score-editor-professional-workstation.js';
const GLOBAL_NAME = 'STScoreEditorProfessionalWorkstation';
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
  throw new Error(`P10-1 measurement bundle contains external imports: ${JSON.stringify(externalImports)}`);
}

const bundle = await readFile(outFile);
const text = bundle.toString('utf8');
for (const token of FORBIDDEN_TOKENS) {
  if (text.includes(token)) {
    throw new Error(`P10-1 measurement bundle contains forbidden capability token: ${token}`);
  }
}
if (!text.includes(GLOBAL_NAME)) {
  throw new Error(`P10-1 measurement bundle does not expose ${GLOBAL_NAME}.`);
}

throw new Error(`P10_1_BUDGET_MEASUREMENT:${bundle.byteLength}`);
