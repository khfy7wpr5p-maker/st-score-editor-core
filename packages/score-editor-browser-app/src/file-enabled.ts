import {
  createStandaloneBrowserAppRuntime,
  createStandaloneScoreEditorController,
  standaloneBrowserAppProfile,
  type ScoreEditorBrowserAppSnapshot,
  type StandaloneScoreEditorController
} from './index.js';
import {
  browserFileWorkflowCapabilities,
  readMusicXmlBrowserFile,
  pickMusicXmlBrowserFile,
  writeMusicXmlBrowserFile,
  createMusicXmlDownloadArtifact,
  MAX_LOCAL_MUSICXML_BYTES,
  MUSICXML_MIME_TYPE,
  type BrowserFileHandleLike,
  type BrowserFileWorkflowHost,
  type BrowserMusicXmlDownloadArtifact,
  type BrowserMusicXmlFileLike
} from '../../score-editor-browser-file-workflow/src/index.js';

export const FILE_ENABLED_BROWSER_APP_VERSION = '1.0.0' as const;

export const fileEnabledBrowserAppProfile = Object.freeze({
  ...standaloneBrowserAppProfile,
  fileWorkflowBundled: true
});

export interface BrowserFileControllerState {
  readonly version: typeof FILE_ENABLED_BROWSER_APP_VERSION;
  readonly associatedFileName: string | null;
  readonly associatedDocumentId: string | null;
  readonly openPickerAvailable: boolean;
  readonly savePickerAvailable: boolean;
  readonly fileInputFallbackAvailable: true;
  readonly downloadFallbackAvailable: true;
  readonly status: { readonly code: string; readonly message: string } | null;
}

export type BrowserDownloadHandoff = (artifact: Readonly<BrowserMusicXmlDownloadArtifact>) => void | Promise<void>;

export type FileEnabledControllerErrorCode = 'OPEN_FAILED' | 'SAVE_FAILED' | 'DOWNLOAD_FAILED' | 'DOWNLOAD_HOST_UNAVAILABLE';

