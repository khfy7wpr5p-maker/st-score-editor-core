export interface SaxesOptions {
  readonly xmlns?: boolean;
  readonly position?: boolean;
}

export interface SaxesAttribute {
  readonly name: string;
  readonly local: string;
  readonly uri: string;
  readonly value: string;
}

export interface SaxesTag {
  readonly name: string;
  readonly local: string;
  readonly uri: string;
  readonly attributes: Readonly<Record<string, SaxesAttribute>>;
}

export class SaxesParser {
  constructor(options?: SaxesOptions);

  on(name: 'error', handler: (error: Error) => void): void;
  on(name: 'opentag', handler: (tag: SaxesTag) => void): void;
  on(name: 'text', handler: (text: string) => void): void;
  on(name: 'cdata', handler: (text: string) => void): void;
  on(name: 'closetag', handler: (tag: SaxesTag) => void): void;

  write(chunk: string): this;
  close(): this;
}
