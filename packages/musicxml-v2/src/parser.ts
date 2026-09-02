import { SaxesParser } from 'saxes';
import {
  MusicXmlError,
  createMusicXmlProcessingRuntime,
  normalizeMusicXmlInput,
  type MusicXmlInput,
  type MusicXmlProcessingOptions,
  type ParsedXmlAttribute,
  type ParsedXmlNode
} from '../../musicxml/src/index.js';

export interface ParsedMusicXmlV2Result {
  readonly inputByteLength: number;
  readonly root: ParsedXmlNode;
}

type MutableNode = {
  name: string;
  uri: string;
  attributes: ParsedXmlAttribute[];
  text: string;
  children: MutableNode[];
};

const ELEMENTS = new Set([
  'score-partwise','part-list','score-part','part-name','part','measure','attributes','divisions','key','fifths','time','beats','beat-type','staves','clef','sign','line','clef-octave-change',
  'note','grace','chord','pitch','rest','duration','voice','staff','step','alter','octave','type','dot','accidental','beam','time-modification','actual-notes','normal-notes','tie','notations','tied','slur','tuplet',
  'articulations','accent','strong-accent','staccato','tenuto','detached-legato','staccatissimo','spiccato','scoop','plop','doit','falloff','breath-mark','caesura','stress','unstress','soft-accent',
  'ornaments','trill-mark','turn','delayed-turn','inverted-turn','delayed-inverted-turn','vertical-turn','inverted-vertical-turn','shake','mordent','inverted-mordent','schleifer','haydn','accidental-mark','tremolo','wavy-line',
  'backup','forward','barline','bar-style','repeat'
]);

const ATTRIBUTES: Readonly<Record<string, ReadonlySet<string>>> = Object.freeze({
  'score-partwise': new Set(['version']),
  'score-part': new Set(['id']),
  part: new Set(['id']),
  measure: new Set(['number','implicit','non-controlling']),
  clef: new Set(['number']),
  barline: new Set(['location']),
  repeat: new Set(['direction']),
  beam: new Set(['number']),
  tie: new Set(['type']),
  tied: new Set(['type','number']),
  slur: new Set(['type','number']),
  tuplet: new Set(['type','number']),
  grace: new Set(['slash','steal-time-previous','steal-time-following','make-time']),
  accent: new Set(['placement']),
  'strong-accent': new Set(['placement','type']),
  staccato: new Set(['placement']), tenuto: new Set(['placement']), 'detached-legato': new Set(['placement']), staccatissimo: new Set(['placement']), spiccato: new Set(['placement']),
  scoop: new Set(['placement']), plop: new Set(['placement']), doit: new Set(['placement']), falloff: new Set(['placement']), 'breath-mark': new Set(['placement']), caesura: new Set(['placement']), stress: new Set(['placement']), unstress: new Set(['placement']), 'soft-accent': new Set(['placement']),
  'trill-mark': new Set(['placement']), turn: new Set(['placement']), 'delayed-turn': new Set(['placement']), 'inverted-turn': new Set(['placement']), 'delayed-inverted-turn': new Set(['placement']), 'vertical-turn': new Set(['placement']), 'inverted-vertical-turn': new Set(['placement']), shake: new Set(['placement']), mordent: new Set(['placement']), 'inverted-mordent': new Set(['placement']), schleifer: new Set(['placement']), haydn: new Set(['placement']),
  'accidental-mark': new Set(['placement']),
  tremolo: new Set(['type','number','placement']),
  'wavy-line': new Set(['type','number','placement'])
});

const TEXT_ONLY = new Set([
  'part-name','divisions','fifths','beats','beat-type','sign','line','clef-octave-change','duration','voice','staff','step','alter','octave','type','accidental','beam','actual-notes','normal-notes','bar-style','accidental-mark','tremolo'
]);
const EMPTY = new Set([
  'rest','chord','dot','tie','tied','slur','tuplet','repeat','grace',
  'accent','strong-accent','staccato','tenuto','detached-legato','staccatissimo','spiccato','scoop','plop','doit','falloff','breath-mark','caesura','stress','unstress','soft-accent',
  'trill-mark','turn','delayed-turn','inverted-turn','delayed-inverted-turn','vertical-turn','inverted-vertical-turn','shake','mordent','inverted-mordent','schleifer','haydn','wavy-line'
]);

