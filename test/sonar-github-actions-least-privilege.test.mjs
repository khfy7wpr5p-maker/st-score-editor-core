import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflows = [
  {
    path: '.github/workflows/app09b-preview-webkit.yml',
    jobs: ['webkit-preview', 'p05-paste-render']
  },
  {
    path: '.github/workflows/p08e4-professional-webkit.yml',
    jobs: ['professional-webkit']
  },
  {
    path: '.github/workflows/ci.yml',
    jobs: ['core']
  }
];

const readRoot = relative => readFile(new URL('../' + relative, import.meta.url), 'utf8');

const jobBlock = (source, jobName) => {
  const marker = '  ' + jobName + ':\n';
  const start = source.indexOf(marker);
  if (start < 0) return '';
  const rest = source.slice(start + marker.length);
  const next = rest.search(/^  [A-Za-z0-9_-]+:\n/m);
  return marker + (next < 0 ? rest : rest.slice(0, next));
};

test('Sonar GitHub Actions least-privilege rule is enforced at each job', async () => {
  for (const workflow of workflows) {
    const source = await readRoot(workflow.path);

    assert.doesNotMatch(
      source,
      /^permissions:\n  contents: read$/m,
      workflow.path + ' must not grant read permissions at workflow scope'
    );

    for (const job of workflow.jobs) {
      const block = jobBlock(source, job);
      assert.notEqual(block, '', workflow.path + ' missing job ' + job);
      assert.match(
        block,
        /^    permissions:\n      contents: read$/m,
        workflow.path + ' job ' + job + ' must define contents: read locally'
      );
    }
  }
});
