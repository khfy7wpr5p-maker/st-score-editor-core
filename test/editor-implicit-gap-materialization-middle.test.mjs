import test from 'node:test';
import assert from 'node:assert/strict';

import { importMusicXmlWithMeasureSemantics } from '../dist/packages/musicxml/src/index.js';
import { addressEntity } from '../dist/packages/addressing/src/index.js';
import { createInsertionPosition } from '../dist/packages/editor-insertion-position/src/index.js';
import { executeImplicitGapMaterialization } from '../dist/packages/editor-implicit-gap-materialization/src/index.js';

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note>
      <forward><duration>4</duration></forward>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note>
    </measure>
  </part>
</score-partwise>`;

const byteLength = new TextEncoder().encode(xml).byteLength;
const imported = importMusicXmlWithMeasureSemantics(xml, {
  source: { sha256: 'c'.repeat(64), format: 'musicxml', byteLength }
});
const score = imported.score;
const voice = score.parts[0].staves[0].measures[0].voices[0];
const voiceAddress = addressEntity(score, voice.id);
assert.equal(voiceAddress.kind, 'voice');

test('only the requested containing implicit gap is materialized when the voice has multiple gaps', () => {
  const position = createInsertionPosition(score, voiceAddress, { numerator: 3, denominator: 8 });
  const next = executeImplicitGapMaterialization(
    score,
    imported.notation,
    imported.measureSemantics,
    position,
    { numerator: 1, denominator: 8 },
    { version: '1.0.0', type: 'MATERIALIZE_IMPLICIT_GAP', restEventId: 'rest-middle-gap' },
    { operationId: 'materialize-middle-gap', nextRevisionId: 'rev-middle-gap' }
  );

  const events = next.parts[0].staves[0].measures[0].voices[0].events;
  assert.equal(events.length, 3);
  assert.deepEqual(events[0], score.parts[0].staves[0].measures[0].voices[0].events[0]);
  assert.deepEqual(events[1], {
    id: 'rest-middle-gap',
    kind: 'rest',
    onset: { numerator: 1, denominator: 4 },
    duration: { numerator: 1, denominator: 4 }
  });
  assert.deepEqual(events[2], score.parts[0].staves[0].measures[0].voices[0].events[1]);

  assert.equal(events.some((event) => event.onset.numerator === 3 && event.onset.denominator === 4 && event.kind === 'rest'), false);
});
