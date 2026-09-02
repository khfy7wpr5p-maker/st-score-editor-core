import {
  MusicXmlError,
  importNotationMusicXml,
  type MusicXmlImportOptions,
  type MusicXmlInput,
  type ParsedXmlNode
} from '../../musicxml/src/index.js';
import { migrateSchemaPairV1ToV2 } from '../../schema-migration-v1-v2/src/index.js';
import { createScoreDocumentV2, type GraceEvent, type GraceGroup, type GracePlaybackSpec, type Pitch, type Rational, type ScoreDocumentV2 } from '../../score-model-v2/src/index.js';
import { addressEntityV2 } from '../../addressing-v2/src/index.js';
import {
  createNotationDocumentV2,
  type ArticulationSpec,
  type EventNotationV2,
  type GraceEventNotationV2,
  type GraceNoteNotationV2,
  type NotationDocumentV2,
  type OrnamentAccidentalMark,
  type OrnamentSpec,
  type PlacementV2,
  type SimpleOrnamentKind
} from '../../notation-structure-v2/src/index.js';
import { parseMusicXmlV2Tree } from './parser.js';

export interface NotationMusicXmlV2ImportResult {
  readonly score: Readonly<ScoreDocumentV2>;
  readonly notation: Readonly<NotationDocumentV2>;
}

const children=(node:ParsedXmlNode,name?:string):readonly ParsedXmlNode[]=>name===undefined?node.children:node.children.filter((item)=>item.name===name);
const attr=(node:ParsedXmlNode,name:string):string|undefined=>node.attributes.find((item)=>item.name===name&&item.uri==='')?.value;
const one=(node:ParsedXmlNode,name:string,required=false):ParsedXmlNode|null=>{const found=children(node,name);if(found.length===0&&!required)return null;if(found.length!==1)throw new MusicXmlError(`${name} cardinality is invalid in v2 profile.`,'INVALID_MUSICXML_SEMANTICS',{observed:found.length});return found[0]!;};
const requiredText=(node:ParsedXmlNode,label:string):string=>{const value=node.text.trim();if(value.length===0)throw new MusicXmlError(`${label} is empty.`,'INVALID_MUSICXML_SEMANTICS');return value;};
const positiveInt=(node:ParsedXmlNode,label:string,max=Number.MAX_SAFE_INTEGER):number=>{const value=requiredText(node,label);if(!/^[1-9][0-9]*$/.test(value))throw new MusicXmlError(`${label} must be a positive integer.`,'INVALID_MUSICXML_SEMANTICS',{value});const out=Number(value);if(!Number.isSafeInteger(out)||out>max)throw new MusicXmlError(`${label} is outside admitted range.`,'INVALID_MUSICXML_SEMANTICS',{value,max});return out;};
const nonnegativeIntText=(value:string,label:string):number=>{if(!/^(0|[1-9][0-9]*)$/.test(value))throw new MusicXmlError(`${label} must be a non-negative integer.`,'INVALID_MUSICXML_SEMANTICS',{value});const out=Number(value);if(!Number.isSafeInteger(out))throw new MusicXmlError(`${label} exceeds safe range.`,'INVALID_MUSICXML_SEMANTICS',{value});return out;};
const esc=(v:string)=>v.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const escAttr=(v:string)=>esc(v).replaceAll('"','&quot;').replaceAll("'",'&apos;');

const V1_ATTRS:Readonly<Record<string,ReadonlySet<string>>>=Object.freeze({
  'score-partwise':new Set(['version']),'score-part':new Set(['id']),part:new Set(['id']),measure:new Set(['number','implicit','non-controlling']),clef:new Set(['number']),barline:new Set(['location']),repeat:new Set(['direction']),beam:new Set(['number']),tie:new Set(['type']),tied:new Set(['type','number']),slur:new Set(['type','number']),tuplet:new Set(['type','number'])
});
const EMPTY=new Set(['rest','chord','dot','tie','tied','slur','tuplet','repeat']);
const v1ProjectionNode=(node:ParsedXmlNode):string=>{
  if(node.name==='note'&&children(node,'grace').length>0)return'';
  if(node.name==='grace'||node.name==='articulations'||node.name==='ornaments')return'';
  if(node.name==='notations'){
    const kept=node.children.filter((item)=>item.name==='tied'||item.name==='slur'||item.name==='tuplet').map(v1ProjectionNode).filter(Boolean);
    return kept.length===0?'':`<notations>${kept.join('')}</notations>`;
  }
  const allowed=V1_ATTRS[node.name]??new Set<string>();const attrs=node.attributes.filter((item)=>item.uri===''&&allowed.has(item.name)).map((item)=>` ${item.name}="${escAttr(item.value)}"`).join('');
  if(EMPTY.has(node.name))return`<${node.name}${attrs}/>`;
  const body=node.children.length>0?node.children.map(v1ProjectionNode).filter(Boolean).join(''):esc(node.text.trim());return`<${node.name}${attrs}>${body}</${node.name}>`;
};
const v1Projection=(root:ParsedXmlNode):string=>`<?xml version="1.0" encoding="UTF-8"?>\n${v1ProjectionNode(root)}\n`;

