import { createScoreDocumentV3, type ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import { createNotationDocumentV4, type NotationDocumentV4 } from '../../notation-structure-v4/src/index.js';
import { createEditorSessionV4 } from '../../editor-session-controller-v4/src/index.js';
import {
  SCORE_EDITOR_APP_DOCUMENT_VERSION,
  type AppDocumentOrigin,
  type ScoreEditorAppDocument
} from '../../score-editor-app-document/src/index.js';

export const SCORE_EDITOR_RECOVERY_VERSION = '1.0.0' as const;
export const MAX_RECOVERY_JSON_BYTES = 64 * 1024 * 1024;

export type RecoverySha256Provider = (text: string) => Promise<string>;

export interface ScoreEditorRecoveryPayload {
  readonly version: typeof SCORE_EDITOR_RECOVERY_VERSION;
  readonly createdAtEpochMs: number;
  readonly title: string;
  readonly origin: AppDocumentOrigin;
  readonly savedRevisionId: string | null;
  readonly documentId: string;
  readonly revisionId: string;
  readonly score: Readonly<ScoreDocumentV3>;
  readonly notation: Readonly<NotationDocumentV4>;
}

export interface ScoreEditorRecoveryEnvelope {
  readonly version: typeof SCORE_EDITOR_RECOVERY_VERSION;
  readonly payload: Readonly<ScoreEditorRecoveryPayload>;
  readonly payloadSha256: string;
}

export type ScoreEditorRecoveryErrorCode =
  | 'INVALID_RECOVERY_INPUT'
  | 'RECOVERY_TOO_LARGE'
  | 'CRYPTO_UNAVAILABLE'
  | 'INVALID_SHA256_RESULT'
  | 'RECOVERY_INTEGRITY_MISMATCH'
  | 'RECOVERY_METADATA_MISMATCH'
  | 'RECOVERY_CANONICAL_INVALID'
  | 'RECOVERY_ACTIVE_DOCUMENT_CONFLICT';

export class ScoreEditorRecoveryError extends Error {
  readonly code: ScoreEditorRecoveryErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: ScoreEditorRecoveryErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ScoreEditorRecoveryError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const byteLength = (text: string): number => new TextEncoder().encode(text).byteLength;

const browserSha256Hex: RecoverySha256Provider = async (text) => {
  const cryptoValue = globalThis.crypto as Crypto | undefined;
  if (cryptoValue === undefined || cryptoValue.subtle === undefined) {
    throw new ScoreEditorRecoveryError('Web Crypto SHA-256 support is required for recovery integrity.', 'CRYPTO_UNAVAILABLE');
  }
  const digest = await cryptoValue.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const verifiedDigest = async (text: string, provider: RecoverySha256Provider): Promise<string> => {
  const digest = await provider(text);
  if (!/^[0-9a-f]{64}$/.test(digest)) {
    throw new ScoreEditorRecoveryError('Recovery SHA-256 provider returned an invalid digest.', 'INVALID_SHA256_RESULT');
  }
  return digest;
};

const finiteEpoch = (value: number): number => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ScoreEditorRecoveryError('Recovery timestamp must be a non-negative safe integer.', 'INVALID_RECOVERY_INPUT');
  }
  return value;
};

const cleanTitle = (title: string): string => {
  if (typeof title !== 'string' || title.length === 0 || title.length > 256 || title !== title.trim()) {
    throw new ScoreEditorRecoveryError('Recovery title is invalid.', 'INVALID_RECOVERY_INPUT');
  }
  return title;
};

const assertOrigin = (origin: unknown): AppDocumentOrigin => {
  if (origin !== 'NEW' && origin !== 'MUSICXML') {
    throw new ScoreEditorRecoveryError('Recovery origin is invalid.', 'INVALID_RECOVERY_INPUT');
  }
  return origin;
};

const normalizedPayload = (payload: ScoreEditorRecoveryPayload): Readonly<ScoreEditorRecoveryPayload> => {
  let score: Readonly<ScoreDocumentV3>;
  try {
    score = createScoreDocumentV3(payload.score);
  } catch (error) {
    throw new ScoreEditorRecoveryError('Recovery score failed canonical V3 validation.', 'RECOVERY_CANONICAL_INVALID', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
  let notation: Readonly<NotationDocumentV4>;
  try {
    notation = createNotationDocumentV4(score, payload.notation);
  } catch (error) {
    throw new ScoreEditorRecoveryError('Recovery notation failed canonical V4 validation.', 'RECOVERY_CANONICAL_INVALID', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
  if (payload.documentId !== score.id || payload.revisionId !== score.revision.id || notation.documentId !== score.id || notation.revisionId !== score.revision.id) {
    throw new ScoreEditorRecoveryError('Recovery metadata does not match the canonical score/notation pair.', 'RECOVERY_METADATA_MISMATCH', {
      payloadDocumentId: payload.documentId,
      scoreDocumentId: score.id,
      payloadRevisionId: payload.revisionId,
      scoreRevisionId: score.revision.id
    });
  }
  const savedRevisionId = payload.savedRevisionId;
  if (savedRevisionId !== null && (typeof savedRevisionId !== 'string' || savedRevisionId.length === 0)) {
    throw new ScoreEditorRecoveryError('Recovery saved revision id is invalid.', 'INVALID_RECOVERY_INPUT');
  }
  return Object.freeze({
    version: SCORE_EDITOR_RECOVERY_VERSION,
    createdAtEpochMs: finiteEpoch(payload.createdAtEpochMs),
    title: cleanTitle(payload.title),
    origin: assertOrigin(payload.origin),
    savedRevisionId,
    documentId: score.id,
    revisionId: score.revision.id,
    score,
    notation
  });
};

const payloadText = (payload: ScoreEditorRecoveryPayload): string => JSON.stringify(payload);

export const createScoreEditorRecoveryEnvelope = async (
  document: ScoreEditorAppDocument,
  options: { readonly nowEpochMs?: number; readonly sha256Hex?: RecoverySha256Provider } = {}
): Promise<Readonly<ScoreEditorRecoveryEnvelope>> => {
  const pair = document.session.history.present;
  const payload = normalizedPayload({
    version: SCORE_EDITOR_RECOVERY_VERSION,
    createdAtEpochMs: options.nowEpochMs ?? Date.now(),
    title: document.title,
    origin: document.origin,
    savedRevisionId: document.savedRevisionId,
    documentId: pair.score.id,
    revisionId: pair.score.revision.id,
    score: pair.score,
    notation: pair.notation
  });
  const serialized = payloadText(payload);
  if (byteLength(serialized) > MAX_RECOVERY_JSON_BYTES) {
    throw new ScoreEditorRecoveryError('Recovery payload exceeds the admitted local size bound.', 'RECOVERY_TOO_LARGE');
  }
  const payloadSha256 = await verifiedDigest(serialized, options.sha256Hex ?? browserSha256Hex);
  return Object.freeze({ version: SCORE_EDITOR_RECOVERY_VERSION, payload, payloadSha256 });
};

const parseEnvelopeShape = (raw: string): ScoreEditorRecoveryEnvelope => {
  if (byteLength(raw) > MAX_RECOVERY_JSON_BYTES) {
    throw new ScoreEditorRecoveryError('Recovery record exceeds the admitted local size bound.', 'RECOVERY_TOO_LARGE');
  }
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch (error) {
    throw new ScoreEditorRecoveryError('Recovery JSON could not be parsed.', 'INVALID_RECOVERY_INPUT', { cause: error instanceof Error ? error.message : String(error) });
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ScoreEditorRecoveryError('Recovery envelope must be an object.', 'INVALID_RECOVERY_INPUT');
  }
  const record = parsed as Record<string, unknown>;
  if (record.version !== SCORE_EDITOR_RECOVERY_VERSION || typeof record.payloadSha256 !== 'string' || record.payload === null || typeof record.payload !== 'object' || Array.isArray(record.payload)) {
    throw new ScoreEditorRecoveryError('Recovery envelope fields are invalid.', 'INVALID_RECOVERY_INPUT');
  }
  return record as unknown as ScoreEditorRecoveryEnvelope;
};

export const serializeScoreEditorRecoveryEnvelope = (envelope: ScoreEditorRecoveryEnvelope): string => JSON.stringify(envelope);

export const validateScoreEditorRecoveryEnvelope = async (
  raw: string,
  options: { readonly sha256Hex?: RecoverySha256Provider } = {}
): Promise<Readonly<ScoreEditorRecoveryEnvelope>> => {
  const parsed = parseEnvelopeShape(raw);
  const payload = normalizedPayload(parsed.payload);
  const serializedPayload = payloadText(payload);
  const expected = await verifiedDigest(serializedPayload, options.sha256Hex ?? browserSha256Hex);
  if (expected !== parsed.payloadSha256) {
    throw new ScoreEditorRecoveryError('Recovery payload integrity check failed.', 'RECOVERY_INTEGRITY_MISMATCH');
  }
  return Object.freeze({ version: SCORE_EDITOR_RECOVERY_VERSION, payload, payloadSha256: expected });
};

export const restoreScoreEditorRecoveryEnvelope = (
  envelope: ScoreEditorRecoveryEnvelope,
  options: { readonly activeDocumentId?: string | null; readonly allowSameDocumentReplace?: boolean } = {}
): Readonly<ScoreEditorAppDocument> => {
  const payload = normalizedPayload(envelope.payload);
  const activeDocumentId = options.activeDocumentId ?? null;
  if (activeDocumentId !== null) {
    const same = activeDocumentId === payload.documentId;
    if (!same || options.allowSameDocumentReplace !== true) {
      throw new ScoreEditorRecoveryError('Recovery cannot silently replace the active document.', 'RECOVERY_ACTIVE_DOCUMENT_CONFLICT', {
        activeDocumentId,
        recoveryDocumentId: payload.documentId,
        sameDocument: same
      });
    }
  }
  const session = createEditorSessionV4(payload.score, payload.notation);
  return Object.freeze({
    version: SCORE_EDITOR_APP_DOCUMENT_VERSION,
    title: payload.title,
    origin: payload.origin,
    session,
    savedRevisionId: payload.savedRevisionId,
    dirty: payload.savedRevisionId === null || payload.savedRevisionId !== payload.revisionId
  });
};
