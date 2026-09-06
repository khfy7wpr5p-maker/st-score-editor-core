import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createNewScoreEditorAppDocument } from '../dist/packages/score-editor-app-document/src/index.js';
import {
  analyzeEventDurationMutationV4,
  RhythmTimingAdmissionV4Error
} from '../dist/packages/editor-rhythm-timing-v4/src/index.js';

const ids = () => {
  let index = 0;
  return () => `rt-${++index}`;
};

const note = (id, noteId, onset, duration, step = 'C') => ({
  id,
  kind: 'note',
  onset,
  duration,
  note: { id: noteId, pitch: { step, alter: 0, octave: 4 } }
});

const rest = (id, onset, duration) => ({ id, kind: 'rest', onset, duration });

const defaultEventNotation = (overrides = {}) => ({
  dots: 0,
  beams: [],
  tuplet: null,
  articulations: [],
  ornaments: [],
  ...overrides
});

const defaultNoteNotation = (overrides = {}) => ({
  accidental: null,
  ties: [],
  slurs: [],
  ...overrides
});

const pair = ({
  events,
  sourceFormat = 'synthetic',
  eventNotation = {},
  noteNotation = {},
  timeSignature = { beats: 4, beatType: 4 }
}) => {
  const document = createNewScoreEditorAppDocument({ idFactory: ids() });
  const baseScore = document.session.history.present.score;
  const baseNotation = document.session.history.present.notation;
  const raw = structuredClone(baseScore);
  raw.parts[0].staves[0].measures[0].voices[0].events = events;
  raw.source = sourceFormat === 'musicxml'
    ? { sha256: 'a'.repeat(64), format: 'musicxml', byteLength: 128 }
    : { sha256: '0'.repeat(64), format: 'synthetic', byteLength: null };
  const score = createScoreDocumentV3(raw);

  const frames = baseNotation.frames.map(entry => ({
    target: addressEntityV3(score, entry.target.frameId),
    notation: {
      ...entry.notation,
      timeSignature
    }
  }));
  const measures = baseNotation.measures.map(entry => ({
    target: addressEntityV3(score, entry.target.measureId),
    notation: entry.notation
  }));
  const eventEntries = Object.entries(eventNotation).map(([eventId, notation]) => ({
    target: addressEntityV3(score, eventId),
    notation
  }));
  const noteEntries = Object.entries(noteNotation).map(([noteId, notation]) => ({
    target: addressEntityV3(score, noteId),
    notation
  }));

  const notation = createNotationDocumentV4(score, {
    contractVersion: '4.0.0',
    documentId: score.id,
    revisionId: score.revision.id,
    frames,
    measures,
    events: eventEntries,
    notes: noteEntries,
    graceEvents: [],
    graceNotes: [],
    crossStaffPlacements: []
  });

  return { score, notation };
};

const analyze = (score, notation, eventId, duration, options = {}) => {
  const target = addressEntityV3(score, eventId);
  assert.equal(target.kind, 'event');
  return analyzeEventDurationMutationV4(score, notation, target, duration, options);
};

test('APP-11A admits deterministic contraction and reports the new gap explicitly', () => {
  const { score, notation } = pair({
    events: [note('e1', 'n1', { numerator: 0, denominator: 1 }, { numerator: 1, denominator: 1 })]
  });
  const result = analyze(score, notation, 'e1', { numerator: 1, denominator: 4 });
  assert.equal(result.admitted, true);
  assert.equal(result.reason, 'ADMITTED_CONTRACTION');
  assert.equal(result.direction, 'SHRINK');
  assert.equal(result.wouldCreateGap, true);
  assert.deepEqual(result.currentEnd, { numerator: 1, denominator: 1 });
  assert.deepEqual(result.requestedEnd, { numerator: 1, denominator: 4 });
});

