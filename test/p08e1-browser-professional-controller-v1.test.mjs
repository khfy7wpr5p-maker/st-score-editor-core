import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4, emptyNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createEditorSessionV4 } from '../dist/packages/editor-session-controller-v4/src/index.js';
import {
  createProfessionalStandaloneScoreEditorControllerV1
} from '../dist/packages/score-editor-browser-professional-v1/src/index.js';

const q = (numerator, denominator) => ({ numerator, denominator });

const appDocument = () => {
  const score = createScoreDocumentV3({
    schemaVersion: '3.0.0',
    id: 'p08e1-score',
    revision: { id: 'p08e1-rev-1', parentId: null },
    source: { sha256: 'b'.repeat(64), format: 'synthetic', byteLength: null },
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
  const empty = emptyNotationDocumentV4(score);
  const notation = createNotationDocumentV4(score, {
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
  return Object.freeze({
    version: '1.0.0',
    title: 'P08-E1',
    origin: 'NEW',
    session: createEditorSessionV4(score, notation),
    savedRevisionId: score.revision.id,
    dirty: false
  });
};

const eventAddress = (controller, id) => {
  const document = controller.base.getDocument();
  assert.ok(document);
  const address = addressEntityV3(document.session.history.present.score, id);
  assert.equal(address.kind, 'event');
  return address;
};

const measureAddress = controller => {
  const document = controller.base.getDocument();
  assert.ok(document);
  const address = addressEntityV3(document.session.history.present.score, 'measure-1');
  assert.equal(address.kind, 'measure');
  return address;
};

const frameAddress = controller => {
  const document = controller.base.getDocument();
  assert.ok(document);
  const address = addressEntityV3(document.session.history.present.score, 'frame-1');
  assert.equal(address.kind, 'measure-frame');
  return address;
};

test('P08-E1 browser professional bridge preserves canonical browser document authority and rebinds bulk selection', () => {
  const controller = createProfessionalStandaloneScoreEditorControllerV1();
  controller.base.adoptValidatedSnapshot(appDocument());
  assert.equal(controller.getSnapshot().professionalSelectionKind, null);

  let result = controller.selectEventSpan(
    eventAddress(controller, 'event-1'),
    eventAddress(controller, 'event-2')
  );
  assert.equal(result.error, null);
  assert.equal(result.professionalSelectionKind, 'EVENT_SPAN');
  assert.equal(result.professionalSelectionCount, 2);

  result = controller.transposeOctaves(1, { nextRevisionId: 'p08e1-rev-2' });
  assert.equal(result.error, null);
  assert.equal(result.base.revisionId, 'p08e1-rev-2');
  assert.equal(result.professionalSelectionKind, 'EVENT_SPAN');
  assert.equal(controller.getProfessionalSelection()?.anchor.revisionId, 'p08e1-rev-2');

  const document = controller.base.getDocument();
  assert.ok(document);
  const events = document.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events;
  assert.deepEqual(events.map(event => event.kind === 'note' ? event.note.pitch.octave : null), [5, 5]);
  assert.equal(document.session.history.past.length, 1);
});

test('P08-E1 invalidates revision-bound professional selection when the base browser controller changes revision externally', () => {
  const controller = createProfessionalStandaloneScoreEditorControllerV1();
  controller.base.adoptValidatedSnapshot(appDocument());
  controller.selectEventSpan(eventAddress(controller, 'event-1'), eventAddress(controller, 'event-2'));
  controller.transposeOctaves(1, { nextRevisionId: 'p08e1-rev-2' });
  assert.equal(controller.getSnapshot().professionalSelectionKind, 'EVENT_SPAN');

  const undone = controller.base.undo();
  assert.equal(undone.error, null);
  assert.equal(undone.revisionId, 'p08e1-rev-1');
  assert.equal(controller.getSnapshot().professionalSelectionKind, null);
  assert.equal(controller.getSnapshot().professionalSelectionCount, 0);
});

test('P08-E1 exposes professional structure edits through the browser bridge without a second history authority', () => {
  const controller = createProfessionalStandaloneScoreEditorControllerV1();
  controller.base.adoptValidatedSnapshot(appDocument());

  let result = controller.setKeySignature(
    measureAddress(controller),
    { fifths: -2 },
    { nextRevisionId: 'p08e1-key' }
  );
  assert.equal(result.error, null);

  result = controller.setClef(
    measureAddress(controller),
    { sign: 'F', line: 4, octaveChange: 0 },
    { nextRevisionId: 'p08e1-clef' }
  );
  assert.equal(result.error, null);

  result = controller.setTimeSignature(
    frameAddress(controller),
    { beats: 5, beatType: 4 },
    { nextRevisionId: 'p08e1-meter' }
  );
  assert.equal(result.error, null);

  result = controller.setFrameBarlines(
    frameAddress(controller),
    [{ location: 'right', style: 'light-heavy', repeat: 'backward' }],
    { nextRevisionId: 'p08e1-barline' }
  );
  assert.equal(result.error, null);

  const document = controller.base.getDocument();
  assert.ok(document);
  const notation = document.session.history.present.notation;
  assert.deepEqual(notation.measures.find(entry => entry.target.measureId === 'measure-1').notation, {
    keySignature: { fifths: -2 },
    clef: { sign: 'F', line: 4, octaveChange: 0 }
  });
  assert.deepEqual(notation.frames.find(entry => entry.target.frameId === 'frame-1').notation, {
    timeSignature: { beats: 5, beatType: 4 },
    barlines: [{ location: 'right', style: 'light-heavy', repeat: 'backward' }]
  });
  assert.equal(document.session.history.past.length, 4);
  assert.equal(controller.getSnapshot().professionalSelectionKind, null);
});

test('P08-E1 fails closed before a document exists and dispose severs the bridge listener', () => {
  const controller = createProfessionalStandaloneScoreEditorControllerV1();
  const missing = controller.selectEventSet([]);
  assert.equal(missing.error?.code, 'NO_DOCUMENT');
  assert.equal(missing.base.hasDocument, false);

  controller.dispose();
  assert.equal(controller.getProfessionalSelection(), null);
});
