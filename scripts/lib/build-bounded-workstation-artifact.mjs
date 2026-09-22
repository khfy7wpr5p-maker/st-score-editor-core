import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const FORBIDDEN_TOKENS = Object.freeze([
  'node:',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'navigator.sendBeacon',
  'localStorage',
  'sessionStorage',
  'document.cookie'
]);

const retainedManifest = async (outDir, name, expected, stageLabel) => {
  const manifest = JSON.parse(await readFile(`${outDir}/${expected.file}`, 'utf8'));
  if (
    manifest.maxBytes !== expected.maxBytes ||
    manifest.bundleBudgetRevision !== expected.revision
  ) {
    throw new Error(
      `${stageLabel} refuses a silent ${name} budget change: ${manifest.maxBytes}/${manifest.bundleBudgetRevision}`
    );
  }
  return Object.freeze({
    maxBytes: expected.maxBytes,
    bundleBudgetRevision: expected.revision
  });
};

const qualificationHtml = ({
  title,
  rootId,
  artifact,
  globalName,
  controllerGlobalName
}) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${title}</title>
<style>html,body,#${rootId}{margin:0;width:100%;height:100%;min-height:100%;}body{overflow:hidden;overscroll-behavior:none;}@supports(height:100dvh){html,body,#${rootId}{height:100dvh;min-height:100dvh;}}</style>
</head>
<body>
<div id="${rootId}"></div>
<script src="./${artifact}"></script>
<script>
(() => {
  const root = document.getElementById('${rootId}');
  const controller = globalThis.${globalName}.createController();
  controller.mount(root);
  Object.defineProperty(globalThis, '${controllerGlobalName}', {
    value: controller,
    writable: false,
    configurable: false
  });
})();
</script>
</body>
</html>
`;

export const buildBoundedWorkstationArtifact = async ({
  stageLabel,
  outDir,
  entryPoint,
  artifact,
  manifestFile,
  entryHtml,
  globalName,
  controllerGlobalName,
  maxBytes,
  budgetRevision,
  retainedBudgets,
  contract,
  artifactClass,
  title,
  rootId,
  manifestCapabilities
}) => {
  await mkdir(outDir, { recursive: true });

  const retained = {};
  for (const [name, expected] of Object.entries(retainedBudgets)) {
    retained[name] = await retainedManifest(outDir, name, expected, stageLabel);
  }

  const outFile = `${outDir}/${artifact}`;
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
    .flatMap(output => output.imports)
    .filter(entry => entry.external === true);
  if (externalImports.length !== 0) {
    throw new Error(
      `${stageLabel} bundle contains external imports: ${JSON.stringify(externalImports)}`
    );
  }

  const bundle = await readFile(outFile);
  const bundleText = bundle.toString('utf8');
  for (const token of FORBIDDEN_TOKENS) {
    if (bundleText.includes(token)) {
      throw new Error(`${stageLabel} bundle contains forbidden capability token: ${token}`);
    }
  }
  if (!bundleText.includes(globalName)) {
    throw new Error(`${stageLabel} bundle does not expose ${globalName}.`);
  }
  if (bundle.byteLength > maxBytes) {
    throw new Error(
      `${stageLabel} bundle exceeds bounded budget: ${bundle.byteLength} > ${maxBytes}`
    );
  }

  const sha256 = createHash('sha256').update(bundle).digest('hex');
  const manifest = Object.freeze({
    contract,
    version: '1.0.0',
    artifactClass,
    artifact,
    format: 'iife',
    target: 'es2022',
    global: globalName,
    entryHtml,
    bundler: Object.freeze({ package: 'esbuild', version: '0.28.2', license: 'MIT' }),
    externalImports: 0,
    bundleBudgetRevision: budgetRevision,
    maxBytes,
    bytes: bundle.byteLength,
    sha256,
    retainedBudgets: Object.freeze(retained),
    ...manifestCapabilities
  });

  await writeFile(
    `${outDir}/${manifestFile}`,
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );
  await writeFile(
    `${outDir}/${entryHtml}`,
    qualificationHtml({ title, rootId, artifact, globalName, controllerGlobalName }),
    'utf8'
  );

  console.log(
    `${stageLabel} bundle: PASS (${manifest.bytes} bytes, max ${manifest.maxBytes}, sha256 ${manifest.sha256})`
  );

  return manifest;
};
