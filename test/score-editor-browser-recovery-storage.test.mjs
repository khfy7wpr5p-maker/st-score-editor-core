import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import {
  createNewScoreEditorAppDocument,
  markScoreEditorAppDocumentSaved,
  commitAppTopologyIntent
} from '../dist/packages/score-editor-app-document/src/index.js';
import {
  createIndexedDbRecoveryRecordStore,
  createRecoveryAutosaveCoordinator,
  scanRecoveryRecordStore,
  MAX_RECOVERY_DOCUMENTS,
  RecoveryStorageError
} from '../dist/packages/score-editor-browser-recovery-storage/src/index.js';

const nodeSha256 = async text => createHash('sha256').update(new TextEncoder().encode(text)).digest('hex');
const idFactory = prefix => {
  let index = 0;
  return () => `${prefix}-${++index}`;
};

const editedDocument = (prefix, revisionId = `${prefix}-edit`) => {
  let document = createNewScoreEditorAppDocument({ title: `Score ${prefix}`, idFactory: idFactory(prefix) });
  document = markScoreEditorAppDocumentSaved(document);
  const score = document.session.history.present.score;
  const part = score.parts[0];
  assert.ok(part);
  return commitAppTopologyIntent(document, {
    version: '1.0.0',
    type: 'RENAME_PART_OR_INSTRUMENT',
    target: addressEntityV3(score, part.id),
    partName: `Piano ${prefix}`,
    instrumentName: `Piano ${prefix}`,
    instrumentShortName: 'Pno.'
  }, { nextRevisionId: revisionId });
};

const memoryStore = () => {
  const values = new Map();
  return {
    api: Object.freeze({
      put: async record => { values.set(record.documentId, structuredClone(record)); },
      list: async () => [...values.values()].map(value => structuredClone(value)),
      delete: async documentId => { values.delete(documentId); },
      clear: async () => { values.clear(); }
    }),
    inject: (key, value) => values.set(key, structuredClone(value)),
    values
  };
};

const sourceFor = initial => {
  let current = initial;
  const listeners = new Set();
  return {
    source: Object.freeze({
      getDocument: () => current,
      subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); }
    }),
    set: next => { current = next; for (const listener of listeners) listener(); }
  };
};

test('APP-05B autosave stores only an eligible immutable dirty revision and scans it through envelope validation', async () => {
  const document = editedDocument('one');
  const holder = sourceFor(document);
  const store = memoryStore();
  const coordinator = createRecoveryAutosaveCoordinator(holder.source, store.api, {
    sha256Hex: nodeSha256,
    nowEpochMs: () => 1000,
    autosaveDelayMs: 60_000
  });
  const record = await coordinator.flush();
  assert.ok(record);
  assert.equal(record.revisionId, 'one-edit');
  assert.equal(record.createdAtEpochMs, 1000);
  assert.equal((await store.api.list()).length, 1);
  const scan = await coordinator.scan();
  assert.equal(scan.valid.length, 1);
  assert.equal(scan.rejected.length, 0);
  assert.equal(scan.valid[0].envelope.payload.revisionId, 'one-edit');
  assert.equal(await coordinator.flush(), null);
  coordinator.dispose();
});

test('APP-05B does not autosave a clean document or a new document with no accepted edit history', async () => {
  const newDocument = createNewScoreEditorAppDocument({ idFactory: idFactory('clean') });
  const holder = sourceFor(newDocument);
  const store = memoryStore();
  const coordinator = createRecoveryAutosaveCoordinator(holder.source, store.api, { sha256Hex: nodeSha256, autosaveDelayMs: 60_000 });
  assert.equal(await coordinator.flush(), null);
  holder.set(markScoreEditorAppDocumentSaved(newDocument));
  assert.equal(await coordinator.flush(), null);
  assert.equal((await store.api.list()).length, 0);
  coordinator.dispose();
});

test('APP-05B refuses to commit an older snapshot if the canonical revision advances during digest creation', async () => {
  const first = editedDocument('race', 'race-edit-1');
  const holder = sourceFor(first);
  const store = memoryStore();
  let release;
  const slowSha = text => new Promise(resolve => { release = () => resolve(createHash('sha256').update(new TextEncoder().encode(text)).digest('hex')); });
  const coordinator = createRecoveryAutosaveCoordinator(holder.source, store.api, { sha256Hex: slowSha, autosaveDelayMs: 60_000 });
  const pending = coordinator.flush();

  const score = first.session.history.present.score;
  const part = score.parts[0];
  assert.ok(part);
  const second = commitAppTopologyIntent(first, {
    version: '1.0.0',
    type: 'RENAME_PART_OR_INSTRUMENT',
    target: addressEntityV3(score, part.id),
    partName: 'Piano race newer',
    instrumentName: 'Piano race newer',
    instrumentShortName: 'Pno.'
  }, { nextRevisionId: 'race-edit-2' });
  holder.set(second);
  assert.ok(release);
  release();
  assert.equal(await pending, null);
  assert.equal((await store.api.list()).length, 0);

  let releaseSecond;
  const secondFlush = coordinator.flush();
  releaseSecond = release;
  assert.ok(releaseSecond);
  releaseSecond();
  const stored = await secondFlush;
  assert.ok(stored);
  assert.equal(stored.revisionId, 'race-edit-2');
  coordinator.dispose();
});

test('APP-05B bounded retention keeps only the newest records for distinct documents', async () => {
  const store = memoryStore();
  for (let index = 0; index < MAX_RECOVERY_DOCUMENTS + 1; index += 1) {
    const document = editedDocument(`retain-${index}`);
    const holder = sourceFor(document);
    const coordinator = createRecoveryAutosaveCoordinator(holder.source, store.api, {
      sha256Hex: nodeSha256,
      nowEpochMs: () => 1000 + index,
      autosaveDelayMs: 60_000
    });
    await coordinator.flush();
    coordinator.dispose();
  }
  const records = await store.api.list();
  assert.equal(records.length, MAX_RECOVERY_DOCUMENTS);
  assert.equal(records.some(record => record.createdAtEpochMs === 1000), false);
});

test('APP-05B scan isolates corrupt records instead of admitting them', async () => {
  const store = memoryStore();
  store.inject('broken', {
    version: '1.0.0',
    documentId: 'broken',
    revisionId: 'broken-revision',
    createdAtEpochMs: 1,
    envelopeJson: '{not-json'
  });
  const scan = await scanRecoveryRecordStore(store.api, { sha256Hex: nodeSha256 });
  assert.equal(scan.valid.length, 0);
  assert.equal(scan.rejected.length, 1);
  assert.equal(scan.rejected[0].documentId, 'broken');
});

test('APP-05B IndexedDB adapter fails closed when browser storage is unavailable', () => {
  assert.throws(
    () => createIndexedDbRecoveryRecordStore(undefined),
    error => error instanceof RecoveryStorageError && error.code === 'RECOVERY_STORAGE_UNAVAILABLE'
  );
});
