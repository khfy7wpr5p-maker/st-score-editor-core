import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { ensureProductionAudioRuntime } from '../scripts/ensure-production-audio-runtime.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');

test('production audio runtime reuses an exact SHA-pinned bundle without network access', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'stse-audio-pin-'));
  try {
    const bytes = Buffer.from('exact-audio-v011');
    await writeFile(path.join(dir, 'st-score-audio-engine.js'), bytes);
    let fetches = 0;
    const result = await ensureProductionAudioRuntime({
      audioRuntimeDir: dir,
      bundleName: 'st-score-audio-engine.js',
      releaseUrl: 'https://example.invalid/v0.1.1.js',
      expectedSha256: digest(bytes),
      fetcher: async () => { fetches += 1; throw new Error('network should not be used'); }
    });
    assert.equal(result.source, 'existing');
    assert.equal(fetches, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('production audio runtime replaces a stale bundle only with the exact SHA-pinned release bytes', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'stse-audio-pin-'));
  try {
    await writeFile(path.join(dir, 'st-score-audio-engine.js'), 'stale-v010');
    const releaseBytes = Buffer.from('official-v011');
    let fetches = 0;
    const result = await ensureProductionAudioRuntime({
      audioRuntimeDir: dir,
      bundleName: 'st-score-audio-engine.js',
      releaseUrl: 'https://example.invalid/v0.1.1.js',
      expectedSha256: digest(releaseBytes),
      fetcher: async url => {
        fetches += 1;
        assert.equal(url, 'https://example.invalid/v0.1.1.js');
        return { ok: true, status: 200, arrayBuffer: async () => releaseBytes };
      }
    });
    assert.equal(result.source, 'downloaded');
    assert.equal(fetches, 1);
    assert.deepEqual(await readFile(path.join(dir, 'st-score-audio-engine.js')), releaseBytes);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('production audio runtime fails closed on release SHA mismatch', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'stse-audio-pin-'));
  try {
    await assert.rejects(
      ensureProductionAudioRuntime({
        audioRuntimeDir: dir,
        bundleName: 'st-score-audio-engine.js',
        releaseUrl: 'https://example.invalid/v0.1.1.js',
        expectedSha256: digest(Buffer.from('expected')),
        fetcher: async () => ({ ok: true, status: 200, arrayBuffer: async () => Buffer.from('tampered') })
      }),
      /PRODUCTION_AUDIO_RELEASE_SHA_MISMATCH/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
