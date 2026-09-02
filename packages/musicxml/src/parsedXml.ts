import { SaxesParser } from 'saxes';

import { MusicXmlError } from './errors.js';
import type { MusicXmlProcessingRuntime } from './processing.js';
import { normalizeMusicXmlInput } from './xmlSafety.js';
import type { MusicXmlInput, NormalizedMusicXmlInput } from './xmlSafety.js';

export const PARSED_MUSICXML_DOCUMENT_VERSION = '1.0.0' as const;

export interface ParsedXmlAttribute {
  readonly name: string;
  readonly value: string;
  readonly uri: string;
}

export interface ParsedXmlNode {
  readonly name: string;
  readonly uri: string;
  readonly attributes: readonly ParsedXmlAttribute[];
  readonly text: string;
  readonly children: readonly ParsedXmlNode[];
}

export interface ParsedMusicXmlDocument {
  readonly documentType: 'ParsedMusicXmlDocument';
  readonly contractVersion: typeof PARSED_MUSICXML_DOCUMENT_VERSION;
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

const ATTRIBUTE_ALLOWLIST: Readonly<Record<string, ReadonlySet<string>>> = Object.freeze({
  'score-partwise': new Set(['version']),
  'score-part': new Set(['id']),
  part: new Set(['id']),
  measure: new Set(['number', 'implicit', 'non-controlling'])
});

const LEAF_ELEMENTS = new Set([
  'part-name',
  'divisions',
  'staves',
  'duration',
  'voice',
  'staff',
  'step',
  'alter',
  'octave',
  'type',
  'rest',
  'chord'
]);

const EMPTY_ELEMENTS = new Set(['rest', 'chord']);

const deepFreeze = <T>(value: T): Readonly<T> => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const item of Object.values(value as Record<string, unknown>)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
};

const failLimit = (
  code: 'XML_DEPTH_LIMIT_EXCEEDED' | 'XML_ELEMENT_LIMIT_EXCEEDED' | 'XML_ATTRIBUTE_LIMIT_EXCEEDED' | 'XML_TEXT_LIMIT_EXCEEDED',
  field: string,
  limit: number,
  observed: number
): never => {
  throw new MusicXmlError('XML structural resource limit exceeded.', code, { field, limit, observed });
};

const enforceLimit = (
  code: 'XML_DEPTH_LIMIT_EXCEEDED' | 'XML_ELEMENT_LIMIT_EXCEEDED' | 'XML_ATTRIBUTE_LIMIT_EXCEEDED' | 'XML_TEXT_LIMIT_EXCEEDED',
  field: string,
  limit: number,
  observed: number
): void => {
  if (observed > limit) failLimit(code, field, limit, observed);
};

const enforceElementEnvelope = (
  name: string,
  uri: string,
  attributes: readonly ParsedXmlAttribute[],
  parent: MutableNode | undefined
): void => {
  if (uri !== '') {
    throw new MusicXmlError('Namespaced MusicXML elements are not supported in E2.', 'UNSUPPORTED_MUSICXML', {
      element: name,
      uri
    });
  }

  if (parent !== undefined && LEAF_ELEMENTS.has(parent.name)) {
    throw new MusicXmlError('MusicXML leaf element cannot contain child elements in E2.', 'UNSUPPORTED_MUSICXML', {
      parent: parent.name,
      child: name
    });
  }

  const allowedAttributes = ATTRIBUTE_ALLOWLIST[name] ?? new Set<string>();
  for (const attribute of attributes) {
    if (attribute.uri !== '' || !allowedAttributes.has(attribute.name)) {
      throw new MusicXmlError('Unsupported MusicXML attribute.', 'UNSUPPORTED_MUSICXML', {
        element: name,
        attribute: attribute.name,
        uri: attribute.uri
      });
    }
  }
};

export interface ParsedMusicXmlResult {
  readonly normalizedInput: NormalizedMusicXmlInput;
  readonly document: Readonly<ParsedMusicXmlDocument>;
}

export const parseMusicXmlTree = (
  input: MusicXmlInput,
  runtime: MusicXmlProcessingRuntime
): ParsedMusicXmlResult => {
  const normalizedInput = normalizeMusicXmlInput(input, runtime);
  runtime.checkpoint('xml:parse:start');

  const parser = new SaxesParser({ xmlns: true, position: true });
  const stack: MutableNode[] = [];
  let root: MutableNode | null = null;
  let elementCount = 0;
  let attributeCount = 0;
  let textBytes = 0;

  parser.on('error', (error) => {
    throw error;
  });

  parser.on('opentag', (tag) => {
    runtime.checkpoint('xml:open-tag');
    const depth = stack.length + 1;
    enforceLimit('XML_DEPTH_LIMIT_EXCEEDED', 'maxDepth', runtime.limits.maxDepth, depth);

    elementCount += 1;
    enforceLimit('XML_ELEMENT_LIMIT_EXCEEDED', 'maxElements', runtime.limits.maxElements, elementCount);

    const attributes = Object.values(tag.attributes).map((attribute) => ({
      name: attribute.local || attribute.name,
      value: attribute.value,
      uri: attribute.uri || ''
    }));
    attributeCount += attributes.length;
    enforceLimit('XML_ATTRIBUTE_LIMIT_EXCEEDED', 'maxAttributes', runtime.limits.maxAttributes, attributeCount);

    const name = tag.local || tag.name;
    const uri = tag.uri || '';
    const parent = stack[stack.length - 1];
    enforceElementEnvelope(name, uri, attributes, parent);

    const node: MutableNode = {
      name,
      uri,
      attributes,
      text: '',
      children: []
    };

    if (stack.length === 0) {
      if (root !== null) {
        throw new MusicXmlError('XML must contain exactly one root element.', 'INVALID_XML');
      }
      root = node;
    } else {
      if (parent === undefined) throw new MusicXmlError('XML parser stack became inconsistent.', 'INVALID_XML');
      parent.children.push(node);
    }
    stack.push(node);
  });

  const appendText = (text: string): void => {
    runtime.checkpoint('xml:text');
    textBytes += new TextEncoder().encode(text).byteLength;
    enforceLimit('XML_TEXT_LIMIT_EXCEEDED', 'maxTextBytes', runtime.limits.maxTextBytes, textBytes);
    const current = stack[stack.length - 1];
    if (current !== undefined) {
      if (EMPTY_ELEMENTS.has(current.name) && text.trim().length > 0) {
        throw new MusicXmlError('Empty MusicXML marker cannot contain text in E2.', 'UNSUPPORTED_MUSICXML', {
          element: current.name
        });
      }
      current.text += text;
    }
  };

  parser.on('text', appendText);
  parser.on('cdata', appendText);
  parser.on('closetag', () => {
    runtime.checkpoint('xml:close-tag');
    stack.pop();
  });

  try {
    parser.write(normalizedInput.xml).close();
  } catch (error) {
    if (error instanceof MusicXmlError) throw error;
    throw new MusicXmlError('XML is not well formed.', 'INVALID_XML');
  }

  runtime.checkpoint('xml:parse:complete');
  if (root === null || stack.length !== 0) {
    throw new MusicXmlError('XML is not well formed.', 'INVALID_XML');
  }

  const document = deepFreeze({
    documentType: 'ParsedMusicXmlDocument' as const,
    contractVersion: PARSED_MUSICXML_DOCUMENT_VERSION,
    inputByteLength: normalizedInput.byteLength,
    root
  });

  return Object.freeze({ normalizedInput, document });
};
