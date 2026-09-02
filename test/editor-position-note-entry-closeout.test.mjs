import test from 'node:test';
import assert from 'node:assert/strict';

import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { addressEntity } from '../dist/packages/addressing/src/index.js';
import { createNotationDocument } from '../dist/packages/notation-structure/src/index.js';
import { createInsertionPosition } from '../dist/packages/editor-insertion-position/src/index.js';
import {
  executePositionNoteEntry,
  PositionNoteEntryError
} from '../dist/packages/editor-position-note-entry/src/index.js';
import {
  createEditorHistory,
  commitEditorHistory,
  rebindNotationAfterScoreEdit,
  undoEditorHistory,
  redoEditorHistory
} from '../dist/packages/editor-history/src/index.js';
import { createRendererRequest } from '../dist/packages/renderer-contract/src/index.js';

const makeScore = (events = null, revisionId = 'rev-1', parentId = null) => createScoreDocument({
  schemaVersion: '1.0.0',
  id: 'doc-position-entry-closeout',
  revision: { id: revisionId, parentId },
  source: { sha256: 'e'.repeat(64), format: 'synthetic', byteLength: null },
  parts: [{
    id: 'part-1', name: 'Piano', staves: [{
      id: 'staff-1', ordinal: 1, measures: [{
        id: 'measure-1', ordinal: 1, displayNumber: '1', voices: [{
          id: 'voice-1', ordinal: 1, events: events ?? [{
            id: 'rest-main', kind: 'rest',
            onset: { numerator: 0, denominator: 1 },
            duration: { numerator: 1, denominator: 1 }
          }]
        }]
      }]
    }]
  }]
});

const notationFor = (score) => createNotationDocument(score, {
  contractVersion: '1.0.0',
  documentId: score.id,
  revisionId: score.revision.id,
  measures: [{
    target: addressEntity(score, 'measure-1'),
    notation: {
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: null,
      clef: null,
      barlines: []
    }
  }],
  events: [],
  notes: []
});

const positionAt = (score, numerator, denominator) => {
  const voice = addressEntity(score, 'voice-1');
  assert.equal(voice.kind, 'voice');
  return createInsertionPosition(score, voice, { numerator, denominator });
};

const intent = (overrides = {}) => ({
  version: '1.0.0',
  type: 'ENTER_NOTE_AT_POSITION',
  noteId: 'note-new',
  pitch: { step: 'G', alter: 0, octave: 4 },
  duration: { numerator: 1, denominator: 4 },
  leadingRestEventId: 'rest-leading',
  trailingRestEventId: 'rest-trailing',
  ...overrides
});

const identity = (nextRevisionId = 'rev-2') => ({
  operationId: `position-entry-${nextRevisionId}`,
  nextRevisionId
});

const eventsOf = (score) => score.parts[0].staves[0].measures[0].voices[0].events;

test('exact rest fill creates only the note and preserves the authorized event id', () => {
  const score = makeScore();
  const next = executePositionNoteEntry(
    score,
    notationFor(score),
    positionAt(score, 0, 1),
    intent({
      duration: { numerator: 1, denominator: 1 },
      leadingRestEventId: null,
      trailingRestEventId: null
    }),
    identity()
  );

  assert.deepEqual(eventsOf(next), [{
    id: 'rest-main',
    kind: 'note',
    onset: { numerator: 0, denominator: 1 },
    duration: { numerator: 1, denominator: 1 },
    note: { id: 'note-new', pitch: { step: 'G', alter: 0, octave: 4 } }
  }]);
});

test('invalid rational durations and measure overflow fail closed without mutating the base score', () => {
  const score = makeScore();
  const notation = notationFor(score);
  const start = positionAt(score, 0, 1);

  for (const duration of [
    { numerator: 0, denominator: 1 },
    { numerator: -1, denominator: 4 },
    { numerator: 2, denominator: 4 },
    { numerator: 1, denominator: 0 }
  ]) {
    assert.throws(
      () => executePositionNoteEntry(score, notation, start, intent({ duration }), identity(`bad-${duration.numerator}-${duration.denominator}`)),
      (error) => error instanceof PositionNoteEntryError && error.code === 'INVALID_INTENT'
    );
  }

  assert.throws(
    () => executePositionNoteEntry(
      score,
      notation,
      positionAt(score, 3, 4),
      intent({ duration: { numerator: 1, denominator: 2 }, trailingRestEventId: null }),
      identity('overflow')
    ),
    (error) => error instanceof PositionNoteEntryError && error.code === 'WINDOW_NOT_AUTHORIZED'
  );

  assert.equal(score.revision.id, 'rev-1');
  assert.deepEqual(eventsOf(score), [{
    id: 'rest-main', kind: 'rest',
    onset: { numerator: 0, denominator: 1 },
    duration: { numerator: 1, denominator: 1 }
  }]);
});

test('stale notation and duplicate note/rest identities are rejected', () => {
  const base = makeScore();
  const current = makeScore(null, 'rev-current', 'rev-1');

  assert.throws(
    () => executePositionNoteEntry(
      current,
      notationFor(base),
      positionAt(current, 1, 4),
      intent(),
      identity('rev-after-stale-notation')
    ),
    (error) => error instanceof Error && /revision|stale/i.test(error.message)
  );

  assert.throws(
    () => executePositionNoteEntry(
      base,
      notationFor(base),
      positionAt(base, 1, 4),
      intent({ noteId: 'voice-1' }),
      identity('duplicate-note')
    ),
    (error) => error instanceof PositionNoteEntryError && error.code === 'ID_CONFLICT'
  );

  assert.throws(
    () => executePositionNoteEntry(
      base,
      notationFor(base),
      positionAt(base, 1, 4),
      intent({ leadingRestEventId: 'staff-1' }),
      identity('duplicate-rest')
    ),
    (error) => error instanceof PositionNoteEntryError && error.code === 'ID_CONFLICT'
  );
});

test('primitive composes atomically with unified history and revision-bound rendering', () => {
  const score = makeScore();
  const notation = notationFor(score);
  const originalEvents = structuredClone(eventsOf(score));
  const history = createEditorHistory(score, notation);

  const nextScore = executePositionNoteEntry(
    score,
    notation,
    positionAt(score, 1, 4),
    intent(),
    identity('rev-history')
  );
  const nextNotation = rebindNotationAfterScoreEdit(score, notation, nextScore);
  const committed = commitEditorHistory(history, nextScore, nextNotation);
  const request = createRendererRequest(committed.present.score, committed.present.notation, 'osmd');

  assert.equal(committed.present.score.revision.id, 'rev-history');
  assert.equal(committed.present.notation.revisionId, 'rev-history');
  assert.equal(request.revisionId, 'rev-history');
  assert.equal(request.manifest.revisionId, 'rev-history');

  const committedEvents = structuredClone(eventsOf(committed.present.score));
  const undone = undoEditorHistory(committed);
  assert.equal(undone.present.score.revision.id, 'rev-1');
  assert.deepEqual(eventsOf(undone.present.score), originalEvents);
  assert.equal(undone.present.notation.revisionId, 'rev-1');

  const redone = redoEditorHistory(undone);
  assert.equal(redone.present.score.revision.id, 'rev-history');
  assert.deepEqual(eventsOf(redone.present.score), committedEvents);
  assert.equal(redone.present.notation.revisionId, 'rev-history');
});
