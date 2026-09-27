import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { openMusicXmlScoreEditorAppDocument } from '../dist/packages/score-editor-app-document/src/index.js';
import { createRendererRequestV4 } from '../dist/packages/renderer-contract-v4/src/index.js';
import { executeFourToThreeTupletToStraightFourUnretimingV4 } from '../dist/packages/editor-four-to-three-tuplet-unretiming-authoring-v4/src/index.js';

const importedFourToThreeMusicXml=`<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Part</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>8</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>3</duration><voice>1</voice><type>eighth</type>
        <time-modification><actual-notes>4</actual-notes><normal-notes>3</normal-notes></time-modification>
        <notations><tuplet type="start" number="1"/></notations>
      </note>
      <note>
        <pitch><step>D</step><octave>4</octave></pitch>
        <duration>3</duration><voice>1</voice><type>eighth</type>
        <time-modification><actual-notes>4</actual-notes><normal-notes>3</normal-notes></time-modification>
      </note>
      <note>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>3</duration><voice>1</voice><type>eighth</type>
        <time-modification><actual-notes>4</actual-notes><normal-notes>3</normal-notes></time-modification>
      </note>
      <note>
        <pitch><step>F</step><octave>4</octave></pitch>
        <duration>3</duration><voice>1</voice><type>eighth</type>
        <time-modification><actual-notes>4</actual-notes><normal-notes>3</normal-notes></time-modification>
        <notations><tuplet type="stop" number="1"/></notations>
      </note>
      <note><rest/><duration>20</duration><voice>1</voice></note>
    </measure>
  </part>
</score-partwise>`;

test('P10-2C mutates imported MusicXML exact 4:3 without replacing event/note identity or source metadata',async()=>{
  const imported=await openMusicXmlScoreEditorAppDocument(importedFourToThreeMusicXml,{
    documentId:'doc:p10-2c:musicxml',
    revisionId:'rev:p10-2c:musicxml',
    sha256Hex:async()=> 'd'.repeat(64)
  });
  const score=imported.session.history.present.score;
  const notation=imported.session.history.present.notation;
  const staff=score.parts[0].staves.find(item=>item.role==='standard');
  assert.ok(staff);
  const voice=staff.measures[0].voices[0];
  const selected=voice.events.slice(0,4);
  const beforeEventIds=selected.map(event=>event.id);
  const beforeNoteIds=selected.map(event=>event.kind==='note'?event.note.id:null);
  const beforeSource=structuredClone(score.source);

  const result=executeFourToThreeTupletToStraightFourUnretimingV4(
    score,
    notation,
    {
      version:'1.0.0',
      type:'UNRETIMING_FOUR_TO_THREE_TO_STRAIGHT_FOUR',
      targets:selected.map(event=>addressEntityV3(score,event.id))
    },
    {nextRevisionId:'rev:p10-2c:musicxml:straight'}
  );

  const nextStaff=result.score.parts[0].staves.find(item=>item.role==='standard');
  assert.ok(nextStaff);
  const nextVoice=nextStaff.measures[0].voices[0];
  const nextSelected=nextVoice.events.slice(0,4);

  assert.deepEqual(nextSelected.map(event=>event.id),beforeEventIds);
  assert.deepEqual(nextSelected.map(event=>event.kind==='note'?event.note.id:null),beforeNoteIds);
  assert.deepEqual(result.score.source,beforeSource);
  assert.deepEqual(nextSelected.map(event=>event.onset),[
    {numerator:0,denominator:1},
    {numerator:1,denominator:8},
    {numerator:1,denominator:4},
    {numerator:3,denominator:8}
  ]);
  assert.deepEqual(nextSelected.map(event=>event.duration),[
    {numerator:1,denominator:8},
    {numerator:1,denominator:8},
    {numerator:1,denominator:8},
    {numerator:1,denominator:8}
  ]);
  assert.deepEqual(
    beforeEventIds.map(eventId=>
      result.notation.events.find(entry=>entry.target.eventId===eventId)?.notation.tuplet??null
    ),
    [null,null,null,null]
  );

  const render=createRendererRequestV4(result.score,result.notation);
  assert.equal(render.revisionId,'rev:p10-2c:musicxml:straight');
  assert.equal(render.projectionStatus,'V3_COMPATIBLE_XML');
  assert.equal(typeof render.musicXml,'string');
  assert.ok(render.musicXml.length>0);
});
