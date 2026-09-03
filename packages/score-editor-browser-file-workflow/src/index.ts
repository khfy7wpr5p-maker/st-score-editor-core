export const SCORE_EDITOR_BROWSER_FILE_WORKFLOW_VERSION = '1.0.0' as const;
export const MAX_LOCAL_MUSICXML_BYTES = 32 * 1024 * 1024;
export const MUSICXML_MIME_TYPE = 'application/vnd.recordare.musicxml+xml' as const;

export interface BrowserMusicXmlFileLike {
  readonly name: string;
  readonly size: number;
  readonly type?: string;
  text(): Promise<string>;
}

export interface BrowserWritableFileLike {
  write(data: string): Promise<void>;
  close(): Promise<void>;
  abort?(): Promise<void>;
}

export interface BrowserFileHandleLike {
  readonly kind: 'file';
  readonly name: string;
  getFile(): Promise<BrowserMusicXmlFileLike>;
  createWritable(): Promise<BrowserWritableFileLike>;
}

export interface BrowserOpenFilePickerOptionsLike {
  readonly multiple: false;
  readonly types: readonly [{
    readonly description: string;
    readonly accept: Readonly<Record<string, readonly string[]>>;
  }];
  readonly excludeAcceptAllOption: false;
}

export interface BrowserSaveFilePickerOptionsLike {
  readonly suggestedName: string;
  readonly types: readonly [{
    readonly description: string;
    readonly accept: Readonly<Record<string, readonly string[]>>;
  }];
  readonly excludeAcceptAllOption: false;
}

export type BrowserOpenFilePickerLike = (options: BrowserOpenFilePickerOptionsLike) => Promise<readonly BrowserFileHandleLike[]>;
export type BrowserSaveFilePickerLike = (options: BrowserSaveFilePickerOptionsLike) => Promise<BrowserFileHandleLike>;

export interface BrowserFileWorkflowHost {
  readonly showOpenFilePicker?: BrowserOpenFilePickerLike;
  readonly showSaveFilePicker?: BrowserSaveFilePickerLike;
}

export interface BrowserMusicXmlOpenResult {
  readonly version: typeof SCORE_EDITOR_BROWSER_FILE_WORKFLOW_VERSION;
  readonly fileName: string;
  readonly musicXml: string;
  readonly byteLength: number;
  readonly handle: BrowserFileHandleLike | null;
}

export interface BrowserMusicXmlWriteResult {
  readonly version: typeof SCORE_EDITOR_BROWSER_FILE_WORKFLOW_VERSION;
  readonly fileName: string;
  readonly byteLength: number;
  readonly handle: BrowserFileHandleLike;
}

export interface BrowserMusicXmlDownloadArtifact {
  readonly version: typeof SCORE_EDITOR_BROWSER_FILE_WORKFLOW_VERSION;
  readonly fileName: string;
  readonly mimeType: typeof MUSICXML_MIME_TYPE;
  readonly text: string;
  readonly byteLength: number;
}

export type BrowserFileWorkflowErrorCode =
  | 'UNSUPPORTED_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'PICKER_UNAVAILABLE'
  | 'PICKER_RESULT_INVALID'
  | 'FILE_READ_FAILED'
  | 'FILE_WRITE_FAILED'
  | 'INVALID_FILE_NAME';

export class BrowserFileWorkflowError extends Error {
  readonly code: BrowserFileWorkflowErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: BrowserFileWorkflowErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'BrowserFileWorkflowError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const encoder = new TextEncoder();
const admittedExtension = (name: string): boolean => /\.(?:musicxml|xml)$/i.test(name);
const byteLength = (text: string): number => encoder.encode(text).byteLength;

export const normalizeMusicXmlFileName = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 240 || /[\\/:*?"<>|\u0000-\u001f]/.test(trimmed)) {
    throw new BrowserFileWorkflowError('MusicXML file name is invalid.', 'INVALID_FILE_NAME', { value });
  }
  const withoutKnownExtension = trimmed.replace(/\.(?:musicxml|xml)$/i, '');
  if (withoutKnownExtension.length === 0) throw new BrowserFileWorkflowError('MusicXML file name has no base name.', 'INVALID_FILE_NAME', { value });
  return `${withoutKnownExtension}.musicxml`;
};

export const browserFileWorkflowCapabilities = (host: BrowserFileWorkflowHost = globalThis as BrowserFileWorkflowHost) => Object.freeze({
  version: SCORE_EDITOR_BROWSER_FILE_WORKFLOW_VERSION,
  openPickerAvailable: typeof host.showOpenFilePicker === 'function',
  savePickerAvailable: typeof host.showSaveFilePicker === 'function',
  fileInputFallbackAvailable: true,
  downloadFallbackAvailable: true,
  cloudRequired: false,
  canonicalAuthority: false
});

