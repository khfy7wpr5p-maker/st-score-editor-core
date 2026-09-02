import test from 'node:test';
import assert from 'node:assert/strict';

import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { addressEntity } from '../dist/packages/addressing/src/index.js';
import { createNotationDocument } from '../dist/packages/notation-structure/src/index.js';
import { createInsertionPosition } from '../dist/packages/editor-insertion-position/src/index.js';
import {
  analyzeMeasureTiming,
  classifyInsertionWindow,
  MeasureTimingError
} from '../dist/packages/editor-measure-timing/src/index.js';

const scoreInput = (measure2Events = null) => ({
  schemaVersion: '1.0.0',
  id: 'doc-timing',
  revision: { id: 'rev-1', parentId: null },
  source: { sha256: 'e'.repeat(64), format: 'synthetic', byteLength: null },
  parts: [{
    id: 'part-1', name: 'Piano', staves: [{
      id: 'staff-1', ordinal: 1, measures: [
        {
          id: 'measure-1', ordinal: 1, displayNumber: '1', voices: [{
            id: 'voice-1', ordinal: 1, events: [{
              id: 'm1-rest', kind: 'rest',
              onset: { numerator: 0, denominator: 1 },
              duration: { numerator: 1, denominator: 1 }
            }]
          }]
        },
        {
          id: 'measure-2', ordinal: 2, displayNumber: '2', voices: [{
            id: 'voice-2', ordinal: 1, events: measure2Events ?? [
              {
                id: 'note-event', kind: 'note',
                onset: { numerator: 0, denominator: 1 },
                duration: { numerator: 1, denominator: 4 },
                note: { id: 'note-1', pitch: { step: 'C', alter: 0, octave: 4 } }
              },
              {
                id: 'rest-event', kind: 'rest',
                onset: { numerator: 1, denominator: 2 },
                duration: { numerator: 1, denominator: 4 }
              },
              {
                id: 'chord-event', kind: 'chord',
                onset: { numerator: 3, denominator: 4 },
                duration: { numerator: 1, denominator: 4 },
                notes: [
                  { id: 'note-2', pitch: { step: 'E', alter: 0, octave: 4 } },
                  { id: 'note-3', pitch: { step: 'G', alter: 0, octave: 4 } }
                ]
              }
            ]
          }]
        }
      ]
    }]
  }]
});

const notationFor = (score, includeTime = true) => createNotationDocument(score, {
  contractVersion: '1.0.0',
  documentId: score.id,
  revisionId: score.revision.id,
  measures: includeTime ? [{
    target: addressEntity(score, 'measure-1'),
    notation: {
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: null,
      clef: null,
      barlines: []
    }
  }] : [],
  events: [],
  notes: []
});

const positionAt = (score, numerator, denominator) => {
  const voice = addressEntity(score, 'voice-2');
  assert.equal(voice.kind, 'voice');
  return createInsertionPosition(score, voice, { numerator, denominator });
};

test('measure timing inherits the active time signature and exposes explicit intervals plus implicit gaps', () => {
  const score = createScoreDocument(scoreInput());
  const notation = notationFor(score);
  const analysis = analyzeMeasureTiming(score, notation, positionAt(score, 1, 2));

  assert.deepEqual(analysis.timeSignature, { beats: 4, beatType: 4 });
  assert.deepEqual(analysis.measureDuration, { numerator: 1, denominator: 1 });
  assert.deepEqual(analysis.intervals.map((item) => [item.eventId, item.kind, item.start, item.end]), [
    ['note-event', 'pitched', { numerator: 0, denominator: 1 }, { numerator: 1, denominator: 4 }],
    ['rest-event', 'rest', { numerator: 1, denominator: 2 }, { numerator: 3, denominator: 4 }],
    ['chord-event', 'pitched', { numerator: 3, denominator: 4 }, { numerator: 1, denominator: 1 }]
  ]);
  assert.deepEqual(analysis.implicitGaps, [{
    start: { numerator: 1, denominator: 4 },
    end: { numerator: 1, denominator: 2 }
  }]);
  assert.equal(analysis.pickupSemanticsKnown, false);
  assert.equal(analysis.implicitGapAuthoringAllowed, false);
});