const gcd=(a:number,b:number):number=>{let x=Math.abs(a),y=Math.abs(b);while(y!==0){const n=x%y;x=y;y=n;}return x;};
const rational=(n:number,d:number,label:string):Rational=>{if(!Number.isSafeInteger(n)||!Number.isSafeInteger(d)||d<=0||n<0)throw new MusicXmlError(`${label} rational is invalid.`,'INVALID_MUSICXML_SEMANTICS',{n,d});const g=gcd(n,d);return Object.freeze({numerator:n/g,denominator:d/g});};
const decimalRational=(raw:string,label:string):Rational=>{
  if(!/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(raw))throw new MusicXmlError(`${label} must be a non-negative decimal.`,'INVALID_MUSICXML_SEMANTICS',{raw});
  const [whole,fraction='']=raw.split('.');const denominator=10**fraction.length;if(!Number.isSafeInteger(denominator))throw new MusicXmlError(`${label} precision exceeds safe range.`,'INVALID_MUSICXML_SEMANTICS',{raw});const numerator=Number(whole)*denominator+(fraction.length===0?0:Number(fraction));if(!Number.isSafeInteger(numerator))throw new MusicXmlError(`${label} exceeds safe range.`,'INVALID_MUSICXML_SEMANTICS',{raw});return rational(numerator,denominator,label);
};
const placement=(node:ParsedXmlNode):PlacementV2=>{const value=attr(node,'placement');if(value===undefined)return'auto';if(value!=='above'&&value!=='below')throw new MusicXmlError('placement is unsupported in v2 profile.','UNSUPPORTED_MUSICXML',{value,element:node.name});return value;};
const pitch=(note:ParsedXmlNode):Pitch=>{const p=one(note,'pitch',true);if(p===null)throw new MusicXmlError('Grace pitch is missing.','INVALID_MUSICXML_SEMANTICS');const stepNode=one(p,'step',true),octaveNode=one(p,'octave',true),alterNode=one(p,'alter');if(stepNode===null||octaveNode===null)throw new MusicXmlError('Grace pitch is incomplete.','INVALID_MUSICXML_SEMANTICS');const step=requiredText(stepNode,'step');const octave=Number(requiredText(octaveNode,'octave')),alter=alterNode===null?0:Number(requiredText(alterNode,'alter'));if(!/^[A-G]$/.test(step)||!Number.isInteger(octave)||octave<-1||octave>9||!Number.isInteger(alter)||alter<-2||alter>2)throw new MusicXmlError('Grace pitch is outside canonical range.','INVALID_MUSICXML_SEMANTICS',{step,alter,octave});return Object.freeze({step:step as Pitch['step'],alter,octave});};
const TYPE_DURATION:Readonly<Record<string,Rational>>=Object.freeze({whole:{numerator:1,denominator:1},half:{numerator:1,denominator:2},quarter:{numerator:1,denominator:4},eighth:{numerator:1,denominator:8},'16th':{numerator:1,denominator:16},'32nd':{numerator:1,denominator:32},'64th':{numerator:1,denominator:64}});
const writtenDuration=(note:ParsedXmlNode):Rational=>{const typeNode=one(note,'type',true);if(typeNode===null)throw new MusicXmlError('Grace note type is required.','INVALID_MUSICXML_SEMANTICS');const value=TYPE_DURATION[requiredText(typeNode,'grace.type')];if(value===undefined)throw new MusicXmlError('Grace note type is outside bounded profile.','UNSUPPORTED_MUSICXML');return value;};
const stream=(note:ParsedXmlNode):{staff:number;voice:number}=>{const staff=one(note,'staff'),voice=one(note,'voice');return{staff:staff===null?1:positiveInt(staff,'staff',128),voice:voice===null?1:positiveInt(voice,'voice',1024)};};

