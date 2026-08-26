export type MusicXmlErrorCode =
  | 'INVALID_CONFIGURATION'
  | 'INVALID_ENCODING'
  | 'FILE_TOO_LARGE'
  | 'EMPTY_INPUT'
  | 'UNSAFE_XML_DECLARATION'
  | 'INVALID_XML'
  | 'XML_DEPTH_LIMIT_EXCEEDED'
  | 'XML_ELEMENT_LIMIT_EXCEEDED'
  | 'XML_ATTRIBUTE_LIMIT_EXCEEDED'
  | 'XML_TEXT_LIMIT_EXCEEDED'
  | 'MEASURE_LIMIT_EXCEEDED'
  | 'EVENT_LIMIT_EXCEEDED'
  | 'PROCESSING_TIMEOUT'
  | 'PROCESSING_ABORTED'
  | 'SOURCE_IDENTITY_MISMATCH'
  | 'UNSUPPORTED_MUSICXML'
  | 'INVALID_MUSICXML_SEMANTICS'
  | 'SERIALIZATION_LIMIT'
  | 'OVERLAPPING_EVENTS';

export class MusicXmlError extends Error {
  public readonly code: MusicXmlErrorCode;
  public readonly details: Readonly<Record<string, unknown>>;

  public constructor(
    message: string,
    code: MusicXmlErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'MusicXmlError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}