test('a requested duration fully inside one explicit rest is the only authoring-safe window', () => {
  const score = createScoreDocument(scoreInput());
  const notation = notationFor(score);
  const result = classifyInsertionWindow(
    score,
    notation,
    positionAt(score, 1, 2),
    { numerator: 1, denominator: 8 }
  );

  assert.equal(result.kind, 'EXPLICIT_REST_SLOT');
  assert.equal(result.safeToAuthor, true);
  assert.equal(result.restEventId, 'rest-event');
  assert.deepEqual(result.end, { numerator: 5, denominator: 8 });
});

test('implicit gaps remain fail-closed because pickup/incomplete-measure semantics are not yet canonical', () => {
  const score = createScoreDocument(scoreInput());
  const notation = notationFor(score);
  const result = classifyInsertionWindow(
    score,
    notation,
    positionAt(score, 1, 4),
    { numerator: 1, denominator: 8 }
  );

  assert.equal(result.kind, 'IMPLICIT_GAP_UNADMITTED');
  assert.equal(result.safeToAuthor, false);
});

test('pitched overlap and measure overflow are rejected before authoring', () => {
  const score = createScoreDocument(scoreInput());
  const notation = notationFor(score);

  const blocked = classifyInsertionWindow(
    score,
    notation,
    positionAt(score, 1, 8),
    { numerator: 1, denominator: 4 }
  );
  assert.equal(blocked.kind, 'BLOCKED_PITCHED');
  assert.equal(blocked.safeToAuthor, false);
  assert.deepEqual(blocked.blockingEventIds, ['note-event']);

  const outside = classifyInsertionWindow(
    score,
    notation,
    positionAt(score, 7, 8),
    { numerator: 1, denominator: 4 }
  );
  assert.equal(outside.kind, 'OUTSIDE_MEASURE');
  assert.equal(outside.safeToAuthor, false);
});

test('overlapping canonical voice events fail timing analysis closed', () => {
  const overlapping = [
    {
      id: 'event-a', kind: 'note',
      onset: { numerator: 0, denominator: 1 },
      duration: { numerator: 1, denominator: 2 },
      note: { id: 'overlap-note', pitch: { step: 'D', alter: 0, octave: 4 } }
    },
    {
      id: 'event-b', kind: 'rest',
      onset: { numerator: 1, denominator: 4 },
      duration: { numerator: 1, denominator: 4 }
    }
  ];
  const score = createScoreDocument(scoreInput(overlapping));
  const notation = notationFor(score);

  assert.throws(
    () => analyzeMeasureTiming(score, notation, positionAt(score, 0, 1)),
    (error) => error instanceof MeasureTimingError && error.code === 'OVERLAPPING_EVENTS'
  );
});

test('events outside the active time signature and missing time signatures fail closed', () => {
  const overflowing = [{
    id: 'event-over', kind: 'rest',
    onset: { numerator: 3, denominator: 4 },
    duration: { numerator: 1, denominator: 2 }
  }];
  const score = createScoreDocument(scoreInput(overflowing));
  const notation = notationFor(score);
  assert.throws(
    () => analyzeMeasureTiming(score, notation, positionAt(score, 3, 4)),
    (error) => error instanceof MeasureTimingError && error.code === 'EVENT_OUTSIDE_MEASURE'
  );

  const normal = createScoreDocument(scoreInput());
  const noTime = notationFor(normal, false);
  assert.throws(
    () => analyzeMeasureTiming(normal, noTime, positionAt(normal, 1, 2)),
    (error) => error instanceof MeasureTimingError && error.code === 'MISSING_TIME_SIGNATURE'
  );
});
