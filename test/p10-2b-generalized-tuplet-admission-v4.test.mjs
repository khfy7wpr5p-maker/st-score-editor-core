import test from 'node:test';
import assert from 'node:assert/strict';

import { addressEntityV3 } from '../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4 } from '../dist/packages/notation-structure-v4/src/index.js';
import { createNewScoreEditorAppDocument } from '../dist/packages/score-editor-app-document/src/index.js';
import {
  analyzeGeneralizedTupletToStraightV4,
  FOUR_TO_THREE_TUPLET_PROFILE_V4
} from '../dist/packages/editor-generalized-tuplet-admission-v4/src/index.js';

const ids=()=>{let n=0;return()=>`p10-2b-${++n}`;};
const pitch=(step='C',alter=0,octave=4)=>({step,alter,octave});
const note=(id,noteId,onset,duration,step='C')=>({id,kind:'note',onset,duration,note:{id:noteId,pitch:pitch(step)}});
const rest=(id,onset,duration)=>({id,kind:'rest',onset,duration});
const eventNotation=(overrides={})=>({dots:0,beams:[],tuplet:null,articulations:[],ornaments:[],...overrides});
const noteNotation=(overrides={})=>({accidental:null,ties:[],slurs:[],...overrides});
const tupletNotation=(actualNotes,normalNotes,marks)=>eventNotation({tuplet:{actualNotes,normalNotes,marks}});

const fourToThree=(position,number=1)=>eventNotation({
  tuplet:{
    actualNotes:4,
    normalNotes:3,
    marks:position==='middle'?[]:[{number,type:position}]
  }
});

const state=({
  events,
  eventNotationById={},
  noteNotationById={},
  preset='GUITAR_TREBLE',
  crossStaffPlacements=[],
  mutateRaw=()=>{}
})=>{
  const document=createNewScoreEditorAppDocument({idFactory:ids(),preset});
  const baseScore=document.session.history.present.score;
  const baseNotation=document.session.history.present.notation;
  const raw=structuredClone(baseScore);
  const sourceStaff=raw.parts[0].staves.find(staff=>staff.role==='standard');
  sourceStaff.measures[0].voices[0].events=events;
  mutateRaw(raw);
  const score=createScoreDocumentV3(raw);
  const frames=baseNotation.frames.map(entry=>({
    target:addressEntityV3(score,entry.target.frameId),
    notation:entry.notation
  }));
  const measures=baseNotation.measures.map(entry=>({
    target:addressEntityV3(score,entry.target.measureId),
    notation:entry.notation
  }));
  const eventsNotation=Object.entries(eventNotationById).map(([eventId,notation])=>({
    target:addressEntityV3(score,eventId),notation
  }));
  const notesNotation=Object.entries(noteNotationById).map(([noteId,notation])=>({
    target:addressEntityV3(score,noteId),notation
  }));
  const placements=crossStaffPlacements.map(({eventId,displayStaffIndex})=>{
    const standard=score.parts[0].staves.filter(staff=>staff.role==='standard');
    return {source:addressEntityV3(score,eventId),displayStaffId:standard[displayStaffIndex].id};
  });
  const notation=createNotationDocumentV4(score,{
    contractVersion:'4.0.0',
    documentId:score.id,
    revisionId:score.revision.id,
    frames,
    measures,
    events:eventsNotation,
    notes:notesNotation,
    graceEvents:[],
    graceNotes:[],
    crossStaffPlacements:placements
  });
  return {score,notation};
};

const targets=(score,...eventIds)=>eventIds.map(eventId=>{
  const target=addressEntityV3(score,eventId);
  assert.equal(target.kind,'event');
  return target;
});

const eighthFourToThree=(restDuration={numerator:1,denominator:8})=>[
  note('e1','n1',{numerator:0,denominator:1},{numerator:3,denominator:32},'C'),
  note('e2','n2',{numerator:3,denominator:32},{numerator:3,denominator:32},'D'),
  note('e3','n3',{numerator:3,denominator:16},{numerator:3,denominator:32},'E'),
  note('e4','n4',{numerator:9,denominator:32},{numerator:3,denominator:32},'F'),
  rest('r1',{numerator:3,denominator:8},restDuration)
];