test('APP-11A admits growth only up to an exact next-event boundary', () => {
  const { score, notation } = pair({
    sourceFormat: 'musicxml',
    events: [
      note('e1', 'n1', { numerator: 0, denominator: 1 }, { numerator: 1, denominator: 4 }),
      note('e2', 'n2', { numerator: 1, denominator: 2 }, { numerator: 1, denominator: 4 }, 'D')
    ]
  });
  const result = analyze(score, notation, 'e1', { numerator: 1, denominator: 2 });
  assert.equal(result.admitted, true);
  assert.equal(result.reason, 'ADMITTED_WITH_NEXT_EVENT_BOUNDARY');
  assert.equal(result.wouldCreateGap, false);
  assert.equal(result.nextEventId, 'e2');
  assert.deepEqual(result.nextEventOnset, { numerator: 1, denominator: 2 });
});

test('APP-11A rejects duration growth that overlaps the next canonical event', () => {
  const { score, notation } = pair({
    events: [
      note('e1', 'n1', { numerator: 0, denominator: 1 }, { numerator: 1, denominator: 4 }),
      note('e2', 'n2', { numerator: 1, denominator: 4 }, { numerator: 1, denominator: 4 }, 'D')
    ]
  });
  const result = analyze(score, notation, 'e1', { numerator: 1, denominator: 2 });
  assert.equal(result.admitted, false);
  assert.equal(result.reason, 'BLOCKED_NEXT_EVENT_OVERLAP');
});

test('APP-11A fails closed on trailing MusicXML expansion without pickup/non-controlling evidence', () => {
  const { score, notation } = pair({
    sourceFormat: 'musicxml',
    events: [note('e1', 'n1', { numerator: 0, denominator: 1 }, { numerator: 1, denominator: 4 })]
  });
  const result = analyze(score, notation, 'e1', { numerator: 1, denominator: 2 });
  assert.equal(result.admitted, false);
  assert.equal(result.reason, 'BLOCKED_TRAILING_EXPANSION_SOURCE_UNPROVEN');
});

test('APP-11A admits bounded synthetic trailing expansion but rejects measure overrun', () => {
  let state = pair({
    events: [note('e1', 'n1', { numerator: 0, denominator: 1 }, { numerator: 1, denominator: 4 })]
  });
  let result = analyze(state.score, state.notation, 'e1', { numerator: 1, denominator: 2 });
  assert.equal(result.admitted, true);
  assert.equal(result.reason, 'ADMITTED_SYNTHETIC_TRAILING_EXPANSION');
  assert.deepEqual(result.nominalMeasureDuration, { numerator: 1, denominator: 1 });

  state = pair({
    events: [note('e1', 'n1', { numerator: 3, denominator: 4 }, { numerator: 1, denominator: 4 })]
  });
  result = analyze(state.score, state.notation, 'e1', { numerator: 1, denominator: 2 });
  assert.equal(result.admitted, false);
  assert.equal(result.reason, 'BLOCKED_SYNTHETIC_MEASURE_END');
});

test('APP-11A requires an effective meter for synthetic trailing growth', () => {
  const { score, notation } = pair({
    timeSignature: null,
    events: [note('e1', 'n1', { numerator: 0, denominator: 1 }, { numerator: 1, denominator: 4 })]
  });
  const result = analyze(score, notation, 'e1', { numerator: 1, denominator: 2 });
  assert.equal(result.admitted, false);
  assert.equal(result.reason, 'BLOCKED_TRAILING_EXPANSION_METER_UNKNOWN');
});

test('APP-11A blocks dotted notation unless the caller explicitly owns dot rewrite', () => {
  const { score, notation } = pair({
    events: [note('e1', 'n1', { numerator: 0, denominator: 1 }, { numerator: 3, denominator: 8 })],
    eventNotation: {
      e1: defaultEventNotation({ dots: 1 })
    }
  });
  let result = analyze(score, notation, 'e1', { numerator: 1, denominator: 2 });
  assert.equal(result.admitted, false);
  assert.equal(result.reason, 'BLOCKED_TIMING_COUPLED_NOTATION');
  assert.deepEqual(result.couplingReasons, ['dots']);

  result = analyze(
    score,
    notation,
    'e1',
    { numerator: 1, denominator: 2 },
    { allowDotRewrite: true }
  );
  assert.equal(result.admitted, true);
  assert.equal(result.reason, 'ADMITTED_SYNTHETIC_TRAILING_EXPANSION');
});

