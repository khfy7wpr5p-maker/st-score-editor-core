import {
  importDispositionForMusicXmlCompatibilityClass,
  type MusicXmlCompatibilityClass
} from '../../musicxml/src/compatibilityPolicy.js';
import {
  NORMALIZED_IMPORT_ENVELOPE_VERSION,
  type CreatePreservedMusicXmlSymbolV1Input,
  type ImportFallbackEligibilityV1,
  type ImportFallbackFailureKindV1,
  type MusicXmlImportDispositionV1,
  type NormalizedImportEnvelopeV1,
  type PreservedMusicXmlSymbolV1
} from './types.js';

export { NORMALIZED_IMPORT_ENVELOPE_VERSION } from './types.js';
export type {
  CreatePreservedMusicXmlSymbolV1Input,
  ImportFallbackEligibilityV1,
  ImportFallbackFailureKindV1,
  ImportProvenanceV1,
  MusicXmlImportDispositionV1,
  NormalizedImportEnvelopeV1,
  NormalizedImportEnvelopeVersion,
  PreservedMusicXmlSymbolV1
} from './types.js';

const requireNonEmpty = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
  return value;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const freezeStringRecord = (value: Readonly<Record<string, string>>): Readonly<Record<string, string>> => {
  const entries = Object.entries(value).map(([key, item]) => {
    requireNonEmpty(key, 'MusicXML preserved attribute name');
    if (typeof item !== 'string') throw new TypeError('MusicXML preserved attribute values must be strings.');
    return [key, item] as const;
  });
  return Object.freeze(Object.fromEntries(entries));
};

export const importDispositionForCompatibilityClass = (
  classification: MusicXmlCompatibilityClass
): MusicXmlImportDispositionV1 => importDispositionForMusicXmlCompatibilityClass(classification);

export const classifyImportFallbackEligibility = (
  kind: ImportFallbackFailureKindV1 | string
): Readonly<ImportFallbackEligibilityV1> => {
  if (kind === 'NATIVE_COMPATIBILITY_REJECTION') {
    return Object.freeze({
      eligible: true,
      reason: 'native compatibility rejection is eligible for bounded fallback'
    });
  }
  const reasons = new Map<string, string>([
    ['MALFORMED_XML', 'malformed XML must fail before fallback'],
    ['SECURITY_POLICY', 'security-policy rejection must not reach fallback'],
    ['RESOURCE_LIMIT', 'resource-limit rejection must not reach fallback'],
    ['UNREPRESENTABLE_SEMANTIC', 'unrepresentable semantics remain fail-closed']
  ]);
  return Object.freeze({
    eligible: false,
    reason: reasons.get(kind) ?? 'unknown failure kind is not fallback eligible'
  });
};

export const createPreservedMusicXmlSymbolV1 = (
  input: CreatePreservedMusicXmlSymbolV1Input
): Readonly<PreservedMusicXmlSymbolV1> => {
  const provenance = Object.freeze({
    sourceIdentity: requireNonEmpty(input.provenance.sourceIdentity, 'MusicXML source identity'),
    parser: requireNonEmpty(input.provenance.parser, 'MusicXML provenance parser')
  });
  return Object.freeze({
    version: NORMALIZED_IMPORT_ENVELOPE_VERSION,
    disposition: 'PRESERVED_RENDERABLE' as const,
    element: requireNonEmpty(input.element, 'MusicXML preserved element'),
    sourcePath: requireNonEmpty(input.sourcePath, 'MusicXML preserved source path'),
    measureNumber: input.measureNumber,
    sourceNoteId: input.sourceNoteId,
    attributes: freezeStringRecord(input.attributes),
    text: input.text,
    provenance
  });
};

const validatePreservedSymbol = (value: unknown): Readonly<PreservedMusicXmlSymbolV1> => {
  if (!isRecord(value)) throw new TypeError('MusicXML preserved symbol must be an object.');
  if (value.version !== NORMALIZED_IMPORT_ENVELOPE_VERSION) {
    throw new TypeError('MusicXML preserved symbol version must be 1.0.0.');
  }
  if (value.disposition !== 'PRESERVED_RENDERABLE') {
    throw new TypeError('MusicXML preserved symbol disposition must be PRESERVED_RENDERABLE.');
  }
  if (!isRecord(value.attributes)) throw new TypeError('MusicXML preserved symbol attributes must be an object.');
  if (!isRecord(value.provenance)) throw new TypeError('MusicXML preserved symbol provenance must be an object.');

  return createPreservedMusicXmlSymbolV1({
    element: requireNonEmpty(value.element, 'MusicXML preserved element'),
    sourcePath: requireNonEmpty(value.sourcePath, 'MusicXML preserved source path'),
    measureNumber: value.measureNumber === null ? null : requireNonEmpty(value.measureNumber, 'MusicXML measure number'),
    sourceNoteId: value.sourceNoteId === null ? null : requireNonEmpty(value.sourceNoteId, 'MusicXML source note id'),
    attributes: value.attributes as Readonly<Record<string, string>>,
    text: value.text === null ? null : requireNonEmpty(value.text, 'MusicXML preserved text'),
    provenance: {
      sourceIdentity: requireNonEmpty(value.provenance.sourceIdentity, 'MusicXML source identity'),
      parser: requireNonEmpty(value.provenance.parser, 'MusicXML provenance parser')
    }
  });
};

export const validateNormalizedImportEnvelopeV1 = (
  value: unknown
): Readonly<NormalizedImportEnvelopeV1> => {
  if (!isRecord(value)) throw new TypeError('Normalized import envelope must be an object.');
  if (value.version !== NORMALIZED_IMPORT_ENVELOPE_VERSION) {
    throw new TypeError('Normalized import envelope version must be 1.0.0.');
  }
  const sourceIdentity = requireNonEmpty(value.sourceIdentity, 'Normalized import source identity');
  if (!Array.isArray(value.parts)) throw new TypeError('Normalized import envelope parts must be an array.');
  if (!Array.isArray(value.preservedSymbols)) throw new TypeError('Normalized import envelope preservedSymbols must be an array.');
  if (!Array.isArray(value.diagnostics)) throw new TypeError('Normalized import envelope diagnostics must be an array.');

  return Object.freeze({
    version: NORMALIZED_IMPORT_ENVELOPE_VERSION,
    sourceIdentity,
    parts: Object.freeze([...value.parts]),
    preservedSymbols: Object.freeze(value.preservedSymbols.map(validatePreservedSymbol)),
    diagnostics: Object.freeze([...value.diagnostics])
  });
};
