import { validateScoreDocument } from '../../score-model/src/index.js';
import type { Rational, ScoreDocument, ScoreEvent, Voice } from '../../score-model/src/index.js';
import {
  createNotationDocument,
  notationForEvent,
  notationForMeasure,
  notationForNote
} from '../../notation-structure/src/index.js';
import type { NotationDocument, NoteNotation, EventNotation } from '../../notation-structure/src/index.js';
import { MusicXmlError } from './errors.js';

const MAX_DIVISIONS = 16_384;
const absBig=(v:bigint)=>v<0n?-v:v;
const gcd=(a:bigint,b:bigint):bigint=>{let x=absBig(a),y=absBig(b);while(y!==0n){const n=x%y;x=y;y=n;}return x;};
const lcm=(a:bigint,b:bigint):bigint=>a===0n||b===0n?0n:absBig((a/gcd(a,b))*b);
const compare=(a:Rational,b:Rational)=>{const l=BigInt(a.numerator)*BigInt(b.denominator),r=BigInt(b.numerator)*BigInt(a.denominator);return l<r?-1:l>r?1:0;};
const add=(a:Rational,b:Rational):Rational=>{const n=BigInt(a.numerator)*BigInt(b.denominator)+BigInt(b.numerator)*BigInt(a.denominator);const d=BigInt(a.denominator)*BigInt(b.denominator);const g=gcd(n,d);return{numerator:Number(n/g),denominator:Number(d/g)};};
const factor=(v:Rational)=>BigInt(v.denominator)/gcd(BigInt(v.denominator),4n);
const chooseDivisions=(score:ScoreDocument):number=>{let d=1n;for(const p of score.parts)for(const s of p.staves)for(const m of s.measures)for(const v of m.voices)for(const e of v.events){d=lcm(d,factor(e.onset));d=lcm(d,factor(e.duration));if(d>BigInt(MAX_DIVISIONS))throw new MusicXmlError('Required MusicXML divisions exceed notation serializer limit.','SERIALIZATION_LIMIT');}return Number(d);};
const units=(v:Rational,d:number,path:string):number=>{const n=BigInt(v.numerator)*4n*BigInt(d),den=BigInt(v.denominator);if(n%den!==0n)throw new MusicXmlError('Rational cannot be represented by selected divisions.','SERIALIZATION_LIMIT',{path});const out=n/den;if(out<0n||out>BigInt(Number.MAX_SAFE_INTEGER))throw new MusicXmlError('MusicXML units exceed safe range.','SERIALIZATION_LIMIT',{path});return Number(out);};
const esc=(v:string)=>v.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const attr=(v:string)=>esc(v).replaceAll('"','&quot;').replaceAll("'",'&apos;');
const sorted=<T extends {readonly ordinal:number}>(items:readonly T[])=>[...items].sort((a,b)=>a.ordinal-b.ordinal);

const pitchLines=(pitch:{step:string;alter:number;octave:number},indent:string):string[]=>{
  const lines=[`${indent}<pitch>`,`${indent}  <step>${pitch.step}</step>`];
  if(pitch.alter!==0)lines.push(`${indent}  <alter>${pitch.alter}</alter>`);
  lines.push(`${indent}  <octave>${pitch.octave}</octave>`,`${indent}</pitch>`);return lines;
};

const notationLines=(note:NoteNotation|null,event:EventNotation|null,indent:string):string[]=>{
  const lines:string[]=[];
  const ties=note?.ties??[];
  const slurs=note?.slurs??[];
  const tuplets=event?.tuplet?.marks??[];
  if(ties.length===0&&slurs.length===0&&tuplets.length===0)return lines;
  lines.push(`${indent}<notations>`);
  for(const mark of ties)lines.push(`${indent}  <tied type="${mark.type}" number="${mark.number}"/>`);
  for(const mark of slurs)lines.push(`${indent}  <slur type="${mark.type}" number="${mark.number}"/>`);
  for(const mark of tuplets)lines.push(`${indent}  <tuplet type="${mark.type}" number="${mark.number}"/>`);
  lines.push(`${indent}</notations>`);return lines;
};