const articulationNames=new Set(['accent','strong-accent','staccato','tenuto','detached-legato','staccatissimo','spiccato','scoop','plop','doit','falloff','breath-mark','caesura','stress','unstress','soft-accent']);
const parseArticulations=(note:ParsedXmlNode):readonly ArticulationSpec[]=>{const notations=one(note,'notations');if(notations===null)return Object.freeze([]);const groups=children(notations,'articulations');if(groups.length>1)throw new MusicXmlError('Multiple articulations containers are unsupported.','INVALID_MUSICXML_SEMANTICS');if(groups.length===0)return Object.freeze([]);const out:ArticulationSpec[]=[];for(const item of groups[0]!.children){if(!articulationNames.has(item.name))throw new MusicXmlError('Unsupported articulation in v2 profile.','UNSUPPORTED_MUSICXML',{kind:item.name});const direction=item.name==='strong-accent'?(attr(item,'type')??null):null;if(direction!==null&&direction!=='up'&&direction!=='down')throw new MusicXmlError('strong-accent direction is invalid.','INVALID_MUSICXML_SEMANTICS',{direction});out.push(Object.freeze({kind:item.name as ArticulationSpec['kind'],placement:placement(item),direction:direction as 'up'|'down'|null}));}return Object.freeze(out);};

const simpleNames=new Set<SimpleOrnamentKind>(['trill-mark','turn','delayed-turn','inverted-turn','delayed-inverted-turn','vertical-turn','inverted-vertical-turn','shake','mordent','inverted-mordent','schleifer','haydn']);
const accidentalValue=(node:ParsedXmlNode):OrnamentAccidentalMark=>{const value=requiredText(node,'accidental-mark');if(!['sharp','flat','natural','double-sharp','double-flat'].includes(value))throw new MusicXmlError('accidental-mark is unsupported.','UNSUPPORTED_MUSICXML',{value});return Object.freeze({accidental:value as OrnamentAccidentalMark['accidental'],placement:placement(node)});};
const parseOrnaments=(note:ParsedXmlNode):readonly OrnamentSpec[]=>{const notations=one(note,'notations');if(notations===null)return Object.freeze([]);const groups=children(notations,'ornaments');if(groups.length>1)throw new MusicXmlError('Multiple ornaments containers are unsupported.','INVALID_MUSICXML_SEMANTICS');if(groups.length===0)return Object.freeze([]);const nodes=groups[0]!.children,out:OrnamentSpec[]=[];for(let i=0;i<nodes.length;i+=1){const item=nodes[i]!;if(simpleNames.has(item.name as SimpleOrnamentKind)){const marks:OrnamentAccidentalMark[]=[];while(nodes[i+1]?.name==='accidental-mark'){i+=1;marks.push(accidentalValue(nodes[i]!));}out.push(Object.freeze({kind:item.name as SimpleOrnamentKind,placement:placement(item),accidentalMarks:Object.freeze(marks)}));continue;}if(item.name==='tremolo'){const type=attr(item,'type');if(type!=='single'&&type!=='start'&&type!=='stop')throw new MusicXmlError('tremolo type is invalid.','INVALID_MUSICXML_SEMANTICS',{type});const marks=positiveInt(item,'tremolo',8);const rawNumber=attr(item,'number');const number=rawNumber===undefined?null:Number(rawNumber);if(type==='single'&&number!==null)throw new MusicXmlError('single tremolo cannot have relation number.','INVALID_MUSICXML_SEMANTICS');if(type!=='single'&&(!Number.isSafeInteger(number)||number===null||number<1||number>16))throw new MusicXmlError('spanning tremolo requires valid relation number.','INVALID_MUSICXML_SEMANTICS',{rawNumber});out.push(Object.freeze({kind:'tremolo',type,marks,number,placement:placement(item)}));continue;}if(item.name==='wavy-line'){const type=attr(item,'type'),rawNumber=attr(item,'number'),number=rawNumber===undefined?NaN:Number(rawNumber);if(type!=='start'&&type!=='continue'&&type!=='stop')throw new MusicXmlError('wavy-line type is invalid.','INVALID_MUSICXML_SEMANTICS',{type});if(!Number.isSafeInteger(number)||number<1||number>16)throw new MusicXmlError('wavy-line number is invalid.','INVALID_MUSICXML_SEMANTICS',{rawNumber});out.push(Object.freeze({kind:'wavy-line',type,number,placement:placement(item)}));continue;}throw new MusicXmlError('Unsupported ornament in v2 profile.','UNSUPPORTED_MUSICXML',{kind:item.name});}return Object.freeze(out);};

