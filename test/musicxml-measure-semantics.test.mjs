import test from 'node:test';
import assert from 'node:assert/strict';

import {
  importMusicXml,
  importMusicXmlWithMeasureSemantics,
  MusicXmlError
} from '../dist/packages/musicxml/src/index.js';
import { notationForMeasure } from '../dist/packages/notation-structure/src/index.js';
import { createInsertionPosition } from '../dist/packages/editor-insertion-position/src/index.js';
import { classifyInsertionWindow } from '../dist/packages/editor-measure-timing/src/index.js';
import { addressEntity } from '../dist/packages/addressing/src/index.js';

const byteLength = (value) => new TextEncoder().encode(value).byteLength;
const sourceFor = (xml, fill = '9') => ({
  sha256: fill.repeat(64),
  format: 'musicxml',
  byteLength: byteLength(xml)
});

const wrap = (measures) => `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">${measures}</part>
</score-partwise>`;

const measure = (number, body, attributes = '') => `
    <measure number="${number}"${attributes}>
      ${body}
    </measure>`;

const note = (step = 'C', duration = 4, voice = 1) => `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>${duration}</duration><voice>${voice}</voice></note>`;

const twoMeasureTime = wrap(
  measure('1', `<attributes><divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>${note('C')}`) +
  measure('2', `${note('D')}`)
);

test('legacy E2 importer still rejects time signatures instead of silently discarding them', () => {
  assert.throws(
    () => importMusicXml(twoMeasureTime, { source: sourceFor(twoMeasureTime) }),
    (error) => error instanceof MusicXmlError && error.code === 'UNSUPPORTED_MUSICXML'
  );
});

test('SEC-NE-04B1 imports declared time and records inherited effective time without changing public notation schema', () => {
  const result = importMusicXmlWithMeasureSemantics(twoMeasureTime, { source: sourceFor(twoMeasureTime) });
  const staff = result.score.parts[0].staves[0];
  const first = result.measureSemantics.measures[0];
  const second = result.measureSemantics.measures[1];

  assert.equal(result.score.revision.id, result.notation.revisionId);
  assert.equal(result.score.revision.id, result.measureSemantics.revisionId);
  assert.equal(first.target.measureId, staff.measures[0].id);
  assert.deepEqual(first.declaredTimeSignature, { beats: 4, beatType: 4 });
  assert.deepEqual(first.effectiveTimeSignature, { beats: 4, beatType: 4 });
  assert.equal(first.timeSignatureSource, 'DECLARED_HERE');
  assert.equal(first.implicit, null);
  assert.equal(first.nonControlling, null);

  assert.equal(second.target.measureId, staff.measures[1].id);
  assert.equal(second.declaredTimeSignature, null);
  assert.deepEqual(second.effectiveTimeSignature, { beats: 4, beatType: 4 });
  assert.equal(second.timeSignatureSource, 'INHERITED');

  assert.deepEqual(notationForMeasure(result.notation, staff.measures[0].id)?.timeSignature, { beats: 4, beatType: 4 });
  assert.equal(notationForMeasure(result.notation, staff.measures[1].id), null);
});

test('time-signature changes are explicit evidence and then inherit forward', () => {
  const xml = wrap(
    measure('1', `<attributes><divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>${note('C')}`) +
    measure('2', `<attributes><time><beats>3</beats><beat-type>4</beat-type></time></attributes>${note('D')}`) +
    measure('3', `${note('E')}`)
  );
  const result = importMusicXmlWithMeasureSemantics(xml, { source: sourceFor(xml, '8') });
  assert.equal(result.measureSemantics.measures[1].timeSignatureSource, 'DECLARED_HERE');
  assert.deepEqual(result.measureSemantics.measures[1].declaredTimeSignature, { beats: 3, beatType: 4 });
  assert.equal(result.measureSemantics.measures[2].timeSignatureSource, 'INHERITED');
  assert.deepEqual(result.measureSemantics.measures[2].effectiveTimeSignature, { beats: 3, beatType: 4 });
});

test('implicit and non-controlling measure attributes are preserved independently and never conflated', () => {
  const xml = wrap(
    measure('0', `<attributes><divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>${note('C')}`, ' implicit="yes"') +
    measure('1', `${note('D')}`, ' non-controlling="yes"')
  );
  const result = importMusicXmlWithMeasureSemantics(xml, { source: sourceFor(xml, '7') });
  assert.equal(result.measureSemantics.measures[0].implicit, 'yes');
  assert.equal(result.measureSemantics.measures[0].nonControlling, null);
  assert.equal(result.measureSemantics.measures[1].implicit, null);
  assert.equal(result.measureSemantics.measures[1].nonControlling, 'yes');
});

