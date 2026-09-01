import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  EDITOR_KEYPAD_ACTION_IDS,
  EDITOR_KEYPAD_CONTRACT_VERSION,
  EditorKeypadContractError,
  descriptorForEditorKeypadAction,
  getEditorKeypadManifest,
  parseEditorKeypadAction
} from '../dist/packages/editor-keypad/src/index.js';

const contract = JSON.parse(await readFile(new URL('../contracts/editor-keypad-v1.json', import.meta.url), 'utf8'));

const expectedGlyphNames = new Set([
  'noteWhole',
  'noteHalfUp',
  'noteQuarterUp',
  'note8thUp',
  'note16thUp',
  'note32ndUp',
  'restWhole',
  'restHalf',
  'restQuarter',
  'rest8th',
  'rest16th',
  'rest32nd',
  'accidentalFlat',
  'accidentalNatural',
  'accidentalSharp',
  'augmentationDot',
  'tuplet3'
]);

test('keypad manifest is complete immutable framework-neutral metadata', () => {
  const manifest = getEditorKeypadManifest();
  assert.equal(manifest.version, EDITOR_KEYPAD_CONTRACT_VERSION);
  assert.equal(manifest.mode, 'EXISTING_SCORE_CORRECTION');
  assert.equal(manifest.semanticAuthority, 'ACTION_ID_ONLY');
  assert.equal(manifest.glyphMetadataAuthority, false);
  assert.equal(manifest.rawGlyphCodepointsIncluded, false);
  assert.equal(manifest.fontAssetsIncluded, false);
  assert.equal(Object.isFrozen(manifest), true);
  assert.equal(Object.isFrozen(manifest.groups), true);

  const actions = manifest.groups.flatMap((group) => group.actions);
  assert.equal(actions.length, EDITOR_KEYPAD_ACTION_IDS.length);
  assert.deepEqual(actions.map((action) => action.actionId), [...EDITOR_KEYPAD_ACTION_IDS]);
  assert.equal(new Set(actions.map((action) => action.actionId)).size, EDITOR_KEYPAD_ACTION_IDS.length);
  for (const group of manifest.groups) {
    assert.equal(Object.isFrozen(group), true);
    assert.equal(Object.isFrozen(group.actions), true);
    assert.ok(group.accessibleLabelKey.startsWith('keypad.group.'));
    for (const action of group.actions) {
      assert.equal(Object.isFrozen(action), true);
      assert.ok(action.accessibleLabelKey.startsWith('keypad.'));
      if (action.glyph !== null) assert.equal(Object.isFrozen(action.glyph), true);
    }
  }
});

test('SMuFL metadata uses only the officially verified v1 glyph-name subset and no codepoints', () => {
  const manifest = getEditorKeypadManifest();
  const observed = new Set();
  for (const action of manifest.groups.flatMap((group) => group.actions)) {
    if (action.glyph === null) continue;
    observed.add(action.glyph.smuflGlyphName);
    assert.match(action.glyph.smuflGlyphName, /^[A-Za-z][A-Za-z0-9]*$/);
    assert.equal(action.glyph.smuflGlyphName.includes('U+'), false);
    assert.ok([1, 2, 3].includes(action.glyph.repeat));
  }
  assert.deepEqual([...observed].sort(), [...expectedGlyphNames].sort());
  assert.deepEqual([...contract.smufl.verifiedGlyphNames].sort(), [...expectedGlyphNames].sort());
  assert.equal(contract.smufl.rawCodepointContractAllowed, false);
  assert.equal(contract.smufl.fontAssetBundled, false);
});

test('duration rest accidental dot and triplet descriptors carry stable presentation hints only', () => {
  assert.equal(descriptorForEditorKeypadAction('duration.quarter').glyph?.smuflGlyphName, 'noteQuarterUp');
  assert.equal(descriptorForEditorKeypadAction('rest.eighth').glyph?.smuflGlyphName, 'rest8th');
  assert.equal(descriptorForEditorKeypadAction('accidental.sharp').glyph?.smuflGlyphName, 'accidentalSharp');
  assert.deepEqual(descriptorForEditorKeypadAction('dot.set.2').glyph, { smuflGlyphName: 'augmentationDot', repeat: 2 });
  assert.equal(descriptorForEditorKeypadAction('tuplet.triplet').glyph?.smuflGlyphName, 'tuplet3');
  assert.equal(descriptorForEditorKeypadAction('tie.edit').glyph, null);
  assert.equal(descriptorForEditorKeypadAction('tie.edit').hostPrimitiveHint, 'tie');
  assert.equal(descriptorForEditorKeypadAction('slur.edit').glyph, null);
  assert.equal(descriptorForEditorKeypadAction('slur.edit').hostPrimitiveHint, 'slur');
});

test('EditorKeypadAction accepts exact admitted envelopes and unknown or expanded fields fail closed', () => {
  const parsed = parseEditorKeypadAction({ version: '1.0.0', actionId: 'duration.quarter' });
  assert.deepEqual(parsed, { version: '1.0.0', actionId: 'duration.quarter' });
  assert.equal(Object.isFrozen(parsed), true);

  assert.throws(
    () => parseEditorKeypadAction({ version: '1.0.0', actionId: 'duration.64th' }),
    (error) => error instanceof EditorKeypadContractError && error.code === 'INVALID_ACTION'
  );
  assert.throws(
    () => parseEditorKeypadAction({ version: '1.0.0', actionId: 'duration.quarter', codepoint: 'U+E1D5' }),
    (error) => error instanceof EditorKeypadContractError && error.code === 'INVALID_ACTION'
  );
  assert.throws(
    () => parseEditorKeypadAction({ version: '2.0.0', actionId: 'duration.quarter' }),
    (error) => error instanceof EditorKeypadContractError && error.code === 'INVALID_ACTION'
  );
});

test('machine contract and runtime action registry remain exact', () => {
  assert.equal(contract.contract, 'ST_SCORE_EDITOR_KEYPAD');
  assert.equal(contract.version, '1.0.0');
  assert.deepEqual(contract.actionIds, [...EDITOR_KEYPAD_ACTION_IDS]);
  assert.equal(contract.actionEnvelope.containsTargetIdentity, false);
  assert.equal(contract.actionEnvelope.containsRendererIdentity, false);
  assert.equal(contract.actionEnvelope.containsGlyphCodepoint, false);
  assert.equal(contract.execution.implementedInThisContract, false);
  assert.equal(contract.dependencies.newRuntimeDependency, false);
  assert.equal(contract.dependencies.newBuildDependency, false);
});
