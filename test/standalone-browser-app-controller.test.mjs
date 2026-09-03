import test from 'node:test';
import assert from 'node:assert/strict';
import { createStandaloneScoreEditorController } from '../dist/packages/score-editor-browser-app/src/index.js';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';

const deterministicIdFactory = () => {
  let index = 0;
  return () => `id${++index}`;
};

test('APP-03A controller owns one standalone document view over the canonical V4 session', () => {
  const controller = createStandaloneScoreEditorController();
  assert.equal(controller.getSnapshot().hasDocument, false);
  assert.equal(controller.profile.canonicalAuthority, false);
  assert.equal(controller.profile.networkCapable, false);
  assert.equal(controller.profile.persistenceCapable, false);

  const created = controller.newDocument({ title: 'Standalone Test', idFactory: deterministicIdFactory() });
  assert.equal(created.hasDocument, true);
  assert.equal(created.title, 'Standalone Test');
  assert.equal(created.dirty, true);
  assert.equal(controller.getDocument()?.session.history.past.length, 0);
});

test('APP-03A semantic selection and keypad commit use the same V4 document history', () => {
  const controller = createStandaloneScoreEditorController();
  controller.newDocument({ idFactory: deterministicIdFactory() });
  const before = controller.getDocument();
  assert.ok(before);

  const score = before.session.history.present.score;
  const staff = score.parts[0]?.staves[0];
  assert.ok(staff && staff.role !== 'tablature-linked');
  const event = staff.measures[0]?.voices[0]?.events[0];
  assert.ok(event);
  const target = addressEntityV3(score, event.id);
  assert.equal(target.kind, 'event');
  controller.select(target);

  const result = controller.commitKeypad(
    { version: '1.0.0', actionId: 'duration.quarter' },
    null,
    { nextRevisionId: 'rev:app03a-edit1' }
  );
  assert.equal(result.error, null);
  assert.equal(result.revisionId, 'rev:app03a-edit1');

  const after = controller.getDocument();
  assert.ok(after);
  assert.equal(after.session.history.past.length, 1);
  assert.equal(after.session.history.present.score.revision.parentId, score.revision.id);
  const editedStaff = after.session.history.present.score.parts[0]?.staves[0];
  assert.ok(editedStaff && editedStaff.role !== 'tablature-linked');
  const editedEvent = editedStaff.measures[0]?.voices[0]?.events[0];
  assert.deepEqual(editedEvent?.duration, { numerator: 1, denominator: 4 });
  assert.equal(after.session.selection?.kind, 'event');
});
