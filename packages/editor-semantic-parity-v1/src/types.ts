export const SEMANTIC_PARITY_REFERENCE_VERSION = '1.0.0' as const;

export type EditorSemanticParityDiagnosticCodeV1 =
  | 'PROFILE_UNSUPPORTED'
  | 'PART_COUNT_MISMATCH'
  | 'MEASURE_COUNT_MISMATCH'
  | 'NOTE_COUNT_MISMATCH'
  | 'PITCH_MISMATCH'
  | 'ONSET_MISMATCH'
  | 'DURATION_MISMATCH'
  | 'VOICE_MISMATCH'
  | 'STAFF_MISMATCH'
  | 'TIE_ROLE_MISMATCH'
  | 'TIME_SIGNATURE_MISMATCH'
  | 'KEY_SIGNATURE_MISMATCH'
  | 'CLEF_MISMATCH';

export interface EditorSemanticParityDiagnosticV1 {
  readonly code: EditorSemanticParityDiagnosticCodeV1;
  readonly message: string;
}

export interface SemanticParityProvenanceV1 {
  readonly schemaVersion: 'st-editor-semantic-parity-fixture-v1';
  readonly sourceSha256: string;
  readonly semanticEngineCommit: 'ffc997b242fa862e180e698385cc0afb52de47a1';
  readonly semanticSnapshotSchema: 'st-semantic-snapshot-v1';
  readonly partituraVersion: '1.9.0';
  readonly divisionsPerQuarter: number;
}

export interface SemanticReferenceNoteV1 {
  readonly source_id: string | null;
  readonly part_id: string;
  readonly measure_index: number;
  readonly pitch_midi: number;
  readonly onset_div: number;
  readonly duration_div: number;
  readonly voice: number | null;
  readonly staff: number | null;
  readonly tie_prev: string | null;
  readonly tie_next: string | null;
  readonly is_grace: boolean;
}

export interface SemanticReferenceTimeSignatureV1 {
  readonly part_id: string;
  readonly onset_div: number;
  readonly beats: number;
  readonly beat_type: number;
}

export interface SemanticReferenceKeySignatureV1 {
  readonly part_id: string;
  readonly onset_div: number;
  readonly fifths: number;
  readonly mode: string | null;
}

export interface SemanticReferenceClefV1 {
  readonly part_id: string;
  readonly onset_div: number;
  readonly staff: number;
  readonly sign: string;
  readonly line: number | null;
  readonly octave_change: number;
}

export interface SemanticParitySnapshotV1 {
  readonly schema_version: 'st-semantic-snapshot-v1';
  readonly source_kind: 'musicxml';
  readonly part_count: number;
  readonly measure_count: number;
  readonly notes: readonly SemanticReferenceNoteV1[];
  readonly time_signatures: readonly SemanticReferenceTimeSignatureV1[];
  readonly key_signatures: readonly SemanticReferenceKeySignatureV1[];
  readonly clefs: readonly SemanticReferenceClefV1[];
}

export interface SemanticParityReferenceV1 {
  readonly provenance: Readonly<SemanticParityProvenanceV1>;
  readonly semanticSnapshot: Readonly<SemanticParitySnapshotV1>;
}

export type SemanticParityProfileResultV1 =
  | Readonly<{ status: 'PASS' }>
  | Readonly<{
      status: 'UNSUPPORTED';
      diagnostics: readonly EditorSemanticParityDiagnosticV1[];
    }>;
