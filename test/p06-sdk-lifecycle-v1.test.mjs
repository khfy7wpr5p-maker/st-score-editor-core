import test from 'node:test';
import assert from 'node:assert/strict';
import { createScoreEditorSdkV1 } from '../dist/packages/score-editor-sdk-v1/src/index.js';

const ids = prefix => {
  let index = 0;
  return () => `${prefix}-${++index}`;
};

const host = (overrides = {}) => {
  const calls = { mounts: 0, updates: 0, unmounts: 0 };
  const value = Object.freeze({
    contractVersion: '1.0.0',
    onMount(snapshot) { calls.mounts += 1; overrides.onMount?.(snapshot); },
    onUpdate(snapshot) { calls.updates += 1; overrides.onUpdate?.(snapshot); },
    onUnmount() { calls.unmounts += 1; overrides.onUnmount?.(); }
  });
  return { value, calls };
};

test('P06-C mount/update/unmount/remount lifecycle is reusable and history-invariant', () => {
  const sdk = createScoreEditorSdkV1();
  const created = sdk.document.newDocument({ title: 'Lifecycle', idFactory: ids('life') });
  assert.equal(created.ok, true);
  const expected = sdk.getRevisionGuard();
  assert.ok(expected);
  const before = sdk.getSnapshot();
  assert.equal(before.historyPastCount, 0);
  assert.equal(before.historyFutureCount, 0);

  const mounted = host();
  const firstMount = sdk.lifecycle.mount(mounted.value);
  assert.equal(firstMount.ok, true);
  assert.equal(firstMount.value.phase, 'MOUNTED');
  assert.equal(mounted.calls.mounts, 1);
  assert.equal(mounted.calls.updates, 0);

  const explicitUpdate = sdk.lifecycle.update();
  assert.equal(explicitUpdate.ok, true);
  assert.equal(mounted.calls.updates, 1);

  const selected = sdk.selection.select(null, expected);
  assert.equal(selected.ok, true);
  assert.equal(mounted.calls.updates, 2);
  assert.deepEqual(sdk.getRevisionGuard(), expected);
  assert.equal(sdk.getSnapshot().historyPastCount, 0);
  assert.equal(sdk.getSnapshot().historyFutureCount, 0);

  const firstUnmount = sdk.lifecycle.unmount();
  assert.equal(firstUnmount.ok, true);
  assert.equal(firstUnmount.value.phase, 'UNMOUNTED');
  assert.equal(mounted.calls.unmounts, 1);

  const selectedWhileUnmounted = sdk.selection.select(null, expected);
  assert.equal(selectedWhileUnmounted.ok, true);
  assert.equal(mounted.calls.updates, 2);

  const secondMount = sdk.lifecycle.mount(mounted.value);
  assert.equal(secondMount.ok, true);
  assert.equal(mounted.calls.mounts, 2);
  sdk.selection.select(null, expected);
  assert.equal(mounted.calls.updates, 3);

  const disposed = sdk.lifecycle.dispose();
  assert.equal(disposed.ok, true);
  assert.equal(disposed.value.phase, 'DISPOSED');
  assert.equal(disposed.value.disposed, true);
  assert.equal(mounted.calls.unmounts, 2);
  assert.deepEqual(sdk.getRevisionGuard(), expected);
  assert.equal(sdk.getSnapshot().historyPastCount, before.historyPastCount);
  assert.equal(sdk.getSnapshot().historyFutureCount, before.historyFutureCount);

  const repeatedDispose = sdk.lifecycle.dispose();
  assert.equal(repeatedDispose.ok, true);
  assert.equal(repeatedDispose.value.phase, 'DISPOSED');
  assert.equal(mounted.calls.unmounts, 2);
});

test('P06-C rejects duplicate hosts and keeps the original host uniquely mounted', () => {
  const sdk = createScoreEditorSdkV1();
  const first = host();
  const second = host();
  assert.equal(sdk.lifecycle.mount(first.value).ok, true);
  const duplicate = sdk.lifecycle.mount(second.value);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.error.code, 'SDK_ALREADY_MOUNTED');
  assert.equal(first.calls.mounts, 1);
  assert.equal(second.calls.mounts, 0);
  assert.equal(sdk.lifecycle.getState().mounted, true);
  assert.equal(sdk.lifecycle.unmount().ok, true);
  assert.equal(first.calls.unmounts, 1);
  assert.equal(second.calls.unmounts, 0);
});

