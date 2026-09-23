import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('P10-3B repository reality reports bounded optional professional range replacement without overclaiming authority',async()=>{
  const roadmap=await readFile('ROADMAP.md','utf8');
  const productizationMd=await readFile('docs/st-score-editor-app-productization.md','utf8');
  const architecture=await readFile('ARCHITECTURE.md','utf8');
  const design=await readFile('docs/superpowers/specs/2026-09-23-p10-3b-professional-range-replace-design.md','utf8');
  const json=JSON.parse(await readFile('docs/st-score-editor-app-productization.json','utf8'));

  for(const text of [roadmap,productizationMd,architecture,design]){
    assert.match(text,/P10-3B/i);
    assert.match(text,/range.*replace|replace.*range/i);
  }

  assert.match(roadmap,/EVENT_SPAN/i);
  assert.match(roadmap,/same.*measure|single.*measure/i);
  assert.match(roadmap,/exact.*(?:extent|duration)|(?:extent|duration).*exact/i);
  assert.match(roadmap,/fresh.*(?:event|note).*identit|new.*(?:event|note).*identit/i);
  assert.match(roadmap,/Clear-to-REST/i);
  assert.match(productizationMd,/optional.*P10-3B.*workstation/i);
  assert.match(productizationMd,/P10-3A.*preserv/i);
  assert.match(productizationMd,/Teacher Paste.*(?:unchanged|not.*Replace)|Replace.*not.*Teacher Paste/i);
  assert.match(productizationMd,/one.*Replace.*one.*(?:history|revision)|one.*history.*revision/i);
  assert.match(productizationMd,/automated.*WebKit.*not.*physical|WebKit.*not.*physical/i);
  assert.match(architecture,/ScoreDocumentV3.*NotationDocumentV4/i);
  assert.match(architecture,/EditorHistoryV4|EditorSessionV4/i);
  assert.match(design,/EVENT_SET.*outside|EVENT_SET.*not/i);

  assert.equal(json.p10_3b.status,'PROFESSIONAL_RANGE_REPLACE_IMPLEMENTED_QUALIFICATION_PENDING');
  assert.equal(json.p10_3b.package,'editor-professional-range-replace-v1');
  assert.equal(json.p10_3b.session_package,'editor-session-professional-range-replace-v1');
  assert.equal(json.p10_3b.workstation_adapter,'score-editor-professional-range-replace-workstation-v1');
  assert.equal(json.p10_3b.browser_composition,'score-editor-browser-professional-workstation-p10-3b-v1');
  assert.equal(json.p10_3b.optional_artifact,'ST_SCORE_EDITOR_P10_3B_PROFESSIONAL_WORKSTATION_BUNDLE');
  assert.deepEqual(json.p10_3b.selection_profiles,['EVENT_SPAN']);
  assert.equal(json.p10_3b.same_measure_required,true);
  assert.equal(json.p10_3b.same_part_staff_voice_required,true);
  assert.equal(json.p10_3b.exact_extent_match_required,true);
  assert.equal(json.p10_3b.event_cardinality_may_change,true);
  assert.equal(json.p10_3b.fresh_destination_identity,true);
  assert.equal(json.p10_3b.teacher_copy_snapshot_reused,true);
  assert.equal(json.p10_3b.teacher_paste_semantics_unchanged,true);
  assert.equal(json.p10_3b.delete_semantics,'CLEAR_TO_REST');
  assert.equal(json.p10_3b.relation_remap,false);
  assert.equal(json.p10_3b.one_user_edit_one_history_revision,true);
  assert.equal(json.p10_3b.exact_undo_redo,true);
  assert.equal(json.p10_3b.history_authority,'EditorHistoryV4');
  assert.equal(json.p10_3b.renderer_coordinate_authority,false);
  assert.equal(json.p10_3b.dom_authoring_authority,false);
  assert.equal(json.p10_3b.p10_1_qualified_artifact_preserved,true);
  assert.equal(json.p10_3b.p10_2_qualified_artifact_preserved,true);
  assert.equal(json.p10_3b.p10_3a_qualified_artifact_preserved,true);
  assert.equal(json.p10_3b.bundle_budget_bytes,675840);
  assert.equal(json.p10_3b.bundle_measured_bytes,670198);
  assert.equal(json.p10_3b.bundle_budget_revision,'P10-3B-RANGE-REPLACE-1');
  assert.equal(json.p10_3b.dedicated_mobile_webkit_regression,true);
  assert.equal(json.p10_3b.physical_device_validation_required,true);
  assert.equal(json.p10_3b.physical_device_validation_passed,false);
  assert.equal(json.p10_3b.production_default,false);
  assert.equal(json.p10_3b.production_release_authorized,false);
  assert.equal(json.p10_3b.seslitab_cutover_authorized,false);
});
