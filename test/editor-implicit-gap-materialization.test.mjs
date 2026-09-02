import test from 'node:test';
import assert from 'node:assert/strict';

import {
  importMusicXmlWithMeasureSemantics
} from '../dist/packages/musicxml/src/index.js';
import { addressEntity } from '../dist/packages/addressing/src/index.js';
import { createInsertionPosition } from '../dist/packages/editor-insertion-position/src/index.js';
import { classifyInsertionWindow } from '../dist/packages/editor-measure-timing/src/index.js';
import {
  assessImplicitGapMaterialization,
  executeImplicitGapMaterialization,
  ImplicitGapMaterializationError
} from '../dist/packages/editor-implicit-gap-materialization/src/index.js';
import {
  createEditorHistory,
  commitEditorHistory,
  rebindNotationAfterScoreEdit,
  undoEditorHistory,
  redoEditorHistory
} from '../dist/packages/editor-history/src/index.js';

const byteLength = (value) => new TextEncoder().encode(value).byteLength;
const sourceFor = (xml, fill = '3') => ({
  sha256: fill.repeat(64),
  format: 'musicxml',
  byteLength: byteLength(xml)
});

const wrap = (measureAttributes = '', body = '') => `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1"${measureAttributes}>
      <attributes><divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      ${body}
    </measure>
  </part>
</score-partwise>`;

const note = (step, duration, voice = 1) => `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>${duration}</duration><voice>${voice}</voice></note>`;
const rest = (duration, voice = 1) => `<note><rest/><duration>${duration}</duration><voice>${voice}</voice></note>`;
const normalXml = wrap('', note('C', 4));

const imported = (xml = normalXml, fill = '3') => importMusicXmlWithMeasureSemantics(xml, { source: sourceFor(xml, fill) });

const positionAt = (score, voiceId, numerator, denominator) => {
  const voice = addressEntity(score, voiceId);
  assert.equal(voice.kind, 'voice');
  return createInsertionPosition(score, voice, { numerator, denominator });
};

const intent = (restEventId = 'rest-materialized') => ({
  version: '1.0.0',
  type: 'MATERIALIZE_IMPLICIT_GAP',
  restEventId
});

const identity = (nextRevisionId = 'rev-materialized') => ({
  operationId: `materialize-${nextRevisionId}`,
  nextRevisionId
});

const eventsOf = (score, voiceIndex = 0) => score.parts[0].staves[0].measures[0].voices[voiceIndex].events;

test('normal known-meter implicit silence is admitted and the entire containing gap becomes one deterministic explicit rest', () => {
  const result = imported();
  const score = result.score;
  const voiceId = score.parts[0].staves[0].measures[0].voices[0].id;
  const position = positionAt(score, voiceId, 1, 2);

  const assessment = assessImplicitGapMaterialization(
    score,
    result.notation,
    result.measureSemantics,
    position,
    { numerator: 1, denominator: 4 }
  );
  assert.equal(assessment.safeToMaterialize, true);
  if (!assessment.safeToMaterialize) return;
  assert.deepEqual(assessment.gapStart, { numerator: 1, denominator: 4 });
  assert.deepEqual(assessment.gapEnd, { numerator: 1, denominator: 1 });

  const next = executeImplicitGapMaterialization(
    score,
    result.notation,
    result.measureSemantics,
    position,
    { numerator: 1, denominator: 4 },
    intent(),
    identity()
  );

  assert.equal(next.revision.parentId, score.revision.id);
  assert.deepEqual(eventsOf(next), [
    eventsOf(score)[0],
    {
      id: 'rest-materialized',
      kind: 'rest',
      onset: { numerator: 1, denominator: 4 },
      duration: { numerator: 3, denominator: 4 }
    }
  ]);
  assert.deepEqual(eventsOf(score), [eventsOf(score)[0]]);
});

test('materialized gap becomes an explicit-rest slot after same-revision notation rebind', () => {
  const result = imported(normalXml, '4');
  const score = result.score;
  const voiceId = score.parts[0].staves[0].measures[0].voices[0].id;
  const next = executeImplicitGapMaterialization(
    score,
    result.notation,
    result.measureSemantics,
    positionAt(score, voiceId, 1, 2),
    { numerator: 1, denominator: 4 },
    intent('rest-gap-ready'),
    identity('rev-gap-ready')
  );
  const nextNotation = rebindNotationAfterScoreEdit(score, result.notation, next);
  const classification = classifyInsertionWindow(
    next,
    nextNotation,
    positionAt(next, voiceId, 1, 2),
    { numerator: 1, denominator: 4 }
  );
  assert.equal(classification.kind, 'EXPLICIT_REST_SLOT');
  if (classification.kind === 'EXPLICIT_REST_SLOT') assert.equal(classification.restEventId, 'rest-gap-ready');
});

test('pickup/implicit and non-controlling measures remain fail-closed', () => {
  for (const [attributes, reason, fill] of [
    [' implicit="yes"', 'IMPLICIT_MEASURE', '5'],
    [' non-controlling="yes"', 'NON_CONTROLLING_MEASURE', '6']
  ]) {
    const xml = wrap(attributes, note('C', 4));
    const result = imported(xml, fill);
    const voiceId = result.score.parts[0].staves[0].measures[0].voices[0].id;
    const assessment = assessImplicitGapMaterialization(
      result.score,
      result.notation,
      result.measureSemantics,
      positionAt(result.score, voiceId, 1, 2),
      { numerator: 1, denominator: 4 }
    );
    assert.deepEqual(assessment, { kind: 'IMPLICIT_GAP_UNSAFE', safeToMaterialize: false, reason });
  }
});

