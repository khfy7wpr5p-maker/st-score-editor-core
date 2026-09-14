import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import {
  EDITOR_PROFESSIONAL_SELECTION_V1_VERSION,
  ProfessionalSelectionV1Error,
  createEventSetProfessionalSelectionV1,
  createEventSpanProfessionalSelectionV1,
  professionalSelectionActiveTargetV1,
  professionalSelectionTargetsV1
} from '../dist/packages/editor-professional-selection-v1/src/index.js';

const pitch = (step, octave = 4) => ({ step, alter: 0, octave });
const note = (id, noteId, onset, step) => ({
  id,
  kind: 'note',
  onset,
  duration: { numerator: 1, denominator: 2 },
  note: { id: noteId, pitch: pitch(step) }
});
const voice = (id, ordinal, events) => ({ id, ordinal, events, graceGroups: [] });

const scoreFixture = () => createScoreDocumentV3({
  schemaVersion: '3.0.0',
  id: 'p08-score',
  revision: { id: 'p08-rev-1', parentId: null },
  source: { sha256: 'a'.repeat(64), format: 'synthetic', byteLength: null },
  measureFrames: [
    { id: 'frame-1', ordinal: 1, displayNumber: '1' },
    { id: 'frame-2', ordinal: 2, displayNumber: '2' },
    { id: 'frame-3', ordinal: 3, displayNumber: '3' }
  ],
  parts: [{
    id: 'part-1',
    ordinal: 1,
    name: 'Piano',
    instrument: { id: 'instrument-1', name: 'Piano', shortName: 'Pno.' },
    staves: [{
      id: 'staff-1',
      ordinal: 1,
      role: 'standard',
      measures: [
        {
          id: 'measure-1',
          frameId: 'frame-1',
          voices: [
            voice('voice-1-1', 1, [
              note('event-1', 'note-1', { numerator: 0, denominator: 1 }, 'C'),
              note('event-2', 'note-2', { numerator: 1, denominator: 2 }, 'D')
            ]),
            voice('voice-2-1', 2, [
              { ...note('event-v2-1', 'note-v2-1', { numerator: 0, denominator: 1 }, 'G'), duration: { numerator: 1, denominator: 1 } }
            ])
          ]
        },
        {
          id: 'measure-2',
          frameId: 'frame-2',
          voices: [
            voice('voice-1-2', 1, [
              note('event-3', 'note-3', { numerator: 0, denominator: 1 }, 'E'),
              note('event-4', 'note-4', { numerator: 1, denominator: 2 }, 'F')
            ]),
            voice('voice-2-2', 2, [
              { ...note('event-v2-2', 'note-v2-2', { numerator: 0, denominator: 1 }, 'A'), duration: { numerator: 1, denominator: 1 } }
            ])
          ]
        },
        {
          id: 'measure-3',
          frameId: 'frame-3',
          voices: [
            voice('voice-1-3', 1, [
              note('event-5', 'note-5', { numerator: 0, denominator: 1 }, 'G'),
              note('event-6', 'note-6', { numerator: 1, denominator: 2 }, 'A')
            ]),
            voice('voice-2-3', 2, [
              { ...note('event-v2-3', 'note-v2-3', { numerator: 0, denominator: 1 }, 'B'), duration: { numerator: 1, denominator: 1 } }
            ])
          ]
        }
      ]
    }]
  }]
});

const eventAddress = (score, id) => {
  const address = addressEntityV3(score, id);
  assert.equal(address.kind, 'event');
  return address;
};

