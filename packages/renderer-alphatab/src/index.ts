import type { RendererRequest } from '../../renderer-contract/src/index.js';
import { assertRendererProfile } from '../../renderer-contract/src/index.js';

export const ALPHATAB_INTEGRATION_VERSION = '1.8.4' as const;

export interface AlphaTabHostApi {
  load(data: Uint8Array): boolean;
  destroy?(): void;
}

export interface AlphaTabRendererHost {
  readonly packageName: '@coderline/alphatab';
  readonly packageVersion: typeof ALPHATAB_INTEGRATION_VERSION;
  readonly license: 'MPL-2.0';
  readonly api: AlphaTabHostApi;
}

export interface AlphaTabRenderSession {
  readonly family: 'alphatab';
  readonly documentId: string;
  readonly revisionId: string;
  readonly accepted: true;
}

export class AlphaTabAdapterError extends Error {
  readonly code: 'INVALID_ALPHATAB_HOST' | 'WRONG_RENDERER_FAMILY' | 'ALPHATAB_LOAD_REJECTED';
  constructor(message: string, code: AlphaTabAdapterError['code']) {
    super(message);
    this.name = 'AlphaTabAdapterError';
    this.code = code;
    Object.freeze(this);
  }
}

const assertHost = (host: AlphaTabRendererHost): void => {
  try {
    assertRendererProfile({
      family: 'alphatab',
      packageName: host.packageName,
      packageVersion: host.packageVersion,
      license: host.license
    });
  } catch {
    throw new AlphaTabAdapterError('alphaTab host does not match exact admitted version/license profile.', 'INVALID_ALPHATAB_HOST');
  }
  if (!host.api || typeof host.api.load !== 'function') {
    throw new AlphaTabAdapterError('alphaTab host API does not expose the admitted load surface.', 'INVALID_ALPHATAB_HOST');
  }
};

export const renderWithAlphaTab = (
  host: AlphaTabRendererHost,
  request: RendererRequest
): Readonly<AlphaTabRenderSession> => {
  assertHost(host);
  if (request.renderer.family !== 'alphatab') {
    throw new AlphaTabAdapterError('alphaTab adapter received a request for another renderer family.', 'WRONG_RENDERER_FAMILY');
  }
  assertRendererProfile(request.renderer);
  const bytes = new TextEncoder().encode(request.musicXml);
  let accepted = false;
  try {
    accepted = host.api.load(bytes);
  } catch {
    accepted = false;
  }
  if (!accepted) {
    throw new AlphaTabAdapterError('alphaTab rejected the generated MusicXML.', 'ALPHATAB_LOAD_REJECTED');
  }
  return Object.freeze({
    family: 'alphatab',
    documentId: request.documentId,
    revisionId: request.revisionId,
    accepted: true
  });
};

export const destroyAlphaTabPresentation = (host: AlphaTabRendererHost): void => {
  assertHost(host);
  host.api.destroy?.();
};
