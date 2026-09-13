import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { rendererProfileForIntegration } from '../dist/packages/renderer-contract/src/index.js';
import { createRendererHitEnabledStandaloneScoreEditorController } from '../dist/packages/score-editor-browser-app/src/renderer-hit-enabled.js';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
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

const stateInvariant = value => {
  const document = value.getDocument();
  assert.ok(document);
  return {
    revisionId: document.session.history.present.score.revision.id,
    past: document.session.history.past.length,
    future: document.session.history.future.length
  };
};

const assertInvariant = (value, before) => {
  const after = stateInvariant(value);
  assert.deepEqual(after, before);
};

test('generic rendered NOTE target resolves exactly through current V4 request without mutation', async () => {
  const value = controller();
  const opened = await value.openMusicXml(xml, { title: 'Generic rendered NOTE target' });
  assert.equal(opened.error, null);
  value.attachOsmdRenderer(host());
  await value.renderCurrent();
  const before = stateInvariant(value);

  const selected = value.selectRenderedScoreEventRef({
    kind: 'NOTE', partId: 'P1', measureIndex: 0, eventIndex: 0, voice: 1
  });
  assert.equal(selected.error, null);
  const document = value.getDocument();
  assert.ok(document?.session.selection?.kind === 'note');
  assertInvariant(value, before);
  value.unmount();
});

test('generic rendered REST target resolves to the exact canonical rest event without unique-rest guessing', async () => {
  const value = controller();
  const opened = await value.openMusicXml(xml, { title: 'Generic rendered REST target' });
  assert.equal(opened.error, null);
  value.attachOsmdRenderer(host());
  await value.renderCurrent();
  const before = stateInvariant(value);

  const selected = value.selectRenderedScoreEventRef({
    kind: 'REST', partId: 'P1', measureIndex: 0, eventIndex: 1, voice: 1
  });
  assert.equal(selected.error, null);
  const document = value.getDocument();
  assert.ok(document?.session.selection?.kind === 'event');
  const score = document.session.history.present.score;
  const selectedEventId = document.session.selection.eventId;
  const event = score.parts
    .flatMap(part => part.staves)
    .filter(staff => staff.role !== 'tablature-linked')
    .flatMap(staff => staff.measures)
    .flatMap(measure => measure.voices)
    .flatMap(voice => voice.events)
    .find(candidate => candidate.id === selectedEventId);
  assert.equal(event?.kind, 'rest');
  assertInvariant(value, before);
  value.unmount();
});

test('generic rendered event resolver fails closed on kind mismatch and out-of-range locator', async () => {
  const value = controller();
  const opened = await value.openMusicXml(xml, { title: 'Generic rendered target fail closed' });
  assert.equal(opened.error, null);
  value.attachOsmdRenderer(host());
  await value.renderCurrent();
  const before = stateInvariant(value);

  assert.throws(
    () => value.selectRenderedScoreEventRef({ kind: 'NOTE', partId: 'P1', measureIndex: 0, eventIndex: 1, voice: 1 }),
    error => error?.code === 'RENDERED_EVENT_UNMAPPED'
  );
  assert.throws(
    () => value.selectRenderedScoreEventRef({ kind: 'REST', partId: 'P1', measureIndex: 0, eventIndex: 99, voice: 1 }),
    error => error?.code === 'RENDERED_EVENT_UNMAPPED'
  );
  assertInvariant(value, before);
  value.unmount();
});
