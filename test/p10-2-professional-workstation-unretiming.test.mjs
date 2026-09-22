import test from 'node:test';
import assert from 'node:assert/strict';

test('P10-2 optional workstation composes Triplet unretiming over the qualified P10-1 controller without replacing P08 P09 or audio surfaces',async()=>{
  const module=await import('../dist/packages/score-editor-browser-professional-workstation-p10-2-v1/src/index.js').catch(()=>({}));
  assert.equal(
    typeof module.createP10_2ProfessionalWorkstationStandaloneScoreEditorControllerV1,
    'function',
    'P10-2 optional workstation composition must exist before exposure can pass'
  );

  const controller=module.createP10_2ProfessionalWorkstationStandaloneScoreEditorControllerV1();

  assert.equal(typeof controller.getTripletUnretimingState,'function');
  assert.equal(typeof controller.removeTripletFromCapturedEvents,'function');

  assert.equal(typeof controller.getKeyboardWorkstationState,'function');
  assert.equal(typeof controller.dispatchKeyboardIntent,'function');
  assert.ok(controller.professional);
  assert.equal(typeof controller.getProfessionalRangeToolbarState,'function');
  assert.equal(typeof controller.getProfessionalStructureInspectorState,'function');
  assert.equal(typeof controller.getAudioHostState,'function');
  assert.equal(typeof controller.attachAudioPort,'function');

  assert.equal(controller.profile.p10_2WorkstationComposition,true);
  assert.equal(controller.profile.tripletUnretimingAuthoringBundled,true);
  assert.equal(controller.profile.tripletUnretimingCanonicalAuthority,false);
  assert.equal(controller.profile.tripletUnretimingRendererCoordinateAuthority,false);
  assert.equal(controller.profile.p10_1QualifiedBasePreserved,true);
  assert.equal(controller.profile.productionDefault,false);
  assert.equal(controller.profile.productionReleaseAuthorized,false);
  assert.equal(controller.profile.seslitabCutoverAuthorized,false);
});
