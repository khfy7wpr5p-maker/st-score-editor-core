import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4, emptyNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createEditorSessionV4 } from '../dist/packages/editor-session-controller-v4/src/index.js';
import {
  ProfessionalWorkstationV1Error,
  clearProfessionalWorkstationSelectionV1,
  commitProfessionalWorkstationClefV1,
  commitProfessionalWorkstationClearToRestV1,
  commitProfessionalWorkstationFrameBarlinesV1,
  commitProfessionalWorkstationKeySignatureV1,
  commitProfessionalWorkstationOctaveTransposeV1,
  commitProfessionalWorkstationTimeSignatureV1,
  commitProfessionalWorkstationTopologyV1,
  createScoreEditorProfessionalWorkstationV1,
  navigateProfessionalWorkstationHistoryV1,
  selectProfessionalEventSpanV1
} from '../dist/packages/score-editor-professional-workstation-v1/src/index.js';
import {
  commitProfessionalPitchWorkstationSemitoneTransposeV1,
  commitProfessionalPitchWorkstationDiatonicTransposeV1
} from '../dist/packages/score-editor-professional-pitch-transpose-workstation-v1/src/index.js';

const q = (numerator, denominator) => ({ numerator, denominator });
const scoreFixture = () => createScoreDocumentV3({
  schemaVersion: '3.0.0',
  id: 'p08d-score',
  revision: { id: 'p08d-rev-1', parentId: null },
  source: { sha256: 'a'.repeat(64), format: 'synthetic', byteLength: null },
  measureFrames: [{ id: 'frame-1', ordinal: 1, displayNumber: '1' }],
  parts: [{
    id: 'part-1',
    ordinal: 1,
    name: 'Piano',
    instrument: { id: 'instrument-1', name: 'Piano', shortName: 'Pno.' },
    staves: [{
      id: 'staff-1',
      ordinal: 1,
      role: 'standard',
      measures: [{
        id: 'measure-1',
        frameId: 'frame-1',
        voices: [{
          id: 'voice-1',
          ordinal: 1,
          graceGroups: [],
          events: [
            {
              id: 'event-1', kind: 'note', onset: q(0, 1), duration: q(1, 2),
              note: { id: 'note-1', pitch: { step: 'C', alter: 0, octave: 4 } }
            },
            {
              id: 'event-2', kind: 'note', onset: q(1, 2), duration: q(1, 2),
              note: { id: 'note-2', pitch: { step: 'D', alter: 0, octave: 4 } }
            }
          ]
        }]
      }]
    }]
  }]
});

const notationFixture = score => {
  const empty = emptyNotationDocumentV4(score);
  return createNotationDocumentV4(score, {
    ...empty,
    frames: [{
      target: addressEntityV3(score, 'frame-1'),
      notation: { timeSignature: { beats: 4, beatType: 4 }, barlines: [] }
    }],
    measures: [{
      target: addressEntityV3(score, 'measure-1'),
      notation: {
        keySignature: { fifths: 0 },
        clef: { sign: 'G', line: 2, octaveChange: 0 }
      }
    }]
  });
};

const appDocument = () => {
  const score = scoreFixture();
  const notation = notationFixture(score);
  return Object.freeze({
    version: '1.0.0',
    title: 'P08-D',
    origin: 'NEW',
    session: createEditorSessionV4(score, notation),
    savedRevisionId: score.revision.id,
    dirty: false
  });
};

const eventAddress = (workstation, id) => {
  const address = addressEntityV3(workstation.document.session.history.present.score, id);
  assert.equal(address.kind, 'event');
  return address;
};

const measureAddress = workstation => {
  const address = addressEntityV3(workstation.document.session.history.present.score, 'measure-1');
  assert.equal(address.kind, 'measure');
  return address;
};

const frameAddress = workstation => {
  const address = addressEntityV3(workstation.document.session.history.present.score, 'frame-1');
  assert.equal(address.kind, 'measure-frame');
  return address;
};

const pitches = workstation => workstation.document.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events.map(event => event.kind === 'note' ? event.note.pitch : null);

test('P08-D keeps professional selection across bulk transpose/clear and clears it on Undo navigation', () => {
  let workstation = createScoreEditorProfessionalWorkstationV1(appDocument());
  assert.equal(workstation.professionalSelection, null);
  assert.equal(workstation.document.dirty, false);

  assert.throws(
    () => commitProfessionalWorkstationOctaveTransposeV1(workstation, 1, { nextRevisionId: 'p08d-missing-selection' }),
    error => error instanceof ProfessionalWorkstationV1Error && error.code === 'SELECTION_REQUIRED'
  );

  workstation = selectProfessionalEventSpanV1(
    workstation,
    eventAddress(workstation, 'event-1'),
    eventAddress(workstation, 'event-2')
  );
  assert.equal(workstation.professionalSelection.kind, 'EVENT_SPAN');

  workstation = commitProfessionalWorkstationOctaveTransposeV1(
    workstation,
    1,
    { nextRevisionId: 'p08d-rev-2' }
  );
  assert.equal(workstation.document.dirty, true);
  assert.equal(workstation.professionalSelection.kind, 'EVENT_SPAN');
  assert.equal(workstation.professionalSelection.anchor.revisionId, 'p08d-rev-2');
  assert.deepEqual(pitches(workstation), [
    { step: 'C', alter: 0, octave: 5 },
    { step: 'D', alter: 0, octave: 5 }
  ]);

  workstation = commitProfessionalWorkstationClearToRestV1(
    workstation,
    { nextRevisionId: 'p08d-rev-3' }
  );
  assert.equal(workstation.professionalSelection.kind, 'EVENT_SPAN');
  assert.deepEqual(
    workstation.document.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events.map(event => event.kind),
    ['rest', 'rest']
  );
  assert.equal(workstation.document.session.history.past.length, 2);

  workstation = navigateProfessionalWorkstationHistoryV1(workstation, 'UNDO');
  assert.equal(workstation.document.session.history.present.score.revision.id, 'p08d-rev-2');
  assert.equal(workstation.professionalSelection, null);
  assert.deepEqual(pitches(workstation), [
    { step: 'C', alter: 0, octave: 5 },
    { step: 'D', alter: 0, octave: 5 }
  ]);
});

