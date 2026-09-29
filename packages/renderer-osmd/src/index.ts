import type { RendererRequest, RendererProfile } from '../../renderer-contract/src/index.js';
import { assertRendererProfile } from '../../renderer-contract/src/index.js';
import { renderableMusicXmlV2, type RendererRequestV2 } from '../../renderer-contract-v2/src/index.js';
import { renderableMusicXmlV4, type RendererRequestV4 } from '../../renderer-contract-v4/src/index.js';

export const OSMD_INTEGRATION_VERSION = '2.1.1' as const;
export const OSMD_ST_RENDERING_LAYER_INTEGRATION_VERSION = '2.1.2' as const;
export type AdmittedOsmdIntegrationVersion =
  | typeof OSMD_INTEGRATION_VERSION
  | typeof OSMD_ST_RENDERING_LAYER_INTEGRATION_VERSION;

export interface OsmdHostInstance {
  load(content: string): Promise<unknown>;
  render(): void;
  clear?(): void;
}

export interface OsmdRendererHost {
  readonly packageName: 'opensheetmusicdisplay';
  readonly packageVersion: AdmittedOsmdIntegrationVersion;
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
  readonly code:
    | 'INVALID_OSMD_HOST'
    | 'WRONG_RENDERER_FAMILY'
    | 'UNRENDERABLE_V2_REQUEST'
    | 'UNRENDERABLE_V4_REQUEST'
    | 'OSMD_LOAD_FAILED'
    | 'OSMD_RENDER_FAILED';
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
    host.license !== 'BSD-3-Clause'
  ) {
    throw new OsmdAdapterError('OSMD host does not match exact direct-adapter package/license profile.', 'INVALID_OSMD_HOST');
  }
  try {
    assertRendererProfile({
      family: 'osmd',
      packageName: host.packageName,
      packageVersion: host.packageVersion,
      license: host.license
    });
  } catch {
    throw new OsmdAdapterError('OSMD host does not match an exact admitted version/license profile.', 'INVALID_OSMD_HOST');
  }
  if (!host.instance || typeof host.instance.load !== 'function' || typeof host.instance.render !== 'function') {
    throw new OsmdAdapterError('OSMD host instance does not expose the admitted load/render surface.', 'INVALID_OSMD_HOST');
  }
};

const assertRequestProfile = (host: OsmdRendererHost, profile: RendererProfile): void => {
  if (profile.family !== 'osmd') {
    throw new OsmdAdapterError('OSMD adapter received a request for another renderer family.', 'WRONG_RENDERER_FAMILY');
  }
  try {
    assertRendererProfile(profile);
  } catch {
    throw new OsmdAdapterError('OSMD request profile is not an admitted exact renderer profile.', 'INVALID_OSMD_HOST');
  }
  if (
    profile.packageName !== host.packageName ||
    profile.packageVersion !== host.packageVersion ||
    profile.license !== host.license
  ) {
    throw new OsmdAdapterError('OSMD request profile does not match the exact direct-adapter host profile.', 'INVALID_OSMD_HOST');
  }
};

const renderXml = async (
  host: OsmdRendererHost,
  profile: RendererProfile,
  documentId: string,
  revisionId: string,
  musicXml: string
): Promise<Readonly<OsmdRenderSession>> => {
  assertHost(host);
  assertRequestProfile(host, profile);
  try {
    await host.instance.load(musicXml);
  } catch {
    throw new OsmdAdapterError('OSMD rejected or failed to load the generated MusicXML.', 'OSMD_LOAD_FAILED');
  }
  try {
    host.instance.render();
  } catch {
    throw new OsmdAdapterError('OSMD failed while rendering the loaded score.', 'OSMD_RENDER_FAILED');
  }
  return Object.freeze({ family: 'osmd', documentId, revisionId, rendered: true });
};

export const renderWithOsmd = async (
  host: OsmdRendererHost,
  request: RendererRequest
): Promise<Readonly<OsmdRenderSession>> =>
  renderXml(host, request.renderer, request.documentId, request.revisionId, request.musicXml);

export const renderWithOsmdV2 = async (
  host: OsmdRendererHost,
  request: RendererRequestV2
): Promise<Readonly<OsmdRenderSession>> => {
  let musicXml: string;
  try {
    musicXml = renderableMusicXmlV2(request);
  } catch {
    throw new OsmdAdapterError('OSMD v2 request does not contain an admitted renderable MusicXML projection.', 'UNRENDERABLE_V2_REQUEST');
  }
  return renderXml(host, request.renderer, request.documentId, request.revisionId, musicXml);
};

export const renderWithOsmdV4 = async (
  host: OsmdRendererHost,
  request: RendererRequestV4
): Promise<Readonly<OsmdRenderSession>> => {
  let musicXml: string;
  try {
    musicXml = renderableMusicXmlV4(request);
  } catch {
    throw new OsmdAdapterError('OSMD V4 request does not contain an admitted lossless MusicXML projection.', 'UNRENDERABLE_V4_REQUEST');
  }
  return renderXml(host, request.renderer, request.documentId, request.revisionId, musicXml);
};

export const clearOsmdPresentation = (host: OsmdRendererHost): void => {
  assertHost(host);
  host.instance.clear?.();
};
