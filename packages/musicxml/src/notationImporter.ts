import { createScoreDocument } from '../../score-model/src/index.js';
import type { ScoreDocument } from '../../score-model/src/index.js';
import { addressEntity } from '../../addressing/src/index.js';
import { createNotationDocument } from '../../notation-structure/src/index.js';
import type {
  AccidentalDisplay,
  BarlineSpec,
  BeamSpec,
  BoundaryMark,
  ClefSpec,
  EventNotation,
  EventNotationEntry,
  KeySignature,
  MeasureNotation,
  MeasureNotationEntry,
  NotationDocument,
  NoteNotation,
  NoteNotationEntry,
  TimeSignature,
  TupletSpec
} from '../../notation-structure/src/index.js';
import { createMusicXmlMeasureSemanticsDocument } from '../../musicxml-measure-semantics/src/index.js';
import type { MusicXmlMeasureSemanticsDocument } from '../../musicxml-measure-semantics/src/index.js';
import { MusicXmlError } from './errors.js';
import { importMusicXmlWithMeasureSemantics } from './importer.js';
import type { MusicXmlImportOptions } from './importer.js';
import { parseMusicXmlTree } from './parsedXml.js';
import type { ParsedXmlNode } from './parsedXml.js';
import { createMusicXmlProcessingRuntime } from './processing.js';
import type { MusicXmlInput } from './xmlSafety.js';

export interface NotationMusicXmlImportResult {
  readonly score: Readonly<ScoreDocument>;
  readonly notation: Readonly<NotationDocument>;
  readonly measureSemantics: Readonly<MusicXmlMeasureSemanticsDocument>;
}

const children=(node:ParsedXmlNode,name?:string):readonly ParsedXmlNode[]=>name===undefined?node.children:node.children.filter((item)=>item.name===name);
const attr=(node:ParsedXmlNode,name:string):string|undefined=>node.attributes.find((item)=>item.name===name&&item.uri==='')?.value;
const requiredText=(node:ParsedXmlNode,label:string):string=>{const value=node.text.trim();if(value.length===0)throw new MusicXmlError(`${label} is empty.`,'INVALID_MUSICXML_SEMANTICS');return value;};
const integer=(node:ParsedXmlNode,label:string,min:number,max:number):number=>{const value=requiredText(node,label);if(!/^-?[0-9]+$/.test(value))throw new MusicXmlError(`${label} must be an integer.`,'INVALID_MUSICXML_SEMANTICS',{value});const parsed=Number(value);if(!Number.isSafeInteger(parsed)||parsed<min||parsed>max)throw new MusicXmlError(`${label} is outside admitted range.`,'INVALID_MUSICXML_SEMANTICS',{value,min,max});return parsed;};
const positive=(node:ParsedXmlNode,label:string,max=Number.MAX_SAFE_INTEGER):number=>integer(node,label,1,max);
const one=(node:ParsedXmlNode,name:string,label:string,required=false):ParsedXmlNode|null=>{const found=children(node,name);if(found.length===0&&!required)return null;if(found.length!==1)throw new MusicXmlError(`${label} cardinality is invalid.`,'INVALID_MUSICXML_SEMANTICS',{name,observed:found.length});return found[0]!;};
const escapeText=(value:string):string=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const escapeAttr=(value:string):string=>escapeText(value).replaceAll('"','&quot;').replaceAll("'",'&apos;');

const CORE_CHILDREN:Readonly<Record<string,ReadonlySet<string>>>=Object.freeze({
  'score-partwise':new Set(['part-list','part']),
  'part-list':new Set(['score-part']),
  'score-part':new Set(['part-name']),
  part:new Set(['measure']),
  measure:new Set(['attributes','note','backup','forward']),
  attributes:new Set(['divisions','staves','time']),
  time:new Set(['beats','beat-type']),
  note:new Set(['chord','pitch','rest','duration','voice','staff','type']),
  pitch:new Set(['step','alter','octave']),
  backup:new Set(['duration']),
  forward:new Set(['duration'])
});
const CORE_ATTRIBUTES:Readonly<Record<string,ReadonlySet<string>>>=Object.freeze({
  'score-partwise':new Set(['version']),
  'score-part':new Set(['id']),
  part:new Set(['id']),
  measure:new Set(['number','implicit','non-controlling'])
});
const EMPTY_CORE=new Set(['rest','chord']);

