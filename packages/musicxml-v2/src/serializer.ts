import { MusicXmlError } from '../../musicxml/src/index.js';
import { createScoreDocumentV2, type GraceEvent, type GraceGroup, type Rational, type ScoreDocumentV2, type ScoreEvent, type VoiceV2 } from '../../score-model-v2/src/index.js';
import {
  createNotationDocumentV2,
  type ArticulationSpec,
  type EventNotationV2,
  type GraceEventNotationV2,
  type GraceNoteNotationV2,
  type NotationDocumentV2,
  type NoteNotation,
  type OrnamentSpec
} from '../../notation-structure-v2/src/index.js';

const MAX_DIVISIONS = 16_384;
const absBig=(v:bigint)=>v<0n?-v:v;
const gcd=(a:bigint,b:bigint):bigint=>{let x=absBig(a),y=absBig(b);while(y!==0n){const n=x%y;x=y;y=n;}return x;};
const lcm=(a:bigint,b:bigint):bigint=>a===0n||b===0n?0n:absBig((a/gcd(a,b))*b);
const factor=(v:Rational)=>BigInt(v.denominator)/gcd(BigInt(v.denominator),4n);
const compare=(a:Rational,b:Rational)=>{const l=BigInt(a.numerator)*BigInt(b.denominator),r=BigInt(b.numerator)*BigInt(a.denominator);return l<r?-1:l>r?1:0;};
const add=(a:Rational,b:Rational):Rational=>{const n=BigInt(a.numerator)*BigInt(b.denominator)+BigInt(b.numerator)*BigInt(a.denominator),d=BigInt(a.denominator)*BigInt(b.denominator),g=gcd(n,d);return{numerator:Number(n/g),denominator:Number(d/g)};};
const units=(v:Rational,d:number,path:string):number=>{const n=BigInt(v.numerator)*4n*BigInt(d),den=BigInt(v.denominator);if(n%den!==0n)throw new MusicXmlError('Rational cannot be represented by selected v2 divisions.','SERIALIZATION_LIMIT',{path});const out=n/den;if(out<0n||out>BigInt(Number.MAX_SAFE_INTEGER))throw new MusicXmlError('MusicXML units exceed safe range.','SERIALIZATION_LIMIT',{path});return Number(out);};
const esc=(v:string)=>v.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const attr=(v:string)=>esc(v).replaceAll('"','&quot;').replaceAll("'",'&apos;');
const sorted=<T extends {readonly ordinal:number}>(items:readonly T[])=>[...items].sort((a,b)=>a.ordinal-b.ordinal);
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);

const eventNotation=(notation:NotationDocumentV2,id:string):EventNotationV2|null=>notation.events.find((entry)=>entry.target.eventId===id)?.notation??null;
const noteNotation=(notation:NotationDocumentV2,id:string):NoteNotation|null=>notation.notes.find((entry)=>entry.target.noteId===id)?.notation??null;
const graceEventNotation=(notation:NotationDocumentV2,id:string):GraceEventNotationV2|null=>notation.graceEvents.find((entry)=>entry.target.graceEventId===id)?.notation??null;
const graceNoteNotation=(notation:NotationDocumentV2,id:string):GraceNoteNotationV2|null=>notation.graceNotes.find((entry)=>entry.target.graceNoteId===id)?.notation??null;
const measureNotation=(notation:NotationDocumentV2,id:string)=>notation.measures.find((entry)=>entry.target.measureId===id)?.notation??null;

const chooseDivisions=(score:ScoreDocumentV2):number=>{let d=1n;for(const p of score.parts)for(const s of p.staves)for(const m of s.measures)for(const v of m.voices){for(const e of v.events){d=lcm(d,factor(e.onset));d=lcm(d,factor(e.duration));}for(const group of v.graceGroups)for(const e of group.events)if(e.playback.makeTime!==null)d=lcm(d,factor(e.playback.makeTime));if(d>BigInt(MAX_DIVISIONS))throw new MusicXmlError('Required MusicXML divisions exceed v2 serializer limit.','SERIALIZATION_LIMIT');}return Number(d);};

