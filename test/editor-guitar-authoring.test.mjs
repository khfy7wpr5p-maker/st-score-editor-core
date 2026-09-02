import test from 'node:test';
import assert from 'node:assert/strict';
import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { addressEntity } from '../dist/packages/addressing/src/index.js';
import { createNotationDocument } from '../dist/packages/notation-structure/src/index.js';
import { createGuitarWorkspaceResult, GuitarWorkspaceResultError } from '../dist/packages/guitar-workspace-result/src/index.js';
import {
  createGuitarAuthoringCompanion,
  executeCanonicalAuthoringWithGuitarInvalidation,
  guitarAuthoringAuthorityProfile
} from '../dist/packages/editor-guitar-authoring/src/index.js';

const score=(revisionId='rev-1',parentId=null)=>createScoreDocument({schemaVersion:'1.0.0',id:'doc-guitar',revision:{id:revisionId,parentId},source:{sha256:'a'.repeat(64),format:'synthetic',byteLength:null},parts:[{id:'part-1',name:'Guitar',staves:[{id:'staff-1',ordinal:1,measures:[{id:'measure-1',ordinal:1,displayNumber:'1',voices:[{id:'voice-1',ordinal:1,events:[{id:'event-1',kind:'note',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:4},note:{id:'note-1',pitch:{step:'E',alter:0,octave:4}}}]}]}]}]}]});
const notation=(s)=>createNotationDocument(s,{contractVersion:'1.0.0',documentId:s.id,revisionId:s.revision.id,measures:[{target:addressEntity(s,'measure-1'),notation:{timeSignature:{beats:4,beatType:4},keySignature:null,clef:null,barlines:[]}}],events:[],notes:[]});
const tuning=[{number:1,pitch:'E4',midi:64},{number:2,pitch:'B3',midi:59},{number:3,pitch:'G3',midi:55},{number:4,pitch:'D3',midi:50},{number:5,pitch:'A2',midi:45},{number:6,pitch:'E2',midi:40}];
const result=()=>({documentType:'CanonicalTabResult',schemaVersion:'2.0.0',engine:{name:'musicxml-to-guitar-tab-engine',version:'test'},source:{documentType:'PolyphonicSourceModel',contractVersion:'1.0.0',format:'score-partwise',musicXmlVersion:'4.0',partId:'P1'},review:{teacherReviewStatus:'APPROVED'},guitar:{contractVersion:'1.0.0',tuning,minimumFret:0,maximumFret:20},policyProvenance:{arrangement:{documentType:'GuitarArrangementPlan',contractVersion:'1.0.0'},reduction:{documentType:'DeterministicReductionPlan',contractVersion:'1.0.0',policy:'STANDARD_GUITAR_REGISTER_20_FRET_1.0',octaveTieBreak:'DOWNWARD_TIE_BREAK_1.0'},voicing:{documentType:'GuitarVoicingCandidateModel',contractVersion:'1.0.0',policy:'STANDARD_SIX_STRING_DISTINCT_STRING_1.0'},leftHand:{documentType:'LeftHandShapeModel',contractVersion:'1.0.0',policy:'ORDERED_FRET_FINGER_BARRE_1.0'},physicalValidation:{documentType:'PhysicalPlayabilityValidation',contractVersion:'2.0.0',policy:'CONSERVATIVE_STATIC_LEFT_HAND_2.0',configuration:{maximumStaticFretSpan:4,maximumExtraFretReach:1}},finalSelection:{policyId:'STATIC_ATTACK_PATH_LEXICOGRAPHIC_1.0',policyVersion:'1.0.0'}},measures:[{measureId:'P1:measure:0',index:0,number:'1',implicit:false,divisions:1,timeSignature:{beats:4,beatType:4},expectedDurationDivisions:4,events:[{sourceEventId:'P1:measure:0:note:0',sourceOrder:0,type:'note',voice:'1',staff:1,onsetDivisions:0,durationDivisions:1,pitch:{step:'E',alter:0,octave:4,midi:64,written:'E4'},tieStart:false,tieStop:false,source:{partId:'P1',measureIndex:0,measureNumber:'1',noteIndex:0,chordWithPrevious:false}}]}],simultaneousGroups:[],arrangementDecisions:[{decisionId:'P1:arrangement-decision:0',decisionType:'PRESERVED',sourceEventIds:['P1:measure:0:note:0'],sourceGroupId:null}],noteDispositions:[{sourceEventId:'P1:measure:0:note:0',decisionId:'P1:arrangement-decision:0',disposition:'KEEP',targetPitch:{step:'E',alter:0,octave:4,midi:64,written:'E4'},octaveShiftSemitones:0,ruleId:'PRESERVE_IN_REGISTER',selectedPosition:{string:1,fret:0},selectedShapeId:null}],selectedShapes:[]});

test('SEC-NE-08 companion exposes only revision-bound derivative guitar annotations',()=>{
  const s=score(),n=notation(s),json=JSON.stringify(result());const companion=createGuitarAuthoringCompanion(s,n,json);
  assert.equal(companion.documentId,s.id);assert.equal(companion.revisionId,s.revision.id);assert.equal(companion.teacherReviewStatus,'APPROVED');
  assert.deepEqual(companion.annotations[0].position,{string:1,fret:0});assert.equal(companion.annotations[0].finger,0);
  assert.equal(guitarAuthoringAuthorityProfile.guitarStateAuthority,'DERIVATIVE_ONLY');assert.equal(guitarAuthoringAuthorityProfile.reverseWriteFromGuitarResult,false);assert.equal(guitarAuthoringAuthorityProfile.teacherReviewGrantsWriteAuthority,false);assert.equal(guitarAuthoringAuthorityProfile.engineInvocation,false);
});

test('canonical edit uses Editor Core authority and invalidates the current guitar result',()=>{
  const s=score(),n=notation(s),json=JSON.stringify(result());
  const transaction={contractVersion:'1.0.0',transactionId:'tx-1',documentId:s.id,baseRevisionId:s.revision.id,nextRevisionId:'rev-2',commands:[{commandVersion:'1.0.0',commandId:'cmd-1',type:'SET_NOTE_PITCH',target:addressEntity(s,'note-1'),pitch:{step:'F',alter:0,octave:4}}]};
  const out=executeCanonicalAuthoringWithGuitarInvalidation(s,n,null,json,transaction);
  assert.equal(out.score.revision.id,'rev-2');assert.equal(out.score.parts[0].staves[0].measures[0].voices[0].events[0].note.pitch.step,'F');
  assert.deepEqual(out.guitar,{contractVersion:'1.0.0',status:'REQUIRES_RECOMPUTE',documentId:s.id,sourceRevisionId:'rev-1',currentRevisionId:'rev-2',reason:'CANONICAL_SCORE_CHANGED'});
  assert.throws(()=>createGuitarWorkspaceResult(out.score,out.notation,json),(error)=>error instanceof GuitarWorkspaceResultError&&error.code==='SOURCE_FACT_MISMATCH');
});
