import { SaxesParser } from 'saxes';
import { MusicXmlError } from '../../musicxml/src/errors.js';
import {
  musicXmlCompatibilityAttributeCode,
  musicXmlCompatibilityElementCode
} from '../../musicxml/src/compatibilityPolicy.js';
import {
  createMusicXmlCompatibilityRecorder,
  type MusicXmlCompatibilityEvidence
} from '../../musicxml/src/compatibilityDiagnostics.js';
import { createMusicXmlProcessingRuntime, type MusicXmlProcessingOptions } from '../../musicxml/src/processing.js';
import { normalizeMusicXmlInput, type MusicXmlInput } from '../../musicxml/src/xmlSafety.js';
import type { ParsedXmlAttribute, ParsedXmlNode } from '../../musicxml/src/parsedXml.js';

export interface ParsedMusicXmlV2Result {
  readonly inputByteLength: number;
  readonly root: ParsedXmlNode;
  readonly compatibility: Readonly<MusicXmlCompatibilityEvidence>;
}

type MutableNode = {
  name: string;
  uri: string;
  attributes: ParsedXmlAttribute[];
  text: string;
  children: MutableNode[];
};

const TEXT_ONLY = '|part-name|divisions|fifths|beats|beat-type|sign|line|clef-octave-change|duration|voice|staff|step|alter|octave|type|accidental|beam|actual-notes|normal-notes|bar-style|accidental-mark|tremolo|';
const EMPTY = '|rest|chord|dot|tie|tied|slur|tuplet|repeat|grace|accent|strong-accent|staccato|tenuto|detached-legato|staccatissimo|spiccato|scoop|plop|doit|falloff|breath-mark|caesura|stress|unstress|soft-accent|trill-mark|turn|delayed-turn|inverted-turn|delayed-inverted-turn|vertical-turn|inverted-vertical-turn|shake|mordent|inverted-mordent|schleifer|haydn|wavy-line|';
const has = (set: string, value: string): boolean => set.includes(`|${value}|`);
const pclass = (parts: readonly string[], name: string): string => [...parts, name].join('/');

const deepFreeze = <T>(value: T): Readonly<T> => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const item of Object.values(value as Record<string, unknown>)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
};

const unsupported = (details: Record<string, unknown>): never => {
  throw new MusicXmlError('Unsupported MusicXML v2 profile.','UNSUPPORTED_MUSICXML',{
    ...details,
    compatibilityClass:'UNSUPPORTED_SEMANTIC_FAIL_CLOSED'
  });
};