const fourToThreeNotationById=()=>({
  e1:fourToThree('start'),
  e2:fourToThree('middle'),
  e3:fourToThree('middle'),
  e4:fourToThree('stop')
});

test('P10-2B admits exact four-event 4:3 timing and returns immutable straight-four evidence',()=>{
  const {score,notation}=state({
    events:eighthFourToThree(),
    eventNotationById:fourToThreeNotationById()
  });
  const beforeScore=structuredClone(score);
  const beforeNotation=structuredClone(notation);
  const result=analyzeGeneralizedTupletToStraightV4(
    score,
    notation,
    targets(score,'e1','e2','e3','e4'),
    FOUR_TO_THREE_TUPLET_PROFILE_V4
  );

  assert.equal(result.admitted,true);
  assert.equal(result.reason,'ADMITTED_4_TO_3_TO_STRAIGHT_FOUR');
  assert.deepEqual(result.currentTupletDuration,{numerator:3,denominator:32});
  assert.deepEqual(result.restoredWrittenBase,{numerator:1,denominator:8});
  assert.deepEqual(result.eventPlans.map(plan=>({
    id:plan.eventId,
    onset:plan.proposedOnset,
    duration:plan.proposedDuration
  })),[
    {id:'e1',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:8}},
    {id:'e2',onset:{numerator:1,denominator:8},duration:{numerator:1,denominator:8}},
    {id:'e3',onset:{numerator:1,denominator:4},duration:{numerator:1,denominator:8}},
    {id:'e4',onset:{numerator:3,denominator:8},duration:{numerator:1,denominator:8}}
  ]);
  assert.deepEqual(result.currentGroupEnd,{numerator:3,denominator:8});
  assert.deepEqual(result.proposedGroupEnd,{numerator:1,denominator:2});
  assert.deepEqual(result.requiredGrowthInterval,{
    onset:{numerator:3,denominator:8},
    duration:{numerator:1,denominator:8},
    end:{numerator:1,denominator:2}
  });
  assert.equal(result.atomicMutationRequired,true);
  assert.equal(result.canonicalMutationAuthority,false);
  assert.equal(result.historyMutationAuthority,false);
  assert.equal(result.rendererCoordinateAuthority,false);
  assert.equal(Object.isFrozen(result),true);
  assert.deepEqual(score,beforeScore);
  assert.deepEqual(notation,beforeNotation);
});


const analyze=(score,notation,ids=['e1','e2','e3','e4'])=>
  analyzeGeneralizedTupletToStraightV4(
    score,
    notation,
    targets(score,...ids),
    FOUR_TO_THREE_TUPLET_PROFILE_V4
  );

const validState=(overrides={})=>state({
  events:eighthFourToThree(),
  eventNotationById:fourToThreeNotationById(),
  ...overrides
});

test('P10-2B fails closed for wrong cardinality, wrong target kind and duplicate targets',()=>{
  const {score,notation}=validState();
  const exact=targets(score,'e1','e2','e3','e4');

  let result=analyzeGeneralizedTupletToStraightV4(
    score,notation,exact.slice(0,3),FOUR_TO_THREE_TUPLET_PROFILE_V4
  );
  assert.equal(result.admitted,false);
  assert.equal(result.reason,'BLOCKED_WRONG_CARDINALITY');

  const partAddress=addressEntityV3(score,score.parts[0].id);
  result=analyzeGeneralizedTupletToStraightV4(
    score,notation,[partAddress,exact[1],exact[2],exact[3]],FOUR_TO_THREE_TUPLET_PROFILE_V4
  );
  assert.equal(result.admitted,false);
  assert.equal(result.reason,'BLOCKED_TARGET_KIND');

  result=analyzeGeneralizedTupletToStraightV4(
    score,notation,[exact[0],exact[1],exact[1],exact[3]],FOUR_TO_THREE_TUPLET_PROFILE_V4
  );
  assert.equal(result.admitted,false);
  assert.equal(result.reason,'BLOCKED_DUPLICATE_TARGET');
});

