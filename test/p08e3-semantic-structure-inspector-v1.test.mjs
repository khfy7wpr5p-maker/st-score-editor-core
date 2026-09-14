import test from 'node:test';
import assert from 'node:assert/strict';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import {
  PROFESSIONAL_STRUCTURE_INSPECTOR_MIN_TOUCH_TARGET_PX,
  PROFESSIONAL_STRUCTURE_INSPECTOR_STYLE,
  createProfessionalStructureInspectorStandaloneBrowserAppRuntimeV1,
  createProfessionalStructureInspectorStandaloneScoreEditorControllerV1,
  professionalStructureInspectorBrowserAppProfile
} from '../dist/packages/score-editor-browser-professional-structure-ui-v1/src/index.js';

const xml=`<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>8</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>eighth</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>eighth</type></note>
      <note><rest/><duration>8</duration><voice>1</voice><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`;

const createController=async()=>{
  let revision=0;
  const controller=createProfessionalStructureInspectorStandaloneScoreEditorControllerV1({
    revisionIdFactory:()=>`rev:p08e3-base-${++revision}`,
    structureRevisionIdFactory:()=>`rev:p08e3-structure-${++revision}`
  });
  await controller.openMusicXml(xml,{
    documentId:'doc:p08e3',
    revisionId:'rev:p08e3-saved',
    title:'P08-E3',
    sha256Hex:async()=> '9'.repeat(64)
  });
  return controller;
};

const scoreOf=controller=>controller.getDocument().session.history.present.score;
const notationOf=controller=>controller.getDocument().session.history.present.notation;
const firstStandardMeasure=controller=>scoreOf(controller).parts[0].staves.find(staff=>staff.role==='standard').measures[0];
const firstEvent=controller=>firstStandardMeasure(controller).voices[0].events[0];
const noteAddress=controller=>addressEntityV3(scoreOf(controller),firstEvent(controller).note.id);

test('P08-E3 profile and responsive inspector remain presentation-only with semantic authority',()=>{
  assert.equal(PROFESSIONAL_STRUCTURE_INSPECTOR_MIN_TOUCH_TARGET_PX,44);
  assert.equal(professionalStructureInspectorBrowserAppProfile.professionalStructureInspectorAvailable,true);
  assert.equal(professionalStructureInspectorBrowserAppProfile.professionalStructureInspectorCanonicalAuthority,false);
  assert.equal(professionalStructureInspectorBrowserAppProfile.professionalStructureInspectorSelectionAuthority,'SemanticAddressV3-current-revision');
  assert.equal(professionalStructureInspectorBrowserAppProfile.professionalStructureInspectorMutationAuthority,'P08-D-professional-workstation');
  assert.equal(professionalStructureInspectorBrowserAppProfile.professionalStructureInspectorHistoryAuthority,'EditorHistoryV4');
  assert.equal(professionalStructureInspectorBrowserAppProfile.professionalStructureInspectorRendererCoordinateAuthority,false);
  assert.equal(professionalStructureInspectorBrowserAppProfile.professionalStructureInspectorDomAuthoringAuthority,false);
  assert.equal(professionalStructureInspectorBrowserAppProfile.professionalStructureInspectorNetworkAuthority,false);
  assert.match(PROFESSIONAL_STRUCTURE_INSPECTOR_STYLE,/min-height:44px/);
  assert.match(PROFESSIONAL_STRUCTURE_INSPECTOR_STYLE,/touch-action:manipulation/);

  const runtime=createProfessionalStructureInspectorStandaloneBrowserAppRuntimeV1();
  assert.equal(runtime.professionalStructureInspector.available,true);
  assert.deepEqual(runtime.professionalStructureInspector.staffFields,['key-signature','clef']);
  assert.deepEqual(runtime.professionalStructureInspector.frameFields,['time-signature','barline-repeat']);
  assert.equal(runtime.professionalStructureInspector.semanticSelectionOnly,true);
});

