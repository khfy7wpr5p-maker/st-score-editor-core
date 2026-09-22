import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createNewScoreEditorAppDocument } from '../dist/packages/score-editor-app-document/src/index.js';
import { executeStraightThreeToTripletAuthoringV4 } from '../dist/packages/editor-tuplet-retiming-authoring-v4/src/index.js';
import { executeTripletToStraightThreeUnretimingV4 } from '../dist/packages/editor-tuplet-unretiming-authoring-v4/src/index.js';

const ids=()=>{let n=0;return()=>`p10-2-rt-${++n}`;};
const note=(id,noteId,onset,duration,step)=>({
  id,kind:'note',onset,duration,note:{id:noteId,pitch:{step,alter:0,octave:4}}
});
const rest=(id,onset,duration)=>({id,kind:'rest',onset,duration});

const state=(events)=>{
  const document=createNewScoreEditorAppDocument({idFactory:ids(),preset:'GUITAR_TREBLE'});
  const baseScore=document.session.history.present.score;
  const baseNotation=document.session.history.present.notation;
  const raw=structuredClone(baseScore);
  raw.parts[0].staves[0].measures[0].voices[0].events=events;
  const score=createScoreDocumentV3(raw);
  const notation=createNotationDocumentV4(score,{
    contractVersion:'4.0.0',
    documentId:score.id,
    revisionId:score.revision.id,
    frames:baseNotation.frames.map(entry=>({target:addressEntityV3(score,entry.target.frameId),notation:entry.notation})),
    measures:baseNotation.measures.map(entry=>({target:addressEntityV3(score,entry.target.measureId),notation:entry.notation})),
    events:[],
    notes:[],
    graceEvents:[],
    graceNotes:[],
    crossStaffPlacements:[]
  });
  return {score,notation};
};

const straight=tail=>[
  note('e1','n1',{numerator:0,denominator:1},{numerator:1,denominator:8},'C'),
  note('e2','n2',{numerator:1,denominator:8},{numerator:1,denominator:8},'D'),
  note('e3','n3',{numerator:1,denominator:4},{numerator:1,denominator:8},'E'),
  tail
];

const forwardIntent=score=>({
  version:'1.0.0',
  type:'RETIMING_STRAIGHT_THREE_TO_TRIPLET',
  targets:['e1','e2','e3'].map(id=>addressEntityV3(score,id))
});
const inverseIntent=score=>({
  version:'1.0.0',
  type:'UNRETIMING_TRIPLET_TO_STRAIGHT_THREE',
  targets:['e1','e2','e3'].map(id=>addressEntityV3(score,id))
});

const voice=score=>score.parts[0].staves.find(staff=>staff.role==='standard').measures[0].voices[0];
const musicSnapshot=(score,notation)=>({
  source:score.source,
  frames:score.measureFrames,
  parts:score.parts,
  eventNotation:notation.events.map(entry=>({eventId:entry.target.eventId,notation:entry.notation})),
  noteNotation:notation.notes.map(entry=>({noteId:entry.target.noteId,notation:entry.notation})),
  crossStaff:notation.crossStaffPlacements.map(item=>({eventId:item.source.eventId,displayStaffId:item.displayStaffId}))
});

test('P10-2 round trip restores straight timing after forward retiming extended an existing neutral rest',()=>{
  const source=state(straight(rest('tail',{numerator:3,denominator:8},{numerator:5,denominator:8})));
  const original=musicSnapshot(source.score,source.notation);

  const triplet=executeStraightThreeToTripletAuthoringV4(
    source.score,source.notation,forwardIntent(source.score),{nextRevisionId:'p10-2-rt-forward-extend'}
  );
  assert.equal(triplet.restBalance.kind,'EXTENDED_ADJACENT_REST');

  const restored=executeTripletToStraightThreeUnretimingV4(
    triplet.score,triplet.notation,inverseIntent(triplet.score),{nextRevisionId:'p10-2-rt-inverse-extend'}
  );
  assert.deepEqual(musicSnapshot(restored.score,restored.notation),original);
  assert.deepEqual(voice(restored.score).events.map(event=>event.id),['e1','e2','e3','tail']);
});

test('P10-2 round trip removes the deterministic residual rest created by forward retiming before a pitched next event',()=>{
  const source=state(straight(note('next','next-note',{numerator:3,denominator:8},{numerator:1,denominator:8},'F')));
  const original=musicSnapshot(source.score,source.notation);

  const triplet=executeStraightThreeToTripletAuthoringV4(
    source.score,source.notation,forwardIntent(source.score),{nextRevisionId:'p10-2-rt-forward-residual'}
  );
  assert.equal(triplet.restBalance.kind,'CREATED_RESIDUAL_REST');
  assert.match(triplet.restBalance.restEventId,/^tuplet-rest:[0-9a-f]{16}$/);

  const restored=executeTripletToStraightThreeUnretimingV4(
    triplet.score,triplet.notation,inverseIntent(triplet.score),{nextRevisionId:'p10-2-rt-inverse-residual'}
  );
  assert.deepEqual(musicSnapshot(restored.score,restored.notation),original);
  assert.deepEqual(voice(restored.score).events.map(event=>event.id),['e1','e2','e3','next']);
});
