import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readHandoff = async () => JSON.parse(
  await readFile(new URL('../docs/p06-sdk-final-handoff.json', import.meta.url), 'utf8')
);

test('P06-H handoff preserves canonical authority and release boundaries', async () => {
  const handoff = await readHandoff();
  assert.equal(handoff.schema_version, '1.0.0');
  assert.equal(handoff.project, 'st-score-editor-core');
  assert.equal(handoff.authority.canonical_score, 'ScoreDocumentV3 + NotationDocumentV4');
  assert.equal(handoff.authority.history, 'EditorSessionV4');
  assert.equal(handoff.authority.semantic_identity, 'SemanticAddressV3');
  assert.equal(handoff.authority.sdk_is_canonical_authority, false);
  assert.equal(handoff.authority.renderer_is_canonical_authority, false);
  assert.equal(handoff.authority.audio_is_canonical_authority, false);
  assert.equal(handoff.frozen_boundaries.protected_branch_merge_authorized, false);
  assert.equal(handoff.frozen_boundaries.production_release_authorized, false);
  assert.equal(handoff.frozen_boundaries.production_cutover_authorized, false);
});

test('P06-H handoff records public contract and default-off capability rollout', async () => {
  const handoff = await readHandoff();
  assert.equal(handoff.public_contract.sdk_version, '1.0.0');
  assert.equal(handoff.public_contract.negotiation_version, '1.0.0');
  assert.equal(handoff.public_contract.public_entry, 'packages/score-editor-sdk-v1/public.ts');
  assert.deepEqual(handoff.public_contract.public_modules, [
    './src/index.js',
    './version-negotiation.js',
    './rollout.js'
  ]);
  assert.equal(handoff.rollout.all_optional_flags_default_off, true);
  assert.equal(handoff.rollout.flag_can_manufacture_capability, false);
  assert.equal(handoff.rollout.inspection_mutates_canonical_history, false);
});

test('P06-H handoff keeps audio blocked instead of claiming unpublished integration', async () => {
  const handoff = await readHandoff();
  const stage = handoff.stages.find(value => value.id === 'P06-F');
  assert.ok(stage);
  assert.equal(stage.status, 'BLOCKED_EXTERNAL_DISTRIBUTION_GATE');
  assert.equal(handoff.audio_gate.github_release_observed, false);
  assert.equal(handoff.audio_gate.git_tag_observed, false);
  assert.equal(handoff.audio_gate.editor_core_audio_dependency_added_by_p06, false);
  assert.equal(handoff.audio_gate.local_parallel_audition_contract_added_by_p06, false);
  assert.equal(handoff.audio_gate.physical_iphone_audio_pass_claimed, false);
  assert.equal(handoff.audio_gate.unblock_requires_immutable_published_distribution_identity, true);
});

test('P06-H handoff distinguishes completed development stages from final validation', async () => {
  const handoff = await readHandoff();
  const byId = Object.fromEntries(handoff.stages.map(stage => [stage.id, stage.status]));
  assert.equal(byId['P06-A'], 'PASS');
  assert.equal(byId['P06-B'], 'PASS');
  assert.equal(byId['P06-C'], 'PASS');
  assert.equal(byId['P06-D'], 'PASS');
  assert.equal(byId['P06-E'], 'PASS');
  assert.equal(byId['P06-F'], 'BLOCKED_EXTERNAL_DISTRIBUTION_GATE');
  assert.equal(byId['P06-G'], 'PASS');
  assert.equal(byId['P06-H'], 'IN_PROGRESS_FINAL_EXACT_HEAD_VALIDATION_REQUIRED');
  assert.deepEqual(handoff.final_validation.required_on_exact_p06_h_head, [
    'Node 18 core CI',
    'Node 20 core CI',
    'Node 22 core CI',
    'APP-09B/P05 WebKit regression through validation-only PR'
  ]);
  assert.equal(handoff.final_validation.physical_device_pass_inferred_from_automated_validation, false);
});