const noteLines=(event:ScoreEvent,durationUnits:number,voice:number,staff:number,multiStaff:boolean,notation:NotationDocument,indent:string):string[]=>{
  const eventNotation=notationForEvent(notation,event.id);
  const make=(pitch:{step:string;alter:number;octave:number}|null,noteId:string|null,chord:boolean):string[]=>{
    const noteNotation=noteId===null?null:notationForNote(notation,noteId);
    const lines=[`${indent}<note>`];
    if(chord)lines.push(`${indent}  <chord/>`);
    if(pitch===null)lines.push(`${indent}  <rest/>`);else lines.push(...pitchLines(pitch,`${indent}  `));
    lines.push(`${indent}  <duration>${durationUnits}</duration>`);
    for(const mark of noteNotation?.ties??[])lines.push(`${indent}  <tie type="${mark.type}"/>`);
    lines.push(`${indent}  <voice>${voice}</voice>`);
    for(let i=0;i<(eventNotation?.dots??0);i++)lines.push(`${indent}  <dot/>`);
    if(noteNotation?.accidental)lines.push(`${indent}  <accidental>${noteNotation.accidental}</accidental>`);
    if(eventNotation?.tuplet){lines.push(`${indent}  <time-modification>`,`${indent}    <actual-notes>${eventNotation.tuplet.actualNotes}</actual-notes>`,`${indent}    <normal-notes>${eventNotation.tuplet.normalNotes}</normal-notes>`,`${indent}  </time-modification>`);}
    if(multiStaff)lines.push(`${indent}  <staff>${staff}</staff>`);
    for(const beam of eventNotation?.beams??[])lines.push(`${indent}  <beam number="${beam.number}">${beam.value}</beam>`);
    lines.push(...notationLines(noteNotation,eventNotation,`${indent}  `),`${indent}</note>`);return lines;
  };
  if(event.kind==='rest')return make(null,null,false);
  if(event.kind==='note')return make(event.note.pitch,event.note.id,false);
  return event.notes.flatMap((n,i)=>make(n.pitch,n.id,i>0));
};

type Stream={readonly staff:number;readonly voice:Voice};
const streamLines=(stream:Stream,divisions:number,multiStaff:boolean,notation:NotationDocument,path:string):{lines:string[];end:number}=>{
  const lines:string[]=[];let cursor:Rational={numerator:0,denominator:1};let cursorUnits=0;
  for(const [i,event] of stream.voice.events.entries()){
    if(compare(event.onset,cursor)<0)throw new MusicXmlError('Overlapping events in one voice are not admitted by E5 serializer.','OVERLAPPING_EVENTS',{path,index:i});
    const onset=units(event.onset,divisions,`${path}.event[${i}].onset`);
    if(onset>cursorUnits){lines.push('      <forward>',`        <duration>${onset-cursorUnits}</duration>`,'      </forward>');cursorUnits=onset;cursor=event.onset;}
    const duration=units(event.duration,divisions,`${path}.event[${i}].duration`);
    lines.push(...noteLines(event,duration,stream.voice.ordinal,stream.staff,multiStaff,notation,'      '));
    cursor=add(event.onset,event.duration);cursorUnits=onset+duration;
  }
  return{lines,end:cursorUnits};
};

const sameJson=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);

