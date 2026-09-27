import { SaxesParser } from 'saxes';
import {
  MusicXmlError,
  classifyMusicXmlCompatibilityAttribute,
  classifyMusicXmlCompatibilityElement,
  createMusicXmlCompatibilityRecorder,
  createMusicXmlProcessingRuntime,
  normalizeMusicXmlInput,
  type MusicXmlCompatibilityDecision,
  type MusicXmlCompatibilityEvidence,
  type MusicXmlInput,
  type MusicXmlProcessingOptions,
  type ParsedXmlAttribute,
  type ParsedXmlNode
} from '../../musicxml/src/index.js';

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

type ConditionalIgnoredLeaf = {
  readonly kind: 'stem' | 'notehead' | 'staff-details';
  readonly name: string;
  readonly pathClass: string;
  readonly attributes: readonly ParsedXmlAttribute[];
  text: string;
};

const TEXT_ONLY: readonly string[] = [
  'part-name','divisions','fifths','beats','beat-type','sign','line','clef-octave-change','duration','voice','staff','step','alter','octave','type','accidental','beam','actual-notes','normal-notes','bar-style','accidental-mark','tremolo'
];
const EMPTY: readonly string[] = [
  'rest','chord','dot','tie','tied','slur','tuplet','repeat','grace',
  'accent','strong-accent','staccato','tenuto','detached-legato','staccatissimo','spiccato','scoop','plop','doit','falloff','breath-mark','caesura','stress','unstress','soft-accent',
  'trill-mark','turn','delayed-turn','inverted-turn','delayed-inverted-turn','vertical-turn','inverted-vertical-turn','shake','mordent','inverted-mordent','schleifer','haydn','wavy-line'
];

const deepFreeze = <T>(value: T): Readonly<T> => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const item of Object.values(value as Record<string, unknown>)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
};

const pathEquals = (path: readonly string[], expected: readonly string[]): boolean =>
  path.length === expected.length && path.every((value, index) => value === expected[index]);

const failUnsupported = (
  message: string,
  details: Record<string, unknown>
): never => {
  throw new MusicXmlError(message, 'UNSUPPORTED_MUSICXML', {
    ...details,
    compatibilityClass: 'UNSUPPORTED_SEMANTIC_FAIL_CLOSED'
  });
};

const recordIgnored = (
  recorder: ReturnType<typeof createMusicXmlCompatibilityRecorder>,
  decision: Readonly<MusicXmlCompatibilityDecision>,
  element: string,
  attribute: string | null
): void => {
  recorder.record({
    classification: 'IGNORABLE_PRESENTATION_METADATA',
    element,
    attribute,
    pathClass: decision.pathClass,
    reason: decision.reason
  });
};

const conditionalKind = (
  path: readonly string[],
  name: string,
  uri: string
): ConditionalIgnoredLeaf['kind'] | null => {
  if (uri !== '') return null;
  if (name === 'notehead' && pathEquals(path, ['score-partwise','part','measure','note'])) return 'notehead';
  if (name === 'staff-details' && pathEquals(path, ['score-partwise','part','measure','attributes'])) return 'staff-details';
  return null;
};

const validateConditionalOpen = (
  kind: ConditionalIgnoredLeaf['kind'],
  name: string,
  attributes: readonly ParsedXmlAttribute[]
): void => {
  if (kind === 'notehead') {
    for (const attribute of attributes) {
      if (
        attribute.uri !== '' ||
        attribute.name !== 'filled' ||
        (attribute.value !== 'yes' && attribute.value !== 'no')
      ) {
        failUnsupported('Unsupported MusicXML notehead presentation attribute.', {
          element: name,
          attribute: attribute.name,
          uri: attribute.uri,
          value: attribute.value
        });
      }
    }
    return;
  }
  if (kind === 'staff-details') {
    if (
      attributes.length !== 1 ||
      attributes[0]?.uri !== '' ||
      attributes[0]?.name !== 'print-object' ||
      attributes[0]?.value !== 'yes'
    ) {
      failUnsupported('Only empty print-only staff-details is admitted.', {
        element: name
      });
    }
  }
};

