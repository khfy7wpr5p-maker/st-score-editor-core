import type { ScoreDocument } from '../../score-model/src/index.js';
import type { NotationDocument } from '../../notation-structure/src/index.js';
import { serializeNotationMusicXml } from '../../musicxml/src/index.js';
import { createSemanticAddressIndex, resolveSemanticAddress } from '../../addressing/src/index.js';
import type { SemanticAddress } from '../../addressing/src/index.js';

export const RENDER_REQUEST_VERSION = '1.0.0' as const;
export const RENDER_MANIFEST_VERSION = '1.0.0' as const;

export type RendererFamily = 'osmd' | 'alphatab';

export interface RendererProfile {
  readonly family: RendererFamily;
  readonly packageName: 'opensheetmusicdisplay' | '@coderline/alphatab';
  readonly packageVersion: string;
  readonly license: 'BSD-3-Clause' | 'MPL-2.0';
}

export interface RenderManifestEntry {
  readonly token: string;
  readonly address: SemanticAddress;
}

export interface RenderManifest {
  readonly contractVersion: typeof RENDER_MANIFEST_VERSION;
  readonly documentId: string;
  readonly revisionId: string;
  readonly entries: readonly RenderManifestEntry[];
}

export interface RendererRequest {
  readonly contractVersion: typeof RENDER_REQUEST_VERSION;
  readonly renderer: RendererProfile;
  readonly documentId: string;
  readonly revisionId: string;
  readonly musicXml: string;
  readonly manifest: RenderManifest;
}

export type RendererContractErrorCode =
  | 'INVALID_RENDERER_PROFILE'
  | 'STALE_RENDER_REQUEST'
  | 'UNKNOWN_RENDER_TOKEN'
  | 'RENDER_TOKEN_PATH_MISMATCH';

export class RendererContractError extends Error {
  readonly code: RendererContractErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: RendererContractErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'RendererContractError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const exactProfiles: Readonly<Record<RendererFamily, RendererProfile>> = Object.freeze({
  osmd: Object.freeze({
    family: 'osmd',
    packageName: 'opensheetmusicdisplay',
    packageVersion: '2.1.1',
    license: 'BSD-3-Clause'
  }),
  alphatab: Object.freeze({
    family: 'alphatab',
    packageName: '@coderline/alphatab',
    packageVersion: '1.8.4',
    license: 'MPL-2.0'
  })
});

export const rendererProfile = (family: RendererFamily): RendererProfile => exactProfiles[family];

export const assertRendererProfile = (profile: RendererProfile): void => {
  const expected = exactProfiles[profile.family];
  if (
    expected === undefined ||
    profile.packageName !== expected.packageName ||
    profile.packageVersion !== expected.packageVersion ||
    profile.license !== expected.license
  ) {
    throw new RendererContractError('Renderer host profile does not match the admitted exact integration target.', 'INVALID_RENDERER_PROFILE', {
      family: profile.family,
      packageName: profile.packageName,
      packageVersion: profile.packageVersion,
      license: profile.license
    });
  }
};

const tokenFor = (index: number): string => `stse-r1-${index.toString(36)}`;

export const createRenderManifest = (score: ScoreDocument): Readonly<RenderManifest> => {
  const semanticIndex = createSemanticAddressIndex(score);
  const addresses = [...semanticIndex.byEntityId.values()];
  const entries = addresses.map((address, index) => Object.freeze({
    token: tokenFor(index + 1),
    address
  }));
  return Object.freeze({
    contractVersion: RENDER_MANIFEST_VERSION,
    documentId: score.id,
    revisionId: score.revision.id,
    entries: Object.freeze(entries)
  });
};

export const createRendererRequest = (
  score: ScoreDocument,
  notation: NotationDocument,
  family: RendererFamily
): Readonly<RendererRequest> => {
  const profile = rendererProfile(family);
  const musicXml = serializeNotationMusicXml(score, notation);
  return Object.freeze({
    contractVersion: RENDER_REQUEST_VERSION,
    renderer: profile,
    documentId: score.id,
    revisionId: score.revision.id,
    musicXml,
    manifest: createRenderManifest(score)
  });
};

export const resolveRenderToken = (
  score: ScoreDocument,
  request: RendererRequest,
  token: string
): SemanticAddress => {
  assertRendererProfile(request.renderer);
  if (request.documentId !== score.id || request.revisionId !== score.revision.id) {
    throw new RendererContractError('Render request belongs to a stale or different score revision.', 'STALE_RENDER_REQUEST', {
      requestDocumentId: request.documentId,
      requestRevisionId: request.revisionId,
      scoreDocumentId: score.id,
      scoreRevisionId: score.revision.id
    });
  }
  if (request.manifest.documentId !== request.documentId || request.manifest.revisionId !== request.revisionId) {
    throw new RendererContractError('Render manifest does not match its request envelope.', 'RENDER_TOKEN_PATH_MISMATCH');
  }
  const entry = request.manifest.entries.find((candidate) => candidate.token === token);
  if (entry === undefined) {
    throw new RendererContractError('Renderer hit token is not present in the revision-bound manifest.', 'UNKNOWN_RENDER_TOKEN', { token });
  }
  try {
    resolveSemanticAddress(score, entry.address);
  } catch (error) {
    throw new RendererContractError('Renderer token semantic address no longer resolves under the request revision.', 'RENDER_TOKEN_PATH_MISMATCH', {
      token,
      cause: error instanceof Error ? error.message : String(error)
    });
  }
  return entry.address;
};