export const parseMusicXmlV2Tree = (
  input: MusicXmlInput,
  options: MusicXmlProcessingOptions = {}
): ParsedMusicXmlV2Result => {
  const runtime = createMusicXmlProcessingRuntime(options);
  const normalized = normalizeMusicXmlInput(input, runtime);
  runtime.checkpoint('musicxml-v2:parse:start');

  const parser = new SaxesParser({ xmlns:true, position:true });
  const nodes: MutableNode[] = [];
  const parts: string[] = [];
  const recorder = createMusicXmlCompatibilityRecorder();
  let root: MutableNode | null = null;
  let skip = 0;
  let leaf: { name:string; text:string } | null = null;
  let elements = 0, attributes = 0, textBytes = 0;

  parser.on('error', error => { throw error; });

  parser.on('opentag', tag => {
    runtime.checkpoint('musicxml-v2:open');
    const depth = parts.length + 1;
    if (depth > runtime.limits.maxDepth) throw new MusicXmlError('XML structural resource limit exceeded.','XML_DEPTH_LIMIT_EXCEEDED',{limit:runtime.limits.maxDepth,observed:depth});
    if (++elements > runtime.limits.maxElements) throw new MusicXmlError('XML structural resource limit exceeded.','XML_ELEMENT_LIMIT_EXCEEDED',{limit:runtime.limits.maxElements,observed:elements});

    const name = tag.local || tag.name, uri = tag.uri || '';
    const attrs = Object.values(tag.attributes).map(item => ({name:item.local || item.name,value:item.value,uri:item.uri || ''}));
    attributes += attrs.length;
    if (attributes > runtime.limits.maxAttributes) throw new MusicXmlError('XML structural resource limit exceeded.','XML_ATTRIBUTE_LIMIT_EXCEEDED',{limit:runtime.limits.maxAttributes,observed:attributes});

    if (skip > 0) {
      parts.push(name);
      skip++;
      return;
    }
    if (leaf !== null) unsupported({parent:leaf.name,child:name});

    const parentPath = parts.join('/');
    const special =
      uri === '' &&
      ((name === 'notehead' && parentPath === 'score-partwise/part/measure/note') ||
       (name === 'staff-details' && parentPath === 'score-partwise/part/measure/attributes') ||
       (name === 'stem' && parentPath === 'score-partwise/part/measure/note'));

    if (special) {
      if (name === 'notehead') {
        for (const a of attrs) if (a.uri !== '' || a.name !== 'filled' || (a.value !== 'yes' && a.value !== 'no')) unsupported({element:name,attribute:a.name,uri:a.uri});
      } else if (name === 'staff-details') {
        const a = attrs[0];
        if (attrs.length !== 1 || a?.uri !== '' || a?.name !== 'print-object' || a?.value !== 'yes') unsupported({element:name});
      } else {
        for (const a of attrs) {
          if (musicXmlCompatibilityAttributeCode(parts,name,a.name,a.uri) !== 1) unsupported({element:name,attribute:a.name,uri:a.uri});
          recorder.record({classification:'IGNORABLE_PRESENTATION_METADATA',element:name,attribute:a.name,pathClass:pclass(parts,name),reason:'reviewed'});
        }
      }
      leaf = {name,text:''};
      parts.push(name);
      return;
    }

    const code = musicXmlCompatibilityElementCode(parts,name,uri);
    if (code === 2) unsupported({element:name,uri});
    if (code === 1) {
      recorder.record({classification:'IGNORABLE_PRESENTATION_METADATA',element:name,attribute:null,pathClass:pclass(parts,name),reason:'reviewed'});
      parts.push(name);
      skip = 1;
      return;
    }

    const kept: ParsedXmlAttribute[] = [];
    for (const a of attrs) {
      const ac = musicXmlCompatibilityAttributeCode(parts,name,a.name,a.uri);
      if (ac === 0) kept.push(a);
      else if (ac === 1) recorder.record({classification:'IGNORABLE_PRESENTATION_METADATA',element:name,attribute:a.name,pathClass:pclass(parts,name),reason:'reviewed'});
      else unsupported({element:name,attribute:a.name,uri:a.uri});
    }

    const parent = nodes.at(-1);
    if (parent !== undefined && (has(TEXT_ONLY,parent.name) || has(EMPTY,parent.name))) unsupported({parent:parent.name,child:name});
    const node: MutableNode = {name,uri,attributes:kept,text:'',children:[]};
    if (parent === undefined) {
      if (root !== null) throw new MusicXmlError('XML must contain exactly one root element.','INVALID_XML');
      root = node;
    } else parent.children.push(node);
    nodes.push(node);
    parts.push(name);
  });

  const append = (text: string): void => {
    runtime.checkpoint('musicxml-v2:text');
    textBytes += new TextEncoder().encode(text).byteLength;
    if (textBytes > runtime.limits.maxTextBytes) throw new MusicXmlError('XML structural resource limit exceeded.','XML_TEXT_LIMIT_EXCEEDED',{limit:runtime.limits.maxTextBytes,observed:textBytes});
    if (skip > 0) return;
    if (leaf !== null) {
      leaf.text += text;
      return;
    }
    const current = nodes.at(-1);
    if (current !== undefined) {
      if (has(EMPTY,current.name) && text.trim().length > 0) unsupported({element:current.name});
      current.text += text;
    }
  };
  parser.on('text',append);
  parser.on('cdata',append);

  parser.on('closetag',() => {
    if (skip > 0) {
      skip--;
      parts.pop();
      return;
    }
    if (leaf !== null) {
      const current = leaf, value = current.text.trim();
      if ((current.name === 'notehead' && value !== 'normal') || (current.name === 'staff-details' && value !== '')) unsupported({element:current.name,value});
      recorder.record({classification:'IGNORABLE_PRESENTATION_METADATA',element:current.name,attribute:null,pathClass:parts.join('/'),reason:'reviewed'});
      leaf = null;
      parts.pop();
      return;
    }
    nodes.pop();
    parts.pop();
  });

  try { parser.write(normalized.xml).close(); }
  catch (error) { if (error instanceof MusicXmlError) throw error; throw new MusicXmlError('XML is not well formed.','INVALID_XML'); }

  runtime.checkpoint('musicxml-v2:parse:complete');
  if (root === null || nodes.length !== 0 || parts.length !== 0 || skip !== 0 || leaf !== null) throw new MusicXmlError('XML is not well formed.','INVALID_XML');

  return Object.freeze({inputByteLength:normalized.byteLength,root:deepFreeze(root) as ParsedXmlNode,compatibility:recorder.snapshot()});
};
