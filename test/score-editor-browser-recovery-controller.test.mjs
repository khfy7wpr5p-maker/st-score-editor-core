import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import {
  createRecoveryEnabledStandaloneScoreEditorController,
  RecoveryControllerError
} from '../dist/packages/score-editor-browser-app/src/recovery-enabled.js';

const nodeSha256 = async text => createHash('sha256').update(new TextEncoder().encode(text)).digest('hex');
const idFactory = () => {
  let index = 0;
  return () => `recovery-controller-${++index}`;
};
const memoryStore = () => {
  const values = new Map();
  return Object.freeze({
    put: async record => { values.set(record.documentId, structuredClone(record)); },
    list: async () => [...values.values()].map(value => structuredClone(value)),
    delete: async documentId => { values.delete(documentId); },
    clear: async () => { values.clear(); }
  });
};

const renamePart = (controller, revisionId, name) => {
  const document = controller.getDocument();
  assert.ok(document);
  const score = document.session.history.present.score;
  const part = score.parts[0];
  assert.ok(part);
  const result = controller.commitTopology({
    version: '1.0.0',
    type: 'RENAME_PART_OR_INSTRUMENT',
    target: addressEntityV3(score, part.id),
    partName: name,
    instrumentName: name,
    instrumentShortName: 'Pno.'
  }, { nextRevisionId: revisionId });
  assert.equal(result.error, null);
};

test('APP-05C recovery controller stores, scans and prepares without silently replacing live state', async () => {
  const store = memoryStore();
  const controller = createRecoveryEnabledStandaloneScoreEditorController({
    store,
    sha256Hex: nodeSha256,
    autosaveDelayMs: 60_000,
    nowEpochMs: () => 5000
  });
  controller.newDocument({ title: 'Recovery Controller', idFactory: idFactory() });
  renamePart(controller, 'recovery-controller-rev-1', 'Piano Recovery 1');

  const stored = await controller.flushRecovery();
  assert.ok(stored);
  assert.equal(stored.revisionId, 'recovery-controller-rev-1');
  assert.equal(controller.getRecoveryState().lastStoredRevisionId, 'recovery-controller-rev-1');

  renamePart(controller, 'recovery-controller-rev-2', 'Piano Recovery 2');
  const liveBeforePrepare = controller.getDocument();
  assert.ok(liveBeforePrepare);
  assert.equal(liveBeforePrepare.session.history.present.score.revision.id, 'recovery-controller-rev-2');

  const scan = await controller.scanRecoveries();
  assert.equal(scan.valid.length, 1);
  assert.equal(scan.valid[0].record.revisionId, 'recovery-controller-rev-1');

  await assert.rejects(
    () => controller.prepareRecovery(stored.documentId),
    error => error instanceof RecoveryControllerError && error.code === 'RECOVERY_PREPARE_FAILED' && error.details.causeCode === 'RECOVERY_ACTIVE_DOCUMENT_CONFLICT'
  );

  const prepared = await controller.prepareRecovery(stored.documentId, { allowSameDocumentReplace: true });
  assert.equal(prepared.session.history.present.score.revision.id, 'recovery-controller-rev-1');
  assert.equal(prepared.session.history.present.score.parts[0].name, 'Piano Recovery 1');

  const liveAfterPrepare = controller.getDocument();
  assert.ok(liveAfterPrepare);
  assert.equal(liveAfterPrepare.session.history.present.score.revision.id, 'recovery-controller-rev-2');
  assert.equal(liveAfterPrepare.session.history.present.score.parts[0].name, 'Piano Recovery 2');
  assert.equal(controller.getRecoveryState().status.code, 'RECOVERY_PREPARED');
  controller.unmount();
});

test('APP-05C recovery controller degrades without storage and keeps editing surface available', async () => {
  const controller = createRecoveryEnabledStandaloneScoreEditorController({
    store: undefined,
    sha256Hex: nodeSha256,
    autosaveDelayMs: 60_000
  });
  controller.newDocument({ idFactory: idFactory() });
  assert.equal(controller.getSnapshot().hasDocument, true);
  if (controller.getRecoveryState().storageAvailable === false) {
    await assert.rejects(
      () => controller.flushRecovery(),
      error => error instanceof RecoveryControllerError && error.code === 'RECOVERY_UNAVAILABLE'
    );
  }
  controller.unmount();
});