const deepFreeze = <T>(value: T): Readonly<T> => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const item of Object.values(value as Record<string, unknown>)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
};

export const parseMusicXmlV2Tree = (input: MusicXmlInput, options: MusicXmlProcessingOptions = {}): ParsedMusicXmlV2Result => {
  const runtime = createMusicXmlProcessingRuntime(options);
  const normalized = normalizeMusicXmlInput(input, runtime);
  runtime.checkpoint('musicxml-v2:parse:start');
  const parser = new SaxesParser({ xmlns: true, position: true });
  const stack: MutableNode[] = [];
  let root: MutableNode | null = null;
  let elements = 0, attributes = 0, textBytes = 0;

  parser.on('error', (error) => { throw error; });
  parser.on('opentag', (tag) => {
    runtime.checkpoint('musicxml-v2:open');
    const depth = stack.length + 1;
    if (depth > runtime.limits.maxDepth) throw new MusicXmlError('XML structural resource limit exceeded.','XML_DEPTH_LIMIT_EXCEEDED',{limit:runtime.limits.maxDepth,observed:depth});
    elements += 1;
    if (elements > runtime.limits.maxElements) throw new MusicXmlError('XML structural resource limit exceeded.','XML_ELEMENT_LIMIT_EXCEEDED',{limit:runtime.limits.maxElements,observed:elements});
    const name = tag.local || tag.name, uri = tag.uri || '';
    if (uri !== '' || !ELEMENTS.has(name)) throw new MusicXmlError('Unsupported MusicXML v2-profile element.','UNSUPPORTED_MUSICXML',{element:name,uri});
    const attrs = Object.values(tag.attributes).map((item) => ({ name:item.local || item.name, value:item.value, uri:item.uri || '' }));
    attributes += attrs.length;
    if (attributes > runtime.limits.maxAttributes) throw new MusicXmlError('XML structural resource limit exceeded.','XML_ATTRIBUTE_LIMIT_EXCEEDED',{limit:runtime.limits.maxAttributes,observed:attributes});
    const allowed = ATTRIBUTES[name] ?? new Set<string>();
    for (const item of attrs) if (item.uri !== '' || !allowed.has(item.name)) throw new MusicXmlError('Unsupported MusicXML v2-profile attribute.','UNSUPPORTED_MUSICXML',{element:name,attribute:item.name,uri:item.uri});
    const parent = stack.at(-1);
    if (parent !== undefined && (TEXT_ONLY.has(parent.name) || EMPTY.has(parent.name))) throw new MusicXmlError('Leaf MusicXML v2-profile element cannot contain children.','UNSUPPORTED_MUSICXML',{parent:parent.name,child:name});
    const node: MutableNode = { name, uri, attributes:attrs, text:'', children:[] };
    if (parent === undefined) { if (root !== null) throw new MusicXmlError('XML must contain exactly one root element.','INVALID_XML'); root = node; }
    else parent.children.push(node);
    stack.push(node);
  });
  const append = (text: string): void => {
    runtime.checkpoint('musicxml-v2:text');
    textBytes += new TextEncoder().encode(text).byteLength;
    if (textBytes > runtime.limits.maxTextBytes) throw new MusicXmlError('XML structural resource limit exceeded.','XML_TEXT_LIMIT_EXCEEDED',{limit:runtime.limits.maxTextBytes,observed:textBytes});
    const current = stack.at(-1);
    if (current !== undefined) {
      if (EMPTY.has(current.name) && text.trim().length > 0) throw new MusicXmlError('Empty MusicXML v2-profile marker cannot contain text.','UNSUPPORTED_MUSICXML',{element:current.name});
      current.text += text;
    }
  };
  parser.on('text', append); parser.on('cdata', append); parser.on('closetag', () => { stack.pop(); });
  try { parser.write(normalized.xml).close(); }
  catch (error) { if (error instanceof MusicXmlError) throw error; throw new MusicXmlError('XML is not well formed.','INVALID_XML'); }
  runtime.checkpoint('musicxml-v2:parse:complete');
  if (root === null || stack.length !== 0) throw new MusicXmlError('XML is not well formed.','INVALID_XML');
  return Object.freeze({ inputByteLength:normalized.byteLength, root:deepFreeze(root) as ParsedXmlNode });
};