test('P08-A EVENT_SPAN crosses measures in canonical logical Voice order and remains history-free data', () => {
  const score = scoreFixture();
  const before = structuredClone(score);
  const selection = createEventSpanProfessionalSelectionV1(
    score,
    eventAddress(score, 'event-2'),
    eventAddress(score, 'event-5')
  );

  assert.equal(selection.version, EDITOR_PROFESSIONAL_SELECTION_V1_VERSION);
  assert.equal(selection.kind, 'EVENT_SPAN');
  assert.equal(selection.direction, 'FORWARD');
  assert.deepEqual(selection.scope, { partId: 'part-1', staffId: 'staff-1', voiceOrdinal: 1 });
  assert.deepEqual(selection.targets.map(target => target.eventId), ['event-2', 'event-3', 'event-4', 'event-5']);
  assert.equal(professionalSelectionActiveTargetV1(selection).eventId, 'event-5');
  assert.deepEqual(professionalSelectionTargetsV1(selection), selection.targets);
  assert.equal(Object.isFrozen(selection), true);
  assert.equal(Object.isFrozen(selection.scope), true);
  assert.equal(Object.isFrozen(selection.targets), true);
  assert.deepEqual(score, before);
});

test('P08-A EVENT_SPAN accepts backward anchor/focus while normalizing targets canonically', () => {
  const score = scoreFixture();
  const selection = createEventSpanProfessionalSelectionV1(
    score,
    eventAddress(score, 'event-5'),
    eventAddress(score, 'event-2')
  );

  assert.equal(selection.direction, 'BACKWARD');
  assert.equal(selection.anchor.eventId, 'event-5');
  assert.equal(selection.focus.eventId, 'event-2');
  assert.deepEqual(selection.targets.map(target => target.eventId), ['event-2', 'event-3', 'event-4', 'event-5']);
  assert.equal(professionalSelectionActiveTargetV1(selection).eventId, 'event-2');
});

test('P08-A EVENT_SET preserves explicit primary while sorting discontiguous targets canonically', () => {
  const score = scoreFixture();
  const selection = createEventSetProfessionalSelectionV1(score, [
    eventAddress(score, 'event-5'),
    eventAddress(score, 'event-1'),
    eventAddress(score, 'event-3')
  ]);

  assert.equal(selection.kind, 'EVENT_SET');
  assert.equal(selection.primary.eventId, 'event-5');
  assert.equal(professionalSelectionActiveTargetV1(selection).eventId, 'event-5');
  assert.deepEqual(selection.targets.map(target => target.eventId), ['event-1', 'event-3', 'event-5']);
  assert.deepEqual(selection.scope, { partId: 'part-1', staffId: 'staff-1', voiceOrdinal: 1 });
});

test('P08-A selection rejects mixed logical Voices, duplicates and single-item sets', () => {
  const score = scoreFixture();
  assert.throws(
    () => createEventSpanProfessionalSelectionV1(
      score,
      eventAddress(score, 'event-1'),
      eventAddress(score, 'event-v2-2')
    ),
    error => error instanceof ProfessionalSelectionV1Error && error.code === 'SELECTION_SCOPE_MISMATCH'
  );
  assert.throws(
    () => createEventSetProfessionalSelectionV1(score, [
      eventAddress(score, 'event-1'),
      eventAddress(score, 'event-1')
    ]),
    error => error instanceof ProfessionalSelectionV1Error && error.code === 'DUPLICATE_TARGET'
  );
  assert.throws(
    () => createEventSetProfessionalSelectionV1(score, [eventAddress(score, 'event-1')]),
    error => error instanceof ProfessionalSelectionV1Error && error.code === 'SELECTION_CARDINALITY_UNSUPPORTED'
  );
});

test('P08-A selection fails closed when addresses are stale after revision replacement', () => {
  const score = scoreFixture();
  const oldAnchor = eventAddress(score, 'event-1');
  const oldFocus = eventAddress(score, 'event-3');
  const raw = structuredClone(score);
  raw.revision = { id: 'p08-rev-2', parentId: score.revision.id };
  const newer = createScoreDocumentV3(raw);

  assert.throws(
    () => createEventSpanProfessionalSelectionV1(newer, oldAnchor, oldFocus),
    error => error instanceof ProfessionalSelectionV1Error && error.code === 'STALE_SELECTION'
  );
});