test('backup and forward timing operations are preserved as exact rational cursor evidence', () => {
  const xml = wrap(measure('1', `
    <attributes><divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
    ${note('C')}
    <forward><duration>4</duration></forward>
    <backup><duration>4</duration></backup>
    ${note('E', 4, 2)}
  `));
  const result = importMusicXmlWithMeasureSemantics(xml, { source: sourceFor(xml, '6') });
  const operations = result.measureSemantics.measures[0].cursorOperations;
  assert.equal(operations.length, 2);
  assert.deepEqual(operations[0], {
    sourceOrder: 2,
    kind: 'forward',
    duration: { numerator: 1, denominator: 4 },
    cursorBefore: { numerator: 1, denominator: 4 },
    cursorAfter: { numerator: 1, denominator: 2 }
  });
  assert.deepEqual(operations[1], {
    sourceOrder: 3,
    kind: 'backup',
    duration: { numerator: 1, denominator: 4 },
    cursorBefore: { numerator: 1, denominator: 2 },
    cursorAfter: { numerator: 1, denominator: 4 }
  });
});

test('a short or implicit measure does not make an apparent canonical gap writable in 04B1', () => {
  const xml = wrap(measure('0', `
    <attributes><divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
    ${note('C')}
  `, ' implicit="yes"'));
  const result = importMusicXmlWithMeasureSemantics(xml, { source: sourceFor(xml, '5') });
  const score = result.score;
  const voiceAddress = addressEntity(score, score.parts[0].staves[0].measures[0].voices[0].id);
  assert.equal(voiceAddress.kind, 'voice');
  const position = createInsertionPosition(score, voiceAddress, { numerator: 1, denominator: 4 });
  const classification = classifyInsertionWindow(score, result.notation, position, { numerator: 1, denominator: 4 });
  assert.equal(result.measureSemantics.measures[0].implicit, 'yes');
  assert.equal(classification.kind, 'IMPLICIT_GAP_UNADMITTED');
  assert.equal(classification.safeToAuthor, false);
});

test('short measures without source implicit evidence are not inferred as pickups', () => {
  const xml = wrap(measure('1', `
    <attributes><divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
    ${note('C')}
  `));
  const result = importMusicXmlWithMeasureSemantics(xml, { source: sourceFor(xml, '4') });
  assert.equal(result.measureSemantics.measures[0].implicit, null);
  assert.equal(result.measureSemantics.measures[0].nonControlling, null);
});

test('unsupported or ambiguous time/measure forms fail closed in the additive importer', () => {
  const commonTime = wrap(measure('1', `<attributes><divisions>4</divisions><time symbol="common"><beats>4</beats><beat-type>4</beat-type></time></attributes>${note()}`));
  assert.throws(
    () => importMusicXmlWithMeasureSemantics(commonTime, { source: sourceFor(commonTime, '3') }),
    (error) => error instanceof MusicXmlError && error.code === 'UNSUPPORTED_MUSICXML'
  );

  const invalidImplicit = wrap(measure('1', `<attributes><divisions>4</divisions></attributes>${note()}`, ' implicit="maybe"'));
  assert.throws(
    () => importMusicXmlWithMeasureSemantics(invalidImplicit, { source: sourceFor(invalidImplicit, '2') }),
    (error) => error instanceof MusicXmlError && error.code === 'INVALID_MUSICXML_SEMANTICS'
  );

  const midMeasureTime = wrap(measure('1', `<attributes><divisions>4</divisions></attributes>${note()}<attributes><time><beats>3</beats><beat-type>4</beat-type></time></attributes>`));
  assert.throws(
    () => importMusicXmlWithMeasureSemantics(midMeasureTime, { source: sourceFor(midMeasureTime, '1') }),
    (error) => error instanceof MusicXmlError && error.code === 'UNSUPPORTED_MUSICXML'
  );
});

test('legacy importer also continues to reject new measure attributes', () => {
  const xml = wrap(measure('0', `<attributes><divisions>4</divisions></attributes>${note()}`, ' implicit="yes"'));
  assert.throws(
    () => importMusicXml(xml, { source: sourceFor(xml, '0') }),
    (error) => error instanceof MusicXmlError && error.code === 'UNSUPPORTED_MUSICXML'
  );
});
