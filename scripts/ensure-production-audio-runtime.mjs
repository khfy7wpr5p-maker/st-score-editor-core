import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export async function ensureProductionAudioRuntime({
  audioRuntimeDir,
  bundleName,
  releaseUrl,
  expectedSha256,
  fetcher = globalThis.fetch
}) {
  if (typeof audioRuntimeDir !== 'string' || audioRuntimeDir.length === 0) {
    throw new TypeError('Production audio runtime directory is required.');
  }
  if (typeof fetcher !== 'function') throw new TypeError('A fetch implementation is required.');
  if (!/^[a-f0-9]{64}$/.test(expectedSha256)) throw new TypeError('Expected audio SHA-256 must be lowercase hex.');

  await mkdir(audioRuntimeDir, { recursive: true });
  const target = path.join(audioRuntimeDir, bundleName);
  try {
    const existing = await readFile(target);
    if (sha256(existing) === expectedSha256) {
      return Object.freeze({ path: target, source: 'existing', sha256: expectedSha256 });
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  const response = await fetcher(releaseUrl);
  if (!response?.ok) {
    throw new Error(`PRODUCTION_AUDIO_RELEASE_FETCH_FAILED:${response?.status ?? 'unknown'}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== expectedSha256) {
    throw new Error(`PRODUCTION_AUDIO_RELEASE_SHA_MISMATCH:${actualSha256}`);
  }

  const temporary = `${target}.tmp`;
  try {
    await writeFile(temporary, bytes);
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
  return Object.freeze({ path: target, source: 'downloaded', sha256: actualSha256 });
}
