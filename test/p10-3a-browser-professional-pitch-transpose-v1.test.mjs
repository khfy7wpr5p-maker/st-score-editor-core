import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createP10_3AProfessionalWorkstationStandaloneScoreEditorControllerV1
} from '../dist/packages/score-editor-browser-professional-workstation-p10-3a-v1/src/index.js';

const xml=`<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`;

const createController=async()=>{
  const controller=createP10_3AProfessionalWorkstationStandaloneScoreEditorControllerV1();
  await controller.openMusicXml(xml,{
    documentId:'doc:p10-3a-browser',
    revisionId:'rev:p10-3a-browser-1',
    title:'P10-3A Browser',
    sha256Hex:async()=> '5'.repeat(64)
  });
  return controller;
};

const selectSpan=controller=>{
  const documentValue=controller.getDocument();
  const events=documentValue.session.history.present.score.parts[0].staves[0].measures[0].voices[0].events;
  const addresses=events.map(event=>
    documentValue.session.renderRequest.manifest.entries
      .find(entry=>entry.address.kind==='event'&&entry.address.eventId===event.id)?.address
  );
  assert.equal(addresses.length,2);
  assert.ok(addresses[0]);
  assert.ok(addresses[1]);
  controller.professional.selectEventSpan(addresses[0],addresses[1]);
};

test('P10-3A browser bridge adopts semitone transpose through validated snapshot boundary',async()=>{
  const controller=await createController();
  selectSpan(controller);

  const result=controller.transposeProfessionalRangeBySemitones(
    1,
    {nextRevisionId:'rev:p10-3a-browser-2'}
  );

  assert.equal(result.error,null);
  assert.equal(controller.getDocument().session.history.past.length,1);
  assert.equal(controller.getDocument().session.history.present.score.revision.id,'rev:p10-3a-browser-2');
  assert.equal(controller.professional.getProfessionalSelection(),null);
});

test('P10-3A browser bridge rejects out-of-range diatonic request without adoption',async()=>{
  const controller=await createController();
  selectSpan(controller);
  const before=structuredClone(controller.getDocument());

  const result=controller.transposeProfessionalRangeDiatonically(
    8,
    {nextRevisionId:'rev:p10-3a-browser-invalid'}
  );

  assert.equal(result.error?.code,'INVALID_DIATONIC_STEPS');
  assert.deepEqual(controller.getDocument(),before);
});
