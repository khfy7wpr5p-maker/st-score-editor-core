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
  readonly record: (
    diagnostic: Omit<MusicXmlCompatibilityDiagnostic, 'count'>
  ) => void;
  readonly snapshot: () => Readonly<MusicXmlCompatibilityEvidence>;
}

const diagnosticKey = (
  diagnostic: Omit<MusicXmlCompatibilityDiagnostic, 'count'>
): string => JSON.stringify([
  diagnostic.classification,
  diagnostic.element,
  diagnostic.attribute,
  diagnostic.pathClass,
  diagnostic.reason
]);

export const createMusicXmlCompatibilityRecorder = (
  limit: number = MUSICXML_COMPATIBILITY_DIAGNOSTIC_LIMIT
): MusicXmlCompatibilityRecorder => {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new RangeError('MusicXML compatibility diagnostic limit must be a positive integer.');
  }

  const diagnostics = new Map<string, MusicXmlCompatibilityDiagnostic>();
  let truncated = false;

  const record = (
    diagnostic: Omit<MusicXmlCompatibilityDiagnostic, 'count'>
  ): void => {
    const key = diagnosticKey(diagnostic);
    const existing = diagnostics.get(key);
    if (existing !== undefined) {
      diagnostics.set(key, Object.freeze({ ...existing, count: existing.count + 1 }));
      return;
    }
    if (diagnostics.size >= limit) {
      truncated = true;
      return;
    }
    diagnostics.set(key, Object.freeze({ ...diagnostic, count: 1 }));
  };

  const snapshot = (): Readonly<MusicXmlCompatibilityEvidence> => {
    const values = Object.freeze([...diagnostics.values()]);
    return Object.freeze({ diagnostics: values, truncated });
  };

  return Object.freeze({ record, snapshot });
};
