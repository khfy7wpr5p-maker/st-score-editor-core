import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SCORE_EDITOR_SDK_OPTIONAL_FEATURE_IDS_V1,
  DEFAULT_SCORE_EDITOR_SDK_FEATURE_FLAGS_V1,
  ScoreEditorSdkRolloutV1Error,
  createScoreEditorSdkRolloutGateV1,
  createScoreEditorSdkV1
} from '../dist/packages/score-editor-sdk-v1/public.js';

const ids = () => {
  let n = 0;
  return () => `p06-flag-id-${++n}`;
};

test('P06-G optional SDK features are default-off and frozen', () => {
  const sdk = createScoreEditorSdkV1();
  const gate = createScoreEditorSdkRolloutGateV1(sdk);
  const snapshot = gate.snapshot();

  assert.equal(snapshot.version, '1.0.0');
  assert.equal(snapshot.sdkVersion, '1.0.0');
  assert.deepEqual(snapshot.flags, DEFAULT_SCORE_EDITOR_SDK_FEATURE_FLAGS_V1);
  assert.equal(Object.isFrozen(snapshot.flags), true);
  assert.equal(Object.isFrozen(snapshot.features), true);
  assert.deepEqual(snapshot.features.map(({ feature }) => feature), [...SCORE_EDITOR_SDK_OPTIONAL_FEATURE_IDS_V1]);
  for (const state of snapshot.features) {
    assert.equal(state.requested, false);
    assert.equal(state.enabled, false);
    assert.equal(state.reason, 'FLAG_DISABLED');
  }
});

test('P06-G a requested flag cannot enable a capability the SDK does not provide', () => {
  const sdk = createScoreEditorSdkV1();
  const gate = createScoreEditorSdkRolloutGateV1(sdk, { audioAudition: true, renderer: true });

  const audio = gate.getState('audioAudition');
  assert.equal(audio.requested, true);
  assert.equal(audio.capabilityAvailable, false);
  assert.equal(audio.enabled, false);
  assert.equal(audio.reason, 'CAPABILITY_UNAVAILABLE');

  const renderer = gate.getState('renderer');
  assert.equal(renderer.requested, true);
  assert.equal(renderer.capabilityAvailable, false);
  assert.equal(renderer.enabled, false);
  assert.equal(renderer.reason, 'CAPABILITY_UNAVAILABLE');
});

test('P06-G capability plus explicit flag is required to enable an optional feature', () => {
  const probe = Object.freeze({ supports: capability => capability === 'renderer' });
  const disabled = createScoreEditorSdkRolloutGateV1(probe);
  const enabled = createScoreEditorSdkRolloutGateV1(probe, { renderer: true });

  assert.equal(disabled.isEnabled('renderer'), false);
  assert.equal(disabled.getState('renderer').reason, 'FLAG_DISABLED');
  assert.equal(enabled.isEnabled('renderer'), true);
  assert.equal(enabled.getState('renderer').reason, 'ENABLED');
  assert.equal(enabled.isEnabled('files'), false);
});

test('P06-G malformed or unknown feature flags fail closed', () => {
  const sdk = createScoreEditorSdkV1();
  assert.throws(
    () => createScoreEditorSdkRolloutGateV1(sdk, { audioAudition: 'yes' }),
    error => error instanceof ScoreEditorSdkRolloutV1Error && error.code === 'INVALID_FEATURE_FLAGS'
  );
  assert.throws(
    () => createScoreEditorSdkRolloutGateV1(sdk, { hiddenExperimentalMode: true }),
    error => error instanceof ScoreEditorSdkRolloutV1Error && error.code === 'INVALID_FEATURE_FLAGS'
  );
});

test('P06-G rollout inspection does not mutate canonical revision or history', () => {
  const sdk = createScoreEditorSdkV1();
  const created = sdk.document.newDocument({ title: 'Flag Gate', preset: 'GUITAR_TREBLE', idFactory: ids() });
  assert.equal(created.ok, true);

  const before = sdk.getSnapshot();
  const gate = createScoreEditorSdkRolloutGateV1(sdk, { audioAudition: true, playback: true });
  gate.snapshot();
  gate.getState('audioAudition');
  gate.isEnabled('playback');
  const after = sdk.getSnapshot();

  assert.equal(after.documentId, before.documentId);
  assert.equal(after.revisionId, before.revisionId);
  assert.equal(after.historyPastCount, before.historyPastCount);
  assert.equal(after.historyFutureCount, before.historyFutureCount);
});
