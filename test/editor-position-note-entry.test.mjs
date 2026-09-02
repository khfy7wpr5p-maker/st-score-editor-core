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

const makeScore = (events = null, revisionId = 'rev-1', parentId = null) => createScoreDocument({
  schemaVersion: '1.0.0',
  id: 'doc-position-entry',
  revision: { id: revisionId, parentId },
  source: { sha256: 'f'.repeat(64), format: 'synthetic', byteLength: null },
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
  pitch: { step: 'F', alter: 1, octave: 4 },
  duration: { numerator: 1, denominator: 4 },
  leadingRestEventId: 'rest-leading',
  trailingRestEventId: 'rest-trailing',
  ...overrides
});

const identity = (nextRevisionId = 'rev-2') => ({
  operationId: `op-${nextRevisionId}`,
  nextRevisionId
});

const eventsOf = (score) => score.parts[0].staves[0].measures[0].voices[0].events;

test('entry inside one explicit rest atomically creates leading rest, note, and trailing rest', () => {
  const score = makeScore();
  const next = executePositionNoteEntry(
    score,
    notationFor(score),
    positionAt(score, 1, 4),
    intent(),
    identity()
  );

  assert.equal(next.revision.id, 'rev-2');
  assert.equal(next.revision.parentId, 'rev-1');
  assert.deepEqual(eventsOf(next), [
    {
      id: 'rest-leading', kind: 'rest',
      onset: { numerator: 0, denominator: 1 },
      duration: { numerator: 1, denominator: 4 }
    },
    {
      id: 'rest-main', kind: 'note',
      onset: { numerator: 1, denominator: 4 },
      duration: { numerator: 1, denominator: 4 },
      note: { id: 'note-new', pitch: { step: 'F', alter: 1, octave: 4 } }
    },
    {
      id: 'rest-trailing', kind: 'rest',
      onset: { numerator: 1, denominator: 2 },
      duration: { numerator: 1, denominator: 2 }
    }
  ]);
  assert.equal(eventsOf(score).length, 1);
  assert.equal(eventsOf(score)[0].kind, 'rest');
  assert.equal(Object.isFrozen(next), true);
});

test('entry at rest start requires no leading id and preserves trailing silence', () => {
  const score = makeScore();
  const next = executePositionNoteEntry(
    score,
    notationFor(score),
    positionAt(score, 0, 1),
    intent({ leadingRestEventId: null }),
    identity('rev-start')
  );

  assert.equal(eventsOf(next).length, 2);
  assert.equal(eventsOf(next)[0].id, 'rest-main');
  assert.equal(eventsOf(next)[0].kind, 'note');
  assert.equal(eventsOf(next)[1].id, 'rest-trailing');
  assert.deepEqual(eventsOf(next)[1].onset, { numerator: 1, denominator: 4 });
  assert.deepEqual(eventsOf(next)[1].duration, { numerator: 3, denominator: 4 });
});

test('entry ending at rest end requires no trailing id', () => {
  const score = makeScore();
  const next = executePositionNoteEntry(
    score,
    notationFor(score),
    positionAt(score, 3, 4),
    intent({ trailingRestEventId: null }),
    identity('rev-end')
  );

  assert.equal(eventsOf(next).length, 2);
  assert.equal(eventsOf(next)[0].id, 'rest-leading');
  assert.deepEqual(eventsOf(next)[0].duration, { numerator: 3, denominator: 4 });
  assert.equal(eventsOf(next)[1].id, 'rest-main');
  assert.equal(eventsOf(next)[1].kind, 'note');
  assert.deepEqual(eventsOf(next)[1].onset, { numerator: 3, denominator: 4 });
});

test('missing or unexpected split identities fail closed', () => {
  const score = makeScore();
  const notation = notationFor(score);
  const middle = positionAt(score, 1, 4);

  assert.throws(
    () => executePositionNoteEntry(score, notation, middle, intent({ leadingRestEventId: null }), identity('rev-no-leading')),
    (error) => error instanceof PositionNoteEntryError && error.code === 'LEADING_REST_ID_REQUIRED'
  );
  assert.throws(
    () => executePositionNoteEntry(score, notation, positionAt(score, 0, 1), intent(), identity('rev-extra-leading')),
    (error) => error instanceof PositionNoteEntryError && error.code === 'LEADING_REST_ID_UNEXPECTED'
  );
  assert.throws(
    () => executePositionNoteEntry(score, notation, middle, intent({ trailingRestEventId: null }), identity('rev-no-trailing')),
    (error) => error instanceof PositionNoteEntryError && error.code === 'TRAILING_REST_ID_REQUIRED'
  );
});

test('pitched windows and implicit gaps cannot authorize position note entry', () => {
  const pitchedScore = makeScore([{
    id: 'note-existing-event', kind: 'note',
    onset: { numerator: 0, denominator: 1 },
    duration: { numerator: 1, denominator: 2 },
    note: { id: 'note-existing', pitch: { step: 'C', alter: 0, octave: 4 } }
  }]);
  assert.throws(
    () => executePositionNoteEntry(
      pitchedScore,
      notationFor(pitchedScore),
      positionAt(pitchedScore, 1, 4),
      intent(),
      identity('rev-blocked')
    ),
    (error) => error instanceof PositionNoteEntryError &&
      error.code === 'WINDOW_NOT_AUTHORIZED' &&
      error.details.classification === 'BLOCKED_PITCHED'
  );

  const gapScore = makeScore([{
    id: 'note-late-event', kind: 'note',
    onset: { numerator: 1, denominator: 2 },
    duration: { numerator: 1, denominator: 4 },
    note: { id: 'note-late', pitch: { step: 'D', alter: 0, octave: 4 } }
  }]);
  assert.throws(
    () => executePositionNoteEntry(
      gapScore,
      notationFor(gapScore),
      positionAt(gapScore, 1, 4),
      intent(),
      identity('rev-gap')
    ),
    (error) => error instanceof PositionNoteEntryError &&
      error.code === 'WINDOW_NOT_AUTHORIZED' &&
      error.details.classification === 'IMPLICIT_GAP_UNADMITTED'
  );
});

test('stale insertion positions and identity collisions cannot mutate a newer score', () => {
  const base = makeScore();
  const stale = positionAt(base, 1, 4);
  const next = makeScore(null, 'rev-2', 'rev-1');

  assert.throws(
    () => executePositionNoteEntry(next, notationFor(next), stale, intent(), identity('rev-3')),
    (error) => error instanceof Error && error.message.includes('stale')
  );

  assert.throws(
    () => executePositionNoteEntry(
      base,
      notationFor(base),
      positionAt(base, 1, 4),
      intent({ noteId: 'voice-1' }),
      identity('rev-collision')
    ),
    (error) => error instanceof PositionNoteEntryError && error.code === 'ID_CONFLICT'
  );
  assert.equal(base.revision.id, 'rev-1');
  assert.equal(eventsOf(base)[0].kind, 'rest');
});
