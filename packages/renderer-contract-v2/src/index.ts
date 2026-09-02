import { createScoreDocumentV2, type ScoreDocumentV2 } from '../../score-model-v2/src/index.js';
import { createNotationDocumentV2, type NotationDocumentV2 } from '../../notation-structure-v2/src/index.js';
import { createSemanticAddressIndexV2, resolveSemanticAddressV2, type SemanticAddressV2 } from '../../addressing-v2/src/index.js';
import { downgradeSchemaPairV2ToV1, SchemaMigrationError } from '../../schema-migration-v1-v2/src/index.js';
import { MusicXmlError, serializeNotationMusicXml } from '../../musicxml/src/index.js';
import { serializeNotationMusicXmlV2 } from '../../musicxml-v2/src/index.js';
import { assertRendererProfile, rendererProfile, type RendererFamily, type RendererProfile } from '../../renderer-contract/src/index.js';

export const RENDER_REQUEST_V2_VERSION='2.0.0' as const;
export const RENDER_MANIFEST_V2_VERSION='2.0.0' as const;
export type RenderProjectionStatusV2='V1_COMPATIBLE_XML'|'V2_SEMANTIC_XML'|'VNEXT_XML_PENDING';
export interface RenderManifestEntryV2 { readonly token:string; readonly address:SemanticAddressV2 }
export interface RenderManifestV2 { readonly contractVersion:typeof RENDER_MANIFEST_V2_VERSION; readonly documentId:string; readonly revisionId:string; readonly entries:readonly RenderManifestEntryV2[] }
export interface RendererRequestV2 { readonly contractVersion:typeof RENDER_REQUEST_V2_VERSION; readonly renderer:RendererProfile; readonly documentId:string; readonly revisionId:string; readonly projectionStatus:RenderProjectionStatusV2; readonly musicXml:string|null; readonly manifest:Readonly<RenderManifestV2> }
export type RendererContractV2ErrorCode='INVALID_RENDER_REQUEST'|'STALE_RENDER_REQUEST'|'UNKNOWN_RENDER_TOKEN'|'RENDER_TOKEN_PATH_MISMATCH';
export class RendererContractV2Error extends Error { readonly code:RendererContractV2ErrorCode; readonly details:Readonly<Record<string,unknown>>; constructor(message:string,code:RendererContractV2ErrorCode,details:Record<string,unknown>={}){super(message);this.name='RendererContractV2Error';this.code=code;this.details=Object.freeze({...details});Object.freeze(this);} }

const tokenFor=(index:number):string=>`stse-r2-${index.toString(36)}`;
export const createRenderManifestV2=(scoreInput:ScoreDocumentV2):Readonly<RenderManifestV2>=>{const score=createScoreDocumentV2(scoreInput);const addresses=[...createSemanticAddressIndexV2(score).byEntityId.values()];return Object.freeze({contractVersion:RENDER_MANIFEST_V2_VERSION,documentId:score.id,revisionId:score.revision.id,entries:Object.freeze(addresses.map((address,index)=>Object.freeze({token:tokenFor(index+1),address}))) });};

const projection=(score:ScoreDocumentV2,notation:NotationDocumentV2):Readonly<{status:RenderProjectionStatusV2;musicXml:string|null}>=>{
  try{
    const v1=downgradeSchemaPairV2ToV1(score,notation);
    return Object.freeze({status:'V1_COMPATIBLE_XML',musicXml:serializeNotationMusicXml(v1.score,v1.notation)});
  }catch(error){
    if(!(error instanceof SchemaMigrationError)||error.code!=='DOWNGRADE_UNREPRESENTABLE')throw error;
  }
  try{
    return Object.freeze({status:'V2_SEMANTIC_XML',musicXml:serializeNotationMusicXmlV2(score,notation)});
  }catch(error){
    if(error instanceof MusicXmlError)return Object.freeze({status:'VNEXT_XML_PENDING',musicXml:null});
    throw error;
  }
};