export class FileEnabledControllerError extends Error {
  readonly code: FileEnabledControllerErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: FileEnabledControllerErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'FileEnabledControllerError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

export interface FileEnabledStandaloneScoreEditorController extends Omit<StandaloneScoreEditorController, 'profile' | 'mount' | 'unmount'> {
  readonly profile: typeof fileEnabledBrowserAppProfile;
  readonly mount: (root: HTMLElement) => void;
  readonly unmount: () => void;
  readonly getFileWorkflowState: () => Readonly<BrowserFileControllerState>;
  readonly openLocalFile: (file: BrowserMusicXmlFileLike) => Promise<Readonly<ScoreEditorBrowserAppSnapshot>>;
  readonly openFromPicker: (host?: BrowserFileWorkflowHost) => Promise<Readonly<ScoreEditorBrowserAppSnapshot>>;
  readonly saveToFile: (host?: BrowserFileWorkflowHost) => Promise<Readonly<ScoreEditorBrowserAppSnapshot>>;
  readonly downloadFile: (handoff?: BrowserDownloadHandoff) => Promise<Readonly<ScoreEditorBrowserAppSnapshot>>;
}

const failure = (error: unknown, code: FileEnabledControllerErrorCode, prefix: string): FileEnabledControllerError => {
  if (error instanceof FileEnabledControllerError) return error;
  const record = error !== null && typeof error === 'object' ? error as { readonly message?: unknown; readonly code?: unknown } : null;
  const cause = typeof record?.message === 'string' ? record.message : String(error);
  return new FileEnabledControllerError(`${prefix}: ${cause}`, code, { causeCode: record?.code ?? null });
};

const documentId = (controller: StandaloneScoreEditorController): string | null => controller.getDocument()?.session.history.present.score.id ?? null;

const defaultDownloadHandoff: BrowserDownloadHandoff = async (artifact) => {
  const documentValue = globalThis.document;
  const urlApi = globalThis.URL;
  if (documentValue === undefined || typeof urlApi?.createObjectURL !== 'function' || typeof urlApi.revokeObjectURL !== 'function') {
    throw new FileEnabledControllerError('Browser download host is unavailable.', 'DOWNLOAD_HOST_UNAVAILABLE');
  }
  const blob = new Blob([artifact.text], { type: artifact.mimeType });
  const url = urlApi.createObjectURL(blob);
  try {
    const anchor = documentValue.createElement('a');
    anchor.href = url;
    anchor.download = artifact.fileName;
    anchor.style.display = 'none';
    documentValue.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    urlApi.revokeObjectURL(url);
  }
};

export const createFileEnabledStandaloneScoreEditorController = (): Readonly<FileEnabledStandaloneScoreEditorController> => {
  const base = createStandaloneScoreEditorController();
  let fileHandle: BrowserFileHandleLike | null = null;
  let associatedDocumentId: string | null = null;
  let associatedFileName: string | null = null;
  let fileStatus: Readonly<{ code: string; message: string }> | null = null;
  let root: HTMLElement | null = null;

  const setStatus = (code: string, message: string): void => {
    fileStatus = Object.freeze({ code, message });
    decorate();
  };

  const state = (): Readonly<BrowserFileControllerState> => {
    const caps = browserFileWorkflowCapabilities();
    return Object.freeze({
      version: FILE_ENABLED_BROWSER_APP_VERSION,
      associatedFileName,
      associatedDocumentId,
      openPickerAvailable: caps.openPickerAvailable,
      savePickerAvailable: caps.savePickerAvailable,
      fileInputFallbackAvailable: true,
      downloadFallbackAvailable: true,
      status: fileStatus
    });
  };

  const currentHandle = (): BrowserFileHandleLike | null => associatedDocumentId !== null && associatedDocumentId === documentId(base) ? fileHandle : null;

  const openResult = async (musicXml: string, fileName: string, handle: BrowserFileHandleLike | null): Promise<Readonly<ScoreEditorBrowserAppSnapshot>> => {
    const result = await base.openMusicXml(musicXml, { title: fileName });
    if (result.error !== null) throw new FileEnabledControllerError(result.error.message, 'OPEN_FAILED', { causeCode: result.error.code });
    fileHandle = handle;
    associatedDocumentId = documentId(base);
    associatedFileName = fileName;
    setStatus('FILE_OPENED', `Opened ${fileName}`);
    return result;
  };

  const decorate = (): void => {
    if (root === null) return;
    const owner = root.ownerDocument;
    const toolbar = root.querySelector<HTMLElement>('.stse-toolbar');
    if (toolbar !== null && toolbar.querySelector('[data-stse-file-controls]') === null) {
      const controls = owner.createElement('span');
      controls.setAttribute('data-stse-file-controls', '1');
      controls.style.display = 'contents';

      const input = owner.createElement('input');
      input.type = 'file';
      input.accept = '.musicxml,.xml,application/xml,text/xml';
      input.style.display = 'none';
      input.setAttribute('data-stse-file-input', '1');

      const open = owner.createElement('button');
      open.type = 'button'; open.textContent = 'Open';
      open.addEventListener('click', () => {
        const caps = browserFileWorkflowCapabilities();
        if (caps.openPickerAvailable) {
          void controller.openFromPicker().catch((error) => { const failureValue = failure(error, 'OPEN_FAILED', 'Open failed'); setStatus(failureValue.code, failureValue.message); });
        } else input.click();
      });
      input.addEventListener('change', () => {
        const selected = input.files?.[0];
        if (selected !== undefined) void controller.openLocalFile(selected).catch((error) => { const failureValue = failure(error, 'OPEN_FAILED', 'Open failed'); setStatus(failureValue.code, failureValue.message); });
        input.value = '';
      });

      const save = owner.createElement('button');
      save.type = 'button'; save.textContent = 'Save'; save.disabled = base.getDocument() === null;
      save.addEventListener('click', () => {
        const caps = browserFileWorkflowCapabilities();
        const operation = currentHandle() !== null || caps.savePickerAvailable ? controller.saveToFile() : controller.downloadFile();
        void operation.catch((error) => { const failureValue = failure(error, 'SAVE_FAILED', 'Save failed'); setStatus(failureValue.code, failureValue.message); });
      });

      const download = owner.createElement('button');
      download.type = 'button'; download.textContent = 'Download'; download.disabled = base.getDocument() === null;
      download.addEventListener('click', () => { void controller.downloadFile().catch((error) => { const failureValue = failure(error, 'DOWNLOAD_FAILED', 'Download failed'); setStatus(failureValue.code, failureValue.message); }); });

      controls.append(open, save, download, input);
      toolbar.append(controls);
    }

    const footer = root.querySelector<HTMLElement>('.stse-status');
    if (footer !== null && fileStatus !== null) {
      const previous = footer.querySelector('[data-stse-file-status]');
      previous?.remove();
      const value = owner.createElement('span');
      value.setAttribute('data-stse-file-status', fileStatus.code);
      value.textContent = fileStatus.message;
      footer.append(value);
    }
  };

  base.subscribe(() => {
    const currentDocumentId = documentId(base);
    if (associatedDocumentId !== null && currentDocumentId !== associatedDocumentId) {
      fileHandle = null;
      associatedDocumentId = null;
      associatedFileName = null;
    }
    decorate();
  });

  const controller: FileEnabledStandaloneScoreEditorController = Object.freeze({
    ...base,
    profile: fileEnabledBrowserAppProfile,
    mount: (nextRoot: HTMLElement) => { root = nextRoot; base.mount(nextRoot); decorate(); },
    unmount: () => { base.unmount(); root = null; },
    getFileWorkflowState: state,
    openLocalFile: async (file: BrowserMusicXmlFileLike) => {
      try {
        const read = await readMusicXmlBrowserFile(file);
        return await openResult(read.musicXml, read.fileName, null);
      } catch (error) {
        const failureValue = failure(error, 'OPEN_FAILED', 'Open failed');
        setStatus(failureValue.code, failureValue.message);
        throw failureValue;
      }
    },
    openFromPicker: async (host = globalThis as BrowserFileWorkflowHost) => {
      try {
        const picked = await pickMusicXmlBrowserFile(host);
        return await openResult(picked.musicXml, picked.fileName, picked.handle);
      } catch (error) {
        const failureValue = failure(error, 'OPEN_FAILED', 'Open failed');
        setStatus(failureValue.code, failureValue.message);
        throw failureValue;
      }
    },
    saveToFile: async (host = globalThis as BrowserFileWorkflowHost) => {
      try {
        const documentValue = base.getDocument();
        if (documentValue === null) throw new Error('No active document.');
        const musicXml = base.exportMusicXml();
        const written = await writeMusicXmlBrowserFile(musicXml, documentValue.title, currentHandle(), host);
        fileHandle = written.handle;
        associatedDocumentId = documentId(base);
        associatedFileName = written.fileName;
        const saved = base.markSaved();
        setStatus('FILE_SAVED', `Saved ${written.fileName}`);
        return saved;
      } catch (error) {
        const failureValue = failure(error, 'SAVE_FAILED', 'Save failed');
        setStatus(failureValue.code, failureValue.message);
        throw failureValue;
      }
    },
    downloadFile: async (handoff = defaultDownloadHandoff) => {
      try {
        const documentValue = base.getDocument();
        if (documentValue === null) throw new Error('No active document.');
        const musicXml = base.exportMusicXml();
        const artifact = createMusicXmlDownloadArtifact(musicXml, documentValue.title);
        await handoff(artifact);
        const saved = base.markSaved();
        setStatus('FILE_DOWNLOADED', `Download handed off: ${artifact.fileName}`);
        return saved;
      } catch (error) {
        const failureValue = failure(error, 'DOWNLOAD_FAILED', 'Download failed');
        setStatus(failureValue.code, failureValue.message);
        throw failureValue;
      }
    }
  });

  return controller;
};

export const createFileEnabledStandaloneBrowserAppRuntime = () => {
  const base = createStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: fileEnabledBrowserAppProfile,
    createController: createFileEnabledStandaloneScoreEditorController,
    fileWorkflow: Object.freeze({
      maxLocalMusicXmlBytes: MAX_LOCAL_MUSICXML_BYTES,
      musicXmlMimeType: MUSICXML_MIME_TYPE,
      capabilities: browserFileWorkflowCapabilities,
      readFile: readMusicXmlBrowserFile,
      pickFile: pickMusicXmlBrowserFile,
      writeFile: writeMusicXmlBrowserFile,
      createDownloadArtifact: createMusicXmlDownloadArtifact
    })
  });
};
