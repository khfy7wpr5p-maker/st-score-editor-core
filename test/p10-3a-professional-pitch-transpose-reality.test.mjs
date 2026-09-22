import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('P10-3A repository reality reports bounded optional pitch transpose without overclaiming authority',async()=>{
  const roadmap=await readFile('ROADMAP.md','utf8');
  const productizationMd=await readFile('docs/st-score-editor-app-productization.md','utf8');
  const p08=await readFile('docs/p08b-professional-bulk-authoring.md','utf8');
  const p10Design=await readFile('docs/superpowers/specs/2026-09-19-p10-advanced-score-workstation-design.md','utf8');
  const design=await readFile('docs/superpowers/specs/2026-09-22-p10-3a-professional-pitch-transpose-design.md','utf8');
  const json=JSON.parse(await readFile('docs/st-score-editor-app-productization.json','utf8'));

  for(const text of [roadmap,productizationMd,p08,p10Design,design]){
    assert.match(text,/P10-3A/i);
    assert.match(text,/key-aware/i);
  }
  assert.match(roadmap,/semitone.*(?:±|\+\/-).*12/i);
  assert.match(roadmap,/diatonic.*(?:±|\+\/-).*7/i);
  assert.match(productizationMd,/optional.*P10-3A.*workstation/i);
  assert.match(productizationMd,/P10-1.*preserv/i);
  assert.match(productizationMd,/P10-2.*preserv/i);
  assert.match(p08,/tie.*fail.closed/i);
  assert.match(p08,/grace.*fail.closed/i);
  assert.match(design,/optional.*composition/i);

  assert.equal(json.p10_3a.status,'PROFESSIONAL_PITCH_TRANSPOSE_IMPLEMENTED_QUALIFIED');
  assert.equal(json.p10_3a.package,'editor-professional-pitch-transpose-v1');
  assert.equal(json.p10_3a.session_package,'editor-session-professional-pitch-transpose-v1');
  assert.equal(json.p10_3a.workstation_adapter,'score-editor-professional-pitch-transpose-workstation-v1');
  assert.equal(json.p10_3a.browser_composition,'score-editor-browser-professional-workstation-p10-3a-v1');
  assert.equal(json.p10_3a.optional_artifact,'ST_SCORE_EDITOR_P10_3A_PROFESSIONAL_WORKSTATION_BUNDLE');
  assert.deepEqual(json.p10_3a.selection_profiles,['EVENT_SPAN','EVENT_SET']);
  assert.equal(json.p10_3a.semitone_max_abs,12);
  assert.equal(json.p10_3a.diatonic_max_abs,7);
  assert.equal(json.p10_3a.key_aware_spelling,true);
  assert.equal(json.p10_3a.atomic_pitch_accidental_metadata,true);
  assert.equal(json.p10_3a.tie_relation_closure,false);
  assert.equal(json.p10_3a.grace_relation_closure,false);
  assert.equal(json.p10_3a.history_authority,'EditorHistoryV4');
  assert.equal(json.p10_3a.renderer_coordinate_authority,false);
  assert.equal(json.p10_3a.dom_authoring_authority,false);
  assert.equal(json.p10_3a.p10_1_qualified_artifact_preserved,true);
  assert.equal(json.p10_3a.p10_2_qualified_artifact_preserved,true);
  assert.equal(json.p10_3a.production_default,false);
  assert.equal(json.p10_3a.production_release_authorized,false);
  assert.equal(json.p10_3a.seslitab_cutover_authorized,false);
});
