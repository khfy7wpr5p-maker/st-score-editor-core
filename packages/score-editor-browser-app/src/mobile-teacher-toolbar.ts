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
  mobileTeacherToolbarRangeCapture: 'two-distinct-current-revision-events' as const,
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
  readonly rangeStartEventId: string | null;
  readonly rangeStartCurrent: boolean;
  readonly clipboardAvailable: boolean;
  readonly clipboardCurrent: boolean;
  readonly canCaptureRangeStart: boolean;
  readonly canCompleteRange: boolean;
  readonly canCopyRange: boolean;
  readonly canAttemptPasteOverwrite: boolean;
  readonly canAttemptInsertAfter: boolean;
  readonly canTransposeRange: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export type MobileTeacherToolbarErrorCode = 'EVENT_SELECTION_REQUIRED' | 'RANGE_START_REQUIRED' | 'RANGE_STOP_REQUIRED';

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
  readonly captureTeacherRangeStartAtSelection: () => Readonly<MobileTeacherToolbarState>;
  readonly clearTeacherRangeStart: () => Readonly<MobileTeacherToolbarState>;
  readonly copyTeacherRangeToSelection: () => Readonly<MobileTeacherToolbarState>;
  readonly pasteTeacherClipboardOverwriteAtSelection: () => Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly insertTeacherClipboardAfterSelection: () => Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly transposeTeacherRangeToSelectionByOctaves: (octaveDelta: TeacherOctaveDeltaV4) => Readonly<ScoreEditorBrowserAppSnapshot>;
  readonly mount: (root: HTMLElement) => void;
  readonly unmount: () => void;
}

