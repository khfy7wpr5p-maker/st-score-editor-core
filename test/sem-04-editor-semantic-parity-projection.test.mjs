import assert from 'node:assert/strict';
import test from 'node:test';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import {
  projectEditorSemanticsV1
} from '../dist/packages/editor-semantic-parity-v1/src/index.js';
import { createNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';

const note = (id, step, octave, alter = 0) => ({ id, pitch: { step, alter, octave } });
const event = (id, onset, duration, noteValue) => ({
  id,
  kind: 'note',
  onset,
  duration,
  note: noteValue
});
const rest = (id) => ({
  id,
  kind: 'rest',
  onset: { numerator: 0, denominator: 1 },
  duration: { numerator: 1, denominator: 1 }
});

const scoreFixture = ({ ambiguousUnison = false } = {}) => createScoreDocumentV3({
  schemaVersion: '3.0.0',
  id: 'doc-sem04',
  revision: { id: 'rev-sem04', parentId: null },
  source: { sha256: 'a'.repeat(64), format: 'synthetic', byteLength: null },
  measureFrames: [
    { id: 'frame-1', ordinal: 1, displayNumber: '1' },
    { id: 'frame-2', ordinal: 2, displayNumber: '2' }
  ],
  parts: [{
    id: 'part-1',
    ordinal: 1,
    name: 'Parity',
    instrument: { id: 'instrument-1', name: 'Parity', shortName: null },
    staves: [
      {
        id: 'staff-1',
        ordinal: 1,
        role: 'standard',
        measures: [
          {
            id: 'measure-1-s1',
            frameId: 'frame-1',
            voices: [
              {
                id: 'voice-1-1',
                ordinal: 1,
                events: [
                  ambiguousUnison
                    ? {
                        id: 'event-1',
                        kind: 'chord',
                        onset: { numerator: 0, denominator: 1 },
                        duration: { numerator: 1, denominator: 2 },
                        notes: [
                          note('note-1a', 'C', 4),
                          note('note-1b', 'C', 4)
                        ]
                      }
                    : event(
                        'event-1',
                        { numerator: 0, denominator: 1 },
                        { numerator: 1, denominator: 2 },
                        note('note-1', 'C', 4)
                      ),
                  event(
                    'event-2',
                    { numerator: 1, denominator: 2 },
                    { numerator: 1, denominator: 2 },
                    note('note-2', 'D', 4)
                  )
                ],
                graceGroups: []
              },
              {
                id: 'voice-1-2',
                ordinal: 2,
                events: [
                  event(
                    'event-3',
                    { numerator: 0, denominator: 1 },
                    { numerator: 1, denominator: 1 },
                    note('note-3', 'G', 3)
                  )
                ],
                graceGroups: []
              }
            ]
          },
          {
            id: 'measure-2-s1',
            frameId: 'frame-2',
            voices: [
              {
                id: 'voice-2-1',
                ordinal: 1,
                events: [
                  event(
                    'event-4',
                    { numerator: 0, denominator: 1 },
                    { numerator: 1, denominator: 4 },
                    note('note-4', 'D', 4)
                  ),
                  event(
                    'event-5',
                    { numerator: 1, denominator: 4 },
                    { numerator: 3, denominator: 4 },
                    note('note-5', 'E', 4)
                  )
                ],
                graceGroups: []
              },
              {
                id: 'voice-2-2',
                ordinal: 2,
                events: [
                  event(
                    'event-6',
                    { numerator: 0, denominator: 1 },
                    { numerator: 1, denominator: 1 },
                    note('note-6', 'A', 3)
                  )
                ],
                graceGroups: []
              }
            ]
          }
        ]
      },
      {
        id: 'staff-2',
        ordinal: 2,
        role: 'standard',
        measures: [
          {
            id: 'measure-1-s2',
            frameId: 'frame-1',
            voices: [{
              id: 'voice-1-s2',
              ordinal: 1,
              events: [
                event(
                  'event-7',
                  { numerator: 0, denominator: 1 },
                  { numerator: 1, denominator: 1 },
                  note('note-7', 'C', 3)
                )
              ],
              graceGroups: []
            }]
          },
          {
            id: 'measure-2-s2',
            frameId: 'frame-2',
            voices: [{
              id: 'voice-2-s2',
              ordinal: 1,
              events: [rest('rest-2-s2')],
              graceGroups: []
            }]
          }
        ]
      }
    ]
  }]
});

const notationFixture = (score, { duplicateTieStart = false, sparse = false } = {}) => {
  const target = (id) => addressEntityV3(score, id);
  if (sparse) {
    return createNotationDocumentV4(score, {
      contractVersion: '4.0.0',
      documentId: score.id,
      revisionId: score.revision.id,
      frames: [],
      measures: [],
      events: [],
      notes: [],
      graceEvents: [],
      graceNotes: [],
      crossStaffPlacements: []
    });
  }
  return createNotationDocumentV4(score, {
    contractVersion: '4.0.0',
    documentId: score.id,
    revisionId: score.revision.id,
    frames: [{
      target: target('frame-1'),
      notation: {
        timeSignature: { beats: 4, beatType: 4 },
        barlines: []
      }
    }],
    measures: [
      {
        target: target('measure-1-s1'),
        notation: {
          keySignature: { fifths: 0 },
          clef: { sign: 'G', line: 2, octaveChange: 0 }
        }
      },
      {
        target: target('measure-1-s2'),
        notation: {
          keySignature: { fifths: 0 },
          clef: { sign: 'F', line: 4, octaveChange: 0 }
        }
      }
    ],
    events: [],
    notes: [
      {
        target: target('note-2'),
        notation: {
          accidental: null,
          ties: duplicateTieStart
            ? [{ number: 1, type: 'start' }, { number: 2, type: 'start' }]
            : [{ number: 1, type: 'start' }],
          slurs: []
        }
      },
      {
        target: target('note-4'),
        notation: {
          accidental: null,
          ties: [{ number: 1, type: 'stop' }],
          slurs: []
        }
      }
    ],
    graceEvents: [],
    graceNotes: [],
    crossStaffPlacements: []
  });
};

test('SEM-04 projects canonical pitched notes, exact timing, tie roles and explicit contexts', () => {
  const score = scoreFixture();
  const notation = notationFixture(score);
  const result = projectEditorSemanticsV1(score, notation);

  assert.equal(result.status, 'PASS');
  assert.equal(result.projection.partCount, 1);
  assert.equal(result.projection.measureCount, 2);
  assert.deepEqual(
    result.projection.notes.map((item) => ({
      measureIndex: item.measureIndex,
      staffOrdinal: item.staffOrdinal,
      voiceOrdinal: item.voiceOrdinal,
      onset: item.onset,
      duration: item.duration,
      pitchMidi: item.pitchMidi,
      occurrenceOrdinal: item.occurrenceOrdinal,
      tieStart: item.tieStart,
      tieStop: item.tieStop
    })),
    [
      { measureIndex: 0, staffOrdinal: 1, voiceOrdinal: 1, onset: { numerator: 0, denominator: 1 }, duration: { numerator: 1, denominator: 2 }, pitchMidi: 60, occurrenceOrdinal: 1, tieStart: false, tieStop: false },
      { measureIndex: 0, staffOrdinal: 1, voiceOrdinal: 1, onset: { numerator: 1, denominator: 2 }, duration: { numerator: 1, denominator: 2 }, pitchMidi: 62, occurrenceOrdinal: 1, tieStart: true, tieStop: false },
      { measureIndex: 0, staffOrdinal: 1, voiceOrdinal: 2, onset: { numerator: 0, denominator: 1 }, duration: { numerator: 1, denominator: 1 }, pitchMidi: 55, occurrenceOrdinal: 1, tieStart: false, tieStop: false },
      { measureIndex: 0, staffOrdinal: 2, voiceOrdinal: 1, onset: { numerator: 0, denominator: 1 }, duration: { numerator: 1, denominator: 1 }, pitchMidi: 48, occurrenceOrdinal: 1, tieStart: false, tieStop: false },
      { measureIndex: 1, staffOrdinal: 1, voiceOrdinal: 1, onset: { numerator: 0, denominator: 1 }, duration: { numerator: 1, denominator: 4 }, pitchMidi: 62, occurrenceOrdinal: 1, tieStart: false, tieStop: true },
      { measureIndex: 1, staffOrdinal: 1, voiceOrdinal: 1, onset: { numerator: 1, denominator: 4 }, duration: { numerator: 3, denominator: 4 }, pitchMidi: 64, occurrenceOrdinal: 1, tieStart: false, tieStop: false },
      { measureIndex: 1, staffOrdinal: 1, voiceOrdinal: 2, onset: { numerator: 0, denominator: 1 }, duration: { numerator: 1, denominator: 1 }, pitchMidi: 57, occurrenceOrdinal: 1, tieStart: false, tieStop: false }
    ]
  );
  assert.deepEqual(result.projection.timeSignatures, [{ measureIndex: 0, beats: 4, beatType: 4 }]);
  assert.deepEqual(result.projection.keySignatures, [
    { measureIndex: 0, staffOrdinal: 1, fifths: 0 },
    { measureIndex: 0, staffOrdinal: 2, fifths: 0 }
  ]);
  assert.deepEqual(result.projection.clefs, [
    { measureIndex: 0, staffOrdinal: 1, sign: 'G', line: 2, octaveChange: 0 },
    { measureIndex: 0, staffOrdinal: 2, sign: 'F', line: 4, octaveChange: 0 }
  ]);
});

test('SEM-04 projection fails closed for ambiguous unison structural coordinates', () => {
  const score = scoreFixture({ ambiguousUnison: true });
  const result = projectEditorSemanticsV1(score, notationFixture(score, { sparse: true }));

  assert.equal(result.status, 'UNSUPPORTED');
  assert.equal(result.diagnostics[0]?.code, 'PROFILE_UNSUPPORTED');
});

test('SEM-04 projection fails closed for multiple tie starts on one note', () => {
  const score = scoreFixture();
  const result = projectEditorSemanticsV1(score, notationFixture(score, { duplicateTieStart: true }));

  assert.equal(result.status, 'UNSUPPORTED');
  assert.equal(result.diagnostics[0]?.code, 'PROFILE_UNSUPPORTED');
});

test('SEM-04 sparse notation stays sparse and does not fabricate contexts', () => {
  const score = scoreFixture();
  const result = projectEditorSemanticsV1(score, notationFixture(score, { sparse: true }));

  assert.equal(result.status, 'PASS');
  assert.deepEqual(result.projection.timeSignatures, []);
  assert.deepEqual(result.projection.keySignatures, []);
  assert.deepEqual(result.projection.clefs, []);
});
