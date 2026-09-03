import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import {
  createNewScoreEditorAppDocument,
  openMusicXmlScoreEditorAppDocument,
  exportMusicXmlScoreEditorAppDocument,
  markScoreEditorAppDocumentSaved,
  commitAppTopologyIntent,
  navigateAppDocumentHistory,
  ScoreEditorAppDocumentError
} from '../dist/packages/score-editor-app-document/src/index.js';

const idFactory = () => {
  let index = 0;
  return () => `id-${++index}`;
};

const nodeSha256 = async text => createHash('sha256').update(new TextEncoder().encode(text)).digest('hex');

const plans = (score, prefix) => score.measureFrames.map((frame, index) => ({
  frameId: frame.id,
  measureId: `${prefix}-measure-${index + 1}`,
  voiceId: `${prefix}-voice-${index + 1}`,
  restEventId: `${prefix}-rest-${index + 1}`
}));

test('APP-01 creates a standalone blank V4 document and exports admitted MusicXML', () => {
  const document = createNewScoreEditorAppDocument({ title: 'My Score', idFactory: idFactory() });
  assert.equal(document.version, '1.0.0');
  assert.equal(document.title, 'My Score');
  assert.equal(document.origin, 'NEW');
  assert.equal(document.session.version, '4.0.0');
  assert.equal(document.session.history.present.score.schemaVersion, '3.0.0');
  assert.equal(document.session.history.present.notation.contractVersion, '4.0.0');
  assert.equal(document.dirty, true);
  const xml = exportMusicXmlScoreEditorAppDocument(document);
  assert.ok(xml.includes('<score-partwise'));
});

test('APP-01 save marker tracks dirty state through edit and undo without persistence authority', () => {
  let document = createNewScoreEditorAppDocument({ idFactory: idFactory() });
  document = markScoreEditorAppDocumentSaved(document, 'Saved Score');
  assert.equal(document.dirty, false);
  const score = document.session.history.present.score;
  const part = score.parts[0];
  assert.ok(part);
  document = commitAppTopologyIntent(document, {
    version: '1.0.0',
    type: 'RENAME_PART_OR_INSTRUMENT',
    target: addressEntityV3(score, part.id),
    partName: 'Piano Solo',
    instrumentName: 'Piano Solo',
    instrumentShortName: 'Pno.'
  }, { nextRevisionId: 'rev-product-edit-1' });
  assert.equal(document.dirty, true);
  assert.equal(document.session.history.present.score.parts[0].name, 'Piano Solo');
  document = navigateAppDocumentHistory(document, 'UNDO');
  assert.equal(document.dirty, false);
  assert.equal(document.session.history.present.score.parts[0].name, 'Piano');
});

test('APP-01 opens MusicXML into a canonical V4 app document and marks imported revision clean', async () => {
  const original = createNewScoreEditorAppDocument({ idFactory: idFactory() });
  const xml = exportMusicXmlScoreEditorAppDocument(original);
  const expectedSha256 = await nodeSha256(xml);
  const imported = await openMusicXmlScoreEditorAppDocument(xml, { title: 'Imported', sha256Hex: nodeSha256 });
  assert.equal(imported.origin, 'MUSICXML');
  assert.equal(imported.title, 'Imported');
  assert.equal(imported.dirty, false);
  assert.equal(imported.session.history.present.score.source.format, 'musicxml');
  assert.equal(imported.session.history.present.score.source.byteLength, new TextEncoder().encode(xml).byteLength);
  assert.equal(imported.session.history.present.score.source.sha256, expectedSha256);
});

test('APP-01 rejects an invalid injected source digest instead of accepting fake identity', async () => {
  const original = createNewScoreEditorAppDocument({ idFactory: idFactory() });
  const xml = exportMusicXmlScoreEditorAppDocument(original);
  await assert.rejects(
    () => openMusicXmlScoreEditorAppDocument(xml, { sha256Hex: async () => 'not-a-sha256' }),
    error => error instanceof ScoreEditorAppDocumentError && error.code === 'INVALID_SHA256_RESULT'
  );
});

test('APP-01 fails closed when current topology has no admitted lossless MusicXML export', () => {
  let document = createNewScoreEditorAppDocument({ idFactory: idFactory() });
  const score = document.session.history.present.score;
  const part = score.parts[0];
  assert.ok(part);
  document = commitAppTopologyIntent(document, {
    version: '1.0.0',
    type: 'ADD_STANDARD_OR_PERCUSSION_STAFF',
    target: addressEntityV3(score, part.id),
    index: 1,
    staffId: 'product-staff-2',
    staffRole: 'standard',
    frameRestIds: plans(score, 'product-staff-2')
  }, { nextRevisionId: 'rev-product-staff-2' });
  assert.throws(
    () => exportMusicXmlScoreEditorAppDocument(document),
    error => error instanceof ScoreEditorAppDocumentError && error.code === 'EXPORT_UNAVAILABLE'
  );
});
