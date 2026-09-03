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
  createScoreEditorRecoveryEnvelope,
  serializeScoreEditorRecoveryEnvelope,
  validateScoreEditorRecoveryEnvelope,
  restoreScoreEditorRecoveryEnvelope,
  ScoreEditorRecoveryError
} from '../dist/packages/score-editor-app-recovery/src/index.js';

const idFactory = () => {
  let index = 0;
  return () => `recovery-id-${++index}`;
};
const nodeSha256 = async text => createHash('sha256').update(new TextEncoder().encode(text)).digest('hex');
const editedDocument = () => {
  let document = createNewScoreEditorAppDocument({ title: 'Recovery Score', idFactory: idFactory() });
  document = markScoreEditorAppDocumentSaved(document);
  const score = document.session.history.present.score;
  const part = score.parts[0];
  assert.ok(part);
  document = commitAppTopologyIntent(document, {
    version: '1.0.0',
    type: 'RENAME_PART_OR_INSTRUMENT',
    target: addressEntityV3(score, part.id),
    partName: 'Recovered Piano',
    instrumentName: 'Recovered Piano',
    instrumentShortName: 'Rec.'
  }, { nextRevisionId: 'recovery-edit-rev-1' });
  return document;
};

test('APP-05A creates, validates and restores an exact current V4 recovery snapshot', async () => {
  const document = editedDocument();
  const envelope = await createScoreEditorRecoveryEnvelope(document, { nowEpochMs: 123456789, sha256Hex: nodeSha256 });
  assert.equal(envelope.payload.revisionId, 'recovery-edit-rev-1');
  assert.equal(envelope.payload.createdAtEpochMs, 123456789);
  const validated = await validateScoreEditorRecoveryEnvelope(serializeScoreEditorRecoveryEnvelope(envelope), { sha256Hex: nodeSha256 });
  const restored = restoreScoreEditorRecoveryEnvelope(validated);
  assert.equal(restored.title, 'Recovery Score');
  assert.equal(restored.dirty, true);
  assert.equal(restored.session.history.present.score.revision.id, 'recovery-edit-rev-1');
  assert.equal(restored.session.history.present.score.parts[0].name, 'Recovered Piano');
  assert.equal(restored.session.history.present.notation.revisionId, 'recovery-edit-rev-1');
  assert.equal(restored.session.history.past.length, 0);
  assert.equal(restored.session.history.future.length, 0);
});

test('APP-05A detects payload tampering before recovery admission', async () => {
  const envelope = await createScoreEditorRecoveryEnvelope(editedDocument(), { sha256Hex: nodeSha256 });
  const parsed = JSON.parse(serializeScoreEditorRecoveryEnvelope(envelope));
  parsed.payload.title = 'Tampered Title';
  await assert.rejects(
    () => validateScoreEditorRecoveryEnvelope(JSON.stringify(parsed), { sha256Hex: nodeSha256 }),
    error => error instanceof ScoreEditorRecoveryError && error.code === 'RECOVERY_INTEGRITY_MISMATCH'
  );
});

test('APP-05A rejects metadata that disagrees with the canonical pair', async () => {
  const envelope = await createScoreEditorRecoveryEnvelope(editedDocument(), { sha256Hex: nodeSha256 });
  const parsed = JSON.parse(serializeScoreEditorRecoveryEnvelope(envelope));
  parsed.payload.documentId = 'foreign-document-id';
  await assert.rejects(
    () => validateScoreEditorRecoveryEnvelope(JSON.stringify(parsed), { sha256Hex: nodeSha256 }),
    error => error instanceof ScoreEditorRecoveryError && error.code === 'RECOVERY_METADATA_MISMATCH'
  );
});

test('APP-05A rejects canonical corruption even before digest admission', async () => {
  const envelope = await createScoreEditorRecoveryEnvelope(editedDocument(), { sha256Hex: nodeSha256 });
  const parsed = JSON.parse(serializeScoreEditorRecoveryEnvelope(envelope));
  parsed.payload.score.parts[0].ordinal = 99;
  await assert.rejects(
    () => validateScoreEditorRecoveryEnvelope(JSON.stringify(parsed), { sha256Hex: nodeSha256 }),
    error => error instanceof ScoreEditorRecoveryError && error.code === 'RECOVERY_CANONICAL_INVALID'
  );
});

test('APP-05A never silently replaces an active document', async () => {
  const envelope = await createScoreEditorRecoveryEnvelope(editedDocument(), { sha256Hex: nodeSha256 });
  assert.throws(
    () => restoreScoreEditorRecoveryEnvelope(envelope, { activeDocumentId: envelope.payload.documentId }),
    error => error instanceof ScoreEditorRecoveryError && error.code === 'RECOVERY_ACTIVE_DOCUMENT_CONFLICT'
  );
  const admitted = restoreScoreEditorRecoveryEnvelope(envelope, { activeDocumentId: envelope.payload.documentId, allowSameDocumentReplace: true });
  assert.equal(admitted.session.history.present.score.revision.id, envelope.payload.revisionId);
});

test('APP-05A rejects an invalid injected digest provider', async () => {
  await assert.rejects(
    () => createScoreEditorRecoveryEnvelope(editedDocument(), { sha256Hex: async () => 'fake-digest' }),
    error => error instanceof ScoreEditorRecoveryError && error.code === 'INVALID_SHA256_RESULT'
  );
});
