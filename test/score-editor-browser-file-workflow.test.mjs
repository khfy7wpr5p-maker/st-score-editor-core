import test from 'node:test';
import assert from 'node:assert/strict';
import {
  browserFileWorkflowCapabilities,
  readMusicXmlBrowserFile,
  pickMusicXmlBrowserFile,
  writeMusicXmlBrowserFile,
  createMusicXmlDownloadArtifact,
  BrowserFileWorkflowError,
  MAX_LOCAL_MUSICXML_BYTES
} from '../dist/packages/score-editor-browser-file-workflow/src/index.js';

const xml = '<?xml version="1.0"?><score-partwise version="4.0"></score-partwise>';
const file = (name = 'score.musicxml', text = xml) => ({
  name,
  size: new TextEncoder().encode(text).byteLength,
  type: 'application/xml',
  async text() { return text; }
});

test('APP-04A reads only bounded .musicxml/.xml local files', async () => {
  const result = await readMusicXmlBrowserFile(file());
  assert.equal(result.fileName, 'score.musicxml');
  assert.equal(result.musicXml, xml);
  assert.equal(result.handle, null);
  await assert.rejects(() => readMusicXmlBrowserFile(file('score.mxl')), (error) => error instanceof BrowserFileWorkflowError && error.code === 'UNSUPPORTED_FILE_TYPE');
  await assert.rejects(() => readMusicXmlBrowserFile({ ...file(), size: MAX_LOCAL_MUSICXML_BYTES + 1 }), (error) => error instanceof BrowserFileWorkflowError && error.code === 'FILE_TOO_LARGE');
});

test('APP-04A open picker returns one explicit file handle and never becomes canonical authority', async () => {
  const handle = { kind: 'file', name: 'picked.musicxml', async getFile() { return file('picked.musicxml'); }, async createWritable() { throw new Error('unused'); } };
  const host = { async showOpenFilePicker() { return [handle]; } };
  const capabilities = browserFileWorkflowCapabilities(host);
  assert.equal(capabilities.openPickerAvailable, true);
  assert.equal(capabilities.savePickerAvailable, false);
  assert.equal(capabilities.canonicalAuthority, false);
  const result = await pickMusicXmlBrowserFile(host);
  assert.equal(result.handle, handle);
  assert.equal(result.fileName, 'picked.musicxml');
});

test('APP-04A write resolves only after write and close complete', async () => {
  const calls = [];
  const writable = {
    async write(value) { calls.push(['write', value]); },
    async close() { calls.push(['close']); },
    async abort() { calls.push(['abort']); }
  };
  const handle = { kind: 'file', name: 'saved.musicxml', async getFile() { return file(); }, async createWritable() { calls.push(['createWritable']); return writable; } };
  const host = { async showSaveFilePicker() { calls.push(['showSaveFilePicker']); return handle; } };
  const result = await writeMusicXmlBrowserFile(xml, 'Saved Score', null, host);
  assert.equal(result.handle, handle);
  assert.deepEqual(calls.map((entry) => entry[0]), ['showSaveFilePicker', 'createWritable', 'write', 'close']);
});

test('APP-04A failed write aborts when possible and reports failure', async () => {
  const calls = [];
  const writable = {
    async write() { calls.push('write'); throw new Error('disk full'); },
    async close() { calls.push('close'); },
    async abort() { calls.push('abort'); }
  };
  const handle = { kind: 'file', name: 'failed.musicxml', async getFile() { return file(); }, async createWritable() { return writable; } };
  await assert.rejects(() => writeMusicXmlBrowserFile(xml, 'Failed', handle), (error) => error instanceof BrowserFileWorkflowError && error.code === 'FILE_WRITE_FAILED');
  assert.deepEqual(calls, ['write', 'abort']);
});

test('APP-04A download artifact contains admitted MusicXML text but performs no persistence itself', () => {
  const artifact = createMusicXmlDownloadArtifact(xml, 'My Score.xml');
  assert.equal(artifact.fileName, 'My Score.musicxml');
  assert.equal(artifact.text, xml);
  assert.ok(artifact.byteLength > 0);
  assert.equal(Object.isFrozen(artifact), true);
});
