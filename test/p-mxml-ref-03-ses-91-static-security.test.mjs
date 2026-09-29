import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('SES-91 static security gate keeps fallback bounded and out of browser runtime dependencies', async () => {
  const [
    pkg,
    router,
    appDocument,
    fileEnabled,
    pythonBoundary,
    contracts,
    requirements,
    ci
  ] = await Promise.all([
    read('package.json'),
    read('packages/musicxml-import-router/src/index.ts'),
    read('packages/score-editor-app-document/src/index.ts'),
    read('packages/score-editor-browser-app/src/file-enabled.ts'),
    read('services/partitura_import/app.py'),
    read('services/partitura_import/contracts.py'),
    read('services/partitura_import/requirements.txt'),
    read('.github/workflows/ci.yml')
  ]);

  const packageJson = JSON.parse(pkg);
  assert.deepEqual(Object.keys(packageJson.dependencies ?? {}).sort((left, right) => left.localeCompare(right)), ['saxes', 'xmlchars']);
  assert.doesNotMatch(pkg, /partitura|python|axios|node-fetch|requests/i);

  for (const [label, source] of [
    ['router', router],
    ['app-document', appDocument],
    ['file-enabled', fileEnabled]
  ]) {
    assert.doesNotMatch(source, /render\.com|axios|node-fetch|child_process|spawn\s*\(|execFile\s*\(/i, label);
    assert.doesNotMatch(source, /https?:\/\//i, label);
  }

  assert.doesNotMatch(pythonBoundary, /subprocess|requests|urllib|socket|os\.system|Popen/i);
  assert.match(pythonBoundary, /TemporaryDirectory/);
  assert.match(pythonBoundary, /source\.musicxml/);
  assert.match(contracts, /MAX_MUSICXML_BYTES\s*=\s*5 \* 1024 \* 1024/);
  assert.match(contracts, /MAX_PARSE_SECONDS\s*=\s*10/);
  assert.match(contracts, /MAX_MEASURES\s*=\s*2_000/);
  assert.match(contracts, /MAX_EVENTS\s*=\s*50_000/);

  const requirementLines = requirements.trim().split(/\r?\n/);
  assert.ok(requirementLines.length > 0);
  for (const line of requirementLines) {
    assert.match(line, /^[A-Za-z0-9_.-]+==[^\s]+ --hash=sha256:[a-f0-9]{64}$/);
  }

  assert.match(ci, /--only-binary=:all:/);
  assert.match(ci, /--require-hashes/);
  assert.doesNotMatch(ci, /render\.com|production[-_ ]?deploy|\bdeploy\b/i);
});
