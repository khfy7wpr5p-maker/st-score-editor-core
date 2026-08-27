import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const architecture = JSON.parse(await readFile(new URL('../contracts/editor-core-v1.json', import.meta.url), 'utf8'));

test('UI state cannot mutate or authorize canonical score edits', () => {
  const ui = architecture.ui;
  assert.equal(ui.presentationStateAuthoritative, false);
  assert.equal(ui.browserStateAuthoritative, false);
  assert.equal(ui.toolbarStateAuthoritative, false);
  assert.equal(ui.inspectorDraftAuthoritative, false);
  assert.equal(ui.coordinatesAuthoritative, false);
  assert.equal(ui.domIdsAuthoritative, false);
  assert.equal(ui.rendererObjectsAuthoritative, false);
  assert.equal(ui.directCanonicalMutationAllowed, false);
  assert.equal(ui.semanticSelectionRequiredForScoreEdit, true);
  assert.equal(ui.typedIntentRequired, true);
  assert.equal(ui.transactionRequiredForCommit, true);
  assert.equal(ui.staleIntentFailsClosed, true);
  assert.equal(ui.automaticRetargetingAllowed, false);
  assert.equal(ui.productionIntegrationAuthorized, false);
});