test('P10-2B never sorts reordered or nonconsecutive targets',()=>{
  const {score,notation}=validState();

  let result=analyzeGeneralizedTupletToStraightV4(
    score,notation,targets(score,'e2','e1','e3','e4'),FOUR_TO_THREE_TUPLET_PROFILE_V4
  );
  assert.equal(result.admitted,false);
  assert.equal(result.reason,'BLOCKED_REORDERED_OR_NONCONSECUTIVE_TARGET');

  result=analyzeGeneralizedTupletToStraightV4(
    score,notation,targets(score,'e1','e2','e4','r1'),FOUR_TO_THREE_TUPLET_PROFILE_V4
  );
  assert.equal(result.admitted,false);
  assert.equal(result.reason,'BLOCKED_REORDERED_OR_NONCONSECUTIVE_TARGET');
});

test('P10-2B rejects stale current-revision targets without throwing',()=>{
  const current=validState();
  const stale=targets(current.score,'e1','e2','e3','e4');
  const raw=structuredClone(current.score);
  raw.revision={id:'p10-2b-new-revision',parentId:current.score.revision.id};
  const nextScore=createScoreDocumentV3(raw);
  const nextNotation=createNotationDocumentV4(nextScore,{
    contractVersion:'4.0.0',
    documentId:nextScore.id,
    revisionId:nextScore.revision.id,
    frames:current.notation.frames.map(entry=>({
      target:addressEntityV3(nextScore,entry.target.frameId),
      notation:entry.notation
    })),
    measures:current.notation.measures.map(entry=>({
      target:addressEntityV3(nextScore,entry.target.measureId),
      notation:entry.notation
    })),
    events:current.notation.events.map(entry=>({
      target:addressEntityV3(nextScore,entry.target.eventId),
      notation:entry.notation
    })),
    notes:[],
    graceEvents:[],
    graceNotes:[],
    crossStaffPlacements:[]
  });
  const result=analyzeGeneralizedTupletToStraightV4(
    nextScore,nextNotation,stale,FOUR_TO_THREE_TUPLET_PROFILE_V4
  );
  assert.equal(result.admitted,false);
  assert.equal(result.reason,'BLOCKED_STALE_TARGET');
});

