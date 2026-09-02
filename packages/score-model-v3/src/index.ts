import { validateScoreDocumentV2, type GraceGroup, type VoiceV2 } from '../../score-model-v2/src/index.js';
import type { EntityId, Pitch, RevisionIdentity, SourceIdentity } from '../../score-model/src/index.js';

export const SCORE_DOCUMENT_V3_SCHEMA_VERSION='3.0.0' as const;
export type StaffRoleV3='standard'|'percussion'|'tablature-linked';
export interface MeasureFrameV3 { readonly id:EntityId; readonly ordinal:number; readonly displayNumber:string|null }
export interface InstrumentIdentityV3 { readonly id:EntityId; readonly name:string|null; readonly shortName:string|null }
export interface StaffMeasureV3 { readonly id:EntityId; readonly frameId:EntityId; readonly voices:readonly VoiceV2[] }
export interface ContentStaffV3 { readonly id:EntityId; readonly ordinal:number; readonly role:'standard'|'percussion'; readonly measures:readonly StaffMeasureV3[] }
export interface TabTuningStringV3 { readonly stringNumber:number; readonly openPitch:Pitch }
export interface TabProfileV3 { readonly stringCount:number; readonly tuning:readonly TabTuningStringV3[]; readonly capoFret:number }
export interface LinkedTablatureStaffV3 { readonly id:EntityId; readonly ordinal:number; readonly role:'tablature-linked'; readonly sourceStaffId:EntityId; readonly tabProfile:TabProfileV3; readonly measures:readonly [] }
export type StaffV3=ContentStaffV3|LinkedTablatureStaffV3;
export interface PartV3 { readonly id:EntityId; readonly ordinal:number; readonly name:string|null; readonly instrument:InstrumentIdentityV3; readonly staves:readonly StaffV3[] }
export interface ScoreDocumentV3 { readonly schemaVersion:typeof SCORE_DOCUMENT_V3_SCHEMA_VERSION; readonly id:EntityId; readonly revision:RevisionIdentity; readonly source:SourceIdentity; readonly measureFrames:readonly MeasureFrameV3[]; readonly parts:readonly PartV3[] }

export type ScoreDocumentV3IssueCode='TYPE'|'SCHEMA_VERSION'|'UNKNOWN_FIELD'|'INVALID_ID'|'DUPLICATE_ID'|'INVALID_ORDINAL'|'FRAME_ALIGNMENT'|'INVALID_INSTRUMENT'|'INVALID_STAFF_ROLE'|'INVALID_TAB_PROFILE'|'INVALID_TAB_LINK'|'V2_CONTENT_INVALID';
export interface ScoreDocumentV3Issue { readonly code:ScoreDocumentV3IssueCode; readonly path:string; readonly message:string }
export interface ScoreDocumentV3ValidationResult { readonly ok:boolean; readonly issues:readonly ScoreDocumentV3Issue[] }
export class ScoreDocumentV3ValidationError extends Error { readonly issues:readonly ScoreDocumentV3Issue[]; constructor(issues:readonly ScoreDocumentV3Issue[]){super(`ScoreDocumentV3 validation failed with ${issues.length} issue(s)`);this.name='ScoreDocumentV3ValidationError';this.issues=Object.freeze([...issues]);} }

const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const rec=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:unknown,keys:readonly string[])=>rec(v)&&JSON.stringify(Object.keys(v).sort())===JSON.stringify([...keys].sort());
const validPitch=(v:unknown):v is Pitch=>exact(v,['step','alter','octave'])&&typeof v.step==='string'&&['A','B','C','D','E','F','G'].includes(v.step)&&Number.isInteger(v.alter)&&Number(v.alter)>=-2&&Number(v.alter)<=2&&Number.isInteger(v.octave)&&Number(v.octave)>=-1&&Number(v.octave)<=9;
const issue=(issues:ScoreDocumentV3Issue[],code:ScoreDocumentV3IssueCode,path:string,message:string)=>issues.push({code,path,message});
const id=(v:unknown,path:string,issues:ScoreDocumentV3Issue[],ids:Set<string>):v is string=>{if(typeof v!=='string'||!ID.test(v)){issue(issues,'INVALID_ID',path,'must be a stable 1..128 character id');return false;}if(ids.has(v)){issue(issues,'DUPLICATE_ID',path,`duplicate entity id: ${v}`);return false;}ids.add(v);return true;};
const ordinal=(v:unknown,expected:number,path:string,issues:ScoreDocumentV3Issue[])=>{if(!Number.isSafeInteger(v)||v!==expected)issue(issues,'INVALID_ORDINAL',path,`must equal contiguous ordinal ${expected}`);};
const nullableName=(v:unknown)=>v===null||(typeof v==='string'&&v.length<=256&&v===v.trim());
const clone=<T>(v:T):T=>Array.isArray(v)?v.map(item=>clone(item)) as T:rec(v)?Object.fromEntries(Object.entries(v).map(([k,item])=>[k,clone(item)])) as T:v;
const freeze=<T>(v:T):Readonly<T>=>{if(v&&typeof v==='object'){Object.freeze(v);for(const item of Object.values(v as Record<string,unknown>))if(item&&typeof item==='object'&&!Object.isFrozen(item))freeze(item);}return v as Readonly<T>;};