const renderCoreNode=(node:ParsedXmlNode):string=>{
  const allowedAttrs=CORE_ATTRIBUTES[node.name]??new Set<string>();
  const attrs=node.attributes.filter((item)=>item.uri===''&&allowedAttrs.has(item.name)).map((item)=>` ${item.name}="${escapeAttr(item.value)}"`).join('');
  if(EMPTY_CORE.has(node.name))return `<${node.name}${attrs}/>`;
  const allowedChildren=CORE_CHILDREN[node.name];
  const kept=allowedChildren===undefined?[]:node.children.filter((item)=>allowedChildren.has(item.name));
  const body=kept.length>0?kept.map(renderCoreNode).join(''):escapeText(node.text.trim());
  return `<${node.name}${attrs}>${body}</${node.name}>`;
};
const scoreOnlyProjection=(root:ParsedXmlNode):string=>renderCoreNode(root);

const boundaryMarks=(notations:ParsedXmlNode|null,name:'tied'|'slur'|'tuplet'):readonly BoundaryMark[]=>{
  if(notations===null)return Object.freeze([]);
  const seen=new Set<string>();
  const marks=children(notations,name).map((node,index)=>{
    const type=attr(node,'type');const numberRaw=attr(node,'number');
    if((type!=='start'&&type!=='stop')||numberRaw===undefined||!/^[1-9][0-9]*$/.test(numberRaw))throw new MusicXmlError(`${name} mark is invalid.`,'INVALID_MUSICXML_SEMANTICS',{index,type,number:numberRaw});
    const number=Number(numberRaw);if(number<1||number>16)throw new MusicXmlError(`${name} number is outside admitted range.`,'INVALID_MUSICXML_SEMANTICS',{number});
    const key=`${number}:${type}`;if(seen.has(key))throw new MusicXmlError(`${name} mark is duplicated.`,'INVALID_MUSICXML_SEMANTICS',{key});seen.add(key);
    return Object.freeze({number,type});
  });
  return Object.freeze(marks);
};

