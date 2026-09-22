import type { Pitch, PitchStep } from '../../score-model/src/index.js';
import type { AccidentalDisplay } from '../../notation-structure/src/index.js';

const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const satisfies readonly PitchStep[];
const NATURAL: Readonly<Record<PitchStep, number>> = Object.freeze({
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11
});
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'] as const satisfies readonly PitchStep[];
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'] as const satisfies readonly PitchStep[];
const MIN_OCTAVE = -1;
const MAX_OCTAVE = 9;

export type PitchTheoryV1ErrorCode =
  | 'KEY_CONTEXT_INVALID'
  | 'INVALID_SEMITONE_DELTA'
  | 'INVALID_DIATONIC_STEPS'
  | 'PITCH_RANGE_EXCEEDED'
  | 'SPELLING_UNREPRESENTABLE';

export class PitchTheoryV1Error extends Error {
  readonly code: PitchTheoryV1ErrorCode;

  constructor(message: string, code: PitchTheoryV1ErrorCode) {
    super(message);
    this.name = 'PitchTheoryV1Error';
    this.code = code;
    Object.freeze(this);
  }
}

const floorDiv = (value: number, divisor: number): number => Math.floor(value / divisor);
const mod = (value: number, divisor: number): number => ((value % divisor) + divisor) % divisor;

const inPrefix = (
  order: readonly PitchStep[],
  step: PitchStep,
  length: number
): boolean => order.slice(0, length).some(candidate => candidate === step);

export const signatureAlterForStepV1 = (
  step: PitchStep,
  fifths: number
): -1 | 0 | 1 => {
  if (!Number.isInteger(fifths) || fifths < -7 || fifths > 7) {
    throw new PitchTheoryV1Error(
      'Key signature fifths is outside -7..+7.',
      'KEY_CONTEXT_INVALID'
    );
  }
  if (fifths > 0 && inPrefix(SHARP_ORDER, step, fifths)) return 1;
  if (fifths < 0 && inPrefix(FLAT_ORDER, step, -fifths)) return -1;
  return 0;
};

export const pitchChromaticValueV1 = (pitch: Pitch): number =>
  pitch.octave * 12 + NATURAL[pitch.step] + pitch.alter;

export const transposeDiatonicPitchV1 = (
  source: Pitch,
  fifths: number,
  steps: number
): Readonly<Pitch> => {
  if (!Number.isInteger(steps) || steps === 0 || Math.abs(steps) > 7) {
    throw new PitchTheoryV1Error(
      'Diatonic steps must be -7..-1 or +1..+7.',
      'INVALID_DIATONIC_STEPS'
    );
  }

  const sourceStepIndex = STEPS.indexOf(source.step);
  const sourceSignatureAlter = signatureAlterForStepV1(source.step, fifths);
  const deviation = source.alter - sourceSignatureAlter;
  const targetAbsoluteStep = source.octave * 7 + sourceStepIndex + steps;
  const targetOctave = floorDiv(targetAbsoluteStep, 7);
  const targetStep = STEPS[mod(targetAbsoluteStep, 7)]!;
  const targetAlter = signatureAlterForStepV1(targetStep, fifths) + deviation;

  if (targetOctave < MIN_OCTAVE || targetOctave > MAX_OCTAVE) {
    throw new PitchTheoryV1Error(
      'Target octave is outside canonical range.',
      'PITCH_RANGE_EXCEEDED'
    );
  }
  if (!Number.isInteger(targetAlter) || targetAlter < -2 || targetAlter > 2) {
    throw new PitchTheoryV1Error(
      'Target spelling requires unsupported accidental.',
      'SPELLING_UNREPRESENTABLE'
    );
  }

  return Object.freeze({
    step: targetStep,
    alter: targetAlter,
    octave: targetOctave
  });
};

interface Candidate {
  readonly pitch: Readonly<Pitch>;
  readonly signatureMatch: boolean;
  readonly accidentalMagnitude: number;
  readonly directionRank: number;
  readonly letterRank: number;
}

export const transposeSemitonePitchV1 = (
  source: Pitch,
  fifths: number,
  delta: number
): Readonly<Pitch> => {
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 12) {
    throw new PitchTheoryV1Error(
      'Semitone delta must be -12..-1 or +1..+12.',
      'INVALID_SEMITONE_DELTA'
    );
  }

  signatureAlterForStepV1(source.step, fifths);
  const targetValue = pitchChromaticValueV1(source) + delta;
  const candidates: Candidate[] = [];

  for (const [letterRank, step] of STEPS.entries()) {
    for (let octave = MIN_OCTAVE; octave <= MAX_OCTAVE; octave += 1) {
      for (let alter = -2; alter <= 2; alter += 1) {
        const pitch: Pitch = { step, alter, octave };
        if (pitchChromaticValueV1(pitch) !== targetValue) continue;

        const signatureAlter = signatureAlterForStepV1(step, fifths);
        candidates.push(Object.freeze({
          pitch: Object.freeze({ ...pitch }),
          signatureMatch: alter === signatureAlter,
          accidentalMagnitude: Math.abs(alter),
          directionRank: delta > 0
            ? (alter > 0 ? 0 : alter === 0 ? 1 : 2)
            : (alter < 0 ? 0 : alter === 0 ? 1 : 2),
          letterRank
        }));
      }
    }
  }

  if (candidates.length === 0) {
    throw new PitchTheoryV1Error(
      'Target pitch is outside canonical range.',
      'PITCH_RANGE_EXCEEDED'
    );
  }

  candidates.sort((left, right) =>
    Number(right.signatureMatch) - Number(left.signatureMatch) ||
    left.accidentalMagnitude - right.accidentalMagnitude ||
    left.directionRank - right.directionRank ||
    left.letterRank - right.letterRank
  );

  return candidates[0]!.pitch;
};

export const accidentalDisplayForPitchV1 = (
  pitch: Pitch,
  fifths: number
): AccidentalDisplay | null => {
  const signatureAlter = signatureAlterForStepV1(pitch.step, fifths);
  if (pitch.alter === signatureAlter) return null;
  if (pitch.alter === 0) return 'natural';
  if (pitch.alter === 1) return 'sharp';
  if (pitch.alter === -1) return 'flat';
  if (pitch.alter === 2) return 'double-sharp';
  if (pitch.alter === -2) return 'double-flat';
  throw new PitchTheoryV1Error(
    'Pitch alteration is outside notation profile.',
    'SPELLING_UNREPRESENTABLE'
  );
};
