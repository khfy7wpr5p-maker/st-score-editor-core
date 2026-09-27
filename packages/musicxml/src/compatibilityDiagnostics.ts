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
  if (!Number.isInteger(limit) || limit <= 0) throw new RangeError('Invalid MusicXML compatibility diagnostic limit.');
  const values = new Map<string, MusicXmlCompatibilityDiagnostic>();
  let truncated = false;
  const record = (v: Omit<MusicXmlCompatibilityDiagnostic, 'count'>): void => {
    const k = [v.element,v.attribute ?? '',v.pathClass,v.reason].join('\u001f');
    const prior = values.get(k);
    if (prior) {
      values.set(k, Object.freeze({ ...prior, count:prior.count + 1 }));
    } else if (values.size < limit) {
      values.set(k, Object.freeze({ ...v, count:1 }));
    } else {
      truncated = true;
    }
  };
  const snapshot = (): Readonly<MusicXmlCompatibilityEvidence> => Object.freeze({
    diagnostics:Object.freeze([...values.values()]),
    truncated
  });
  return Object.freeze({ record, snapshot });
};
