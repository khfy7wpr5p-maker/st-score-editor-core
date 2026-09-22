import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import {
  createNotationDocumentV4,
  emptyNotationDocumentV4
} from '../dist/packages/notation-structure-v4/src/index.js';
import {
  createEventSetProfessionalSelectionV1,
  createEventSpanProfessionalSelectionV1
} from '../dist/packages/editor-professional-selection-v1/src/index.js';
import {
  ProfessionalPitchTransposeV1Error,
  analyzeProfessionalDiatonicTransposeV1,
  analyzeProfessionalSemitoneTransposeV1,
  executeProfessionalPitchTransposeV1
} from '../dist/packages/editor-professional-pitch-transpose-v1/src/index.js';

const q = (numerator, denominator) => ({ numerator, denominator });
const note = (id, noteId, onset, step, alter = 0, octave = 4) => ({
  id,
  kind: 'note',
  onset,
  duration: q(1, 4),
  note: { id: noteId, pitch: { step, alter, octave } }
});
const rest = (id, onset) => ({ id, kind: 'rest', onset, duration: q(1, 4) });
const chord = (id, onset, defs) => ({
  id,
  kind: 'chord',
  onset,
  duration: q(1, 4),
  notes: defs.map(([noteId, step, alter = 0, octave = 4]) => ({
    id: noteId,
    pitch: { step, alter, octave }
  }))
});

const scoreFixture = () => createScoreDocumentV3({
  schemaVersion: '3.0.0',
  id: 'p10-3a-score',
  revision: { id: 'p10-3a-rev-1', parentId: null },
  source: { sha256: '3'.repeat(64), format: 'synthetic', byteLength: null },
  measureFrames: [
    { id: 'frame-1', ordinal: 1, displayNumber: '1' },
    { id: 'frame-2', ordinal: 2, displayNumber: '2' }
  ],
  parts: [{
    id: 'part-1',
    ordinal: 1,
    name: 'Piano',
    instrument: { id: 'instrument-1', name: 'Piano', shortName: 'Pno.' },
    staves: [
      {
        id: 'staff-1',
        ordinal: 1,
        role: 'standard',
        measures: [
          {
            id: 's1-m1',
            frameId: 'frame-1',
            voices: [{
              id: 's1-v1-m1',
              ordinal: 1,
              graceGroups: [],
              events: [
                note('event-1', 'note-1', q(0, 1), 'F', 1),
                rest('event-2', q(1, 4))
              ]
            }]
          },
          {
            id: 's1-m2',
            frameId: 'frame-2',
            voices: [{
              id: 's1-v1-m2',
              ordinal: 1,
              graceGroups: [],
              events: [
                chord('event-3', q(0, 1), [
                  ['note-3a', 'E', 0, 4],
                  ['note-3b', 'G', 0, 4]
                ]),
                note('event-4', 'note-4', q(1, 4), 'A', 0, 4)
              ]
            }]
          }
        ]
      },
      {
        id: 'staff-2',
        ordinal: 2,
        role: 'standard',
        measures: [
          {
            id: 's2-m1',
            frameId: 'frame-1',
            voices: [{
              id: 's2-v1-m1',
              ordinal: 1,
              graceGroups: [],
              events: [
                note('s2-event-1', 's2-note-1', q(0, 1), 'B', -1),
                rest('s2-event-2', q(1, 4))
              ]
            }]
          },
          {
            id: 's2-m2',
            frameId: 'frame-2',
            voices: [{
              id: 's2-v1-m2',
              ordinal: 1,
              graceGroups: [],
              events: [
                note('s2-event-3', 's2-note-3', q(0, 1), 'E', -1),
                rest('s2-event-4', q(1, 4))
              ]
            }]
          }
        ]
      }
    ]
  }]
});

const eventAddress = (score, id) => {
  const address = addressEntityV3(score, id);
  assert.equal(address.kind, 'event');
  return address;
};

const notationFixture = (score, { keys = true, ties = false } = {}) => {
  const empty = emptyNotationDocumentV4(score);
  return createNotationDocumentV4(score, {
    ...empty,
    measures: [
      {
        target: addressEntityV3(score, 's1-m1'),
        notation: { keySignature: keys ? { fifths: 2 } : null, clef: null }
      },
      {
        target: addressEntityV3(score, 's1-m2'),
        notation: { keySignature: null, clef: null }
      },
      {
        target: addressEntityV3(score, 's2-m1'),
        notation: { keySignature: keys ? { fifths: -2 } : null, clef: null }
      },
      {
        target: addressEntityV3(score, 's2-m2'),
        notation: { keySignature: null, clef: null }
      }
    ],
    notes: [
      {
        target: addressEntityV3(score, 'note-1'),
        notation: {
          accidental: null,
          ties: ties ? [{ number: 1, type: 'start' }] : [],
          slurs: [{ number: 2, type: 'start' }]
        }
      },
      {
        target: addressEntityV3(score, 'note-4'),
        notation: {
          accidental: null,
          ties: ties ? [{ number: 1, type: 'stop' }] : [],
          slurs: [{ number: 2, type: 'stop' }]
        }
      }
    ]
  });
};

