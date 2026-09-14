import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { emptyNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import {
  createEventSetProfessionalSelectionV1,
  createEventSpanProfessionalSelectionV1
} from '../dist/packages/editor-professional-selection-v1/src/index.js';
import {
  ProfessionalOctaveTransposeV1Error,
  analyzeProfessionalOctaveTransposeV1
} from '../dist/packages/editor-professional-octave-transpose-v1/src/index.js';
import {
  commitSessionProfessionalOctaveTransposeV1
} from '../dist/packages/editor-session-professional-octave-transpose-v1/src/index.js';
import {
  createEditorSessionV4,
  navigateSessionHistoryV4
} from '../dist/packages/editor-session-controller-v4/src/index.js';

const q = (n, d) => ({ numerator: n, denominator: d });
const pitch = (step, alter = 0, octave = 4) => ({ step, alter, octave });
const note = (id, noteId, onset, value) => ({
  id,
  kind: 'note',
  onset,
  duration: q(1, 2),
  note: { id: noteId, pitch: value }
});
const rest = (id, onset) => ({ id, kind: 'rest', onset, duration: q(1, 2) });
const chord = (id, onset, defs) => ({
  id,
  kind: 'chord',
  onset,
  duration: q(1, 2),
  notes: defs.map(([noteId, value]) => ({ id: noteId, pitch: value }))
});

const scoreFixture = () => createScoreDocumentV3({
  schemaVersion: '3.0.0',
  id: 'p08b-score',
  revision: { id: 'p08b-rev-1', parentId: null },
  source: { sha256: 'b'.repeat(64), format: 'synthetic', byteLength: null },
  measureFrames: [
    { id: 'frame-1', ordinal: 1, displayNumber: '1' },
    { id: 'frame-2', ordinal: 2, displayNumber: '2' }
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
          voices: [{
            id: 'voice-1-1',
            ordinal: 1,
            graceGroups: [],
            events: [
              note('event-1', 'note-1', q(0, 1), pitch('C', 1, 4)),
              rest('event-2', q(1, 2))
            ]
          }]
        },
        {
          id: 'measure-2',
          frameId: 'frame-2',
          voices: [{
            id: 'voice-1-2',
            ordinal: 1,
            graceGroups: [],
            events: [
              chord('event-3', q(0, 1), [
                ['note-3a', pitch('E', -1, 4)],
                ['note-3b', pitch('G', 0, 4)]
              ]),
              note('event-4', 'note-4', q(1, 2), pitch('A', 0, 4))
            ]
          }]
        }
      ]
    }]
  }]
});

const eventAddress = (score, eventId) => {
  const address = addressEntityV3(score, eventId);
  assert.equal(address.kind, 'event');
  return address;
};

const pitches = score => {
  const staff = score.parts[0].staves[0];
  const events = staff.measures.flatMap(measure => measure.voices[0].events);
  return {
    event1: events[0].note.pitch,
    event2Kind: events[1].kind,
    event3: events[2].notes.map(noteAtom => noteAtom.pitch),
    event4: events[3].note.pitch
  };
};

