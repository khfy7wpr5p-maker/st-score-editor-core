import {
  createMusicXmlDownloadArtifact,
  type BrowserMusicXmlDownloadArtifact
} from '../../score-editor-browser-file-workflow/src/index.js';
import {
  createPlaybackEnabledStandaloneBrowserAppRuntime,
  createPlaybackEnabledStandaloneScoreEditorController,
  playbackEnabledBrowserAppProfile,
  type PlaybackEnabledControllerOptions,
  type PlaybackEnabledStandaloneScoreEditorController
} from './playback-enabled.js';

export const EXPORT_PRINT_ENABLED_BROWSER_APP_VERSION = '1.0.0' as const;

export const exportPrintEnabledBrowserAppProfile = Object.freeze({
  ...playbackEnabledBrowserAppProfile,
  exportPrintBundled: true,
  musicXmlExportCanonicalAuthority: false,
  musicXmlExportMarksSaved: false,
  printCanonicalAuthority: false,
  printRequiresCurrentRendererRevision: true,
  printNetworkCapable: false,
  pdfWorkflow: 'browser-print-dialog-save-as-pdf' as const,
  pdfBytesGenerated: false
});

export interface BrowserPrintHostV1 {
  readonly print: () => void | Promise<void>;
}

export type BrowserMusicXmlExportHandoff = (artifact: Readonly<BrowserMusicXmlDownloadArtifact>) => void | Promise<void>;

export interface BrowserExportPrintState {
  readonly version: typeof EXPORT_PRINT_ENABLED_BROWSER_APP_VERSION;
  readonly documentId: string | null;
  readonly revisionId: string | null;
  readonly lastExportedRevisionId: string | null;
  readonly lastPrintedRevisionId: string | null;
  readonly printReady: boolean;
  readonly pdfWorkflow: 'browser-print-dialog-save-as-pdf';
  readonly pdfBytesGenerated: false;
  readonly status: Readonly<{ code: string; message: string }>;
}

export type ExportPrintControllerErrorCode =
  | 'EXPORT_NO_DOCUMENT'
  | 'EXPORT_FAILED'
  | 'PRINT_NO_DOCUMENT'
  | 'PRINT_RENDER_FAILED'
  | 'PRINT_STALE_REVISION'
  | 'PRINT_HOST_UNAVAILABLE'
  | 'PRINT_FAILED';

