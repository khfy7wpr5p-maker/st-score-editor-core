import { SaxesParser } from 'saxes';
import {
  MusicXmlError,
  createMusicXmlCompatibilityRecorder,
  createMusicXmlProcessingRuntime,
  normalizeMusicXmlInput,
  type MusicXmlCompatibilityEvidence,
  type MusicXmlInput,
  type MusicXmlProcessingOptions,
  type ParsedXmlAttribute,
  type ParsedXmlNode
} from '../../musicxml/src/index.js';
import {
  musicXmlCompatibilityAttributeCode,
  musicXmlCompatibilityElementCode
} from '../../musicxml/src/compatibilityPolicy.js';

export interface ParsedMusicXmlV2Result {
  readonly inputByteLength:number;
  readonly root:ParsedXmlNode;
  readonly compatibility:Readonly<MusicXmlCompatibilityEvidence>;
}
type MutableNode={name:string;uri:string;attributes:ParsedXmlAttribute[];text:string;children:MutableNode[]};
type IgnoredLeaf={name:'stem'|'notehead'|'staff-details';pathClass:string;text:string};

const I='IGNORABLE_PRESENTATION_METADATA',F='UNSUPPORTED_SEMANTIC_FAIL_CLOSED',U='UNSUPPORTED_MUSICXML';
const TEXT:readonly string[]=['part-name','divisions','fifths','beats','beat-type','sign','line','clef-octave-change','duration','voice','staff','step','alter','octave','type','accidental','beam','actual-notes','normal-notes','bar-style','accidental-mark','tremolo'];
const EMPTY:readonly string[]=['rest','chord','dot','tie','tied','slur','tuplet','repeat','grace','accent','strong-accent','staccato','tenuto','detached-legato','staccatissimo','spiccato','scoop','plop','doit','falloff','breath-mark','caesura','stress','unstress','soft-accent','trill-mark','turn','delayed-turn','inverted-turn','delayed-inverted-turn','vertical-turn','inverted-vertical-turn','shake','mordent','inverted-mordent','schleifer','haydn','wavy-line'];
const freeze=<T>(v:T):Readonly<T>=>{if(v!==null&&typeof v==='object'&&!Object.isFrozen(v)){for(const x of Object.values(v as Record<string,unknown>))freeze(x);Object.freeze(v);}return v;};
const unsupported=(details:Record<string,unknown>):never=>{throw new MusicXmlError('Unsupported MusicXML v2 profile.',U,{...details,compatibilityClass:F});};
const limit=(code:'XML_DEPTH_LIMIT_EXCEEDED'|'XML_ELEMENT_LIMIT_EXCEEDED'|'XML_ATTRIBUTE_LIMIT_EXCEEDED'|'XML_TEXT_LIMIT_EXCEEDED',max:number,seen:number):never=>{throw new MusicXmlError('XML structural resource limit exceeded.',code,{limit:max,observed:seen});};
const pathKey=(path:readonly string[],name:string):string=>[...path,name].join('/');