test('P08-B1 commits a cross-measure octave transpose as exactly one unified V4 history revision', () => {
  const score = scoreFixture();
  const notation = emptyNotationDocumentV4(score);
  const originalScore = structuredClone(score);
  const originalNotation = structuredClone(notation);
  const session = createEditorSessionV4(score, notation);
  const selection = createEventSpanProfessionalSelectionV1(
    score,
    eventAddress(score, 'event-1'),
    eventAddress(score, 'event-4')
  );
  const admission = analyzeProfessionalOctaveTransposeV1(score, notation, selection, 1);
  const result = commitSessionProfessionalOctaveTransposeV1(
    session,
    selection,
    admission,
    { nextRevisionId: 'p08b-rev-2' }
  );

  assert.equal(result.historyCommitCount, 1);
  assert.equal(result.historyAuthority, 'EditorHistoryV4');
  assert.equal(result.session.history.past.length, 1);
  assert.equal(result.session.history.present.score.revision.id, 'p08b-rev-2');
  assert.equal(result.session.history.present.score.revision.parentId, 'p08b-rev-1');
  assert.equal(result.session.status.code, 'PROFESSIONAL_OCTAVE_TRANSPOSE_EDIT_COMMITTED');
  assert.equal(result.session.selection.kind, 'event');
  assert.equal(result.session.selection.eventId, 'event-4');
  assert.equal(result.session.selection.revisionId, 'p08b-rev-2');
  assert.deepEqual(result.changedEventIds, ['event-1', 'event-3', 'event-4']);
  assert.deepEqual(result.changedNoteIds, ['note-1', 'note-3a', 'note-3b', 'note-4']);
  assert.deepEqual(pitches(result.session.history.present.score), {
    event1: pitch('C', 1, 5),
    event2Kind: 'rest',
    event3: [pitch('E', -1, 5), pitch('G', 0, 5)],
    event4: pitch('A', 0, 5)
  });
  assert.deepEqual(score, originalScore);
  assert.deepEqual(notation, originalNotation);

  const undone = navigateSessionHistoryV4(result.session, 'UNDO');
  assert.deepEqual(undone.history.present.score, originalScore);
  assert.deepEqual(undone.history.present.notation, originalNotation);
  assert.equal(undone.selection, null);

  const redone = navigateSessionHistoryV4(undone, 'REDO');
  assert.deepEqual(redone.history.present.score, result.session.history.present.score);
  assert.deepEqual(redone.history.present.notation, result.session.history.present.notation);
});

test('P08-B1 preserves backward professional focus while mutating the canonical normalized span', () => {
  const score = scoreFixture();
  const notation = emptyNotationDocumentV4(score);
  const session = createEditorSessionV4(score, notation);
  const selection = createEventSpanProfessionalSelectionV1(
    score,
    eventAddress(score, 'event-4'),
    eventAddress(score, 'event-1')
  );
  assert.equal(selection.direction, 'BACKWARD');
  assert.deepEqual(selection.targets.map(target => target.eventId), ['event-1', 'event-2', 'event-3', 'event-4']);

  const admission = analyzeProfessionalOctaveTransposeV1(score, notation, selection, -1);
  const result = commitSessionProfessionalOctaveTransposeV1(
    session,
    selection,
    admission,
    { nextRevisionId: 'p08b-rev-backward' }
  );

  assert.equal(result.professionalSelection.direction, 'BACKWARD');
  assert.equal(result.professionalSelection.focus.eventId, 'event-1');
  assert.equal(result.session.selection.eventId, 'event-1');
  assert.deepEqual(pitches(result.session.history.present.score), {
    event1: pitch('C', 1, 3),
    event2Kind: 'rest',
    event3: [pitch('E', -1, 3), pitch('G', 0, 3)],
    event4: pitch('A', 0, 3)
  });
});

test('P08-B1 fails closed for discontiguous EVENT_SET until dedicated relation closure is implemented', () => {
  const score = scoreFixture();
  const notation = emptyNotationDocumentV4(score);
  const selection = createEventSetProfessionalSelectionV1(score, [
    eventAddress(score, 'event-1'),
    eventAddress(score, 'event-3')
  ]);

  assert.throws(
    () => analyzeProfessionalOctaveTransposeV1(score, notation, selection, 1),
    error => error instanceof ProfessionalOctaveTransposeV1Error && error.code === 'SELECTION_KIND_UNSUPPORTED'
  );
});

test('P08-B1 fails closed when a professional span becomes stale after revision replacement', () => {
  const score = scoreFixture();
  const notation = emptyNotationDocumentV4(score);
  const selection = createEventSpanProfessionalSelectionV1(
    score,
    eventAddress(score, 'event-1'),
    eventAddress(score, 'event-4')
  );
  const raw = structuredClone(score);
  raw.revision = { id: 'p08b-rev-newer', parentId: score.revision.id };
  const newer = createScoreDocumentV3(raw);
  const newerNotation = emptyNotationDocumentV4(newer);

  assert.throws(
    () => analyzeProfessionalOctaveTransposeV1(newer, newerNotation, selection, 1),
    error => error instanceof ProfessionalOctaveTransposeV1Error && error.code === 'SELECTION_STALE_OR_TAMPERED'
  );
});