const decimalRational=(value:Rational,path:string):string=>{
  let denominator=BigInt(value.denominator),twos=0,fives=0;
  while(denominator%2n===0n){denominator/=2n;twos++;}
  while(denominator%5n===0n){denominator/=5n;fives++;}
  if(denominator!==1n)throw new MusicXmlError('Grace percentage cannot be represented exactly as MusicXML decimal.','SERIALIZATION_LIMIT',{path,value});
  const scale=Math.max(twos,fives);let n=BigInt(value.numerator);n*=2n**BigInt(scale-twos);n*=5n**BigInt(scale-fives);
  const negative=n<0n;let digits=absBig(n).toString();if(scale===0)return `${negative?'-':''}${digits}`;
  while(digits.length<=scale)digits=`0${digits}`;
  const at=digits.length-scale;let out=`${negative?'-':''}${digits.slice(0,at)}.${digits.slice(at)}`;out=out.replace(/0+$/,'').replace(/\.$/,'');return out;
};

const TYPE_FOR_DURATION=new Map<string,string>([['1/1','whole'],['1/2','half'],['1/4','quarter'],['1/8','eighth'],['1/16','16th'],['1/32','32nd'],['1/64','64th']]);
const graceType=(value:Rational,path:string):string=>{const type=TYPE_FOR_DURATION.get(`${value.numerator}/${value.denominator}`);if(type===undefined)throw new MusicXmlError('Grace writtenDuration is outside bounded MusicXML v2 note-type profile.','SERIALIZATION_LIMIT',{path,value});return type;};

const pitchLines=(pitch:{step:string;alter:number;octave:number},indent:string):string[]=>{const lines=[`${indent}<pitch>`,`${indent}  <step>${pitch.step}</step>`];if(pitch.alter!==0)lines.push(`${indent}  <alter>${pitch.alter}</alter>`);lines.push(`${indent}  <octave>${pitch.octave}</octave>`,`${indent}</pitch>`);return lines;};
const placementAttr=(placement:string):string=>placement==='auto'?'':` placement="${placement}"`;

const articulationLine=(value:ArticulationSpec,indent:string):string=>{
  const placement=placementAttr(value.placement);const direction=value.kind==='strong-accent'&&value.direction!==null?` type="${value.direction}"`:'';
  return `${indent}<${value.kind}${placement}${direction}/>`;
};
const ornamentLines=(ornaments:readonly OrnamentSpec[],indent:string):string[]=>{
  if(ornaments.length===0)return[];const lines=[`${indent}<ornaments>`];
  for(const ornament of ornaments){
    if(ornament.kind==='tremolo'){
      const number=ornament.number===null?'':` number="${ornament.number}"`;
      lines.push(`${indent}  <tremolo type="${ornament.type}"${number}${placementAttr(ornament.placement)}>${ornament.marks}</tremolo>`);continue;
    }
    if(ornament.kind==='wavy-line'){lines.push(`${indent}  <wavy-line type="${ornament.type}" number="${ornament.number}"${placementAttr(ornament.placement)}/>`);continue;}
    lines.push(`${indent}  <${ornament.kind}${placementAttr(ornament.placement)}/>`);
    for(const mark of ornament.accidentalMarks)lines.push(`${indent}  <accidental-mark${placementAttr(mark.placement)}>${mark.accidental}</accidental-mark>`);
  }
  lines.push(`${indent}</ornaments>`);return lines;
};

