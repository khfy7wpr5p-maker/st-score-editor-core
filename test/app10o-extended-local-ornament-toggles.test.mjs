import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createExtendedLocalOrnamentTogglesStandaloneScoreEditorController } from '../dist/packages/score-editor-browser-app/src/extended-local-ornament-toggles.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const firstStandardEvent = d => d.session.history.present.score.parts[0].staves.find(s => s.role === 'standard').measures[0].voices[0].events[0];
const ornaments = (d, eventId) => d.session.history.present.notation.events.find(e => e.target.eventId === eventId)?.notation.ornaments ?? [];
const enterC = c => { c.setEntryPitch('C', 0, 4); c.setEntryDuration({ numerator: 1, denominator: 4 }); c.enterNoteAtSelection(); };

test('APP-10O toggles inverted turn/inverted mordent/shake in unified history', () => {
  const c = createExtendedLocalOrnamentTogglesStandaloneScoreEditorController();
  c.newDocument({ preset: 'GUITAR_TREBLE' });
  assert.equal(c.getExtendedLocalOrnamentTogglesState().canToggleExtendedLocalOrnament, false);
  assert.throws(() => c.toggleSelectedExtendedLocalOrnament('inverted-turn'), e => e?.code === 'PITCHED_EVENT_SELECTION_REQUIRED');
  enterC(c);
  let d = c.getDocument(); const event = firstStandardEvent(d);
  c.toggleSelectedExtendedLocalOrnament('inverted-turn');
  c.toggleSelectedExtendedLocalOrnament('inverted-mordent');
  c.toggleSelectedExtendedLocalOrnament('shake');
  d = c.getDocument();
  assert.deepEqual(ornaments(d, event.id), [
    { kind: 'inverted-turn', placement: 'auto', accidentalMarks: [] },
    { kind: 'inverted-mordent', placement: 'auto', accidentalMarks: [] },
    { kind: 'shake', placement: 'auto', accidentalMarks: [] }
  ]);
  assert.deepEqual(c.getExtendedLocalOrnamentTogglesState().activeKinds, ['inverted-turn','inverted-mordent','shake']);
  assert.equal(d.session.history.past.length, 4);
  c.toggleSelectedExtendedLocalOrnament('inverted-mordent');
  assert.deepEqual(ornaments(c.getDocument(), event.id).map(x => x.kind), ['inverted-turn','shake']);
});

test('APP-10O extended local ornament survives undo/redo', () => {
  const c = createExtendedLocalOrnamentTogglesStandaloneScoreEditorController(); c.newDocument({ preset:'GUITAR_TREBLE' }); enterC(c);
  const eventId = firstStandardEvent(c.getDocument()).id;
  c.toggleSelectedExtendedLocalOrnament('shake'); assert.equal(ornaments(c.getDocument(), eventId)[0]?.kind, 'shake');
  c.undo(); assert.deepEqual(ornaments(c.getDocument(), eventId), []);
  c.redo(); assert.equal(ornaments(c.getDocument(), eventId)[0]?.kind, 'shake');
});

test('APP-10O imported MusicXML inverted turn survives lossless export/re-import', async () => {
  const source = createExtendedLocalOrnamentTogglesStandaloneScoreEditorController(); source.newDocument({ preset:'GUITAR_TREBLE' }); enterC(source);
  const c = createExtendedLocalOrnamentTogglesStandaloneScoreEditorController();
  await c.openMusicXml(source.exportMusicXml(), { sha256Hex: async () => '1'.repeat(64) });
  let d = c.getDocument(); const event = firstStandardEvent(d); c.select(addressEntityV3(d.session.history.present.score, event.note.id));
  c.toggleSelectedExtendedLocalOrnament('inverted-turn'); d = c.getDocument();
  assert.deepEqual(ornaments(d, event.id), [{ kind:'inverted-turn', placement:'auto', accidentalMarks:[] }]);
  const xml = c.exportMusicXml(); assert.match(xml, /<inverted-turn\/>/);
  const reopened = createExtendedLocalOrnamentTogglesStandaloneScoreEditorController();
  await reopened.openMusicXml(xml, { sha256Hex: async () => '2'.repeat(64) });
  const rd = reopened.getDocument(); const re = firstStandardEvent(rd);
  assert.deepEqual(ornaments(rd, re.id), [{ kind:'inverted-turn', placement:'auto', accidentalMarks:[] }]);
});

test('APP-10O exact imported-style ornament removal preserves placement/accidental semantics by removing exact spec', () => {
  const c = createExtendedLocalOrnamentTogglesStandaloneScoreEditorController(); c.newDocument({ preset:'GUITAR_TREBLE' }); enterC(c);
  let d = c.getDocument(); const event = firstStandardEvent(d); const target = addressEntityV3(d.session.history.present.score, event.id);
  c.commitOrnament({ version:'1.0.0', type:'ADD_LOCAL_ORNAMENT', target, value:{ kind:'inverted-turn', placement:'above', accidentalMarks:[{ accidental:'sharp', placement:'above' }] } }, { nextRevisionId:`rev:${crypto.randomUUID()}` });
  assert.deepEqual(c.getExtendedLocalOrnamentTogglesState().activeKinds, ['inverted-turn']);
  c.toggleSelectedExtendedLocalOrnament('inverted-turn');
  assert.deepEqual(ornaments(c.getDocument(), event.id), []);
});

test('APP-10O ambiguity/unsupported/non-pitched fail closed and no extra authority is exposed', () => {
  const c = createExtendedLocalOrnamentTogglesStandaloneScoreEditorController(); c.newDocument({ preset:'GUITAR_TREBLE' }); enterC(c);
  let d = c.getDocument(); const event = firstStandardEvent(d); let target = addressEntityV3(d.session.history.present.score, event.id);
  c.commitOrnament({ version:'1.0.0', type:'ADD_LOCAL_ORNAMENT', target, value:{ kind:'shake', placement:'above', accidentalMarks:[] } }, { nextRevisionId:`rev:${crypto.randomUUID()}` });
  d = c.getDocument(); target = addressEntityV3(d.session.history.present.score, event.id);
  c.commitOrnament({ version:'1.0.0', type:'ADD_LOCAL_ORNAMENT', target, value:{ kind:'shake', placement:'below', accidentalMarks:[] } }, { nextRevisionId:`rev:${crypto.randomUUID()}` });
  assert.deepEqual(c.getExtendedLocalOrnamentTogglesState().ambiguousKinds, ['shake']);
  assert.throws(() => c.toggleSelectedExtendedLocalOrnament('shake'), e => e?.code === 'EXTENDED_LOCAL_ORNAMENT_KIND_AMBIGUOUS');
  assert.throws(() => c.toggleSelectedExtendedLocalOrnament('delayed-turn'), e => e?.code === 'UNSUPPORTED_EXTENDED_LOCAL_ORNAMENT_KIND');
  d = c.getDocument(); c.select(addressEntityV3(d.session.history.present.score, d.session.history.present.score.id));
  assert.equal(c.getExtendedLocalOrnamentTogglesState().canToggleExtendedLocalOrnament, false);
  assert.equal(c.profile.extendedLocalOrnamentSpanningRelationAuthority, false);
  assert.equal(c.profile.extendedLocalOrnamentGraceTargetAuthority, false);
  assert.equal(c.profile.extendedLocalOrnamentRendererCoordinateAuthority, false);
});
