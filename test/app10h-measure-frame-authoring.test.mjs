import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { executeTopologyAuthoringV4 } from '../dist/packages/editor-topology-authoring-v4/src/index.js';
import {
  createNewScoreEditorAppDocument,
  exportMusicXmlScoreEditorAppDocument,
  openMusicXmlScoreEditorAppDocument
} from '../dist/packages/score-editor-app-document/src/index.js';
import { createMeasureFrameAuthoringStandaloneScoreEditorController } from '../dist/packages/score-editor-browser-app/src/measure-frame-authoring.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const contentStaves = documentValue => documentValue.session.history.present.score.parts.flatMap(part => part.staves.filter(staff => staff.role !== 'tablature-linked'));
const standardStaves = documentValue => documentValue.session.history.present.score.parts[0].staves.filter(staff => staff.role === 'standard');
const directIntent = (score, prefix) => ({
  version: '1.0.0',
  type: 'APPEND_SYNTHETIC_MEASURE_FRAME',
  target: addressEntityV3(score, score.id),
  frameId: `frame:${score.measureFrames.length + 1}`,
  displayNumber: String(score.measureFrames.length + 1),
  staffRestIds: score.parts.flatMap(part => part.staves.filter(staff => staff.role !== 'tablature-linked').map(staff => ({
    staffId: staff.id,
    measureId: `measure:${prefix}:${staff.ordinal}`,
    voiceId: `voice:${prefix}:${staff.ordinal}`,
    restEventId: `event:${prefix}:${staff.ordinal}`
  })))
});

test('APP-10H Guitar append creates one aligned frame with Voice 1 full-measure rest and exact undo/redo', () => {
  const controller = createMeasureFrameAuthoringStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(documentValue.session.history.present.score.measureFrames.length, 1);
  assert.equal(controller.getMeasureFrameAuthoringState().canAppendMeasure, true);

  controller.appendMeasure();
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  const score = documentValue.session.history.present.score;
  assert.equal(score.measureFrames.length, 2);
  assert.equal(score.measureFrames[1].id, 'frame:2');
  assert.equal(contentStaves(documentValue).length, 1);
  const staff = contentStaves(documentValue)[0];
  assert.equal(staff.measures.length, 2);
  assert.equal(staff.measures[1].frameId, score.measureFrames[1].id);
  assert.equal(staff.measures[1].voices.length, 1);
  assert.equal(staff.measures[1].voices[0].ordinal, 1);
  assert.equal(staff.measures[1].voices[0].events.length, 1);
  assert.equal(staff.measures[1].voices[0].events[0].kind, 'rest');
  assert.deepEqual(staff.measures[1].voices[0].events[0].onset, { numerator: 0, denominator: 1 });
  assert.deepEqual(staff.measures[1].voices[0].events[0].duration, { numerator: 1, denominator: 1 });
  assert.equal(documentValue.session.selection?.kind, 'event');
  assert.equal(documentValue.session.selection?.frameId, score.measureFrames[1].id);
  assert.equal(documentValue.session.history.past.length, 1);

  controller.undo();
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(documentValue.session.history.present.score.measureFrames.length, 1);
  controller.redo();
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(documentValue.session.history.present.score.measureFrames.length, 2);
});

test('APP-10H Piano append adds one measure on both standard staves in the same new global frame', () => {
  const controller = createMeasureFrameAuthoringStandaloneScoreEditorController();
  controller.newDocument({ preset: 'PIANO_GRAND_STAFF' });
  controller.appendMeasure();
  const documentValue = controller.getDocument();
  assert.ok(documentValue);
  const score = documentValue.session.history.present.score;
  const staves = standardStaves(documentValue);
  assert.equal(score.measureFrames.length, 2);
  assert.equal(score.measureFrames[1].id, 'frame:2');
  assert.equal(staves.length, 2);
  assert.equal(staves[0].measures.length, 2);
  assert.equal(staves[1].measures.length, 2);
  assert.equal(staves[0].measures[1].frameId, score.measureFrames[1].id);
  assert.equal(staves[1].measures[1].frameId, score.measureFrames[1].id);
  assert.equal(staves[0].measures[1].voices[0].events[0].kind, 'rest');
  assert.equal(staves[1].measures[1].voices[0].events[0].kind, 'rest');
  assert.equal(documentValue.session.history.past.length, 1);
});

