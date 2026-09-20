import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  createAudioHostIntegratedStandaloneScoreEditorController
} from '../dist/packages/score-editor-browser-app/src/audio-host-integrated.js';
import {
  attachProfessionalRangeToolbarToBrowserControllerV1
} from '../dist/packages/score-editor-browser-professional-ui-v1/src/index.js';
import {
  attachProfessionalStructureInspectorToRangeControllerV1
} from '../dist/packages/score-editor-browser-professional-structure-ui-v1/src/index.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

test('P10-1 P08 UI decorators reuse an injected browser controller lineage', () => {
  const base = createAudioHostIntegratedStandaloneScoreEditorController();
  const range = attachProfessionalRangeToolbarToBrowserControllerV1(base);
  const structure = attachProfessionalStructureInspectorToRangeControllerV1(range);

  structure.newDocument({ preset: 'GUITAR_TREBLE' });

  assert.equal(base.getDocument(), range.getDocument());
  assert.equal(base.getDocument(), structure.getDocument());
  assert.equal(range.professional.base.getDocument(), base.getDocument());
  assert.equal(structure.professional.base.getDocument(), base.getDocument());
});
