import test from 'node:test';
import assert from 'node:assert/strict';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import {
  MOBILE_TEACHER_MIN_TOUCH_TARGET_PX,
  MOBILE_TEACHER_TOOLBAR_STYLE,
  createMobileTeacherToolbarStandaloneBrowserAppRuntime,
  createMobileTeacherToolbarStandaloneScoreEditorController,
  mobileTeacherToolbarBrowserAppProfile
} from '../dist/packages/score-editor-browser-app/src/mobile-teacher-toolbar.js';

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
  const controller=createMobileTeacherToolbarStandaloneScoreEditorController({
    revisionIdFactory:()=>`rev:p03-mobile-${++revision}`
  });
  await controller.openMusicXml(xml,{
    documentId:'doc:p03-mobile',
    revisionId:'rev:p03-mobile-saved',
    title:'P03 Mobile',
    sha256Hex:async()=> '6'.repeat(64)
  });
  return controller;
};

const eventsOf=controller=>controller.getDocument().session.history.present.score.parts[0].staves.find(staff=>staff.role==='standard').measures[0].voices[0].events;
const eventAddress=(controller,index)=>addressEntityV3(controller.getDocument().session.history.present.score,eventsOf(controller)[index].id);
const noteAddress=(controller,index)=>addressEntityV3(controller.getDocument().session.history.present.score,eventsOf(controller)[index].note.id);

test('P03-MOBILE01 profile is presentation-only and mobile-safe by contract',()=>{
  assert.equal(MOBILE_TEACHER_MIN_TOUCH_TARGET_PX,44);
  assert.equal(mobileTeacherToolbarBrowserAppProfile.mobileTeacherToolbarBundled,true);
  assert.equal(mobileTeacherToolbarBrowserAppProfile.mobileTeacherToolbarCanonicalAuthority,false);
  assert.equal(mobileTeacherToolbarBrowserAppProfile.mobileTeacherToolbarSelectionAuthority,'SemanticAddressV3-current-revision');
  assert.equal(mobileTeacherToolbarBrowserAppProfile.mobileTeacherToolbarRangeCapture,'two-distinct-current-revision-events');
  assert.equal(mobileTeacherToolbarBrowserAppProfile.mobileTeacherToolbarMinimumTouchTargetPx,44);
  assert.equal(mobileTeacherToolbarBrowserAppProfile.mobileTeacherToolbarSafeAreaAware,true);
  assert.equal(mobileTeacherToolbarBrowserAppProfile.mobileTeacherToolbarRendererCoordinateAuthority,false);
  assert.equal(mobileTeacherToolbarBrowserAppProfile.mobileTeacherToolbarDomAuthoringAuthority,false);
  assert.equal(mobileTeacherToolbarBrowserAppProfile.mobileTeacherToolbarNetworkAuthority,false);
  assert.match(MOBILE_TEACHER_TOOLBAR_STYLE,/min-height:44px/);
  assert.match(MOBILE_TEACHER_TOOLBAR_STYLE,/safe-area-inset-bottom/);
  assert.match(MOBILE_TEACHER_TOOLBAR_STYLE,/touch-action:manipulation/);

  const runtime=createMobileTeacherToolbarStandaloneBrowserAppRuntime();
  assert.equal(runtime.mobileTeacherToolbar.bundled,true);
  assert.equal(runtime.mobileTeacherToolbar.canonicalAuthority,false);
  assert.equal(runtime.mobileTeacherToolbar.semanticSelectionOnly,true);
  assert.equal(runtime.mobileTeacherToolbar.rangeCapture,'two-distinct-current-revision-events');
  assert.equal(runtime.mobileTeacherToolbar.minimumTouchTargetPx,44);
});

test('P03-MOBILE01 semantic event/note selection and explicit range capture do not mutate history',async()=>{
  const controller=await createController();
  const initialRevision=controller.getDocument().session.history.present.score.revision.id;
  assert.equal(controller.getMobileTeacherToolbarState().canCaptureRangeStart,false);

  controller.select(eventAddress(controller,0));
  let state=controller.getMobileTeacherToolbarState();
  assert.equal(state.selectionKind,'event');
  assert.equal(state.selectedEventId,eventsOf(controller)[0].id);
  assert.equal(state.canCaptureRangeStart,true);
  assert.equal(state.canCompleteRange,false);

  state=controller.captureTeacherRangeStartAtSelection();
  assert.equal(state.rangeStartEventId,eventsOf(controller)[0].id);
  assert.equal(state.rangeStartCurrent,true);
  assert.equal(state.canCompleteRange,false);

  controller.select(noteAddress(controller,1));
  state=controller.getMobileTeacherToolbarState();
  assert.equal(state.selectionKind,'note');
  assert.equal(state.selectedEventId,eventsOf(controller)[1].id);
  assert.equal(state.canCompleteRange,true);
  assert.equal(state.canCopyRange,true);
  assert.equal(state.canTransposeRange,true);
  assert.equal(controller.getDocument().session.history.past.length,0);
  assert.equal(controller.getDocument().session.history.present.score.revision.id,initialRevision);
});