const notationsLines=(note:NoteNotation|GraceNoteNotationV2|null,event:EventNotationV2|GraceEventNotationV2|null,includeEvent:boolean,indent:string):string[]=>{
  const ties=note?.ties??[],slurs=note?.slurs??[],tuplets='tuplet' in (event??{})?((event as EventNotationV2).tuplet?.marks??[]):[];
  const articulations=includeEvent?(event?.articulations??[]):[];const ornaments=includeEvent?(event?.ornaments??[]):[];
  if(ties.length===0&&slurs.length===0&&tuplets.length===0&&articulations.length===0&&ornaments.length===0)return[];
  const lines=[`${indent}<notations>`];
  for(const mark of ties)lines.push(`${indent}  <tied type="${mark.type}" number="${mark.number}"/>`);
  for(const mark of slurs)lines.push(`${indent}  <slur type="${mark.type}" number="${mark.number}"/>`);
  for(const mark of tuplets)lines.push(`${indent}  <tuplet type="${mark.type}" number="${mark.number}"/>`);
  if(articulations.length>0){lines.push(`${indent}  <articulations>`);for(const value of articulations)lines.push(articulationLine(value,`${indent}    `));lines.push(`${indent}  </articulations>`);}
  lines.push(...ornamentLines(ornaments,`${indent}  `),`${indent}</notations>`);return lines;
};

const graceAttributes=(event:GraceEvent,group:GraceGroup,divisions:number,path:string):string=>{
  const values:string[]=[];const playback=event.playback;
  if(group.placement==='before'&&playback.stealTimePreviousPercent!==null)throw new MusicXmlError('Bounded MusicXML v2 profile cannot disambiguate before-grace with stealTimePreviousPercent.','SERIALIZATION_LIMIT',{path});
  if(group.placement==='after'){
    if(playback.stealTimePreviousPercent!==null&&playback.stealTimePreviousPercent.numerator===0)throw new MusicXmlError('Explicit zero stealTimePreviousPercent on after-grace is reserved by bounded round-trip marker.','SERIALIZATION_LIMIT',{path});
    values.push(`steal-time-previous="${playback.stealTimePreviousPercent===null?'0':decimalRational(playback.stealTimePreviousPercent,`${path}.stealTimePreviousPercent`)}"`);
  }
  if(playback.stealTimeFollowingPercent!==null)values.push(`steal-time-following="${decimalRational(playback.stealTimeFollowingPercent,`${path}.stealTimeFollowingPercent`)}"`);
  if(playback.makeTime!==null)values.push(`make-time="${units(playback.makeTime,divisions,`${path}.makeTime`)}"`);
  return values.length===0?'':` ${values.join(' ')}`;
};

const graceEventLines=(event:GraceEvent,group:GraceGroup,voice:number,staff:number,multiStaff:boolean,notation:NotationDocumentV2,divisions:number,path:string,indent:string):string[]=>{
  const eventN=graceEventNotation(notation,event.id);const pitches=event.kind==='note'?[event.note]:event.kind==='chord'?event.notes:[null];
  return pitches.flatMap((atom,index)=>{
    const noteN=atom===null?null:graceNoteNotation(notation,atom.id);const lines=[`${indent}<note>`];if(index>0)lines.push(`${indent}  <chord/>`);
    const slash=eventN?.slash===true?' slash="yes"':'';const attrs=graceAttributes(event,group,divisions,path);
    lines.push(`${indent}  <grace${slash}${attrs}/>`);
    if(atom===null)lines.push(`${indent}  <rest/>`);else lines.push(...pitchLines(atom.pitch,`${indent}  `));
    for(const mark of noteN?.ties??[])lines.push(`${indent}  <tie type="${mark.type}"/>`);
    lines.push(`${indent}  <voice>${voice}</voice>`,` ${indent.trimStart()}  <type>${graceType(event.writtenDuration,`${path}.writtenDuration`)}</type>`.trimStart());
    for(let i=0;i<(eventN?.dots??0);i++)lines.push(`${indent}  <dot/>`);
    if(noteN?.accidental)lines.push(`${indent}  <accidental>${noteN.accidental}</accidental>`);
    if(multiStaff)lines.push(`${indent}  <staff>${staff}</staff>`);
    if(index===0)for(const beam of eventN?.beams??[])lines.push(`${indent}  <beam number="${beam.number}">${beam.value}</beam>`);
    lines.push(...notationsLines(noteN,eventN,index===0,`${indent}  `),`${indent}</note>`);return lines;
  });
};

