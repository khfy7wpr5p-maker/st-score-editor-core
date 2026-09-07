import test from 'node:test';
import assert from 'node:assert/strict';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import {
  createMobileTeacherViewportStandaloneBrowserAppRuntime,
  createMobileTeacherViewportStandaloneScoreEditorController,
  mobileTeacherViewportBrowserAppProfile
} from '../dist/packages/score-editor-browser-app/src/mobile-teacher-viewport.js';
import {
  createViewportPresentationLayer,
  VIEWPORT_ZOOM_STEP
} from '../dist/packages/score-editor-browser-app/src/viewport-presentation.js';

const xml=`<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
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
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>8</duration><voice>1</voice><type>quarter</type></note>
      <note><rest/><duration>8</duration><voice>1</voice><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`;

const createController=async()=>{
  let revision=0;
  const controller=createMobileTeacherViewportStandaloneScoreEditorController({
    revisionIdFactory:()=>`rev:p03-viewport-${++revision}`
  });
  await controller.openMusicXml(xml,{
    documentId:'doc:p03-viewport',
    revisionId:'rev:p03-viewport-saved',
    title:'P03 Viewport',
    sha256Hex:async()=> '7'.repeat(64)
  });
  return controller;
};

const eventsOf=controller=>controller.getDocument().session.history.present.score.parts[0].staves.find(staff=>staff.role==='standard').measures[0].voices[0].events;
const eventAddress=(controller,index)=>addressEntityV3(controller.getDocument().session.history.present.score,eventsOf(controller)[index].id);

test('P03-VIEWPORT01 reusable viewport layer declares no canonical or coordinate authoring authority',()=>{
  const layer=createViewportPresentationLayer();
  assert.equal(layer.canonicalAuthority,false);
  assert.equal(layer.coordinateAuthoring,false);
  assert.equal(layer.getState().zoom,1);
  assert.equal(layer.zoomIn().zoom,1+VIEWPORT_ZOOM_STEP);
  assert.equal(layer.panBy(96,48).scrollX,96);
  assert.equal(layer.getState().scrollY,48);
  assert.equal(layer.unmount().mounted,false);
});

test('P03-VIEWPORT01 mobile teacher runtime reuses the existing presentation viewport on one canonical controller',()=>{
  assert.equal(mobileTeacherViewportBrowserAppProfile.mobileTeacherViewportBundled,true);
  assert.equal(mobileTeacherViewportBrowserAppProfile.mobileTeacherViewportCanonicalAuthority,false);
  assert.equal(mobileTeacherViewportBrowserAppProfile.mobileTeacherViewportSingleCanonicalController,true);
  assert.equal(mobileTeacherViewportBrowserAppProfile.mobileTeacherViewportReusesExistingViewport,true);
  assert.equal(mobileTeacherViewportBrowserAppProfile.mobileTeacherViewportPresentationLayer,'existing-viewport-enabled-v1');
  assert.equal(mobileTeacherViewportBrowserAppProfile.mobileTeacherViewportCoordinateAuthoring,false);
  assert.equal(mobileTeacherViewportBrowserAppProfile.mobileTeacherViewportRendererCoordinateAuthority,false);
  assert.equal(mobileTeacherViewportBrowserAppProfile.mobileTeacherViewportDomAuthoringAuthority,false);
  const runtime=createMobileTeacherViewportStandaloneBrowserAppRuntime();
  assert.equal(runtime.mobileTeacherViewport.singleCanonicalController,true);
  assert.equal(runtime.mobileTeacherViewport.reusesExistingViewport,true);
  assert.equal(runtime.mobileTeacherViewport.presentationOnly,true);
  assert.equal(runtime.mobileTeacherViewport.semanticTeacherWorkflow,true);
  assert.equal(runtime.mobileTeacherViewport.coordinateAuthoring,false);
});

test('P03-VIEWPORT01 zoom and pan preserve current semantic selection and create no canonical/history revision',async()=>{
  const controller=await createController();
  controller.select(eventAddress(controller,0));
  const before=structuredClone(controller.getDocument());
  const selectedEventId=before.session.selection.eventId;

  controller.zoomIn();
  controller.panBy(120,64);
  controller.nextPage();

  const after=controller.getDocument();
  assert.equal(after.session.history.present.score.revision.id,before.session.history.present.score.revision.id);
  assert.equal(after.session.history.past.length,before.session.history.past.length);
  assert.equal(after.session.history.future.length,before.session.history.future.length);
  assert.deepEqual(after.session.history.present,before.session.history.present);
  assert.equal(after.session.selection.kind,'event');
  assert.equal(after.session.selection.eventId,selectedEventId);
  assert.equal(controller.getViewportState().zoom,1.25);
  assert.equal(controller.getViewportState().scrollX,120);
});

test('P03-VIEWPORT01 teacher copy/paste stays in unified history while the inherited viewport state survives canonical notifications',async()=>{
  const controller=await createController();
  controller.zoomIn();
  controller.panBy(80,32);
  const viewportBefore=controller.getViewportState();

  controller.select(eventAddress(controller,0));
  controller.captureTeacherRangeStartAtSelection();
  controller.select(eventAddress(controller,1));
  controller.copyTeacherRangeToSelection();
  controller.select(eventAddress(controller,4));
  const result=controller.pasteTeacherClipboardOverwriteAtSelection();

  assert.equal(result.error,null);
  assert.equal(result.revisionId,'rev:p03-viewport-1');
  assert.equal(controller.getDocument().session.history.past.length,1);
  assert.equal(controller.getDocument().dirty,true);
  assert.equal(controller.getViewportState().zoom,viewportBefore.zoom);
  assert.equal(controller.getViewportState().scrollX,viewportBefore.scrollX);
  assert.equal(controller.getViewportState().scrollY,viewportBefore.scrollY);

  controller.undo();
  assert.equal(controller.getDocument().session.history.present.score.revision.id,'rev:p03-viewport-saved');
  assert.equal(controller.getDocument().dirty,false);
  assert.equal(controller.getViewportState().zoom,viewportBefore.zoom);
  assert.equal(controller.getViewportState().scrollX,viewportBefore.scrollX);
});
