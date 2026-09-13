import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readUtf8 = (path) => readFile(path, 'utf8');

test('P05 physical Task 2 browser artifact exposes the bounded teacher controls without new authority', async () => {
  const manifest = JSON.parse(await readUtf8('dist/browser/st-score-editor-app.manifest.json'));
  const bundle = await readUtf8('dist/browser/st-score-editor-app.js');

  assert.equal(manifest.teacherWorkflowCommandsBundled, true);
  assert.equal(manifest.teacherWorkflowHistoryAuthority, 'EditorSessionV4');
  assert.equal(manifest.teacherWorkflowPaste, 'bounded-neutral-rest-overwrite');
  assert.equal(manifest.teacherWorkflowRendererCoordinateAuthority, false);
  assert.equal(manifest.teacherWorkflowDomAuthoringAuthority, false);
  assert.equal(manifest.mobileTeacherToolbarBundled, true);
  assert.equal(manifest.mobileTeacherToolbarSelectionAuthority, 'SemanticAddressV3-current-revision');
  assert.equal(manifest.mobileTeacherToolbarRendererCoordinateAuthority, false);
  assert.equal(manifest.mobileTeacherToolbarDomAuthoringAuthority, false);
  assert.equal(manifest.mobileTeacherViewportBundled, true);
  assert.equal(manifest.manualDeviceValidationRequired, true);
  assert.equal(manifest.standaloneReleaseGatePassed, false);
  assert.equal(manifest.seslitabCutoverAuthorized, false);

  for (const label of [
    'Capture teacher range start',
    'Copy captured teacher range',
    'Paste over selected rest',
    'Undo last edit'
  ]) {
    assert.match(bundle, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('P05 physical Task 2 preview composes semantic unique-rest selection with the hardened touch path', async () => {
  const stable = await readUtf8('scripts/assemble-app09b-preview-stable.mjs');
  const hardened = await readUtf8('scripts/assemble-app09b-preview-stable-rest-v2.mjs');

  assert.match(stable, /uniqueCanonicalRestAddress/);
  assert.match(stable, /controller\.select\(restAddress\)/);
  assert.match(stable, /APP09B_UNIQUE_REST_SELECTION_MUTATED_HISTORY/);
  assert.match(stable, /if \(rests\.length > 1\) return null/);
  assert.match(hardened, /hit\.reason === 'UNMAPPED_ELEMENT' && renderedStaveEntry/);
  assert.match(hardened, /hit\.reason !== 'NO_NOTE_OWNER' && !boundedUnmappedRestEvidence/);
  assert.match(hardened, /preserveMobileTeacherActionScroll/);
});
