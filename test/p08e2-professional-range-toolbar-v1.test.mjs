import test from 'node:test';
import assert from 'node:assert/strict';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import {
  PROFESSIONAL_RANGE_TOOLBAR_MIN_TOUCH_TARGET_PX,
  PROFESSIONAL_RANGE_TOOLBAR_STYLE,
  createProfessionalRangeToolbarStandaloneBrowserAppRuntimeV1,
  createProfessionalRangeToolbarStandaloneScoreEditorControllerV1,
  professionalRangeToolbarBrowserAppProfile
} from '../dist/packages/score-editor-browser-professional-ui-v1/src/index.js';

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
  const controller=createProfessionalRangeToolbarStandaloneScoreEditorControllerV1({
    revisionIdFactory:()=>`rev:p08e2-teacher-${++revision}`,
    professionalRevisionIdFactory:()=>`rev:p08e2-prof-${++revision}`
  });
  await controller.openMusicXml(xml,{
    documentId:'doc:p08e2',
    revisionId:'rev:p08e2-saved',
    title:'P08-E2',
    sha256Hex:async()=> '8'.repeat(64)
  });
  return controller;
};

const eventsOf=controller=>controller.getDocument().session.history.present.score.parts[0].staves.find(staff=>staff.role==='standard').measures[0].voices[0].events;
const eventAddress=(controller,index)=>addressEntityV3(controller.getDocument().session.history.present.score,eventsOf(controller)[index].id);
const noteAddress=(controller,index)=>addressEntityV3(controller.getDocument().session.history.present.score,eventsOf(controller)[index].note.id);

test('P08-E2 profile keeps visible professional range UI presentation-only and semantic-authority-only',()=>{
  assert.equal(PROFESSIONAL_RANGE_TOOLBAR_MIN_TOUCH_TARGET_PX,44);
  assert.equal(professionalRangeToolbarBrowserAppProfile.professionalWorkstationIntegrated,true);
  assert.equal(professionalRangeToolbarBrowserAppProfile.professionalRangeToolbarAvailable,true);
  assert.equal(professionalRangeToolbarBrowserAppProfile.professionalRangeToolbarCanonicalAuthority,false);
  assert.equal(professionalRangeToolbarBrowserAppProfile.professionalRangeToolbarSelectionAuthority,'SemanticAddressV3-current-revision');
  assert.equal(professionalRangeToolbarBrowserAppProfile.professionalRangeToolbarMutationAuthority,'P08-D-professional-workstation');
  assert.equal(professionalRangeToolbarBrowserAppProfile.professionalRangeToolbarHistoryAuthority,'EditorHistoryV4');
  assert.equal(professionalRangeToolbarBrowserAppProfile.professionalRangeToolbarRendererCoordinateAuthority,false);
  assert.equal(professionalRangeToolbarBrowserAppProfile.professionalRangeToolbarDomAuthoringAuthority,false);
  assert.equal(professionalRangeToolbarBrowserAppProfile.professionalRangeToolbarNetworkAuthority,false);
  assert.match(PROFESSIONAL_RANGE_TOOLBAR_STYLE,/min-height:44px/);
  assert.match(PROFESSIONAL_RANGE_TOOLBAR_STYLE,/touch-action:manipulation/);
  assert.match(PROFESSIONAL_RANGE_TOOLBAR_STYLE,/@media\(max-width:760px\)/);

  const runtime=createProfessionalRangeToolbarStandaloneBrowserAppRuntimeV1();
  assert.equal(runtime.professionalRangeToolbar.available,true);
  assert.equal(runtime.professionalRangeToolbar.semanticSelectionOnly,true);
  assert.equal(runtime.professionalRangeToolbar.historyAuthority,'EditorHistoryV4');
  assert.equal(runtime.professionalRangeToolbar.rendererCoordinateAuthority,false);
});

