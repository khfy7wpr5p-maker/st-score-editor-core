import test from 'node:test';
import assert from 'node:assert/strict';
import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import {
  openMusicXmlScoreEditorAppDocument,
  commitAppTeacherPasteOverwrite,
  navigateAppDocumentHistory
} from '../dist/packages/score-editor-app-document/src/index.js';
import { createTeacherEventSpanSelectionV4 } from '../dist/packages/editor-teacher-event-span-v4/src/index.js';
import { createTeacherCopySnapshotV4 } from '../dist/packages/editor-teacher-copy-snapshot-v4/src/index.js';
import { analyzeTeacherPasteDestinationV4 } from '../dist/packages/editor-teacher-paste-admission-v4/src/index.js';
import { planTeacherPasteIdentitiesV4 } from '../dist/packages/editor-teacher-paste-identity-plan-v4/src/index.js';

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
  documentId:'doc:p02-app-paste',
  revisionId:'rev:p02-app-saved',
  title:'Teacher Paste App Test',
  sha256Hex:async()=> '1'.repeat(64)
});

const facts=document=>{
  const score=document.session.history.present.score;
  const notation=document.session.history.present.notation;
  const staff=score.parts[0].staves.find(candidate=>candidate.role==='standard');
  const voice=staff.measures[0].voices[0];
  assert.equal(voice.events.length,3);
  assert.notEqual(voice.events[0].kind,'rest');
  assert.notEqual(voice.events[1].kind,'rest');
  assert.equal(voice.events[2].kind,'rest');
  const selection=createTeacherEventSpanSelectionV4(
    score,
    addressEntityV3(score,voice.events[0].id),
    addressEntityV3(score,voice.events[1].id)
  );
  const snapshot=createTeacherCopySnapshotV4(score,notation,selection);
  const admission=analyzeTeacherPasteDestinationV4(score,notation,snapshot,addressEntityV3(score,voice.events[2].id));
  const identityPlan=planTeacherPasteIdentitiesV4(score,notation,snapshot,admission,'rev:p02-app-pasted');
  return {snapshot,admission,identityPlan};
};

test('P02-APP01 app document paste uses session history and preserves savedRevisionId dirty semantics',async()=>{
  const document=await openSaved();
  assert.equal(document.savedRevisionId,'rev:p02-app-saved');
  assert.equal(document.session.history.present.score.revision.id,'rev:p02-app-saved');
  assert.equal(document.dirty,false);
  const before=structuredClone(document.session.history.present);
  const {snapshot,admission,identityPlan}=facts(document);

  const pasted=commitAppTeacherPasteOverwrite(document,snapshot,admission,identityPlan);
  assert.equal(pasted.savedRevisionId,'rev:p02-app-saved');
  assert.equal(pasted.session.history.present.score.revision.id,'rev:p02-app-pasted');
  assert.equal(pasted.session.history.past.length,1);
  assert.equal(pasted.dirty,true);
  assert.equal(pasted.session.status.code,'TEACHER_PASTE_EDIT_COMMITTED');
  assert.equal(pasted.session.selection.kind,'event');
  const after=structuredClone(pasted.session.history.present);

  const undone=navigateAppDocumentHistory(pasted,'UNDO');
  assert.deepEqual(undone.session.history.present,before);
  assert.equal(undone.session.history.present.score.revision.id,'rev:p02-app-saved');
  assert.equal(undone.savedRevisionId,'rev:p02-app-saved');
  assert.equal(undone.dirty,false);

  const redone=navigateAppDocumentHistory(undone,'REDO');
  assert.deepEqual(redone.session.history.present,after);
  assert.equal(redone.session.history.present.score.revision.id,'rev:p02-app-pasted');
  assert.equal(redone.savedRevisionId,'rev:p02-app-saved');
  assert.equal(redone.dirty,true);
});

test('P02-APP01 rejected app paste returns no mutated document state',async()=>{
  const document=await openSaved();
  const before=structuredClone(document);
  const {snapshot,admission,identityPlan}=facts(document);
  const tampered=structuredClone(identityPlan);
  tampered.events[0].destinationEventId='paste-event:ffffffffffffffff';

  assert.throws(()=>commitAppTeacherPasteOverwrite(document,snapshot,admission,tampered));
  assert.deepEqual(document,before);
  assert.equal(document.dirty,false);
  assert.equal(document.session.history.past.length,0);
});