const parseAccidental=(note:ParsedXmlNode):AccidentalDisplay|null=>{
  const node=one(note,'accidental','accidental');if(node===null)return null;
  const value=requiredText(node,'accidental');
  if(!['sharp','flat','natural','double-sharp','double-flat'].includes(value))throw new MusicXmlError('accidental is unsupported.','UNSUPPORTED_MUSICXML',{value});
  return value as AccidentalDisplay;
};
const parseNoteNotation=(note:ParsedXmlNode):Readonly<NoteNotation>=>{
  const notations=one(note,'notations','notations');const ties=boundaryMarks(notations,'tied');const slurs=boundaryMarks(notations,'slur');
  const plainTypes=children(note,'tie').map((item)=>attr(item,'type')).sort();const tiedTypes=ties.map((item)=>item.type).sort();
  if(JSON.stringify(plainTypes)!==JSON.stringify(tiedTypes))throw new MusicXmlError('tie and tied projections disagree.','INVALID_MUSICXML_SEMANTICS',{plainTypes,tiedTypes});
  return Object.freeze({accidental:parseAccidental(note),ties,slurs});
};
const parseBeams=(note:ParsedXmlNode):readonly BeamSpec[]=>{
  const seen=new Set<number>();const beams=children(note,'beam').map((node,index)=>{
    const raw=attr(node,'number');if(raw===undefined||!/^[1-9][0-9]*$/.test(raw))throw new MusicXmlError('beam number is invalid.','INVALID_MUSICXML_SEMANTICS',{index,raw});
    const number=Number(raw);if(number<1||number>8||seen.has(number))throw new MusicXmlError('beam number is duplicated or outside range.','INVALID_MUSICXML_SEMANTICS',{number});seen.add(number);
    const value=requiredText(node,'beam');if(!['begin','continue','end','forward-hook','backward-hook'].includes(value))throw new MusicXmlError('beam value is unsupported.','UNSUPPORTED_MUSICXML',{value});
    return Object.freeze({number,value:value as BeamSpec['value']});
  });return Object.freeze(beams);
};
const parseTuplet=(note:ParsedXmlNode):TupletSpec|null=>{
  const time=one(note,'time-modification','time-modification');const notations=one(note,'notations','notations');const marks=boundaryMarks(notations,'tuplet');
  if(time===null){if(marks.length>0)throw new MusicXmlError('tuplet marks require time-modification.','INVALID_MUSICXML_SEMANTICS');return null;}
  const actualNode=one(time,'actual-notes','actual-notes',true),normalNode=one(time,'normal-notes','normal-notes',true);if(actualNode===null||normalNode===null)throw new MusicXmlError('time-modification is incomplete.','INVALID_MUSICXML_SEMANTICS');
  return Object.freeze({actualNotes:positive(actualNode,'actual-notes',32),normalNotes:positive(normalNode,'normal-notes',32),marks});
};
const parseEventNotation=(note:ParsedXmlNode):Readonly<EventNotation>=>{const dots=children(note,'dot').length;if(dots>3)throw new MusicXmlError('dot count exceeds admitted range.','INVALID_MUSICXML_SEMANTICS',{dots});return Object.freeze({dots,beams:parseBeams(note),tuplet:parseTuplet(note)});};
const defaultEvent=(value:EventNotation):boolean=>value.dots===0&&value.beams.length===0&&value.tuplet===null;
const defaultNote=(value:NoteNotation):boolean=>value.accidental===null&&value.ties.length===0&&value.slurs.length===0;
const same=(a:unknown,b:unknown):boolean=>JSON.stringify(a)===JSON.stringify(b);

const parseKey=(attributes:ParsedXmlNode|null):KeySignature|null=>{if(attributes===null)return null;const key=one(attributes,'key','key');if(key===null)return null;const fifths=one(key,'fifths','fifths',true);if(fifths===null)throw new MusicXmlError('key is incomplete.','INVALID_MUSICXML_SEMANTICS');return Object.freeze({fifths:integer(fifths,'fifths',-7,7)});};
const parseTime=(attributes:ParsedXmlNode|null):TimeSignature|null=>{if(attributes===null)return null;const time=one(attributes,'time','time');if(time===null)return null;const beats=one(time,'beats','beats',true),beatType=one(time,'beat-type','beat-type',true);if(beats===null||beatType===null)throw new MusicXmlError('time is incomplete.','INVALID_MUSICXML_SEMANTICS');const b=positive(beats,'beats',32),bt=positive(beatType,'beat-type',64);if(![1,2,4,8,16,32,64].includes(bt))throw new MusicXmlError('beat-type is unsupported.','UNSUPPORTED_MUSICXML',{bt});return Object.freeze({beats:b,beatType:bt});};
const parseClefs=(attributes:ParsedXmlNode|null,staffCount:number):ReadonlyMap<number,ClefSpec>=>{
  const map=new Map<number,ClefSpec>();if(attributes===null)return map;
  for(const [index,clef] of children(attributes,'clef').entries()){
    const raw=attr(clef,'number');const staff=raw===undefined?1:Number(raw);if(!Number.isSafeInteger(staff)||staff<1||staff>staffCount||map.has(staff))throw new MusicXmlError('clef number is invalid or duplicated.','INVALID_MUSICXML_SEMANTICS',{index,raw,staff});
    const signNode=one(clef,'sign','clef.sign',true),lineNode=one(clef,'line','clef.line',true),octNode=one(clef,'clef-octave-change','clef-octave-change');if(signNode===null||lineNode===null)throw new MusicXmlError('clef is incomplete.','INVALID_MUSICXML_SEMANTICS');
    const sign=requiredText(signNode,'clef.sign');if(!['G','F','C','percussion','TAB'].includes(sign))throw new MusicXmlError('clef sign is unsupported.','UNSUPPORTED_MUSICXML',{sign});
    map.set(staff,Object.freeze({sign:sign as ClefSpec['sign'],line:integer(lineNode,'clef.line',1,5),octaveChange:octNode===null?0:integer(octNode,'clef-octave-change',-2,2)}));
  }return map;
};
const parseBars=(measure:ParsedXmlNode):readonly BarlineSpec[]=>{
  const seen=new Set<string>();const bars=children(measure,'barline').map((bar,index)=>{
    const location=attr(bar,'location');if((location!=='left'&&location!=='right')||seen.has(location))throw new MusicXmlError('barline location is invalid or duplicated.','INVALID_MUSICXML_SEMANTICS',{index,location});seen.add(location);
    const styleNode=one(bar,'bar-style','bar-style',true);if(styleNode===null)throw new MusicXmlError('barline style is required.','INVALID_MUSICXML_SEMANTICS');const style=requiredText(styleNode,'bar-style');if(!['regular','light-light','light-heavy','heavy-light','heavy-heavy','dashed','dotted','none'].includes(style))throw new MusicXmlError('barline style is unsupported.','UNSUPPORTED_MUSICXML',{style});
    const repeatNode=one(bar,'repeat','repeat');let repeat:null|'forward'|'backward'=null;if(repeatNode!==null){const direction=attr(repeatNode,'direction');if(direction!=='forward'&&direction!=='backward')throw new MusicXmlError('repeat direction is invalid.','INVALID_MUSICXML_SEMANTICS',{direction});repeat=direction;}
    return Object.freeze({location,style:style as BarlineSpec['style'],repeat});
  });return Object.freeze(bars);
};
const noteStream=(note:ParsedXmlNode):{staff:number;voice:number}=>{const staffNode=one(note,'staff','staff'),voiceNode=one(note,'voice','voice');return{staff:staffNode===null?1:positive(staffNode,'staff',128),voice:voiceNode===null?1:positive(voiceNode,'voice',1024)};};

