import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createMeasureNavigationStandaloneScoreEditorController } from '../dist/packages/score-editor-browser-app/src/measure-navigation.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const standardStaves = documentValue => documentValue.session.history.present.score.parts[0].staves.filter(staff => staff.role === 'standard');

test('APP-10I Guitar previous/next navigation changes semantic frame selection without creating history', () => {
  const controller = createMeasureNavigationStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  controller.appendMeasure();
  controller.appendMeasure();

  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(documentValue.session.history.present.score.measureFrames.length, 3);
  assert.equal(documentValue.session.history.past.length, 2);
  assert.equal(documentValue.session.selection?.frameId, 'frame:3');
  assert.deepEqual(controller.getMeasureNavigationState(), {
    version: '1.0.0',
    activeFrameId: 'frame:3',
    activeFrameOrdinal: 3,
    activeFrameDisplayNumber: '3',
    measureFrameCount: 3,
    canPrevious: true,
    canNext: false,
    status: 'READY'
  });

  controller.navigateMeasure('PREVIOUS');
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(documentValue.session.selection?.kind, 'event');
  assert.equal(documentValue.session.selection?.frameId, 'frame:2');
  assert.equal(documentValue.session.history.past.length, 2);
  assert.equal(controller.getAuthoringState().activeVoiceOrdinal, 1);

  controller.navigateMeasure('PREVIOUS');
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(documentValue.session.selection?.frameId, 'frame:1');
  assert.equal(documentValue.session.history.past.length, 2);
  assert.equal(controller.getMeasureNavigationState().canPrevious, false);
  assert.equal(controller.getMeasureNavigationState().canNext, true);
  assert.throws(() => controller.navigateMeasure('PREVIOUS'), error => error?.code === 'TARGET_FRAME_NOT_AVAILABLE');

  controller.navigateMeasure('NEXT');
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(documentValue.session.selection?.frameId, 'frame:2');
  assert.equal(documentValue.session.history.past.length, 2);
});

test('APP-10I Piano navigation preserves exact Staff context across global frames without materializing Voices', () => {
  const controller = createMeasureNavigationStandaloneScoreEditorController();
  controller.newDocument({ preset: 'PIANO_GRAND_STAFF' });
  controller.appendMeasure();
  controller.appendMeasure();

  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  let staves = standardStaves(documentValue);
  const lowerId = staves[1].id;
  controller.setActiveStaff(lowerId);
  const beforeHistory = controller.getDocument().session.history.past.length;

  controller.navigateMeasure('PREVIOUS');
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  staves = standardStaves(documentValue);
  assert.equal(documentValue.session.selection?.staffId, staves[1].id);
  assert.equal(documentValue.session.selection?.frameId, 'frame:2');
  assert.equal(controller.getActiveStaffState().activeStaffOrdinal, 2);
  assert.equal(controller.getAuthoringState().activeVoiceOrdinal, 1);
  assert.equal(documentValue.session.history.past.length, beforeHistory);
  assert.equal(staves[1].measures[1].voices.length, 1);

  controller.navigateMeasure('NEXT');
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(documentValue.session.selection?.staffId, lowerId);
  assert.equal(documentValue.session.selection?.frameId, 'frame:3');
  assert.equal(documentValue.session.history.past.length, beforeHistory);
});

test('APP-10I imported MusicXML supports semantic measure navigation after an exact selection', async () => {
  const source = createMeasureNavigationStandaloneScoreEditorController();
  source.newDocument({ preset: 'GUITAR_TREBLE' });
  source.appendMeasure();
  const xml = source.exportMusicXml();

  const controller = createMeasureNavigationStandaloneScoreEditorController();
  await controller.openMusicXml(xml, { sha256Hex: async () => '7'.repeat(64) });
  let documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(documentValue.origin, 'MUSICXML');
  const score = documentValue.session.history.present.score;
  const event = score.parts[0].staves[0].measures[0].voices[0].events[0];
  controller.select(addressEntityV3(score, event.id));
  assert.equal(controller.getMeasureNavigationState().canNext, true);
  const beforeHistory = controller.getDocument().session.history.past.length;

  controller.navigateMeasure('NEXT');
  documentValue = controller.getDocument();
  assert.ok(documentValue);
  assert.equal(documentValue.origin, 'MUSICXML');
  assert.equal(documentValue.session.selection?.frameId, documentValue.session.history.present.score.measureFrames[1].id);
  assert.equal(documentValue.session.history.past.length, beforeHistory);
  assert.equal(controller.profile.importedMusicXmlMeasureNavigation, true);
});

test('APP-10I missing frame context fails closed and does not infer a target from presentation geometry', () => {
  const controller = createMeasureNavigationStandaloneScoreEditorController();
  controller.newDocument({ preset: 'GUITAR_TREBLE' });
  controller.appendMeasure();
  const documentValue = controller.getDocument();
  assert.ok(documentValue);
  const score = documentValue.session.history.present.score;
  controller.select(addressEntityV3(score, score.id));
  const state = controller.getMeasureNavigationState();
  assert.equal(state.status, 'FRAME_CONTEXT_REQUIRED');
  assert.equal(state.canPrevious, false);
  assert.equal(state.canNext, false);
  assert.throws(() => controller.navigateMeasure('NEXT'), error => error?.code === 'FRAME_CONTEXT_REQUIRED');
  assert.equal(controller.profile.measureNavigationRendererCoordinateAuthority, false);
  assert.equal(controller.profile.measureNavigationHistoryMutationAuthority, false);
});
