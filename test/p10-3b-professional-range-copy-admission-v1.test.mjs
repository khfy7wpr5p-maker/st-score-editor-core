import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import {
  createNotationDocumentV4,
  emptyNotationDocumentV4
} from '../dist/packages/notation-structure-v4/src/index.js';
import { createMeasureFrameAuthoringStandaloneScoreEditorController } from '../dist/packages/score-editor-browser-app/src/measure-frame-authoring.js';
import {
  createEventSetProfessionalSelectionV1,
  createEventSpanProfessionalSelectionV1
} from '../dist/packages/editor-professional-selection-v1/src/index.js';
import {
  ProfessionalRangeReplaceV1Error,
  analyzeProfessionalRangeReplaceV1,
  createProfessionalRangeCopySnapshotV1
} from '../dist/packages/editor-professional-range-replace-v1/src/index.js';

if (globalThis.crypto === undefined || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const q=(numerator,denominator)=>({numerator,denominator});
const pitch=(step='C',alter=0,octave=4)=>({step,alter,octave});
const note=(id,noteId,onset,duration,step='C')=>({
  id,kind:'note',onset,duration,note:{id:noteId,pitch:pitch(step)}
});
const rest=(id,onset,duration)=>({id,kind:'rest',onset,duration});
const chord=(id,onset,duration,defs)=>({
  id,kind:'chord',onset,duration,
  notes:defs.map(([noteId,step,alter=0,octave=4])=>({id:noteId,pitch:pitch(step,alter,octave)}))
});
const eventNotation=(overrides={})=>({
  dots:0,beams:[],tuplet:null,articulations:[],ornaments:[],...overrides
});
const noteNotation=(overrides={})=>({
  accidental:null,ties:[],slurs:[],...overrides
});

const fixture=({sourceGap=false,destinationGap=false,graceDestination=false}={})=>{
  const controller=createMeasureFrameAuthoringStandaloneScoreEditorController();
  controller.newDocument({preset:'PIANO_GRAND_STAFF'});
  controller.appendMeasure();
  const raw=structuredClone(controller.getDocument().session.history.present.score);
  const staves=raw.parts[0].staves.filter(staff=>staff.role==='standard');
  const treble=staves[0];
  const bass=staves[1];

  treble.measures[0].voices[0].events=[
    note('src-a','src-na',q(0,1),q(1,4),'C'),
    chord(
      'src-b',
      sourceGap?q(3,8):q(1,4),
      sourceGap?q(1,8):q(1,4),
      [['src-nb1','E'],['src-nb2','G']]
    ),
    note('dst-a','dst-na',q(1,2),q(1,8),'A'),
    rest(
      'dst-b',
      destinationGap?q(11,16):q(5,8),
      destinationGap?q(1,16):q(1,8)
    ),
    chord('dst-c',q(3,4),q(1,8),[['dst-nc1','C'],['dst-nc2','E']]),
    note('dst-d','dst-nd',q(7,8),q(1,8),'B')
  ];

  treble.measures[1].voices[0].events=[
    note('m2-a','m2-na',q(0,1),q(1,2),'D'),
    note('m2-b','m2-nb',q(1,2),q(1,2),'F')
  ];

  bass.measures[0].voices[0].events=[
    note('bass-a','bass-na',q(0,1),q(1,2),'C'),
    note('bass-b','bass-nb',q(1,2),q(1,2),'G')
  ];

  if(graceDestination){
    treble.measures[0].voices[0].graceGroups=[{
      id:'dst-grace-group',
      anchorEventId:'dst-a',
      placement:'before',
      events:[{
        id:'dst-grace-event',
        kind:'note',
        writtenDuration:q(1,8),
        playback:{stealTimePreviousPercent:null,stealTimeFollowingPercent:null,makeTime:null},
        note:{id:'dst-grace-note',pitch:pitch('D')}
      }]
    }];
  }

  return createScoreDocumentV3(raw);
};

const span=(score,start='src-a',stop='src-b')=>
  createEventSpanProfessionalSelectionV1(
    score,
    addressEntityV3(score,start),
    addressEntityV3(score,stop)
  );

const destination=(score,start='dst-a',stop='dst-d')=>span(score,start,stop);

const safeNotation=score=>{
  const empty=emptyNotationDocumentV4(score);
  return createNotationDocumentV4(score,{
    ...empty,
    events:[
      {
        target:addressEntityV3(score,'src-a'),
        notation:eventNotation({
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
        notation:eventNotation({dots:1})
      }
    ],
    notes:[
      {
        target:addressEntityV3(score,'src-na'),
        notation:noteNotation({accidental:'natural'})
      },
      {
        target:addressEntityV3(score,'dst-na'),
        notation:noteNotation({accidental:'sharp'})
      }
    ]
  });
};

const copy=(score,notation=safeNotation(score),selection=span(score))=>
  createProfessionalRangeCopySnapshotV1(score,notation,selection);

const relationNotation=(score,kind)=>{
  const empty=emptyNotationDocumentV4(score);
  if(kind==='tie'){
    return createNotationDocumentV4(score,{
      ...empty,
      notes:[
        {target:addressEntityV3(score,'dst-na'),notation:noteNotation({ties:[{number:1,type:'start'}]})},
        {target:addressEntityV3(score,'dst-nc1'),notation:noteNotation({ties:[{number:1,type:'stop'}]})}
      ]
    });
  }
  if(kind==='slur'){
    return createNotationDocumentV4(score,{
      ...empty,
      notes:[
        {target:addressEntityV3(score,'dst-na'),notation:noteNotation({slurs:[{number:2,type:'start'}]})},
        {target:addressEntityV3(score,'dst-nc1'),notation:noteNotation({slurs:[{number:2,type:'stop'}]})}
      ]
    });
  }
  if(kind==='beam'){
    return createNotationDocumentV4(score,{
      ...empty,
      events:[
        {target:addressEntityV3(score,'dst-a'),notation:eventNotation({beams:[{number:1,value:'begin'}]})},
        {target:addressEntityV3(score,'dst-c'),notation:eventNotation({beams:[{number:1,value:'end'}]})}
      ]
    });
  }
  if(kind==='tuplet'){
    return createNotationDocumentV4(score,{
      ...empty,
      events:[
        {target:addressEntityV3(score,'dst-a'),notation:eventNotation({tuplet:{actualNotes:3,normalNotes:2,marks:[{number:1,type:'start'}]}})},
        {target:addressEntityV3(score,'dst-b'),notation:eventNotation({tuplet:{actualNotes:3,normalNotes:2,marks:[]}})},
        {target:addressEntityV3(score,'dst-c'),notation:eventNotation({tuplet:{actualNotes:3,normalNotes:2,marks:[{number:1,type:'stop'}]}})}
      ]
    });
  }
  if(kind==='spanning-ornament'){
    return createNotationDocumentV4(score,{
      ...empty,
      events:[
        {target:addressEntityV3(score,'dst-a'),notation:eventNotation({ornaments:[{kind:'wavy-line',type:'start',number:1,placement:'above'}]})},
        {target:addressEntityV3(score,'dst-c'),notation:eventNotation({ornaments:[{kind:'wavy-line',type:'stop',number:1,placement:'above'}]})}
      ]
    });
  }
  if(kind==='cross-staff'){
    const staff=score.parts[0].staves.filter(item=>item.role==='standard')[1];
    return createNotationDocumentV4(score,{
      ...empty,
      crossStaffPlacements:[{source:addressEntityV3(score,'dst-a'),displayStaffId:staff.id}]
    });
  }
  throw new Error(`unsupported relation fixture: ${kind}`);
};

test('P10-3B Copy adapts one current same-measure professional EVENT_SPAN into TeacherCopySnapshotV4',()=>{
  const score=fixture();
  const notation=safeNotation(score);
  const selection=span(score);
  const beforeScore=structuredClone(score);
  const beforeNotation=structuredClone(notation);
  const snapshot=createProfessionalRangeCopySnapshotV1(score,notation,selection);

  assert.equal(snapshot.kind,'TEACHER_COPY_SNAPSHOT');
  assert.equal(snapshot.sourceDocumentId,score.id);
  assert.equal(snapshot.sourceRevisionId,score.revision.id);
  assert.equal(snapshot.crossesMeasureBoundary,false);
  assert.equal(snapshot.eventCount,2);
  assert.equal(snapshot.noteCount,3);
  assert.equal(snapshot.segments.length,1);
  assert.deepEqual(snapshot.segments[0].events.map(event=>event.sourceEventId),['src-a','src-b']);
  assert.equal(snapshot.segments[0].events[0].notation.articulations[0].kind,'staccato');
  assert.equal(snapshot.segments[0].events[0].notes[0].notation.accidental,'natural');
  assert.equal(snapshot.destinationIdentityAssigned,false);
  assert.equal(snapshot.canonicalMutationAuthority,false);
  assert.equal(snapshot.historyMutationAuthority,false);
  assert.deepEqual(score,beforeScore);
  assert.deepEqual(notation,beforeNotation);
});

test('P10-3B Copy rejects EVENT_SET instead of creating a second clipboard selection model',()=>{
  const score=fixture();
  const notation=safeNotation(score);
  const selection=createEventSetProfessionalSelectionV1(score,[
    addressEntityV3(score,'src-a'),
    addressEntityV3(score,'src-b')
  ]);
  assert.throws(
    ()=>createProfessionalRangeCopySnapshotV1(score,notation,selection),
    error=>error instanceof ProfessionalRangeReplaceV1Error&&error.code==='SELECTION_KIND_UNSUPPORTED'
  );
});

test('P10-3B Copy rejects a source EVENT_SPAN crossing a measure boundary',()=>{
  const score=fixture();
  const notation=safeNotation(score);
  assert.throws(
    ()=>createProfessionalRangeCopySnapshotV1(score,notation,span(score,'src-b','m2-a')),
    error=>error instanceof ProfessionalRangeReplaceV1Error&&error.code==='SOURCE_MEASURE_UNSUPPORTED'
  );
});

test('P10-3B Copy rejects a stale professional selection',()=>{
  const score=fixture();
  const selection=span(score);
  const raw=structuredClone(score);
  raw.revision={id:'p10-3b-newer',parentId:score.revision.id};
  const newer=createScoreDocumentV3(raw);
  const notation=emptyNotationDocumentV4(newer);
  assert.throws(
    ()=>createProfessionalRangeCopySnapshotV1(newer,notation,selection),
    error=>error instanceof ProfessionalRangeReplaceV1Error&&error.code==='SELECTION_STALE_OR_TAMPERED'
  );
});

test('P10-3B Copy maps relation-coupled source failure to fail-closed source relation error',()=>{
  const score=fixture();
  const empty=emptyNotationDocumentV4(score);
  const notation=createNotationDocumentV4(score,{
    ...empty,
    notes:[
      {target:addressEntityV3(score,'src-na'),notation:noteNotation({ties:[{number:1,type:'start'}]})},
      {target:addressEntityV3(score,'src-nb1'),notation:noteNotation({ties:[{number:1,type:'stop'}]})}
    ]
  });
  assert.throws(
    ()=>createProfessionalRangeCopySnapshotV1(score,notation,span(score)),
    error=>error instanceof ProfessionalRangeReplaceV1Error&&error.code==='SOURCE_RELATION_UNSUPPORTED'
  );
});

test('P10-3B admission accepts equal exact extent with different source/destination event counts',()=>{
  const score=fixture();
  const notation=safeNotation(score);
  const snapshot=copy(score,notation);
  const selection=destination(score);
  const admission=analyzeProfessionalRangeReplaceV1(score,notation,snapshot,selection);

  assert.equal(admission.kind,'PROFESSIONAL_RANGE_REPLACE_ADMISSION');
  assert.equal(admission.admitted,true);
  assert.equal(admission.sourceRevisionId,score.revision.id);
  assert.deepEqual(admission.sourceEventIds,['src-a','src-b']);
  assert.deepEqual(admission.destinationEventIds,['dst-a','dst-b','dst-c','dst-d']);
  assert.deepEqual(admission.destinationRemovedNoteIds,['dst-na','dst-nc1','dst-nc2','dst-nd']);
  assert.deepEqual(admission.sourceExtent,q(1,2));
  assert.deepEqual(admission.destinationExtent,q(1,2));
  assert.deepEqual(admission.destinationStart,q(1,2));
  assert.equal(admission.sourceEventIds.length,2);
  assert.equal(admission.destinationEventIds.length,4);
  assert.equal(admission.identityAllocationRequired,true);
  assert.equal(admission.identityAllocationPerformed,false);
  assert.equal(admission.relationRemappingRequired,false);
  assert.equal(admission.canonicalMutationAuthority,false);
  assert.equal(admission.historyMutationAuthority,false);
});

test('P10-3B admission rejects stale copy snapshot after any canonical revision change',()=>{
  const score=fixture();
  const snapshot=copy(score);
  const raw=structuredClone(score);
  raw.revision={id:'p10-3b-rev-2',parentId:score.revision.id};
  const newer=createScoreDocumentV3(raw);
  const notation=emptyNotationDocumentV4(newer);
  assert.throws(
    ()=>analyzeProfessionalRangeReplaceV1(newer,notation,snapshot,destination(newer)),
    error=>error instanceof ProfessionalRangeReplaceV1Error&&error.code==='CLIPBOARD_STALE'
  );
});

test('P10-3B admission rejects destination in another measure',()=>{
  const score=fixture();
  const notation=safeNotation(score);
  const snapshot=copy(score,notation);
  assert.throws(
    ()=>analyzeProfessionalRangeReplaceV1(score,notation,snapshot,span(score,'m2-a','m2-b')),
    error=>error instanceof ProfessionalRangeReplaceV1Error&&error.code==='DESTINATION_MEASURE_UNSUPPORTED'
  );
});

test('P10-3B admission rejects destination outside the source part/staff/Voice scope',()=>{
  const score=fixture();
  const notation=safeNotation(score);
  const snapshot=copy(score,notation);
  assert.throws(
    ()=>analyzeProfessionalRangeReplaceV1(score,notation,snapshot,span(score,'bass-a','bass-b')),
    error=>error instanceof ProfessionalRangeReplaceV1Error&&error.code==='SCOPE_MISMATCH'
  );
});

test('P10-3B admission rejects any source/destination event overlap',()=>{
  const score=fixture();
  const notation=safeNotation(score);
  const snapshot=copy(score,notation);
  assert.throws(
    ()=>analyzeProfessionalRangeReplaceV1(score,notation,snapshot,span(score,'src-b','dst-a')),
    error=>error instanceof ProfessionalRangeReplaceV1Error&&error.code==='SOURCE_DESTINATION_OVERLAP'
  );
});

test('P10-3B admission rejects a duration mismatch without stretch/compress',()=>{
  const score=fixture();
  const notation=safeNotation(score);
  const snapshot=copy(score,notation);
  assert.throws(
    ()=>analyzeProfessionalRangeReplaceV1(score,notation,snapshot,destination(score,'dst-a','dst-c')),
    error=>error instanceof ProfessionalRangeReplaceV1Error&&error.code==='REPLACE_EXTENT_MISMATCH'
  );
});

test('P10-3B admission rejects a hidden source timing gap before comparing extent',()=>{
  const score=fixture({sourceGap:true});
  const notation=safeNotation(score);
  const snapshot=copy(score,notation);
  assert.throws(
    ()=>analyzeProfessionalRangeReplaceV1(score,notation,snapshot,destination(score)),
    error=>error instanceof ProfessionalRangeReplaceV1Error&&error.code==='SOURCE_TIMING_INVALID'
  );
});

test('P10-3B admission rejects a hidden destination timing gap even when outer extent matches',()=>{
  const score=fixture({destinationGap:true});
  const notation=safeNotation(score);
  const snapshot=copy(score,notation);
  assert.throws(
    ()=>analyzeProfessionalRangeReplaceV1(score,notation,snapshot,destination(score)),
    error=>error instanceof ProfessionalRangeReplaceV1Error&&error.code==='DESTINATION_TIMING_INVALID'
  );
});

for(const relation of ['tie','slur','beam','tuplet','spanning-ornament','cross-staff']){
  test(`P10-3B admission rejects destination ${relation} coupling fail closed`,()=>{
    const score=fixture();
    const sourceNotation=safeNotation(score);
    const snapshot=copy(score,sourceNotation);
    const notation=relationNotation(score,relation);
    assert.throws(
      ()=>analyzeProfessionalRangeReplaceV1(score,notation,snapshot,destination(score)),
      error=>error instanceof ProfessionalRangeReplaceV1Error&&error.code==='DESTINATION_RELATION_UNSUPPORTED'
    );
  });
}

test('P10-3B admission rejects destination grace-group coupling fail closed',()=>{
  const score=fixture({graceDestination:true});
  const notation=emptyNotationDocumentV4(score);
  const snapshot=copy(score,notation);
  assert.throws(
    ()=>analyzeProfessionalRangeReplaceV1(score,notation,snapshot,destination(score)),
    error=>error instanceof ProfessionalRangeReplaceV1Error&&error.code==='DESTINATION_RELATION_UNSUPPORTED'
  );
});

test('P10-3B admission allows supported destination-local notation because Replace removes it atomically',()=>{
  const score=fixture();
  const notation=safeNotation(score);
  const snapshot=copy(score,notation);
  const admission=analyzeProfessionalRangeReplaceV1(score,notation,snapshot,destination(score));
  assert.equal(admission.admitted,true);
});