test('P08-E3 derives staff-measure and frame targets only from current semantic selection',async()=>{
  const controller=await createController();
  let state=controller.getProfessionalStructureInspectorState();
  assert.equal(state.canEditStaffStructure,false);
  assert.equal(state.canEditFrameStructure,false);

  controller.select(noteAddress(controller));
  state=controller.getProfessionalStructureInspectorState();
  assert.equal(state.selectionKind,'note');
  assert.equal(state.measureTargetId,firstStandardMeasure(controller).id);
  assert.equal(state.frameTargetId,firstStandardMeasure(controller).frameId);
  assert.equal(state.canEditStaffStructure,true);
  assert.equal(state.canEditFrameStructure,true);
  assert.deepEqual(state.keySignature,{fifths:0});
  assert.deepEqual(state.clef,{sign:'G',line:2,octaveChange:0});
  assert.deepEqual(state.timeSignature,{beats:4,beatType:4});
  assert.equal(controller.getDocument().session.history.past.length,0);
});

test('P08-E3 key, clef, meter and barline edits route through P08-D with one history step each',async()=>{
  const controller=await createController();
  controller.select(noteAddress(controller));

  let result=controller.setProfessionalKeySignature(-2);
  assert.equal(result.error,null);
  assert.equal(result.revisionId,'rev:p08e3-structure-1');
  assert.equal(controller.getDocument().session.history.past.length,1);
  assert.deepEqual(controller.getProfessionalStructureInspectorState().keySignature,{fifths:-2});

  result=controller.setProfessionalClefPreset('BASS');
  assert.equal(result.error,null);
  assert.equal(result.revisionId,'rev:p08e3-structure-2');
  assert.equal(controller.getDocument().session.history.past.length,2);
  assert.deepEqual(controller.getProfessionalStructureInspectorState().clef,{sign:'F',line:4,octaveChange:0});

  result=controller.setProfessionalTimeSignature(3,4);
  assert.equal(result.error,null);
  assert.equal(result.revisionId,'rev:p08e3-structure-3');
  assert.equal(controller.getDocument().session.history.past.length,3);
  assert.deepEqual(controller.getProfessionalStructureInspectorState().timeSignature,{beats:3,beatType:4});

  result=controller.setProfessionalBarlinePreset('REPEAT_END');
  assert.equal(result.error,null);
  assert.equal(result.revisionId,'rev:p08e3-structure-4');
  assert.equal(controller.getDocument().session.history.past.length,4);
  assert.deepEqual(controller.getProfessionalStructureInspectorState().barlines,[
    {location:'right',style:'light-heavy',repeat:'backward'}
  ]);

  const notation=notationOf(controller);
  const measureId=firstStandardMeasure(controller).id;
  const frameId=firstStandardMeasure(controller).frameId;
  assert.deepEqual(notation.measures.find(entry=>entry.target.measureId===measureId).notation,{
    keySignature:{fifths:-2},
    clef:{sign:'F',line:4,octaveChange:0}
  });
  assert.deepEqual(notation.frames.find(entry=>entry.target.frameId===frameId).notation,{
    timeSignature:{beats:3,beatType:4},
    barlines:[{location:'right',style:'light-heavy',repeat:'backward'}]
  });
});

test('P08-E3 staff-local fields fail closed when selection has no deterministic staff measure',async()=>{
  const controller=await createController();
  const score=scoreOf(controller);
  controller.select(addressEntityV3(score,score.measureFrames[0].id));
  const before=structuredClone(controller.getDocument());
  const result=controller.setProfessionalKeySignature(3);
  assert.equal(result.revisionId,'rev:p08e3-saved');
  assert.equal(controller.getProfessionalStructureInspectorState().lastError?.code,'STAFF_MEASURE_SELECTION_REQUIRED');
  assert.deepEqual(controller.getDocument(),before);
  assert.equal(controller.getDocument().session.history.past.length,0);
});

test('P08-E3 rejects invalid UI values before canonical mutation',async()=>{
  const controller=await createController();
  controller.select(noteAddress(controller));
  const before=structuredClone(controller.getDocument());

  let result=controller.setProfessionalKeySignature(8);
  assert.equal(result.revisionId,'rev:p08e3-saved');
  assert.equal(controller.getProfessionalStructureInspectorState().lastError?.code,'INVALID_KEY_SIGNATURE');
  assert.deepEqual(controller.getDocument(),before);

  result=controller.setProfessionalTimeSignature(0,3);
  assert.equal(result.revisionId,'rev:p08e3-saved');
  assert.equal(controller.getProfessionalStructureInspectorState().lastError?.code,'INVALID_TIME_SIGNATURE');
  assert.deepEqual(controller.getDocument(),before);
});
