import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);

const retainedArtifacts = Object.freeze({
  p10_1Workstation: Object.freeze({
    file: 'st-score-editor-professional-workstation.manifest.json',
    maxBytes: 604160,
    bundleBudgetRevision: 'P10-1-COMPOSITION-1'
  }),
  p10_2Workstation: Object.freeze({
    file: 'st-score-editor-p10-2-workstation.manifest.json',
    maxBytes: 624640,
    bundleBudgetRevision: 'P10-2-UNRETIMING-1'
  }),
  p10_3aWorkstation: Object.freeze({
    file: 'st-score-editor-p10-3a-workstation.manifest.json',
    maxBytes: 655360,
    bundleBudgetRevision: 'P10-3A-PITCH-TRANSPOSE-1'
  })
});

export const expectedRetainedBudget = name => {
  const entry = retainedArtifacts[name];
  if (entry === undefined) throw new Error(`UNKNOWN_RETAINED_ARTIFACT:${name}`);
  return Object.freeze({
    maxBytes: entry.maxBytes,
    bundleBudgetRevision: entry.bundleBudgetRevision
  });
};

export const withIsolatedWorkstationArtifact = async ({
  tempPrefix,
  outputEnv,
  buildScript,
  artifactBase,
  retained = []
}, verify) => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), tempPrefix));
  try {
    for (const name of retained) {
      const entry = retainedArtifacts[name];
      if (entry === undefined) throw new Error(`UNKNOWN_RETAINED_ARTIFACT:${name}`);
      await writeFile(
        path.join(outDir, entry.file),
        JSON.stringify({
          maxBytes: entry.maxBytes,
          bundleBudgetRevision: entry.bundleBudgetRevision
        }),
        'utf8'
      );
    }

    const result = await execFileAsync(process.execPath, [buildScript], {
      cwd: process.cwd(),
      env: { ...process.env, [outputEnv]: outDir },
      maxBuffer: 1024 * 1024
    });
    if (result.stdout.length > 0) process.stdout.write(result.stdout);
    if (result.stderr.length > 0) process.stderr.write(result.stderr);

    const manifest = JSON.parse(
      await readFile(path.join(outDir, `${artifactBase}.manifest.json`), 'utf8')
    );
    const bundle = await readFile(path.join(outDir, `${artifactBase}.js`));
    const html = await readFile(path.join(outDir, `${artifactBase}.html`), 'utf8');

    assert.equal(manifest.bytes, bundle.byteLength);
    assert.ok(manifest.bytes <= manifest.maxBytes);
    assert.ok(manifest.maxBytes - manifest.bytes >= 0);
    assert.ok(manifest.maxBytes - manifest.bytes <= 20000);
    assert.equal(
      createHash('sha256').update(bundle).digest('hex'),
      manifest.sha256
    );

    await verify({ manifest, bundle, html });
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
};
