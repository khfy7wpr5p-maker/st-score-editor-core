import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const OUT_DIR = 'dist/browser';
const OUT_FILE = `${OUT_DIR}/st-score-editor-core.runtime.js`;
const MANIFEST_FILE = `${OUT_DIR}/st-score-editor-core.runtime.manifest.json`;

await mkdir(OUT_DIR, { recursive: true });

const result = await build({
  entryPoints: ['packages/browser-runtime/src/global-entry.ts'],
  outfile: OUT_FILE,
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
  throw new Error(`Browser bundle contains external imports: ${JSON.stringify(externalImports)}`);
}

const bundle = await readFile(OUT_FILE);
const text = bundle.toString('utf8');
const forbiddenTokens = [
  'node:',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'navigator.sendBeacon',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'document.cookie'
];
for (const token of forbiddenTokens) {
  if (text.includes(token)) {
    throw new Error(`Browser bundle contains forbidden capability token: ${token}`);
  }
}
if (!text.includes('STScoreEditorCoreRuntime')) {
  throw new Error('Browser bundle does not expose STScoreEditorCoreRuntime.');
}

const manifest = Object.freeze({
  contract: 'ST_SCORE_EDITOR_CORE_BROWSER_BUNDLE',
  version: '1.0.0',
  runtimeVersion: '1.0.0',
  bundler: Object.freeze({ package: 'esbuild', version: '0.28.2', license: 'MIT' }),
  artifact: 'st-score-editor-core.runtime.js',
  format: 'iife',
  target: 'es2022',
  global: 'STScoreEditorCoreRuntime',
  externalImports: 0,
  networkCapable: false,
  persistenceCapable: false,
  serverRevisionAuthority: false,
  approvalAuthority: false,
  publicationAuthority: false,
  bytes: bundle.byteLength,
  sha256: createHash('sha256').update(bundle).digest('hex')
});
await writeFile(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`E7-H browser bundle: PASS (${manifest.bytes} bytes, sha256 ${manifest.sha256})`);