export const validateScoreDocumentV3=(value:unknown):ScoreDocumentV3ValidationResult=>{
  const issues:ScoreDocumentV3Issue[]=[];const ids=new Set<string>();
  if(!exact(value,['schemaVersion','id','revision','source','measureFrames','parts']))return {ok:false,issues:Object.freeze([{code:'TYPE',path:'$',message:'ScoreDocumentV3 field set is invalid'}])};
  if(value.schemaVersion!==SCORE_DOCUMENT_V3_SCHEMA_VERSION)issue(issues,'SCHEMA_VERSION','$.schemaVersion','must equal 3.0.0');
  id(value.id,'$.id',issues,ids);
  if(!exact(value.revision,['id','parentId'])||typeof value.revision.id!=='string'||(value.revision.parentId!==null&&typeof value.revision.parentId!=='string'))issue(issues,'TYPE','$.revision','revision shape is invalid');
  if(!exact(value.source,['sha256','format','byteLength']))issue(issues,'TYPE','$.source','source shape is invalid');
  if(!Array.isArray(value.measureFrames)||value.measureFrames.length===0)issue(issues,'FRAME_ALIGNMENT','$.measureFrames','at least one measure frame is required');
  const frames=Array.isArray(value.measureFrames)?value.measureFrames:[];const frameIds:string[]=[];
  frames.forEach((raw,index)=>{const p=`$.measureFrames[${index}]`;if(!exact(raw,['id','ordinal','displayNumber'])){issue(issues,'TYPE',p,'MeasureFrameV3 field set is invalid');return;}if(id(raw.id,`${p}.id`,issues,ids))frameIds.push(raw.id);ordinal(raw.ordinal,index+1,`${p}.ordinal`,issues);if(raw.displayNumber!==null&&typeof raw.displayNumber!=='string')issue(issues,'TYPE',`${p}.displayNumber`,'must be string or null');});
  if(!Array.isArray(value.parts)||value.parts.length===0)issue(issues,'TYPE','$.parts','at least one part is required');
  const parts=Array.isArray(value.parts)?value.parts:[];const projectedParts:unknown[]=[];
  parts.forEach((rawPart,pi)=>{const pp=`$.parts[${pi}]`;if(!exact(rawPart,['id','ordinal','name','instrument','staves'])){issue(issues,'TYPE',pp,'PartV3 field set is invalid');return;}id(rawPart.id,`${pp}.id`,issues,ids);ordinal(rawPart.ordinal,pi+1,`${pp}.ordinal`,issues);if(!nullableName(rawPart.name))issue(issues,'TYPE',`${pp}.name`,'part name is invalid');
    if(!exact(rawPart.instrument,['id','name','shortName']))issue(issues,'INVALID_INSTRUMENT',`${pp}.instrument`,'instrument field set is invalid');else{id(rawPart.instrument.id,`${pp}.instrument.id`,issues,ids);if(!nullableName(rawPart.instrument.name)||!nullableName(rawPart.instrument.shortName))issue(issues,'INVALID_INSTRUMENT',`${pp}.instrument`,'instrument names are invalid');}
    if(!Array.isArray(rawPart.staves)||rawPart.staves.length===0){issue(issues,'INVALID_STAFF_ROLE',`${pp}.staves`,'part requires at least one staff');return;}
    const contentProjected:unknown[]=[];const staffIds=new Set<string>();const standardIds=new Set<string>();
    rawPart.staves.forEach((rawStaff,si)=>{const sp=`${pp}.staves[${si}]`;if(!rec(rawStaff)||typeof rawStaff.role!=='string'){issue(issues,'INVALID_STAFF_ROLE',sp,'staff is invalid');return;}ordinal(rawStaff.ordinal,si+1,`${sp}.ordinal`,issues);if(id(rawStaff.id,`${sp}.id`,issues,ids)){staffIds.add(rawStaff.id);if(rawStaff.role==='standard')standardIds.add(rawStaff.id);}
      if(rawStaff.role==='standard'||rawStaff.role==='percussion'){
        if(!exact(rawStaff,['id','ordinal','role','measures'])){issue(issues,'INVALID_STAFF_ROLE',sp,'content staff field set is invalid');return;}if(!Array.isArray(rawStaff.measures)||rawStaff.measures.length!==frames.length){issue(issues,'FRAME_ALIGNMENT',`${sp}.measures`,'content staff must contain exactly one measure per frame');return;}
        const projectedMeasures=rawStaff.measures.map((rawMeasure,mi)=>{const mp=`${sp}.measures[${mi}]`;if(!exact(rawMeasure,['id','frameId','voices'])){issue(issues,'FRAME_ALIGNMENT',mp,'StaffMeasureV3 field set is invalid');return null;}id(rawMeasure.id,`${mp}.id`,issues,ids);if(rawMeasure.frameId!==frameIds[mi])issue(issues,'FRAME_ALIGNMENT',`${mp}.frameId`,'staff measure must reference the frame at the same ordinal');return {id:rawMeasure.id,ordinal:mi+1,displayNumber:rec(frames[mi])?frames[mi]?.displayNumber:null,voices:rawMeasure.voices};});
        contentProjected.push({id:rawStaff.id,ordinal:si+1,measures:projectedMeasures});
      }else if(rawStaff.role==='tablature-linked'){
        if(!exact(rawStaff,['id','ordinal','role','sourceStaffId','tabProfile','measures'])){issue(issues,'INVALID_STAFF_ROLE',sp,'linked TAB staff field set is invalid');return;}if(!Array.isArray(rawStaff.measures)||rawStaff.measures.length!==0)issue(issues,'INVALID_TAB_LINK',`${sp}.measures`,'linked TAB staff must own no measures');
        if(typeof rawStaff.sourceStaffId!=='string')issue(issues,'INVALID_TAB_LINK',`${sp}.sourceStaffId`,'sourceStaffId is invalid');
        const tp=rawStaff.tabProfile;if(!exact(tp,['stringCount','tuning','capoFret']))issue(issues,'INVALID_TAB_PROFILE',`${sp}.tabProfile`,'TAB profile field set is invalid');else{const count=tp.stringCount;if(!Number.isSafeInteger(count)||Number(count)<1||Number(count)>16)issue(issues,'INVALID_TAB_PROFILE',`${sp}.tabProfile.stringCount`,'stringCount must be 1..16');if(!Number.isSafeInteger(tp.capoFret)||Number(tp.capoFret)<0||Number(tp.capoFret)>36)issue(issues,'INVALID_TAB_PROFILE',`${sp}.tabProfile.capoFret`,'capoFret must be 0..36');if(!Array.isArray(tp.tuning)||tp.tuning.length!==count)issue(issues,'INVALID_TAB_PROFILE',`${sp}.tabProfile.tuning`,'tuning must contain one entry per string');else tp.tuning.forEach((t,ti)=>{if(!exact(t,['stringNumber','openPitch'])||t.stringNumber!==ti+1||!validPitch(t.openPitch))issue(issues,'INVALID_TAB_PROFILE',`${sp}.tabProfile.tuning[${ti}]`,'tuning string must use explicit contiguous string numbers and valid pitch');});}
      }else issue(issues,'INVALID_STAFF_ROLE',`${sp}.role`,'unsupported staff role');
    });
    rawPart.staves.forEach((rawStaff,si)=>{if(rec(rawStaff)&&rawStaff.role==='tablature-linked'&&(!standardIds.has(String(rawStaff.sourceStaffId))||rawStaff.sourceStaffId===rawStaff.id))issue(issues,'INVALID_TAB_LINK',`${pp}.staves[${si}].sourceStaffId`,'linked TAB source must be a standard staff in the same part');});
    if(contentProjected.length===0)issue(issues,'INVALID_STAFF_ROLE',`${pp}.staves`,'part requires at least one content-bearing staff');
    projectedParts.push({id:rawPart.id,name:rawPart.name,staves:contentProjected});
  });
  if(issues.some(x=>x.code==='TYPE'||x.code==='FRAME_ALIGNMENT'||x.code==='INVALID_STAFF_ROLE'))return {ok:false,issues:Object.freeze(issues)};
  const projection={schemaVersion:'2.0.0',id:value.id,revision:value.revision,source:value.source,parts:projectedParts};const base=validateScoreDocumentV2(projection);for(const item of base.issues)issue(issues,'V2_CONTENT_INVALID',item.path,`${item.code}: ${item.message}`);
  return {ok:issues.length===0,issues:Object.freeze(issues)};
};

export const createScoreDocumentV3=(input:ScoreDocumentV3):Readonly<ScoreDocumentV3>=>{const value=clone(input) as ScoreDocumentV3;const result=validateScoreDocumentV3(value);if(!result.ok)throw new ScoreDocumentV3ValidationError(result.issues);return freeze(value);};
export const contentStavesV3=(part:PartV3):readonly ContentStaffV3[]=>part.staves.filter((staff):staff is ContentStaffV3=>staff.role==='standard'||staff.role==='percussion');
export const graceGroupsV3=(measure:StaffMeasureV3):readonly GraceGroup[]=>measure.voices.flatMap(voice=>voice.graceGroups);