const spanSelection = score => createEventSpanProfessionalSelectionV1(
  score,
  eventAddress(score, 'event-1'),
  eventAddress(score, 'event-4')
);

test('P10-3A resolves nearest prior key signature only within the selected content staff', () => {
  const score = scoreFixture();
  const notation = notationFixture(score);
  const selection = createEventSpanProfessionalSelectionV1(
    score,
    eventAddress(score, 'event-3'),
    eventAddress(score, 'event-4')
  );

  const admission = analyzeProfessionalDiatonicTransposeV1(
    score,
    notation,
    selection,
    1
  );

  assert.equal(admission.mode, 'DIATONIC');
  assert.equal(admission.targetNotePlans.every(plan => plan.effectiveKeyFifths === 2), true);
});

test('P10-3A defaults effective key signature to C major when no staff key is declared', () => {
  const score = scoreFixture();
  const notation = notationFixture(score, { keys: false });
  const admission = analyzeProfessionalSemitoneTransposeV1(
    score,
    notation,
    spanSelection(score),
    1
  );

  assert.equal(admission.targetNotePlans.every(plan => plan.effectiveKeyFifths === 0), true);
});

test('P10-3A semitone EVENT_SPAN plans NOTE and all CHORD tones while REST remains unchanged', () => {
  const score = scoreFixture();
  const notation = notationFixture(score);
  const admission = analyzeProfessionalSemitoneTransposeV1(
    score,
    notation,
    spanSelection(score),
    1
  );

  assert.equal(admission.selectionKind, 'EVENT_SPAN');
  assert.equal(admission.selectedEventCount, 4);
  assert.equal(admission.pitchedEventCount, 3);
  assert.equal(admission.restEventCount, 1);
  assert.deepEqual(admission.targetEventIds, ['event-1', 'event-2', 'event-3', 'event-4']);
  assert.deepEqual(
    admission.targetNotePlans.map(plan => plan.noteId),
    ['note-1', 'note-3a', 'note-3b', 'note-4']
  );
  assert.equal(admission.canonicalMutationAuthority, false);
  assert.equal(admission.historyMutationAuthority, false);
  assert.equal(admission.rendererCoordinateAuthority, false);
  assert.equal(admission.domAuthoringAuthority, false);
});

test('P10-3A EVENT_SET plans only explicitly selected targets', () => {
  const score = scoreFixture();
  const notation = notationFixture(score);
  const selection = createEventSetProfessionalSelectionV1(score, [
    eventAddress(score, 'event-3'),
    eventAddress(score, 'event-1')
  ]);

  const admission = analyzeProfessionalDiatonicTransposeV1(
    score,
    notation,
    selection,
    -1
  );

  assert.equal(admission.selectionKind, 'EVENT_SET');
  assert.deepEqual(admission.targetEventIds, ['event-1', 'event-3']);
  assert.deepEqual(
    admission.targetNotePlans.map(plan => plan.noteId),
    ['note-1', 'note-3a', 'note-3b']
  );
});

test('P10-3A rejects tied selected notes before mutation', () => {
  const score = scoreFixture();
  const notation = notationFixture(score, { ties: true });
  assert.throws(
    () => analyzeProfessionalSemitoneTransposeV1(
      score,
      notation,
      spanSelection(score),
      1
    ),
    error => error instanceof ProfessionalPitchTransposeV1Error &&
      error.code === 'TIE_RELATION_UNSUPPORTED'
  );
});

test('P10-3A rejects selected grace-anchor events before mutation', () => {
  const score = scoreFixture();
  const raw = structuredClone(score);
  raw.parts[0].staves[0].measures[0].voices[0].graceGroups = [{
    id: 'grace-group-1',
    anchorEventId: 'event-1',
    placement: 'before',
    events: [{
      id: 'grace-event-1',
      kind: 'note',
      writtenDuration: q(1, 16),
      playback: {
        stealTimePreviousPercent: null,
        stealTimeFollowingPercent: null,
        makeTime: null
      },
      note: { id: 'grace-note-1', pitch: { step: 'E', alter: 0, octave: 4 } }
    }]
  }];
  const withGrace = createScoreDocumentV3(raw);
  const notation = notationFixture(withGrace);

  assert.throws(
    () => analyzeProfessionalDiatonicTransposeV1(
      withGrace,
      notation,
      spanSelection(withGrace),
      1
    ),
    error => error instanceof ProfessionalPitchTransposeV1Error &&
      error.code === 'GRACE_RELATION_UNSUPPORTED'
  );
});

