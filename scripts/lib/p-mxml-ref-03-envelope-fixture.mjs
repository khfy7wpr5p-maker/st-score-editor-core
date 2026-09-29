export const createPartituraNoteFixtureV1 = (overrides = {}) => ({
  sourceNoteId: 'g1',
  pitch: 64,
  step: 'E',
  alter: 0,
  octave: 4,
  onsetBeat: 0,
  durationBeat: 1,
  onsetQuarter: 0,
  durationQuarter: 1,
  onsetDiv: 0,
  durationDiv: 4,
  voice: 1,
  staff: 1,
  divsPerQuarter: 4,
  keyFifths: 0,
  keyMode: null,
  timeBeats: 4,
  timeBeatType: 4,
  ties: { start: false, stop: false },
  tiePrevSourceNoteId: null,
  tieNextSourceNoteId: null,
  tuplet: null,
  fingerings: [],
  articulations: [],
  ornaments: [],
  isGrace: false,
  ...overrides
});

export const createSingleNotePartituraEnvelopeV1 = (
  sourceIdentity,
  {
    partName = 'Synthetic Guitar',
    measureEndDiv = 16,
    sourceNoteId = 'g1'
  } = {}
) => ({
  version: '1.0.0',
  sourceIdentity,
  parts: [{
    id: 'P1',
    name: partName,
    staffCount: 1,
    measureCount: 1,
    noteCount: 1,
    restCount: 0,
    measures: [{ number: 1, name: '1', startDiv: 0, endDiv: measureEndDiv }],
    notes: [createPartituraNoteFixtureV1({ sourceNoteId })],
    rests: [],
    timeSignatures: [{ startDiv: 0, beats: 4, beatType: 4 }],
    keySignatures: [{ startDiv: 0, fifths: 0, mode: null }],
    clefs: [{ startDiv: 0, staff: 1, sign: 'G', line: 2, octaveChange: 0 }]
  }],
  preservedSymbols: [],
  diagnostics: [],
  provenance: {
    parser: 'partitura',
    partituraVersion: '1.9.0',
    sourceIdentity
  }
});