export const createRendererRequestV2WithProfile=(scoreInput:ScoreDocumentV2,notationInput:NotationDocumentV2,profile:RendererProfile):Readonly<RendererRequestV2>=>{const score=createScoreDocumentV2(scoreInput);const notation=createNotationDocumentV2(score,notationInput);assertRendererProfile(profile);const rendered=projection(score,notation);return Object.freeze({contractVersion:RENDER_REQUEST_V2_VERSION,renderer:profile,documentId:score.id,revisionId:score.revision.id,projectionStatus:rendered.status,musicXml:rendered.musicXml,manifest:createRenderManifestV2(score)});};
export const createRendererRequestV2=(score:ScoreDocumentV2,notation:NotationDocumentV2,family:RendererFamily='osmd'):Readonly<RendererRequestV2>=>createRendererRequestV2WithProfile(score,notation,rendererProfile(family));

export const renderableMusicXmlV2=(request:RendererRequestV2):string=>{
  if(request.contractVersion!==RENDER_REQUEST_V2_VERSION)throw new RendererContractV2Error('Renderer request contract version is invalid.','INVALID_RENDER_REQUEST');
  assertRendererProfile(request.renderer);
  if(request.manifest.contractVersion!==RENDER_MANIFEST_V2_VERSION||request.manifest.documentId!==request.documentId||request.manifest.revisionId!==request.revisionId)throw new RendererContractV2Error('Render manifest envelope mismatch.','INVALID_RENDER_REQUEST');
  if(request.projectionStatus==='VNEXT_XML_PENDING'){
    if(request.musicXml!==null)throw new RendererContractV2Error('Pending v2 renderer request must not carry MusicXML.','INVALID_RENDER_REQUEST');
    throw new RendererContractV2Error('This canonical v2 pair has no admitted renderer MusicXML projection.','INVALID_RENDER_REQUEST',{projectionStatus:request.projectionStatus});
  }
  if((request.projectionStatus!=='V1_COMPATIBLE_XML'&&request.projectionStatus!=='V2_SEMANTIC_XML')||typeof request.musicXml!=='string'||request.musicXml.length===0)throw new RendererContractV2Error('Renderable v2 renderer request projection is invalid.','INVALID_RENDER_REQUEST',{projectionStatus:request.projectionStatus});
  return request.musicXml;
};

const sameAddress=(a:SemanticAddressV2,b:SemanticAddressV2):boolean=>JSON.stringify(a)===JSON.stringify(b);
export const resolveRenderTokenV2=(scoreInput:ScoreDocumentV2,request:RendererRequestV2,token:string):SemanticAddressV2=>{const score=createScoreDocumentV2(scoreInput);if(request.contractVersion!==RENDER_REQUEST_V2_VERSION||request.documentId!==score.id||request.revisionId!==score.revision.id)throw new RendererContractV2Error('Render request belongs to a stale or different score revision.','STALE_RENDER_REQUEST');assertRendererProfile(request.renderer);if(request.manifest.contractVersion!==RENDER_MANIFEST_V2_VERSION||request.manifest.documentId!==request.documentId||request.manifest.revisionId!==request.revisionId)throw new RendererContractV2Error('Render manifest envelope mismatch.','RENDER_TOKEN_PATH_MISMATCH');const supplied=request.manifest.entries.find(x=>x.token===token);if(!supplied)throw new RendererContractV2Error('Unknown render token.','UNKNOWN_RENDER_TOKEN',{token});const canonical=createRenderManifestV2(score).entries.find(x=>x.token===token);if(!canonical||!sameAddress(supplied.address,canonical.address))throw new RendererContractV2Error('Render token mapping differs from canonical v2 manifest.','RENDER_TOKEN_PATH_MISMATCH',{token});try{resolveSemanticAddressV2(score,canonical.address);}catch(error){throw new RendererContractV2Error('Render token address no longer resolves under the request revision.','RENDER_TOKEN_PATH_MISMATCH',{token,cause:error instanceof Error?error.message:String(error)});}return canonical.address;};
