import { SaxesParser } from 'saxes';
import { MusicXmlError } from '../../musicxml/src/errors.js';
import {
  musicXmlCompatibilityAttributeCodeAt,
  musicXmlCompatibilityElementCodeAt
} from '../../musicxml/src/compatibilityPolicy.js';
import type { MusicXmlCompatibilityEvidence } from '../../musicxml/src/compatibilityDiagnostics.js';
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

type MutableDiagnostic = {
  classification: 'IGNORABLE_PRESENTATION_METADATA';
  element: string;
  attribute: string | null;
  pathClass: string;
  reason: string;
  count: number;
};

const TEXT_ONLY = '|part-name|divisions|fifths|beats|beat-type|sign|line|clef-octave-change|duration|voice|staff|step|alter|octave|type|accidental|beam|actual-notes|normal-notes|bar-style|accidental-mark|tremolo|';
const EMPTY = '|rest|chord|dot|tie|tied|slur|tuplet|repeat|grace|accent|strong-accent|staccato|tenuto|detached-legato|staccatissimo|spiccato|scoop|plop|doit|falloff|breath-mark|caesura|stress|unstress|soft-accent|trill-mark|turn|delayed-turn|inverted-turn|delayed-inverted-turn|vertical-turn|inverted-vertical-turn|shake|mordent|inverted-mordent|schleifer|haydn|wavy-line|';
const has = (set: string, value: string): boolean => set.includes(`|${value}|`);
const LIMIT = 'XML structural resource limit exceeded.';
const INVALID = 'XML is not well formed.';

const deepFreeze = <T>(value: T): Readonly<T> => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const item of Object.values(value as Record<string, unknown>)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
};

const unsupported = (element: string, attribute: string | null = null): never => {
  throw new MusicXmlError('Unsupported MusicXML.','UNSUPPORTED_MUSICXML',{
    element,
    attribute,
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
  const nodes: MutableNode[] = [], parts: string[] = [], diagnostics: MutableDiagnostic[] = [];
  let root: MutableNode | null = null;
  let skip = 0, leafName = '', leafText = '', elements = 0, attributes = 0, textBytes = 0, truncated = false;

  const record = (element: string, attribute: string | null, pathClass: string): void => {
    const existing = diagnostics.find(item => item.element === element && item.attribute === attribute && item.pathClass === pathClass);
    if (existing !== undefined) existing.count++;
    else if (diagnostics.length < 64) diagnostics.push({classification:'IGNORABLE_PRESENTATION_METADATA',element,attribute,pathClass,reason:'reviewed',count:1});
    else truncated = true;
  };

  parser.on('error', error => { throw error; });
  parser.on('opentag', tag => {
    runtime.checkpoint('musicxml-v2:open');
    const depth = parts.length + 1;
    if (depth > runtime.limits.maxDepth) throw new MusicXmlError(LIMIT,'XML_DEPTH_LIMIT_EXCEEDED',{limit:runtime.limits.maxDepth,observed:depth});
    if (++elements > runtime.limits.maxElements) throw new MusicXmlError(LIMIT,'XML_ELEMENT_LIMIT_EXCEEDED',{limit:runtime.limits.maxElements,observed:elements});

    const name = tag.local || tag.name, uri = tag.uri || '', parentPath = parts.join('/');
    const attrs = Object.values(tag.attributes).map(item => ({name:item.local || item.name,value:item.value,uri:item.uri || ''}));
    attributes += attrs.length;
    if (attributes > runtime.limits.maxAttributes) throw new MusicXmlError(LIMIT,'XML_ATTRIBUTE_LIMIT_EXCEEDED',{limit:runtime.limits.maxAttributes,observed:attributes});

    if (skip > 0) {
      parts.push(name);
      skip++;
      return;
    }
    if (leafName !== '') unsupported(leafName,name);

    const pathClass = parentPath === '' ? name : `${parentPath}/${name}`;
    const special =
      uri === '' &&
      ((name === 'notehead' && parentPath === 'score-partwise/part/measure/note') ||
       (name === 'staff-details' && parentPath === 'score-partwise/part/measure/attributes') ||
       (name === 'stem' && parentPath === 'score-partwise/part/measure/note'));

    if (special) {
      if (name === 'notehead') {
        for (const a of attrs) if (a.uri !== '' || a.name !== 'filled' || (a.value !== 'yes' && a.value !== 'no')) unsupported(name,a.name);
      } else if (name === 'staff-details') {
        const a = attrs[0];
        if (attrs.length !== 1 || a?.uri !== '' || a?.name !== 'print-object' || a?.value !== 'yes') unsupported(name);
      } else {
        for (const a of attrs) {
          if (musicXmlCompatibilityAttributeCodeAt(parentPath,name,a.name,a.uri) !== 1) unsupported(name,a.name);
          record(name,a.name,pathClass);
        }
      }
      leafName = name;
      leafText = '';
      parts.push(name);
      return;
    }

    const code = musicXmlCompatibilityElementCodeAt(parentPath,name,uri);
    if (code === 2) unsupported(name);
    if (code === 1) {
      record(name,null,pathClass);
      parts.push(name);
      skip = 1;
      return;
    }

    const kept: ParsedXmlAttribute[] = [];
    for (const a of attrs) {
      const ac = musicXmlCompatibilityAttributeCodeAt(parentPath,name,a.name,a.uri);
      if (ac === 0) kept.push(a);
      else if (ac === 1) record(name,a.name,pathClass);
      else unsupported(name,a.name);
    }

    const parent = nodes.at(-1);
    if (parent !== undefined && (has(TEXT_ONLY,parent.name) || has(EMPTY,parent.name))) unsupported(parent.name,name);
    const node: MutableNode = {name,uri,attributes:kept,text:'',children:[]};
    if (parent === undefined) {
      if (root !== null) throw new MusicXmlError(INVALID,'INVALID_XML');
      root = node;
    } else parent.children.push(node);
    nodes.push(node);
    parts.push(name);
  });

  const append = (text: string): void => {
    runtime.checkpoint('musicxml-v2:text');
    textBytes += new TextEncoder().encode(text).byteLength;
    if (textBytes > runtime.limits.maxTextBytes) throw new MusicXmlError(LIMIT,'XML_TEXT_LIMIT_EXCEEDED',{limit:runtime.limits.maxTextBytes,observed:textBytes});
    if (skip > 0) return;
    if (leafName !== '') {
      leafText += text;
      return;
    }
    const current = nodes.at(-1);
    if (current !== undefined) {
      if (has(EMPTY,current.name) && text.trim().length > 0) unsupported(current.name);
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
    if (leafName !== '') {
      const value = leafText.trim(), name = leafName;
      if ((name === 'notehead' && value !== 'normal') || (name === 'staff-details' && value !== '')) unsupported(name);
      record(name,null,parts.join('/'));
      leafName = leafText = '';
      parts.pop();
      return;
    }
    nodes.pop();
    parts.pop();
  });

  try { parser.write(normalized.xml).close(); }
  catch (error) { if (error instanceof MusicXmlError) throw error; throw new MusicXmlError(INVALID,'INVALID_XML'); }

  runtime.checkpoint('musicxml-v2:parse:complete');
  if (root === null || nodes.length !== 0 || parts.length !== 0 || skip !== 0 || leafName !== '') throw new MusicXmlError(INVALID,'INVALID_XML');

  return deepFreeze({
    inputByteLength:normalized.byteLength,
    root,
    compatibility:{diagnostics,truncated}
  }) as ParsedMusicXmlV2Result;
};
