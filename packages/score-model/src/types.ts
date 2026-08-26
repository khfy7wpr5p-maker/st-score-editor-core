export const SCORE_DOCUMENT_SCHEMA_VERSION = '1.0.0' as const;

export type ScoreDocumentSchemaVersion = typeof SCORE_DOCUMENT_SCHEMA_VERSION;
export type EntityId = string;

export type SourceFormat = 'musicxml' | 'canonical' | 'synthetic';

export interface SourceIdentity {
  readonly sha256: string;
  readonly format: SourceFormat;
  readonly byteLength: number | null;
}

export interface RevisionIdentity {
  readonly id: EntityId;
  readonly parentId: EntityId | null;
}

export interface Rational {
  readonly numerator: number;
  readonly denominator: number;
}

export type PitchStep = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export interface Pitch {
  readonly step: PitchStep;
  readonly alter: number;
  readonly octave: number;
}

export interface NoteAtom {
  readonly id: EntityId;
  readonly pitch: Pitch;
}

export interface EventBase {
  readonly id: EntityId;
  readonly onset: Rational;
  readonly duration: Rational;
}

export interface NoteEvent extends EventBase {
  readonly kind: 'note';
  readonly note: NoteAtom;
}

export interface RestEvent extends EventBase {
  readonly kind: 'rest';
}

export interface ChordEvent extends EventBase {
  readonly kind: 'chord';
  readonly notes: readonly NoteAtom[];
}

export type ScoreEvent = NoteEvent | RestEvent | ChordEvent;

export interface Voice {
  readonly id: EntityId;
  readonly ordinal: number;
  readonly events: readonly ScoreEvent[];
}

export interface Measure {
  readonly id: EntityId;
  readonly ordinal: number;
  readonly displayNumber: string | null;
  readonly voices: readonly Voice[];
}

export interface Staff {
  readonly id: EntityId;
  readonly ordinal: number;
  readonly measures: readonly Measure[];
}

export interface Part {
  readonly id: EntityId;
  readonly name: string | null;
  readonly staves: readonly Staff[];
}

export interface ScoreDocument {
  readonly schemaVersion: ScoreDocumentSchemaVersion;
  readonly id: EntityId;
  readonly revision: RevisionIdentity;
  readonly source: SourceIdentity;
  readonly parts: readonly Part[];
}

export type ValidationIssueCode =
  | 'TYPE'
  | 'UNKNOWN_FIELD'
  | 'MISSING_FIELD'
  | 'SCHEMA_VERSION'
  | 'INVALID_ID'
  | 'DUPLICATE_ID'
  | 'INVALID_SHA256'
  | 'INVALID_SOURCE_FORMAT'
  | 'INVALID_BYTE_LENGTH'
  | 'INVALID_ORDINAL'
  | 'DUPLICATE_ORDINAL'
  | 'INVALID_RATIONAL'
  | 'NON_CANONICAL_RATIONAL'
  | 'INVALID_PITCH'
  | 'EMPTY_COLLECTION'
  | 'INVALID_CHORD'
  | 'EVENT_ORDER';

export interface ValidationIssue {
  readonly code: ValidationIssueCode;
  readonly path: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly issues: readonly ValidationIssue[];
}