export const readMusicXmlBrowserFile = async (file: BrowserMusicXmlFileLike): Promise<Readonly<BrowserMusicXmlOpenResult>> => {
  if (!admittedExtension(file.name)) {
    throw new BrowserFileWorkflowError('Only .musicxml and .xml files are admitted by APP-04.', 'UNSUPPORTED_FILE_TYPE', { fileName: file.name });
  }
  if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_LOCAL_MUSICXML_BYTES) {
    throw new BrowserFileWorkflowError('MusicXML file exceeds the admitted local size bound.', 'FILE_TOO_LARGE', { fileName: file.name, size: file.size, max: MAX_LOCAL_MUSICXML_BYTES });
  }
  let text: string;
  try { text = await file.text(); }
  catch (error) { throw new BrowserFileWorkflowError('MusicXML file could not be read.', 'FILE_READ_FAILED', { cause: error instanceof Error ? error.message : String(error) }); }
  const bytes = byteLength(text);
  if (bytes > MAX_LOCAL_MUSICXML_BYTES) throw new BrowserFileWorkflowError('MusicXML text exceeds the admitted local size bound.', 'FILE_TOO_LARGE', { fileName: file.name, byteLength: bytes, max: MAX_LOCAL_MUSICXML_BYTES });
  return Object.freeze({ version: SCORE_EDITOR_BROWSER_FILE_WORKFLOW_VERSION, fileName: file.name, musicXml: text, byteLength: bytes, handle: null });
};

export const pickMusicXmlBrowserFile = async (host: BrowserFileWorkflowHost = globalThis as BrowserFileWorkflowHost): Promise<Readonly<BrowserMusicXmlOpenResult>> => {
  if (typeof host.showOpenFilePicker !== 'function') throw new BrowserFileWorkflowError('File System Access open picker is unavailable.', 'PICKER_UNAVAILABLE');
  const handles = await host.showOpenFilePicker(Object.freeze({
    multiple: false,
    excludeAcceptAllOption: false,
    types: Object.freeze([Object.freeze({
      description: 'MusicXML score',
      accept: Object.freeze({ [MUSICXML_MIME_TYPE]: Object.freeze(['.musicxml', '.xml']) })
    })])
  }));
  const handle = handles[0];
  if (handles.length !== 1 || handle === undefined || handle.kind !== 'file') throw new BrowserFileWorkflowError('Open picker did not return exactly one file handle.', 'PICKER_RESULT_INVALID');
  const read = await readMusicXmlBrowserFile(await handle.getFile());
  return Object.freeze({ ...read, handle });
};

export const writeMusicXmlBrowserFile = async (
  musicXml: string,
  suggestedName: string,
  existingHandle: BrowserFileHandleLike | null = null,
  host: BrowserFileWorkflowHost = globalThis as BrowserFileWorkflowHost
): Promise<Readonly<BrowserMusicXmlWriteResult>> => {
  const fileName = normalizeMusicXmlFileName(suggestedName);
  const bytes = byteLength(musicXml);
  if (bytes > MAX_LOCAL_MUSICXML_BYTES) throw new BrowserFileWorkflowError('MusicXML export exceeds the admitted local size bound.', 'FILE_TOO_LARGE', { byteLength: bytes, max: MAX_LOCAL_MUSICXML_BYTES });
  let handle = existingHandle;
  if (handle === null) {
    if (typeof host.showSaveFilePicker !== 'function') throw new BrowserFileWorkflowError('File System Access save picker is unavailable.', 'PICKER_UNAVAILABLE');
    handle = await host.showSaveFilePicker(Object.freeze({
      suggestedName: fileName,
      excludeAcceptAllOption: false,
      types: Object.freeze([Object.freeze({
        description: 'MusicXML score',
        accept: Object.freeze({ [MUSICXML_MIME_TYPE]: Object.freeze(['.musicxml', '.xml']) })
      })])
    }));
  }
  if (handle.kind !== 'file') throw new BrowserFileWorkflowError('Save target is not a file handle.', 'PICKER_RESULT_INVALID');
  let writable: BrowserWritableFileLike | null = null;
  try {
    writable = await handle.createWritable();
    await writable.write(musicXml);
    await writable.close();
  } catch (error) {
    if (writable?.abort !== undefined) {
      try { await writable.abort(); } catch { /* preserve original write failure */ }
    }
    throw new BrowserFileWorkflowError('MusicXML file write did not complete.', 'FILE_WRITE_FAILED', { cause: error instanceof Error ? error.message : String(error) });
  }
  return Object.freeze({ version: SCORE_EDITOR_BROWSER_FILE_WORKFLOW_VERSION, fileName: handle.name || fileName, byteLength: bytes, handle });
};

export const createMusicXmlDownloadArtifact = (musicXml: string, suggestedName: string): Readonly<BrowserMusicXmlDownloadArtifact> => {
  const fileName = normalizeMusicXmlFileName(suggestedName);
  const bytes = byteLength(musicXml);
  if (bytes > MAX_LOCAL_MUSICXML_BYTES) throw new BrowserFileWorkflowError('MusicXML download exceeds the admitted local size bound.', 'FILE_TOO_LARGE', { byteLength: bytes, max: MAX_LOCAL_MUSICXML_BYTES });
  return Object.freeze({ version: SCORE_EDITOR_BROWSER_FILE_WORKFLOW_VERSION, fileName, mimeType: MUSICXML_MIME_TYPE, text: musicXml, byteLength: bytes });
};