test('P10-2B rejects valid targets from another Voice, staff, frame/measure or part',()=>{
  let current=validState({
    mutateRaw:(raw)=>{
      const measure=raw.parts[0].staves.find(staff=>staff.role==='standard').measures[0];
      const foreign=structuredClone(measure.voices[0]);
      foreign.id='foreign-voice';
      foreign.ordinal=2;
      foreign.events=[note('foreign-voice-event','foreign-voice-note',{numerator:0,denominator:1},{numerator:1,denominator:1},'G')];
      measure.voices.push(foreign);
    }
  });
  let result=analyzeGeneralizedTupletToStraightV4(
    current.score,current.notation,
    [...targets(current.score,'e1','e2','e3'),addressEntityV3(current.score,'foreign-voice-event')],
    FOUR_TO_THREE_TUPLET_PROFILE_V4
  );
  assert.equal(result.reason,'BLOCKED_CROSS_SCOPE_TARGET');

  current=validState({
    preset:'PIANO_GRAND_STAFF',
    mutateRaw:(raw)=>{
      const staves=raw.parts[0].staves.filter(staff=>staff.role==='standard');
      staves[1].measures[0].voices[0].events=[note('foreign-staff-event','foreign-staff-note',{numerator:0,denominator:1},{numerator:1,denominator:1},'A')];
    }
  });
  result=analyzeGeneralizedTupletToStraightV4(
    current.score,current.notation,
    [...targets(current.score,'e1','e2','e3'),addressEntityV3(current.score,'foreign-staff-event')],
    FOUR_TO_THREE_TUPLET_PROFILE_V4
  );
  assert.equal(result.reason,'BLOCKED_CROSS_SCOPE_TARGET');

  current=validState({
    mutateRaw:(raw)=>{
      const frame=structuredClone(raw.measureFrames[0]);
      frame.id='foreign-frame';
      frame.ordinal=2;
      frame.displayNumber='2';
      raw.measureFrames.push(frame);
      for(const staff of raw.parts[0].staves.filter(item=>item.role==='standard')){
        const measure=structuredClone(staff.measures[0]);
        measure.id=`${staff.id}-foreign-measure`;
        measure.frameId=frame.id;
        measure.voices=measure.voices.map((voice,index)=>({
          ...voice,
          id:`${voice.id}-foreign-${index}`,
          events:[note('foreign-frame-event','foreign-frame-note',{numerator:0,denominator:1},{numerator:1,denominator:1},'B')]
        }));
        staff.measures.push(measure);
      }
    }
  });
  result=analyzeGeneralizedTupletToStraightV4(
    current.score,current.notation,
    [...targets(current.score,'e1','e2','e3'),addressEntityV3(current.score,'foreign-frame-event')],
    FOUR_TO_THREE_TUPLET_PROFILE_V4
  );
  assert.equal(result.reason,'BLOCKED_CROSS_SCOPE_TARGET');

  current=validState({
    mutateRaw:(raw)=>{
      const source=raw.parts[0];
      const foreign=structuredClone(source);
      foreign.id='foreign-part';
      foreign.ordinal=2;
      foreign.name='Foreign';
      foreign.instrument={...foreign.instrument,id:'foreign-instrument',name:'Foreign'};
      foreign.staves=foreign.staves.map((staff,staffIndex)=>({
        ...staff,
        id:`foreign-staff-${staffIndex+1}`,
        ordinal:staffIndex+1,
        measures:staff.measures.map((measure,measureIndex)=>({
          ...measure,
          id:`foreign-measure-${staffIndex+1}-${measureIndex+1}`,
          voices:measure.voices.map((voice,voiceIndex)=>({
            ...voice,
            id:`foreign-voice-${staffIndex+1}-${measureIndex+1}-${voiceIndex+1}`,
            events:[note('foreign-part-event','foreign-part-note',{numerator:0,denominator:1},{numerator:1,denominator:1},'C')]
          }))
        }))
      }));
      raw.parts.push(foreign);
    }
  });
  result=analyzeGeneralizedTupletToStraightV4(
    current.score,current.notation,
    [...targets(current.score,'e1','e2','e3'),addressEntityV3(current.score,'foreign-part-event')],
    FOUR_TO_THREE_TUPLET_PROFILE_V4
  );
  assert.equal(result.reason,'BLOCKED_CROSS_SCOPE_TARGET');
});


test('P10-2B admits only exact 4:3 notation and distinguishes malformed versus overlapping boundaries',()=>{
  let current=validState({
    eventNotationById:{
      e1:tupletNotation(5,4,[{number:1,type:'start'}]),
      e2:tupletNotation(5,4,[]),
      e3:tupletNotation(5,4,[]),
      e4:tupletNotation(5,4,[{number:1,type:'stop'}])
    }
  });
  let result=analyze(current.score,current.notation);
  assert.equal(result.admitted,false);
  assert.equal(result.reason,'BLOCKED_TUPLET_PROFILE_UNSUPPORTED');

  current=validState({
    eventNotationById:{
      e1:tupletNotation(4,3,[{number:1,type:'start'}]),
      e2:tupletNotation(4,3,[]),
      e3:tupletNotation(4,3,[]),
      e4:tupletNotation(4,3,[{number:2,type:'stop'}])
    }
  });
  result=analyze(current.score,current.notation);
  assert.equal(result.reason,'BLOCKED_TUPLET_BOUNDARY_INVALID');

  current=validState({
    eventNotationById:{
      e1:tupletNotation(4,3,[{number:1,type:'start'},{number:2,type:'start'}]),
      e2:tupletNotation(4,3,[]),
      e3:tupletNotation(4,3,[]),
      e4:tupletNotation(4,3,[{number:1,type:'stop'}])
    }
  });
  result=analyze(current.score,current.notation);
  assert.equal(result.reason,'BLOCKED_NESTED_OR_OVERLAPPING_TUPLET');
});

