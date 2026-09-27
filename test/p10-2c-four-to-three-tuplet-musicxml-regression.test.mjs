import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { openMusicXmlScoreEditorAppDocument } from '../dist/packages/score-editor-app-document/src/index.js';
import { createRendererRequestV4 } from '../dist/packages/renderer-contract-v4/src/index.js';
import { executeFourToThreeTupletToStraightFourUnretimingV4 } from '../dist/packages/editor-four-to-three-tuplet-unretiming-authoring-v4/src/index.js';
import { IMPORTED_FOUR_TO_THREE_MUSIC_XML } from './helpers/four-to-three-tuplet-fixture.mjs';

test('P10-2C mutates imported MusicXML exact 4:3 without replacing event/note identity or source metadata',async()=>{
  const imported=await openMusicXmlScoreEditorAppDocument(IMPORTED_FOUR_TO_THREE_MUSIC_XML,{
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