test('P08-E2 range readiness derives only from current semantic teacher range state',async()=>{
  const controller=await createController();
  let state=controller.getProfessionalRangeToolbarState();
  assert.equal(state.rangeReady,false);
  assert.equal(state.canClearToRest,false);

  controller.select(eventAddress(controller,0));
  controller.captureTeacherRangeStartAtSelection();
  state=controller.getProfessionalRangeToolbarState();
  assert.equal(state.rangeStartEventId,eventsOf(controller)[0].id);
  assert.equal(state.rangeStopEventId,null);
  assert.equal(state.rangeReady,false);

  controller.select(noteAddress(controller,1));
  state=controller.getProfessionalRangeToolbarState();
  assert.equal(state.rangeStopEventId,eventsOf(controller)[1].id);
  assert.equal(state.rangeReady,true);
  assert.equal(state.canClearToRest,true);
  assert.equal(state.canTransposeRange,true);
  assert.equal(controller.getDocument().session.history.past.length,0);
});

test('P08-E2 Clear routes the semantic range through P08-D and creates exactly one history revision',async()=>{
  const controller=await createController();
  controller.select(eventAddress(controller,0));
  controller.captureTeacherRangeStartAtSelection();
  controller.select(eventAddress(controller,1));

  const before=structuredClone(eventsOf(controller).slice(0,2));
  const result=controller.clearProfessionalRangeToRest();
  assert.equal(result.error,null);
  assert.equal(result.revisionId,'rev:p08e2-prof-1');
  assert.equal(controller.getDocument().session.history.past.length,1);

  const after=eventsOf(controller).slice(0,2);
  assert.deepEqual(after.map(event=>event.kind),['rest','rest']);
  assert.deepEqual(after.map(event=>event.id),before.map(event=>event.id));
  assert.deepEqual(after.map(event=>event.onset),before.map(event=>event.onset));
  assert.deepEqual(after.map(event=>event.duration),before.map(event=>event.duration));
  assert.equal(controller.getMobileTeacherToolbarState().rangeStartEventId,null);
  assert.equal(controller.getProfessionalRangeToolbarState().rangeReady,false);
  assert.equal(controller.getProfessionalRangeToolbarState().professionalSelectionKind,null);

  controller.undo();
  assert.equal(controller.getDocument().session.history.present.score.revision.id,'rev:p08e2-saved');
  assert.deepEqual(eventsOf(controller).slice(0,2).map(event=>event.kind),['note','note']);
});

test('P08-E2 professional transpose uses one revision and clears transient UI range after commit',async()=>{
  const controller=await createController();
  controller.select(eventAddress(controller,0));
  controller.captureTeacherRangeStartAtSelection();
  controller.select(eventAddress(controller,1));

  const result=controller.transposeProfessionalRangeByOctaves(1);
  assert.equal(result.error,null);
  assert.equal(result.revisionId,'rev:p08e2-prof-1');
  assert.equal(eventsOf(controller)[0].note.pitch.octave,5);
  assert.equal(eventsOf(controller)[1].note.pitch.octave,5);
  assert.equal(eventsOf(controller)[2].note.pitch.octave,4);
  assert.equal(controller.getDocument().session.history.past.length,1);
  assert.equal(controller.getProfessionalRangeToolbarState().rangeStartEventId,null);
  assert.equal(controller.getProfessionalRangeToolbarState().professionalSelectionKind,null);
});

test('P08-E2 incomplete range fails closed without canonical mutation',async()=>{
  const controller=await createController();
  const before=structuredClone(controller.getDocument());
  let result=controller.clearProfessionalRangeToRest();
  assert.equal(result.revisionId,'rev:p08e2-saved');
  assert.equal(controller.getProfessionalRangeToolbarState().lastError?.code,'RANGE_NOT_READY');
  assert.deepEqual(controller.getDocument(),before);

  controller.select(eventAddress(controller,0));
  controller.captureTeacherRangeStartAtSelection();
  result=controller.clearProfessionalRangeToRest();
  assert.equal(result.revisionId,'rev:p08e2-saved');
  assert.equal(controller.getProfessionalRangeToolbarState().lastError?.code,'RANGE_NOT_READY');
  assert.equal(controller.getDocument().session.history.past.length,0);
});
