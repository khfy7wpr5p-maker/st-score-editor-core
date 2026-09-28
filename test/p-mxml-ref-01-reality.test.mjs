import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('P-MXML-REF-01 repository reality preserves authority, dependency and release boundaries', async () => {
  await Promise.all([
    access(new URL('../docs/superpowers/specs/2026-09-27-partitura-reference-musicxml-compatibility-design.md', import.meta.url)),
    access(new URL('../docs/superpowers/plans/2026-09-27-partitura-reference-musicxml-compatibility.md', import.meta.url))
  ]);

  const [
    policy,
    diagnostics,
    appDocument,
    packageJson,
    workflow,
    roundtrip,
    dependencies,
    architecture,
    roadmap,
    productization,
    releaseGate,
    matrix
  ] = await Promise.all([
    read('packages/musicxml/src/compatibilityPolicy.ts'),
    read('packages/musicxml/src/compatibilityDiagnostics.ts'),
    read('packages/score-editor-app-document/src/index.ts'),
    read('package.json'),
    read('.github/workflows/p-mxml-ref-01-musicxml-compatibility-webkit.yml'),
    read('docs/musicxml-roundtrip-policy.md'),
    read('DEPENDENCIES.md'),
    read('ARCHITECTURE.md'),
    read('ROADMAP.md'),
    read('docs/st-score-editor-app-productization.md'),
    read('docs/app-09-standalone-release-gate.md'),
    read('docs/musicxml-compatibility-matrix.md')
  ]);

  assert.match(policy, /MUSICXML_COMPATIBILITY_POLICY_VERSION\s*=\s*'1\.0\.0'/);
  assert.match(diagnostics, /MUSICXML_COMPATIBILITY_DIAGNOSTIC_LIMIT\s*=\s*64/);
  assert.match(appDocument, /importNotationMusicXmlV2/);
  assert.match(appDocument, /openMusicXmlScoreEditorAppDocument/);

  const pkg = JSON.parse(packageJson);
  assert.deepEqual(Object.keys(pkg.dependencies ?? {}).sort(), ['saxes', 'xmlchars']);
  assert.deepEqual(Object.keys(pkg.devDependencies ?? {}).sort(), ['esbuild', 'typescript']);
  assert.doesNotMatch(packageJson, /partitura|python|axios|node-fetch/i);

  assert.doesNotMatch(workflow, /render\.com|\bdeploy\b|production[-_ ]?deploy/i);
  assert.match(workflow, /p-mxml-ref-01-webkit-musicxml-compatibility-regression\.mjs/);

  assert.match(roundtrip, /P-MXML-REF-01 compatibility policy/);
  assert.match(roundtrip, /IGNORABLE_PRESENTATION_METADATA/);
  assert.match(roundtrip, /UNSUPPORTED_SEMANTIC_FAIL_CLOSED/);
  assert.match(roundtrip, /Partitura remains reference-only/);

  assert.match(dependencies, /P-MXML-REF-01 dependency boundary/);
  assert.match(dependencies, /Partitura remains reference-only/);
  assert.match(dependencies, /No Python\/backend\/network dependency/);

  assert.match(architecture, /bounded compatibility classification/);
  assert.match(architecture, /importNotationMusicXmlV2/);
  assert.match(architecture, /ScoreDocumentV3 \+ NotationDocumentV4/);

  assert.match(roadmap, /P-MXML-REF-01/);
  assert.match(roadmap, /Task 8 physical qualification pending/);

  assert.match(productization, /P-MXML-REF-01 compatibility hardening/);
  assert.match(productization, /manualDeviceValidationRequired = true/);
  assert.match(productization, /standaloneReleaseGatePassed = false/);

  assert.match(releaseGate, /P-MXML-REF-01 automated compatibility evidence/);
  assert.match(releaseGate, /standaloneReleaseGatePassed = false/);
  assert.match(releaseGate, /seslitabCutoverAuthorized = false/);

  assert.match(matrix, /Automated current result: PASS/);
  assert.match(matrix, /Dedicated mobile WebKit result: PASS/);
  assert.match(matrix, /Task 8 physical qualification pending/);
});
