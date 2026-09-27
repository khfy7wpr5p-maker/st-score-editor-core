import { addressEntityV3 } from '../../dist/packages/addressing-v3/src/index.js';
import { createScoreDocumentV3 } from '../../dist/packages/score-model-v3/src/index.js';
import { createNotationDocumentV4 } from '../../dist/packages/notation-structure-v4/src/index.js';
import { createNewScoreEditorAppDocument } from '../../dist/packages/score-editor-app-document/src/index.js';

export const FOUR_TO_THREE_EVENT_IDS=Object.freeze(['e1','e2','e3','e4']);

export const IMPORTED_FOUR_TO_THREE_MUSIC_XML=`<?xml version="1.0" encoding="UTF-8"?>
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

const ids=prefix=>{let n=0;return()=>`${prefix}-${++n}`;};
const note=(id,noteId,onset,duration,step)=>({
  id,kind:'note',onset,duration,note:{id:noteId,pitch:{step,alter:0,octave:4}}
});
const rest=(id,onset,duration)=>({id,kind:'rest',onset,duration});
const eventNotation=(overrides={})=>({
  dots:0,beams:[],tuplet:null,articulations:[],ornaments:[],...overrides
});
const fourToThree=(position,number=1)=>eventNotation({
  tuplet:{
    actualNotes:4,
    normalNotes:3,
    marks:position==='middle'?[]:[{number,type:position}]
  }
});

export const exactFourToThreeIntent=score=>({
  version:'1.0.0',
  type:'UNRETIMING_FOUR_TO_THREE_TO_STRAIGHT_FOUR',
  targets:FOUR_TO_THREE_EVENT_IDS.map(id=>addressEntityV3(score,id))
});

export const createFourToThreeFixture=(options={})=>{
  const prefix=options.idPrefix??'p10-2c';
  const restDuration=options.restDuration??{numerator:1,denominator:8};
  const document=createNewScoreEditorAppDocument({idFactory:ids(prefix),preset:'GUITAR_TREBLE'});
  const baseScore=document.session.history.present.score;
  const baseNotation=document.session.history.present.notation;
  const raw=structuredClone(baseScore);
  const staff=raw.parts[0].staves.find(candidate=>candidate.role==='standard');
  staff.measures[0].voices[0].events=[
    note('e1','n1',{numerator:0,denominator:1},{numerator:3,denominator:32},'C'),
    note('e2','n2',{numerator:3,denominator:32},{numerator:3,denominator:32},'D'),
    note('e3','n3',{numerator:3,denominator:16},{numerator:3,denominator:32},'E'),
    note('e4','n4',{numerator:9,denominator:32},{numerator:3,denominator:32},'F'),
    rest('r1',{numerator:3,denominator:8},restDuration)
  ];
  const score=createScoreDocumentV3(raw);
  const eventNotationById=options.eventNotationById??{};
  const noteNotationById=options.noteNotationById??{};
  const notation=createNotationDocumentV4(score,{
    contractVersion:'4.0.0',
    documentId:score.id,
    revisionId:score.revision.id,
    frames:baseNotation.frames.map(entry=>({
      target:addressEntityV3(score,entry.target.frameId),
      notation:entry.notation
    })),
    measures:baseNotation.measures.map(entry=>({
      target:addressEntityV3(score,entry.target.measureId),
      notation:entry.notation
    })),
    events:[
      {target:addressEntityV3(score,'e1'),notation:{...fourToThree('start'),...(eventNotationById.e1??{})}},
      {target:addressEntityV3(score,'e2'),notation:{...fourToThree('middle'),...(eventNotationById.e2??{})}},
      {target:addressEntityV3(score,'e3'),notation:{...fourToThree('middle'),...(eventNotationById.e3??{})}},
      {target:addressEntityV3(score,'e4'),notation:{...fourToThree('stop'),...(eventNotationById.e4??{})}}
    ],
    notes:Object.entries(noteNotationById).map(([noteId,value])=>({
      target:addressEntityV3(score,noteId),
      notation:{accidental:null,ties:[],slurs:[],...value}
    })),
    graceEvents:[],
    graceNotes:[],
    crossStaffPlacements:[]
  });
  return {score,notation};
};