export const serializeNotationMusicXml=(score:ScoreDocument,notationInput:NotationDocument):string=>{
  const validation=validateScoreDocument(score);if(!validation.ok)throw new MusicXmlError('Cannot serialize invalid ScoreDocument.','INVALID_MUSICXML_SEMANTICS',{issueCount:validation.issues.length});
  const notation=createNotationDocument(score,notationInput);
  const divisions=chooseDivisions(score);
  const lines=['<?xml version="1.0" encoding="UTF-8"?>','<score-partwise version="4.0">','  <part-list>'];
  score.parts.forEach((part,i)=>{if(part.name===null)throw new MusicXmlError('Part name is required for notation serialization.','SERIALIZATION_LIMIT',{partIndex:i});lines.push(`    <score-part id="P${i+1}">`,`      <part-name>${esc(part.name)}</part-name>`,'    </score-part>');});
  lines.push('  </part-list>');
  score.parts.forEach((part,pi)=>{
    const staves=sorted(part.staves),reference=sorted(staves[0]?.measures??[]),multi=staves.length>1;lines.push(`  <part id="P${pi+1}">`);
    for(const [mi,measure] of reference.entries()){
      if(measure.displayNumber===null)throw new MusicXmlError('Measure display number is required for notation serialization.','SERIALIZATION_LIMIT',{partIndex:pi,measureIndex:mi});
      const staffMeasures=staves.map(s=>sorted(s.measures)[mi]);if(staffMeasures.some(m=>m===undefined))throw new MusicXmlError('Part staves are not measure-aligned.','UNSUPPORTED_MUSICXML',{partIndex:pi,measureIndex:mi});
      const measureNotations=staffMeasures.map(m=>notationForMeasure(notation,m!.id));
      const times=measureNotations.map(n=>n?.timeSignature??null),keys=measureNotations.map(n=>n?.keySignature??null),bars=measureNotations.map(n=>n?.barlines??[]);
      if(!times.every(t=>sameJson(t,times[0]))||!keys.every(k=>sameJson(k,keys[0]))||!bars.every(b=>sameJson(b,bars[0])))throw new MusicXmlError('Time/key/barline notation must agree across aligned staves.','UNSUPPORTED_MUSICXML',{partIndex:pi,measureIndex:mi});
      lines.push(`    <measure number="${attr(measure.displayNumber)}">`,'      <attributes>',`        <divisions>${divisions}</divisions>`);
      if(keys[0])lines.push('        <key>',`          <fifths>${keys[0].fifths}</fifths>`,'        </key>');
      if(times[0])lines.push('        <time>',`          <beats>${times[0].beats}</beats>`,`          <beat-type>${times[0].beatType}</beat-type>`,'        </time>');
      if(multi)lines.push(`        <staves>${staves.length}</staves>`);
      measureNotations.forEach((n,si)=>{if(n?.clef){const number=multi?` number="${si+1}"`:'';lines.push(`        <clef${number}>`,`          <sign>${n.clef.sign}</sign>`,`          <line>${n.clef.line}</line>`);if(n.clef.octaveChange!==0)lines.push(`          <clef-octave-change>${n.clef.octaveChange}</clef-octave-change>`);lines.push('        </clef>');}});
      lines.push('      </attributes>');
      const streams:Stream[]=[];for(const [si,staff] of staves.entries()){const m=staffMeasures[si]!;for(const voice of sorted(m.voices))if(voice.events.length>0)streams.push({staff:staff.ordinal,voice});}
      streams.forEach((stream,index)=>{const out=streamLines(stream,divisions,multi,notation,`$.part[${pi}].measure[${mi}].staff[${stream.staff}].voice[${stream.voice.ordinal}]`);lines.push(...out.lines);if(index<streams.length-1&&out.end>0)lines.push('      <backup>',`        <duration>${out.end}</duration>`,'      </backup>');});
      for(const bar of bars[0]??[]){lines.push(`      <barline location="${bar.location}">`,`        <bar-style>${bar.style}</bar-style>`);if(bar.repeat)lines.push(`        <repeat direction="${bar.repeat}"/>`);lines.push('      </barline>');}
      lines.push('    </measure>');
    }
    lines.push('  </part>');
  });
  lines.push('</score-partwise>');return `${lines.join('\n')}\n`;
};
