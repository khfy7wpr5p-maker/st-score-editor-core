import { createScoreDocumentV3, type ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import { createNotationDocumentV4, type NotationDocumentV4 } from '../../notation-structure-v4/src/index.js';
import { downgradeNotationV4ToV3 } from '../../schema-migration-v3-v4/src/index.js';
import { createSemanticAddressIndexV3, resolveSemanticAddressV3, type SemanticAddressV3 } from '../../addressing-v3/src/index.js';
import { createRendererRequestV3WithProfile, type RenderProjectionStatusV3 } from '../../renderer-contract-v3/src/index.js';
import { assertRendererProfile, rendererProfile, type RendererFamily, type RendererProfile } from '../../renderer-contract/src/index.js';

export const RENDER_REQUEST_V4_VERSION = '4.0.0' as const;
export const RENDER_MANIFEST_V4_VERSION = '4.0.0' as const;
export type RenderProjectionStatusV4 = 'V3_COMPATIBLE_XML' | 'V4_XML_PENDING' | 'CROSS_STAFF_XML_PENDING';
export interface RenderManifestEntryV4 { readonly token: string; readonly address: SemanticAddressV3 }
export interface RenderManifestV4 { readonly contractVersion: typeof RENDER_MANIFEST_V4_VERSION; readonly documentId: string; readonly revisionId: string; readonly entries: readonly RenderManifestEntryV4[] }
export interface RendererRequestV4 {
  readonly contractVersion: typeof RENDER_REQUEST_V4_VERSION;
  readonly renderer: RendererProfile;
  readonly documentId: string;
  readonly revisionId: string;
  readonly projectionStatus: RenderProjectionStatusV4;
  readonly sourceProjectionStatus: RenderProjectionStatusV3 | null;
  readonly musicXml: string | null;
  readonly manifest: Readonly<RenderManifestV4>;
}
export type RendererContractV4ErrorCode = 'INVALID_RENDER_REQUEST' | 'STALE_RENDER_REQUEST' | 'UNKNOWN_RENDER_TOKEN' | 'RENDER_TOKEN_PATH_MISMATCH';
export class RendererContractV4Error extends Error {
  readonly code: RendererContractV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: RendererContractV4ErrorCode, details: Record<string, unknown> = {}) { super(message); this.name = 'RendererContractV4Error'; this.code = code; this.details = Object.freeze({ ...details }); }
}
const tokenFor = (index: number) => `stse-r4-${index.toString(36)}`;
export const createRenderManifestV4 = (scoreInput: ScoreDocumentV3): Readonly<RenderManifestV4> => {
  const score = createScoreDocumentV3(scoreInput);
  const addresses = [...createSemanticAddressIndexV3(score).byEntityId.values()];
  return Object.freeze({ contractVersion: RENDER_MANIFEST_V4_VERSION, documentId: score.id, revisionId: score.revision.id, entries: Object.freeze(addresses.map((address, index) => Object.freeze({ token: tokenFor(index + 1), address }))) });
};
export const createRendererRequestV4WithProfile = (scoreInput: ScoreDocumentV3, notationInput: NotationDocumentV4, profile: RendererProfile): Readonly<RendererRequestV4> => {
  const score = createScoreDocumentV3(scoreInput);
  const notation = createNotationDocumentV4(score, notationInput);
  assertRendererProfile(profile);
  let projectionStatus: RenderProjectionStatusV4 = 'V4_XML_PENDING';
  let sourceProjectionStatus: RenderProjectionStatusV3 | null = null;
  let musicXml: string | null = null;
  if (notation.crossStaffPlacements.length > 0) {
    projectionStatus = 'CROSS_STAFF_XML_PENDING';
  } else {
    const v3Notation = downgradeNotationV4ToV3(score, notation);
    const request = createRendererRequestV3WithProfile(score, v3Notation, profile);
    sourceProjectionStatus = request.projectionStatus;
    if (request.projectionStatus === 'V2_COMPATIBLE_XML' && request.musicXml !== null) {
      projectionStatus = 'V3_COMPATIBLE_XML';
      musicXml = request.musicXml;
    }
  }
  return Object.freeze({ contractVersion: RENDER_REQUEST_V4_VERSION, renderer: profile, documentId: score.id, revisionId: score.revision.id, projectionStatus, sourceProjectionStatus, musicXml, manifest: createRenderManifestV4(score) });
};
export const createRendererRequestV4 = (score: ScoreDocumentV3, notation: NotationDocumentV4, family: RendererFamily = 'osmd') => createRendererRequestV4WithProfile(score, notation, rendererProfile(family));
export const renderableMusicXmlV4 = (request: RendererRequestV4): string => {
  if (request.contractVersion !== RENDER_REQUEST_V4_VERSION) throw new RendererContractV4Error('RendererRequestV4 version is invalid.', 'INVALID_RENDER_REQUEST');
  assertRendererProfile(request.renderer);
  if (request.projectionStatus !== 'V3_COMPATIBLE_XML' || typeof request.musicXml !== 'string' || request.musicXml.length === 0 || request.sourceProjectionStatus !== 'V2_COMPATIBLE_XML') {
    throw new RendererContractV4Error('Current V4 notation has no lossless admitted MusicXML renderer projection.', 'INVALID_RENDER_REQUEST', { projectionStatus: request.projectionStatus });
  }
  return request.musicXml;
};
const same = (a: SemanticAddressV3, b: SemanticAddressV3) => JSON.stringify(a) === JSON.stringify(b);
export const resolveRenderTokenV4 = (scoreInput: ScoreDocumentV3, request: RendererRequestV4, token: string): SemanticAddressV3 => {
  const score = createScoreDocumentV3(scoreInput);
  if (request.contractVersion !== RENDER_REQUEST_V4_VERSION || request.documentId !== score.id || request.revisionId !== score.revision.id) throw new RendererContractV4Error('Renderer request belongs to another V4 revision.', 'STALE_RENDER_REQUEST');
  if (request.manifest.contractVersion !== RENDER_MANIFEST_V4_VERSION || request.manifest.documentId !== request.documentId || request.manifest.revisionId !== request.revisionId) throw new RendererContractV4Error('V4 render manifest envelope mismatch.', 'RENDER_TOKEN_PATH_MISMATCH');
  const supplied = request.manifest.entries.find(entry => entry.token === token);
  if (!supplied) throw new RendererContractV4Error('Unknown V4 render token.', 'UNKNOWN_RENDER_TOKEN', { token });
  const canonical = createRenderManifestV4(score).entries.find(entry => entry.token === token);
  if (!canonical || !same(supplied.address, canonical.address)) throw new RendererContractV4Error('V4 render token mapping differs from canonical source manifest.', 'RENDER_TOKEN_PATH_MISMATCH', { token });
  try { resolveSemanticAddressV3(score, canonical.address); }
  catch (error) { throw new RendererContractV4Error('V4 render token no longer resolves exactly.', 'RENDER_TOKEN_PATH_MISMATCH', { cause: error instanceof Error ? error.message : String(error) }); }
  return canonical.address;
};
