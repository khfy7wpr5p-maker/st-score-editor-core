import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import {
  P10_3A_PITCH_CONTROL_DEFINITIONS,
  P10_3A_PITCH_CONTROL_STYLE,
  createP10_3AProfessionalWorkstationStandaloneScoreEditorControllerV1,
  p10_3aProfessionalWorkstationBrowserAppProfile
} from '../dist/packages/score-editor-browser-professional-workstation-p10-3a-v1/src/index.js';

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
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>8</duration><voice>1</voice><type>quarter</type></note>
      <note><rest/><duration>16</duration><voice>1</voice><type>half</type></note>
    </measure>
  </part>
</score-partwise>`;

const createController=async()=>{
  let revision=0;
  const controller=createP10_3AProfessionalWorkstationStandaloneScoreEditorControllerV1({
    revisionIdFactory:()=>`rev:p10-3a-ui-${++revision}`,
    professionalRevisionIdFactory:()=>`rev:p10-3a-ui-${++revision}`
  });
  await controller.openMusicXml(xml,{
    documentId:'doc:p10-3a-ui',
    revisionId:'rev:p10-3a-ui-saved',
    title:'P10-3A UI',
    sha256Hex:async()=> '6'.repeat(64)
  });
  return controller;
};

const eventsOf=controller=>controller.getDocument().session.history.present.score.parts[0].staves.find(staff=>staff.role==='standard').measures[0].voices[0].events;
const eventAddress=(controller,index)=>addressEntityV3(controller.getDocument().session.history.present.score,eventsOf(controller)[index].id);

const captureRange=(controller,start=0,stop=1)=>{
  controller.select(eventAddress(controller,start));
  controller.captureTeacherRangeStartAtSelection();
  controller.select(eventAddress(controller,stop));
};

test('P10-3A optional profile exposes pitch transpose without new canonical authority',()=>{
  assert.equal(p10_3aProfessionalWorkstationBrowserAppProfile.p10_3aWorkstationComposition,true);
  assert.equal(p10_3aProfessionalWorkstationBrowserAppProfile.p10_2QualifiedBasePreserved,true);
  assert.equal(p10_3aProfessionalWorkstationBrowserAppProfile.professionalSemitoneTransposeAvailable,true);
  assert.equal(p10_3aProfessionalWorkstationBrowserAppProfile.professionalDiatonicTransposeAvailable,true);
  assert.equal(p10_3aProfessionalWorkstationBrowserAppProfile.professionalPitchTransposeCanonicalAuthority,false);
  assert.equal(p10_3aProfessionalWorkstationBrowserAppProfile.professionalPitchTransposeHistoryAuthority,'EditorHistoryV4');
  assert.equal(p10_3aProfessionalWorkstationBrowserAppProfile.professionalPitchTransposeRendererCoordinateAuthority,false);
  assert.equal(p10_3aProfessionalWorkstationBrowserAppProfile.professionalPitchTransposeDomAuthoringAuthority,false);
  assert.equal(p10_3aProfessionalWorkstationBrowserAppProfile.productionDefault,false);
});

test('P10-3A defines four bounded presentation-only pitch controls with 44px touch targets',()=>{
  assert.deepEqual(
    P10_3A_PITCH_CONTROL_DEFINITIONS.map(item=>[item.action,item.label,item.mode,item.interval]),
    [
      ['transpose-down-semitone','−½','SEMITONE',-1],
      ['transpose-up-semitone','+½','SEMITONE',1],
      ['transpose-down-step','−Step','DIATONIC',-1],
      ['transpose-up-step','+Step','DIATONIC',1]
    ]
  );
  assert.match(P10_3A_PITCH_CONTROL_STYLE,/min-height:44px/);
  assert.match(P10_3A_PITCH_CONTROL_STYLE,/touch-action:manipulation/);
});

test('P10-3A semitone action derives targets from current semantic teacher range and clears it after commit',async()=>{
  const controller=await createController();
  captureRange(controller,0,1);
  assert.equal(controller.getProfessionalRangeToolbarState().rangeReady,true);

  const result=controller.transposeProfessionalRangeBySemitones(1);
  assert.equal(result.error,null);
  assert.equal(controller.getDocument().session.history.past.length,1);
  assert.equal(controller.getProfessionalRangeToolbarState().rangeReady,false);
  assert.equal(controller.getProfessionalRangeToolbarState().rangeStartEventId,null);
  assert.deepEqual(eventsOf(controller).slice(0,2).map(event=>event.note.pitch),[
    {step:'C',alter:1,octave:4},
    {step:'D',alter:1,octave:4}
  ]);
  assert.deepEqual(eventsOf(controller)[2].note.pitch,{step:'E',alter:0,octave:4});
});

test('P10-3A diatonic action derives targets from current semantic teacher range',async()=>{
  const controller=await createController();
  captureRange(controller,0,1);

  const result=controller.transposeProfessionalRangeDiatonically(1);
  assert.equal(result.error,null);
  assert.equal(controller.getDocument().session.history.past.length,1);
  assert.deepEqual(eventsOf(controller).slice(0,2).map(event=>event.note.pitch),[
    {step:'D',alter:0,octave:4},
    {step:'E',alter:0,octave:4}
  ]);
});

test('P10-3A incomplete range fails closed without history mutation',async()=>{
  const controller=await createController();
  const before=structuredClone(controller.getDocument());

  const result=controller.transposeProfessionalRangeBySemitones(1);
  assert.equal(result.error?.code,'RANGE_NOT_READY');
  assert.deepEqual(controller.getDocument(),before);
  assert.equal(controller.getDocument().session.history.past.length,0);
  assert.equal(controller.getP10_3APitchTransposeState().lastError?.code,'RANGE_NOT_READY');
});
