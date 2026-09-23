import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import {
  P10_3B_RANGE_REPLACE_CONTROL_DEFINITIONS,
  P10_3B_RANGE_REPLACE_CONTROL_MIN_TOUCH_TARGET_PX,
  P10_3B_RANGE_REPLACE_CONTROL_STYLE,
  createP10_3BProfessionalWorkstationStandaloneBrowserAppRuntimeV1,
  createP10_3BProfessionalWorkstationStandaloneScoreEditorControllerV1,
  p10_3bProfessionalWorkstationBrowserAppProfile
} from '../dist/packages/score-editor-browser-professional-workstation-p10-3b-v1/src/index.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const xml=`<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
  <part id="P1"><measure number="1">
    <attributes>
      <divisions>16</divisions>
      <key><fifths>0</fifths></key>
      <time><beats>4</beats><beat-type>4</beat-type></time>
      <clef><sign>G</sign><line>2</line></clef>
    </attributes>
    <note><pitch><step>C</step><octave>4</octave></pitch><duration>8</duration><voice>1</voice><type>eighth</type></note>
    <note><pitch><step>E</step><octave>4</octave></pitch><duration>8</duration><voice>1</voice><type>eighth</type></note>
    <note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>16th</type></note>
    <note><rest/><duration>4</duration><voice>1</voice><type>16th</type></note>
    <note><pitch><step>A</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>16th</type></note>
    <note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>16th</type></note>
    <note><pitch><step>F</step><octave>4</octave></pitch><duration>32</duration><voice>1</voice><type>half</type></note>
  </measure></part>