const boundary=(note:ParsedXmlNode,name:'tied'|'slur'):readonly {number:number;type:'start'|'stop'}[]=>{const notations=one(note,'notations');if(notations===null)return Object.freeze([]);const out=[] as {number:number;type:'start'|'stop'}[];for(const item of children(notations,name)){const type=attr(item,'type'),raw=attr(item,'number'),number=raw===undefined?NaN:Number(raw);if((type!=='start'&&type!=='stop')||!Number.isSafeInteger(number)||number<1||number>16)throw new MusicXmlError(`${name} boundary is invalid.`,'INVALID_MUSICXML_SEMANTICS',{type,raw});out.push(Object.freeze({number,type}));}return Object.freeze(out);};
const beams=(note:ParsedXmlNode)=>Object.freeze(children(note,'beam').map((item)=>{const raw=attr(item,'number'),number=raw===undefined?NaN:Number(raw),value=requiredText(item,'beam');if(!Number.isSafeInteger(number)||number<1||number>8||!['begin','continue','end','forward-hook','backward-hook'].includes(value))throw new MusicXmlError('Grace beam is invalid.','INVALID_MUSICXML_SEMANTICS',{raw,value});return Object.freeze({number,value:value as 'begin'|'continue'|'end'|'forward-hook'|'backward-hook'});}));
const accidental=(note:ParsedXmlNode):GraceNoteNotationV2['accidental']=>{const node=one(note,'accidental');if(node===null)return null;const value=requiredText(node,'accidental');if(!['sharp','flat','natural','double-sharp','double-flat'].includes(value))throw new MusicXmlError('Grace accidental is unsupported.','UNSUPPORTED_MUSICXML',{value});return value as GraceNoteNotationV2['accidental'];};
const gracePlayback=(grace:ParsedXmlNode,divisions:number):{placement:'before'|'after';playback:GracePlaybackSpec;slash:boolean}=>{
  const slashRaw=attr(grace,'slash');if(slashRaw!==undefined&&slashRaw!=='yes'&&slashRaw!=='no')throw new MusicXmlError('grace slash must be yes/no.','INVALID_MUSICXML_SEMANTICS',{slashRaw});
  const previousRaw=attr(grace,'steal-time-previous'),followingRaw=attr(grace,'steal-time-following'),makeRaw=attr(grace,'make-time');
  const placement: 'before'|'after'=previousRaw===undefined?'before':'after';
  const previous=previousRaw===undefined?null:(previousRaw==='0'?null:decimalRational(previousRaw,'steal-time-previous'));
  const following=followingRaw===undefined?null:decimalRational(followingRaw,'steal-time-following');
  const makeTime=makeRaw===undefined?null:rational(nonnegativeIntText(makeRaw,'make-time'),divisions*4,'make-time');
  for(const [label,value] of [['steal-time-previous',previous],['steal-time-following',following]] as const)if(value!==null&&value.numerator>100*value.denominator)throw new MusicXmlError(`${label} exceeds 100 percent.`,'INVALID_MUSICXML_SEMANTICS');
  return{placement,playback:Object.freeze({stealTimePreviousPercent:previous,stealTimeFollowingPercent:following,makeTime}),slash:slashRaw==='yes'};
};

