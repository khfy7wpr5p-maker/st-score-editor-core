import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const readJson = async relative => JSON.parse(await readFile(relative, 'utf8'));
const readText = relative => readFile(relative, 'utf8');

const CONTRACTS_INTEGRITY = 'sha512-w5esj/tbxipcdxQhIIRZkemThsbP1r8KZKBVSBzt6UjQYWKBASyTsRW3Q+ScFC2ymbHPTU1RSfRLyMOnapDPlQ==';
const WEB_INTEGRITY = 'sha512-ajmk2ATxfzn815WDamE6faDANAdCs8GRZ50gxmC0YjdjXTcDmX5pLWjsSyV1tMBuVPFfk+isVaAql2m4rRynMw==';

const workflows = [
  '.github/workflows/ci.yml',
  '.github/workflows/app09b-preview-webkit.yml',
  '.github/workflows/p08e4-professional-webkit.yml',
  '.github/workflows/p10-1-professional-workstation-webkit.yml',
  '.github/workflows/p10-1-renderer-qualification-webkit.yml',
  '.github/workflows/p10-2-triplet-unretiming-webkit.yml'
];

test('package.json no longer installs remote Audio Engine tarballs directly', async () => {
  const pkg = await readJson('package.json');
  assert.equal(pkg.optionalDependencies?.['@st/score-audio-contracts'], undefined);
  assert.equal(pkg.optionalDependencies?.['@st/score-audio-web'], undefined);
  assert.equal(pkg.scripts?.['install:verified-audio'], 'node scripts/install-verified-audio-dependencies.mjs');
  assert.doesNotMatch(JSON.stringify(pkg), /st-score-audio-engine\/releases\/download\/v0\.1\.2\/.*\.tgz/);
});

test('verified audio release manifest pins exact upstream identities and sha512', async () => {
  const manifest = await readJson('contracts/audio-release-dependencies-v1.json');
  assert.equal(manifest.contract, 'ST_SCORE_EDITOR_VERIFIED_AUDIO_DEPENDENCIES');
  assert.equal(manifest.version, '1.0.0');
  assert.equal(manifest.repository, 'khfy7wpr5p-maker/st-score-audio-engine');
  assert.equal(manifest.release, 'v0.1.2');
  assert.equal(manifest.releaseCommit, '26117ae90f213e208e06fb5c084fc0fad9f4ca86');
  assert.deepEqual(manifest.packages, [
    {
      name: '@st/score-audio-contracts',
      version: '0.1.0',
      fileName: 'st-score-audio-contracts-0.1.0.tgz',
      url: 'https://github.com/khfy7wpr5p-maker/st-score-audio-engine/releases/download/v0.1.2/st-score-audio-contracts-0.1.0.tgz',
      integrity: CONTRACTS_INTEGRITY
    },
    {
      name: '@st/score-audio-web',
      version: '0.1.2',
      fileName: 'st-score-audio-web-0.1.2.tgz',
      url: 'https://github.com/khfy7wpr5p-maker/st-score-audio-engine/releases/download/v0.1.2/st-score-audio-web-0.1.2.tgz',
      integrity: WEB_INTEGRITY
    }
  ]);
});

test('verified installer rejects checksum mismatch before npm execution', async () => {
  const {
    installVerifiedAudioDependencies,
    sha512Integrity
  } = await import('../scripts/install-verified-audio-dependencies.mjs');

  const tmp = await mkdtemp(path.join(os.tmpdir(), 'stse-audio-integrity-'));
  let npmCalls = 0;
  const bytes = Buffer.from('tampered');
  const manifest = {
    contract: 'ST_SCORE_EDITOR_VERIFIED_AUDIO_DEPENDENCIES',
    version: '1.0.0',
    repository: 'khfy7wpr5p-maker/st-score-audio-engine',
    release: 'v0.1.2',
    releaseCommit: '26117ae90f213e208e06fb5c084fc0fad9f4ca86',
    packages: [{
      name: '@st/score-audio-contracts',
      version: '0.1.0',
      fileName: 'st-score-audio-contracts-0.1.0.tgz',
      url: 'https://github.com/khfy7wpr5p-maker/st-score-audio-engine/releases/download/v0.1.2/st-score-audio-contracts-0.1.0.tgz',
      integrity: sha512Integrity(Buffer.from('expected'))
    }]
  };

  try {
    await assert.rejects(
      installVerifiedAudioDependencies({
        manifest,
        tempRoot: tmp,
        npmExecPath: '/trusted/npm-cli.js',
        fetcher: async () => ({
          ok: true,
          status: 200,
          arrayBuffer: async () => bytes
        }),
        execFileImpl: async () => { npmCalls += 1; }
      }),
      /AUDIO_DEPENDENCY_INTEGRITY_MISMATCH/
    );
    assert.equal(npmCalls, 0);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('verified installer accepts matching bytes and passes only local tarballs to npm', async () => {
  const {
    installVerifiedAudioDependencies,
    sha512Integrity
  } = await import('../scripts/install-verified-audio-dependencies.mjs');

  const tmp = await mkdtemp(path.join(os.tmpdir(), 'stse-audio-integrity-'));
  const bytes = Buffer.from('verified tarball bytes');
  const entry = {
    name: '@st/score-audio-contracts',
    version: '0.1.0',
    fileName: 'st-score-audio-contracts-0.1.0.tgz',
    url: 'https://github.com/khfy7wpr5p-maker/st-score-audio-engine/releases/download/v0.1.2/st-score-audio-contracts-0.1.0.tgz',
    integrity: sha512Integrity(bytes)
  };
  const calls = [];

  try {
    const result = await installVerifiedAudioDependencies({
      manifest: {
        contract: 'ST_SCORE_EDITOR_VERIFIED_AUDIO_DEPENDENCIES',
        version: '1.0.0',
        repository: 'khfy7wpr5p-maker/st-score-audio-engine',
        release: 'v0.1.2',
        releaseCommit: '26117ae90f213e208e06fb5c084fc0fad9f4ca86',
        packages: [entry]
      },
      tempRoot: tmp,
      npmExecPath: '/trusted/npm-cli.js',
      fetcher: async () => ({
        ok: true,
        status: 200,
        arrayBuffer: async () => bytes
      }),
      execFileImpl: async (executable, args, options) => {
        calls.push({ executable, args, options });
      }
    });

    assert.equal(result.packages.length, 1);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].executable, process.execPath);
    assert.equal(calls[0].args[0], '/trusted/npm-cli.js');
    assert.deepEqual(calls[0].args.slice(1, 7), [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--no-package-lock',
      '--no-save'
    ]);
    const installTarget = calls[0].args[7];
    assert.equal(path.isAbsolute(installTarget), true);
    assert.equal(installTarget.startsWith(tmp), true);
    assert.doesNotMatch(installTarget, /^https?:/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('all current Editor Core CI and retained WebKit workflows install verified audio packages', async () => {
  for (const workflow of workflows) {
    const source = await readText(workflow);
    const editorCoreInstallCount = (source.match(/npm install --ignore-scripts --no-audit --no-fund --no-package-lock/g) ?? []).length;
    const verifiedCount = (source.match(/npm run install:verified-audio/g) ?? []).length;

    if (workflow.endsWith('app09b-preview-webkit.yml')) {
      assert.ok(editorCoreInstallCount >= 2);
      assert.ok(verifiedCount >= 2, workflow + ' must verify audio in both Editor Core jobs');
    } else {
      assert.ok(editorCoreInstallCount >= 1);
      assert.ok(verifiedCount >= 1, workflow + ' must verify audio before build/test');
    }
  }
});
