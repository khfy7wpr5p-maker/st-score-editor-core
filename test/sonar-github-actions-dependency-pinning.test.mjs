import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('P10-1 renderer qualification checks out the renderer at the exact admitted revision', async () => {
  const source = await readFile(
    new URL('../.github/workflows/p10-1-renderer-qualification-webkit.yml', import.meta.url),
    'utf8'
  );

  assert.doesNotMatch(source, /git clone\s+https:\/\/github\.com\/khfy7wpr5p-maker\/st-score-rendering-layer/);
  assert.doesNotMatch(source, /git checkout\s+--detach/);
  assert.match(
    source,
    /uses:\s*actions\/checkout@11d5960a326750d5838078e36cf38b85af677262[\s\S]*?repository:\s*khfy7wpr5p-maker\/st-score-rendering-layer[\s\S]*?ref:\s*70c21ad73c0b2e9c71e415cc3272a10673df9d60/
  );
  assert.match(source, /persist-credentials:\s*false/);
});
