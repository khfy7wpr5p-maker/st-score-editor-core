import type { RendererRequest } from '../../renderer-contract/src/index.js';
import { assertRendererProfile } from '../../renderer-contract/src/index.js';

export const OSMD_INTEGRATION_VERSION = '2.1.1' as const;

export interface OsmdHostInstance {
  load(content: string): Promise<unknown>;
  render(): void;
  clear?(): void;
}

export interface OsmdRendererHost {
  readonly packageName: 'opensheetmusicdisplay';
  readonly packageVersion: typeof OSMD_INTEGRATION_VERSION;
  readonly license: 'BSD-3-Clause';
  readonly instance: OsmdHostInstance;
}

export interface OsmdRenderSession {
  readonly family: 'osmd';
  readonly documentId: string;
  readonly revisionId: string;
  readonly rendered: true;
}

export class OsmdAdapterError extends Error {
  readonly code: 'INVALID_OSMD_HOST' | 'WRONG_RENDERER_FAMILY' | 'OSMD_LOAD_FAILED' | 'OSMD_RENDER_FAILED';
  constructor(message: string, code: OsmdAdapterError['code']) {
    super(message);
    this.name = 'OsmdAdapterError';
    this.code = code;
    Object.freeze(this);
  }
}

const assertHost = (host: OsmdRendererHost): void => {
  if (
    host.packageName !== 'opensheetmusicdisplay' ||
    host.packageVersion !== OSMD_INTEGRATION_VERSION ||
    host.license !== 'BSD-3-Clause'
  ) {
    throw new OsmdAdapterError('OSMD host does not match exact direct-adapter version/license profile.', 'INVALID_OSMD_HOST');
  }
  try {
    assertRendererProfile({
      family: 'osmd',
      packageName: host.packageName,
      packageVersion: host.packageVersion,
      license: host.license
    });
  } catch {
    throw new OsmdAdapterError('OSMD host does not match exact admitted version/license profile.', 'INVALID_OSMD_HOST');
  }
  if (!host.instance || typeof host.instance.load !== 'function' || typeof host.instance.render !== 'function') {
    throw new OsmdAdapterError('OSMD host instance does not expose the admitted load/render surface.', 'INVALID_OSMD_HOST');
  }
};

export const renderWithOsmd = async (
  host: OsmdRendererHost,
  request: RendererRequest
): Promise<Readonly<OsmdRenderSession>> => {
  assertHost(host);
  if (request.renderer.family !== 'osmd') {
    throw new OsmdAdapterError('OSMD adapter received a request for another renderer family.', 'WRONG_RENDERER_FAMILY');
  }
  assertRendererProfile(request.renderer);
  if (
    request.renderer.packageName !== host.packageName ||
    request.renderer.packageVersion !== host.packageVersion ||
    request.renderer.license !== host.license
  ) {
    throw new OsmdAdapterError('OSMD request profile does not match the exact direct-adapter host profile.', 'INVALID_OSMD_HOST');
  }
  try {
    await host.instance.load(request.musicXml);
  } catch {
    throw new OsmdAdapterError('OSMD rejected or failed to load the generated MusicXML.', 'OSMD_LOAD_FAILED');
  }
  try {
    host.instance.render();
  } catch {
    throw new OsmdAdapterError('OSMD failed while rendering the loaded score.', 'OSMD_RENDER_FAILED');
  }
  return Object.freeze({
    family: 'osmd',
    documentId: request.documentId,
    revisionId: request.revisionId,
    rendered: true
  });
};

export const clearOsmdPresentation = (host: OsmdRendererHost): void => {
  assertHost(host);
  host.instance.clear?.();
};
