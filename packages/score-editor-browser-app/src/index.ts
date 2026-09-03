import type { SemanticAddressV3 } from '../../addressing-v3/src/index.js';
import type { RendererProfile } from '../../renderer-contract/src/index.js';
import { getEditorKeypadManifest, parseEditorKeypadAction, type EditorKeypadActionId } from '../../editor-keypad/src/index.js';
import type { BasicAuthoringV4Options } from '../../editor-basic-authoring-v4/src/index.js';
import type { GraceAuthoringV4Options } from '../../editor-grace-authoring-v4/src/index.js';
import type { ArticulationAuthoringV4Options } from '../../editor-articulation-authoring-v4/src/index.js';
import type { OrnamentAuthoringV4Options } from '../../editor-ornament-authoring-v4/src/index.js';
import type { EditorKeypadV4Options } from '../../editor-keypad-execution-v4/src/index.js';
import type { CrossStaffAuthoringV4Options } from '../../editor-cross-staff-authoring-v4/src/index.js';
import type { TopologyAuthoringV3Options } from '../../editor-topology-authoring-v3/src/index.js';
import {
  createNewScoreEditorAppDocument,
  openMusicXmlScoreEditorAppDocument,
  exportMusicXmlScoreEditorAppDocument,
  markScoreEditorAppDocumentSaved,
  selectAppSemanticAddress,
  commitAppBasicAuthoringIntent,
  commitAppGraceAuthoringIntent,
  commitAppArticulationAuthoringIntent,
  commitAppOrnamentAuthoringIntent,
  commitAppKeypadAction,
  commitAppCrossStaffIntent,
  commitAppTopologyIntent,
  navigateAppDocumentHistory,
  type NewAppDocumentOptions,
  type OpenMusicXmlAppDocumentOptions,
  type ScoreEditorAppDocument
} from '../../score-editor-app-document/src/index.js';
import { adoptScoreEditorAppDocumentSnapshot } from '../../score-editor-app-snapshot-adoption/src/index.js';

export const SCORE_EDITOR_BROWSER_APP_VERSION = '1.0.0' as const;

export const standaloneBrowserAppProfile = Object.freeze({
  version: SCORE_EDITOR_BROWSER_APP_VERSION,
  standaloneProduct: true,
  canonicalAuthority: false,
  canonicalSession: 'EditorSessionV4',
  networkCapable: false,
  persistenceCapable: false,
  serverRevisionAuthority: false,
  rendererAuthority: false,
  rendererBundled: false,
  fileWorkflowBundled: false,
  playbackBundled: false,
  localCommitAvailable: true,
  keypadManifestAvailable: true,
  responsiveShellAvailable: true
});

export interface ScoreEditorBrowserAppSnapshot {
  readonly version: typeof SCORE_EDITOR_BROWSER_APP_VERSION;
  readonly hasDocument: boolean;
  readonly title: string | null;
  readonly origin: string | null;
  readonly dirty: boolean;
  readonly revisionId: string | null;
  readonly selectionKind: string | null;
  readonly statusCode: string;
  readonly statusMessage: string;
  readonly error: { readonly code: string; readonly message: string } | null;
}

export type ScoreEditorBrowserAppListener = (snapshot: Readonly<ScoreEditorBrowserAppSnapshot>) => void;
export interface StandaloneScoreEditorControllerOptions { readonly rendererProfile?: RendererProfile }

export type ScoreEditorBrowserAppErrorCode =
  | 'NO_DOCUMENT'
  | 'ALREADY_MOUNTED'
  | 'INVALID_MOUNT_ROOT'
  | 'REVISION_ID_UNAVAILABLE'
  | 'APP_OPERATION_FAILED';

