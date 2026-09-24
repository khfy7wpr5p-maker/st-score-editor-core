import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

const rendererRevision='70c21ad73c0b2e9c71e415cc3272a10673df9d60';
const lockUrl=new URL(
  `../scripts/renderer-runtime-lock/st-score-rendering-layer-${rendererRevision}.package-lock.json.gz`,
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
    /uses:\s*actions\/checkout@11d5960a326750d5838078e36cf38b85af677262[\s\S]*?repository:\s*khfy7wpr5p-maker\/st-score-rendering-layer[\s\S]*?ref:\s*70c21ad73c0b2e9c71e415cc3272a10673df9d60/
  );
  assert.match(source,/persist-credentials:\s*false/);
  assert.match(source,/gzip -dc[^\n]*70c21ad73c0b2e9c71e415cc3272a10673df9d60\.package-lock\.json\.gz/);
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