interface GraceParsedEvent { event:GraceEvent; eventNotation:GraceEventNotationV2; noteNotations:readonly {id:string;notation:GraceNoteNotationV2}[]; placement:'before'|'after' }
const parseGraceEvent=(nodes:readonly ParsedXmlNode[],ids:{eventId:string;notePrefix:string},divisions:number):GraceParsedEvent=>{
  if(nodes.length===0)throw new MusicXmlError('Grace chord/event is empty.','INVALID_MUSICXML_SEMANTICS');const first=nodes[0]!,grace=one(first,'grace',true);if(grace===null)throw new MusicXmlError('Grace marker missing.','INVALID_MUSICXML_SEMANTICS');const playback=gracePlayback(grace,divisions),duration=writtenDuration(first),dots=children(first,'dot').length;if(dots>3)throw new MusicXmlError('Grace dot count exceeds range.','INVALID_MUSICXML_SEMANTICS');const eventN=Object.freeze({slash:playback.slash,dots,beams:beams(first),articulations:parseArticulations(first),ornaments:parseOrnaments(first)});
  const noteNotations:{id:string;notation:GraceNoteNotationV2}[]=[];const atoms:{id:string;pitch:Pitch}[]=[];let rest=false;
  nodes.forEach((node,index)=>{const marker=one(node,'grace',true);if(marker===null)throw new MusicXmlError('Grace chord tone marker missing.','INVALID_MUSICXML_SEMANTICS');const current=gracePlayback(marker,divisions);if(current.placement!==playback.placement||!sameJson(current.playback,playback.playback)||writtenDuration(node).numerator!==duration.numerator||writtenDuration(node).denominator!==duration.denominator||children(node,'dot').length!==dots)throw new MusicXmlError('Grace chord tones disagree on event-level semantics.','INVALID_MUSICXML_SEMANTICS');const hasRest=one(node,'rest')!==null;if(hasRest){if(nodes.length!==1)throw new MusicXmlError('Grace rest cannot be chorded.','INVALID_MUSICXML_SEMANTICS');rest=true;return;}const id=`${ids.notePrefix}-${index+1}`;atoms.push({id,pitch:pitch(node)});noteNotations.push({id,notation:Object.freeze({accidental:accidental(node),ties:boundary(node,'tied'),slurs:boundary(node,'slur')})});if(index>0&&(parseArticulations(node).length>0||parseOrnaments(node).length>0||beams(node).length>0))throw new MusicXmlError('Grace chord event-level notation must appear on first tone only.','INVALID_MUSICXML_SEMANTICS');});
  const base={id:ids.eventId,writtenDuration:duration,playback:playback.playback};const event:GraceEvent=rest?Object.freeze({...base,kind:'rest'}):atoms.length===1?Object.freeze({...base,kind:'note',note:atoms[0]!}):Object.freeze({...base,kind:'chord',notes:Object.freeze(atoms)});return{event,eventNotation:eventN,noteNotations:Object.freeze(noteNotations),placement:playback.placement};
};
const sameJson=(a:unknown,b:unknown):boolean=>JSON.stringify(a)===JSON.stringify(b);

