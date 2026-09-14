import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readHandoff = async () => JSON.parse(
  await readFile(new URL('../docs/p06-sdk-final-handoff.json', import.meta.url), 'utf8')
);

const readAudioStatus = async () => JSON.parse(
  await readFile(new URL('../docs/p06-audio-v010-status.json', import.meta.url), 'utf8')
);

test('P06 current handoff preserves canonical authority boundaries', async () => {
  const handoff = await readHandoff();
  assert.equal(handoff.schema_version, '1.0.0');
  assert.equal(handoff.project, 'st-score-editor-core');
  assert.equal(handoff.status, 'PRODUCTION_INTEGRATED_AUDIO_V010');
  assert.equal(handoff.authority.canonical_score, 'ScoreDocumentV3 + NotationDocumentV4');
  assert.equal(handoff.authority.history, 'EditorSessionV4');
  assert.equal(handoff.authority.semantic_identity, 'SemanticAddressV3');
  assert.equal(handoff.authority.sdk_is_canonical_authority, false);
  assert.equal(handoff.authority.renderer_is_canonical_authority, false);
  assert.equal(handoff.authority.audio_is_canonical_authority, false);
  assert.equal(handoff.frozen_boundaries.seslitab_cutover_authorized, false);
  assert.equal(handoff.frozen_boundaries.unqualified_instrument_fallback_authorized, false);
});

test('P06 current handoff records public contract, audio module and default-off rollout', async () => {
  const handoff = await readHandoff();
  assert.equal(handoff.public_contract.sdk_version, '1.0.0');
  assert.equal(handoff.public_contract.negotiation_version, '1.0.0');
  assert.equal(handoff.public_contract.public_entry, 'packages/score-editor-sdk-v1/public.ts');
  assert.deepEqual(handoff.public_contract.public_modules, [
    './src/index.js',
    './version-negotiation.js',
    './rollout.js',
    './audio-v010.js'
  ]);
  assert.equal(handoff.rollout.all_optional_flags_default_off, true);
  assert.equal(handoff.rollout.flag_can_manufacture_capability, false);
  assert.equal(handoff.rollout.inspection_mutates_canonical_history, false);
});

test('P06-F distribution gate is resolved by the official Audio Engine v0.1.0 identity', async () => {
  const handoff = await readHandoff();
  const stage = handoff.stages.find(value => value.id === 'P06-F');
  assert.ok(stage);
  assert.equal(stage.status, 'PASS_RESOLVED_BY_P06_F2');
  assert.equal(stage.integration_pull_request, 166);
  assert.equal(stage.validation_pull_request, 167);
  assert.equal(handoff.audio_gate.release, 'v0.1.0');
  assert.equal(handoff.audio_gate.release_commit, 'd11a2dd9141169ddfec5901f3cadc4cce0d7b345');
  assert.equal(handoff.audio_gate.github_release_observed, true);
  assert.equal(handoff.audio_gate.git_tag_observed, true);
  assert.equal(handoff.audio_gate.official_release_artifacts_pinned, true);
  assert.equal(handoff.audio_gate.local_parallel_audition_contract_added_by_p06, false);
  assert.equal(handoff.audio_gate.stale_revision_rechecked_before_audition, true);
  assert.equal(handoff.audio_gate.rest_non_note_silent, true);
  assert.equal(handoff.audio_gate.audition_creates_history_revision, false);
});

test('P06 production evidence points to the merged P06 and static-site heads', async () => {
  const handoff = await readHandoff();
  assert.equal(handoff.production_evidence.production_merge_pr, 169);
  assert.equal(handoff.production_evidence.production_merge_commit, '30c16f61b016ae7e659d91bfc36f858e856fbfe0');
  assert.equal(handoff.production_evidence.production_site_pr, 170);
  assert.equal(handoff.production_evidence.production_site_commit, '519adabf2b91b15b8fa263b5d8a45bf4992a227b');
  assert.equal(handoff.production_evidence.render_last_deploy_commit, '519adabf2b91b15b8fa263b5d8a45bf4992a227b');
  assert.equal(handoff.production_evidence.render_last_deploy_status, 'live');
  assert.equal(handoff.production_evidence.render_service_currently_suspended_by_user, true);
});

test('P06 physical evidence stays scoped and instrument readiness remains fail-closed', async () => {
  const handoff = await readHandoff();
  assert.equal(handoff.instrument_readiness.GRAND_PIANO, 'ACTIVE_QUALIFIED');
  assert.equal(handoff.instrument_readiness.CLASSICAL_GUITAR, 'SUSPENDED');
  assert.equal(handoff.instrument_readiness.VIOLIN, 'SCAFFOLD_UNQUALIFIED');
  assert.equal(handoff.physical_evidence.iphone_safari_score_editor_grand_piano_note_touch_pass, true);
  assert.equal(handoff.physical_evidence.production_render_physical_revalidation_completed, false);
  assert.equal(handoff.physical_evidence.automated_webkit_is_physical_speaker_evidence, false);
});

test('P06-F2 status file matches the current production integration state', async () => {
  const status = await readAudioStatus();
  assert.equal(status.stage, 'P06-F2');
  assert.equal(status.status, 'PASS_PRODUCTION_INTEGRATED');
  assert.equal(status.upstream.release, 'v0.1.0');
  assert.equal(status.upstream.browser_asset_sha256, '0f25713f481c42d7a1909e15f968635202d3247203402d8f9f95c19a0a0fb99c');
  assert.equal(status.evidence.production_merge_pr, 169);
  assert.equal(status.evidence.production_site_pr, 170);
  assert.equal(status.instrument_readiness.GRAND_PIANO, 'ACTIVE_QUALIFIED');
  assert.equal(status.instrument_readiness.CLASSICAL_GUITAR, 'SUSPENDED');
  assert.equal(status.deployment.last_deploy_status, 'live');
  assert.equal(status.deployment.service_currently_suspended_by_user, true);
  assert.equal(status.seslitab_cutover_authorized, false);
});