test('P10-3A workstation exposes semitone and diatonic edits over the same professional selection', () => {
  let workstation = createScoreEditorProfessionalWorkstationV1(appDocument());

  assert.throws(
    () => commitProfessionalPitchWorkstationSemitoneTransposeV1(
      workstation, 1, { nextRevisionId: 'p10-3a-missing-selection' }
    ),
    error => error instanceof ProfessionalWorkstationV1Error && error.code === 'SELECTION_REQUIRED'
  );

  workstation = selectProfessionalEventSpanV1(
    workstation,
    eventAddress(workstation, 'event-1'),
    eventAddress(workstation, 'event-2')
  );

  workstation = commitProfessionalPitchWorkstationSemitoneTransposeV1(
    workstation,
    1,
    { nextRevisionId: 'p10-3a-workstation-2' }
  );
  assert.equal(workstation.professionalSelection.kind, 'EVENT_SPAN');
  assert.equal(workstation.professionalSelection.anchor.revisionId, 'p10-3a-workstation-2');
  assert.equal(workstation.document.session.history.past.length, 1);

  workstation = commitProfessionalPitchWorkstationDiatonicTransposeV1(
    workstation,
    1,
    { nextRevisionId: 'p10-3a-workstation-3' }
  );
  assert.equal(workstation.professionalSelection.kind, 'EVENT_SPAN');
  assert.equal(workstation.professionalSelection.anchor.revisionId, 'p10-3a-workstation-3');
  assert.equal(workstation.document.session.history.past.length, 2);
});

test('P08-D exposes key/clef/meter/barline structure edits through one app-facing state surface', () => {
  let workstation = createScoreEditorProfessionalWorkstationV1(appDocument());

  workstation = commitProfessionalWorkstationKeySignatureV1(
    workstation,
    measureAddress(workstation),
    { fifths: 2 },
    { nextRevisionId: 'p08d-key' }
  );
  workstation = commitProfessionalWorkstationClefV1(
    workstation,
    measureAddress(workstation),
    { sign: 'F', line: 4, octaveChange: 0 },
    { nextRevisionId: 'p08d-clef' }
  );
  workstation = commitProfessionalWorkstationTimeSignatureV1(
    workstation,
    frameAddress(workstation),
    { beats: 5, beatType: 4 },
    { nextRevisionId: 'p08d-meter' }
  );
  workstation = commitProfessionalWorkstationFrameBarlinesV1(
    workstation,
    frameAddress(workstation),
    [{ location: 'right', style: 'light-heavy', repeat: 'backward' }],
    { nextRevisionId: 'p08d-barline' }
  );

  const notation = workstation.document.session.history.present.notation;
  assert.deepEqual(notation.measures.find(entry => entry.target.measureId === 'measure-1').notation, {
    keySignature: { fifths: 2 },
    clef: { sign: 'F', line: 4, octaveChange: 0 }
  });
  assert.deepEqual(notation.frames.find(entry => entry.target.frameId === 'frame-1').notation, {
    timeSignature: { beats: 5, beatType: 4 },
    barlines: [{ location: 'right', style: 'light-heavy', repeat: 'backward' }]
  });
  assert.equal(workstation.document.session.history.past.length, 4);
  assert.equal(workstation.professionalSelection, null);
});

test('P08-D delegates existing topology authority instead of creating a second part/staff mutation engine', () => {
  let workstation = createScoreEditorProfessionalWorkstationV1(appDocument());
  workstation = selectProfessionalEventSpanV1(
    workstation,
    eventAddress(workstation, 'event-1'),
    eventAddress(workstation, 'event-2')
  );
  const score = workstation.document.session.history.present.score;
  const part = addressEntityV3(score, 'part-1');
  assert.equal(part.kind, 'part');

  workstation = commitProfessionalWorkstationTopologyV1(
    workstation,
    {
      version: '1.0.0',
      type: 'RENAME_PART_OR_INSTRUMENT',
      target: part,
      partName: 'Concert Piano',
      instrumentName: 'Piano',
      instrumentShortName: 'Pno.'
    },
    { nextRevisionId: 'p08d-topology' }
  );

  assert.equal(workstation.document.session.history.present.score.parts[0].name, 'Concert Piano');
  assert.equal(workstation.professionalSelection, null);
  assert.equal(workstation.document.session.status.code, 'TOPOLOGY_EDIT_COMMITTED');
});

test('P08-D can explicitly clear noncanonical professional selection without touching history', () => {
  let workstation = createScoreEditorProfessionalWorkstationV1(appDocument());
  workstation = selectProfessionalEventSpanV1(
    workstation,
    eventAddress(workstation, 'event-1'),
    eventAddress(workstation, 'event-2')
  );
  const history = workstation.document.session.history;
  workstation = clearProfessionalWorkstationSelectionV1(workstation);
  assert.equal(workstation.professionalSelection, null);
  assert.equal(workstation.document.session.history, history);
});
