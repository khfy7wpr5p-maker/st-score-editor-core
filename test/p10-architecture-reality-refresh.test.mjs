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


test('P10-0 productization sources distinguish scoped iPhone PASS from the still-open release matrix', async () => {
  const [readme, productizationMd, productizationJsonText] = await Promise.all([
    readRoot('README.md'),
    readRoot('docs/st-score-editor-app-productization.md'),
    readRoot('docs/st-score-editor-app-productization.json')
  ]);
  const productization = JSON.parse(productizationJsonText);

  for (const source of [readme, productizationMd]) {
    assert.match(source, /P09.*(?:complete|merged|qualified)/is);
    assert.match(source, /iPhone Safari.*P08\/P09.*PASS/is);
    assert.match(source, /full.*release matrix.*(?:open|incomplete)/is);
    assert.match(source, /APP-11J.*(?:present|main)/is);
  }

  assert.equal(productization.release_gate.manualDeviceValidationRequired, true);
  assert.equal(productization.release_gate.standaloneReleaseGatePassed, false);
  assert.equal(
    productization.release_gate.target_status['iPhone Safari'],
    'P08_P09_DEVICE_GATE_PASS_FULL_G1_G10_INCOMPLETE'
  );
  assert.equal(productization.release_gate.target_status['Android Chrome'], 'PENDING');
  assert.equal(productization.release_gate.target_status['Windows Edge'], 'PENDING');
  assert.equal(productization.release_gate.target_status['Windows Chrome'], 'PENDING');
  assert.equal(productization.release_gate.target_status['Windows Firefox'], 'PENDING');

  assert.equal(productization.app_11.app_11j.status, 'ANALYSIS_PRESENT_MAIN');
  assert.equal(
    productization.app_11.app_11j.foundation_commit,
    '674187b920434d6d7d72330baba44c2692a64596'
  );
  assert.equal(productization.app_11.app_11j.canonical_mutation_exposed, false);
  assert.equal(productization.seslitab_cutover_authorized, false);
});
