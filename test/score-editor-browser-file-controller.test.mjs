import test from 'node:test';
import assert from 'node:assert/strict';
import { createFileEnabledStandaloneScoreEditorController } from '../dist/packages/score-editor-browser-app/src/file-enabled.js';

const deterministicIdFactory = (prefix) => {
  let index = 0;
  return () => `${prefix}${++index}`;
};

const writableHandle = (name, calls, options = {}) => ({
  kind: 'file',
  name,
  async getFile() { throw new Error('unused'); },
  async createWritable() {
    calls.push(`${name}:createWritable`);
    return {
      async write(value) {
        calls.push(`${name}:write`);
        if (options.failWrite) throw new Error('write failed');
        assert.equal(typeof value, 'string');
        assert.match(value, /score-partwise/);
      },
      async close() { calls.push(`${name}:close`); },
      async abort() { calls.push(`${name}:abort`); }
    };
  }
});

test('APP-04B successful save marks the document saved only after write and close complete', async () => {
  const controller = createFileEnabledStandaloneScoreEditorController();
  controller.newDocument({ title: 'Save Order', idFactory: deterministicIdFactory('a') });
  assert.equal(controller.getSnapshot().dirty, true);

  const calls = [];
  const handle = writableHandle('save-order.musicxml', calls);
  const host = {
    async showSaveFilePicker() { calls.push('showSaveFilePicker'); return handle; }
  };
  const saved = await controller.saveToFile(host);
  assert.equal(saved.dirty, false);
  assert.deepEqual(calls, [
    'showSaveFilePicker',
    'save-order.musicxml:createWritable',
    'save-order.musicxml:write',
    'save-order.musicxml:close'
  ]);
  assert.equal(controller.getFileWorkflowState().associatedFileName, 'save-order.musicxml');
  assert.equal(controller.getFileWorkflowState().associatedDocumentId, controller.getDocument().session.history.present.score.id);
});

test('APP-04B failed write never marks the canonical document saved', async () => {
  const controller = createFileEnabledStandaloneScoreEditorController();
  controller.newDocument({ title: 'Write Failure', idFactory: deterministicIdFactory('b') });
  const revision = controller.getSnapshot().revisionId;
  assert.equal(controller.getSnapshot().dirty, true);

  const calls = [];
  const handle = writableHandle('failed.musicxml', calls, { failWrite: true });
  const host = { async showSaveFilePicker() { calls.push('showSaveFilePicker'); return handle; } };
  await assert.rejects(() => controller.saveToFile(host), /Save failed/);
  assert.equal(controller.getSnapshot().dirty, true);
  assert.equal(controller.getSnapshot().revisionId, revision);
  assert.deepEqual(calls, [
    'showSaveFilePicker',
    'failed.musicxml:createWritable',
    'failed.musicxml:write',
    'failed.musicxml:abort'
  ]);
});

test('APP-04B download marks saved only after injected handoff resolves', async () => {
  const controller = createFileEnabledStandaloneScoreEditorController();
  controller.newDocument({ title: 'Download Score', idFactory: deterministicIdFactory('c') });
  const calls = [];
  const result = await controller.downloadFile(async (artifact) => {
    calls.push('handoff');
    assert.equal(artifact.fileName, 'Download Score.musicxml');
    assert.match(artifact.text, /score-partwise/);
    assert.equal(controller.getSnapshot().dirty, true);
  });
  assert.deepEqual(calls, ['handoff']);
  assert.equal(result.dirty, false);
});

test('APP-04B failed download handoff leaves document dirty', async () => {
  const controller = createFileEnabledStandaloneScoreEditorController();
  controller.newDocument({ title: 'Download Failure', idFactory: deterministicIdFactory('d') });
  await assert.rejects(
    () => controller.downloadFile(async () => { throw new Error('handoff rejected'); }),
    /Download failed/
  );
  assert.equal(controller.getSnapshot().dirty, true);
});

test('APP-04B never reuses a file handle associated with a different canonical document id', async () => {
  const controller = createFileEnabledStandaloneScoreEditorController();
  controller.newDocument({ title: 'First', idFactory: deterministicIdFactory('first') });

  const firstCalls = [];
  const firstHandle = writableHandle('first.musicxml', firstCalls);
  await controller.saveToFile({ async showSaveFilePicker() { return firstHandle; } });
  assert.equal(controller.getSnapshot().dirty, false);

  controller.newDocument({ title: 'Second', idFactory: deterministicIdFactory('second') });
  assert.equal(controller.getSnapshot().dirty, true);

  const secondCalls = [];
  const secondHandle = writableHandle('second.musicxml', secondCalls);
  let pickerCount = 0;
  await controller.saveToFile({ async showSaveFilePicker() { pickerCount += 1; return secondHandle; } });
  assert.equal(pickerCount, 1);
  assert.deepEqual(secondCalls, [
    'second.musicxml:createWritable',
    'second.musicxml:write',
    'second.musicxml:close'
  ]);
  assert.deepEqual(firstCalls, [
    'first.musicxml:createWritable',
    'first.musicxml:write',
    'first.musicxml:close'
  ]);
});