export const parseMusicXmlV2Tree=(input:MusicXmlInput,options:MusicXmlProcessingOptions={}):ParsedMusicXmlV2Result=>{
  const runtime=createMusicXmlProcessingRuntime(options),normalized=normalizeMusicXmlInput(input,runtime),parser=new SaxesParser({xmlns:true,position:true}),stack:MutableNode[]=[],path:string[]=[],recorder=createMusicXmlCompatibilityRecorder();
  const record=(element:string,attribute:string|null,pathClass:string,reason:string):void=>recorder.record({classification:I,element,attribute,pathClass,reason});
  runtime.checkpoint('musicxml-v2:parse:start');
  let root:MutableNode|null=null,skip=0,special:IgnoredLeaf|null=null,elements=0,attributes=0,textBytes=0;
  parser.on('error',(error)=>{throw error;});
  parser.on('opentag',(tag)=>{
    runtime.checkpoint('musicxml-v2:open');
    const depth=path.length+1;if(depth>runtime.limits.maxDepth)limit('XML_DEPTH_LIMIT_EXCEEDED',runtime.limits.maxDepth,depth);
    if(++elements>runtime.limits.maxElements)limit('XML_ELEMENT_LIMIT_EXCEEDED',runtime.limits.maxElements,elements);
    const name=tag.local||tag.name,uri=tag.uri||'',attrs=Object.values(tag.attributes).map(a=>({name:a.local||a.name,value:a.value,uri:a.uri||''}));
    attributes+=attrs.length;if(attributes>runtime.limits.maxAttributes)limit('XML_ATTRIBUTE_LIMIT_EXCEEDED',runtime.limits.maxAttributes,attributes);
    if(skip){path.push(name);skip++;return;}
    if(special)unsupported({parent:special.name,child:name});
    const parentPath=path.join('/');
    if(uri===''&&name==='notehead'&&parentPath==='score-partwise/part/measure/note'){
      if(attrs.some(a=>a.uri!==''||a.name!=='filled'||(a.value!=='yes'&&a.value!=='no')))unsupported({element:name});
      special={name:'notehead',pathClass:pathKey(path,name),text:''};path.push(name);return;
    }
    if(uri===''&&name==='staff-details'&&parentPath==='score-partwise/part/measure/attributes'){
      if(attrs.length!==1||attrs[0]?.uri!==''||attrs[0]?.name!=='print-object'||attrs[0]?.value!=='yes')unsupported({element:name});
      special={name:'staff-details',pathClass:pathKey(path,name),text:''};path.push(name);return;
    }
    const ec=musicXmlCompatibilityElementCode(path,name,uri);
    if(ec===2)unsupported({element:name,uri});
    if(ec===1){
      const k=pathKey(path,name);
      if(name==='stem'){
        for(const a of attrs){if(musicXmlCompatibilityAttributeCode(path,name,a.name,a.uri)!==1)unsupported({element:name,attribute:a.name,uri:a.uri});record(name,a.name,k,'a');}
        special={name:'stem',pathClass:k,text:''};path.push(name);return;
      }
      record(name,null,k,'e');path.push(name);skip=1;return;
    }
    const kept:ParsedXmlAttribute[]=[];
    for(const a of attrs){
      const ac=musicXmlCompatibilityAttributeCode(path,name,a.name,a.uri);
      if(ac===0)kept.push(a);else if(ac===1)record(name,a.name,pathKey(path,name),'a');else unsupported({element:name,attribute:a.name,uri:a.uri});
    }
    const parent=stack.at(-1);if(parent&&(TEXT.includes(parent.name)||EMPTY.includes(parent.name)))unsupported({parent:parent.name,child:name});
    const node:MutableNode={name,uri,attributes:kept,text:'',children:[]};
    if(!parent){if(root)throw new MusicXmlError('XML must contain exactly one root element.','INVALID_XML');root=node;}else parent.children.push(node);
    stack.push(node);path.push(name);
  });
  const append=(text:string):void=>{
    runtime.checkpoint('musicxml-v2:text');textBytes+=new TextEncoder().encode(text).byteLength;if(textBytes>runtime.limits.maxTextBytes)limit('XML_TEXT_LIMIT_EXCEEDED',runtime.limits.maxTextBytes,textBytes);
    if(skip)return;if(special){special.text+=text;return;}const current=stack.at(-1);if(current){if(EMPTY.includes(current.name)&&text.trim())unsupported({element:current.name});current.text+=text;}
  };
  parser.on('text',append);parser.on('cdata',append);parser.on('closetag',()=>{
    if(skip){skip--;path.pop();return;}
    if(special){
      const v=special,t=v.text.trim();if((v.name==='notehead'&&t!=='normal')||(v.name==='staff-details'&&t))unsupported({element:v.name,value:t});
      record(v.name,null,v.pathClass,v.name);special=null;path.pop();return;
    }
    stack.pop();path.pop();
  });
  try{parser.write(normalized.xml).close();}catch(error){if(error instanceof MusicXmlError)throw error;throw new MusicXmlError('XML is not well formed.','INVALID_XML');}
  runtime.checkpoint('musicxml-v2:parse:complete');
  if(root===null||stack.length||path.length||skip||special)throw new MusicXmlError('XML is not well formed.','INVALID_XML');
  return Object.freeze({inputByteLength:normalized.byteLength,root:freeze(root) as ParsedXmlNode,compatibility:recorder.snapshot()});
};