test('P06-C host callback failure is presentation-only and cannot invalidate a canonical operation', () => {
  const sdk = createScoreEditorSdkV1();
  const failing = host({
    onUpdate() { throw Object.assign(new Error('host-render-failed'), { code: 'HOST_RENDER_FAILED' }); }
  });
  assert.equal(sdk.lifecycle.mount(failing.value).ok, true);

  const created = sdk.document.newDocument({ title: 'Still committed', idFactory: ids('host-fail') });
  assert.equal(created.ok, true);
  assert.equal(created.value.hasDocument, true);
  assert.equal(sdk.getSnapshot().title, 'Still committed');
  assert.equal(sdk.getSnapshot().historyPastCount, 0);
  assert.equal(failing.calls.updates, 1);
  const lifecycle = sdk.lifecycle.getState();
  assert.equal(lifecycle.lastHostError?.code, 'HOST_RENDER_FAILED');
  assert.equal(lifecycle.lastHostError?.message, 'host-render-failed');
});

test('P06-C subscriber failure is isolated from canonical mutation and retained as diagnostics', () => {
  const sdk = createScoreEditorSdkV1();
  const unsubscribe = sdk.subscribe(() => {
    throw Object.assign(new Error('subscriber-failed'), { code: 'SUBSCRIBER_FAILED' });
  });
  const created = sdk.document.newDocument({ idFactory: ids('listener') });
  assert.equal(created.ok, true);
  assert.equal(sdk.getSnapshot().hasDocument, true);
  assert.equal(sdk.lifecycle.getState().listenerErrorCount, 1);
  assert.equal(sdk.lifecycle.getState().lastListenerError?.code, 'SUBSCRIBER_FAILED');
  unsubscribe();
  sdk.selection.select(null, sdk.getRevisionGuard());
  assert.equal(sdk.lifecycle.getState().listenerErrorCount, 1);
});

test('P06-C disposal is terminal for canonical and lifecycle actions but read-only state remains inspectable', () => {
  const sdk = createScoreEditorSdkV1();
  const created = sdk.document.newDocument({ idFactory: ids('dispose') });
  assert.equal(created.ok, true);
  const expected = sdk.getRevisionGuard();
  const before = sdk.getSnapshot();
  assert.equal(sdk.lifecycle.dispose().ok, true);

  const afterDisposeCreate = sdk.document.newDocument({ idFactory: ids('forbidden') });
  assert.equal(afterDisposeCreate.ok, false);
  assert.equal(afterDisposeCreate.error.code, 'SDK_DISPOSED');

  const afterDisposeSelect = sdk.selection.select(null, expected);
  assert.equal(afterDisposeSelect.ok, false);
  assert.equal(afterDisposeSelect.error.code, 'SDK_DISPOSED');

  const afterDisposeMount = sdk.lifecycle.mount(host().value);
  assert.equal(afterDisposeMount.ok, false);
  assert.equal(afterDisposeMount.error.code, 'SDK_DISPOSED');

  const afterDisposeUpdate = sdk.lifecycle.update();
  assert.equal(afterDisposeUpdate.ok, false);
  assert.equal(afterDisposeUpdate.error.code, 'SDK_DISPOSED');

  const afterDisposeUnmount = sdk.lifecycle.unmount();
  assert.equal(afterDisposeUnmount.ok, false);
  assert.equal(afterDisposeUnmount.error.code, 'SDK_DISPOSED');

  assert.deepEqual(sdk.getRevisionGuard(), expected);
  assert.deepEqual(sdk.getSnapshot(), before);
  assert.equal(sdk.lifecycle.getState().phase, 'DISPOSED');
});

test('P06-C invalid host and update-without-mount fail closed without touching score state', () => {
  const sdk = createScoreEditorSdkV1();
  const before = sdk.getSnapshot();
  const invalid = sdk.lifecycle.mount({ contractVersion: '0.0.0' });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error.code, 'SDK_HOST_INVALID');
  const update = sdk.lifecycle.update();
  assert.equal(update.ok, false);
  assert.equal(update.error.code, 'SDK_NOT_MOUNTED');
  assert.deepEqual(sdk.getSnapshot(), before);
});
