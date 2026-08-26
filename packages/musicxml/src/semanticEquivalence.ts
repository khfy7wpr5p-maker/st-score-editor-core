import type { ScoreDocument } from '../../score-model/src/index.js';

const sortByOrdinal = <T extends { readonly ordinal: number }>(items: readonly T[]): T[] =>
  [...items].sort((left, right) => left.ordinal - right.ordinal);

export const musicSemanticFingerprint = (document: ScoreDocument): string => JSON.stringify({
  schemaVersion: document.schemaVersion,
  parts: document.parts.map((part) => ({
    name: part.name,
    staves: sortByOrdinal(part.staves).map((staff) => ({
      ordinal: staff.ordinal,
      measures: sortByOrdinal(staff.measures).map((measure) => ({
        ordinal: measure.ordinal,
        displayNumber: measure.displayNumber,
        voices: sortByOrdinal(measure.voices).map((voice) => ({
          ordinal: voice.ordinal,
          events: voice.events.map((event) => {
            const base = {
              kind: event.kind,
              onset: event.onset,
              duration: event.duration
            };
            if (event.kind === 'rest') return base;
            if (event.kind === 'note') return { ...base, pitches: [event.note.pitch] };
            return { ...base, pitches: event.notes.map((note) => note.pitch) };
          })
        }))
      }))
    }))
  }))
});

export const areMusicSemanticsEquivalent = (
  left: ScoreDocument,
  right: ScoreDocument
): boolean => musicSemanticFingerprint(left) === musicSemanticFingerprint(right);
