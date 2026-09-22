import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PitchTheoryV1Error,
  accidentalDisplayForPitchV1,
  signatureAlterForStepV1,
  transposeDiatonicPitchV1,
  transposeSemitonePitchV1
} from '../dist/packages/editor-professional-pitch-transpose-v1/src/pitch-theory.js';

test('P10-3A resolves canonical circle-of-fifths signature alterations', () => {
  assert.equal(signatureAlterForStepV1('F', 1), 1);
  assert.equal(signatureAlterForStepV1('C', 2), 1);
  assert.equal(signatureAlterForStepV1('G', 2), 0);
  assert.equal(signatureAlterForStepV1('B', -1), -1);
  assert.equal(signatureAlterForStepV1('E', -2), -1);
  assert.equal(signatureAlterForStepV1('A', -2), 0);
  assert.equal(signatureAlterForStepV1('C', 0), 0);
});

test('P10-3A rejects invalid key signature bounds', () => {
  assert.throws(
    () => signatureAlterForStepV1('C', 8),
    error => error instanceof PitchTheoryV1Error && error.code === 'KEY_CONTEXT_INVALID'
  );
});

test('P10-3A diatonic transpose preserves key-relative chromatic deviation', () => {
  assert.deepEqual(
    transposeDiatonicPitchV1({ step:'F', alter:1, octave:4 }, 1, 1),
    { step:'G', alter:0, octave:4 }
  );
  assert.deepEqual(
    transposeDiatonicPitchV1({ step:'F', alter:0, octave:4 }, 1, 1),
    { step:'G', alter:-1, octave:4 }
  );
  assert.deepEqual(
    transposeDiatonicPitchV1({ step:'B', alter:0, octave:4 }, 0, 1),
    { step:'C', alter:0, octave:5 }
  );
  assert.deepEqual(
    transposeDiatonicPitchV1({ step:'C', alter:0, octave:0 }, 0, -1),
    { step:'B', alter:0, octave:-1 }
  );
});

test('P10-3A enforces diatonic interval and spelling bounds', () => {
  assert.throws(
    () => transposeDiatonicPitchV1({ step:'C', alter:0, octave:4 }, 0, 0),
    error => error instanceof PitchTheoryV1Error && error.code === 'INVALID_DIATONIC_STEPS'
  );
  assert.throws(
    () => transposeDiatonicPitchV1({ step:'F', alter:2, octave:4 }, 7, 1),
    error => error instanceof PitchTheoryV1Error && error.code === 'SPELLING_UNREPRESENTABLE'
  );
});

test('P10-3A semitone transpose uses deterministic key-aware spelling', () => {
  assert.deepEqual(
    transposeSemitonePitchV1({ step:'C', alter:0, octave:4 }, 0, 1),
    { step:'C', alter:1, octave:4 }
  );
  assert.deepEqual(
    transposeSemitonePitchV1({ step:'D', alter:0, octave:4 }, 0, -1),
    { step:'D', alter:-1, octave:4 }
  );
  assert.deepEqual(
    transposeSemitonePitchV1({ step:'E', alter:0, octave:4 }, 1, 1),
    { step:'F', alter:1, octave:4 }
  );
  assert.deepEqual(
    transposeSemitonePitchV1({ step:'A', alter:0, octave:4 }, -1, 1),
    { step:'B', alter:-1, octave:4 }
  );
  assert.deepEqual(
    transposeSemitonePitchV1({ step:'B', alter:0, octave:4 }, 0, 1),
    { step:'C', alter:0, octave:5 }
  );
});

test('P10-3A semitone transpose rejects zero, out-of-range and pitch overflow', () => {
  assert.throws(
    () => transposeSemitonePitchV1({ step:'C', alter:0, octave:4 }, 0, 0),
    error => error instanceof PitchTheoryV1Error && error.code === 'INVALID_SEMITONE_DELTA'
  );
  assert.throws(
    () => transposeSemitonePitchV1({ step:'C', alter:0, octave:4 }, 0, 13),
    error => error instanceof PitchTheoryV1Error && error.code === 'INVALID_SEMITONE_DELTA'
  );
  assert.throws(
    () => transposeSemitonePitchV1({ step:'B', alter:2, octave:9 }, 0, 12),
    error => error instanceof PitchTheoryV1Error && error.code === 'PITCH_RANGE_EXCEEDED'
  );
});

test('P10-3A accidental display is key-relative but represents absolute canonical alter', () => {
  assert.equal(accidentalDisplayForPitchV1({ step:'F', alter:1, octave:4 }, 1), null);
  assert.equal(accidentalDisplayForPitchV1({ step:'F', alter:0, octave:4 }, 1), 'natural');
  assert.equal(accidentalDisplayForPitchV1({ step:'C', alter:1, octave:4 }, 0), 'sharp');
  assert.equal(accidentalDisplayForPitchV1({ step:'D', alter:-1, octave:4 }, 0), 'flat');
  assert.equal(accidentalDisplayForPitchV1({ step:'C', alter:2, octave:4 }, 0), 'double-sharp');
  assert.equal(accidentalDisplayForPitchV1({ step:'D', alter:-2, octave:4 }, 0), 'double-flat');
});

test('P10-3A negative-octave semitone arithmetic remains canonical around C and B', () => {
  assert.deepEqual(
    transposeSemitonePitchV1({ step:'C', alter:0, octave:0 }, 0, -1),
    { step:'B', alter:0, octave:-1 }
  );
  assert.deepEqual(
    transposeSemitonePitchV1({ step:'B', alter:0, octave:-1 }, 0, 1),
    { step:'C', alter:0, octave:0 }
  );
});