const normalEventLines=(event:ScoreEvent,durationUnits:number,voice:number,staff:number,multiStaff:boolean,notation:NotationDocumentV2,indent:string):string[]=>{
  const eventN=eventNotation(notation,event.id);const make=(pitch:{step:string;alter:number;octave:number}|null,noteId:string|null,chord:boolean,includeEvent:boolean):string[]=>{
    const noteN=noteId===null?null:noteNotation(notation,noteId);const lines=[`${indent}<note>`];if(chord)lines.push(`${indent}  <chord/>`);if(pitch===null)lines.push(`${indent}  <rest/>`);else lines.push(...pitchLines(pitch,`${indent}  `));lines.push(`${indent}  <duration>${durationUnits}</duration>`);for(const mark of noteN?.ties??[])lines.push(`${indent}  <tie type="${mark.type}"/>`);lines.push(`${indent}  <voice>${voice}</voice>`);for(let i=0;i<(eventN?.dots??0);i++)lines.push(`${indent}  <dot/>`);if(noteN?.accidental)lines.push(`${indent}  <accidental>${noteN.accidental}</accidental>`);if(eventN?.tuplet){lines.push(`${indent}  <time-modification>`,`${indent}    <actual-notes>${eventN.tuplet.actualNotes}</actual-notes>`,`${indent}    <normal-notes>${eventN.tuplet.normalNotes}</normal-notes>`,`${indent}  </time-modification>`);}if(multiStaff)lines.push(`${indent}  <staff>${staff}</staff>`);if(includeEvent)for(const beam of eventN?.beams??[])lines.push(`${indent}  <beam number="${beam.number}">${beam.value}</beam>`);lines.push(...notationsLines(noteN,eventN,includeEvent,`${indent}  `),`${indent}</note>`);return lines;};
  if(event.kind==='rest')return make(null,null,false,true);if(event.kind==='note')return make(event.note.pitch,event.note.id,false,true);return event.notes.flatMap((note,index)=>make(note.pitch,note.id,index>0,index===0));
};

type Stream={readonly staff:number;readonly voice:VoiceV2};
const groupFor=(voice:VoiceV2,anchor:string,placement:'before'|'after')=>voice.graceGroups.find((group)=>group.anchorEventId===anchor&&group.placement===placement)??null;
const streamLines=(stream:Stream,divisions:number,multiStaff:boolean,notation:NotationDocumentV2,path:string):{lines:string[];end:number}=>{
  const lines:string[]=[];let cursor:Rational={numerator:0,denominator:1};let cursorUnits=0;
  for(const [i,event] of stream.voice.events.entries()){
    if(compare(event.onset,cursor)<0)throw new MusicXmlError('Overlapping events in one voice are not admitted by v2 serializer.','OVERLAPPING_EVENTS',{path,index:i});
    const onset=units(event.onset,divisions,`${path}.event[${i}].onset`);if(onset>cursorUnits){lines.push('      <forward>',`        <duration>${onset-cursorUnits}</duration>`,'      </forward>');cursorUnits=onset;cursor=event.onset;}
    const before=groupFor(stream.voice,event.id,'before');if(before!==null)before.events.forEach((grace,index)=>lines.push(...graceEventLines(grace,before,stream.voice.ordinal,stream.staff,multiStaff,notation,divisions,`${path}.before[${i}].event[${index}]`,'      ')));
    const duration=units(event.duration,divisions,`${path}.event[${i}].duration`);lines.push(...normalEventLines(event,duration,stream.voice.ordinal,stream.staff,multiStaff,notation,'      '));
    const after=groupFor(stream.voice,event.id,'after');if(after!==null)after.events.forEach((grace,index)=>lines.push(...graceEventLines(grace,after,stream.voice.ordinal,stream.staff,multiStaff,notation,divisions,`${path}.after[${i}].event[${index}]`,'      ')));
    cursor=add(event.onset,event.duration);cursorUnits=onset+duration;
  }
  return{lines,end:cursorUnits};
};

