export const MUSICXML_COMPATIBILITY_DIAGNOSTIC_LIMIT = 64 as const;

export interface MusicXmlCompatibilityDiagnostic {
  readonly classification: 'IGNORABLE_PRESENTATION_METADATA';
  readonly element: string;
  readonly attribute: string | null;
  readonly pathClass: string;
  readonly reason: string;
  readonly count: number;
}

export interface MusicXmlCompatibilityEvidence {
  readonly diagnostics: readonly Readonly<MusicXmlCompatibilityDiagnostic>[];
  readonly truncated: boolean;
}

export interface MusicXmlCompatibilityRecorder {
  readonly record: (diagnostic: Omit<MusicXmlCompatibilityDiagnostic, 'count'>) => void;
  readonly snapshot: () => Readonly<MusicXmlCompatibilityEvidence>;
}

export const createMusicXmlCompatibilityRecorder = (
  limit: number = MUSICXML_COMPATIBILITY_DIAGNOSTIC_LIMIT
): MusicXmlCompatibilityRecorder => {
  if (!Number.isInteger(limit) || limit <= 0) throw new RangeError('MusicXML compatibility diagnostic limit must be a positive integer.');
  const values = new Map<string, MusicXmlCompatibilityDiagnostic>();
  let truncated = false;

  return Object.freeze({
    record(diagnostic: Omit<MusicXmlCompatibilityDiagnostic, 'count'>): void {
      const key = [diagnostic.element, diagnostic.attribute ?? '', diagnostic.pathClass, diagnostic.reason].join('\u0000');
      const previous = values.get(key);
      if (previous !== undefined) {
        values.set(key, { ...previous, count: previous.count + 1 });
      } else if (values.size < limit) {
        values.set(key, { ...diagnostic, count: 1 });
      } else {
        truncated = true;
      }
    },
    snapshot(): Readonly<MusicXmlCompatibilityEvidence> {
      const diagnostics = Object.freeze([...values.values()].map(item => Object.freeze({ ...item })));
      return Object.freeze({ diagnostics, truncated });
    }
  });
};