const buildNotation=(score:ScoreDocument,root:ParsedXmlNode):Readonly<NotationDocument>=>{
  const measureEntries:MeasureNotationEntry[]=[];const eventMap=new Map<string,EventNotation>();const noteMap=new Map<string,NoteNotation>();const partNodes=children(root,'part');
  if(partNodes.length!==score.parts.length)throw new MusicXmlError('Notation profile part count does not match imported score.','INVALID_MUSICXML_SEMANTICS');
  for(const [partIndex,partNode] of partNodes.entries()){
    const p=partIndex+1,part=score.parts[partIndex]!,measures=children(partNode,'measure'),reference=part.staves[0]?.measures??[];
    if(measures.length!==reference.length)throw new MusicXmlError('Notation profile measure count does not match imported score.','INVALID_MUSICXML_SEMANTICS',{partIndex});
    for(const [measureIndex,measureNode] of measures.entries()){
      const m=measureIndex+1,attributes=one(measureNode,'attributes','attributes'),key=parseKey(attributes),time=parseTime(attributes),clefs=parseClefs(attributes,part.staves.length),barlines=parseBars(measureNode);
      for(let staff=1;staff<=part.staves.length;staff+=1){const target=addressEntity(score,`measure-${p}-${staff}-${m}`);if(target.kind!=='measure')throw new MusicXmlError('Imported measure address is invalid.','INVALID_MUSICXML_SEMANTICS');const notation:MeasureNotation=Object.freeze({timeSignature:time,keySignature:key,clef:clefs.get(staff)??null,barlines});if(time!==null||key!==null||notation.clef!==null||barlines.length>0)measureEntries.push({target,notation});}
      const eventCounters=new Map<string,number>(),noteCounters=new Map<string,number>();
      for(const noteNode of children(measureNode,'note')){
        const stream=noteStream(noteNode);if(stream.staff>part.staves.length)throw new MusicXmlError('note staff exceeds imported part staves.','INVALID_MUSICXML_SEMANTICS',{stream});const streamKey=`${stream.staff}:${stream.voice}`,chord=one(noteNode,'chord','chord')!==null;
        let eventIndex=eventCounters.get(streamKey)??0;if(!chord){eventIndex+=1;eventCounters.set(streamKey,eventIndex);noteCounters.set(streamKey,0);}else if(eventIndex===0)throw new MusicXmlError('chord marker has no preceding event in stream.','INVALID_MUSICXML_SEMANTICS',{stream});
        const eventId=`event-${p}-${stream.staff}-${m}-${stream.voice}-${eventIndex}`,targetEvent=addressEntity(score,eventId);if(targetEvent.kind!=='event')throw new MusicXmlError('Notation event did not resolve in imported score.','INVALID_MUSICXML_SEMANTICS',{eventId});
        const eventNotation=parseEventNotation(noteNode),existingEvent=eventMap.get(eventId);if(existingEvent!==undefined&&!same(existingEvent,eventNotation))throw new MusicXmlError('Chord tones disagree on event-level notation.','INVALID_MUSICXML_SEMANTICS',{eventId});if(existingEvent===undefined&&!defaultEvent(eventNotation))eventMap.set(eventId,eventNotation);
        const rest=one(noteNode,'rest','rest')!==null;if(rest){if(!defaultNote(parseNoteNotation(noteNode)))throw new MusicXmlError('Rest cannot carry note-level notation in serializer profile.','INVALID_MUSICXML_SEMANTICS',{eventId});continue;}
        const nextNote=(noteCounters.get(streamKey)??0)+1;noteCounters.set(streamKey,nextNote);const noteId=`note-${p}-${stream.staff}-${m}-${stream.voice}-${eventIndex}-${nextNote}`,targetNote=addressEntity(score,noteId);if(targetNote.kind!=='note')throw new MusicXmlError('Notation note did not resolve in imported score.','INVALID_MUSICXML_SEMANTICS',{noteId});const noteNotation=parseNoteNotation(noteNode);if(!defaultNote(noteNotation))noteMap.set(noteId,noteNotation);
      }
    }
  }
  const events:EventNotationEntry[]=[...eventMap].map(([id,notation])=>{const target=addressEntity(score,id);if(target.kind!=='event')throw new MusicXmlError('Event target kind changed.','INVALID_MUSICXML_SEMANTICS',{id});return{target,notation};});
  const notes:NoteNotationEntry[]=[...noteMap].map(([id,notation])=>{const target=addressEntity(score,id);if(target.kind!=='note')throw new MusicXmlError('Note target kind changed.','INVALID_MUSICXML_SEMANTICS',{id});return{target,notation};});
  return createNotationDocument(score,{contractVersion:'1.0.0',documentId:score.id,revisionId:score.revision.id,measures:measureEntries,events,notes});
};

