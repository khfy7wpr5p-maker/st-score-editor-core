import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readJson = async path => JSON.parse(await readFile(path, 'utf8'));

test('P10-2 productization reality records bounded inverse mutation without default or release cutover', async () => {
  const productization = await readJson('docs/st-score-editor-app-productization.json');
  assert.equal(productization.p10_2.status, 'BOUNDED_UNRETIMING_IMPLEMENTED');
  assert.equal(productization.p10_2.source_admission, 'APP_11J_MAIN');
  assert.equal(productization.p10_2.canonical_mutation_package, 'editor-tuplet-unretiming-authoring-v4');
  assert.equal(productization.p10_2.history_authority, 'EditorSessionV4');
  assert.equal(productization.p10_2.one_user_edit_one_history_revision, true);
  assert.equal(productization.p10_2.exact_undo_redo, true);
  assert.equal(productization.p10_2.browser_surface, 'optional_professional_workstation_decorator');
  assert.equal(productization.p10_2.default_standalone_cutover, false);
  assert.equal(productization.p10_2.production_release_authorized, false);
  assert.equal(productization.p10_2.seslitab_cutover_authorized, false);
  assert.equal(productization.p10_2.arbitrary_tuplet_support, false);

  assert.equal(productization.triplet_product_paths.unretiming.status, 'IMPLEMENTED_BOUNDED_OPTIONAL_WORKSTATION');
  assert.equal(productization.triplet_product_paths.unretiming.canonical_mutation_exposed, true);
  assert.deepEqual(productization.triplet_product_paths.unretiming.rest_actions, [
    'remove_adjacent_rest_when_exactly_consumed',
    'shrink_adjacent_rest_forward_when_larger'
  ]);

  assert.equal(productization.automated_validation.p10_2_straight_triplet_straight_undo_redo_webkit, true);
  assert.equal(productization.automated_validation.p10_2_remount_duplicate_listener_webkit, true);
  assert.equal(productization.release_gate.standaloneReleaseGatePassed, false);
  assert.equal(productization.seslitab_cutover_authorized, false);
  assert.equal(productization.remaining_gates.includes('triplet_removal_unretiming_canonical_mutation'), false);
  assert.equal(productization.remaining_gates.includes('triplet_unretiming_session_browser_productization'), false);
  assert.equal(productization.remaining_gates.includes('arbitrary_tuplet_ratios_cardinalities'), true);
});

test('P10-2 keeps tuplet.triplet keypad semantics unchanged and records removal as a separate bounded surface', async () => {
  const matrix = await readJson('docs/keypad-capability-matrix.json');
  const triplet = matrix.actions.find(action => action.id === 'tuplet.triplet');
  assert.ok(triplet);
  assert.equal(triplet.status, 'IMPLEMENTED_BOUNDED_EXISTING_CANONICAL_3_TO_2_TIMING_ONLY');
  assert.equal(triplet.removalRequiringRetiming, 'BLOCKED_NO_ONSET_MUTATION');

  assert.equal(matrix.separateTripletUnretimingSurface.status, 'IMPLEMENTED_OPTIONAL_WORKSTATION');
  assert.equal(matrix.separateTripletUnretimingSurface.keypadActionOwned, false);
  assert.equal(matrix.separateTripletUnretimingSurface.admission, 'APP_11J');
  assert.equal(matrix.separateTripletUnretimingSurface.historyAuthority, 'EditorSessionV4');
  assert.equal(matrix.separateTripletUnretimingSurface.rendererCoordinateAuthority, false);
  assert.equal(matrix.separateTripletUnretimingSurface.productionActivationAuthority, false);
});
