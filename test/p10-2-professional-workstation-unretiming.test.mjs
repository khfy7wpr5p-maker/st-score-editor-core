import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createProfessionalWorkstationStandaloneScoreEditorControllerV1
} from '../dist/packages/score-editor-browser-professional-workstation-v1/src/index.js';

test('P10-2 professional workstation composes optional Triplet unretiming without replacing P08 P09 or audio surfaces',()=>{
  const controller=createProfessionalWorkstationStandaloneScoreEditorControllerV1();

  assert.equal(
    typeof controller.getTripletUnretimingState,
    'function',
    'professional workstation must expose the optional P10-2 admission state'
  );
  assert.equal(
    typeof controller.removeTripletFromCapturedEvents,
    'function',
    'professional workstation must expose the bounded Remove Triplet action'
  );

  assert.equal(typeof controller.getKeyboardWorkstationState,'function');
  assert.equal(typeof controller.dispatchKeyboardIntent,'function');
  assert.ok(controller.professional);
  assert.equal(typeof controller.getProfessionalRangeToolbarState,'function');
  assert.equal(typeof controller.getProfessionalStructureInspectorState,'function');
  assert.equal(typeof controller.getAudioHostState,'function');
  assert.equal(typeof controller.attachAudioPort,'function');

  assert.equal(controller.profile.tripletUnretimingAuthoringBundled,true);
  assert.equal(controller.profile.tripletUnretimingCanonicalAuthority,false);
  assert.equal(controller.profile.tripletUnretimingRendererCoordinateAuthority,false);
  assert.equal(controller.profile.productionDefault,false);
  assert.equal(controller.profile.seslitabCutoverAuthorized,false);
});
