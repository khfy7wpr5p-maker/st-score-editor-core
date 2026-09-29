import {
  classifyImportFallbackEligibility,
  NORMALIZED_IMPORT_ENVELOPE_VERSION,
  type ImportFallbackFailureKindV1,
  type PreservedMusicXmlSymbolV1
} from '../../musicxml-import-contract/src/index.js';
import {
  mapPartituraImportToCanonicalV1
} from '../../musicxml-partitura-mapper/src/index.js';
import {
  extractPreservedMusicXmlSymbolsV1
} from '../../musicxml-symbol-preservation/src/index.js';
import {
  classifyMusicXmlV2ImportFailure,
  importNotationMusicXmlV2
} from '../../musicxml-v2/src/index.js';
import { migrateScoreNotationV2ToV3 } from '../../schema-migration-v2-v3/src/index.js';
import { migrateNotationV3ToV4 } from '../../schema-migration-v3-v4/src/index.js';
import type { NotationDocumentV4 } from '../../notation-structure-v4/src/index.js';
import type { ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import type { MusicXmlImportOptions } from '../../musicxml/src/index.js';

export const MUSICXML_IMPORT_ROUTER_VERSION = '1.0.0' as const;

export interface PartituraFallbackRequestV1 {
  readonly contractVersion: typeof NORMALIZED_IMPORT_ENVELOPE_VERSION;
  readonly sourceIdentity: string;
  readonly musicXml: string;
}

export type PartituraFallbackImporterV1 = (
  request: Readonly<PartituraFallbackRequestV1>
) => unknown | Promise<unknown>;

export interface MusicXmlImportRouterOptionsV1 extends MusicXmlImportOptions {
  readonly partituraFallback?: PartituraFallbackImporterV1;
}

export type MusicXmlImportRouteV1 = 'NATIVE' | 'PARTITURA_FALLBACK';

export interface MusicXmlImportRouterSuccessV1 {
  readonly version: typeof MUSICXML_IMPORT_ROUTER_VERSION;
  readonly route: MusicXmlImportRouteV1;
  readonly score: Readonly<ScoreDocumentV3>;
  readonly notation: Readonly<NotationDocumentV4>;
  readonly preservedSymbols: readonly Readonly<PreservedMusicXmlSymbolV1>[];
  readonly nativeFailureKind: ImportFallbackFailureKindV1 | null;
}

export type MusicXmlImportRouterErrorCode =
  | 'FALLBACK_CALL_FAILED'
  | 'FALLBACK_VALIDATION_FAILED';

export class MusicXmlImportRouterError extends Error {
  readonly code: MusicXmlImportRouterErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: MusicXmlImportRouterErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'MusicXmlImportRouterError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const sourceIdentityFor = (options: MusicXmlImportRouterOptionsV1): string =>
  `sha256:${options.source.sha256}`;

const fallbackFailure = (
  message: string,
  code: MusicXmlImportRouterErrorCode,
  details: Record<string, unknown> = {}
): never => {
  throw new MusicXmlImportRouterError(message, code, details);
};

export const routeMusicXmlImportV1 = async (
  musicXml: string,
  options: MusicXmlImportRouterOptionsV1
): Promise<Readonly<MusicXmlImportRouterSuccessV1>> => {
  let nativeError: unknown;
  try {
    const native = importNotationMusicXmlV2(musicXml, options);
    const v3 = migrateScoreNotationV2ToV3(native.score, native.notation);
    const notationV4 = migrateNotationV3ToV4(v3.score, v3.notation);
    return Object.freeze({
      version: MUSICXML_IMPORT_ROUTER_VERSION,
      route: 'NATIVE' as const,
      score: v3.score,
      notation: notationV4,
      preservedSymbols: Object.freeze([]),
      nativeFailureKind: null
    });
  } catch (error) {
    nativeError = error;
  }

  const nativeFailureKind = classifyMusicXmlV2ImportFailure(nativeError);
  const eligibility = classifyImportFallbackEligibility(nativeFailureKind);
  if (!eligibility.eligible || options.partituraFallback === undefined) {
    throw nativeError;
  }

  const sourceIdentity = sourceIdentityFor(options);
  let preservation;
  try {
    preservation = extractPreservedMusicXmlSymbolsV1(musicXml, {
      sourceIdentity,
      ...(options.limits === undefined ? {} : { limits: options.limits }),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      ...(options.now === undefined ? {} : { now: options.now })
    });
  } catch (error) {
    return fallbackFailure(
      'MusicXML preservation validation rejected the fallback candidate.',
      'FALLBACK_VALIDATION_FAILED',
      {
        nativeFailureKind,
        cause: error instanceof Error ? error.message : String(error)
      }
    );
  }

  let envelope: unknown;
  try {
    envelope = await options.partituraFallback(Object.freeze({
      contractVersion: NORMALIZED_IMPORT_ENVELOPE_VERSION,
      sourceIdentity,
      musicXml
    }));
  } catch (error) {
    return fallbackFailure(
      'Partitura fallback call failed.',
      'FALLBACK_CALL_FAILED',
      {
        nativeFailureKind,
        cause: error instanceof Error ? error.message : String(error)
      }
    );
  }

  const mapped = mapPartituraImportToCanonicalV1(
    envelope,
    {
      version: NORMALIZED_IMPORT_ENVELOPE_VERSION,
      sourceIdentity,
      symbols: preservation.symbols
    },
    {
      source: options.source,
      ...(options.documentId === undefined ? {} : { documentId: options.documentId }),
      ...(options.revisionId === undefined ? {} : { revisionId: options.revisionId })
    }
  );

  if (!mapped.ok) {
    return fallbackFailure(
      'Partitura fallback result failed ST canonical validation.',
      'FALLBACK_VALIDATION_FAILED',
      {
        nativeFailureKind,
        diagnostics: mapped.diagnostics
      }
    );
  }

  return Object.freeze({
    version: MUSICXML_IMPORT_ROUTER_VERSION,
    route: 'PARTITURA_FALLBACK' as const,
    score: mapped.score,
    notation: mapped.notation,
    preservedSymbols: mapped.preservedSymbols,
    nativeFailureKind
  });
};
