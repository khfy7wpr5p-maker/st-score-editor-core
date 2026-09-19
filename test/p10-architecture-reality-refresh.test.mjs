import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readRoot = relative =>
  readFile(new URL('../' + relative, import.meta.url), 'utf8');

test('P10-0 core architecture docs describe the current P09 and APP-11J mainline reality', async () => {
  const [architecture, roadmap] = await Promise.all([
    readRoot('ARCHITECTURE.md'),
    readRoot('ROADMAP.md')
  ]);

  for (const source of [architecture, roadmap]) {
    assert.match(source, /P09-A\/B\/C\/D|P09.*merged/i);
    assert.match(source, /9dfa253a55982a66b01b5eaa2f8df614b1e58e9b/);
    assert.match(source, /P10-0.*Architecture Reality Refresh/i);
    assert.match(source, /APP-11J.*(?:present|exists|main)/is);
    assert.match(source, /manualDeviceValidationRequired\s*=\s*true/);
    assert.match(source, /standaloneReleaseGatePassed\s*=\s*false/);
  }

  assert.doesNotMatch(
    architecture,
    /## Next architecture step\s+\*\*APP-11J\s+—\s+Triplet Removal \/ Unretiming Admission Foundation\.\*\*/
  );
  assert.doesNotMatch(
    roadmap,
    /## Next development action\s+\*\*APP-11J\s+—\s+Triplet Removal \/ Unretiming Admission Foundation\.\*\*/
  );
});
