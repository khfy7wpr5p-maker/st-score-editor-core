import test from 'node:test';
import assert from 'node:assert/strict';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import {
  openMusicXmlScoreEditorAppDocument,
  commitAppTeacherOctaveTranspose,
  navigateAppDocumentHistory
} from '../dist/packages/score-editor-app-document/src/index.js';
import { createTeacherEventSpanSelectionV4 } from '../dist/packages/editor-teacher-event-span-v4/src/index.js';
import { analyzeTeacherOctaveTransposeV4 } from '../dist/packages/editor-teacher-octave-transpose-admission-v4/src/index.js';

const xml=`<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><type>quarter</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><type>quarter</type></note>
      <note><rest/><duration>2</duration><voice>1</voice><type>half</type></note>
    </measure>
  </part>
</score-partwise>`;

const openSaved=()=>openMusicXmlScoreEditorAppDocument(xml,{
  documentId:'doc:p02-app-transpose',
  revisionId:'rev:p02-app-transpose-saved',
  title:'Teacher Octave Transpose App Test',
  sha256Hex:async()=> '2'.repeat(64)
});

const facts=document=>{
  const score=document.session.history.present.score;
  const notation=document.session.history.present.notation;
  const staff=score.parts[0].staves.find(candidate=>candidate.role==='standard');
  const events=staff.measures[0].voices[0].events;
  assert.equal(events.length,3);
  assert.notEqual(events[0].kind,'rest');
  assert.notEqual(events[1].kind,'rest');
  const selection=createTeacherEventSpanSelectionV4(
    score,
    addressEntityV3(score,events[0].id),
    addressEntityV3(score,events[1].id)
  );
  const admission=analyzeTeacherOctaveTransposeV4(score,notation,selection,1);
  return {selection,admission};
};

test('P02-TRANSPOSE04 app document octave transpose preserves savedRevisionId dirty and Undo/Redo semantics',async()=>{
  const document=await openSaved();
  assert.equal(document.savedRevisionId,'rev:p02-app-transpose-saved');
  assert.equal(document.dirty,false);
  const before=structuredClone(document.session.history.present);
  const {selection,admission}=facts(document);

  const transposed=commitAppTeacherOctaveTranspose(
    document,selection,admission,{nextRevisionId:'rev:p02-app-transposed'}
  );
  assert.equal(transposed.savedRevisionId,'rev:p02-app-transpose-saved');
  assert.equal(transposed.session.history.present.score.revision.id,'rev:p02-app-transposed');
  assert.equal(transposed.session.history.past.length,1);
  assert.equal(transposed.session.status.code,'TEACHER_OCTAVE_TRANSPOSE_EDIT_COMMITTED');
  assert.equal(transposed.dirty,true);
  const after=structuredClone(transposed.session.history.present);
  const staff=transposed.session.history.present.score.parts[0].staves.find(candidate=>candidate.role==='standard');
  const events=staff.measures[0].voices[0].events;
  assert.equal(events[0].note.pitch.octave,5);
  assert.equal(events[1].note.pitch.octave,5);
  assert.equal(events[2].kind,'rest');

  const undone=navigateAppDocumentHistory(transposed,'UNDO');
  assert.deepEqual(undone.session.history.present,before);
  assert.equal(undone.savedRevisionId,'rev:p02-app-transpose-saved');
  assert.equal(undone.dirty,false);

  const redone=navigateAppDocumentHistory(undone,'REDO');
  assert.deepEqual(redone.session.history.present,after);
  assert.equal(redone.savedRevisionId,'rev:p02-app-transpose-saved');
  assert.equal(redone.dirty,true);
});

test('P02-TRANSPOSE04 rejected app transpose leaves document unchanged',async()=>{
  const document=await openSaved();
  const before=structuredClone(document);
  const {selection,admission}=facts(document);
  const tampered=structuredClone(admission);
  tampered.targetNotePlans[0].targetPitch.octave=9;

  assert.throws(()=>commitAppTeacherOctaveTranspose(
    document,selection,tampered,{nextRevisionId:'rev:p02-app-transpose-reject'}
  ));
  assert.deepEqual(document,before);
  assert.equal(document.dirty,false);
  assert.equal(document.session.history.past.length,0);
});