const validateConditionalClose = (
  value: ConditionalIgnoredLeaf
): void => {
  if (value.kind === 'notehead' && value.text.trim() !== 'normal') {
    failUnsupported('Only neutral normal notehead presentation is admitted.', {
      element: value.name,
      value: value.text.trim()
    });
  }
  if (value.kind === 'staff-details' && value.text.trim().length !== 0) {
    failUnsupported('Print-only staff-details cannot contain semantic text.', {
      element: value.name
    });
  }
};

export const parseMusicXmlV2Tree = (
  input: MusicXmlInput,
  options: MusicXmlProcessingOptions = {}
): ParsedMusicXmlV2Result => {
  const runtime = createMusicXmlProcessingRuntime(options);
  const normalized = normalizeMusicXmlInput(input, runtime);
  runtime.checkpoint('musicxml-v2:parse:start');

  const parser = new SaxesParser({ xmlns: true, position: true });
  const stack: MutableNode[] = [];
  const pathStack: string[] = [];
  const recorder = createMusicXmlCompatibilityRecorder();
  let root: MutableNode | null = null;
  let skipDepth = 0;
  let conditional: ConditionalIgnoredLeaf | null = null;
  let elements = 0;
  let attributes = 0;
  let textBytes = 0;

  parser.on('error', (error) => { throw error; });

  parser.on('opentag', (tag) => {
    runtime.checkpoint('musicxml-v2:open');

    const depth = pathStack.length + 1;
    if (depth > runtime.limits.maxDepth) {
      throw new MusicXmlError('XML structural resource limit exceeded.','XML_DEPTH_LIMIT_EXCEEDED',{
        limit:runtime.limits.maxDepth,
        observed:depth
      });
    }

    elements += 1;
    if (elements > runtime.limits.maxElements) {
      throw new MusicXmlError('XML structural resource limit exceeded.','XML_ELEMENT_LIMIT_EXCEEDED',{
        limit:runtime.limits.maxElements,
        observed:elements
      });
    }

    const name = tag.local || tag.name;
    const uri = tag.uri || '';
    const attrs = Object.values(tag.attributes).map((item) => ({
      name:item.local || item.name,
      value:item.value,
      uri:item.uri || ''
    }));

    attributes += attrs.length;
    if (attributes > runtime.limits.maxAttributes) {
      throw new MusicXmlError('XML structural resource limit exceeded.','XML_ATTRIBUTE_LIMIT_EXCEEDED',{
        limit:runtime.limits.maxAttributes,
        observed:attributes
      });
    }

    if (skipDepth > 0) {
      pathStack.push(name);
      skipDepth += 1;
      return;
    }

    if (conditional !== null) {
      failUnsupported('Conditional MusicXML presentation element cannot contain children.', {
        parent: conditional.name,
        child: name
      });
    }

    const special = conditionalKind(pathStack, name, uri);
    if (special !== null) {
      validateConditionalOpen(special, name, attrs);
      conditional = {
        kind: special,
        name,
        pathClass: [...pathStack, name].join('/'),
        attributes: attrs,
        text: ''
      };
      pathStack.push(name);
      return;
    }

    const elementDecision = classifyMusicXmlCompatibilityElement(pathStack, name, uri);
    if (elementDecision.classification === 'UNSUPPORTED_SEMANTIC_FAIL_CLOSED') {
      failUnsupported('Unsupported MusicXML v2-profile element.', {
        element:name,
        uri
      });
    }

    if (elementDecision.classification === 'IGNORABLE_PRESENTATION_METADATA') {
      if (name === 'stem') {
        for (const item of attrs) {
          const attributeDecision = classifyMusicXmlCompatibilityAttribute(pathStack, name, item.name, item.uri);
          if (attributeDecision.classification !== 'IGNORABLE_PRESENTATION_METADATA') {
            failUnsupported('Unsupported MusicXML stem presentation attribute.', {
              element:name,
              attribute:item.name,
              uri:item.uri
            });
          }
          recordIgnored(recorder, attributeDecision, name, item.name);
        }
        conditional = {
          kind: 'stem',
          name,
          pathClass: elementDecision.pathClass,
          attributes: attrs,
          text: ''
        };
        pathStack.push(name);
        return;
      }

      recordIgnored(recorder, elementDecision, name, null);
      pathStack.push(name);
      skipDepth = 1;
      return;
    }

    const retainedAttributes: ParsedXmlAttribute[] = [];
    for (const item of attrs) {
      const attributeDecision = classifyMusicXmlCompatibilityAttribute(pathStack, name, item.name, item.uri);
      if (attributeDecision.classification === 'SEMANTIC_REQUIRED') {
        retainedAttributes.push(item);
      } else if (attributeDecision.classification === 'IGNORABLE_PRESENTATION_METADATA') {
        recordIgnored(recorder, attributeDecision, name, item.name);
      } else {
        failUnsupported('Unsupported MusicXML v2-profile attribute.', {
          element:name,
          attribute:item.name,
          uri:item.uri
        });
      }
    }

    const parent = stack.at(-1);
    if (parent !== undefined && (TEXT_ONLY.includes(parent.name) || EMPTY.includes(parent.name))) {
      failUnsupported('Leaf MusicXML v2-profile element cannot contain children.', {
        parent:parent.name,
        child:name
      });
    }

    const node: MutableNode = {
      name,
      uri,
      attributes:retainedAttributes,
      text:'',
      children:[]
    };

    if (parent === undefined) {
      if (root !== null) throw new MusicXmlError('XML must contain exactly one root element.','INVALID_XML');
      root = node;
    } else {
      parent.children.push(node);
    }
    stack.push(node);
    pathStack.push(name);
  });

  const append = (text: string): void => {
    runtime.checkpoint('musicxml-v2:text');
    textBytes += new TextEncoder().encode(text).byteLength;
    if (textBytes > runtime.limits.maxTextBytes) {
      throw new MusicXmlError('XML structural resource limit exceeded.','XML_TEXT_LIMIT_EXCEEDED',{
        limit:runtime.limits.maxTextBytes,
        observed:textBytes
      });
    }

    if (skipDepth > 0) return;

    if (conditional !== null) {
      conditional.text += text;
      return;
    }

    const current = stack.at(-1);
    if (current !== undefined) {
      if (EMPTY.includes(current.name) && text.trim().length > 0) {
        failUnsupported('Empty MusicXML v2-profile marker cannot contain text.', {
          element:current.name
        });
      }
      current.text += text;
    }
  };

  parser.on('text', append);
  parser.on('cdata', append);

  parser.on('closetag', () => {
    if (skipDepth > 0) {
      skipDepth -= 1;
      pathStack.pop();
      return;
    }

    if (conditional !== null) {
      const value = conditional;
      validateConditionalClose(value);
      recorder.record({
        classification:'IGNORABLE_PRESENTATION_METADATA',
        element:value.name,
        attribute:null,
        pathClass:value.pathClass,
        reason:value.kind === 'notehead'
          ? 'reviewed neutral normal notehead presentation'
          : value.kind === 'staff-details'
            ? 'reviewed empty print-only staff-details'
            : 'reviewed stem presentation'
      });
      conditional = null;
      pathStack.pop();
      return;
    }

    stack.pop();
    pathStack.pop();
  });

  try {
    parser.write(normalized.xml).close();
  } catch (error) {
    if (error instanceof MusicXmlError) throw error;
    throw new MusicXmlError('XML is not well formed.','INVALID_XML');
  }

  runtime.checkpoint('musicxml-v2:parse:complete');
  if (
    root === null ||
    stack.length !== 0 ||
    pathStack.length !== 0 ||
    skipDepth !== 0 ||
    conditional !== null
  ) {
    throw new MusicXmlError('XML is not well formed.','INVALID_XML');
  }

  return Object.freeze({
    inputByteLength:normalized.byteLength,
    root:deepFreeze(root) as ParsedXmlNode,
    compatibility:recorder.snapshot()
  });
};
