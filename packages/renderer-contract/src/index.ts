import type { ScoreDocument } from '../../score-model/src/index.js';
import type { NotationDocument } from '../../notation-structure/src/index.js';
import { serializeNotationMusicXml } from '../../musicxml/src/index.js';
import { createSemanticAddressIndex, resolveSemanticAddress } from '../../addressing/src/index.js';
import type { SemanticAddress } from '../../addressing/src/index.js';

export const RENDER_REQUEST_VERSION = '1.0.0' as const;
export const RENDER_MANIFEST_VERSION = '1.0.0' as const;
export type RendererFamily = 'osmd' | 'alphatab';
export type RendererIntegrationTarget = 'st-score-rendering-layer';

export interface RendererProfile {
  readonly family: RendererFamily;
  readonly packageName: 'opensheetmusicdisplay' | '@coderline/alphatab';
  readonly packageVersion: string;
  readonly license: 'BSD-3-Clause' | 'MPL-2.0';
}
export interface RenderManifestEntry { readonly token: string; readonly address: SemanticAddress }
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

export type RendererContractErrorCode = 'INVALID_RENDERER_PROFILE' | 'INVALID_RENDER_REQUEST' | 'STALE_RENDER_REQUEST' | 'UNKNOWN_RENDER_TOKEN' | 'RENDER_TOKEN_PATH_MISMATCH';
export class RendererContractError extends Error {
  readonly code: RendererContractErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: RendererContractErrorCode, details: Record<string, unknown> = {}) {
    super(message); this.name='RendererContractError'; this.code=code; this.details=Object.freeze({...details}); Object.freeze(this);
  }
}

const legacyProfiles: Readonly<Record<RendererFamily, RendererProfile>> = Object.freeze({
  osmd:Object.freeze({family:'osmd',packageName:'opensheetmusicdisplay',packageVersion:'2.1.1',license:'BSD-3-Clause'}),
  alphatab:Object.freeze({family:'alphatab',packageName:'@coderline/alphatab',packageVersion:'1.8.4',license:'MPL-2.0'})
});
const integrationProfiles: Readonly<Record<RendererIntegrationTarget, RendererProfile>> = Object.freeze({
  'st-score-rendering-layer':Object.freeze({family:'osmd',packageName:'opensheetmusicdisplay',packageVersion:'2.1.2',license:'BSD-3-Clause'})
});
const admittedProfiles: readonly RendererProfile[] = Object.freeze([
  legacyProfiles.osmd,
  legacyProfiles.alphatab,
  integrationProfiles['st-score-rendering-layer']
]);

export const rendererProfile=(family:RendererFamily):RendererProfile=>legacyProfiles[family];
export const rendererProfileForIntegration=(target:RendererIntegrationTarget):RendererProfile=>integrationProfiles[target];

const admittedRendererProfile=(profile:RendererProfile):RendererProfile=>{
  const expected=admittedProfiles.find((candidate)=>
    profile.family===candidate.family&&
    profile.packageName===candidate.packageName&&
    profile.packageVersion===candidate.packageVersion&&
    profile.license===candidate.license
  );
  if(expected===undefined){
    throw new RendererContractError('Renderer host profile does not match an admitted exact integration target.','INVALID_RENDERER_PROFILE',{family:profile.family,packageName:profile.packageName,packageVersion:profile.packageVersion,license:profile.license});
  }
  return expected;
};

export const assertRendererProfile=(profile:RendererProfile):void=>{void admittedRendererProfile(profile);};

const tokenFor=(index:number):string=>`stse-r1-${index.toString(36)}`;
export const createRenderManifest=(score:ScoreDocument):Readonly<RenderManifest>=>{
  const addresses=[...createSemanticAddressIndex(score).byEntityId.values()];
  const entries=addresses.map((address,index)=>Object.freeze({token:tokenFor(index+1),address}));
  return Object.freeze({contractVersion:RENDER_MANIFEST_VERSION,documentId:score.id,revisionId:score.revision.id,entries:Object.freeze(entries)});
};

export const createRendererRequestWithProfile=(score:ScoreDocument,notation:NotationDocument,profile:RendererProfile):Readonly<RendererRequest>=>Object.freeze({
  contractVersion:RENDER_REQUEST_VERSION,
  renderer:admittedRendererProfile(profile),
  documentId:score.id,
  revisionId:score.revision.id,
  musicXml:serializeNotationMusicXml(score,notation),
  manifest:createRenderManifest(score)
});

export const createRendererRequest=(score:ScoreDocument,notation:NotationDocument,family:RendererFamily):Readonly<RendererRequest>=>
  createRendererRequestWithProfile(score,notation,rendererProfile(family));

const exactObjectKeys=(value:unknown,expected:readonly string[],label:string):Record<string,unknown>=>{
  if(value===null||typeof value!=='object'||Array.isArray(value))throw new RendererContractError(`${label} must be an object.`,'INVALID_RENDER_REQUEST');
  const record=value as Record<string,unknown>;const observed=Object.keys(record).sort(),wanted=[...expected].sort();
  if(JSON.stringify(observed)!==JSON.stringify(wanted))throw new RendererContractError(`${label} field set is invalid.`,'INVALID_RENDER_REQUEST',{observed,expected:wanted});
  return record;
};
const sameAddress=(left:SemanticAddress,right:SemanticAddress):boolean=>JSON.stringify(left)===JSON.stringify(right);

export const resolveRenderToken=(score:ScoreDocument,request:RendererRequest,token:string):SemanticAddress=>{
  exactObjectKeys(request,['contractVersion','renderer','documentId','revisionId','musicXml','manifest'],'RendererRequest');
  if(request.contractVersion!==RENDER_REQUEST_VERSION||typeof request.musicXml!=='string')throw new RendererContractError('Render request envelope is invalid.','INVALID_RENDER_REQUEST');
  assertRendererProfile(request.renderer);
  if(request.documentId!==score.id||request.revisionId!==score.revision.id){
    throw new RendererContractError('Render request belongs to a stale or different score revision.','STALE_RENDER_REQUEST',{requestDocumentId:request.documentId,requestRevisionId:request.revisionId,scoreDocumentId:score.id,scoreRevisionId:score.revision.id});
  }
  exactObjectKeys(request.manifest,['contractVersion','documentId','revisionId','entries'],'RenderManifest');
  if(request.manifest.contractVersion!==RENDER_MANIFEST_VERSION||request.manifest.documentId!==request.documentId||request.manifest.revisionId!==request.revisionId||!Array.isArray(request.manifest.entries)){
    throw new RendererContractError('Render manifest does not match its request envelope.','RENDER_TOKEN_PATH_MISMATCH');
  }
  const supplied=request.manifest.entries.find((candidate)=>candidate.token===token);
  if(supplied===undefined)throw new RendererContractError('Renderer hit token is not present in the revision-bound manifest.','UNKNOWN_RENDER_TOKEN',{token});
  const canonical=createRenderManifest(score).entries.find((candidate)=>candidate.token===token);
  if(canonical===undefined||!sameAddress(supplied.address,canonical.address)){
    throw new RendererContractError('Renderer hit token mapping differs from the canonical manifest derived for this revision.','RENDER_TOKEN_PATH_MISMATCH',{token});
  }
  try{resolveSemanticAddress(score,canonical.address);}catch(error){
    throw new RendererContractError('Renderer token semantic address no longer resolves under the request revision.','RENDER_TOKEN_PATH_MISMATCH',{token,cause:error instanceof Error?error.message:String(error)});
  }
  return canonical.address;
};