test('APP-10H imported MusicXML automatic measure growth fails closed', async () => {
  const synthetic = createNewScoreEditorAppDocument({ preset: 'GUITAR_TREBLE' });
  const xml = exportMusicXmlScoreEditorAppDocument(synthetic);
  const imported = await openMusicXmlScoreEditorAppDocument(xml, { sha256Hex: async () => '1'.repeat(64) });
  const score = imported.session.history.present.score;
  assert.equal(imported.origin, 'MUSICXML');
  assert.equal(score.source.format, 'musicxml');
  assert.throws(
    () => executeTopologyAuthoringV4(score, imported.session.history.present.notation, directIntent(score, 'imported'), { nextRevisionId: 'rev:imported-append' }),
    error => error?.code === 'ORIGIN_NOT_ADMITTED'
  );
});

test('APP-10H missing effective meter, non-lossless frame identity, and stale document target fail closed', () => {
  const documentValue = createNewScoreEditorAppDocument({ preset: 'GUITAR_TREBLE' });
  const score = documentValue.session.history.present.score;
  const notation = documentValue.session.history.present.notation;
  const withoutMeter = createNotationDocumentV4(score, {
    contractVersion: '4.0.0',
    documentId: score.id,
    revisionId: score.revision.id,
    frames: [],
    measures: notation.measures,
    events: notation.events,
    notes: notation.notes,
    graceEvents: notation.graceEvents,
    graceNotes: notation.graceNotes,
    crossStaffPlacements: notation.crossStaffPlacements
  });
  assert.throws(
    () => executeTopologyAuthoringV4(score, withoutMeter, directIntent(score, 'nometer'), { nextRevisionId: 'rev:no-meter' }),
    error => error?.code === 'METER_EVIDENCE_MISSING'
  );

  const invalidIdentity = { ...directIntent(score, 'bad-frame'), frameId: 'frame:custom' };
  assert.throws(
    () => executeTopologyAuthoringV4(score, notation, invalidIdentity, { nextRevisionId: 'rev:bad-frame' }),
    error => error?.code === 'IDENTITY_PLAN_INVALID'
  );

  const first = executeTopologyAuthoringV4(score, notation, directIntent(score, 'first'), { nextRevisionId: 'rev:first' });
  const stale = directIntent(score, 'stale');
  assert.throws(
    () => executeTopologyAuthoringV4(first.score, first.notation, stale, { nextRevisionId: 'rev:stale' }),
    error => error?.code === 'STALE_TARGET'
  );
});

test('APP-10H Piano two-measure export and re-import preserve frame count and staff alignment', async () => {
  const controller = createMeasureFrameAuthoringStandaloneScoreEditorController();
  controller.newDocument({ preset: 'PIANO_GRAND_STAFF' });
  controller.appendMeasure();
  const documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(documentValue.session.renderRequest.projectionStatus, 'V3_COMPATIBLE_XML');
  const xml = exportMusicXmlScoreEditorAppDocument(documentValue);
  const reopened = await openMusicXmlScoreEditorAppDocument(xml, { sha256Hex: async () => '2'.repeat(64) });
  const score = reopened.session.history.present.score;
  const staves = reopened.session.history.present.score.parts[0].staves.filter(staff => staff.role === 'standard');
  assert.equal(score.measureFrames.length, 2);
  assert.equal(staves.length, 2);
  assert.equal(staves[0].measures.length, 2);
  assert.equal(staves[1].measures.length, 2);
  assert.equal(staves[0].measures[1].frameId, score.measureFrames[1].id);
  assert.equal(staves[1].measures[1].frameId, score.measureFrames[1].id);
});
