import test from 'node:test';
import assert from 'node:assert/strict';
import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { createEditorUiState, reduceEditorUiState } from '../dist/packages/editor-ui-contract/src/index.js';
import { createEditorShellModel } from '../dist/packages/editor-shell/src/index.js';

const score = createScoreDocument({
  schemaVersion:'1.0.0', id:'doc-1', revision:{id:'rev-1',parentId:null}, source:{sha256:'a'.repeat(64),format:'canonical',byteLength:null},
  parts:[{id:'part-1',name:'Piano',staves:[{id:'staff-1',ordinal:1,measures:[{id:'measure-1',ordinal:1,displayNumber:'1',voices:[{id:'voice-1',ordinal:1,events:[{id:'event-1',kind:'note',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:4},note:{id:'note-1',pitch:{step:'C',alter:0,octave:4}}}]}]}]}]}]
});

test('editor UI reducer changes only ephemeral presentation state', () => {
  const initial = createEditorUiState();
  const next = reduceEditorUiState(initial, { type:'SET_TOOL', tool:'tie' });
  assert.equal(initial.activeTool, 'select');
  assert.equal(next.activeTool, 'tie');
  assert.equal(Object.isFrozen(initial), true);
  assert.equal(Object.isFrozen(next), true);
  assert.equal(Object.prototype.hasOwnProperty.call(next, 'score'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(next, 'commit'), false);
});

test('editor shell exposes view composition but no score mutation authority', () => {
  let ui = createEditorUiState();
  ui = reduceEditorUiState(ui, { type:'SET_VIEWPORT', viewport:{zoom:1.5,scrollX:12,scrollY:24} });
  const shell = createEditorShellModel(score, ui);
  assert.equal(shell.documentId, 'doc-1');
  assert.equal(shell.revisionId, 'rev-1');
  assert.equal(shell.parts[0].name, 'Piano');
  assert.equal(shell.scoreViewport.zoom, 1.5);
  assert.equal(Object.isFrozen(shell), true);
  assert.equal(Object.isFrozen(shell.parts), true);
  assert.equal(Object.prototype.hasOwnProperty.call(shell, 'mutate'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(shell, 'renderer'), false);
});

test('invalid zoom fails closed', () => {
  const ui = createEditorUiState();
  assert.throws(() => reduceEditorUiState(ui, { type:'SET_VIEWPORT', viewport:{zoom:99,scrollX:0,scrollY:0} }), RangeError);
});
