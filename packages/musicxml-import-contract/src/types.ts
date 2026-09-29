export const NORMALIZED_IMPORT_ENVELOPE_VERSION = '1.0.0' as const;

export type NormalizedImportEnvelopeVersion = typeof NORMALIZED_IMPORT_ENVELOPE_VERSION;

export type MusicXmlImportDispositionV1 =
  | 'CANONICAL_EDITABLE'
  | 'PRESERVED_RENDERABLE'
  | 'UNSUPPORTED_SEMANTIC_FAIL_CLOSED';

export type ImportFallbackFailureKindV1 =
  | 'NATIVE_COMPATIBILITY_REJECTION'
  | 'MALFORMED_XML'
  | 'SECURITY_POLICY'
  | 'RESOURCE_LIMIT'
  | 'UNREPRESENTABLE_SEMANTIC';

export interface ImportFallbackEligibilityV1 {
  readonly eligible: boolean;
  readonly reason: string;
}

export interface ImportProvenanceV1 {
  readonly sourceIdentity: string;
  readonly parser: string;
}

interface PreservedMusicXmlSymbolFieldsV1 {
  readonly element: string;
  readonly sourcePath: string;
  readonly measureNumber: string | null;
  readonly sourceNoteId: string | null;
  readonly attributes: Readonly<Record<string, string>>;
  readonly text: string | null;
  readonly provenance: Readonly<ImportProvenanceV1>;
}

export interface PreservedMusicXmlSymbolV1 extends PreservedMusicXmlSymbolFieldsV1 {
  readonly version: NormalizedImportEnvelopeVersion;
  readonly disposition: 'PRESERVED_RENDERABLE';
}

export interface CreatePreservedMusicXmlSymbolV1Input extends PreservedMusicXmlSymbolFieldsV1 {}

export interface NormalizedImportEnvelopeV1 {
  readonly version: NormalizedImportEnvelopeVersion;
  readonly sourceIdentity: string;
  readonly parts: readonly unknown[];
  readonly preservedSymbols: readonly Readonly<PreservedMusicXmlSymbolV1>[];
  readonly diagnostics: readonly unknown[];
}
