import test from 'node:test';
import assert from 'node:assert/strict';

import { createScoreDocument } from '../dist/packages/score-model/src/index.js';
import { addressEntity } from '../dist/packages/addressing/src/index.js';
import { createNotationDocument, NotationError } from '../dist/packages/notation-structure/src/index.js';
import { createMusicXmlProcessingRuntime, parseMusicXmlTree, serializeNotationMusicXml } from '../dist/packages/musicxml/src/index.js';

const score = () => createScoreDocument({
  schemaVersion:'1.0.0',id:'doc-1',revision:{id:'rev-1',parentId:null},source:{sha256:'a'.repeat(64),format:'canonical',byteLength:null},
  parts:[{id:'part-1',name:'Violin',staves:[{id:'staff-1',ordinal:1,measures:[{id:'measure-1',ordinal:1,displayNumber:'1',voices:[{id:'voice-1',ordinal:1,events:[
    {id:'event-1',kind:'note',onset:{numerator:0,denominator:1},duration:{numerator:3,denominator:8},note:{id:'note-1',pitch:{step:'F',alter:1,octave:4}}},
    {id:'event-2',kind:'note',onset:{numerator:3,denominator:8},duration:{numerator:1,denominator:8},note:{id:'note-2',pitch:{step:'G',alter:0,octave:4}}},
    {id:'event-3',kind:'note',onset:{numerator:1,denominator:2},duration:{numerator:1,denominator:12},note:{id:'note-3',pitch:{step:'A',alter:0,octave:4}}}
  ]}]}]}]}]
});

const notationFor = (s) => createNotationDocument(s, {
  contractVersion:'1.0.0',documentId:s.id,revisionId:s.revision.id,
  measures:[{target:addressEntity(s,'measure-1'),notation:{
    timeSignature:{beats:6,beatType:8},keySignature:{fifths:1},clef:{sign:'G',line:2,octaveChange:0},
    barlines:[{location:'right',style:'light-heavy',repeat:'backward'}]
  }}],
  events:[
    {target:addressEntity(s,'event-1'),notation:{dots:1,beams:[{number:1,value:'begin'}],tuplet:null}},
    {target:addressEntity(s,'event-2'),notation:{dots:0,beams:[{number:1,value:'end'}],tuplet:null}},
    {target:addressEntity(s,'event-3'),notation:{dots:0,beams:[],tuplet:{actualNotes:3,normalNotes:2,marks:[{number:1,type:'start'}]}}}
  ],
  notes:[
    {target:addressEntity(s,'note-1'),notation:{accidental:'sharp',ties:[{number:1,type:'start'}],slurs:[{number:1,type:'start'}]}},
    {target:addressEntity(s,'note-2'),notation:{accidental:null,ties:[{number:1,type:'stop'}],slurs:[{number:1,type:'stop'}]}}
  ]
});

test('canonical notation document is revision-bound and immutable',()=>{
  const s=score();const n=notationFor(s);
  assert.equal(n.documentId,'doc-1');assert.equal(n.revisionId,'rev-1');assert.equal(Object.isFrozen(n),true);assert.equal(Object.isFrozen(n.events),true);
});

test('notation-aware serializer emits core notation structures and well-formed XML',()=>{
  const s=score();const xml=serializeNotationMusicXml(s,notationFor(s));
  for(const fragment of ['<fifths>1</fifths>','<beats>6</beats>','<beat-type>8</beat-type>','<sign>G</sign>','<line>2</line>','<dot/>','<accidental>sharp</accidental>','<tie type="start"/>','<tied type="start" number="1"/>','<slur type="start" number="1"/>','<beam number="1">begin</beam>','<actual-notes>3</actual-notes>','<normal-notes>2</normal-notes>','<tuplet type="start" number="1"/>','<bar-style>light-heavy</bar-style>','<repeat direction="backward"/>']) assert.ok(xml.includes(fragment),fragment);
  const parsed=parseMusicXmlTree(xml,createMusicXmlProcessingRuntime({}));
  assert.equal(parsed.document.root.name,'score-partwise');
});

test('stale notation document is rejected against a new score revision',()=>{
  const s=score();const old=notationFor(s);const next=createScoreDocument({...s,revision:{id:'rev-2',parentId:'rev-1'}});
  assert.throws(()=>serializeNotationMusicXml(next,old),(error)=>error instanceof NotationError&&error.code==='STALE_NOTATION');
});

test('invalid beam duplication and invalid time denominator fail closed',()=>{
  const s=score();
  assert.throws(()=>createNotationDocument(s,{contractVersion:'1.0.0',documentId:s.id,revisionId:s.revision.id,measures:[{target:addressEntity(s,'measure-1'),notation:{timeSignature:{beats:4,beatType:3},keySignature:null,clef:null,barlines:[]}}],events:[],notes:[]}),(e)=>e instanceof NotationError&&e.code==='INVALID_NOTATION');
  assert.throws(()=>createNotationDocument(s,{contractVersion:'1.0.0',documentId:s.id,revisionId:s.revision.id,measures:[],events:[{target:addressEntity(s,'event-1'),notation:{dots:0,beams:[{number:1,value:'begin'},{number:1,value:'end'}],tuplet:null}}],notes:[]}),(e)=>e instanceof NotationError&&e.code==='INVALID_NOTATION');
});
