import test from 'node:test';
import assert from 'node:assert/strict';
import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { addressEntity } from '../dist/packages/addressing/src/index.js';
import { createNotationDocument, emptyNotationDocument } from '../dist/packages/notation-structure/src/index.js';
import {
  createGuitarWorkspaceProjection,
  guitarWorkspaceProjectionProfile,
  GuitarWorkspaceProjectionError
} from '../dist/packages/guitar-workspace-projection/src/index.js';

const baseScoreInput = () => ({
  schemaVersion: '1.0.0',
  id: 'doc-e8b-1',
  revision: { id: 'rev-e8b-1', parentId: null },
  source: { sha256: '9'.repeat(64), format: 'synthetic', byteLength: null },
  parts: [{
    id: 'part-core-1',
    name: 'Projection Fixture',
    staves: [{
      id: 'staff-core-1',
      ordinal: 1,
      measures: [{
        id: 'measure-core-1',
        ordinal: 1,
        displayNumber: '1',
        voices: [
          {
            id: 'voice-core-1',
            ordinal: 1,
            events: [
              {
                id: 'event-note-1',
                kind: 'note',
                onset: { numerator: 0, denominator: 1 },
                duration: { numerator: 1, denominator: 4 },
                note: { id: 'note-1', pitch: { step: 'E', alter: 0, octave: 4 } }
              },
              {
                id: 'event-chord-1',
                kind: 'chord',
                onset: { numerator: 1, denominator: 4 },
                duration: { numerator: 1, denominator: 4 },
                notes: [
                  { id: 'note-2', pitch: { step: 'G', alter: 0, octave: 4 } },
                  { id: 'note-3', pitch: { step: 'B', alter: 0, octave: 4 } }
                ]
              }
            ]
          },
          {
            id: 'voice-core-2',
            ordinal: 2,
            events: [{
              id: 'event-rest-1',
              kind: 'rest',
              onset: { numerator: 0, denominator: 1 },
              duration: { numerator: 1, denominator: 2 }
            }]
          }
        ]
      }]
    }]
  }]
});

const notationForBaseScore = (score) => createNotationDocument(score, {
  contractVersion: '1.0.0',
  documentId: score.id,
  revisionId: score.revision.id,
  measures: [{
    target: addressEntity(score, 'measure-core-1'),
    notation: {
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: { fifths: 2 },
      clef: { sign: 'G', line: 2, octaveChange: 0 },
      barlines: [{ location: 'right', style: 'light-heavy', repeat: null }]
    }
  }],
  events: [{
    target: addressEntity(score, 'event-note-1'),
    notation: {
      dots: 1,
      beams: [{ number: 1, value: 'begin' }],
      tuplet: { actualNotes: 3, normalNotes: 2, marks: [{ number: 1, type: 'start' }] }
    }
  }],
  notes: [{
    target: addressEntity(score, 'note-1'),
    notation: {
      accidental: 'natural',
      ties: [{ number: 1, type: 'start' }],
      slurs: [{ number: 1, type: 'start' }]
    }
  }]
});

const expectProjectionError = (fn, code) => {
  assert.throws(fn, (error) => error instanceof GuitarWorkspaceProjectionError && error.code === code);
};

test('E8-B profile is projection-only and does not invoke or ingest the engine', () => {
  assert.equal(guitarWorkspaceProjectionProfile.musicXmlAndSourceMapSameTraversal, true);
  assert.equal(guitarWorkspaceProjectionProfile.preservesCanonicalPitchAndTiming, true);
  assert.equal(guitarWorkspaceProjectionProfile.preservesTieStartStopFacts, true);
  assert.equal(guitarWorkspaceProjectionProfile.externalEngineInvocation, false);
  assert.equal(guitarWorkspaceProjectionProfile.externalResultIngestion, false);
  assert.equal(guitarWorkspaceProjectionProfile.reverseCanonicalWriteAuthority, false);
  assert.equal(guitarWorkspaceProjectionProfile.productionAuthority, false);
  assert.equal(Object.isFrozen(guitarWorkspaceProjectionProfile), true);
});

test('E8-B emits engine-safe MusicXML and source mapping from the same deterministic note order', () => {
  const score = createScoreDocument(baseScoreInput());
  const projection = createGuitarWorkspaceProjection(score, notationForBaseScore(score));

  assert.equal(projection.contractVersion, '1.0.0');
  assert.equal(projection.enginePartId, 'P1');
  assert.equal(projection.musicXmlVersion, '4.0');
  assert.equal(projection.sourceEventCount, 4);
  assert.equal((projection.musicXml.match(/<note>/g) ?? []).length, 4);
  assert.match(projection.musicXml, /<score-part id="P1">/);
  assert.match(projection.musicXml, /<part id="P1">/);
  assert.match(projection.musicXml, /<divisions>1<\/divisions>/);
  assert.match(projection.musicXml, /<beats>4<\/beats>/);
  assert.match(projection.musicXml, /<beat-type>4<\/beat-type>/);
  assert.match(projection.musicXml, /<chord\/>/);
  assert.match(projection.musicXml, /<backup>[\s\S]*<duration>2<\/duration>[\s\S]*<\/backup>/);
  assert.match(projection.musicXml, /<tie type="start"\/>/);

  assert.equal(projection.musicXml.includes('<clef>'), false);
  assert.equal(projection.musicXml.includes('<key>'), false);
  assert.equal(projection.musicXml.includes('<barline'), false);
  assert.equal(projection.musicXml.includes('<slur'), false);
  assert.equal(projection.musicXml.includes('<time-modification>'), false);
  assert.equal(projection.musicXml.includes('<beam'), false);
  assert.equal(projection.musicXml.includes('<dot'), false);

  assert.deepEqual(
    projection.sourceMap.entries.map((entry) => [entry.sourceEventId, entry.target.kind, entry.target.kind === 'note' ? entry.target.noteId : entry.target.eventId]),
    [
      ['P1:measure:0:note:0', 'note', 'note-1'],
      ['P1:measure:0:note:1', 'note', 'note-2'],
      ['P1:measure:0:note:2', 'note', 'note-3'],
      ['P1:measure:0:note:3', 'event', 'event-rest-1']
    ]
  );
  assert.equal(Object.isFrozen(projection), true);
  assert.equal(Object.isFrozen(projection.sourceMap), true);
});

