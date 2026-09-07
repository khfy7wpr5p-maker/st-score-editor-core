import { addressEntityV3, type EventAddressV3, type SemanticAddressV3 } from '../../addressing-v3/src/index.js';
import type { TeacherOctaveDeltaV4 } from '../../editor-teacher-octave-transpose-admission-v4/src/index.js';
import {
  createTeacherWorkflowStandaloneBrowserAppRuntime,
  createTeacherWorkflowStandaloneScoreEditorController,
  teacherWorkflowBrowserAppProfile,
  type TeacherWorkflowControllerOptions,
  type TeacherWorkflowStandaloneScoreEditorController
} from './teacher-workflow.js';
import type { ScoreEditorBrowserAppSnapshot } from './index.js';

export const MOBILE_TEACHER_TOOLBAR_VERSION = '1.0.0' as const;
export const MOBILE_TEACHER_MIN_TOUCH_TARGET_PX = 44 as const;

export const mobileTeacherToolbarBrowserAppProfile = Object.freeze({
  ...teacherWorkflowBrowserAppProfile,
  mobileTeacherToolbarBundled: true,
  mobileTeacherToolbarCanonicalAuthority: false,
  mobileTeacherToolbarSelectionAuthority: 'SemanticAddressV3-current-revision' as const,
  mobileTeacherToolbarMinimumTouchTargetPx: MOBILE_TEACHER_MIN_TOUCH_TARGET_PX,
  mobileTeacherToolbarSafeAreaAware: true,
  mobileTeacherToolbarRendererCoordinateAuthority: false,
  mobileTeacherToolbarDomAuthoringAuthority: false,
  mobileTeacherToolbarNetworkAuthority: false
});

