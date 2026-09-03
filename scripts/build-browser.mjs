import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const OUT_DIR = 'dist/browser';
const FORBIDDEN_TOKENS = [
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

await mkdir(OUT_DIR, { recursive: true });

const buildBrowserArtifact = async ({ entryPoint, artifact, manifestFile, globalName, manifest, label }) => {
  const outFile = `${OUT_DIR}/${artifact}`;
  const result = await build({
    entryPoints: [entryPoint],
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
    throw new Error(`${label} browser bundle contains external imports: ${JSON.stringify(externalImports)}`);
  }

  const bundle = await readFile(outFile);
  const text = bundle.toString('utf8');
  for (const token of FORBIDDEN_TOKENS) {
    if (text.includes(token)) throw new Error(`${label} browser bundle contains forbidden capability token: ${token}`);
  }
  if (!text.includes(globalName)) throw new Error(`${label} browser bundle does not expose ${globalName}.`);

  const description = Object.freeze({
    ...manifest,
    bundler: Object.freeze({ package: 'esbuild', version: '0.28.2', license: 'MIT' }),
    artifact,
    format: 'iife',
    target: 'es2022',
    global: globalName,
    externalImports: 0,
    bytes: bundle.byteLength,
    sha256: createHash('sha256').update(bundle).digest('hex')
  });
  await writeFile(`${OUT_DIR}/${manifestFile}`, `${JSON.stringify(description, null, 2)}\n`, 'utf8');
  console.log(`${label} browser bundle: PASS (${description.bytes} bytes, sha256 ${description.sha256})`);
};

await buildBrowserArtifact({
  entryPoint: 'packages/browser-runtime/src/global-entry.ts',
  artifact: 'st-score-editor-core.runtime.js',
  manifestFile: 'st-score-editor-core.runtime.manifest.json',
  globalName: 'STScoreEditorCoreRuntime',
  label: 'E7-H core',
  manifest: Object.freeze({
    contract: 'ST_SCORE_EDITOR_CORE_BROWSER_BUNDLE',
    version: '1.0.0',
    runtimeVersion: '1.0.0',
    networkCapable: false,
    persistenceCapable: false,
    serverRevisionAuthority: false,
    approvalAuthority: false,
    publicationAuthority: false
  })
});

await buildBrowserArtifact({
  entryPoint: 'packages/score-editor-browser-app/src/global-entry.ts',
  artifact: 'st-score-editor-app.js',
  manifestFile: 'st-score-editor-app.manifest.json',
  globalName: 'STScoreEditorApp',
  label: 'APP-04B standalone app',
  manifest: Object.freeze({
    contract: 'ST_SCORE_EDITOR_APP_BROWSER_BUNDLE',
    version: '1.0.0',
    runtimeVersion: '1.0.0',
    standaloneProduct: true,
    canonicalAuthority: false,
    networkCapable: false,
    persistenceCapable: false,
    rendererAuthority: false,
    rendererBundled: false,
    fileWorkflowBundled: true,
    fileSystemAccessAdapter: true,
    fileInputFallback: true,
    downloadFallback: true,
    markSavedAfterSuccessfulHandoffOnly: true,
    playbackBundled: false,
    serverRevisionAuthority: false,
    publicationAuthority: false,
    entryHtml: 'st-score-editor-app.html'
  })
});

const standaloneHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>ST Score Editor</title>
<style>html,body,#st-score-editor-app-root{margin:0;width:100%;height:100%;min-height:100%;}body{overflow:hidden;}</style>
</head>
<body>
<div id="st-score-editor-app-root"></div>
<script src="./st-score-editor-app.js"></script>
<script>
(() => {
  const root = document.getElementById('st-score-editor-app-root');
  if (!root || !globalThis.STScoreEditorApp) throw new Error('ST_SCORE_EDITOR_APP_BOOTSTRAP_FAILED');
  const controller = globalThis.STScoreEditorApp.createController();
  controller.mount(root);
  Object.defineProperty(globalThis, 'STScoreEditorAppController', { value: controller, writable: false, configurable: false });
})();
</script>
</body>
</html>
`;
await writeFile(`${OUT_DIR}/st-score-editor-app.html`, standaloneHtml, 'utf8');
console.log('APP-04B standalone HTML: PASS');
