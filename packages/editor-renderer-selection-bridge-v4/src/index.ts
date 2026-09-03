import type { ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import {
  RENDER_MANIFEST_V4_VERSION,
  RENDER_REQUEST_V4_VERSION,
  resolveRenderTokenV4,
  type RendererRequestV4
} from '../../renderer-contract-v4/src/index.js';
import type { RendererFamily } from '../../renderer-contract/src/index.js';
import type { SemanticAddressV3 } from '../../addressing-v3/src/index.js';

export const EDITOR_RENDERER_SELECTION_BRIDGE_V4_VERSION = '4.0.0' as const;
export const MAX_EXTERNAL_HIT_TOKEN_LENGTH_V4 = 256 as const;

export interface ExternalRendererHitV4 {
  readonly contractVersion: typeof EDITOR_RENDERER_SELECTION_BRIDGE_V4_VERSION;
  readonly documentId: string;
  readonly revisionId: string;
  readonly rendererFamily: RendererFamily;
  readonly renderRequestVersion: typeof RENDER_REQUEST_V4_VERSION;
  readonly renderManifestVersion: typeof RENDER_MANIFEST_V4_VERSION;
  readonly opaqueHitToken: string;
}

export type EditorRendererSelectionBridgeV4ErrorCode =
  | 'INVALID_EXTERNAL_HIT'
  | 'STALE_EXTERNAL_HIT'
  | 'RENDERER_FAMILY_MISMATCH'
  | 'RENDER_CONTRACT_MISMATCH';

export class EditorRendererSelectionBridgeV4Error extends Error {
  readonly code: EditorRendererSelectionBridgeV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: EditorRendererSelectionBridgeV4ErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'EditorRendererSelectionBridgeV4Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const exactFields = Object.freeze([
  'contractVersion', 'documentId', 'revisionId', 'rendererFamily',
  'renderRequestVersion', 'renderManifestVersion', 'opaqueHitToken'
] as const);
const rendererFamilies = new Set<RendererFamily>(['osmd', 'alphatab']);
const bounded = (value: unknown, field: string, max = 128): string => {
  if (typeof value !== 'string' || value.length === 0 || value.length > max || value !== value.trim()) {
    throw new EditorRendererSelectionBridgeV4Error('External V4 renderer hit contains an invalid identifier.', 'INVALID_EXTERNAL_HIT', { field });
  }
  return value;
};

export const parseExternalRendererHitV4 = (input: unknown): Readonly<ExternalRendererHitV4> => {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new EditorRendererSelectionBridgeV4Error('External V4 renderer hit must be an object.', 'INVALID_EXTERNAL_HIT');
  }
  const record = input as Record<string, unknown>;
  if (JSON.stringify(Object.keys(record).sort()) !== JSON.stringify([...exactFields].sort())) {
    throw new EditorRendererSelectionBridgeV4Error('External V4 renderer hit field set is invalid.', 'INVALID_EXTERNAL_HIT');
  }
  if (record.contractVersion !== EDITOR_RENDERER_SELECTION_BRIDGE_V4_VERSION) {
    throw new EditorRendererSelectionBridgeV4Error('External V4 renderer hit bridge version is unsupported.', 'INVALID_EXTERNAL_HIT');
  }
  if (record.renderRequestVersion !== RENDER_REQUEST_V4_VERSION || record.renderManifestVersion !== RENDER_MANIFEST_V4_VERSION) {
    throw new EditorRendererSelectionBridgeV4Error('External V4 renderer hit references unsupported render contracts.', 'RENDER_CONTRACT_MISMATCH');
  }
  if (typeof record.rendererFamily !== 'string' || !rendererFamilies.has(record.rendererFamily as RendererFamily)) {
    throw new EditorRendererSelectionBridgeV4Error('External V4 renderer family is unsupported.', 'INVALID_EXTERNAL_HIT');
  }
  return Object.freeze({
    contractVersion: EDITOR_RENDERER_SELECTION_BRIDGE_V4_VERSION,
    documentId: bounded(record.documentId, 'documentId'),
    revisionId: bounded(record.revisionId, 'revisionId'),
    rendererFamily: record.rendererFamily as RendererFamily,
    renderRequestVersion: RENDER_REQUEST_V4_VERSION,
    renderManifestVersion: RENDER_MANIFEST_V4_VERSION,
    opaqueHitToken: bounded(record.opaqueHitToken, 'opaqueHitToken', MAX_EXTERNAL_HIT_TOKEN_LENGTH_V4)
  });
};

export const createExternalRendererHitV4 = (
  request: RendererRequestV4,
  opaqueHitToken: string
): Readonly<ExternalRendererHitV4> => parseExternalRendererHitV4({
  contractVersion: EDITOR_RENDERER_SELECTION_BRIDGE_V4_VERSION,
  documentId: request.documentId,
  revisionId: request.revisionId,
  rendererFamily: request.renderer.family,
  renderRequestVersion: request.contractVersion,
  renderManifestVersion: request.manifest.contractVersion,
  opaqueHitToken
});

export const resolveExternalRendererHitV4 = (
  score: ScoreDocumentV3,
  request: RendererRequestV4,
  rawHit: unknown
): Readonly<SemanticAddressV3> => {
  const hit = parseExternalRendererHitV4(rawHit);
  if (hit.documentId !== score.id || hit.documentId !== request.documentId || hit.revisionId !== score.revision.id || hit.revisionId !== request.revisionId) {
    throw new EditorRendererSelectionBridgeV4Error('External V4 renderer hit is stale or belongs to another render request.', 'STALE_EXTERNAL_HIT', {
      hitDocumentId: hit.documentId,
      hitRevisionId: hit.revisionId,
      scoreDocumentId: score.id,
      scoreRevisionId: score.revision.id,
      requestDocumentId: request.documentId,
      requestRevisionId: request.revisionId
    });
  }
  if (hit.rendererFamily !== request.renderer.family) {
    throw new EditorRendererSelectionBridgeV4Error('External V4 renderer family does not match the current request.', 'RENDERER_FAMILY_MISMATCH');
  }
  if (request.contractVersion !== RENDER_REQUEST_V4_VERSION || request.manifest.contractVersion !== RENDER_MANIFEST_V4_VERSION) {
    throw new EditorRendererSelectionBridgeV4Error('Current V4 render request does not match bridge contracts.', 'RENDER_CONTRACT_MISMATCH');
  }
  return resolveRenderTokenV4(score, request, hit.opaqueHitToken);
};
