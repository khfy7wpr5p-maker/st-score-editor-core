import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  createProfessionalWorkstationStandaloneScoreEditorControllerV1,
  professionalWorkstationBrowserAppProfile
} from '../dist/packages/score-editor-browser-professional-workstation-v1/src/index.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

test('P10-1 combined controller exposes P08, P09 and audio-host capabilities over one document lineage', () => {
  const controller = createProfessionalWorkstationStandaloneScoreEditorControllerV1();

  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  assert.ok(controller.getDocument());

  assert.equal(professionalWorkstationBrowserAppProfile.professionalWorkstationComposition, true);
  assert.equal(controller.profile.keyboardWorkstationBundled, true);
  assert.equal(controller.profile.professionalRangeToolbarAvailable, true);
  assert.equal(controller.profile.professionalStructureInspectorAvailable, true);
  assert.equal(controller.profile.noteAuditionAdapterAvailable, true);
  assert.equal(controller.profile.audioHostIntegrated, true);
  assert.equal(controller.profile.audioEngineBundled, false);
  assert.equal(controller.profile.externalAudioRuntimeRequired, true);
  assert.equal(controller.profile.canonicalAuthority, false);
  assert.equal(controller.profile.historyAuthority, 'EditorHistoryV4');
  assert.equal(controller.profile.semanticTargetAuthority, 'SemanticAddressV3-current-revision');
  assert.equal(controller.profile.keyboardCursorAuthority, false);
  assert.equal(controller.profile.professionalSelectionCanonicalAuthority, false);
  assert.equal(controller.profile.productionDefault, false);
  assert.equal(controller.profile.productionReleaseAuthorized, false);
  assert.equal(controller.profile.seslitabCutoverAuthorized, false);
});