</score-partwise>`;

const createController=async()=>{
  let revision=0;
  const controller=createP10_3BProfessionalWorkstationStandaloneScoreEditorControllerV1({
    revisionIdFactory:()=>`rev:p10-3b-browser-base-${++revision}`,
    professionalRevisionIdFactory:()=>`rev:p10-3b-browser-prof-${++revision}`
  });
  await controller.openMusicXml(xml,{
    documentId:'doc:p10-3b-browser',
    revisionId:'rev:p10-3b-browser-1',
    title:'P10-3B Browser',
    sha256Hex:async()=> '6'.repeat(64)
  });
  return controller;
};

const eventsOf=controller=>
  controller.getDocument().session.history.present.score.parts[0].staves
    .find(staff=>staff.role==='standard').measures[0].voices[0].events;

const addressAt=(controller,index)=>{
  const score=controller.getDocument().session.history.present.score;
  const event=eventsOf(controller)[index];
  const address=controller.getDocument().session.renderRequest.manifest.entries
    .find(entry=>entry.address.kind==='event'&&entry.address.eventId===event.id)?.address;
  assert.ok(address);
  return address;
};

const selectSpan=(controller,start,stop)=>{
  const result=controller.professional.selectEventSpan(
    addressAt(controller,start),
    addressAt(controller,stop)
  );
  assert.equal(result.error,null);
};

test('P10-3B browser profile exposes optional range Copy/Replace without gaining canonical/DOM authority',()=>{
  assert.equal(p10_3bProfessionalWorkstationBrowserAppProfile.p10_3bWorkstationComposition,true);
  assert.equal(p10_3bProfessionalWorkstationBrowserAppProfile.p10_3aQualifiedBasePreserved,true);
  assert.equal(p10_3bProfessionalWorkstationBrowserAppProfile.professionalRangeCopyAvailable,true);
  assert.equal(p10_3bProfessionalWorkstationBrowserAppProfile.professionalRangeReplaceAvailable,true);
  assert.equal(p10_3bProfessionalWorkstationBrowserAppProfile.professionalRangeReplaceCanonicalAuthority,false);
  assert.equal(p10_3bProfessionalWorkstationBrowserAppProfile.professionalRangeReplaceHistoryAuthority,'EditorHistoryV4');
  assert.equal(p10_3bProfessionalWorkstationBrowserAppProfile.professionalRangeReplaceRendererCoordinateAuthority,false);
  assert.equal(p10_3bProfessionalWorkstationBrowserAppProfile.professionalRangeReplaceDomAuthoringAuthority,false);
  assert.equal(p10_3bProfessionalWorkstationBrowserAppProfile.productionDefault,false);
  assert.equal(p10_3bProfessionalWorkstationBrowserAppProfile.productionReleaseAuthorized,false);
  assert.equal(p10_3bProfessionalWorkstationBrowserAppProfile.seslitabCutoverAuthorized,false);

  assert.equal(P10_3B_RANGE_REPLACE_CONTROL_MIN_TOUCH_TARGET_PX,44);
  assert.deepEqual(P10_3B_RANGE_REPLACE_CONTROL_DEFINITIONS.map(item=>item.action),['copy-range','replace-range']);
  assert.match(P10_3B_RANGE_REPLACE_CONTROL_STYLE,/min-height:44px/);
  assert.match(P10_3B_RANGE_REPLACE_CONTROL_STYLE,/touch-action:manipulation/);

  const runtime=createP10_3BProfessionalWorkstationStandaloneBrowserAppRuntimeV1();
  assert.equal(runtime.p10_3bWorkstation.rangeCopyAvailable,true);
  assert.equal(runtime.p10_3bWorkstation.rangeReplaceAvailable,true);
  assert.equal(runtime.p10_3bWorkstation.historyAuthority,'EditorHistoryV4');
  assert.equal(runtime.p10_3bWorkstation.domAuthoringAuthority,false);
});

test('P10-3B clipboard starts EMPTY, becomes CURRENT after EVENT_SPAN Copy, and selection-only changes do not stale it',async()=>{
  const controller=await createController();
  let state=controller.getP10_3BRangeReplaceState();
  assert.equal(state.clipboardState,'EMPTY');
  assert.equal(state.clipboardAvailable,false);
  assert.equal(state.clipboardCurrent,false);
  assert.equal(state.clipboardStale,false);

  selectSpan(controller,0,1);
  state=controller.getP10_3BRangeReplaceState();
  assert.equal(state.canCopyForReplace,true);

  const before=JSON.stringify(controller.getDocument().session.history);
  const copied=controller.copyProfessionalRangeForReplace();
  assert.equal(copied.error,null);
  assert.equal(JSON.stringify(controller.getDocument().session.history),before);

  state=controller.getP10_3BRangeReplaceState();
  assert.equal(state.clipboardState,'CURRENT');
  assert.equal(state.clipboardAvailable,true);
  assert.equal(state.clipboardCurrent,true);
  assert.equal(state.clipboardStale,false);
  assert.equal(state.clipboardEventCount,2);
  assert.equal(state.clipboardNoteCount,2);

  selectSpan(controller,2,5);
  state=controller.getP10_3BRangeReplaceState();
  assert.equal(state.clipboardState,'CURRENT');
  assert.equal(state.canAttemptReplace,true);
});

test('P10-3B any canonical edit latches CURRENT clipboard to STALE and Undo does not revive it',async()=>{
  const controller=await createController();
  selectSpan(controller,0,1);
  controller.copyProfessionalRangeForReplace();
  assert.equal(controller.getP10_3BRangeReplaceState().clipboardState,'CURRENT');

  controller.transposeProfessionalRangeBySemitones(1,{nextRevisionId:'rev:p10-3b-browser-edit-2'});
  assert.equal(controller.getP10_3BRangeReplaceState().clipboardState,'STALE');
  assert.equal(controller.getP10_3BRangeReplaceState().canAttemptReplace,false);

  controller.undo();
  assert.equal(controller.getDocument().session.history.present.score.revision.id,'rev:p10-3b-browser-1');
  assert.equal(controller.getP10_3BRangeReplaceState().clipboardState,'STALE');

  selectSpan(controller,0,1);
  controller.copyProfessionalRangeForReplace();
  assert.equal(controller.getP10_3BRangeReplaceState().clipboardState,'CURRENT');
});

test('P10-3B failed new Copy clears prior clipboard instead of leaving old content silently executable',async()=>{
  const controller=await createController();
  selectSpan(controller,0,1);
  controller.copyProfessionalRangeForReplace();
  assert.equal(controller.getP10_3BRangeReplaceState().clipboardState,'CURRENT');

  const setResult=controller.professional.selectEventSet([
    addressAt(controller,0),
    addressAt(controller,1)
  ]);
  assert.equal(setResult.error,null);
  const result=controller.copyProfessionalRangeForReplace();
  assert.equal(result.error?.code,'SELECTION_KIND_UNSUPPORTED');
  assert.equal(controller.getP10_3BRangeReplaceState().clipboardState,'EMPTY');
  assert.equal(controller.getP10_3BRangeReplaceState().clipboardAvailable,false);
});

test('P10-3B Replace adopts one canonical edit, selects fresh replacement span, and stales clipboard',async()=>{
  const controller=await createController();
  const sourceIds=eventsOf(controller).slice(0,2).map(event=>event.id);
  const destinationIds=eventsOf(controller).slice(2,6).map(event=>event.id);

  selectSpan(controller,0,1);
  controller.copyProfessionalRangeForReplace();
  selectSpan(controller,2,5);

  const result=controller.replaceProfessionalRange({nextRevisionId:'rev:p10-3b-browser-2'});
  assert.equal(result.error,null);
  assert.equal(controller.getDocument().session.history.past.length,1);
  assert.equal(controller.getDocument().session.history.present.score.revision.id,'rev:p10-3b-browser-2');

  const scoreJson=JSON.stringify(controller.getDocument().session.history.present.score);
  for(const id of sourceIds) assert.equal(scoreJson.includes(id),true);
  for(const id of destinationIds) assert.equal(scoreJson.includes(id),false);

  const selection=controller.professional.getProfessionalSelection();
  assert.ok(selection);
  assert.equal(selection.kind,'EVENT_SPAN');
  assert.equal(selection.targets.length,2);
  assert.equal(selection.anchor.revisionId,'rev:p10-3b-browser-2');

  const state=controller.getP10_3BRangeReplaceState();
  assert.equal(state.clipboardState,'STALE');
  assert.equal(state.clipboardCurrent,false);
  assert.equal(state.canAttemptReplace,false);
});

test('P10-3B extent-mismatch Replace fails with zero canonical/history side effect and keeps CURRENT clipboard',async()=>{
  const controller=await createController();
  selectSpan(controller,0,1);
  controller.copyProfessionalRangeForReplace();
  selectSpan(controller,2,2);

  const before=JSON.stringify(controller.getDocument());
  const result=controller.replaceProfessionalRange({nextRevisionId:'rev:p10-3b-browser-invalid'});
  assert.equal(result.error?.code,'REPLACE_EXTENT_MISMATCH');
  assert.equal(JSON.stringify(controller.getDocument()),before);
  assert.equal(controller.getDocument().session.history.past.length,0);
  assert.equal(controller.getP10_3BRangeReplaceState().clipboardState,'CURRENT');
  assert.equal(controller.professional.getProfessionalSelection()?.kind,'EVENT_SPAN');
});
