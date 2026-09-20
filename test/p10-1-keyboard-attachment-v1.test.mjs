import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import {
  createAudioHostIntegratedStandaloneScoreEditorController
} from '../dist/packages/score-editor-browser-app/src/audio-host-integrated.js';
import {
  attachKeyboardWorkstationToBrowserControllerV1
} from '../dist/packages/score-editor-browser-app/src/keyboard-workstation.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

test('P10-1 keyboard attachment decorates an existing audio-host controller without creating another document lineage', () => {
  const base = createAudioHostIntegratedStandaloneScoreEditorController();
  const combined = attachKeyboardWorkstationToBrowserControllerV1(base);

  combined.newDocument({ preset: 'GUITAR_TREBLE' });
  const first = combined.getDocument();
  assert.ok(first);
  assert.equal(base.getDocument(), first);

  const staff = first.session.history.present.score.parts[0]?.staves.find(candidate => candidate.role === 'standard');
  assert.ok(staff);
  const event = staff.measures[0]?.voices[0]?.events[0];
  assert.ok(event);
  combined.select(addressEntityV3(first.session.history.present.score, event.id));

  combined.dispatchKeyboardIntent({
    version: '1.0.0',
    type: 'SET_ENTRY_PITCH',
    pitch: { step: 'C', alter: 0, octave: 4 }
  });
  combined.dispatchKeyboardIntent({
    version: '1.0.0',
    type: 'SET_ENTRY_DURATION',
    duration: { numerator: 1, denominator: 4 }
  });
  combined.dispatchKeyboardIntent({ version: '1.0.0', type: 'ENTER_NOTE' });

  assert.equal(base.getDocument(), combined.getDocument());
  assert.equal(
    base.getDocument().session.history.present.score.revision.id,
    combined.getDocument().session.history.present.score.revision.id
  );
  assert.equal(base.getDocument().session.history.past.length, 1);
});
