import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createScoreDocument,
  ScoreDocumentValidationError,
  validateScoreDocument
} from '../dist/packages/score-model/src/index.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

const validDocument = () => ({
  schemaVersion: '1.0.0',
  id: 'doc-1',
  revision: {
    id: 'rev-1',
    parentId: null
  },
  source: {
    sha256: 'a'.repeat(64),
    format: 'synthetic',
    byteLength: 128
  },
  parts: [
    {
      id: 'part-1',
      name: 'Piano',
      staves: [
        {
          id: 'staff-1',
          ordinal: 1,
          measures: [
            {
              id: 'measure-1',
              ordinal: 1,
              displayNumber: '1',
              voices: [
                {
                  id: 'voice-1',
                  ordinal: 1,
                  events: [
                    {
                      kind: 'note',
                      id: 'event-1',
                      onset: { numerator: 0, denominator: 1 },
                      duration: { numerator: 1, denominator: 4 },
                      note: {
                        id: 'note-1',
                        pitch: { step: 'C', alter: 0, octave: 4 }
                      }
                    },
                    {
                      kind: 'chord',
                      id: 'event-2',
                      onset: { numerator: 1, denominator: 4 },
                      duration: { numerator: 1, denominator: 4 },
                      notes: [
                        { id: 'note-2', pitch: { step: 'E', alter: 0, octave: 4 } },
                        { id: 'note-3', pitch: { step: 'G', alter: 0, octave: 4 } }
                      ]
                    },
                    {
                      kind: 'rest',
                      id: 'event-3',
                      onset: { numerator: 1, denominator: 2 },
                      duration: { numerator: 1, denominator: 2 }
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
});

test('valid canonical document passes and becomes a detached immutable snapshot', () => {
  const input = validDocument();
  const document = createScoreDocument(input);
  assert.equal(validateScoreDocument(document).ok, true);
  assert.equal(Object.isFrozen(document), true);
  assert.equal(Object.isFrozen(document.parts), true);
  assert.equal(Object.isFrozen(document.parts[0].staves[0].measures[0].voices[0].events), true);

  input.parts[0].name = 'Changed outside core';
  assert.equal(document.parts[0].name, 'Piano');
  assert.throws(() => {
    document.parts[0].name = 'Mutation attempt';
  }, TypeError);
});

test('duplicate stable entity ids fail closed', () => {
  const input = validDocument();
  input.parts[0].staves[0].measures[0].voices[0].events[0].note.id = 'event-1';
  const result = validateScoreDocument(input);
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((issue) => issue.code === 'DUPLICATE_ID'), true);
});

test('renderer coordinates cannot leak into canonical score schema', () => {
  const input = validDocument();
  input.parts[0].staves[0].measures[0].voices[0].events[0].x = 120;
  const result = validateScoreDocument(input);
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((issue) => issue.code === 'UNKNOWN_FIELD' && issue.path.endsWith('.x')), true);
});

test('rhythmic rationals must be reduced and positive where required', () => {
  const input = validDocument();
  input.parts[0].staves[0].measures[0].voices[0].events[0].duration = { numerator: 2, denominator: 8 };
  const result = validateScoreDocument(input);
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((issue) => issue.code === 'NON_CANONICAL_RATIONAL'), true);
});

test('voice events with decreasing onset are rejected', () => {
  const input = validDocument();
  input.parts[0].staves[0].measures[0].voices[0].events[1].onset = { numerator: 0, denominator: 1 };
  const result = validateScoreDocument(input);
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((issue) => issue.code === 'EVENT_ORDER'), true);
});

test('one-note chord is structurally invalid', () => {
  const input = validDocument();
  input.parts[0].staves[0].measures[0].voices[0].events[1].notes = [
    { id: 'note-2', pitch: { step: 'E', alter: 0, octave: 4 } }
  ];
  const result = validateScoreDocument(input);
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((issue) => issue.code === 'INVALID_CHORD'), true);
});

test('createScoreDocument never returns a partially accepted invalid document', () => {
  const input = validDocument();
  input.source.sha256 = 'not-a-hash';
  assert.throws(
    () => createScoreDocument(input),
    (error) => error instanceof ScoreDocumentValidationError && error.issues.some((issue) => issue.code === 'INVALID_SHA256')
  );
});
