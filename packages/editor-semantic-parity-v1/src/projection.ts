import type { NotationDocumentV4 } from '../../notation-structure-v4/src/index.js';
import type { ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import type { Pitch, Rational } from '../../score-model/src/index.js';
import type {
  EditorSemanticClefV1,
  EditorSemanticKeySignatureV1,
  EditorSemanticNoteV1,
  EditorSemanticParityDiagnosticV1,
  EditorSemanticProjectionResultV1,
  EditorSemanticProjectionV1,
  EditorSemanticRationalV1,
  EditorSemanticTimeSignatureV1
} from './types.js';

type InternalNote = EditorSemanticNoteV1 & { readonly noteId: string };

const unsupported = (message: string): EditorSemanticProjectionResultV1 => {
  const diagnostic: EditorSemanticParityDiagnosticV1 = Object.freeze({
    code: 'PROFILE_UNSUPPORTED',
    message
  });
  return Object.freeze({
    status: 'UNSUPPORTED',
    diagnostics: Object.freeze([diagnostic])
  });
};

const gcd = (left: number, right: number): number => {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a;
};

const normalizedRational = (value: Rational): Readonly<EditorSemanticRationalV1> => {
  const divisor = gcd(value.numerator, value.denominator);
  return Object.freeze({
    numerator: value.numerator / divisor,
    denominator: value.denominator / divisor
  });
};

const compareRational = (left: EditorSemanticRationalV1, right: EditorSemanticRationalV1): number => {
  const lhs = BigInt(left.numerator) * BigInt(right.denominator);
  const rhs = BigInt(right.numerator) * BigInt(left.denominator);
  return lhs < rhs ? -1 : lhs > rhs ? 1 : 0;
};

const pitchMidi = (pitch: Pitch): number => {
  const base: Readonly<Record<Pitch['step'], number>> = Object.freeze({
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11
  });
  return (pitch.octave + 1) * 12 + base[pitch.step] + pitch.alter;
};

const compareNotes = (left: InternalNote, right: InternalNote): number =>
  left.partOrdinal - right.partOrdinal
  || left.measureIndex - right.measureIndex
  || left.staffOrdinal - right.staffOrdinal
  || left.voiceOrdinal - right.voiceOrdinal
  || compareRational(left.onset, right.onset)
  || left.pitchMidi - right.pitchMidi
  || left.occurrenceOrdinal - right.occurrenceOrdinal;

const structuralKey = (note: InternalNote): string =>
  [
    note.partOrdinal,
    note.measureIndex,
    note.staffOrdinal,
    note.voiceOrdinal,
    `${note.onset.numerator}/${note.onset.denominator}`,
    note.pitchMidi
  ].join(':');

export const projectEditorSemanticsV1 = (
  score: ScoreDocumentV3,
  notation: NotationDocumentV4
): Readonly<EditorSemanticProjectionResultV1> => {
  if (score.parts.length !== 1) return unsupported('SEM-04 admits exactly one canonical part.');
  if (notation.crossStaffPlacements.length > 0) return unsupported('Cross-staff notation is outside SEM-04.');
  if (notation.graceEvents.length > 0 || notation.graceNotes.length > 0) {
    return unsupported('Grace notation is outside SEM-04.');
  }
  for (const entry of notation.events) {
    if (entry.notation.beams.length > 0 || entry.notation.tuplet !== null) {
      return unsupported('Beam and tuplet notation is outside SEM-04.');
    }
    if (entry.notation.ornaments.some((item) => item.kind === 'tremolo' || item.kind === 'wavy-line')) {
      return unsupported('Spanning/tremolo ornament notation is outside SEM-04.');
    }
  }

  const tieRoles = new Map<string, Readonly<{ tieStart: boolean; tieStop: boolean }>>();
  for (const entry of notation.notes) {
    if (entry.notation.slurs.length > 0) return unsupported('Slur notation is outside SEM-04.');
    const starts = entry.notation.ties.filter((item) => item.type === 'start').length;
    const stops = entry.notation.ties.filter((item) => item.type === 'stop').length;
    if (starts > 1 || stops > 1) return unsupported('Ambiguous multiple tie boundaries are outside SEM-04.');
    tieRoles.set(entry.target.noteId, Object.freeze({ tieStart: starts === 1, tieStop: stops === 1 }));
  }

  const candidates: InternalNote[] = [];
  const measureMeta = new Map<string, Readonly<{ measureIndex: number; staffOrdinal: number }>>();
  for (const part of score.parts) {
    for (const staff of part.staves) {
      if (staff.role !== 'standard') return unsupported('Only standard pitched staves are admitted by SEM-04.');
      for (const [measureIndex, measure] of staff.measures.entries()) {
        measureMeta.set(measure.id, Object.freeze({ measureIndex, staffOrdinal: staff.ordinal }));
        for (const voice of measure.voices) {
          if (voice.graceGroups.length > 0) return unsupported('Grace groups are outside SEM-04.');
          for (const event of voice.events) {
            if (event.kind === 'rest') continue;
            const atoms = event.kind === 'note' ? [event.note] : event.notes;
            for (const atom of atoms) {
              const roles = tieRoles.get(atom.id) ?? { tieStart: false, tieStop: false };
              candidates.push({
                noteId: atom.id,
                partOrdinal: part.ordinal,
                measureIndex,
                staffOrdinal: staff.ordinal,
                voiceOrdinal: voice.ordinal,
                onset: normalizedRational(event.onset),
                duration: normalizedRational(event.duration),
                pitchMidi: pitchMidi(atom.pitch),
                occurrenceOrdinal: 1,
                tieStart: roles.tieStart,
                tieStop: roles.tieStop
              });
            }
          }
        }
      }
    }
  }

  candidates.sort(compareNotes);
  const seenStructural = new Set<string>();
  for (const candidate of candidates) {
    const key = structuralKey(candidate);
    if (seenStructural.has(key)) {
      return unsupported('Indistinguishable unison structural coordinates are outside SEM-04.');
    }
    seenStructural.add(key);
  }

  const frameIndex = new Map(score.measureFrames.map((frame, index) => [frame.id, index]));
  const timeSignatures: EditorSemanticTimeSignatureV1[] = [];
  for (const entry of notation.frames) {
    if (entry.notation.timeSignature === null) continue;
    const measureIndex = frameIndex.get(entry.target.frameId);
    if (measureIndex === undefined) continue;
    timeSignatures.push(Object.freeze({
      measureIndex,
      beats: entry.notation.timeSignature.beats,
      beatType: entry.notation.timeSignature.beatType
    }));
  }
  timeSignatures.sort((left, right) => left.measureIndex - right.measureIndex);

  const keySignatures: EditorSemanticKeySignatureV1[] = [];
  const clefs: EditorSemanticClefV1[] = [];
  for (const entry of notation.measures) {
    const meta = measureMeta.get(entry.target.measureId);
    if (meta === undefined) continue;
    if (entry.notation.keySignature !== null) {
      keySignatures.push(Object.freeze({
        measureIndex: meta.measureIndex,
        staffOrdinal: meta.staffOrdinal,
        fifths: entry.notation.keySignature.fifths
      }));
    }
    if (entry.notation.clef !== null) {
      clefs.push(Object.freeze({
        measureIndex: meta.measureIndex,
        staffOrdinal: meta.staffOrdinal,
        sign: entry.notation.clef.sign,
        line: entry.notation.clef.line,
        octaveChange: entry.notation.clef.octaveChange
      }));
    }
  }
  keySignatures.sort((left, right) =>
    left.measureIndex - right.measureIndex || left.staffOrdinal - right.staffOrdinal
  );
  clefs.sort((left, right) =>
    left.measureIndex - right.measureIndex || left.staffOrdinal - right.staffOrdinal
  );

  const notes: readonly EditorSemanticNoteV1[] = Object.freeze(candidates.map((candidate) => Object.freeze({
    partOrdinal: candidate.partOrdinal,
    measureIndex: candidate.measureIndex,
    staffOrdinal: candidate.staffOrdinal,
    voiceOrdinal: candidate.voiceOrdinal,
    onset: candidate.onset,
    duration: candidate.duration,
    pitchMidi: candidate.pitchMidi,
    occurrenceOrdinal: candidate.occurrenceOrdinal,
    tieStart: candidate.tieStart,
    tieStop: candidate.tieStop
  })));

  const projection: EditorSemanticProjectionV1 = Object.freeze({
    partCount: score.parts.length,
    measureCount: score.measureFrames.length,
    notes,
    timeSignatures: Object.freeze(timeSignatures),
    keySignatures: Object.freeze(keySignatures),
    clefs: Object.freeze(clefs)
  });
  return Object.freeze({ status: 'PASS', projection });
};