test('measure evidence meter must independently match the notation timing authority', () => {
  const result = imported(normalXml, '7');
  const score = result.score;
  const voiceId = score.parts[0].staves[0].measures[0].voices[0].id;
  const original = result.measureSemantics.measures[0];
  const mismatchedEvidence = {
    ...result.measureSemantics,
    measures: [{
      ...original,
      declaredTimeSignature: { beats: 3, beatType: 4 },
      effectiveTimeSignature: { beats: 3, beatType: 4 }
    }]
  };
  const assessment = assessImplicitGapMaterialization(
    score,
    result.notation,
    mismatchedEvidence,
    positionAt(score, voiceId, 1, 2),
    { numerator: 1, denominator: 4 }
  );
  assert.deepEqual(assessment, { kind: 'IMPLICIT_GAP_UNSAFE', safeToMaterialize: false, reason: 'TIME_SIGNATURE_MISMATCH' });
});

test('gap admission is exact-target-voice and does not infer occupancy from another voice', () => {
  const xml = wrap('', `${note('C', 4, 1)}<backup><duration>4</duration></backup>${note('G', 16, 2)}`);
  const result = imported(xml, '8');
  const voices = result.score.parts[0].staves[0].measures[0].voices;
  assert.equal(voices.length, 2);

  const voice1Assessment = assessImplicitGapMaterialization(
    result.score,
    result.notation,
    result.measureSemantics,
    positionAt(result.score, voices[0].id, 1, 2),
    { numerator: 1, denominator: 4 }
  );
  assert.equal(voice1Assessment.safeToMaterialize, true);

  const voice2Assessment = assessImplicitGapMaterialization(
    result.score,
    result.notation,
    result.measureSemantics,
    positionAt(result.score, voices[1].id, 1, 2),
    { numerator: 1, denominator: 4 }
  );
  assert.deepEqual(voice2Assessment, { kind: 'IMPLICIT_GAP_UNSAFE', safeToMaterialize: false, reason: 'WINDOW_NOT_IMPLICIT_GAP' });
});

test('an explicit rest is never rematerialized as an implicit gap', () => {
  const xml = wrap('', rest(16));
  const result = imported(xml, '9');
  const voiceId = result.score.parts[0].staves[0].measures[0].voices[0].id;
  const assessment = assessImplicitGapMaterialization(
    result.score,
    result.notation,
    result.measureSemantics,
    positionAt(result.score, voiceId, 1, 4),
    { numerator: 1, denominator: 4 }
  );
  assert.deepEqual(assessment, { kind: 'IMPLICIT_GAP_UNSAFE', safeToMaterialize: false, reason: 'WINDOW_NOT_IMPLICIT_GAP' });
});

test('stale measure evidence and duplicate rest ids fail closed', () => {
  const result = imported(normalXml, 'a');
  const score = result.score;
  const voiceId = score.parts[0].staves[0].measures[0].voices[0].id;
  const position = positionAt(score, voiceId, 1, 2);

  assert.throws(
    () => executeImplicitGapMaterialization(
      score,
      result.notation,
      { ...result.measureSemantics, revisionId: 'stale-revision' },
      position,
      { numerator: 1, denominator: 4 },
      intent(),
      identity('rev-stale')
    ),
    (error) => error instanceof ImplicitGapMaterializationError && error.code === 'INVALID_MEASURE_EVIDENCE'
  );

  assert.throws(
    () => executeImplicitGapMaterialization(
      score,
      result.notation,
      result.measureSemantics,
      position,
      { numerator: 1, denominator: 4 },
      intent(voiceId),
      identity('rev-duplicate')
    ),
    (error) => error instanceof ImplicitGapMaterializationError && error.code === 'ID_CONFLICT'
  );
});

test('materialization composes with unified history and undo/redo without changing unrelated event onset', () => {
  const result = imported(normalXml, 'b');
  const score = result.score;
  const voiceId = score.parts[0].staves[0].measures[0].voices[0].id;
  const originalEvent = structuredClone(eventsOf(score)[0]);
  const next = executeImplicitGapMaterialization(
    score,
    result.notation,
    result.measureSemantics,
    positionAt(score, voiceId, 1, 2),
    { numerator: 1, denominator: 4 },
    intent('rest-history'),
    identity('rev-history')
  );
  const nextNotation = rebindNotationAfterScoreEdit(score, result.notation, next);
  const committed = commitEditorHistory(createEditorHistory(score, result.notation), next, nextNotation);
  assert.deepEqual(eventsOf(committed.present.score)[0], originalEvent);

  const undone = undoEditorHistory(committed);
  assert.equal(eventsOf(undone.present.score).length, 1);
  assert.deepEqual(eventsOf(undone.present.score)[0], originalEvent);

  const redone = redoEditorHistory(undone);
  assert.equal(eventsOf(redone.present.score).length, 2);
  assert.equal(eventsOf(redone.present.score)[1].id, 'rest-history');
  assert.deepEqual(eventsOf(redone.present.score)[0], originalEvent);
});
