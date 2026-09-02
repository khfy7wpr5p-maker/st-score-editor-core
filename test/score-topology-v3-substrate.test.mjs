import test from 'node:test';
import assert from 'node:assert/strict';
import { createScoreDocumentV2 } from '../dist/packages/score-model-v2/src/index.js';
import { createNotationDocumentV2 } from '../dist/packages/notation-structure-v2/src/index.js';
import { addressEntityV2 } from '../dist/packages/addressing-v2/src/index.js';
import { createScoreDocumentV3, ScoreDocumentV3ValidationError } from '../dist/packages/score-model-v3/src/index.js';
import { addressEntityV3, resolveSemanticAddressV3 } from '../dist/packages/addressing-v3/src/index.js';
import { migrateScoreNotationV2ToV3, downgradeScoreNotationV3ToV2, MigrationV2V3Error } from '../dist/packages/schema-migration-v2-v3/src/index.js';

const event=(id)=>({id,kind:'rest',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:4}});
const measure=(id,ordinal,display,voiceId,eventId)=>({id,ordinal,displayNumber:display,voices:[{id:voiceId,ordinal:1,events:[event(eventId)],graceGroups:[]}]});
const raw=()=>({schemaVersion:'2.0.0',id:'doc-topology',revision:{id:'rev-1',parentId:null},source:{sha256:'d'.repeat(64),format:'synthetic',byteLength:null},parts:[{id:'part-1',name:'Guitar',staves:[{id:'staff-1',ordinal:1,measures:[measure('m1s1',1,'1','v1s1','e1s1'),measure('m2s1',2,'2','v2s1','e2s1')]},{id:'staff-2',ordinal:2,measures:[measure('m1s2',1,'1','v1s2','e1s2'),measure('m2s2',2,'2','v2s2','e2s2')]}]}]});
const notation=(score)=>createNotationDocumentV2(score,{contractVersion:'2.0.0',documentId:score.id,revisionId:score.revision.id,measures:[
 {target:addressEntityV2(score,'m1s1'),notation:{timeSignature:{beats:4,beatType:4},keySignature:{fifths:0},clef:{sign:'G',line:2,octaveChange:0},barlines:[]}},
 {target:addressEntityV2(score,'m1s2'),notation:{timeSignature:{beats:4,beatType:4},keySignature:{fifths:0},clef:{sign:'F',line:4,octaveChange:0},barlines:[]}}
],events:[],notes:[],graceEvents:[],graceNotes:[]});

test('SSE-09 migrates aligned v2 topology into explicit frames, part ordinals and stable instrument identity',()=>{const score=createScoreDocumentV2(raw());const migrated=migrateScoreNotationV2ToV3(score,notation(score));assert.equal(migrated.score.schemaVersion,'3.0.0');assert.deepEqual(migrated.score.measureFrames.map(f=>[f.ordinal,f.displayNumber]),[[1,'1'],[2,'2']]);assert.equal(migrated.score.parts[0].ordinal,1);assert.equal(migrated.score.parts[0].instrument.name,'Guitar');assert.deepEqual(migrated.score.parts[0].staves.map(s=>s.role),['standard','standard']);assert.equal(migrated.notation.frames.length,1);assert.equal(migrated.notation.frames[0].notation.timeSignature.beats,4);assert.deepEqual(migrated.notation.measures.map(e=>e.notation.clef?.sign),['G','F']);});

test('SSE-09 v3 addressing carries explicit frame identity and linked descendants remain exact',()=>{const score=createScoreDocumentV2(raw());const migrated=migrateScoreNotationV2ToV3(score,notation(score));const frame=addressEntityV3(migrated.score,migrated.score.measureFrames[0].id);assert.equal(frame.kind,'measure-frame');const measureAddress=addressEntityV3(migrated.score,'m1s1');assert.equal(measureAddress.kind,'measure');assert.equal(measureAddress.frameId,migrated.score.measureFrames[0].id);assert.equal(resolveSemanticAddressV3(migrated.score,measureAddress).value.id,'m1s1');});

test('SSE-09 rejects misaligned v2 staff measure sequences rather than repairing them',()=>{const broken=raw();broken.parts[0].staves[1].measures[1].displayNumber='X';const score=createScoreDocumentV2(broken);assert.throws(()=>migrateScoreNotationV2ToV3(score,notation(score)),e=>e instanceof MigrationV2V3Error&&e.code==='TOPOLOGY_MISALIGNED');});

test('SSE-09 clean migrated topology downgrades losslessly to v2',()=>{const score=createScoreDocumentV2(raw());const sourceNotation=notation(score);const v3=migrateScoreNotationV2ToV3(score,sourceNotation);const back=downgradeScoreNotationV3ToV2(v3.score,v3.notation);assert.deepEqual(back.score,score);assert.deepEqual(back.notation,sourceNotation);});

test('SSE-09 linked TAB staff must resolve to a standard staff in the same part and owns no measures',()=>{const score=createScoreDocumentV2(raw());const v3=migrateScoreNotationV2ToV3(score,notation(score));const candidate=structuredClone(v3.score);candidate.parts[0].staves.push({id:'tab-1',ordinal:3,role:'tablature-linked',sourceStaffId:'staff-1',tabProfile:{stringCount:6,tuning:[['E',4],['B',3],['G',3],['D',3],['A',2],['E',2]].map(([step,octave],i)=>({stringNumber:i+1,openPitch:{step,alter:0,octave}})),capoFret:0},measures:[]});const valid=createScoreDocumentV3(candidate);assert.equal(valid.parts[0].staves[2].role,'tablature-linked');const broken=structuredClone(candidate);broken.parts[0].staves[2].sourceStaffId='staff-2';broken.parts[0].staves[1].role='percussion';assert.throws(()=>createScoreDocumentV3(broken),e=>e instanceof ScoreDocumentV3ValidationError);});