test('P03-MOBILE01 copy captured range then paste over selected rest preserves unified history and invalidates transient state',async()=>{
  const controller=await createController();
  controller.select(eventAddress(controller,0));
  controller.captureTeacherRangeStartAtSelection();
  controller.select(eventAddress(controller,1));
  let state=controller.copyTeacherRangeToSelection();
  assert.equal(state.rangeStartEventId,null);
  assert.equal(state.clipboardAvailable,true);
  assert.equal(state.clipboardCurrent,true);

  controller.select(eventAddress(controller,4));
  state=controller.getMobileTeacherToolbarState();
  assert.equal(state.canAttemptPasteOverwrite,true);
  const result=controller.pasteTeacherClipboardOverwriteAtSelection();
  assert.equal(result.error,null);
  assert.equal(result.revisionId,'rev:p03-mobile-1');
  assert.equal(controller.getDocument().session.history.past.length,1);
  assert.equal(controller.getDocument().dirty,true);
  assert.equal(controller.getMobileTeacherToolbarState().clipboardAvailable,false);
  assert.equal(controller.getMobileTeacherToolbarState().rangeStartEventId,null);
  assert.equal(controller.getMobileTeacherToolbarState().canUndo,true);

  controller.undo();
  assert.equal(controller.getDocument().session.history.present.score.revision.id,'rev:p03-mobile-saved');
  assert.equal(controller.getDocument().dirty,false);
  assert.equal(controller.getMobileTeacherToolbarState().canRedo,true);
});

test('P03-MOBILE01 captured range insert and octave transpose route only through proven teacher workflow authority',async()=>{
  const insertController=await createController();
  insertController.select(eventAddress(insertController,0));
  insertController.captureTeacherRangeStartAtSelection();
  insertController.select(eventAddress(insertController,1));
  insertController.copyTeacherRangeToSelection();
  insertController.select(eventAddress(insertController,2));
  const inserted=insertController.insertTeacherClipboardAfterSelection();
  assert.equal(inserted.error,null);
  assert.equal(inserted.revisionId,'rev:p03-mobile-1');
  assert.equal(insertController.getDocument().session.history.past.length,1);

  const transposeController=await createController();
  transposeController.select(eventAddress(transposeController,0));
  transposeController.captureTeacherRangeStartAtSelection();
  transposeController.select(eventAddress(transposeController,1));
  const transposed=transposeController.transposeTeacherRangeToSelectionByOctaves(1);
  assert.equal(transposed.error,null);
  assert.equal(transposed.revisionId,'rev:p03-mobile-1');
  assert.equal(eventsOf(transposeController)[0].note.pitch.octave,5);
  assert.equal(eventsOf(transposeController)[1].note.pitch.octave,5);
  assert.equal(eventsOf(transposeController)[2].note.pitch.octave,4);
  assert.equal(transposeController.getDocument().session.history.past.length,1);
  assert.equal(transposeController.getMobileTeacherToolbarState().rangeStartEventId,null);
});

test('P03-MOBILE01 incomplete or non-event ranges fail before canonical mutation',async()=>{
  const controller=await createController();
  let before=structuredClone(controller.getDocument());
  assert.throws(()=>controller.copyTeacherRangeToSelection(),error=>error?.code==='RANGE_START_REQUIRED');
  assert.throws(()=>controller.transposeTeacherRangeToSelectionByOctaves(1),error=>error?.code==='RANGE_START_REQUIRED');
  assert.deepEqual(controller.getDocument(),before);

  controller.select(eventAddress(controller,0));
  controller.captureTeacherRangeStartAtSelection();
  before=structuredClone(controller.getDocument());
  assert.throws(()=>controller.copyTeacherRangeToSelection(),error=>error?.code==='RANGE_STOP_REQUIRED');
  assert.throws(()=>controller.transposeTeacherRangeToSelectionByOctaves(1),error=>error?.code==='RANGE_STOP_REQUIRED');
  assert.deepEqual(controller.getDocument(),before);

  controller.clearTeacherRangeStart();
  const score=controller.getDocument().session.history.present.score;
  const measure=score.parts[0].staves.find(staff=>staff.role==='standard').measures[0];
  controller.select(addressEntityV3(score,measure.id));
  before=structuredClone(controller.getDocument());
  assert.equal(controller.getMobileTeacherToolbarState().canCaptureRangeStart,false);
  assert.throws(()=>controller.captureTeacherRangeStartAtSelection(),error=>error?.code==='EVENT_SELECTION_REQUIRED');
  assert.deepEqual(controller.getDocument(),before);
});

test('P03-MOBILE01 captured range is revision-bound and clears after a canonical edit',async()=>{
  const controller=await createController();
  controller.select(eventAddress(controller,0));
  controller.captureTeacherRangeStartAtSelection();
  controller.select(eventAddress(controller,1));
  assert.equal(controller.getMobileTeacherToolbarState().rangeStartCurrent,true);
  const result=controller.transposeTeacherRangeToSelectionByOctaves(1);
  assert.equal(result.error,null);
  assert.equal(controller.getMobileTeacherToolbarState().rangeStartEventId,null);
  assert.equal(controller.getMobileTeacherToolbarState().rangeStartCurrent,false);
});
