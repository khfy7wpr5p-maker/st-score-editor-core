import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { rendererProfileForIntegration } from '../dist/packages/renderer-contract/src/index.js';
import {
  createRendererHitEnabledStandaloneScoreEditorController,
  RendererSemanticHitBridgeControllerError
} from '../dist/packages/score-editor-browser-app/src/renderer-hit-enabled.js';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>16</duration><voice>1</voice><type>whole</type></note>
    </measure>
  </part>
</score-partwise>`;

const memoryStore = () => {
  const values = new Map();
  return Object.freeze({
    put: async record => { values.set(record.documentId, structuredClone(record)); },
    list: async () => [...values.values()].map(value => structuredClone(value)),
    delete: async documentId => { values.delete(documentId); },
    clear: async () => { values.clear(); }
  });
};

const integrationProfile = rendererProfileForIntegration('st-score-rendering-layer');
const host = () => ({
  packageName: 'opensheetmusicdisplay',
  packageVersion: '2.1.2',
  license: 'BSD-3-Clause',
  instance: { async load() {}, render() {}, clear() {} }
});

const controller = () => createRendererHitEnabledStandaloneScoreEditorController({
  rendererProfile: integrationProfile,
  store: memoryStore(),
  autosaveDelayMs: 60_000,
  sha256Hex: async () => 'a'.repeat(64)
});

test('SES-106 correction highlights are presentation-only and do not create history', async () => {
  const value = controller();
  const opened = await value.openMusicXml(xml, { title: 'Correction highlight state' });
  assert.equal(opened.error, null);
  value.attachOsmdRenderer(host());
  await value.renderCurrent();

  const document = value.getDocument();
  assert.ok(document);
  const score = document.session.history.present.score;
  const beforePast = document.session.history.past.length;
  const beforeFuture = document.session.history.future.length;

  const state = value.setSuspiciousMeasureFindings({
    current: {
      documentId: score.id,
      revisionId: score.revision.id,
      renderEpoch: 'epoch-1',
      sourceId: 'source-1'
    },
    findings: [{
      findingId: 'duration-1',
      documentId: score.id,
      revisionId: score.revision.id,
      renderEpoch: 'epoch-1',
      sourceId: 'source-1',
      measureTargets: [{ partId: 'P1', measureIndex: 0 }]
    }]
  });

  assert.deepEqual(state.targets, [{ partId: 'P1', measureIndex: 0 }]);
  const after = value.getDocument();
  assert.ok(after);
  assert.equal(after.session.history.present.score.revision.id, score.revision.id);
  assert.equal(after.session.history.past.length, beforePast);
  assert.equal(after.session.history.future.length, beforeFuture);
  value.unmount();
});

test('SES-106 canonical revision change clears transient suspicious measure state', async () => {
  const value = controller();
  await value.openMusicXml(xml, { title: 'Correction highlight stale clear' });
  value.attachOsmdRenderer(host());
  await value.renderCurrent();

  const document = value.getDocument();
  assert.ok(document);
  const score = document.session.history.present.score;
  value.setSuspiciousMeasureFindings({
    current: { documentId: score.id, revisionId: score.revision.id, renderEpoch: 'epoch-1' },
    findings: [{
      findingId: 'f1',
      documentId: score.id,
      revisionId: score.revision.id,
      renderEpoch: 'epoch-1',
      measureTargets: [{ partId: 'P1', measureIndex: 0 }]
    }]
  });
  assert.notEqual(value.getSuspiciousMeasureHighlightState(), null);

  const part = score.parts[0];
  assert.ok(part);
  const changed = value.commitTopology({
    version: '1.0.0',
    type: 'RENAME_PART_OR_INSTRUMENT',
    target: addressEntityV3(score, part.id),
    partName: 'Changed Guitar',
    instrumentName: 'Changed Guitar',
    instrumentShortName: 'Gtr.'
  }, { nextRevisionId: 'ses-106-rev-2' });
  assert.equal(changed.error, null);
  assert.equal(value.getSuspiciousMeasureHighlightState(), null);
  value.unmount();
});

test('SES-106 rejects evidence that does not match the accepted current presentation', async () => {
  const value = controller();
  await value.openMusicXml(xml, { title: 'Correction highlight mismatch' });
  const document = value.getDocument();
  assert.ok(document);
  const score = document.session.history.present.score;

  assert.throws(
    () => value.setSuspiciousMeasureFindings({
      current: { documentId: score.id, revisionId: score.revision.id, renderEpoch: 'epoch-1' },
      findings: []
    }),
    error => error instanceof RendererSemanticHitBridgeControllerError && error.code === 'NO_CURRENT_RENDER_PRESENTATION'
  );

  value.attachOsmdRenderer(host());
  await value.renderCurrent();
  assert.throws(
    () => value.setSuspiciousMeasureFindings({
      current: { documentId: score.id, revisionId: 'stale-revision', renderEpoch: 'epoch-1' },
      findings: []
    }),
    error => error instanceof RendererSemanticHitBridgeControllerError && error.code === 'SUSPICIOUS_MEASURE_PRESENTATION_MISMATCH'
  );
  value.unmount();
});
