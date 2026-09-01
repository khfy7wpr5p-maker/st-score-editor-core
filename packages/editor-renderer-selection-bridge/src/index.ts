import type { ScoreDocument } from '../../score-model/src/index.js';
import {
  RENDER_MANIFEST_VERSION,
  RENDER_REQUEST_VERSION
} from '../../renderer-contract/src/index.js';
import type { RendererFamily, RendererRequest } from '../../renderer-contract/src/index.js';
import { selectRenderToken } from '../../editor-selection/src/index.js';
import type { EditorSelectionResult } from '../../editor-selection/src/index.js';

export const EDITOR_RENDERER_SELECTION_BRIDGE_VERSION = '1.0.0-draft' as const;
export const MAX_EXTERNAL_HIT_TOKEN_LENGTH = 256 as const;

export interface ExternalRendererHit {
  readonly contractVersion: typeof EDITOR_RENDERER_SELECTION_BRIDGE_VERSION;
  readonly documentId: string;
  readonly revisionId: string;
  readonly rendererFamily: RendererFamily;
  readonly renderRequestVersion: typeof RENDER_REQUEST_VERSION;
  readonly renderManifestVersion: typeof RENDER_MANIFEST_VERSION;
  readonly opaqueHitToken: string;
}

export type EditorRendererSelectionBridgeErrorCode =
  | 'INVALID_EXTERNAL_HIT'
  | 'STALE_EXTERNAL_HIT'
  | 'RENDERER_FAMILY_MISMATCH'
  | 'RENDER_CONTRACT_MISMATCH';

export class EditorRendererSelectionBridgeError extends Error {
  readonly code: EditorRendererSelectionBridgeErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, code: EditorRendererSelectionBridgeErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'EditorRendererSelectionBridgeError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

type UnknownRecord = Record<string, unknown>;

const exactFields = Object.freeze([
  'contractVersion',
  'documentId',
  'revisionId',
  'rendererFamily',
  'renderRequestVersion',
  'renderManifestVersion',
  'opaqueHitToken'
] as const);

const validRendererFamilies = new Set<RendererFamily>(['osmd', 'alphatab']);

const boundedId = (value: unknown, field: string, maximum = 128): string => {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum || value !== value.trim()) {
    throw new EditorRendererSelectionBridgeError('External renderer hit contains an invalid identifier.', 'INVALID_EXTERNAL_HIT', { field });
  }
  return value;
};

export const parseExternalRendererHit = (input: unknown): Readonly<ExternalRendererHit> => {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new EditorRendererSelectionBridgeError('External renderer hit must be an object.', 'INVALID_EXTERNAL_HIT');
  }
  const record = input as UnknownRecord;
  const observed = Object.keys(record).sort();
  const expected = [...exactFields].sort();
  if (JSON.stringify(observed) !== JSON.stringify(expected)) {
    throw new EditorRendererSelectionBridgeError('External renderer hit field set is invalid.', 'INVALID_EXTERNAL_HIT', { observed, expected });
  }
  if (record.contractVersion !== EDITOR_RENDERER_SELECTION_BRIDGE_VERSION) {
    throw new EditorRendererSelectionBridgeError('External renderer bridge contract version is unsupported.', 'INVALID_EXTERNAL_HIT', { contractVersion: record.contractVersion });
  }
  if (record.renderRequestVersion !== RENDER_REQUEST_VERSION || record.renderManifestVersion !== RENDER_MANIFEST_VERSION) {
    throw new EditorRendererSelectionBridgeError('External renderer hit references unsupported render contracts.', 'RENDER_CONTRACT_MISMATCH', {
      renderRequestVersion: record.renderRequestVersion,
      renderManifestVersion: record.renderManifestVersion
    });
  }
  if (typeof record.rendererFamily !== 'string' || !validRendererFamilies.has(record.rendererFamily as RendererFamily)) {
    throw new EditorRendererSelectionBridgeError('External renderer family is unsupported.', 'INVALID_EXTERNAL_HIT', { rendererFamily: record.rendererFamily });
  }
  return Object.freeze({
    contractVersion: EDITOR_RENDERER_SELECTION_BRIDGE_VERSION,
    documentId: boundedId(record.documentId, 'documentId'),
    revisionId: boundedId(record.revisionId, 'revisionId'),
    rendererFamily: record.rendererFamily as RendererFamily,
    renderRequestVersion: RENDER_REQUEST_VERSION,
    renderManifestVersion: RENDER_MANIFEST_VERSION,
    opaqueHitToken: boundedId(record.opaqueHitToken, 'opaqueHitToken', MAX_EXTERNAL_HIT_TOKEN_LENGTH)
  });
};

export const createExternalRendererHit = (
  request: RendererRequest,
  opaqueHitToken: string
): Readonly<ExternalRendererHit> => parseExternalRendererHit({
  contractVersion: EDITOR_RENDERER_SELECTION_BRIDGE_VERSION,
  documentId: request.documentId,
  revisionId: request.revisionId,
  rendererFamily: request.renderer.family,
  renderRequestVersion: request.contractVersion,
  renderManifestVersion: request.manifest.contractVersion,
  opaqueHitToken
});

export const resolveExternalRendererHit = (
  score: ScoreDocument,
  request: RendererRequest,
  rawHit: unknown
): Readonly<EditorSelectionResult> => {
  const hit = parseExternalRendererHit(rawHit);
  if (hit.documentId !== score.id || hit.documentId !== request.documentId || hit.revisionId !== score.revision.id || hit.revisionId !== request.revisionId) {
    throw new EditorRendererSelectionBridgeError('External renderer hit is stale or belongs to another score/render request.', 'STALE_EXTERNAL_HIT', {
      hitDocumentId: hit.documentId,
      hitRevisionId: hit.revisionId,
      scoreDocumentId: score.id,
      scoreRevisionId: score.revision.id,
      requestDocumentId: request.documentId,
      requestRevisionId: request.revisionId
    });
  }
  if (hit.rendererFamily !== request.renderer.family) {
    throw new EditorRendererSelectionBridgeError('External renderer family does not match the current render request.', 'RENDERER_FAMILY_MISMATCH', {
      hitRendererFamily: hit.rendererFamily,
      requestRendererFamily: request.renderer.family
    });
  }
  if (request.contractVersion !== RENDER_REQUEST_VERSION || request.manifest.contractVersion !== RENDER_MANIFEST_VERSION) {
    throw new EditorRendererSelectionBridgeError('Current render request does not match admitted bridge contracts.', 'RENDER_CONTRACT_MISMATCH');
  }
  return selectRenderToken(score, request, hit.opaqueHitToken);
};
