import { addressEntityV2, createSemanticAddressIndexV2 } from '../../addressing-v2/src/index.js';
import type { ParsedXmlNode } from '../../musicxml/src/index.js';
import { createScoreDocumentV2, type ScoreDocumentV2, type ScoreEvent } from '../../score-model-v2/src/index.js';
import { createNotationDocumentV2, type NotationDocumentV2 } from '../../notation-structure-v2/src/index.js';
import { importNotationMusicXmlV2 as legacyImport, type NotationMusicXmlV2ImportResult } from './importer.js';
import { parseMusicXmlV2Tree } from './parser.js';
import { serializeNotationMusicXmlV2 as legacySerialize } from './serializer.js';

export const MUSICXML_NOTE_IDENTITY_BRIDGE_VERSION='0.2.0' as const;
const ID=/^[A-Za-z_][A-Za-z0-9._-]{0,127}$/;
const kids=(n:ParsedXmlNode,name:string)=>n.children.filter(x=>x.name===name);
const at=(n:ParsedXmlNode,name:string)=>n.attributes.find(x=>x.uri===''&&x.name===name)?.value;
const pos=(n:ParsedXmlNode|undefined)=>{const x=Number(n?.text.trim()??'1');return Number.isSafeInteger(x)&&x>0?x:1;};

type Candidate={generated:string;explicit:string};
const candidates=(root:ParsedXmlNode):Candidate[]=>{
  const out:Candidate[]=[];
  kids(root,'part').forEach((part,pi)=>kids(part,'measure').forEach((measure,mi)=>{
    const events=new Map<string,number>(),tones=new Map<string,number>();
    for(const note of kids(measure,'note')){
      if(kids(note,'grace').length)continue;
      const staff=pos(kids(note,'staff')[0]),voice=pos(kids(note,'voice')[0]),key=`${staff}:${voice}`,chord=kids(note,'chord').length>0;
      let event=events.get(key)??0;
      if(!chord){event+=1;events.set(key,event);tones.set(key,0);}
      if(event===0||kids(note,'pitch').length===0)continue;
      const tone=(tones.get(key)??0)+1;tones.set(key,tone);
      const explicit=at(note,'id');
      if(explicit&&ID.test(explicit))out.push({generated:`note-${pi+1}-${staff}-${mi+1}-${voice}-${event}-${tone}`,explicit});
    }
  }));
  return out;
};

const admitted=(root:ParsedXmlNode,score:ScoreDocumentV2):Map<string,string>=>{
  const list=candidates(root),count=new Map<string,number>();
  list.forEach(x=>count.set(x.explicit,(count.get(x.explicit)??0)+1));
  const occupied=createSemanticAddressIndexV2(score).byEntityId;
  return new Map(list.filter(x=>count.get(x.explicit)===1&&(x.explicit===x.generated||!occupied.has(x.explicit))).map(x=>[x.generated,x.explicit]));
};

const remapEvent=(event:ScoreEvent,map:ReadonlyMap<string,string>):ScoreEvent=>{
  if(event.kind==='rest')return event;
  if(event.kind==='note'){const id=map.get(event.note.id);return id?{...event,note:{...event.note,id}}:event;}
  let changed=false;const notes=event.notes.map(note=>{const id=map.get(note.id);if(id)changed=true;return id?{...note,id}:note;});
  return changed?{...event,notes}:event;
};
const remapScore=(score:ScoreDocumentV2,map:ReadonlyMap<string,string>):Readonly<ScoreDocumentV2>=>map.size===0?score:createScoreDocumentV2({...score,parts:score.parts.map(p=>({...p,staves:p.staves.map(s=>({...s,measures:s.measures.map(m=>({...m,voices:m.voices.map(v=>({...v,events:v.events.map(e=>remapEvent(e,map))}))}))}))}))});
const remapNotation=(score:Readonly<ScoreDocumentV2>,notation:Readonly<NotationDocumentV2>,map:ReadonlyMap<string,string>):Readonly<NotationDocumentV2>=>map.size===0?notation:createNotationDocumentV2(score,{...notation,notes:notation.notes.map(entry=>{const id=map.get(entry.target.noteId);if(!id)return entry;const target=addressEntityV2(score,id);return target.kind==='note'?{target,notation:entry.notation}:entry;})});

export const importNotationMusicXmlV2PreservingNoteIds=(input:Parameters<typeof legacyImport>[0],options:Parameters<typeof legacyImport>[1]):NotationMusicXmlV2ImportResult=>{
  const parsed=parseMusicXmlV2Tree(input,options),base=legacyImport(input,options),map=admitted(parsed.root,base.score),score=remapScore(base.score,map);
  return Object.freeze({score,notation:remapNotation(score,base.notation,map)});
};

const plan=(score:ScoreDocumentV2):(string|null)[]=>{
  const out:(string|null)[]=[],sort=<T extends {readonly ordinal:number}>(x:readonly T[])=>[...x].sort((a,b)=>a.ordinal-b.ordinal);
  for(const part of score.parts){const staves=sort(part.staves),measures=sort(staves[0]?.measures??[]);for(let mi=0;mi<measures.length;mi++)for(const staff of staves){const measure=sort(staff.measures)[mi];if(!measure)continue;for(const voice of sort(measure.voices))for(const event of voice.events){if(event.kind==='rest')out.push(null);else if(event.kind==='note')out.push(event.note.id);else out.push(...event.notes.map(n=>n.id));}}}
  return out;
};
export const serializeNotationMusicXmlV2PreservingNoteIds=(scoreInput:Parameters<typeof legacySerialize>[0],notation:Parameters<typeof legacySerialize>[1]):string=>{
  const score=createScoreDocumentV2(scoreInput),ids=plan(score);let i=0;
  const xml=legacySerialize(score,notation).replace(/<note>(?!\s*<grace\b)/g,()=>{const id=ids[i++];return id&&ID.test(id)?`<note id="${id}">`:'<note>';});
  if(i!==ids.length)throw new Error('MusicXML note identity emission count mismatch.');
  return xml;
};