test('APP-11A blocks beam, tuplet and tie coupled event duration mutation', () => {
  let state = pair({
    events: [note('e1', 'n1', { numerator: 0, denominator: 1 }, { numerator: 1, denominator: 8 })],
    eventNotation: {
      e1: defaultEventNotation({ beams: [{ number: 1, value: 'begin' }] })
    }
  });
  let result = analyze(state.score, state.notation, 'e1', { numerator: 1, denominator: 4 });
  assert.equal(result.reason, 'BLOCKED_TIMING_COUPLED_NOTATION');
  assert.deepEqual(result.couplingReasons, ['beams']);

  state = pair({
    events: [note('e1', 'n1', { numerator: 0, denominator: 1 }, { numerator: 1, denominator: 12 })],
    eventNotation: {
      e1: defaultEventNotation({
        tuplet: { actualNotes: 3, normalNotes: 2, marks: [{ number: 1, type: 'start' }] }
      })
    }
  });
  result = analyze(state.score, state.notation, 'e1', { numerator: 1, denominator: 8 });
  assert.equal(result.reason, 'BLOCKED_TIMING_COUPLED_NOTATION');
  assert.deepEqual(result.couplingReasons, ['tuplet']);

  state = pair({
    events: [note('e1', 'n1', { numerator: 0, denominator: 1 }, { numerator: 1, denominator: 4 })],
    noteNotation: {
      n1: defaultNoteNotation({ ties: [{ number: 1, type: 'start' }] })
    }
  });
  result = analyze(state.score, state.notation, 'e1', { numerator: 1, denominator: 2 });
  assert.equal(result.reason, 'BLOCKED_TIMING_COUPLED_NOTATION');
  assert.deepEqual(result.couplingReasons, ['tie:n1']);
});

test('APP-11A refuses to authorize edits from an already-overlapping voice', () => {
  const { score, notation } = pair({
    events: [
      note('e1', 'n1', { numerator: 0, denominator: 1 }, { numerator: 1, denominator: 2 }),
      note('e2', 'n2', { numerator: 1, denominator: 4 }, { numerator: 1, denominator: 4 }, 'D')
    ]
  });
  const result = analyze(score, notation, 'e1', { numerator: 1, denominator: 4 });
  assert.equal(result.admitted, false);
  assert.equal(result.reason, 'BLOCKED_EXISTING_TIMING_INVALID');
});

test('APP-11A reports no-op without creating authoring admission', () => {
  const { score, notation } = pair({
    events: [rest('e1', { numerator: 0, denominator: 1 }, { numerator: 1, denominator: 1 })]
  });
  const result = analyze(score, notation, 'e1', { numerator: 1, denominator: 1 });
  assert.equal(result.admitted, false);
  assert.equal(result.reason, 'NO_OP');
  assert.equal(result.direction, 'SAME');
});

test('APP-11A validates exact target revision and canonical duration input', () => {
  const { score, notation } = pair({
    events: [note('e1', 'n1', { numerator: 0, denominator: 1 }, { numerator: 1, denominator: 4 })]
  });
  const target = addressEntityV3(score, 'e1');
  assert.equal(target.kind, 'event');

  assert.throws(
    () => analyzeEventDurationMutationV4(score, notation, target, { numerator: 2, denominator: 4 }),
    error => error instanceof RhythmTimingAdmissionV4Error && error.code === 'INVALID_DURATION'
  );

  const stale = { ...target, revisionId: 'stale-revision' };
  assert.throws(
    () => analyzeEventDurationMutationV4(score, notation, stale, { numerator: 1, denominator: 2 }),
    error => error instanceof RhythmTimingAdmissionV4Error && error.code === 'STALE_TARGET'
  );
});
