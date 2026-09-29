import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

const rendererRevision='effc13c82eb1e537773541e5a659f435ecb71583';
const rendererLockRevision='90ba96f5f731c121229a0e916f85e3ab328069a7';
const lockUrl=new URL(
  `../scripts/renderer-runtime-lock/st-score-rendering-layer-${rendererLockRevision}.package-lock.json.gz`,
  import.meta.url
);

test('P10-1 renderer qualification uses one exact renderer revision and a committed dependency lock', async () => {
  const source=await readFile(
    new URL('../.github/workflows/p10-1-renderer-qualification-webkit.yml',import.meta.url),
    'utf8'
  );

  assert.doesNotMatch(source,/git clone\s+https:\/\/github\.com\/khfy7wpr5p-maker\/st-score-rendering-layer/);
  assert.doesNotMatch(source,/git checkout\s+--detach/);
  assert.doesNotMatch(source,/npm install[^\n]*--no-package-lock/);
  assert.match(
    source,
    /uses:\s*actions\/checkout@11d5960a326750d5838078e36cf38b85af677262[\s\S]*?repository:\s*khfy7wpr5p-maker\/st-score-rendering-layer[\s\S]*?ref:\s*effc13c82eb1e537773541e5a659f435ecb71583/
  );
  assert.match(source,/persist-credentials:\s*false/);
  assert.match(source,/gzip -dc[^\n]*90ba96f5f731c121229a0e916f85e3ab328069a7\.package-lock\.json\.gz/);
  assert.match(source,/npm ci --ignore-scripts --no-audit --no-fund/);

  const lock=JSON.parse(gunzipSync(await readFile(lockUrl)).toString('utf8'));
  assert.equal(lock.lockfileVersion,3);
  assert.equal(lock.packages[''].name,'st-score-rendering-layer-workspace');
  assert.deepEqual(lock.packages[''].devDependencies,{
    '@types/node':'22.20.1',
    playwright:'1.62.1',
    typescript:'6.0.3'
  });
  assert.equal(
    lock.packages['packages/adapter-osmd'].dependencies.opensheetmusicdisplay,
    '2.1.2'
  );
});