export class ExportPrintControllerError extends Error {
  readonly code: ExportPrintControllerErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: ExportPrintControllerErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ExportPrintControllerError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

export interface ExportPrintEnabledStandaloneScoreEditorController extends Omit<PlaybackEnabledStandaloneScoreEditorController, 'profile' | 'mount' | 'unmount'> {
  readonly profile: typeof exportPrintEnabledBrowserAppProfile;
  readonly mount: (root: HTMLElement) => void;
  readonly unmount: () => void;
  readonly getExportPrintState: () => Readonly<BrowserExportPrintState>;
  readonly exportMusicXmlFile: (handoff?: BrowserMusicXmlExportHandoff) => Promise<Readonly<BrowserMusicXmlDownloadArtifact>>;
  readonly printCurrent: (host?: BrowserPrintHostV1) => Promise<Readonly<BrowserExportPrintState>>;
}

const PRINT_STYLE = `
@media print{
html,body{height:auto!important;overflow:visible!important;background:#fff!important}
.stse-app{display:block!important;height:auto!important;min-height:0!important;background:#fff!important;color:#000!important}
.stse-toolbar,.stse-keypad,.stse-side,.stse-status{display:none!important}
.stse-main,.stse-workspace{display:block!important;min-height:0!important}
.stse-viewport{margin:0!important;padding:0!important;border:0!important;border-radius:0!important;overflow:visible!important;min-height:0!important;background:#fff!important}
.stse-viewport[data-st-score-editor-presentation-only="true"]>*{zoom:1!important}
}
`;

const defaultExportHandoff: BrowserMusicXmlExportHandoff = async (artifact) => {
  const documentValue = globalThis.document;
  const urlApi = globalThis.URL;
  if (documentValue === undefined || typeof urlApi?.createObjectURL !== 'function' || typeof urlApi.revokeObjectURL !== 'function') {
    throw new ExportPrintControllerError('Browser export host is unavailable.', 'EXPORT_FAILED');
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

const defaultPrintHost: BrowserPrintHostV1 = Object.freeze({
  print: () => {
    const scope = globalThis as typeof globalThis & { print?: () => void };
    if (typeof scope.print !== 'function') throw new ExportPrintControllerError('Browser print host is unavailable.', 'PRINT_HOST_UNAVAILABLE');
    scope.print();
  }
});

const failure = (error: unknown, code: ExportPrintControllerErrorCode, prefix: string): ExportPrintControllerError => {
  if (error instanceof ExportPrintControllerError) return error;
  const record = error !== null && typeof error === 'object' ? error as { readonly code?: unknown; readonly message?: unknown } : null;
  const cause = typeof record?.message === 'string' ? record.message : String(error);
  return new ExportPrintControllerError(`${prefix}: ${cause}`, code, { causeCode: record?.code ?? null });
};

export const createExportPrintEnabledStandaloneScoreEditorController = (
  options: PlaybackEnabledControllerOptions = {}
): Readonly<ExportPrintEnabledStandaloneScoreEditorController> => {
  const base = createPlaybackEnabledStandaloneScoreEditorController(options);
  let root: HTMLElement | null = null;
  let lastExportedRevisionId: string | null = null;
  let lastPrintedRevisionId: string | null = null;
  let status: Readonly<{ code: string; message: string }> = Object.freeze({
    code: 'EXPORT_PRINT_IDLE',
    message: 'MusicXML export and current-revision print/PDF are ready when a score is open.'
  });

  const identity = (): Readonly<{ documentId: string; revisionId: string }> | null => {
    const document = base.getDocument();
    if (document === null) return null;
    const score = document.session.history.present.score;
    return Object.freeze({ documentId: score.id, revisionId: score.revision.id });
  };
  const rendererCurrent = (): boolean => {
    const current = identity();
    if (current === null) return false;
    const renderer = base.getRendererState();
    return renderer.renderedDocumentId === current.documentId && renderer.renderedRevisionId === current.revisionId;
  };
  const state = (): Readonly<BrowserExportPrintState> => {
    const current = identity();
    return Object.freeze({
      version: EXPORT_PRINT_ENABLED_BROWSER_APP_VERSION,
      documentId: current?.documentId ?? null,
      revisionId: current?.revisionId ?? null,
      lastExportedRevisionId,
      lastPrintedRevisionId,
      printReady: rendererCurrent(),
      pdfWorkflow: 'browser-print-dialog-save-as-pdf',
      pdfBytesGenerated: false,
      status
    });
  };
  const ensurePrintStyle = (): void => {
    if (root === null) return;
    const app = root.querySelector<HTMLElement>('[data-st-score-editor-app]');
    if (app === null || app.querySelector('[data-st-score-editor-print-style]') !== null) return;
    const style = app.ownerDocument.createElement('style');
    style.setAttribute('data-st-score-editor-print-style', EXPORT_PRINT_ENABLED_BROWSER_APP_VERSION);
    style.textContent = PRINT_STYLE;
    app.append(style);
  };
  const decorate = (): void => {
    if (root === null) return;
    ensurePrintStyle();
    const toolbar = root.querySelector<HTMLElement>('.stse-toolbar');
    if (toolbar !== null && toolbar.querySelector('[data-st-score-editor-export-print-controls]') === null) {
      const controls = toolbar.ownerDocument.createElement('span');
      controls.setAttribute('data-st-score-editor-export-print-controls', EXPORT_PRINT_ENABLED_BROWSER_APP_VERSION);
      controls.style.display = 'contents';
      const exportButton = toolbar.ownerDocument.createElement('button');
      exportButton.type = 'button';
      exportButton.textContent = 'Export XML';
      exportButton.setAttribute('data-export-print-action', 'export-musicxml');
      exportButton.addEventListener('click', () => { void controller.exportMusicXmlFile().catch(() => undefined); });
      const printButton = toolbar.ownerDocument.createElement('button');
      printButton.type = 'button';
      printButton.textContent = 'Print / PDF';
      printButton.setAttribute('data-export-print-action', 'print');
      printButton.addEventListener('click', () => { void controller.printCurrent().catch(() => undefined); });
      controls.append(exportButton, printButton);
      toolbar.append(controls);
    }
    const hasDocument = base.getDocument() !== null;
    const exportButton = toolbar?.querySelector<HTMLButtonElement>('[data-export-print-action="export-musicxml"]') ?? null;
    const printButton = toolbar?.querySelector<HTMLButtonElement>('[data-export-print-action="print"]') ?? null;
    if (exportButton !== null) exportButton.disabled = !hasDocument;
    if (printButton !== null) printButton.disabled = !hasDocument;
    const footer = root.querySelector<HTMLElement>('.stse-status');
    if (footer !== null) {
      footer.querySelector('[data-st-score-editor-export-print-status]')?.remove();
      const value = footer.ownerDocument.createElement('span');
      value.setAttribute('data-st-score-editor-export-print-status', status.code);
      value.textContent = status.message;
      footer.append(value);
    }
  };

  base.subscribe(() => { decorate(); });

  const controller: ExportPrintEnabledStandaloneScoreEditorController = {
    ...base,
    profile: exportPrintEnabledBrowserAppProfile,
    mount: (nextRoot) => { base.mount(nextRoot); root = nextRoot; decorate(); },
    unmount: () => { root = null; base.unmount(); },
    getExportPrintState: state,
    exportMusicXmlFile: async (handoff = defaultExportHandoff) => {
      const current = identity();
      if (current === null) {
        const error = new ExportPrintControllerError('MusicXML export requires an open score document.', 'EXPORT_NO_DOCUMENT');
        status = Object.freeze({ code: error.code, message: error.message });
        decorate();
        throw error;
      }
      try {
        const document = base.getDocument();
        if (document === null) throw new ExportPrintControllerError('MusicXML export requires an open score document.', 'EXPORT_NO_DOCUMENT');
        const musicXml = base.exportMusicXml();
        const artifact = createMusicXmlDownloadArtifact(musicXml, document.title);
        await handoff(artifact);
        lastExportedRevisionId = current.revisionId;
        const after = identity();
        status = after !== null && after.documentId === current.documentId && after.revisionId === current.revisionId
          ? Object.freeze({ code: 'MUSICXML_EXPORTED', message: `Exported MusicXML revision ${current.revisionId}.` })
          : Object.freeze({ code: 'MUSICXML_EXPORTED_PRIOR_REVISION', message: `Export completed for prior revision ${current.revisionId}; the live score changed during handoff.` });
        decorate();
        return artifact;
      } catch (error) {
        const value = failure(error, 'EXPORT_FAILED', 'MusicXML export failed');
        status = Object.freeze({ code: value.code, message: value.message });
        decorate();
        throw value;
      }
    },
    printCurrent: async (host = defaultPrintHost) => {
      const expected = identity();
      if (expected === null) {
        const error = new ExportPrintControllerError('Print/PDF requires an open score document.', 'PRINT_NO_DOCUMENT');
        status = Object.freeze({ code: error.code, message: error.message });
        decorate();
        throw error;
      }
      try {
        await base.renderCurrent();
      } catch (error) {
        const value = failure(error, 'PRINT_RENDER_FAILED', 'Print/PDF current-revision render failed');
        status = Object.freeze({ code: value.code, message: value.message });
        decorate();
        throw value;
      }
      const afterRender = identity();
      const renderer = base.getRendererState();
      if (
        afterRender === null || afterRender.documentId !== expected.documentId || afterRender.revisionId !== expected.revisionId ||
        renderer.renderedDocumentId !== expected.documentId || renderer.renderedRevisionId !== expected.revisionId
      ) {
        const error = new ExportPrintControllerError('Print/PDF refused a stale renderer presentation.', 'PRINT_STALE_REVISION', expected);
        status = Object.freeze({ code: error.code, message: error.message });
        decorate();
        throw error;
      }
      ensurePrintStyle();
      try {
        await host.print();
      } catch (error) {
        const value = failure(error, 'PRINT_FAILED', 'Browser print/PDF handoff failed');
        status = Object.freeze({ code: value.code, message: value.message });
        decorate();
        throw value;
      }
      lastPrintedRevisionId = expected.revisionId;
      const afterPrint = identity();
      status = afterPrint !== null && afterPrint.documentId === expected.documentId && afterPrint.revisionId === expected.revisionId
        ? Object.freeze({ code: 'PRINT_PDF_HANDED_OFF', message: `Current revision ${expected.revisionId} handed to the browser print/PDF dialog.` })
        : Object.freeze({ code: 'PRINT_PDF_HANDED_OFF_PRIOR_REVISION', message: `Print/PDF handoff used prior revision ${expected.revisionId}; the live score changed after handoff began.` });
      decorate();
      return state();
    }
  };
  return Object.freeze(controller);
};

export const createExportPrintEnabledStandaloneBrowserAppRuntime = () => {
  const base = createPlaybackEnabledStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: exportPrintEnabledBrowserAppProfile,
    createController: createExportPrintEnabledStandaloneScoreEditorController,
    exportPrint: Object.freeze({
      version: EXPORT_PRINT_ENABLED_BROWSER_APP_VERSION,
      bundled: true,
      musicXmlExportCanonicalAuthority: false,
      musicXmlExportMarksSaved: false,
      printCanonicalAuthority: false,
      printRequiresCurrentRendererRevision: true,
      printNetworkCapable: false,
      pdfWorkflow: 'browser-print-dialog-save-as-pdf' as const,
      pdfBytesGenerated: false
    })
  });
};