export const serializeNotationMusicXmlV2=(scoreInput:ScoreDocumentV2,notationInput:NotationDocumentV2):string=>{
  const score=createScoreDocumentV2(scoreInput),notation=createNotationDocumentV2(score,notationInput),divisions=chooseDivisions(score);
  const lines=['<?xml version="1.0" encoding="UTF-8"?>','<score-partwise version="4.0">','  <part-list>'];
  score.parts.forEach((part,index)=>{if(part.name===null)throw new MusicXmlError('Part name is required for v2 notation serialization.','SERIALIZATION_LIMIT',{partIndex:index});lines.push(`    <score-part id="P${index+1}">`,`      <part-name>${esc(part.name)}</part-name>`,'    </score-part>');});lines.push('  </part-list>');
  score.parts.forEach((part,pi)=>{
    const staves=sorted(part.staves),reference=sorted(staves[0]?.measures??[]),multi=staves.length>1;lines.push(`  <part id="P${pi+1}">`);
    for(const [mi,measure] of reference.entries()){
      if(measure.displayNumber===null)throw new MusicXmlError('Measure display number is required for v2 notation serialization.','SERIALIZATION_LIMIT',{partIndex:pi,measureIndex:mi});const staffMeasures=staves.map((staff)=>sorted(staff.measures)[mi]);if(staffMeasures.some((item)=>item===undefined))throw new MusicXmlError('Part staves are not measure-aligned.','UNSUPPORTED_MUSICXML',{partIndex:pi,measureIndex:mi});
      const mns=staffMeasures.map((item)=>measureNotation(notation,item!.id)),times=mns.map((n)=>n?.timeSignature??null),keys=mns.map((n)=>n?.keySignature??null),bars=mns.map((n)=>n?.barlines??[]);if(!times.every((v)=>same(v,times[0]))||!keys.every((v)=>same(v,keys[0]))||!bars.every((v)=>same(v,bars[0])))throw new MusicXmlError('Time/key/barline notation must agree across aligned staves.','UNSUPPORTED_MUSICXML',{partIndex:pi,measureIndex:mi});
      lines.push(`    <measure number="${attr(measure.displayNumber)}">`,'      <attributes>',`        <divisions>${divisions}</divisions>`);if(keys[0])lines.push('        <key>',`          <fifths>${keys[0].fifths}</fifths>`,'        </key>');if(times[0])lines.push('        <time>',`          <beats>${times[0].beats}</beats>`,`          <beat-type>${times[0].beatType}</beat-type>`,'        </time>');if(multi)lines.push(`        <staves>${staves.length}</staves>`);mns.forEach((n,si)=>{if(n?.clef){const number=multi?` number="${si+1}"`:'';lines.push(`        <clef${number}>`,`          <sign>${n.clef.sign}</sign>`,`          <line>${n.clef.line}</line>`);if(n.clef.octaveChange!==0)lines.push(`          <clef-octave-change>${n.clef.octaveChange}</clef-octave-change>`);lines.push('        </clef>');}});lines.push('      </attributes>');
      const streams:Stream[]=[];for(const [si,staff] of staves.entries()){const m=staffMeasures[si]!;for(const voice of sorted(m.voices))if(voice.events.length>0||voice.graceGroups.length>0)streams.push({staff:staff.ordinal,voice});}
      streams.forEach((stream,index)=>{const out=streamLines(stream,divisions,multi,notation,`$.part[${pi}].measure[${mi}].staff[${stream.staff}].voice[${stream.voice.ordinal}]`);lines.push(...out.lines);if(index<streams.length-1&&out.end>0)lines.push('      <backup>',`        <duration>${out.end}</duration>`,'      </backup>');});for(const bar of bars[0]??[]){lines.push(`      <barline location="${bar.location}">`,`        <bar-style>${bar.style}</bar-style>`);if(bar.repeat)lines.push(`        <repeat direction="${bar.repeat}"/>`);lines.push('      </barline>');}lines.push('    </measure>');
    }lines.push('  </part>');
  });lines.push('</score-partwise>');return `${lines.join('\n')}\n`;
};