test('P10-2B rejects invalid current occupancy and unsupported restored written bases',()=>{
  let events=eighthFourToThree();
  events=[
    events[0],
    {...events[1],onset:{numerator:1,denominator:8}},
    events[2],
    events[3],
    events[4]
  ];
  let current=validState({events});
  let result=analyze(current.score,current.notation);
  assert.equal(result.reason,'BLOCKED_CURRENT_TIMING_INVALID');

  events=[
    note('e1','n1',{numerator:0,denominator:1},{numerator:3,denominator:40},'C'),
    note('e2','n2',{numerator:3,denominator:40},{numerator:3,denominator:40},'D'),
    note('e3','n3',{numerator:3,denominator:20},{numerator:3,denominator:40},'E'),
    note('e4','n4',{numerator:9,denominator:40},{numerator:3,denominator:40},'F'),
    rest('r1',{numerator:3,denominator:10},{numerator:1,denominator:10})
  ];
  current=validState({events});
  result=analyze(current.score,current.notation);
  assert.equal(result.reason,'BLOCKED_WRITTEN_BASE_UNSUPPORTED');
});

test('P10-2B converts bounded rational overflow into BLOCKED_ARITHMETIC',()=>{
  const max=Number.MAX_SAFE_INTEGER;
  const events=[
    note('e1','n1',{numerator:0,denominator:1},{numerator:1,denominator:max},'C'),
    note('e2','n2',{numerator:1,denominator:max},{numerator:1,denominator:max},'D'),
    note('e3','n3',{numerator:2,denominator:max},{numerator:1,denominator:max},'E'),
    note('e4','n4',{numerator:3,denominator:max},{numerator:1,denominator:max},'F'),
    rest('r1',{numerator:4,denominator:max},{numerator:1,denominator:max})
  ];
  const current=validState({events});
  const result=analyze(current.score,current.notation);
  assert.equal(result.admitted,false);
  assert.equal(result.reason,'BLOCKED_ARITHMETIC');
});

test('P10-2B fails closed on dots, beams and ties while allowing slurs',()=>{
  let current=validState({
    eventNotationById:{
      ...fourToThreeNotationById(),
      e1:eventNotation({...fourToThree('start'),dots:1})
    }
  });
  let result=analyze(current.score,current.notation);
  assert.equal(result.reason,'BLOCKED_TIMING_COUPLED_DOTS');
  assert.deepEqual(result.couplingReasons,['dots:e1']);

  current=validState({
    eventNotationById:{
      ...fourToThreeNotationById(),
      e2:eventNotation({...fourToThree('middle'),beams:[{number:1,value:'continue'}]})
    }
  });
  result=analyze(current.score,current.notation);
  assert.equal(result.reason,'BLOCKED_TIMING_COUPLED_BEAMS');
  assert.deepEqual(result.couplingReasons,['beams:e2']);

  current=validState({
    noteNotationById:{n3:noteNotation({ties:[{number:1,type:'start'}]})}
  });
  result=analyze(current.score,current.notation);
  assert.equal(result.reason,'BLOCKED_TIMING_COUPLED_TIES');
  assert.deepEqual(result.couplingReasons,['tie:n3']);

  current=validState({
    noteNotationById:{
      n1:noteNotation({slurs:[{number:1,type:'start'}]}),
      n4:noteNotation({slurs:[{number:1,type:'stop'}]})
    }
  });
  result=analyze(current.score,current.notation);
  assert.equal(result.admitted,true);
  assert.deepEqual(result.couplingReasons,[]);
});

test('P10-2B rejects selected cross-staff 4:3 timing',()=>{
  const current=validState({
    preset:'PIANO_GRAND_STAFF',
    crossStaffPlacements:[{eventId:'e4',displayStaffIndex:1}]
  });
  const result=analyze(current.score,current.notation);
  assert.equal(result.admitted,false);
  assert.equal(result.reason,'BLOCKED_CROSS_STAFF_TARGET');
});