test('P10-3A updates canonical pitch and accidental metadata atomically while preserving slurs', () => {
  const score = scoreFixture();
  const notation = notationFixture(score);
  const selection = createEventSpanProfessionalSelectionV1(
    score,
    eventAddress(score, 'event-1'),
    eventAddress(score, 'event-2')
  );
  const admission = analyzeProfessionalSemitoneTransposeV1(
    score,
    notation,
    selection,
    -1
  );
  const result = executeProfessionalPitchTransposeV1(
    score,
    notation,
    selection,
    admission,
    { nextRevisionId: 'p10-3a-rev-2' }
  );

  const event1 = result.score.parts[0].staves[0].measures[0].voices[0].events[0];
  assert.equal(event1.kind, 'note');
  assert.deepEqual(event1.note.pitch, { step: 'F', alter: 0, octave: 4 });

  const note1 = result.notation.notes.find(entry => entry.target.noteId === 'note-1');
  assert.ok(note1);
  assert.equal(note1.notation.accidental, 'natural');
  assert.deepEqual(note1.notation.slurs, [{ number: 2, type: 'start' }]);
  assert.deepEqual(note1.notation.ties, []);
  assert.equal(result.score.revision.parentId, score.revision.id);
  assert.equal(result.selection.anchor.revisionId, 'p10-3a-rev-2');
});

test('P10-3A creates missing note notation when target accidental becomes explicit', () => {
  const score = scoreFixture();
  const base = notationFixture(score);
  const notation = createNotationDocumentV4(score, {
    ...base,
    notes: base.notes.filter(entry => entry.target.noteId !== 'note-3a')
  });
  const selection = createEventSetProfessionalSelectionV1(score, [
    eventAddress(score, 'event-3'),
    eventAddress(score, 'event-4')
  ]);
  const admission = analyzeProfessionalSemitoneTransposeV1(score, notation, selection, 1);
  const result = executeProfessionalPitchTransposeV1(
    score,
    notation,
    selection,
    admission,
    { nextRevisionId: 'p10-3a-rev-notation' }
  );

  const note3a = result.notation.notes.find(entry => entry.target.noteId === 'note-3a');
  assert.ok(note3a);
  assert.deepEqual(note3a.notation.ties, []);
  assert.deepEqual(note3a.notation.slurs, []);
});

test('P10-3A rejects a tampered admission before candidate mutation', () => {
  const score = scoreFixture();
  const notation = notationFixture(score);
  const selection = spanSelection(score);
  const admission = analyzeProfessionalSemitoneTransposeV1(
    score,
    notation,
    selection,
    1
  );
  const tampered = structuredClone(admission);
  tampered.targetNotePlans[0].targetPitch.octave += 1;

  assert.throws(
    () => executeProfessionalPitchTransposeV1(
      score,
      notation,
      selection,
      tampered,
      { nextRevisionId: 'p10-3a-tampered' }
    ),
    error => error instanceof ProfessionalPitchTransposeV1Error &&
      error.code === 'ADMISSION_STALE_OR_TAMPERED'
  );

  assert.equal(score.revision.id, 'p10-3a-rev-1');
});

test('P10-3A EVENT_SET execution preserves unselected canonical content exactly', () => {
  const score = scoreFixture();
  const notation = notationFixture(score);
  const selection = createEventSetProfessionalSelectionV1(score, [
    eventAddress(score, 'event-1'),
    eventAddress(score, 'event-3')
  ]);
  const beforeEvent2 = structuredClone(score.parts[0].staves[0].measures[0].voices[0].events[1]);
  const beforeEvent4 = structuredClone(score.parts[0].staves[0].measures[1].voices[0].events[1]);

  const admission = analyzeProfessionalSemitoneTransposeV1(score, notation, selection, 1);
  const result = executeProfessionalPitchTransposeV1(
    score,
    notation,
    selection,
    admission,
    { nextRevisionId: 'p10-3a-event-set' }
  );

  assert.deepEqual(result.score.parts[0].staves[0].measures[0].voices[0].events[1], beforeEvent2);
  assert.deepEqual(result.score.parts[0].staves[0].measures[1].voices[0].events[1], beforeEvent4);
  assert.deepEqual(result.changedEventIds, ['event-1', 'event-3']);
  assert.deepEqual(result.changedNoteIds, ['note-1', 'note-3a', 'note-3b']);
});