export class ScoreEditorBrowserAppError extends Error {
  readonly code: ScoreEditorBrowserAppErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: ScoreEditorBrowserAppErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ScoreEditorBrowserAppError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const errorInfo = (error: unknown): Readonly<{ code: string; message: string }> => {
  const value = error !== null && typeof error === 'object'
    ? error as { readonly code?: unknown; readonly message?: unknown; readonly name?: unknown }
    : null;
  const code = typeof value?.code === 'string' && value.code.length > 0
    ? value.code
    : typeof value?.name === 'string' && value.name.length > 0
      ? value.name
      : 'APP_OPERATION_FAILED';
  const message = typeof value?.message === 'string' && value.message.length > 0
    ? value.message
    : 'Standalone score editor operation failed.';
  return Object.freeze({ code, message });
};

const nextRevisionId = (): string => {
  const cryptoValue = globalThis.crypto as Crypto | undefined;
  if (cryptoValue === undefined || typeof cryptoValue.randomUUID !== 'function') {
    throw new ScoreEditorBrowserAppError('Browser randomUUID support is required for a new edit revision.', 'REVISION_ID_UNAVAILABLE');
  }
  return `rev:${cryptoValue.randomUUID()}`;
};

const entityId = (address: SemanticAddressV3): string => {
  switch (address.kind) {
    case 'document': return address.documentId;
    case 'measure-frame': return address.frameId;
    case 'part': return address.partId;
    case 'staff': return address.staffId;
    case 'measure': return address.measureId;
    case 'voice': return address.voiceId;
    case 'event': return address.eventId;
    case 'note': return address.noteId;
    case 'grace-group': return address.graceGroupId;
    case 'grace-event': return address.graceEventId;
    case 'grace-note': return address.graceNoteId;
  }
};

const ADVANCED_KEYPAD = new Set<EditorKeypadActionId>(['tuplet.triplet', 'tie.edit', 'slur.edit']);

const SHELL_CSS = `
.stse-app{box-sizing:border-box;display:grid;grid-template-rows:auto minmax(0,1fr) auto;min-height:320px;height:100%;font:14px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f7f7f8;color:#171719}
.stse-app *{box-sizing:border-box}.stse-toolbar{display:flex;gap:8px;align-items:center;padding:10px;border-bottom:1px solid #d7d7dc;background:#fff;overflow-x:auto}.stse-toolbar button,.stse-keypad button{font:inherit;border:1px solid #c9c9cf;background:#fff;border-radius:7px;padding:7px 10px;cursor:pointer}.stse-toolbar button:disabled,.stse-keypad button:disabled{opacity:.45;cursor:not-allowed}.stse-title{font-weight:650;margin-right:auto;white-space:nowrap}.stse-dirty{font-size:12px;color:#6c6c73}.stse-main{display:grid;grid-template-columns:minmax(0,1fr) 280px;min-height:0}.stse-workspace{display:grid;grid-template-rows:minmax(180px,1fr) auto;min-width:0;min-height:0}.stse-viewport{margin:12px;padding:16px;border:1px solid #d7d7dc;border-radius:10px;background:#fff;overflow:auto;min-height:180px}.stse-viewport-placeholder{display:grid;place-items:center;height:100%;min-height:150px;color:#777780;text-align:center}.stse-keypad{display:flex;gap:6px;padding:10px 12px;border-top:1px solid #d7d7dc;overflow-x:auto;background:#fff}.stse-keypad-group{display:flex;gap:4px;padding-right:8px;border-right:1px solid #e0e0e4}.stse-keypad-group:last-child{border-right:0}.stse-side{border-left:1px solid #d7d7dc;background:#fff;padding:12px;overflow:auto}.stse-side h2{font-size:13px;margin:0 0 8px}.stse-inspector{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;overflow-wrap:anywhere}.stse-status{display:flex;gap:10px;align-items:center;padding:8px 12px;border-top:1px solid #d7d7dc;background:#fff;font-size:12px}.stse-error{color:#9e1b1b;font-weight:600}.stse-status-message{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media(max-width:760px){.stse-app{min-height:420px}.stse-main{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) auto}.stse-side{border-left:0;border-top:1px solid #d7d7dc;max-height:150px}.stse-toolbar{padding:8px}.stse-viewport{margin:8px}.stse-keypad{padding:8px}}
`;

export interface StandaloneScoreEditorController {
  readonly version: typeof SCORE_EDITOR_BROWSER_APP_VERSION;
  readonly profile: typeof standaloneBrowserAppProfile;
  readonly getSnapshot: () => Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly getDocument: () => Readonly<ScoreEditorAppDocument> | null;
  readonly subscribe: (listener: ScoreEditorBrowserAppListener) => () => void;
  readonly mount: (root: HTMLElement) => void;
  readonly unmount: () => void;
  readonly newDocument: (options?: NewAppDocumentOptions) => Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly openMusicXml: (musicXml: string, options?: OpenMusicXmlAppDocumentOptions) => Promise<Readonly<ScoreEditorBrowserAppSnapshot>>;
  readonly adoptValidatedSnapshot: (document: ScoreEditorAppDocument) => Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly exportMusicXml: () => string;
  readonly markSaved: (title?: string) => Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly select: (address: SemanticAddressV3 | null) => Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly undo: () => Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly redo: () => Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly commitBasic: (intent: unknown, options: BasicAuthoringV4Options) => Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly commitGrace: (intent: unknown, options: GraceAuthoringV4Options) => Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly commitArticulation: (intent: unknown, options: ArticulationAuthoringV4Options) => Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly commitOrnament: (intent: unknown, options: OrnamentAuthoringV4Options) => Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly commitKeypad: (action: unknown, advancedTarget?: unknown, options?: EditorKeypadV4Options) => Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly commitCrossStaff: (intent: unknown, options: CrossStaffAuthoringV4Options) => Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly commitTopology: (intent: unknown, options: TopologyAuthoringV3Options) => Readonly<ScoreEditorBrowserAppSnapshot>;
}

export const createStandaloneScoreEditorController = (
  controllerOptions: StandaloneScoreEditorControllerOptions = {}
): Readonly<StandaloneScoreEditorController> => {
  let current: Readonly<ScoreEditorAppDocument> | null = null;
  let lastError: Readonly<{ code: string; message: string }> | null = null;
  let root: HTMLElement | null = null;
  const listeners = new Set<ScoreEditorBrowserAppListener>();
  const withRendererProfile = <T extends NewAppDocumentOptions | OpenMusicXmlAppDocumentOptions>(options: T): T =>
    controllerOptions.rendererProfile === undefined || options.rendererProfile !== undefined
      ? options
      : Object.freeze({ ...options, rendererProfile: controllerOptions.rendererProfile }) as T;

  const snapshot = (): Readonly<ScoreEditorBrowserAppSnapshot> => {
    const selection = current?.session.selection ?? null;
    return Object.freeze({
      version: SCORE_EDITOR_BROWSER_APP_VERSION,
      hasDocument: current !== null,
      title: current?.title ?? null,
      origin: current?.origin ?? null,
      dirty: current?.dirty ?? false,
      revisionId: current?.session.history.present.score.revision.id ?? null,
      selectionKind: selection?.kind ?? null,
      statusCode: current?.session.status.code ?? 'NO_DOCUMENT',
      statusMessage: current?.session.status.message ?? 'Create or open a score document.',
      error: lastError
    });
  };

  const notify = (): Readonly<ScoreEditorBrowserAppSnapshot> => {
    const value = snapshot();
    render();
    for (const listener of listeners) listener(value);
    return value;
  };

  const requireDocument = (): Readonly<ScoreEditorAppDocument> => {
    if (current === null) throw new ScoreEditorBrowserAppError('This operation requires an active score document.', 'NO_DOCUMENT');
    return current;
  };

  const mutate = (operation: () => Readonly<ScoreEditorAppDocument>): Readonly<ScoreEditorBrowserAppSnapshot> => {
    try {
      current = operation();
      lastError = null;
    } catch (error) {
      lastError = errorInfo(error);
    }
    return notify();
  };

  const render = (): void => {
    if (root === null) return;
    const owner = root.ownerDocument;
    if (owner === null) throw new ScoreEditorBrowserAppError('Mount root has no ownerDocument.', 'INVALID_MOUNT_ROOT');
    const app = owner.createElement('section');
    app.className = 'stse-app';
    app.setAttribute('data-st-score-editor-app', SCORE_EDITOR_BROWSER_APP_VERSION);

    const style = owner.createElement('style');
    style.textContent = SHELL_CSS;
    app.append(style);

    const toolbar = owner.createElement('header');
    toolbar.className = 'stse-toolbar';
    const title = owner.createElement('div');
    title.className = 'stse-title';
    title.textContent = current?.title ?? 'ST Score Editor';
    const dirty = owner.createElement('span');
    dirty.className = 'stse-dirty';
    dirty.textContent = current?.dirty ? 'Unsaved' : current === null ? '' : 'Saved';
    const newButton = owner.createElement('button');
    newButton.type = 'button';
    newButton.textContent = 'New';
    newButton.addEventListener('click', () => { controller.newDocument(); });
    const undoButton = owner.createElement('button');
    undoButton.type = 'button'; undoButton.textContent = 'Undo'; undoButton.disabled = current === null || current.session.history.past.length === 0;
    undoButton.addEventListener('click', () => { controller.undo(); });
    const redoButton = owner.createElement('button');
    redoButton.type = 'button'; redoButton.textContent = 'Redo'; redoButton.disabled = current === null || current.session.history.future.length === 0;
    redoButton.addEventListener('click', () => { controller.redo(); });
    toolbar.append(title, dirty, newButton, undoButton, redoButton);

    const main = owner.createElement('div'); main.className = 'stse-main';
    const workspace = owner.createElement('div'); workspace.className = 'stse-workspace';
    const viewport = owner.createElement('div'); viewport.className = 'stse-viewport'; viewport.setAttribute('data-st-score-editor-viewport', 'renderer-slot');
    const placeholder = owner.createElement('div'); placeholder.className = 'stse-viewport-placeholder';
    placeholder.textContent = current === null ? 'Create or open a score to begin.' : 'Renderer slot — canonical document is ready; visual rendering is connected in APP-06.';
    viewport.append(placeholder);

    const keypad = owner.createElement('div'); keypad.className = 'stse-keypad'; keypad.setAttribute('aria-label', 'Score editor keypad');
    for (const group of getEditorKeypadManifest().groups) {
      const groupElement = owner.createElement('div'); groupElement.className = 'stse-keypad-group'; groupElement.setAttribute('aria-label', group.accessibleLabelKey);
      for (const descriptor of group.actions) {
        const button = owner.createElement('button'); button.type = 'button'; button.textContent = descriptor.actionId; button.setAttribute('data-action-id', descriptor.actionId); button.setAttribute('aria-label', descriptor.accessibleLabelKey);
        button.disabled = current === null || ADVANCED_KEYPAD.has(descriptor.actionId);
        if (ADVANCED_KEYPAD.has(descriptor.actionId)) button.title = 'Requires an explicit semantic range/pair target.';
        button.addEventListener('click', () => { controller.commitKeypad({ version: '1.0.0', actionId: descriptor.actionId }); });
        groupElement.append(button);
      }
      keypad.append(groupElement);
    }
    workspace.append(viewport, keypad);

    const side = owner.createElement('aside'); side.className = 'stse-side';
    const heading = owner.createElement('h2'); heading.textContent = 'Inspector';
    const inspector = owner.createElement('div'); inspector.className = 'stse-inspector';
    const selection = current?.session.selection ?? null;
    inspector.textContent = current === null
      ? 'No document'
      : `revision: ${current.session.history.present.score.revision.id}\nselection: ${selection === null ? 'none' : `${selection.kind}:${entityId(selection)}`}\nprojection: ${current.session.renderRequest.projectionStatus}`;
    side.append(heading, inspector);
    main.append(workspace, side);

    const status = owner.createElement('footer'); status.className = 'stse-status';
    const statusCode = owner.createElement('strong'); statusCode.textContent = lastError?.code ?? current?.session.status.code ?? 'NO_DOCUMENT'; if (lastError !== null) statusCode.className = 'stse-error';
    const statusMessage = owner.createElement('span'); statusMessage.className = 'stse-status-message'; statusMessage.textContent = lastError?.message ?? current?.session.status.message ?? 'Create or open a score document.';
    status.append(statusCode, statusMessage);
    app.append(toolbar, main, status);
    root.replaceChildren(app);
  };

  const controller: StandaloneScoreEditorController = {
    version: SCORE_EDITOR_BROWSER_APP_VERSION,
    profile: standaloneBrowserAppProfile,
    getSnapshot: snapshot,
    getDocument: () => current,
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    mount: (nextRoot) => {
      if (root !== null && root !== nextRoot) throw new ScoreEditorBrowserAppError('Controller is already mounted to another root.', 'ALREADY_MOUNTED');
      if (nextRoot === null || typeof nextRoot.replaceChildren !== 'function') throw new ScoreEditorBrowserAppError('A DOM element root is required.', 'INVALID_MOUNT_ROOT');
      root = nextRoot; render();
    },
    unmount: () => { if (root !== null) root.replaceChildren(); root = null; },
    newDocument: (options = {}) => mutate(() => createNewScoreEditorAppDocument(withRendererProfile(options))),
    openMusicXml: async (musicXml, options = {}) => {
      try { current = await openMusicXmlScoreEditorAppDocument(musicXml, withRendererProfile(options)); lastError = null; }
      catch (error) { lastError = errorInfo(error); }
      return notify();
    },
    adoptValidatedSnapshot: (document) => mutate(() => adoptScoreEditorAppDocumentSnapshot(document)),
    exportMusicXml: () => exportMusicXmlScoreEditorAppDocument(requireDocument()),
    markSaved: (nextTitle) => mutate(() => markScoreEditorAppDocumentSaved(requireDocument(), nextTitle ?? requireDocument().title)),
    select: (address) => mutate(() => selectAppSemanticAddress(requireDocument(), address)),
    undo: () => mutate(() => navigateAppDocumentHistory(requireDocument(), 'UNDO')),
    redo: () => mutate(() => navigateAppDocumentHistory(requireDocument(), 'REDO')),
    commitBasic: (intent, options) => mutate(() => commitAppBasicAuthoringIntent(requireDocument(), intent, options)),
    commitGrace: (intent, options) => mutate(() => commitAppGraceAuthoringIntent(requireDocument(), intent, options)),
    commitArticulation: (intent, options) => mutate(() => commitAppArticulationAuthoringIntent(requireDocument(), intent, options)),
    commitOrnament: (intent, options) => mutate(() => commitAppOrnamentAuthoringIntent(requireDocument(), intent, options)),
    commitKeypad: (action, advancedTarget = null, options) => {
      const parsed = parseEditorKeypadAction(action);
      const resolvedOptions = options ?? Object.freeze({ nextRevisionId: nextRevisionId() });
      return mutate(() => commitAppKeypadAction(requireDocument(), parsed, advancedTarget, resolvedOptions));
    },
    commitCrossStaff: (intent, options) => mutate(() => commitAppCrossStaffIntent(requireDocument(), intent, options)),
    commitTopology: (intent, options) => mutate(() => commitAppTopologyIntent(requireDocument(), intent, options))
  };
  return Object.freeze(controller);
};

export const createStandaloneBrowserAppRuntime = () => Object.freeze({
  runtimeVersion: SCORE_EDITOR_BROWSER_APP_VERSION,
  profile: standaloneBrowserAppProfile,
  keypadManifest: getEditorKeypadManifest(),
  createController: createStandaloneScoreEditorController
});

export type StandaloneBrowserAppRuntime = ReturnType<typeof createStandaloneBrowserAppRuntime>;
