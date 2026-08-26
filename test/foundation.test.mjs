import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

test('authority boundary forbids renderer and AI mutation', async () => {
  const authority = await readJson('contracts/authority-boundary-v1.json');
  assert.equal(authority.renderer.presentationOnly, true);
  assert.equal(authority.renderer.mayMutateCanonicalScore, false);
  assert.equal(authority.ai.advisoryOnly, true);
  assert.equal(authority.ai.mayMutateCanonicalScore, false);
  assert.equal(authority.ai.mayBypassValidation, false);
});

test('edit acceptance remains atomic and fail-closed', async () => {
  const authority = await readJson('contracts/authority-boundary-v1.json');
  assert.equal(authority.edits.atomicTransactionRequired, true);
  assert.equal(authority.edits.validationRequiredBeforeAcceptance, true);
  assert.equal(authority.edits.partialAuthoritativeApplyAllowed, false);
  assert.equal(authority.edits.staleTargetFailsClosed, true);
});

test('foundation admits no external dependencies', async () => {
  const pkg = await readJson('package.json');
  const architecture = await readJson('contracts/editor-core-v1.json');
  assert.deepEqual(pkg.dependencies, {});
  assert.deepEqual(pkg.devDependencies, {});
  for (const candidate of Object.values(architecture.rendererCandidates)) {
    assert.equal(candidate.admittedDependency, false);
  }
});