export const createMobileTeacherToolbarStandaloneScoreEditorController = (
  options: TeacherWorkflowControllerOptions = {}
): Readonly<MobileTeacherToolbarStandaloneScoreEditorController> => {
  const base = createTeacherWorkflowStandaloneScoreEditorController(options);
  let root: HTMLElement | null = null;
  let rangeStart: EventAddressV3 | null = null;

  const currentRevisionId = (): string | null =>
    base.getDocument()?.session.history.present.score.revision.id ?? null;

  const rangeStartIsCurrent = (): boolean =>
    rangeStart !== null && rangeStart.revisionId === currentRevisionId();

  const rangeStop = (): EventAddressV3 | null => {
    const selected = selectedEventAddress(base);
    if (!rangeStartIsCurrent() || rangeStart === null || selected === null || selected.eventId === rangeStart.eventId) return null;
    return selected;
  };

  const state = (): Readonly<MobileTeacherToolbarState> => {
    const document = base.getDocument();
    const workflow = base.getTeacherWorkflowState();
    const selectedEvent = selectedEventAddress(base);
    const currentRangeStart = rangeStartIsCurrent();
    const stop = rangeStop();
    return Object.freeze({
      version: MOBILE_TEACHER_TOOLBAR_VERSION,
      mounted: root !== null,
      hasDocument: document !== null,
      selectionKind: document?.session.selection?.kind ?? null,
      selectedEventId: selectedEvent?.eventId ?? null,
      rangeStartEventId: currentRangeStart ? rangeStart?.eventId ?? null : null,
      rangeStartCurrent: currentRangeStart,
      clipboardAvailable: workflow.clipboardAvailable,
      clipboardCurrent: workflow.clipboardCurrent,
      canCaptureRangeStart: selectedEvent !== null,
      canCompleteRange: stop !== null,
      canCopyRange: stop !== null,
      canAttemptPasteOverwrite: selectedEvent !== null && workflow.clipboardAvailable && workflow.clipboardCurrent,
      canAttemptInsertAfter: selectedEvent !== null && workflow.clipboardAvailable && workflow.clipboardCurrent,
      canTransposeRange: stop !== null,
      canUndo: (document?.session.history.past.length ?? 0) > 0,
      canRedo: (document?.session.history.future.length ?? 0) > 0
    });
  };

  const requireRange = (): Readonly<{ start: EventAddressV3; stop: EventAddressV3 }> => {
    if (!rangeStartIsCurrent() || rangeStart === null) {
      throw new MobileTeacherToolbarError('Capture a current-revision range start first.', 'RANGE_START_REQUIRED');
    }
    const stop = rangeStop();
    if (stop === null) {
      throw new MobileTeacherToolbarError('Select a different current-revision event to complete the range.', 'RANGE_STOP_REQUIRED');
    }
    return Object.freeze({ start: rangeStart, stop });
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
    app.querySelector('[data-st-mobile-teacher-toolbar]')?.remove();
    const current = state();
    const toolbar = app.ownerDocument.createElement('nav');
    toolbar.className = 'stse-mobile-teacher-toolbar';
    toolbar.setAttribute('data-st-mobile-teacher-toolbar', MOBILE_TEACHER_TOOLBAR_VERSION);
    toolbar.setAttribute('aria-label', 'Teacher mobile context');

    const context = app.ownerDocument.createElement('span');
    context.className = 'stse-mobile-teacher-context';
    context.textContent = current.rangeStartCurrent
      ? current.canCompleteRange ? 'Range ready' : 'Select range end'
      : current.selectedEventId === null ? 'Select note' : `Selected: ${current.selectionKind}`;
    toolbar.append(context);

    addButton(app.ownerDocument, toolbar, 'Start', 'Capture teacher range start', !current.canCaptureRangeStart, () => { controller.captureTeacherRangeStartAtSelection(); });
    addButton(app.ownerDocument, toolbar, 'Copy', 'Copy captured teacher range', !current.canCopyRange, () => { controller.copyTeacherRangeToSelection(); });
    addButton(app.ownerDocument, toolbar, 'Paste', 'Paste over selected rest', !current.canAttemptPasteOverwrite, () => { controller.pasteTeacherClipboardOverwriteAtSelection(); });
    addButton(app.ownerDocument, toolbar, 'Insert', 'Insert after selected event', !current.canAttemptInsertAfter, () => { controller.insertTeacherClipboardAfterSelection(); });
    addButton(app.ownerDocument, toolbar, '−8', 'Transpose captured range down one octave', !current.canTransposeRange, () => { controller.transposeTeacherRangeToSelectionByOctaves(-1); });
    addButton(app.ownerDocument, toolbar, '+8', 'Transpose captured range up one octave', !current.canTransposeRange, () => { controller.transposeTeacherRangeToSelectionByOctaves(1); });
    addButton(app.ownerDocument, toolbar, 'Undo', 'Undo last edit', !current.canUndo, () => { controller.undo(); });
    addButton(app.ownerDocument, toolbar, 'Redo', 'Redo last edit', !current.canRedo, () => { controller.redo(); });

    const status = app.querySelector('.stse-status');
    if (status === null) app.append(toolbar);
    else app.insertBefore(toolbar, status);
  };

  base.subscribe(() => {
    if (rangeStart !== null && rangeStart.revisionId !== currentRevisionId()) rangeStart = null;
    decorate();
  });

  const controller: MobileTeacherToolbarStandaloneScoreEditorController = {
    ...base,
    profile: mobileTeacherToolbarBrowserAppProfile,
    getMobileTeacherToolbarState: state,
    captureTeacherRangeStartAtSelection: () => {
      rangeStart = Object.freeze({ ...requireSelectedEvent(base) });
      decorate();
      return state();
    },
    clearTeacherRangeStart: () => {
      rangeStart = null;
      decorate();
      return state();
    },
    copyTeacherRangeToSelection: () => {
      const range = requireRange();
      base.copyTeacherSpan(range.start, range.stop);
      rangeStart = null;
      decorate();
      return state();
    },
    pasteTeacherClipboardOverwriteAtSelection: () => base.pasteTeacherClipboardOverwrite(requireSelectedEvent(base)),
    insertTeacherClipboardAfterSelection: () => base.insertTeacherClipboardAfter(requireSelectedEvent(base)),
    transposeTeacherRangeToSelectionByOctaves: (octaveDelta) => {
      const range = requireRange();
      const result = base.transposeTeacherSpanByOctaves(range.start, range.stop, octaveDelta);
      rangeStart = null;
      return result;
    },
    mount: (nextRoot) => {
      base.mount(nextRoot);
      root = nextRoot;
      decorate();
    },
    unmount: () => {
      rangeStart = null;
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
      rangeCapture: 'two-distinct-current-revision-events',
      minimumTouchTargetPx: MOBILE_TEACHER_MIN_TOUCH_TARGET_PX,
      safeAreaAware: true,
      rendererCoordinateAuthority: false,
      domAuthoringAuthority: false,
      networkAuthority: false
    })
  });
};