interface VoiceExtras { groups:GraceGroup[]; graceEvents:{id:string;notation:GraceEventNotationV2}[]; graceNotes:{id:string;notation:GraceNoteNotationV2}[] }
const parseExtras=(root:ParsedXmlNode,baseScore:ScoreDocumentV2,baseNotation:NotationDocumentV2):{score:Readonly<ScoreDocumentV2>;notation:Readonly<NotationDocumentV2>}=>{
  const extras=new Map<string,VoiceExtras>();const normalV2=new Map(baseNotation.events.map((entry)=>[entry.target.eventId,entry.notation]));let currentDivisions=1;
  const partNodes=children(root,'part');
  for(const [pi,partNode] of partNodes.entries())for(const [mi,measureNode] of children(partNode,'measure').entries()){
    const attributes=one(measureNode,'attributes');const divNode=attributes===null?null:one(attributes,'divisions');if(divNode!==null)currentDivisions=positiveInt(divNode,'divisions',1_000_000);
    const byStream=new Map<string,ParsedXmlNode[]>();for(const note of children(measureNode,'note')){const s=stream(note),key=`${s.staff}:${s.voice}`;const list=byStream.get(key)??[];list.push(note);byStream.set(key,list);}
    for(const [key,notes] of byStream){const [staffRaw,voiceRaw]=key.split(':'),staff=Number(staffRaw),voice=Number(voiceRaw),p=pi+1,m=mi+1,voiceId=`voice-${p}-${staff}-${m}-${voice}`;const extra=extras.get(voiceId)??{groups:[],graceEvents:[],graceNotes:[]};let eventIndex=0,lastNormal:string|null=null;let graceSerial=0;let pendingBefore:GraceParsedEvent[]=[];
      const flushBefore=(anchor:string):void=>{if(pendingBefore.length===0)return;extra.groups.push(Object.freeze({id:`grace-group-${p}-${staff}-${m}-${voice}-${eventIndex}-before`,anchorEventId:anchor,placement:'before',events:Object.freeze(pendingBefore.map((item)=>item.event))}));for(const item of pendingBefore){extra.graceEvents.push({id:item.event.id,notation:item.eventNotation});extra.graceNotes.push(...item.noteNotations);}pendingBefore=[];};
      for(let i=0;i<notes.length;){const note=notes[i]!;const isGrace=one(note,'grace')!==null;if(!isGrace){const chord=one(note,'chord')!==null;if(!chord){eventIndex+=1;lastNormal=`event-${p}-${staff}-${m}-${voice}-${eventIndex}`;flushBefore(lastNormal);const existing=normalV2.get(lastNormal);if(existing===undefined)throw new MusicXmlError('Normal v2 event mapping did not resolve.','INVALID_MUSICXML_SEMANTICS',{lastNormal});normalV2.set(lastNormal,Object.freeze({...existing,articulations:parseArticulations(note),ornaments:parseOrnaments(note)}));}else if(lastNormal===null)throw new MusicXmlError('Chord tone has no normal event.','INVALID_MUSICXML_SEMANTICS');else if(parseArticulations(note).length>0||parseOrnaments(note).length>0)throw new MusicXmlError('Normal chord event-level v2 notation must appear on first tone only.','INVALID_MUSICXML_SEMANTICS');i+=1;continue;}
        const chordNodes=[note];let j=i+1;while(j<notes.length&&one(notes[j]!,'grace')!==null&&one(notes[j]!,'chord')!==null){chordNodes.push(notes[j]!);j+=1;}graceSerial+=1;const parsed=parseGraceEvent(chordNodes,{eventId:`grace-event-${p}-${staff}-${m}-${voice}-${graceSerial}`,notePrefix:`grace-note-${p}-${staff}-${m}-${voice}-${graceSerial}`},currentDivisions);
        if(parsed.placement==='after'){if(lastNormal===null)throw new MusicXmlError('After-grace has no preceding normal anchor.','INVALID_MUSICXML_SEMANTICS');const existing=extra.groups.find((group)=>group.anchorEventId===lastNormal&&group.placement==='after');if(existing!==undefined){const idx=extra.groups.indexOf(existing);extra.groups[idx]=Object.freeze({...existing,events:Object.freeze([...existing.events,parsed.event])});}else extra.groups.push(Object.freeze({id:`grace-group-${p}-${staff}-${m}-${voice}-${eventIndex}-after`,anchorEventId:lastNormal,placement:'after',events:Object.freeze([parsed.event])}));extra.graceEvents.push({id:parsed.event.id,notation:parsed.eventNotation});extra.graceNotes.push(...parsed.noteNotations);}else pendingBefore.push(parsed);i=j;
      }
      if(pendingBefore.length>0)throw new MusicXmlError('Before-grace group has no following normal anchor.','INVALID_MUSICXML_SEMANTICS',{voiceId});extras.set(voiceId,extra);
    }
  }
  const scoreCandidate={...baseScore,parts:baseScore.parts.map((part)=>({...part,staves:part.staves.map((staff)=>({...staff,measures:staff.measures.map((measure)=>({...measure,voices:measure.voices.map((voice)=>({...voice,graceGroups:Object.freeze(extras.get(voice.id)?.groups??[])}))}))}))}))};const score=createScoreDocumentV2(scoreCandidate);
  const eventEntries=[...normalV2].filter(([,notation])=>notation.dots!==0||notation.beams.length>0||notation.tuplet!==null||notation.articulations.length>0||notation.ornaments.length>0).map(([id,notation])=>({target:addressEntityV2(score,id),notation}));
  const graceEventEntries=[...extras.values()].flatMap((extra)=>extra.graceEvents).map((entry)=>({target:addressEntityV2(score,entry.id),notation:entry.notation}));const graceNoteEntries=[...extras.values()].flatMap((extra)=>extra.graceNotes).map((entry)=>({target:addressEntityV2(score,entry.id),notation:entry.notation}));
  const notation=createNotationDocumentV2(score,{contractVersion:'2.0.0',documentId:score.id,revisionId:score.revision.id,measures:baseNotation.measures.map((entry)=>({target:addressEntityV2(score,entry.target.measureId),notation:entry.notation})) as never,events:eventEntries as never,notes:baseNotation.notes.map((entry)=>({target:addressEntityV2(score,entry.target.noteId),notation:entry.notation})) as never,graceEvents:graceEventEntries as never,graceNotes:graceNoteEntries as never});return{score,notation};
};

export const importNotationMusicXmlV2=(input:MusicXmlInput,options:MusicXmlImportOptions):Readonly<NotationMusicXmlV2ImportResult>=>{
  const parsed=parseMusicXmlV2Tree(input,options);if(parsed.root.name!=='score-partwise')throw new MusicXmlError('MusicXML v2 profile requires score-partwise root.','UNSUPPORTED_MUSICXML',{root:parsed.root.name});
  const base=importNotationMusicXml(v1Projection(parsed.root),options);const migrated=migrateSchemaPairV1ToV2(base.score,base.notation);const enriched=parseExtras(parsed.root,migrated.score,migrated.notation);return Object.freeze(enriched);
};