export interface MobileTeacherToolbarState {
  readonly version: typeof MOBILE_TEACHER_TOOLBAR_VERSION;
  readonly mounted: boolean;
  readonly hasDocument: boolean;
  readonly selectionKind: SemanticAddressV3['kind'] | null;
  readonly selectedEventId: string | null;
  readonly clipboardAvailable: boolean;
  readonly clipboardCurrent: boolean;
  readonly canCopySelectedEvent: boolean;
  readonly canAttemptPasteOverwrite: boolean;
  readonly canAttemptInsertAfter: boolean;
  readonly canTransposeSelectedEvent: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export type MobileTeacherToolbarErrorCode = 'EVENT_SELECTION_REQUIRED';

export class MobileTeacherToolbarError extends Error {
  readonly code: MobileTeacherToolbarErrorCode;
  constructor(message: string, code: MobileTeacherToolbarErrorCode) {
    super(message);
    this.name = 'MobileTeacherToolbarError';
    this.code = code;
    Object.freeze(this);
  }
}

export const MOBILE_TEACHER_TOOLBAR_STYLE = `
.stse-mobile-teacher-toolbar{display:none}
@media(max-width:760px){
  .stse-mobile-teacher-toolbar{position:sticky;z-index:20;bottom:0;display:flex;gap:6px;align-items:center;overflow-x:auto;padding:8px max(8px,env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));border-top:1px solid #d7d7dc;background:rgba(255,255,255,.97);-webkit-overflow-scrolling:touch}
  .stse-mobile-teacher-toolbar button{min-width:44px;min-height:44px;flex:0 0 auto;font:inherit;border:1px solid #c9c9cf;background:#fff;border-radius:8px;padding:8px 10px;touch-action:manipulation}
  .stse-mobile-teacher-toolbar button:disabled{opacity:.45}
  .stse-mobile-teacher-context{min-width:max-content;font-size:12px;color:#5f5f67;padding:0 4px}
}
`;

const selectedEventAddress = (base: TeacherWorkflowStandaloneScoreEditorController): EventAddressV3 | null => {
  const document = base.getDocument();
  if (document === null) return null;
  const selection = document.session.selection;
  if (selection === null) return null;
  if (selection.kind === 'event') return selection;
  if (selection.kind !== 'note') return null;
  const address = addressEntityV3(document.session.history.present.score, selection.eventId);
  return address.kind === 'event' ? address : null;
};

const requireSelectedEvent = (base: TeacherWorkflowStandaloneScoreEditorController): EventAddressV3 => {
  const address = selectedEventAddress(base);
  if (address === null) {
    throw new MobileTeacherToolbarError(
      'Select a current-revision timed event or note before using this mobile teacher command.',
      'EVENT_SELECTION_REQUIRED'
    );
  }
  return address;
};

export interface MobileTeacherToolbarStandaloneScoreEditorController extends Omit<TeacherWorkflowStandaloneScoreEditorController, 'profile' | 'mount' | 'unmount'> {
  readonly profile: typeof mobileTeacherToolbarBrowserAppProfile;
  readonly getMobileTeacherToolbarState: () => Readonly<MobileTeacherToolbarState>;
  readonly copySelectedTeacherEvent: () => Readonly<MobileTeacherToolbarState>;
  readonly pasteTeacherClipboardOverwriteAtSelection: () => Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly insertTeacherClipboardAfterSelection: () => Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly transposeSelectedTeacherEventByOctaves: (octaveDelta: TeacherOctaveDeltaV4) => Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly mount: (root: HTMLElement) => void;
  readonly unmount: () => void;
}

export const createMobileTeacherToolbarStandaloneScoreEditorController = (
  options: TeacherWorkflowControllerOptions = {}
): Readonly<MobileTeacherToolbarStandaloneScoreEditorController> => {
  const base = createTeacherWorkflowStandaloneScoreEditorController(options);
  let root: HTMLElement | null = null;

  const state = (): Readonly<MobileTeacherToolbarState> => {
    const document = base.getDocument();
    const workflow = base.getTeacherWorkflowState();
    const selectedEvent = selectedEventAddress(base);
    return Object.freeze({
      version: MOBILE_TEACHER_TOOLBAR_VERSION,
      mounted: root !== null,
      hasDocument: document !== null,
      selectionKind: document?.session.selection?.kind ?? null,
      selectedEventId: selectedEvent?.eventId ?? null,
      clipboardAvailable: workflow.clipboardAvailable,
      clipboardCurrent: workflow.clipboardCurrent,
      canCopySelectedEvent: selectedEvent !== null,
      canAttemptPasteOverwrite: selectedEvent !== null && workflow.clipboardAvailable && workflow.clipboardCurrent,
      canAttemptInsertAfter: selectedEvent !== null && workflow.clipboardAvailable && workflow.clipboardCurrent,
      canTransposeSelectedEvent: selectedEvent !== null,
      canUndo: (document?.session.history.past.length ?? 0) > 0,
      canRedo: (document?.session.history.future.length ?? 0) > 0
    });
  };

  const addButton = (
    owner: Document,
    toolbar: HTMLElement,
    label: string,
    ariaLabel: string,
    disabled: boolean,
    action: () => void
  ): void => {
    const button = owner.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.setAttribute('aria-label', ariaLabel);
    button.disabled = disabled;
    button.addEventListener('click', action);
    toolbar.append(button);
  };

  const decorate = (): void => {
    if (root === null) return;
    const app = root.querySelector<HTMLElement>('[data-st-score-editor-app]');
    if (app === null) return;
    if (app.querySelector('[data-st-mobile-teacher-toolbar-style]') === null) {
      const style = app.ownerDocument.createElement('style');
      style.setAttribute('data-st-mobile-teacher-toolbar-style', MOBILE_TEACHER_TOOLBAR_VERSION);
      style.textContent = MOBILE_TEACHER_TOOLBAR_STYLE;
      app.append(style);
    }
    if (app.querySelector('[data-st-mobile-teacher-toolbar]') !== null) return;
    const current = state();
    const toolbar = app.ownerDocument.createElement('nav');
    toolbar.className = 'stse-mobile-teacher-toolbar';
    toolbar.setAttribute('data-st-mobile-teacher-toolbar', MOBILE_TEACHER_TOOLBAR_VERSION);
    toolbar.setAttribute('aria-label', 'Teacher mobile context');

    const context = app.ownerDocument.createElement('span');
    context.className = 'stse-mobile-teacher-context';
    context.textContent = current.selectedEventId === null ? 'Select note' : `Selected: ${current.selectionKind}`;
    toolbar.append(context);

    addButton(app.ownerDocument, toolbar, 'Copy', 'Copy selected event', !current.canCopySelectedEvent, () => { controller.copySelectedTeacherEvent(); });
    addButton(app.ownerDocument, toolbar, 'Paste', 'Paste over selected rest', !current.canAttemptPasteOverwrite, () => { controller.pasteTeacherClipboardOverwriteAtSelection(); });
    addButton(app.ownerDocument, toolbar, 'Insert', 'Insert after selected event', !current.canAttemptInsertAfter, () => { controller.insertTeacherClipboardAfterSelection(); });
    addButton(app.ownerDocument, toolbar, '−8', 'Transpose selected event down one octave', !current.canTransposeSelectedEvent, () => { controller.transposeSelectedTeacherEventByOctaves(-1); });
    addButton(app.ownerDocument, toolbar, '+8', 'Transpose selected event up one octave', !current.canTransposeSelectedEvent, () => { controller.transposeSelectedTeacherEventByOctaves(1); });
    addButton(app.ownerDocument, toolbar, 'Undo', 'Undo last edit', !current.canUndo, () => { controller.undo(); });
    addButton(app.ownerDocument, toolbar, 'Redo', 'Redo last edit', !current.canRedo, () => { controller.redo(); });

    const status = app.querySelector('.stse-status');
    if (status === null) app.append(toolbar);
    else app.insertBefore(toolbar, status);
  };

  base.subscribe(() => { decorate(); });

  const controller: MobileTeacherToolbarStandaloneScoreEditorController = {
    ...base,
    profile: mobileTeacherToolbarBrowserAppProfile,
    getMobileTeacherToolbarState: state,
    copySelectedTeacherEvent: () => {
      const event = requireSelectedEvent(base);
      base.copyTeacherSpan(event, event);
      decorate();
      return state();
    },
    pasteTeacherClipboardOverwriteAtSelection: () => base.pasteTeacherClipboardOverwrite(requireSelectedEvent(base)),
    insertTeacherClipboardAfterSelection: () => base.insertTeacherClipboardAfter(requireSelectedEvent(base)),
    transposeSelectedTeacherEventByOctaves: (octaveDelta) => {
      const event = requireSelectedEvent(base);
      return base.transposeTeacherSpanByOctaves(event, event, octaveDelta);
    },
    mount: (nextRoot) => {
      base.mount(nextRoot);
      root = nextRoot;
      decorate();
    },
    unmount: () => {
      root = null;
      base.unmount();
    }
  };

  return Object.freeze(controller);
};

export const createMobileTeacherToolbarStandaloneBrowserAppRuntime = () => {
  const base = createTeacherWorkflowStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: mobileTeacherToolbarBrowserAppProfile,
    createController: createMobileTeacherToolbarStandaloneScoreEditorController,
    mobileTeacherToolbar: Object.freeze({
      version: MOBILE_TEACHER_TOOLBAR_VERSION,
      bundled: true,
      canonicalAuthority: false,
      semanticSelectionOnly: true,
      minimumTouchTargetPx: MOBILE_TEACHER_MIN_TOUCH_TARGET_PX,
      safeAreaAware: true,
      rendererCoordinateAuthority: false,
      domAuthoringAuthority: false,
      networkAuthority: false
    })
  });
};
