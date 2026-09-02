import test from 'node:test';
import assert from 'node:assert/strict';

import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { addressEntity } from '../dist/packages/addressing/src/index.js';
import {
  createNotationDocument,
  notationForEvent,
  notationForMeasure,
  notationForNote
} from '../dist/packages/notation-structure/src/index.js';
import {
  importMusicXmlWithMeasureSemantics,
  importNotationMusicXml,
  MusicXmlError,
  serializeNotationMusicXml
} from '../dist/packages/musicxml/src/index.js';

const score=()=>createScoreDocument({
  schemaVersion:'1.0.0',id:'source-doc',revision:{id:'source-rev',parentId:null},source:{sha256:'a'.repeat(64),format:'canonical',byteLength:null},
  parts:[{id:'part-1',name:'Violin',staves:[{id:'staff-1',ordinal:1,measures:[{id:'measure-1',ordinal:1,displayNumber:'1',voices:[{id:'voice-1',ordinal:1,events:[
    {id:'event-1',kind:'note',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:8},note:{id:'note-1',pitch:{step:'F',alter:1,octave:4}}},
    {id:'event-2',kind:'note',onset:{numerator:1,denominator:8},duration:{numerator:1,denominator:8},note:{id:'note-2',pitch:{step:'F',alter:1,octave:4}}},
    {id:'event-3',kind:'note',onset:{numerator:1,denominator:4},duration:{numerator:1,denominator:12},note:{id:'note-3',pitch:{step:'A',alter:0,octave:4}}}
  ]}]}]}]}]
});

const notation=(s)=>createNotationDocument(s,{
  contractVersion:'1.0.0',documentId:s.id,revisionId:s.revision.id,
  measures:[{target:addressEntity(s,'measure-1'),notation:{timeSignature:{beats:6,beatType:8},keySignature:{fifths:1},clef:{sign:'G',line:2,octaveChange:0},barlines:[{location:'right',style:'light-heavy',repeat:'backward'}]}}],
  events:[
    {target:addressEntity(s,'event-1'),notation:{dots:1,beams:[{number:1,value:'begin'}],tuplet:null}},
    {target:addressEntity(s,'event-2'),notation:{dots:0,beams:[{number:1,value:'end'}],tuplet:null}},
    {target:addressEntity(s,'event-3'),notation:{dots:0,beams:[],tuplet:{actualNotes:3,normalNotes:2,marks:[{number:1,type:'start'}]}}}
  ],
  notes:[
    {target:addressEntity(s,'note-1'),notation:{accidental:'sharp',ties:[{number:1,type:'start'}],slurs:[{number:1,type:'start'}]}},
    {target:addressEntity(s,'note-2'),notation:{accidental:'sharp',ties:[{number:1,type:'stop'}],slurs:[{number:1,type:'stop'}]}}
  ]
});

const options=(xml)=>({source:{sha256:'b'.repeat(64),format:'musicxml',byteLength:new TextEncoder().encode(xml).byteLength},documentId:'roundtrip-doc',revisionId:'roundtrip-rev'});

test('notation serializer profile round-trips score and admitted notation semantics',()=>{
  const s=score(),n=notation(s),xml=serializeNotationMusicXml(s,n);
  const result=importNotationMusicXml(xml,options(xml));
  const voice=result.score.parts[0].staves[0].measures[0].voices[0];
  assert.deepEqual(voice.events.map((event)=>({kind:event.kind,onset:event.onset,duration:event.duration,pitch:event.kind==='note'?event.note.pitch:null})),[
    {kind:'note',onset:{numerator:0,denominator:1},duration:{numerator:1,denominator:8},pitch:{step:'F',alter:1,octave:4}},
    {kind:'note',onset:{numerator:1,denominator:8},duration:{numerator:1,denominator:8},pitch:{step:'F',alter:1,octave:4}},
    {kind:'note',onset:{numerator:1,denominator:4},duration:{numerator:1,denominator:12},pitch:{step:'A',alter:0,octave:4}}
  ]);
  assert.deepEqual(notationForMeasure(result.notation,'measure-1-1-1'),{timeSignature:{beats:6,beatType:8},keySignature:{fifths:1},clef:{sign:'G',line:2,octaveChange:0},barlines:[{location:'right',style:'light-heavy',repeat:'backward'}]});
  assert.deepEqual(notationForEvent(result.notation,'event-1-1-1-1-1'),{dots:1,beams:[{number:1,value:'begin'}],tuplet:null});
  assert.deepEqual(notationForEvent(result.notation,'event-1-1-1-1-2'),{dots:0,beams:[{number:1,value:'end'}],tuplet:null});
  assert.deepEqual(notationForEvent(result.notation,'event-1-1-1-1-3'),{dots:0,beams:[],tuplet:{actualNotes:3,normalNotes:2,marks:[{number:1,type:'start'}]}});
  assert.deepEqual(notationForNote(result.notation,'note-1-1-1-1-1-1'),{accidental:'sharp',ties:[{number:1,type:'start'}],slurs:[{number:1,type:'start'}]});
  assert.deepEqual(notationForNote(result.notation,'note-1-1-1-1-2-1'),{accidental:'sharp',ties:[{number:1,type:'stop'}],slurs:[{number:1,type:'stop'}]});
  assert.equal(result.measureSemantics.measures[0].effectiveTimeSignature.beats,6);
});

test('legacy measure-semantics importer remains fail-closed for notation-rich serializer output',()=>{
  const s=score(),xml=serializeNotationMusicXml(s,notation(s));
  assert.throws(()=>importMusicXmlWithMeasureSemantics(xml,options(xml)),(error)=>error instanceof MusicXmlError&&error.code==='UNSUPPORTED_MUSICXML');
});

test('notation importer rejects disagreement between MusicXML tie playback and notation marks',()=>{
  const s=score(),xml=serializeNotationMusicXml(s,notation(s));
  const broken=xml.replace('        <tied type="start" number="1"/>\n','');
  assert.throws(()=>importNotationMusicXml(broken,options(broken)),(error)=>error instanceof MusicXmlError&&error.code==='INVALID_MUSICXML_SEMANTICS');
});
