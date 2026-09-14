import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4, emptyNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import {
  createEventSetProfessionalSelectionV1,
  createEventSpanProfessionalSelectionV1
} from '../dist/packages/editor-professional-selection-v1/src/index.js';
import {
  ProfessionalClearToRestV1Error,
  analyzeProfessionalClearToRestV1
} from '../dist/packages/editor-professional-clear-to-rest-v1/src/index.js';
import {
  commitSessionProfessionalClearToRestV1
} from '../dist/packages/editor-session-professional-clear-to-rest-v1/src/index.js';
import {
  createEditorSessionV4,
  navigateSessionHistoryV4
} from '../dist/packages/editor-session-controller-v4/src/index.js';

const q = (n, d) => ({ numerator: n, denominator: d });
const pitch = (step, alter = 0, octave = 4) => ({ step, alter, octave });
const note = (id, noteId, onset, value) => ({ id, kind: 'note', onset, duration: q(1, 2), note: { id: noteId, pitch: value } });
const rest = (id, onset) => ({ id, kind: 'rest', onset, duration: q(1, 2) });
const chord = (id, onset, defs) => ({ id, kind: 'chord', onset, duration: q(1, 2), notes: defs.map(([noteId, value]) => ({ id: noteId, pitch: value })) });

const scoreFixture = () => createScoreDocumentV3({
  schemaVersion: '3.0.0',
  id: 'p08b3-score',
  revision: { id: 'p08b3-rev-1', parentId: null },
  source: { sha256: 'c'.repeat(64), format: 'synthetic', byteLength: null },
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
          id: 'measure-1', frameId: 'frame-1', voices: [{
            id: 'voice-1-1', ordinal: 1, graceGroups: [], events: [
              note('event-1', 'note-1', q(0, 1), pitch('C', 0, 4)),
              rest('event-2', q(1, 2))
            ]
          }]
        },
        {
          id: 'measure-2', frameId: 'frame-2', voices: [{
            id: 'voice-1-2', ordinal: 1, graceGroups: [], events: [
              chord('event-3', q(0, 1), [['note-3a', pitch('E', 0, 4)], ['note-3b', pitch('G', 0, 4)]]),
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

const eventKinds = score => score.parts[0].staves[0].measures.flatMap(measure => measure.voices[0].events.map(event => event.kind));

test('P08-B3 clears a cross-measure professional span to REST in one history revision and exact Undo restores notes', () => {
  const score = scoreFixture();
  const notation = emptyNotationDocumentV4(score);
  const originalScore = structuredClone(score);
  const originalNotation = structuredClone(notation);
  const selection = createEventSpanProfessionalSelectionV1(score, eventAddress(score, 'event-1'), eventAddress(score, 'event-4'));
  const admission = analyzeProfessionalClearToRestV1(score, notation, selection);
  assert.deepEqual(admission.replacementEventIds, ['event-1', 'event-3', 'event-4']);
  assert.deepEqual(admission.alreadyRestEventIds, ['event-2']);
  const session = createEditorSessionV4(score, notation);
  const result = commitSessionProfessionalClearToRestV1(session, selection, admission, { nextRevisionId: 'p08b3-rev-2' });

  assert.equal(result.historyCommitCount, 1);
  assert.equal(result.historyAuthority, 'EditorHistoryV4');
  assert.equal(result.session.history.past.length, 1);
  assert.equal(result.session.history.present.score.revision.id, 'p08b3-rev-2');
  assert.equal(result.session.history.present.score.revision.parentId, 'p08b3-rev-1');
  assert.deepEqual(eventKinds(result.session.history.present.score), ['rest', 'rest', 'rest', 'rest']);
  assert.deepEqual(result.changedEventIds, ['event-1', 'event-3', 'event-4']);
  assert.deepEqual(new Set(result.removedNoteIds), new Set(['note-1', 'note-3a', 'note-3b', 'note-4']));
  assert.equal(result.session.selection.kind, 'event');
  assert.equal(result.session.selection.eventId, 'event-4');
  assert.equal(result.session.selection.revisionId, 'p08b3-rev-2');

  const undone = navigateSessionHistoryV4(result.session, 'UNDO');
  assert.deepEqual(undone.history.present.score, originalScore);
  assert.deepEqual(undone.history.present.notation, originalNotation);
  const redone = navigateSessionHistoryV4(undone, 'REDO');
  assert.deepEqual(redone.history.present.score, result.session.history.present.score);
});

test('P08-B3 EVENT_SET clears only explicitly selected pitched events and preserves the primary target', () => {
  const score = scoreFixture();
  const notation = emptyNotationDocumentV4(score);
  const selection = createEventSetProfessionalSelectionV1(score, [
    eventAddress(score, 'event-3'),
    eventAddress(score, 'event-1')
  ]);
  const admission = analyzeProfessionalClearToRestV1(score, notation, selection);
  const session = createEditorSessionV4(score, notation);
  const result = commitSessionProfessionalClearToRestV1(session, selection, admission, { nextRevisionId: 'p08b3-set-rev' });

  assert.deepEqual(eventKinds(result.session.history.present.score), ['rest', 'rest', 'rest', 'note']);
  assert.deepEqual(result.changedEventIds, ['event-1', 'event-3']);
  assert.equal(result.professionalSelection.kind, 'EVENT_SET');
  assert.equal(result.professionalSelection.primary.eventId, 'event-3');
  assert.equal(result.session.selection.eventId, 'event-3');
  assert.equal(result.session.selection.revisionId, 'p08b3-set-rev');
});

test('P08-B3 fails closed when clear-to-rest would orphan note-level notation', () => {
  const score = scoreFixture();
  const empty = emptyNotationDocumentV4(score);
  const noteTarget = addressEntityV3(score, 'note-1');
  assert.equal(noteTarget.kind, 'note');
  const notation = createNotationDocumentV4(score, {
    ...empty,
    notes: [{
      target: noteTarget,
      notation: { accidental: null, ties: [], slurs: [] }
    }]
  });
  const selection = createEventSetProfessionalSelectionV1(score, [
    eventAddress(score, 'event-1'),
    eventAddress(score, 'event-3')
  ]);

  assert.throws(
    () => analyzeProfessionalClearToRestV1(score, notation, selection),
    error => error instanceof ProfessionalClearToRestV1Error && error.code === 'NOTATION_ORPHAN_RISK'
  );
});

test('P08-B3 rejects tampered admission and leaves the source session unchanged', () => {
  const score = scoreFixture();
  const notation = emptyNotationDocumentV4(score);
  const selection = createEventSetProfessionalSelectionV1(score, [eventAddress(score, 'event-1'), eventAddress(score, 'event-3')]);
  const admission = analyzeProfessionalClearToRestV1(score, notation, selection);
  const tampered = structuredClone(admission);
  tampered.replacementEventIds.pop();
  const session = createEditorSessionV4(score, notation);

  assert.throws(
    () => commitSessionProfessionalClearToRestV1(session, selection, tampered, { nextRevisionId: 'p08b3-tamper-rev' }),
    error => error instanceof ProfessionalClearToRestV1Error && error.code === 'ADMISSION_STALE_OR_TAMPERED'
  );
  assert.deepEqual(session.history.present.score, score);
});
