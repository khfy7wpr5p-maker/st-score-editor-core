import type { SemanticAddress } from '../../addressing/src/index.js';
import { resolveSemanticAddress } from '../../addressing/src/index.js';
import type { ScoreDocument } from '../../score-model/src/index.js';

export const GUITAR_WORKSPACE_CONTRACT_VERSION = '1.0.0' as const;
export const GUITAR_WORKSPACE_SOURCE_MAP_AUTHORITY = 'DERIVATIVE_TRACEABILITY_ONLY' as const;

export const guitarWorkspaceAuthorityProfile = Object.freeze({
  version: GUITAR_WORKSPACE_CONTRACT_VERSION,
  derivativeStateOnly: true,
  sourceRevisionRequired: true,
  sourceMapRequired: true,
  staleSourceFailsClosed: true,
  engineOutputCanonicalAuthority: false,
  engineOutputScoreMutationAuthority: false,
  reverseWriteToCanonicalAllowed: false,
  rendererStateAuthoritative: false,
  teacherReviewMayMutateCanonical: false,
  productionAuthority: false
});

export type GuitarWorkspaceTargetAddress = Extract<SemanticAddress, { readonly kind: 'event' | 'note' }>;

export interface GuitarWorkspaceSourceMapEntry {
  readonly sourceEventId: string;
  readonly target: GuitarWorkspaceTargetAddress;
}

export interface GuitarWorkspaceSourceMap {
  readonly contractVersion: typeof GUITAR_WORKSPACE_CONTRACT_VERSION;
  readonly authority: typeof GUITAR_WORKSPACE_SOURCE_MAP_AUTHORITY;
  readonly documentId: string;
  readonly revisionId: string;
  readonly entries: readonly Readonly<GuitarWorkspaceSourceMapEntry>[];
}

export type GuitarWorkspaceContractErrorCode =
  | 'INVALID_SOURCE_MAP_ENTRY'
  | 'UNSUPPORTED_TARGET_KIND'
  | 'SOURCE_REVISION_MISMATCH'
  | 'DUPLICATE_SOURCE_EVENT_ID'
  | 'DUPLICATE_CANONICAL_TARGET';

export class GuitarWorkspaceContractError extends Error {
  readonly code: GuitarWorkspaceContractErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, code: GuitarWorkspaceContractErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'GuitarWorkspaceContractError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const exactKeys = (value: unknown, expected: readonly string[]): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const observed = Object.keys(value).sort();
  return JSON.stringify(observed) === JSON.stringify([...expected].sort());
};

const assertSourceEventId = (value: unknown): string => {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    throw new GuitarWorkspaceContractError(
      'Guitar workspace source event identity must be a non-empty canonical string.',
      'INVALID_SOURCE_MAP_ENTRY'
    );
  }
  return value;
};

const targetIdentity = (target: GuitarWorkspaceTargetAddress): string =>
  target.kind === 'note' ? `note:${target.noteId}` : `event:${target.eventId}`;

const validateTarget = (
  document: ScoreDocument,
  value: unknown
): Readonly<GuitarWorkspaceTargetAddress> => {
  if (!exactKeys(value, value && typeof value === 'object' && 'kind' in value && value.kind === 'note'
    ? ['contractVersion', 'kind', 'documentId', 'revisionId', 'partId', 'staffId', 'measureId', 'voiceId', 'eventId', 'noteId']
    : ['contractVersion', 'kind', 'documentId', 'revisionId', 'partId', 'staffId', 'measureId', 'voiceId', 'eventId'])) {
    throw new GuitarWorkspaceContractError(
      'Guitar workspace target must use an exact semantic event/note address shape.',
      'INVALID_SOURCE_MAP_ENTRY'
    );
  }

  const target = value as unknown as SemanticAddress;
  if (target.kind !== 'event' && target.kind !== 'note') {
    throw new GuitarWorkspaceContractError(
      'Guitar workspace source mapping may target only canonical event or note addresses.',
      'UNSUPPORTED_TARGET_KIND',
      { kind: target.kind }
    );
  }

  try {
    resolveSemanticAddress(document, target);
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? String((error as { code?: unknown }).code) : null;
    if (code === 'STALE_REVISION' || code === 'DOCUMENT_MISMATCH') {
      throw new GuitarWorkspaceContractError(
        'Guitar workspace source mapping belongs to another canonical document revision.',
        'SOURCE_REVISION_MISMATCH',
        { addressingCode: code }
      );
    }
    throw new GuitarWorkspaceContractError(
      'Guitar workspace source mapping does not resolve to a current canonical target.',
      'INVALID_SOURCE_MAP_ENTRY',
      { addressingCode: code }
    );
  }

  return Object.freeze({ ...target }) as Readonly<GuitarWorkspaceTargetAddress>;
};

export const createGuitarWorkspaceSourceMap = (
  document: ScoreDocument,
  inputEntries: readonly GuitarWorkspaceSourceMapEntry[]
): Readonly<GuitarWorkspaceSourceMap> => {
  if (!Array.isArray(inputEntries)) {
    throw new GuitarWorkspaceContractError(
      'Guitar workspace source map entries must be an array.',
      'INVALID_SOURCE_MAP_ENTRY'
    );
  }

  const sourceIds = new Set<string>();
  const canonicalTargets = new Set<string>();
  const entries: Readonly<GuitarWorkspaceSourceMapEntry>[] = [];

  for (let index = 0; index < inputEntries.length; index += 1) {
    const input = inputEntries[index] as unknown;
    if (!exactKeys(input, ['sourceEventId', 'target'])) {
      throw new GuitarWorkspaceContractError(
        'Guitar workspace source map entry has an invalid field set.',
        'INVALID_SOURCE_MAP_ENTRY',
        { index }
      );
    }

    const sourceEventId = assertSourceEventId(input.sourceEventId);
    if (sourceIds.has(sourceEventId)) {
      throw new GuitarWorkspaceContractError(
        'Guitar workspace source event identity is duplicated.',
        'DUPLICATE_SOURCE_EVENT_ID',
        { sourceEventId }
      );
    }

    const target = validateTarget(document, input.target);
    const canonicalTarget = targetIdentity(target);
    if (canonicalTargets.has(canonicalTarget)) {
      throw new GuitarWorkspaceContractError(
        'A canonical event/note target cannot be mapped from multiple engine source events.',
        'DUPLICATE_CANONICAL_TARGET',
        { canonicalTarget }
      );
    }

    sourceIds.add(sourceEventId);
    canonicalTargets.add(canonicalTarget);
    entries.push(Object.freeze({ sourceEventId, target }));
  }

  return Object.freeze({
    contractVersion: GUITAR_WORKSPACE_CONTRACT_VERSION,
    authority: GUITAR_WORKSPACE_SOURCE_MAP_AUTHORITY,
    documentId: document.id,
    revisionId: document.revision.id,
    entries: Object.freeze(entries)
  });
};
