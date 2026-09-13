import test from 'node:test';
import assert from 'node:assert/strict';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import {
  openMusicXmlScoreEditorAppDocument,
  commitAppTeacherInsertAfterEvent,
  navigateAppDocumentHistory
} from '../dist/packages/score-editor-app-document/src/index.js';
import { createTeacherEventSpanSelectionV4 } from '../dist/packages/editor-teacher-event-span-v4/src/index.js';
import { createTeacherCopySnapshotV4 } from '../dist/packages/editor-teacher-copy-snapshot-v4/src/index.js';
import { analyzeTeacherInsertAfterEventV4 } from '../dist/packages/editor-teacher-insert-admission-v4/src/index.js';

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

const openSaved=()=>openMusicXmlScoreEditorAppDocument(xml,{
  documentId:'doc:p02-app-insert',
  revisionId:'rev:p02-app-insert-saved',
  title:'Teacher Insert App Test',
  sha256Hex:async()=> '3'.repeat(64)
});

const facts=document=>{
  const score=document.session.history.present.score;
  const notation=document.session.history.present.notation;
  const staff=score.parts[0].staves.find(candidate=>candidate.role==='standard');
  const events=staff.measures[0].voices[0].events;
  assert.equal(events.length,5);
  const selection=createTeacherEventSpanSelectionV4(
    score,
    addressEntityV3(score,events[0].id),
    addressEntityV3(score,events[1].id)
  );
  const snapshot=createTeacherCopySnapshotV4(score,notation,selection);
  const admission=analyzeTeacherInsertAfterEventV4(
    score,notation,snapshot,addressEntityV3(score,events[2].id)
  );
  return {snapshot,admission};
};

test('P02-INSERT04 app document insert preserves savedRevisionId dirty and Undo/Redo semantics',async()=>{
  const document=await openSaved();
  assert.equal(document.savedRevisionId,'rev:p02-app-insert-saved');
  assert.equal(document.dirty,false);
  const before=structuredClone(document.session.history.present);
  const {snapshot,admission}=facts(document);

  const inserted=commitAppTeacherInsertAfterEvent(
    document,snapshot,admission,'rev:p02-app-inserted'
  );
  assert.equal(inserted.savedRevisionId,'rev:p02-app-insert-saved');
  assert.equal(inserted.session.history.present.score.revision.id,'rev:p02-app-inserted');
  assert.equal(inserted.session.history.past.length,1);
  assert.equal(inserted.session.status.code,'TEACHER_INSERT_EDIT_COMMITTED');
  assert.equal(inserted.dirty,true);
  const after=structuredClone(inserted.session.history.present);
  const staff=inserted.session.history.present.score.parts[0].staves.find(candidate=>candidate.role==='standard');
  const events=staff.measures[0].voices[0].events;
  assert.equal(events.length,6);
  assert.equal(events[0].note.pitch.step,'C');
  assert.equal(events[1].note.pitch.step,'D');
  assert.equal(events[2].note.pitch.step,'E');
  assert.equal(events[3].note.pitch.step,'C');
  assert.equal(events[4].note.pitch.step,'D');
  assert.equal(events[5].note.pitch.step,'F');
  assert.deepEqual(events[3].onset,{numerator:1,denominator:2});
  assert.deepEqual(events[4].onset,{numerator:5,denominator:8});
  assert.deepEqual(events[5].onset,{numerator:3,denominator:4});

  const undone=navigateAppDocumentHistory(inserted,'UNDO');
  assert.deepEqual(undone.session.history.present,before);
  assert.equal(undone.savedRevisionId,'rev:p02-app-insert-saved');
  assert.equal(undone.dirty,false);

  const redone=navigateAppDocumentHistory(undone,'REDO');
  assert.deepEqual(redone.session.history.present,after);
  assert.equal(redone.savedRevisionId,'rev:p02-app-insert-saved');
  assert.equal(redone.dirty,true);
});

test('P02-INSERT04 rejected app insert leaves document unchanged',async()=>{
  const document=await openSaved();
  const before=structuredClone(document);
  const {snapshot,admission}=facts(document);
  const tampered=structuredClone(admission);
  tampered.insertEnd={numerator:7,denominator:8};

  assert.throws(()=>commitAppTeacherInsertAfterEvent(
    document,snapshot,tampered,'rev:p02-app-insert-reject'
  ));
  assert.deepEqual(document,before);
  assert.equal(document.dirty,false);
  assert.equal(document.session.history.past.length,0);
});