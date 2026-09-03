import { createScoreDocumentV2, type ScoreDocumentV2 } from '../../score-model-v2/src/index.js';
import { createNotationDocumentV2 } from '../../notation-structure-v2/src/index.js';
import { addressEntityV2 } from '../../addressing-v2/src/index.js';
import { migrateScoreNotationV2ToV3 } from '../../schema-migration-v2-v3/src/index.js';
import {
  createEditorSessionV4FromV3,
  commitSessionBasicAuthoringIntentV4,
  commitSessionGraceAuthoringIntentV4,
  commitSessionCrossStaffIntentV4,
  commitSessionTopologyIntentV4,
  navigateSessionHistoryV4,
  type EditorSessionStateV4
} from '../../editor-session-controller-v4/src/index.js';
import type { BasicAuthoringV4Options } from '../../editor-basic-authoring-v4/src/index.js';
import type { GraceAuthoringV4Options } from '../../editor-grace-authoring-v4/src/index.js';
import type { CrossStaffAuthoringV4Options } from '../../editor-cross-staff-authoring-v4/src/index.js';
import type { TopologyAuthoringV3Options } from '../../editor-topology-authoring-v3/src/index.js';
import { importNotationMusicXmlV2 } from '../../musicxml-v2/src/index.js';
import { renderableMusicXmlV4, RendererContractV4Error } from '../../renderer-contract-v4/src/index.js';

export const SCORE_EDITOR_APP_DOCUMENT_VERSION = '1.0.0' as const;
export type AppDocumentOrigin = 'NEW' | 'MUSICXML';
export type AppSha256Provider = (text: string) => Promise<string>;

export interface ScoreEditorAppDocument { readonly version:typeof SCORE_EDITOR_APP_DOCUMENT_VERSION; readonly title:string; readonly origin:AppDocumentOrigin; readonly session:Readonly<EditorSessionStateV4>; readonly savedRevisionId:string|null; readonly dirty:boolean }
export interface NewAppDocumentOptions { readonly title?:string; readonly idFactory?:()=>string }
export interface OpenMusicXmlAppDocumentOptions { readonly title?:string; readonly documentId?:string; readonly revisionId?:string; readonly sha256Hex?:AppSha256Provider }
export type ScoreEditorAppDocumentErrorCode='INVALID_TITLE'|'ID_FACTORY_UNAVAILABLE'|'CRYPTO_UNAVAILABLE'|'INVALID_SHA256_RESULT'|'BLANK_DOCUMENT_INVALID'|'EXPORT_UNAVAILABLE';
export class ScoreEditorAppDocumentError extends Error { readonly code:ScoreEditorAppDocumentErrorCode; readonly details:Readonly<Record<string,unknown>>; constructor(message:string,code:ScoreEditorAppDocumentErrorCode,details:Record<string,unknown>={}){super(message);this.name='ScoreEditorAppDocumentError';this.code=code;this.details=Object.freeze({...details});} }

const cleanTitle=(value:string|undefined,fallback:string):string=>{const title=value??fallback;if(title!==title.trim()||title.length===0||title.length>256)throw new ScoreEditorAppDocumentError('Document title must be a trimmed non-empty string up to 256 characters.','INVALID_TITLE');return title;};
const defaultIdFactory=():string=>{const cryptoValue=globalThis.crypto as Crypto|undefined;if(cryptoValue===undefined||typeof cryptoValue.randomUUID!=='function')throw new ScoreEditorAppDocumentError('Browser-safe randomUUID support is required to create a new app document.','ID_FACTORY_UNAVAILABLE');return cryptoValue.randomUUID();};
const id=(factory:()=>string,prefix:string):string=>`${prefix}:${factory()}`;
const appState=(title:string,origin:AppDocumentOrigin,session:Readonly<EditorSessionStateV4>,savedRevisionId:string|null):Readonly<ScoreEditorAppDocument>=>Object.freeze({version:SCORE_EDITOR_APP_DOCUMENT_VERSION,title,origin,session,savedRevisionId,dirty:savedRevisionId===null||session.history.present.score.revision.id!==savedRevisionId});

const blankV2=(factory:()=>string):Readonly<{score:Readonly<ScoreDocumentV2>;notation:ReturnType<typeof createNotationDocumentV2>}>=>{
  const documentId=id(factory,'doc'),revisionId=id(factory,'rev'),partId=id(factory,'part'),staffId=id(factory,'staff'),measureId=id(factory,'measure'),voiceId=id(factory,'voice'),restId=id(factory,'event');
  const score=createScoreDocumentV2({schemaVersion:'2.0.0',id:documentId,revision:{id:revisionId,parentId:null},source:{sha256:'0'.repeat(64),format:'synthetic',byteLength:null},parts:[{id:partId,name:'Piano',staves:[{id:staffId,ordinal:1,measures:[{id:measureId,ordinal:1,displayNumber:'1',voices:[{id:voiceId,ordinal:1,events:[{id:restId,kind:'rest',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:1}}],graceGroups:[]}]}]}]}]});
  const measureTarget=addressEntityV2(score,measureId);if(measureTarget.kind!=='measure')throw new ScoreEditorAppDocumentError('Blank score measure identity did not resolve as a measure.','BLANK_DOCUMENT_INVALID');
  const notation=createNotationDocumentV2(score,{contractVersion:'2.0.0',documentId:score.id,revisionId:score.revision.id,measures:[{target:measureTarget,notation:{timeSignature:{beats:4,beatType:4},keySignature:{fifths:0},clef:{sign:'G',line:2,octaveChange:0},barlines:[]}}],events:[],notes:[],graceEvents:[],graceNotes:[]});return Object.freeze({score,notation});
};

