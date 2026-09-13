import test from 'node:test';
import assert from 'node:assert/strict';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createAudioHostIntegratedStandaloneScoreEditorController } from '../dist/packages/score-editor-browser-app/src/audio-host-integrated.js';

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1"><measure number="1">
    <attributes><divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
    <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
    <note><rest/><duration>12</duration><voice>1</voice><type>half</type><dot/></note>
  </measure></part>
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

const host = () => ({
  packageName: 'opensheetmusicdisplay', packageVersion: '2.1.1', license: 'BSD-3-Clause',
  instance: { async load() {}, render() {}, clear() {} }
});

const firstNoteAddress = controller => {
  const document = controller.getDocument(); assert.ok(document);
  const score = document.session.history.present.score;
  const staff = score.parts[0]?.staves[0]; assert.ok(staff && staff.role !== 'tablature-linked');
  const event = staff.measures[0]?.voices[0]?.events.find(item => item.kind === 'note'); assert.ok(event && event.kind === 'note');
  return addressEntityV3(score, event.note.id);
};

const readyController = async () => {
  const controller = createAudioHostIntegratedStandaloneScoreEditorController({
    store: memoryStore(), autosaveDelayMs: 60_000, sha256Hex: async () => 'a'.repeat(64)
  });
  const opened = await controller.openMusicXml(xml, { title: 'Audio UI' });
  assert.equal(opened.error, null);
  controller.attachOsmdRenderer(host());
  await controller.renderCurrent();
  return controller;
};

test('audio host integration selects rendered note, plays canonical pitch, and never mutates history', async () => {
  const controller = await readyController();
  const address = firstNoteAddress(controller);
  const renderedRef = controller.resolveRenderedScoreNoteRef(address); assert.ok(renderedRef);
  const before = controller.getDocument(); assert.ok(before);
  const beforeRevision = before.session.history.present.score.revision.id;
  const beforePast = before.session.history.past.length;
  const requests = [];
  controller.attachAudioPort(Object.freeze({
    unlockFromUserGesture: async () => ({ ok: true }),
    setInstrument: async instrumentId => { assert.equal(instrumentId, 'GRAND_PIANO'); },
    audition: async request => { requests.push(structuredClone(request)); return { ok: true, requestId: request.requestId }; }
  }));

  const result = await controller.selectRenderedScoreNoteRefWithAudition(renderedRef);
  assert.equal(result.audioStatus, 'PLAYED');
  assert.equal(result.audioError, null);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].instrumentId, 'GRAND_PIANO');
  assert.equal(requests[0].pitch.midi, 60);
  const after = controller.getDocument(); assert.ok(after);
  assert.equal(after.session.selection?.kind, 'note');
  assert.equal(after.session.history.present.score.revision.id, beforeRevision);
  assert.equal(after.session.history.past.length, beforePast);
  controller.unmount();
});

test('instrument switch changes audition request only and audio failure does not invalidate selection', async () => {
  const controller = await readyController();
  const address = firstNoteAddress(controller);
  const renderedRef = controller.resolveRenderedScoreNoteRef(address); assert.ok(renderedRef);
  controller.setAuditionInstrument('CLASSICAL_GUITAR');
  const beforeRevision = controller.getDocument().session.history.present.score.revision.id;
  let seenInstrument = null;
  controller.attachAudioPort(Object.freeze({
    unlockFromUserGesture: async () => ({ ok: true }),
    setInstrument: async instrumentId => { seenInstrument = instrumentId; },
    audition: async () => ({ ok: false, error: { code: 'SAMPLE_UNAVAILABLE', message: 'fixture failure' } })
  }));
  const result = await controller.selectRenderedScoreNoteRefWithAudition(renderedRef);
  assert.equal(seenInstrument, 'CLASSICAL_GUITAR');
  assert.equal(result.request?.instrumentId, 'CLASSICAL_GUITAR');
  assert.equal(result.audioStatus, 'FAILED');
  assert.equal(result.audioError?.code, 'SAMPLE_UNAVAILABLE');
  assert.equal(controller.getDocument().session.selection?.kind, 'note');
  assert.equal(controller.getDocument().session.history.present.score.revision.id, beforeRevision);
  controller.unmount();
});
