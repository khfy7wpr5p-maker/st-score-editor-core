import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import {
  createNotationDocumentV4,
  emptyNotationDocumentV4
} from '../dist/packages/notation-structure-v4/src/index.js';
import {
  ProfessionalRangeReplaceV1Error,
  executeProfessionalRangeReplaceV1
} from '../dist/packages/editor-professional-range-replace-v1/src/index.js';
import {
  createCompactRangeReplaceScore,
  eventNotation,
  noteNotation,
  prepareRangeReplaceFacts,
  q
} from './helpers/p10-3b-fixtures.mjs';

const fixture=()=>createCompactRangeReplaceScore({
  revisionId:'p10-3b-author-rev-1',
  parentId:'p10-3b-author-parent'
});

const notationFixture=score=>{
  const empty=emptyNotationDocumentV4(score);
  const staff=score.parts[0].staves.find(item=>item.role==='standard');
  const measure=staff.measures[0];
  return createNotationDocumentV4(score,{
    ...empty,
    frames:[{
      target:addressEntityV3(score,measure.frameId),
      notation:{timeSignature:{beats:4,beatType:4},barlines:[]}
    }],
    measures:[{
      target:addressEntityV3(score,measure.id),
      notation:{keySignature:{fifths:1},clef:{sign:'G',line:2,octaveChange:0}}
    }],
    events:[
      {
        target:addressEntityV3(score,'src-a'),
        notation:eventNotation({
          dots:1,
          articulations:[{kind:'staccato',placement:'auto',direction:null}]
        })
      },
      {
        target:addressEntityV3(score,'src-b'),
        notation:eventNotation({
          ornaments:[{kind:'trill-mark',placement:'above',accidentalMarks:[]}]
        })
      },
      {
        target:addressEntityV3(score,'dst-a'),
        notation:eventNotation({
          articulations:[{kind:'tenuto',placement:'below',direction:null}]
        })
      },
      {
        target:addressEntityV3(score,'tail'),
        notation:eventNotation({
          ornaments:[{kind:'mordent',placement:'above',accidentalMarks:[]}]
        })
      }
    ],
    notes:[
      {
        target:addressEntityV3(score,'src-na'),
        notation:noteNotation({accidental:'natural'})
      },
      {
        target:addressEntityV3(score,'src-nb1'),
        notation:noteNotation({accidental:'sharp'})
      },
      {
        target:addressEntityV3(score,'dst-na'),
        notation:noteNotation({accidental:'flat'})
      },
      {
        target:addressEntityV3(score,'tail-note'),
        notation:noteNotation({accidental:'natural'})
      }
    ]
  });
};

const prepared=(score=fixture(),backward=false)=>{
  const notation=notationFixture(score);
  return prepareRangeReplaceFacts({
    score,
    notation,
    nextRevisionId:'p10-3b-author-rev-2',
    backward
  });
};

const eventMap=score=>{
  const staff=score.parts[0].staves.find(item=>item.role==='standard');
  return staff.measures[0].voices[0].events;
};

test('P10-3B authoring replaces the exact destination slice with fresh source-derived events without shifting later content',()=>{
  const x=prepared();
  const beforeSource=structuredClone(eventMap(x.score).slice(0,2));
  const beforeTail=structuredClone(eventMap(x.score).find(event=>event.id==='tail'));
  const result=executeProfessionalRangeReplaceV1(
    x.score,x.notation,x.snapshot,x.destination,x.admission,x.identityPlan
  );

  assert.equal(result.score.revision.id,'p10-3b-author-rev-2');
  assert.equal(result.score.revision.parentId,x.score.revision.id);
  assert.deepEqual(eventMap(result.score).slice(0,2),beforeSource);
  assert.deepEqual(eventMap(result.score).find(event=>event.id==='tail'),beforeTail);

  const ids=eventMap(result.score).map(event=>event.id);
  assert.equal(ids.includes('dst-a'),false);
  assert.equal(ids.includes('dst-b'),false);
  assert.equal(ids.includes('dst-c'),false);
  assert.equal(ids.includes('dst-d'),false);
  assert.deepEqual(result.insertedEventIds,x.identityPlan.events.map(item=>item.destinationEventId));
  assert.deepEqual(result.removedDestinationEventIds,['dst-a','dst-b','dst-c','dst-d']);
  assert.deepEqual(result.removedDestinationNoteIds,['dst-na','dst-nc1','dst-nc2','dst-nd']);

  const inserted=eventMap(result.score).filter(event=>result.insertedEventIds.includes(event.id));
  assert.equal(inserted.length,2);
  assert.deepEqual(inserted.map(event=>event.onset),[q(1,4),q(3,8)]);
  assert.deepEqual(inserted.map(event=>event.duration),[q(1,8),q(1,8)]);
  assert.equal(inserted[0].kind,'note');
  assert.equal(inserted[0].note.pitch.step,'C');
  assert.equal(inserted[1].kind,'chord');
  assert.deepEqual(inserted[1].notes.map(noteValue=>noteValue.pitch.step),['E','G']);
  assert.equal(result.historyMutationAuthority,false);
});

