import test from 'node:test';
import assert from 'node:assert/strict';
import { createScoreDocumentV2 } from '../dist/packages/score-model-v2/src/index.js';
import { createNotationDocumentV2 } from '../dist/packages/notation-structure-v2/src/index.js';
import { addressEntityV2 } from '../dist/packages/addressing-v2/src/index.js';
import { serializeNotationMusicXmlV2, importNotationMusicXmlV2 } from '../dist/packages/musicxml-v2/src/index.js';
import { importNotationMusicXml } from '../dist/packages/musicxml/src/index.js';

const source = { sha256: 'd'.repeat(64), format: 'synthetic', byteLength: null };
const scoreInput = {
  schemaVersion: '2.0.0', id: 'doc-v2-xml', revision: { id: 'rev-1', parentId: null }, source,
  parts: [{ id: 'part-1', name: 'Part', staves: [{ id: 'staff-1-1', ordinal: 1, measures: [{ id: 'measure-1-1-1', ordinal: 1, displayNumber: '1', voices: [{
    id: 'voice-1-1-1-1', ordinal: 1,
    events: [
      { id: 'event-1-1-1-1-1', kind: 'note', onset: { numerator: 0, denominator: 1 }, duration: { numerator: 1, denominator: 4 }, note: { id: 'note-1-1-1-1-1-1', pitch: { step: 'C', alter: 0, octave: 4 } } },
      { id: 'event-1-1-1-1-2', kind: 'note', onset: { numerator: 1, denominator: 4 }, duration: { numerator: 1, denominator: 4 }, note: { id: 'note-1-1-1-1-2-1', pitch: { step: 'D', alter: 0, octave: 4 } } },
      { id: 'event-1-1-1-1-3', kind: 'note', onset: { numerator: 1, denominator: 2 }, duration: { numerator: 1, denominator: 4 }, note: { id: 'note-1-1-1-1-3-1', pitch: { step: 'E', alter: 0, octave: 4 } } }
    ],
    graceGroups: [
      { id: 'grace-group-1-1-1-1-2-before', anchorEventId: 'event-1-1-1-1-2', placement: 'before', events: [{ id: 'grace-event-1-1-1-1-1', kind: 'note', writtenDuration: { numerator: 1, denominator: 16 }, playback: { stealTimePreviousPercent: null, stealTimeFollowingPercent: { numerator: 10, denominator: 1 }, makeTime: { numerator: 1, denominator: 16 } }, note: { id: 'grace-note-1-1-1-1-1-1', pitch: { step: 'F', alter: 1, octave: 4 } } }] },
      { id: 'grace-group-1-1-1-1-2-after', anchorEventId: 'event-1-1-1-1-2', placement: 'after', events: [{ id: 'grace-event-1-1-1-1-2', kind: 'chord', writtenDuration: { numerator: 1, denominator: 8 }, playback: { stealTimePreviousPercent: null, stealTimeFollowingPercent: null, makeTime: null }, notes: [{ id: 'grace-note-1-1-1-1-2-1', pitch: { step: 'G', alter: 0, octave: 4 } }, { id: 'grace-note-1-1-1-1-2-2', pitch: { step: 'B', alter: 0, octave: 4 } }] }] }
    ]
  }] }]}]}]
};

const eventNotation = (articulations = [], ornaments = []) => ({ dots: 0, beams: [], tuplet: null, articulations, ornaments });
const score = createScoreDocumentV2(scoreInput);
const notation = createNotationDocumentV2(score, {
  contractVersion: '2.0.0', documentId: score.id, revisionId: score.revision.id, measures: [], notes: [],
  events: [
    { target: addressEntityV2(score, 'event-1-1-1-1-1'), notation: eventNotation([{ kind: 'accent', placement: 'above', direction: null }], [{ kind: 'tremolo', type: 'start', marks: 3, number: 2, placement: 'auto' }, { kind: 'wavy-line', type: 'start', number: 3, placement: 'above' }]) },
    { target: addressEntityV2(score, 'event-1-1-1-1-2'), notation: eventNotation([], [{ kind: 'tremolo', type: 'stop', marks: 3, number: 2, placement: 'auto' }, { kind: 'wavy-line', type: 'continue', number: 3, placement: 'above' }]) },
    { target: addressEntityV2(score, 'event-1-1-1-1-3'), notation: eventNotation([], [{ kind: 'wavy-line', type: 'stop', number: 3, placement: 'above' }, { kind: 'trill-mark', placement: 'above', accidentalMarks: [{ accidental: 'sharp', placement: 'above' }] }]) }
  ],
  graceEvents: [
    { target: addressEntityV2(score, 'grace-event-1-1-1-1-1'), notation: { slash: true, dots: 0, beams: [], articulations: [{ kind: 'staccato', placement: 'auto', direction: null }], ornaments: [{ kind: 'turn', placement: 'above', accidentalMarks: [] }] } },
    { target: addressEntityV2(score, 'grace-event-1-1-1-1-2'), notation: { slash: false, dots: 1, beams: [], articulations: [], ornaments: [] } }
  ],
  graceNotes: [
    { target: addressEntityV2(score, 'grace-note-1-1-1-1-1-1'), notation: { accidental: 'sharp', ties: [], slurs: [] } }
  ]
});

const normalized = (value) => JSON.parse(JSON.stringify(value));

test('SSE-06 serializer -> importer preserves bounded v2 score and notation semantics', () => {
  const xml = serializeNotationMusicXmlV2(score, notation);
  assert.match(xml, /<grace/);
  assert.match(xml, /<articulations>/);
  assert.match(xml, /<ornaments>/);
  assert.match(xml, /<tremolo type="start" number="2"/);
  assert.match(xml, /<wavy-line type="continue" number="3"/);
  const imported = importNotationMusicXmlV2(xml, { source, documentId: score.id, revisionId: score.revision.id });
  assert.deepEqual(normalized(imported.score), normalized(score));
  assert.deepEqual(normalized(imported.notation), normalized(notation));
});

test('SSE-06 legacy notation importer remains fail-closed for v2 XML', () => {
  const xml = serializeNotationMusicXmlV2(score, notation);
  assert.throws(() => importNotationMusicXml(xml, { source, documentId: score.id, revisionId: score.revision.id }));
});

test('SSE-06 rejects unsupported before-grace previous-time stealing rather than losing placement semantics', () => {
  const invalid = createScoreDocumentV2({ ...scoreInput, parts: scoreInput.parts.map((part) => ({ ...part, staves: part.staves.map((staff) => ({ ...staff, measures: staff.measures.map((measure) => ({ ...measure, voices: measure.voices.map((voice) => ({ ...voice, graceGroups: voice.graceGroups.map((group) => group.placement === 'before' ? { ...group, events: group.events.map((event) => ({ ...event, playback: { ...event.playback, stealTimePreviousPercent: { numerator: 5, denominator: 1 } } })) } : group) })) })) })) })) });
  const emptyNotation = createNotationDocumentV2(invalid, { contractVersion: '2.0.0', documentId: invalid.id, revisionId: invalid.revision.id, measures: [], events: [], notes: [], graceEvents: [], graceNotes: [] });
  assert.throws(() => serializeNotationMusicXmlV2(invalid, emptyNotation));
});