export const importNotationMusicXml=(input:MusicXmlInput,options:MusicXmlImportOptions):Readonly<NotationMusicXmlImportResult>=>{
  const runtime=createMusicXmlProcessingRuntime(options),parsed=parseMusicXmlTree(input,runtime);
  if(options.source.format!=='musicxml'||options.source.byteLength===null||options.source.byteLength!==parsed.normalizedInput.byteLength)throw new MusicXmlError('Notation MusicXML source identity does not match input bytes.','SOURCE_IDENTITY_MISMATCH',{expected:options.source.byteLength,observed:parsed.normalizedInput.byteLength,format:options.source.format});
  const root=parsed.document.root;if(root.name!=='score-partwise'||root.uri!=='')throw new MusicXmlError('Notation importer supports unnamespaced score-partwise only.','UNSUPPORTED_MUSICXML',{root:root.name,uri:root.uri});
  const core=scoreOnlyProjection(root),coreBytes=new TextEncoder().encode(core).byteLength;
  const base=importMusicXmlWithMeasureSemantics(core,{...options,source:{...options.source,byteLength:coreBytes}});
  const score=createScoreDocument({...base.score,source:options.source});
  const notation=buildNotation(score,root),measureSemantics=createMusicXmlMeasureSemanticsDocument(score,base.measureSemantics);
  return Object.freeze({score,notation,measureSemantics});
};
