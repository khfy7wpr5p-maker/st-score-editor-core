import { MusicXmlError } from './errors.js';
import type { MusicXmlProcessingRuntime } from './processing.js';

const TRUSTED_MUSICXML_PARTWISE_DOCTYPE =
  /^(\uFEFF?\s*(?:<\?xml\b[^?]*\?>\s*)?)<!DOCTYPE\s+score-partwise\s+PUBLIC\s+(['"])-\/\/Recordare\/\/DTD MusicXML 4\.0\.3 Partwise\/\/EN\2\s+(['"])http:\/\/www\.musicxml\.org\/dtds\/partwise\.dtd\3\s*>(?=\s*<score-partwise(?:\s|>))/i;

export type MusicXmlInput = string | Uint8Array;

export interface NormalizedMusicXmlInput {
  readonly xml: string;
  readonly byteLength: number;
}

const utf8ByteLength = (value: string): number => new TextEncoder().encode(value).byteLength;

const decodeUtf8 = (input: Uint8Array): string => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(input);
  } catch {
    throw new MusicXmlError('Input is not valid UTF-8.', 'INVALID_ENCODING');
  }
};

const normalizeTrustedDoctype = (xml: string): string => {
  if (/<!\s*ENTITY\b/i.test(xml)) {
    throw new MusicXmlError('Entity declarations are not allowed.', 'UNSAFE_XML_DECLARATION');
  }

  const declarations = xml.match(/<!\s*DOCTYPE\b/gi) ?? [];
  if (declarations.length === 0) return xml;
  if (declarations.length !== 1) {
    throw new MusicXmlError('XML must not contain multiple DOCTYPE declarations.', 'UNSAFE_XML_DECLARATION');
  }

  const trusted = TRUSTED_MUSICXML_PARTWISE_DOCTYPE.exec(xml);
  if (trusted === null) {
    throw new MusicXmlError(
      'Only the trusted MusicXML 4.0.3 partwise DOCTYPE is allowed.',
      'UNSAFE_XML_DECLARATION'
    );
  }

  return `${trusted[1] ?? ''}${xml.slice(trusted[0].length)}`;
};

export const normalizeMusicXmlInput = (
  input: MusicXmlInput,
  runtime: MusicXmlProcessingRuntime
): NormalizedMusicXmlInput => {
  runtime.checkpoint('xml:input:start');
  let xml: string;
  let byteLength: number;

  if (typeof input === 'string') {
    xml = input;
    byteLength = utf8ByteLength(input);
  } else if (input instanceof Uint8Array) {
    byteLength = input.byteLength;
    if (byteLength > runtime.limits.maxBytes) {
      throw new MusicXmlError('XML input exceeds the configured size limit.', 'FILE_TOO_LARGE', {
        limit: runtime.limits.maxBytes,
        observed: byteLength
      });
    }
    xml = decodeUtf8(input);
  } else {
    throw new MusicXmlError('XML input must be a UTF-8 string or Uint8Array.', 'INVALID_ENCODING');
  }

  if (byteLength > runtime.limits.maxBytes) {
    throw new MusicXmlError('XML input exceeds the configured size limit.', 'FILE_TOO_LARGE', {
      limit: runtime.limits.maxBytes,
      observed: byteLength
    });
  }
  if (xml.replace(/^\uFEFF/, '').trim().length === 0) {
    throw new MusicXmlError('XML input is empty.', 'EMPTY_INPUT');
  }
  if (xml.includes('\u0000')) {
    throw new MusicXmlError('XML input contains a forbidden null byte.', 'INVALID_ENCODING');
  }

  const declaration = /^\uFEFF?\s*<\?xml\b([^?]*)\?>/i.exec(xml);
  const encoding = declaration?.[1]?.match(/\bencoding\s*=\s*(['"])([^'"]+)\1/i)?.[2];
  if (encoding !== undefined && !/^utf-?8$/i.test(encoding)) {
    throw new MusicXmlError('XML declaration must use UTF-8 encoding.', 'INVALID_ENCODING', {
      declaredEncoding: encoding
    });
  }

  const normalized = normalizeTrustedDoctype(xml);
  runtime.checkpoint('xml:input:complete');
  return Object.freeze({ xml: normalized, byteLength });
};