const browserSha256Hex:AppSha256Provider=async(text:string):Promise<string>=>{const cryptoValue=globalThis.crypto as Crypto|undefined;if(cryptoValue===undefined||cryptoValue.subtle===undefined)throw new ScoreEditorAppDocumentError('Web Crypto SHA-256 support is required for MusicXML source identity.','CRYPTO_UNAVAILABLE');const bytes=new TextEncoder().encode(text);const digest=await cryptoValue.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');};
const verifiedSha256Hex=async(text:string,provider:AppSha256Provider):Promise<string>=>{const digest=await provider(text);if(!/^[0-9a-f]{64}$/.test(digest))throw new ScoreEditorAppDocumentError('SHA-256 provider returned an invalid digest.','INVALID_SHA256_RESULT');return digest;};

export const createNewScoreEditorAppDocument=(options:NewAppDocumentOptions={}):Readonly<ScoreEditorAppDocument>=>{const factory=options.idFactory??defaultIdFactory;const pair=blankV2(factory);const migrated=migrateScoreNotationV2ToV3(pair.score,pair.notation);const session=createEditorSessionV4FromV3(migrated.score,migrated.notation);return appState(cleanTitle(options.title,'Untitled'),'NEW',session,null);};
export const openMusicXmlScoreEditorAppDocument=async(musicXml:string,options:OpenMusicXmlAppDocumentOptions={}):Promise<Readonly<ScoreEditorAppDocument>>=>{const bytes=new TextEncoder().encode(musicXml);const source=Object.freeze({sha256:await verifiedSha256Hex(musicXml,options.sha256Hex??browserSha256Hex),format:'musicxml' as const,byteLength:bytes.byteLength});const imported=importNotationMusicXmlV2(musicXml,{source,...(options.documentId===undefined?{}:{documentId:options.documentId}),...(options.revisionId===undefined?{}:{revisionId:options.revisionId})});const migrated=migrateScoreNotationV2ToV3(imported.score,imported.notation);const session=createEditorSessionV4FromV3(migrated.score,migrated.notation);return appState(cleanTitle(options.title,'Imported Score'),'MUSICXML',session,session.history.present.score.revision.id);};
export const exportMusicXmlScoreEditorAppDocument=(document:ScoreEditorAppDocument):string=>{try{return renderableMusicXmlV4(document.session.renderRequest);}catch(error){if(error instanceof RendererContractV4Error)throw new ScoreEditorAppDocumentError('Current document contains semantics that do not yet have an admitted lossless MusicXML export path.','EXPORT_UNAVAILABLE',{projectionStatus:document.session.renderRequest.projectionStatus,cause:error.message});throw error;}};
export const markScoreEditorAppDocumentSaved=(document:ScoreEditorAppDocument,title:string=document.title):Readonly<ScoreEditorAppDocument>=>appState(cleanTitle(title,document.title),document.origin,document.session,document.session.history.present.score.revision.id);
export const commitAppBasicAuthoringIntent=(document:ScoreEditorAppDocument,intent:unknown,options:BasicAuthoringV4Options):Readonly<ScoreEditorAppDocument>=>appState(document.title,document.origin,commitSessionBasicAuthoringIntentV4(document.session,intent,options),document.savedRevisionId);
export const commitAppGraceAuthoringIntent=(document:ScoreEditorAppDocument,intent:unknown,options:GraceAuthoringV4Options):Readonly<ScoreEditorAppDocument>=>appState(document.title,document.origin,commitSessionGraceAuthoringIntentV4(document.session,intent,options),document.savedRevisionId);
export const commitAppCrossStaffIntent=(document:ScoreEditorAppDocument,intent:unknown,options:CrossStaffAuthoringV4Options):Readonly<ScoreEditorAppDocument>=>appState(document.title,document.origin,commitSessionCrossStaffIntentV4(document.session,intent,options),document.savedRevisionId);
export const commitAppTopologyIntent=(document:ScoreEditorAppDocument,intent:unknown,options:TopologyAuthoringV3Options):Readonly<ScoreEditorAppDocument>=>appState(document.title,document.origin,commitSessionTopologyIntentV4(document.session,intent,options),document.savedRevisionId);
export const navigateAppDocumentHistory=(document:ScoreEditorAppDocument,direction:'UNDO'|'REDO'):Readonly<ScoreEditorAppDocument>=>appState(document.title,document.origin,navigateSessionHistoryV4(document.session,direction),document.savedRevisionId);