test('E8-B normalizes canonical staff ordinals to the admitted engine staff numbers 1 and 2', () => {
  const input = baseScoreInput();
  const firstStaff = input.parts[0].staves[0];
  firstStaff.ordinal = 10;
  firstStaff.measures[0].voices = [firstStaff.measures[0].voices[0]];
  const secondStaff = structuredClone(firstStaff);
  secondStaff.id = 'staff-core-2';
  secondStaff.ordinal = 20;
  secondStaff.measures[0].id = 'measure-core-2';
  secondStaff.measures[0].voices[0].id = 'voice-core-3';
  secondStaff.measures[0].voices[0].events = [{
    id: 'event-note-4',
    kind: 'note',
    onset: { numerator: 0, denominator: 1 },
    duration: { numerator: 1, denominator: 4 },
    note: { id: 'note-4', pitch: { step: 'C', alter: 0, octave: 4 } }
  }];
  input.parts[0].staves.push(secondStaff);

  const score = createScoreDocument(input);
  const notation = createNotationDocument(score, {
    contractVersion: '1.0.0',
    documentId: score.id,
    revisionId: score.revision.id,
    measures: [
      {
        target: addressEntity(score, 'measure-core-1'),
        notation: { timeSignature: { beats: 4, beatType: 4 }, keySignature: null, clef: null, barlines: [] }
      },
      {
        target: addressEntity(score, 'measure-core-2'),
        notation: { timeSignature: { beats: 4, beatType: 4 }, keySignature: null, clef: null, barlines: [] }
      }
    ],
    events: [],
    notes: []
  });

  const projection = createGuitarWorkspaceProjection(score, notation);
  assert.match(projection.musicXml, /<staves>2<\/staves>/);
  assert.match(projection.musicXml, /<staff>1<\/staff>/);
  assert.match(projection.musicXml, /<staff>2<\/staff>/);
  assert.equal(projection.sourceMap.entries.at(-1).target.noteId, 'note-4');
});

test('E8-B rejects missing meter, multipart input and stale notation fail closed', () => {
  const score = createScoreDocument(baseScoreInput());
  expectProjectionError(() => createGuitarWorkspaceProjection(score, emptyNotationDocument(score)), 'MISSING_TIME_SIGNATURE');

  const multipart = baseScoreInput();
  const secondPart = structuredClone(multipart.parts[0]);
  secondPart.id = 'part-core-2';
  secondPart.staves[0].id = 'staff-second-part';
  secondPart.staves[0].measures[0].id = 'measure-second-part';
  secondPart.staves[0].measures[0].voices[0].id = 'voice-second-part-1';
  secondPart.staves[0].measures[0].voices[1].id = 'voice-second-part-2';
  secondPart.staves[0].measures[0].voices[0].events[0].id = 'event-second-part-1';
  secondPart.staves[0].measures[0].voices[0].events[0].note.id = 'note-second-part-1';
  secondPart.staves[0].measures[0].voices[0].events[1].id = 'event-second-part-2';
  secondPart.staves[0].measures[0].voices[0].events[1].notes[0].id = 'note-second-part-2';
  secondPart.staves[0].measures[0].voices[0].events[1].notes[1].id = 'note-second-part-3';
  secondPart.staves[0].measures[0].voices[1].events[0].id = 'event-second-part-rest';
  multipart.parts.push(secondPart);
  const multipartScore = createScoreDocument(multipart);
  expectProjectionError(
    () => createGuitarWorkspaceProjection(multipartScore, emptyNotationDocument(multipartScore)),
    'UNSUPPORTED_PART_COUNT'
  );

  const staleInput = baseScoreInput();
  staleInput.revision = { id: 'rev-e8b-2', parentId: 'rev-e8b-1' };
  const nextScore = createScoreDocument(staleInput);
  expectProjectionError(() => createGuitarWorkspaceProjection(nextScore, notationForBaseScore(score)), 'STALE_NOTATION');
});

test('E8-B rejects same-voice overlap and events beyond the active measure duration', () => {
  const overlapping = baseScoreInput();
  overlapping.parts[0].staves[0].measures[0].voices[0].events[1].onset = { numerator: 1, denominator: 8 };
  const overlapScore = createScoreDocument(overlapping);
  expectProjectionError(
    () => createGuitarWorkspaceProjection(overlapScore, notationForBaseScore(overlapScore)),
    'OVERLAPPING_VOICE_EVENTS'
  );

  const outside = baseScoreInput();
  outside.parts[0].staves[0].measures[0].voices[0].events[1].onset = { numerator: 7, denominator: 8 };
  const outsideScore = createScoreDocument(outside);
  expectProjectionError(
    () => createGuitarWorkspaceProjection(outsideScore, notationForBaseScore(outsideScore)),
    'EVENT_OUTSIDE_MEASURE'
  );
});