test('P10-3B authoring removes destination-local notation, clones safe source-local notation to fresh IDs, and preserves measure/frame/unrelated notation',()=>{
  const x=prepared();
  const result=executeProfessionalRangeReplaceV1(
    x.score,x.notation,x.snapshot,x.destination,x.admission,x.identityPlan
  );
  const firstPlan=x.identityPlan.events[0];
  const secondPlan=x.identityPlan.events[1];

  const firstEventNotation=result.notation.events.find(
    entry=>entry.target.eventId===firstPlan.destinationEventId
  );
  assert.ok(firstEventNotation);
  assert.equal(firstEventNotation.notation.dots,1);
  assert.equal(firstEventNotation.notation.articulations[0].kind,'staccato');

  const secondEventNotation=result.notation.events.find(
    entry=>entry.target.eventId===secondPlan.destinationEventId
  );
  assert.ok(secondEventNotation);
  assert.equal(secondEventNotation.notation.ornaments[0].kind,'trill-mark');

  const firstNoteNotation=result.notation.notes.find(
    entry=>entry.target.noteId===firstPlan.notes[0].destinationNoteId
  );
  assert.ok(firstNoteNotation);
  assert.equal(firstNoteNotation.notation.accidental,'natural');

  const chordNoteNotation=result.notation.notes.find(
    entry=>entry.target.noteId===secondPlan.notes[0].destinationNoteId
  );
  assert.ok(chordNoteNotation);
  assert.equal(chordNoteNotation.notation.accidental,'sharp');

  assert.equal(result.notation.events.some(entry=>entry.target.eventId==='dst-a'),false);
  assert.equal(result.notation.notes.some(entry=>entry.target.noteId==='dst-na'),false);
  assert.equal(result.notation.events.some(entry=>entry.target.eventId==='tail'),true);
  assert.equal(result.notation.notes.some(entry=>entry.target.noteId==='tail-note'),true);
  assert.deepEqual(result.notation.frames[0].notation,{timeSignature:{beats:4,beatType:4},barlines:[]});
  assert.deepEqual(result.notation.measures[0].notation,{keySignature:{fifths:1},clef:{sign:'G',line:2,octaveChange:0}});
  assert.equal(result.notation.revisionId,result.score.revision.id);
});

test('P10-3B authoring builds a fresh replacement EVENT_SPAN over all inserted events and preserves forward direction',()=>{
  const x=prepared();
  const result=executeProfessionalRangeReplaceV1(
    x.score,x.notation,x.snapshot,x.destination,x.admission,x.identityPlan
  );
  assert.equal(result.selection.kind,'EVENT_SPAN');
  assert.equal(result.selection.direction,'FORWARD');
  assert.deepEqual(
    result.selection.targets.map(target=>target.eventId),
    result.insertedEventIds
  );
  assert.equal(result.selection.anchor.eventId,result.insertedEventIds[0]);
  assert.equal(result.selection.focus.eventId,result.insertedEventIds.at(-1));
  assert.equal(result.selection.anchor.revisionId,result.score.revision.id);
  assert.equal(result.selection.focus.revisionId,result.score.revision.id);
});

test('P10-3B authoring preserves backward destination selection direction while selecting the fresh replacement span',()=>{
  const x=prepared(fixture(),true);
  const result=executeProfessionalRangeReplaceV1(
    x.score,x.notation,x.snapshot,x.destination,x.admission,x.identityPlan
  );
  assert.equal(result.selection.direction,'BACKWARD');
  assert.equal(result.selection.anchor.eventId,result.insertedEventIds.at(-1));
  assert.equal(result.selection.focus.eventId,result.insertedEventIds[0]);
  assert.deepEqual(result.selection.targets.map(target=>target.eventId),result.insertedEventIds);
});

test('P10-3B authoring rejects a tampered identity plan before canonical mutation',()=>{
  const x=prepared();
  const beforeScore=structuredClone(x.score);
  const beforeNotation=structuredClone(x.notation);
  const tampered=structuredClone(x.identityPlan);
  tampered.events[0].destinationEventId='replace-event:tampered';

  assert.throws(
    ()=>executeProfessionalRangeReplaceV1(
      x.score,x.notation,x.snapshot,x.destination,x.admission,tampered
    ),
    error=>error instanceof ProfessionalRangeReplaceV1Error&&error.code==='IDENTITY_PLAN_STALE_OR_INVALID'
  );
  assert.deepEqual(x.score,beforeScore);
  assert.deepEqual(x.notation,beforeNotation);
});

test('P10-3B authoring rejects relation-coupled notation injected into the snapshot payload',()=>{
  const x=prepared();
  const tampered=structuredClone(x.snapshot);
  tampered.segments[0].events[0].notation={
    dots:0,
    beams:[{number:1,value:'begin'}],
    tuplet:null,
    articulations:[],
    ornaments:[]
  };
  assert.throws(
    ()=>executeProfessionalRangeReplaceV1(
      x.score,x.notation,tampered,x.destination,x.admission,x.identityPlan
    ),
    error=>error instanceof ProfessionalRangeReplaceV1Error&&
      ['ADMISSION_STALE_OR_TAMPERED','SOURCE_RELATION_UNSUPPORTED','IDENTITY_PLAN_STALE_OR_INVALID'].includes(error.code)
  );
});