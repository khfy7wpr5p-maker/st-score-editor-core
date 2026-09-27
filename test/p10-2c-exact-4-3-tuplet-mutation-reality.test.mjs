import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readRoot=relative=>readFile(new URL('../'+relative,import.meta.url),'utf8');

test('P10-2C reality records exact 4:3 core/session mutation without generalized or browser authority',async()=>{
  const [readme,architecture,roadmap,productizationMd,productizationJsonText,p10c]=await Promise.all([
    readRoot('README.md'),
    readRoot('ARCHITECTURE.md'),
    readRoot('ROADMAP.md'),
    readRoot('docs/st-score-editor-app-productization.md'),
    readRoot('docs/st-score-editor-app-productization.json'),
    readRoot('docs/p10-2c-exact-4-3-tuplet-mutation.md')
  ]);
  const productization=JSON.parse(productizationJsonText);

  assert.ok(productization.p10_2c);
  assert.equal(
    productization.p10_2c.status,
    'EXACT_4_3_CORE_SESSION_MUTATION_IMPLEMENTED_QUALIFICATION_PENDING'
  );
  assert.equal(productization.p10_2c.source_admission,'editor-generalized-tuplet-admission-v4');
  assert.deepEqual(productization.p10_2c.profile,{
    actual_notes:4,
    normal_notes:3,
    target_cardinality:4
  });
  assert.equal(
    productization.p10_2c.canonical_mutation_package,
    'editor-four-to-three-tuplet-unretiming-authoring-v4'
  );
  assert.equal(
    productization.p10_2c.session_package,
    'editor-session-four-to-three-tuplet-unretiming-v4'
  );
  assert.equal(productization.p10_2c.history_authority,'EditorHistoryV4');
  assert.equal(productization.p10_2c.one_user_edit_one_history_revision,true);
  assert.equal(productization.p10_2c.exact_undo_redo,true);
  assert.equal(productization.p10_2c.preserve_event_note_identity,true);
  assert.equal(productization.p10_2c.renderer_coordinate_authority,false);
  assert.equal(productization.p10_2c.browser_authoring_authority,false);
  assert.equal(productization.p10_2c.generalized_tuplet_mutation_authorized,false);
  assert.equal(productization.p10_2c.arbitrary_tuplet_support,false);
  assert.equal(productization.p10_2c.production_release_authorized,false);
  assert.equal(productization.p10_2c.seslitab_cutover_authorized,false);

  assert.equal(productization.p10_2b.canonical_mutation_authority,false);
  assert.equal(productization.p10_2b.history_mutation_authority,false);
  assert.equal(
    productization.p10_2.canonical_mutation_package,
    'editor-tuplet-unretiming-authoring-v4'
  );
  assert.equal(
    productization.p10_2.session_package,
    'editor-session-tuplet-unretiming-v4'
  );

  for(const source of [readme,architecture,roadmap,productizationMd,p10c]){
    assert.match(source,/P10-2C/i);
    assert.match(source,/4:3/);
    assert.match(source,/fresh.*P10-2B|P10-2B.*fresh/is);
    assert.match(source,/EditorHistoryV4/);
    assert.match(source,/browser.*(?:not authorized|outside|separate|false)/is);
    assert.match(source,/arbitrary|generalized/i);
    assert.match(source,/(?:not authorized|unauthorized|false)/i);
  }
});
