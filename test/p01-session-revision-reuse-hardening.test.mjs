import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import {
  createNewScoreEditorAppDocument,
  commitAppBasicAuthoringIntent,
  commitAppKeypadAction,
  selectAppSemanticAddress
} from '../dist/packages/score-editor-app-document/src/index.js';
import { EditorSessionV4Error } from '../dist/packages/editor-session-controller-v4/src/index.js';

const ids = () => {
  let value = 0;
  return () => `p01-revision-${++value}`;
};

const firstEvent = document =>
  document.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events[0];

const pitchedWhole = () => {
  let document = createNewScoreEditorAppDocument({ idFactory: ids(), preset: 'GUITAR_TREBLE' });
  const score = document.session.history.present.score;
  const event = firstEvent(document);
  document = commitAppBasicAuthoringIntent(
    document,
    {
      version: '1.0.0',
      type: 'REPLACE_REST_WITH_NOTE',
      target: addressEntityV3(score, event.id),
      noteId: 'p01-revision-note',
      pitch: { step: 'C', alter: 0, octave: 4 }
    },
    { nextRevisionId: 'p01-revision-current' }
  );
  return document;
};

const assertRevisionReuse = operation => assert.throws(
  operation,
  error => error instanceof EditorSessionV4Error && error.code === 'REVISION_ID_REUSE'
);

test('P01 V4 session rejects immediate-parent revision reuse before Basic timing mutation and preserves the exact pair', () => {
  const document = pitchedWhole();
  const before = structuredClone(document.session.history);
  const score = document.session.history.present.score;
  const event = firstEvent(document);
  const parentRevisionId = score.revision.parentId;
  assert.ok(parentRevisionId);

  assertRevisionReuse(() => commitAppBasicAuthoringIntent(
    document,
    {
      version: '1.0.0',
      type: 'SET_EVENT_DURATION',
      target: addressEntityV3(score, event.id),
      duration: { numerator: 1, denominator: 2 }
    },
    { nextRevisionId: parentRevisionId }
  ));

  assert.deepEqual(document.session.history, before);
  assert.deepEqual(firstEvent(document).duration, { numerator: 1, denominator: 1 });
});

test('P01 V4 session rejects immediate-parent revision reuse before timing-safe keypad mutation and preserves history', () => {
  let document = pitchedWhole();
  const score = document.session.history.present.score;
  const parentRevisionId = score.revision.parentId;
  assert.ok(parentRevisionId);
  document = selectAppSemanticAddress(document, addressEntityV3(score, firstEvent(document).id));
  const before = structuredClone(document.session.history);

  assertRevisionReuse(() => commitAppKeypadAction(
    document,
    { version: '1.0.0', actionId: 'duration.half' },
    null,
    { nextRevisionId: parentRevisionId }
  ));

  assert.deepEqual(document.session.history, before);
  assert.deepEqual(firstEvent(document).duration, { numerator: 1, denominator: 1 });
});
