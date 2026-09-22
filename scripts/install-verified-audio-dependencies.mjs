import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const defaultManifestPath = path.join(repoRoot, 'contracts', 'audio-release-dependencies-v1.json');
const MAX_AUDIO_TARBALL_BYTES = 16 * 1024 * 1024;

const OFFICIAL = Object.freeze({
  contract: 'ST_SCORE_EDITOR_VERIFIED_AUDIO_DEPENDENCIES',
  version: '1.0.0',
  repository: 'khfy7wpr5p-maker/st-score-audio-engine',
  release: 'v0.1.2',
  releaseCommit: '26117ae90f213e208e06fb5c084fc0fad9f4ca86',
  packages: Object.freeze({
    '@st/score-audio-contracts': Object.freeze({
      version: '0.1.0',
      fileName: 'st-score-audio-contracts-0.1.0.tgz'
    }),
    '@st/score-audio-web': Object.freeze({
      version: '0.1.2',
      fileName: 'st-score-audio-web-0.1.2.tgz'
    })
  })
});

export const sha512Integrity = bytes =>
  'sha512-' + createHash('sha512').update(bytes).digest('base64');

const fail = code => {
  const error = new Error(code);
  error.code = code;
  throw error;
};

const validateEntry = entry => {
  if (entry === null || typeof entry !== 'object') fail('AUDIO_DEPENDENCY_MANIFEST_INVALID');
  const official = OFFICIAL.packages[entry.name];
  if (official === undefined) fail('AUDIO_DEPENDENCY_PACKAGE_UNSUPPORTED');
  if (entry.version !== official.version || entry.fileName !== official.fileName) {
    fail('AUDIO_DEPENDENCY_IDENTITY_MISMATCH');
  }
  if (path.basename(entry.fileName) !== entry.fileName || !entry.fileName.endsWith('.tgz')) {
    fail('AUDIO_DEPENDENCY_FILE_NAME_INVALID');
  }
  const expectedUrl =
    'https://github.com/' + OFFICIAL.repository + '/releases/download/' +
    OFFICIAL.release + '/' + entry.fileName;
  if (entry.url !== expectedUrl) fail('AUDIO_DEPENDENCY_URL_MISMATCH');
  if (!/^sha512-[A-Za-z0-9+/=]+$/.test(entry.integrity ?? '')) {
    fail('AUDIO_DEPENDENCY_INTEGRITY_INVALID');
  }
};

export const validateAudioDependencyManifest = (manifest, { requireOfficialSet = false } = {}) => {
  if (
    manifest === null ||
    typeof manifest !== 'object' ||
    manifest.contract !== OFFICIAL.contract ||
    manifest.version !== OFFICIAL.version ||
    manifest.repository !== OFFICIAL.repository ||
    manifest.release !== OFFICIAL.release ||
    manifest.releaseCommit !== OFFICIAL.releaseCommit ||
    !Array.isArray(manifest.packages) ||
    manifest.packages.length === 0
  ) {
    fail('AUDIO_DEPENDENCY_MANIFEST_INVALID');
  }

  const names = new Set();
  for (const entry of manifest.packages) {
    validateEntry(entry);
    if (names.has(entry.name)) fail('AUDIO_DEPENDENCY_DUPLICATE_PACKAGE');
    names.add(entry.name);
  }

  if (
    requireOfficialSet &&
    (
      manifest.packages.length !== Object.keys(OFFICIAL.packages).length ||
      !Object.keys(OFFICIAL.packages).every(name => names.has(name))
    )
  ) {
    fail('AUDIO_DEPENDENCY_OFFICIAL_SET_INCOMPLETE');
  }
  return manifest;
};

const readManifest = async manifestPath => {
  const raw = await readFile(manifestPath, 'utf8');
  return validateAudioDependencyManifest(JSON.parse(raw), { requireOfficialSet: true });
};

export async function installVerifiedAudioDependencies({
  manifest,
  manifestPath = defaultManifestPath,
  tempRoot = os.tmpdir(),
  npmExecPath = process.env.npm_execpath,
  includePlaywright = false,
  fetcher = globalThis.fetch,
  execFileImpl = execFileAsync
} = {}) {
  const selectedManifest = manifest === undefined
    ? await readManifest(manifestPath)
    : validateAudioDependencyManifest(manifest);

  if (typeof fetcher !== 'function') fail('AUDIO_DEPENDENCY_FETCH_UNAVAILABLE');
  if (typeof execFileImpl !== 'function') fail('AUDIO_DEPENDENCY_EXEC_UNAVAILABLE');
  if (typeof npmExecPath !== 'string' || !path.isAbsolute(npmExecPath)) {
    fail('AUDIO_DEPENDENCY_NPM_EXEC_PATH_REQUIRED');
  }

  await mkdir(tempRoot, { recursive: true });
  const workDir = await mkdtemp(path.join(tempRoot, 'st-score-editor-audio-'));
  const verifiedPaths = [];
  const evidence = [];

  try {
    for (const entry of selectedManifest.packages) {
      const response = await fetcher(entry.url, { redirect: 'follow' });
      if (!response?.ok) {
        fail('AUDIO_DEPENDENCY_FETCH_FAILED:' + entry.name + ':' + (response?.status ?? 'unknown'));
      }

      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length === 0 || bytes.length > MAX_AUDIO_TARBALL_BYTES) {
        fail('AUDIO_DEPENDENCY_SIZE_INVALID:' + entry.name);
      }

      const actualIntegrity = sha512Integrity(bytes);
      if (actualIntegrity !== entry.integrity) {
        fail('AUDIO_DEPENDENCY_INTEGRITY_MISMATCH:' + entry.name);
      }

      const localPath = path.join(workDir, entry.fileName);
      await writeFile(localPath, bytes, { flag: 'wx' });
      verifiedPaths.push(localPath);
      evidence.push(Object.freeze({
        name: entry.name,
        version: entry.version,
        integrity: actualIntegrity,
        bytes: bytes.length
      }));
    }

    await execFileImpl(
      process.execPath,
      [
        npmExecPath,
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--no-package-lock',
        '--no-save',
        ...verifiedPaths,
        ...(includePlaywright ? ['playwright@1.62.1'] : [])
      ],
      {
        cwd: repoRoot,
        env: process.env,
        maxBuffer: 16 * 1024 * 1024
      }
    );

    return Object.freeze({
      contract: OFFICIAL.contract,
      release: OFFICIAL.release,
      releaseCommit: OFFICIAL.releaseCommit,
      packages: Object.freeze(evidence)
    });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const allowedArgs = new Set(['--with-playwright']);
  for (const arg of process.argv.slice(2)) {
    if (!allowedArgs.has(arg)) fail('AUDIO_DEPENDENCY_CLI_ARGUMENT_UNSUPPORTED');
  }
  const result = await installVerifiedAudioDependencies({
    includePlaywright: process.argv.includes('--with-playwright')
  });
  console.log(
    'Verified Audio Engine dependencies: PASS (' +
    result.packages.map(item => item.name + '@' + item.version).join(', ') +
    ')'
  );
}
