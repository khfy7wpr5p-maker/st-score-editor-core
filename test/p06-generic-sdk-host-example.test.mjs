import test from 'node:test';
import assert from 'node:assert/strict';
import { runP06GenericSdkHostExample } from '../examples/p06-generic-sdk-host.mjs';

test('P06-D generic host opens, edits, presents, undoes and degrades optional capabilities independently', async () => {
  const result = await runP06GenericSdkHostExample();
  assert.equal(result.sdkVersion, '1.0.0');
  assert.equal(result.openedRevisionId, 'rev:p06-generic-open');
  assert.equal(result.editedRevisionId, 'rev:p06-generic-edit');
  assert.notEqual(result.undoRevisionId, result.editedRevisionId);
  assert.equal(result.undoFutureCount, 1);
  assert.ok(result.snapshots.some(entry => entry.phase === 'mount'));
  assert.ok(result.snapshots.some(entry => entry.phase === 'update'));
  assert.ok(result.snapshots.some(entry => entry.phase === 'unmount'));
  assert.equal(result.degraded.rendererAvailable, false);
  assert.equal(result.degraded.playbackAvailable, false);
  assert.equal(result.degraded.rendererResult.ok, false);
  assert.equal(result.degraded.rendererResult.error.code, 'UNSUPPORTED_CAPABILITY');
  assert.equal(result.degraded.playbackResult.ok, false);
  assert.equal(result.degraded.playbackResult.error.code, 'UNSUPPORTED_CAPABILITY');
});
