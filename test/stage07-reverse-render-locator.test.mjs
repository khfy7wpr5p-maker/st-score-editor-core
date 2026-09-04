import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { rendererProfileForIntegration } from '../dist/packages/renderer-contract/src/index.js';
import { createRendererHitEnabledStandaloneScoreEditorController } from '../dist/packages/score-editor-browser-app/src/renderer-hit-enabled.js';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true
  });
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
      <note><rest/><duration>12</duration><voice>1</voice><type>half</type><dot/></note>
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

test('Stage 07 exact reverse bridge maps current SemanticAddress to renderer note and measure locators without mutation', async () => {
  const value = controller();
  const opened = await value.openMusicXml(xml, { title: 'Stage 07 reverse locator' });
  assert.equal(opened.error, null);
  value.attachOsmdRenderer(host());
  await value.renderCurrent();

  const document = value.getDocument();
  assert.ok(document);
  const score = document.session.history.present.score;
  const noteAddress = document.session.renderRequest.manifest.entries.find(entry => entry.address.kind === 'note')?.address;
  assert.ok(noteAddress && noteAddress.kind === 'note');
  const beforeRevision = score.revision.id;
  const beforePast = document.session.history.past.length;

  const noteRef = value.resolveRenderedScoreNoteRef(noteAddress);
  assert.deepEqual(noteRef, { partId: 'P1', measureIndex: 0, noteIndex: 0, voice: 1 });
  const measureRef = value.resolveRenderedScoreMeasureRef(noteAddress);
  assert.deepEqual(measureRef, { partId: 'P1', measureIndex: 0 });

  const afterResolve = value.getDocument();
  assert.ok(afterResolve);
  assert.equal(afterResolve.session.history.present.score.revision.id, beforeRevision);
  assert.equal(afterResolve.session.history.past.length, beforePast);
  assert.equal(afterResolve.session.selection, null);

  const selected = value.selectRenderedScoreNoteRef(noteRef);
  assert.equal(selected.error, null);
  const afterSelect = value.getDocument();
  assert.ok(afterSelect?.session.selection?.kind === 'note');
  assert.equal(afterSelect.session.selection.noteId, noteAddress.noteId);
  assert.equal(afterSelect.session.history.present.score.revision.id, beforeRevision);
  assert.equal(afterSelect.session.history.past.length, beforePast);
  value.unmount();
});

test('Stage 07 reverse bridge refuses non-note highlight while still resolving its exact measure cursor', async () => {
  const value = controller();
  const opened = await value.openMusicXml(xml, { title: 'Stage 07 measure locator' });
  assert.equal(opened.error, null);
  value.attachOsmdRenderer(host());
  await value.renderCurrent();
  const document = value.getDocument();
  assert.ok(document);
  const eventAddress = document.session.renderRequest.manifest.entries.find(entry => entry.address.kind === 'event')?.address;
  assert.ok(eventAddress && eventAddress.kind === 'event');
  assert.equal(value.resolveRenderedScoreNoteRef(eventAddress), null);
  assert.deepEqual(value.resolveRenderedScoreMeasureRef(eventAddress), { partId: 'P1', measureIndex: 0 });
  value.unmount();
});