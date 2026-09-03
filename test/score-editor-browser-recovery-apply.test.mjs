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
  return () => `recovery-apply-${++index}`;
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
const writableHandle = name => ({
  kind: 'file',
  name,
  async getFile() { throw new Error('unused'); },
  async createWritable() {
    return {
      async write(value) { assert.match(value, /score-partwise/); },
      async close() {},
      async abort() {}
    };
  }
});
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
const setup = async () => {
  const store = memoryStore();
  const controller = createRecoveryEnabledStandaloneScoreEditorController({
    store,
    sha256Hex: nodeSha256,
    autosaveDelayMs: 60_000,
    nowEpochMs: () => 7000
  });
  controller.newDocument({ title: 'Recovery Apply', idFactory: idFactory() });
  const initialDocument = controller.getDocument();
  assert.ok(initialDocument);
  const documentId = initialDocument.session.history.present.score.id;

  // Establish the local file association while the blank score is still inside
  // the admitted lossless MusicXML projection. APP-05D must not weaken export
  // gates merely to construct a recovery/file-association regression fixture.
  await controller.saveToFile({ async showSaveFilePicker() { return writableHandle('recovery-apply.musicxml'); } });
  assert.equal(controller.getFileWorkflowState().associatedDocumentId, documentId);

  renamePart(controller, 'recovery-apply-rev-1', 'Recovered Revision');
  const stored = await controller.flushRecovery();
  assert.ok(stored);
  assert.equal(stored.documentId, documentId);
  assert.equal(stored.revisionId, 'recovery-apply-rev-1');
  assert.equal(controller.getFileWorkflowState().associatedDocumentId, documentId);

  renamePart(controller, 'recovery-apply-rev-2', 'Live Revision');
  return { controller, store, stored };
};

test('APP-05D explicitly applies a prepared recovery and clears stale file/cache association', async () => {
  const { controller, store, stored } = await setup();
  const prepared = await controller.prepareRecoveryApplication(stored.documentId, { allowSameDocumentReplace: true });
  assert.equal(prepared.recoveryRevisionId, 'recovery-apply-rev-1');
  assert.equal(prepared.activeRevisionIdAtPrepare, 'recovery-apply-rev-2');
  assert.equal(controller.getSnapshot().revisionId, 'recovery-apply-rev-2');

  const applied = await controller.applyPreparedRecovery(prepared);
  assert.equal(applied.error, null);
  assert.equal(applied.revisionId, 'recovery-apply-rev-1');
  const document = controller.getDocument();
  assert.ok(document);
  assert.equal(document.session.history.present.score.parts[0].name, 'Recovered Revision');
  assert.equal(document.session.history.past.length, 0);
  assert.equal(document.session.history.future.length, 0);
  assert.equal(controller.getFileWorkflowState().associatedDocumentId, null);
  assert.equal(controller.getFileWorkflowState().associatedFileName, null);
  assert.equal((await store.list()).length, 0);
  assert.equal(controller.getRecoveryState().status.code, 'RECOVERY_APPLIED');
  controller.unmount();
});

test('APP-05D rejects a prepared recovery if live canonical revision changed after preparation', async () => {
  const { controller, stored } = await setup();
  const prepared = await controller.prepareRecoveryApplication(stored.documentId, { allowSameDocumentReplace: true });
  renamePart(controller, 'recovery-apply-rev-3', 'Newer Live Revision');

  await assert.rejects(
    () => controller.applyPreparedRecovery(prepared),
    error => error instanceof RecoveryControllerError && error.code === 'RECOVERY_APPLY_CONFLICT'
  );
  assert.equal(controller.getSnapshot().revisionId, 'recovery-apply-rev-3');
  assert.equal(controller.getDocument().session.history.present.score.parts[0].name, 'Newer Live Revision');
  controller.unmount();
});

test('APP-05D revalidates the prepared canonical snapshot and leaves live state unchanged on corruption', async () => {
  const { controller, stored } = await setup();
  const prepared = structuredClone(await controller.prepareRecoveryApplication(stored.documentId, { allowSameDocumentReplace: true }));
  prepared.document.session.history.present.notation.documentId = 'corrupt-document-id';

  await assert.rejects(
    () => controller.applyPreparedRecovery(prepared),
    error => error instanceof RecoveryControllerError && error.code === 'RECOVERY_APPLY_FAILED'
  );
  assert.equal(controller.getSnapshot().revisionId, 'recovery-apply-rev-2');
  assert.equal(controller.getDocument().session.history.present.score.parts[0].name, 'Live Revision');
  assert.equal(controller.getFileWorkflowState().associatedDocumentId, stored.documentId);
  controller.unmount();
});
