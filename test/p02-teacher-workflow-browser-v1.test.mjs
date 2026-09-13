import test from 'node:test';
import assert from 'node:assert/strict';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import {
  createTeacherWorkflowStandaloneScoreEditorController,
  createTeacherWorkflowStandaloneBrowserAppRuntime,
  teacherWorkflowBrowserAppProfile
} from '../dist/packages/score-editor-browser-app/src/teacher-workflow.js';

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

const controller=async()=>{
  let revision=0;
  const value=createTeacherWorkflowStandaloneScoreEditorController({
    revisionIdFactory:()=>`rev:teacher-browser-${++revision}`
  });
  await value.openMusicXml(xml,{
    documentId:'doc:teacher-browser',
    revisionId:'rev:teacher-browser-saved',
    title:'Teacher Browser Workflow',
    sha256Hex:async()=> '4'.repeat(64)
  });
  return value;
};

const eventsOf=value=>{
  const score=value.getDocument().session.history.present.score;
  return score.parts[0].staves.find(candidate=>candidate.role==='standard').measures[0].voices[0].events;
};

const eventAddress=(value,index)=>{
  const score=value.getDocument().session.history.present.score;
  return addressEntityV3(score,eventsOf(value)[index].id);
};

test('P02-BROWSER01 profile/runtime expose teacher commands without canonical, DOM or renderer-coordinate authority',()=>{
  assert.equal(teacherWorkflowBrowserAppProfile.teacherWorkflowCommandsBundled,true);
  assert.equal(teacherWorkflowBrowserAppProfile.teacherWorkflowCanonicalAuthority,false);
  assert.equal(teacherWorkflowBrowserAppProfile.teacherWorkflowHistoryAuthority,'EditorSessionV4');
  assert.equal(teacherWorkflowBrowserAppProfile.teacherWorkflowRendererCoordinateAuthority,false);
  assert.equal(teacherWorkflowBrowserAppProfile.teacherWorkflowDomAuthoringAuthority,false);
  assert.equal(teacherWorkflowBrowserAppProfile.teacherWorkflowNetworkAuthority,false);
  const runtime=createTeacherWorkflowStandaloneBrowserAppRuntime();
  assert.equal(runtime.teacherWorkflow.bundled,true);
  assert.equal(runtime.teacherWorkflow.canonicalAuthority,false);
  assert.equal(typeof runtime.createController,'function');
});

test('P02-BROWSER01 copy + bounded paste overwrite routes through app-document authority and invalidates stale clipboard',async()=>{
  const value=await controller();
  const copied=value.copyTeacherSpan(eventAddress(value,0),eventAddress(value,1));
  assert.equal(copied.clipboardAvailable,true);
  assert.equal(copied.clipboardCurrent,true);
  assert.equal(copied.clipboardEventCount,2);
  assert.equal(copied.clipboardNoteCount,2);

  const result=value.pasteTeacherClipboardOverwrite(eventAddress(value,4));
  assert.equal(result.error,null);
  assert.equal(result.revisionId,'rev:teacher-browser-1');
  const document=value.getDocument();
  assert.equal(document.session.history.present.score.revision.id,'rev:teacher-browser-1');
  assert.equal(document.session.history.past.length,1);
  assert.equal(document.dirty,true);
  assert.equal(value.getTeacherWorkflowState().clipboardAvailable,false);
  const events=eventsOf(value);
  assert.equal(events.length,6);
  assert.equal(events[4].note.pitch.step,'C');
  assert.equal(events[5].note.pitch.step,'D');

  value.undo();
  assert.equal(value.getDocument().session.history.present.score.revision.id,'rev:teacher-browser-saved');
  assert.equal(value.getDocument().dirty,false);
});

test('P02-BROWSER01 copy + bounded insert routes through app-document authority with exact suffix shift',async()=>{
  const value=await controller();
  value.copyTeacherSpan(eventAddress(value,0),eventAddress(value,1));
  const result=value.insertTeacherClipboardAfter(eventAddress(value,2));
  assert.equal(result.error,null);
  assert.equal(result.revisionId,'rev:teacher-browser-1');
  const events=eventsOf(value);
  assert.equal(events.length,6);
  assert.deepEqual(events.map(event=>event.kind==='rest'?'rest':event.kind==='note'?event.note.pitch.step:'chord'),['C','D','E','C','D','F']);
  assert.deepEqual(events[3].onset,{numerator:1,denominator:2});
  assert.deepEqual(events[4].onset,{numerator:5,denominator:8});
  assert.deepEqual(events[5].onset,{numerator:3,denominator:4});
  assert.equal(value.getTeacherWorkflowState().clipboardAvailable,false);
});

test('P02-BROWSER01 octave transpose routes semantic span through the proven app-document transpose authority',async()=>{
  const value=await controller();
  const result=value.transposeTeacherSpanByOctaves(eventAddress(value,0),eventAddress(value,1),1);
  assert.equal(result.error,null);
  assert.equal(result.revisionId,'rev:teacher-browser-1');
  const events=eventsOf(value);
  assert.equal(events[0].note.pitch.octave,5);
  assert.equal(events[1].note.pitch.octave,5);
  assert.equal(events[2].note.pitch.octave,4);
  assert.equal(value.getDocument().session.history.past.length,1);
});

test('P02-BROWSER01 rejected destination fails before adoption and leaves canonical/history/clipboard unchanged',async()=>{
  const value=await controller();
  value.copyTeacherSpan(eventAddress(value,0),eventAddress(value,1));
  const before=structuredClone(value.getDocument());
  assert.throws(()=>value.pasteTeacherClipboardOverwrite(eventAddress(value,3)));
  assert.deepEqual(value.getDocument(),before);
  assert.equal(value.getTeacherWorkflowState().clipboardAvailable,true);
  assert.equal(value.getTeacherWorkflowState().clipboardCurrent,true);
  assert.equal(value.getDocument().session.history.past.length,0);
});
