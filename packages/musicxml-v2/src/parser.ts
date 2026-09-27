import{SaxesParser}from'saxes';
import{MusicXmlError,createMusicXmlCompatibilityRecorder,createMusicXmlProcessingRuntime,normalizeMusicXmlInput,type MusicXmlCompatibilityEvidence,type MusicXmlInput,type MusicXmlProcessingOptions,type ParsedXmlAttribute,type ParsedXmlNode}from'../../musicxml/src/index.js';
import{musicXmlCompatibilityAttributeCode as ac,musicXmlCompatibilityElementCode as ec}from'../../musicxml/src/compatibilityPolicy.js';

export interface ParsedMusicXmlV2Result{readonly inputByteLength:number;readonly root:ParsedXmlNode;readonly compatibility:Readonly<MusicXmlCompatibilityEvidence>;}
type N={name:string;uri:string;attributes:ParsedXmlAttribute[];text:string;children:N[]};
type L={name:'stem'|'notehead'|'staff-details';pathClass:string;text:string};
const I='IGNORABLE_PRESENTATION_METADATA',F='UNSUPPORTED_SEMANTIC_FAIL_CLOSED',U='UNSUPPORTED_MUSICXML';
const TEXT='|part-name|divisions|fifths|beats|beat-type|sign|line|clef-octave-change|duration|voice|staff|step|alter|octave|type|accidental|beam|actual-notes|normal-notes|bar-style|accidental-mark|tremolo|';
const EMPTY='|rest|chord|dot|tie|tied|slur|tuplet|repeat|grace|accent|strong-accent|staccato|tenuto|detached-legato|staccatissimo|spiccato|scoop|plop|doit|falloff|breath-mark|caesura|stress|unstress|soft-accent|trill-mark|turn|delayed-turn|inverted-turn|delayed-inverted-turn|vertical-turn|inverted-vertical-turn|shake|mordent|inverted-mordent|schleifer|haydn|wavy-line|';
const has=(s:string,n:string):boolean=>s.includes('|'+n+'|');
const fr=<T>(v:T):Readonly<T>=>{if(v!==null&&typeof v==='object'&&!Object.isFrozen(v)){for(const x of Object.values(v as Record<string,unknown>))fr(x);Object.freeze(v);}return v;};
const bad=(d:Record<string,unknown>):never=>{throw new MusicXmlError('Unsupported MusicXML.',U,{...d,compatibilityClass:F});};
const lim=(c:'XML_DEPTH_LIMIT_EXCEEDED'|'XML_ELEMENT_LIMIT_EXCEEDED'|'XML_ATTRIBUTE_LIMIT_EXCEEDED'|'XML_TEXT_LIMIT_EXCEEDED',m:number,o:number):never=>{throw new MusicXmlError('XML limit.',c,{limit:m,observed:o});};
const pk=(p:readonly string[],n:string):string=>[...p,n].join('/');

export const parseMusicXmlV2Tree=(input:MusicXmlInput,options:MusicXmlProcessingOptions={}):ParsedMusicXmlV2Result=>{
 const rt=createMusicXmlProcessingRuntime(options),z=normalizeMusicXmlInput(input,rt),x=new SaxesParser({xmlns:true}),st:N[]=[],p:string[]=[],r=createMusicXmlCompatibilityRecorder();
 const record=(e:string,a:string|null,k:string):void=>r.record({classification:I,element:e,attribute:a,pathClass:k,reason:'i'});
 rt.checkpoint('v2:s');let root:N|null=null,skip=0,leaf:L|null=null,ne=0,na=0,nt=0;
 x.on('error',e=>{throw e;});
 x.on('opentag',t=>{
  rt.checkpoint('v2:o');const dep=p.length+1;if(dep>rt.limits.maxDepth)lim('XML_DEPTH_LIMIT_EXCEEDED',rt.limits.maxDepth,dep);if(++ne>rt.limits.maxElements)lim('XML_ELEMENT_LIMIT_EXCEEDED',rt.limits.maxElements,ne);
  const n=t.local||t.name,u=t.uri||'',aa=Object.values(t.attributes).map(a=>({name:a.local||a.name,value:a.value,uri:a.uri||''}));na+=aa.length;if(na>rt.limits.maxAttributes)lim('XML_ATTRIBUTE_LIMIT_EXCEEDED',rt.limits.maxAttributes,na);
  if(skip){p.push(n);skip++;return;}if(leaf)bad({parent:leaf.name,child:n});
  const c=ec(p,n,u),k=pk(p,n);
  if(c===3){if(aa.some(a=>a.uri!==''||a.name!=='filled'||(a.value!=='yes'&&a.value!=='no')))bad({element:n});leaf={name:'notehead',pathClass:k,text:''};p.push(n);return;}
  if(c===4){if(aa.length!==1||aa[0]?.uri!==''||aa[0]?.name!=='print-object'||aa[0]?.value!=='yes')bad({element:n});leaf={name:'staff-details',pathClass:k,text:''};p.push(n);return;}
  if(c===2)bad({element:n,uri:u});
  if(c===1){record(n,null,k);p.push(n);skip=1;return;}
  if(c===5){for(const a of aa){if(ac(p,n,a.name,a.uri)!==1)bad({element:n,attribute:a.name,uri:a.uri});record(n,a.name,k);}leaf={name:'stem',pathClass:k,text:''};p.push(n);return;}
  const kept:ParsedXmlAttribute[]=[];for(const a of aa){const q=ac(p,n,a.name,a.uri);if(q===0)kept.push(a);else if(q===1)record(n,a.name,k);else bad({element:n,attribute:a.name,uri:a.uri});}
  const parent=st.at(-1);if(parent&&(has(TEXT,parent.name)||has(EMPTY,parent.name)))bad({parent:parent.name,child:n});
  const node:N={name:n,uri:u,attributes:kept,text:'',children:[]};if(!parent){if(root)throw new MusicXmlError('Multiple XML roots.','INVALID_XML');root=node;}else parent.children.push(node);st.push(node);p.push(n);
 });
 const add=(s:string):void=>{rt.checkpoint('v2:t');nt+=new TextEncoder().encode(s).byteLength;if(nt>rt.limits.maxTextBytes)lim('XML_TEXT_LIMIT_EXCEEDED',rt.limits.maxTextBytes,nt);if(skip)return;if(leaf){leaf.text+=s;return;}const q=st.at(-1);if(q){if(has(EMPTY,q.name)&&s.trim())bad({element:q.name});q.text+=s;}};
 x.on('text',add);x.on('cdata',add);x.on('closetag',()=>{if(skip){skip--;p.pop();return;}if(leaf){const v=leaf,s=v.text.trim();if((v.name==='notehead'&&s!=='normal')||(v.name==='staff-details'&&s))bad({element:v.name,value:s});record(v.name,null,v.pathClass);leaf=null;p.pop();return;}st.pop();p.pop();});
 try{x.write(z.xml).close();}catch(e){if(e instanceof MusicXmlError)throw e;throw new MusicXmlError('Invalid XML.','INVALID_XML');}
 rt.checkpoint('v2:e');if(root===null||st.length||p.length||skip||leaf)throw new MusicXmlError('Invalid XML.','INVALID_XML');
 return Object.freeze({inputByteLength:z.byteLength,root:fr(root) as ParsedXmlNode,compatibility:r.snapshot()});
};
