import type { TeacherWorkflowControllerOptions } from './teacher-workflow.js';
import {
  audioHostIntegratedBrowserAppProfile,
  createAudioHostIntegratedStandaloneBrowserAppRuntime,
  createAudioHostIntegratedStandaloneScoreEditorController,
  type AudioHostIntegratedStandaloneScoreEditorController
} from './audio-host-integrated.js';
import {
  EDITOR_KEYBOARD_INTENT_VERSION,
  dispatchEditorKeyboardIntent,
  type EditorKeyboardIntent,
  type EditorKeyboardIntentSink
} from '../../editor-keyboard-intents-v1/src/index.js';
import {
  DEFAULT_EDITOR_KEYBOARD_BINDINGS_V1,
  createEditorKeyboardBrowserAdapterV1,
  type EditorKeyboardBindingV1
} from '../../editor-keyboard-browser-v1/src/index.js';

export const KEYBOARD_WORKSTATION_VERSION = '1.0.0' as const;

export const keyboardWorkstationBrowserAppProfile = Object.freeze({
  ...audioHostIntegratedBrowserAppProfile,
  keyboardWorkstationBundled: true,
  keyboardWorkstationVersion: KEYBOARD_WORKSTATION_VERSION,
  keyboardIntentVersion: EDITOR_KEYBOARD_INTENT_VERSION,
  keyboardWorkstationCanonicalAuthority: false,
  keyboardWorkstationHistoryAuthority: false,
  keyboardWorkstationRendererAuthority: false,
  keyboardWorkstationCursorAuthority: false,
  keyboardWorkstationMutationRouting: 'existing-controller-session-authorities' as const,
  keyboardWorkstationFocusPolicy: 'editable-targets-ignored' as const,
  keyboardWorkstationViewportConflictPolicy: 'default-bindings-avoid-existing-viewport-gestures' as const,
  keyboardWorkstationMobileRequirement: 'progressive-enhancement-only' as const
});

export interface KeyboardWorkstationControllerOptions extends TeacherWorkflowControllerOptions {
  readonly keyboardBindings?: readonly Readonly<EditorKeyboardBindingV1>[];
}

export interface KeyboardWorkstationState {
  readonly version: typeof KEYBOARD_WORKSTATION_VERSION;
  readonly mounted: boolean;
  readonly intentVersion: typeof EDITOR_KEYBOARD_INTENT_VERSION;
  readonly bindingCount: number;
}

export interface KeyboardWorkstationStandaloneScoreEditorController extends Omit<AudioHostIntegratedStandaloneScoreEditorController, 'profile' | 'mount' | 'unmount'> {
  readonly profile: typeof keyboardWorkstationBrowserAppProfile;
  readonly getKeyboardWorkstationState: () => Readonly<KeyboardWorkstationState>;
  readonly dispatchKeyboardIntent: (intent: unknown) => Readonly<EditorKeyboardIntent>;
  readonly mount: (root: HTMLElement) => void;
  readonly unmount: () => void;
}

export const createKeyboardWorkstationStandaloneScoreEditorController = (
  options: KeyboardWorkstationControllerOptions = {}
): Readonly<KeyboardWorkstationStandaloneScoreEditorController> => {
  const base = createAudioHostIntegratedStandaloneScoreEditorController(options);
  const bindings = options.keyboardBindings ?? DEFAULT_EDITOR_KEYBOARD_BINDINGS_V1;

  const sink: EditorKeyboardIntentSink = Object.freeze({
    applyKeypadAction: (action) => {
      const snapshot = base.commitKeypad(action);
      if (snapshot.error !== null) throw Object.assign(new Error(snapshot.error.message), { code: snapshot.error.code });
    },
    setEntryPitch: (step, alter, octave) => {
      const state = base.setEntryPitch(step, alter, octave);
      if (state.status?.error === true) throw Object.assign(new Error(state.status.message), { code: state.status.code });
    },
    setEntryDuration: (duration) => {
      const state = base.setEntryDuration(duration);
      if (state.status?.error === true) throw Object.assign(new Error(state.status.message), { code: state.status.code });
    },
    setActiveVoice: (voice) => {
      const state = base.setActiveVoice(voice);
      if (state.status?.error === true) throw Object.assign(new Error(state.status.message), { code: state.status.code });
    },
    enterNoteAtSelection: () => {
      const state = base.enterNoteAtSelection();
      if (state.status?.error === true) throw Object.assign(new Error(state.status.message), { code: state.status.code });
    },
    navigateMeasure: (direction) => {
      base.navigateMeasure(direction);
    },
    navigateHistory: (direction) => {
      const snapshot = direction === 'UNDO' ? base.undo() : base.redo();
      if (snapshot.error !== null) throw Object.assign(new Error(snapshot.error.message), { code: snapshot.error.code });
    }
  });

  const keyboard = createEditorKeyboardBrowserAdapterV1(sink, bindings);

  const controller: KeyboardWorkstationStandaloneScoreEditorController = {
    ...base,
    profile: keyboardWorkstationBrowserAppProfile,
    getKeyboardWorkstationState: () => Object.freeze({
      version: KEYBOARD_WORKSTATION_VERSION,
      mounted: keyboard.getMounted(),
      intentVersion: EDITOR_KEYBOARD_INTENT_VERSION,
      bindingCount: bindings.length
    }),
    dispatchKeyboardIntent: (intent) => dispatchEditorKeyboardIntent(intent, sink),
    mount: (root) => {
      base.mount(root);
      keyboard.mount(root);
    },
    unmount: () => {
      keyboard.unmount();
      base.unmount();
    }
  };

  return Object.freeze(controller);
};

export const createKeyboardWorkstationStandaloneBrowserAppRuntime = () => {
  const base = createAudioHostIntegratedStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: keyboardWorkstationBrowserAppProfile,
    createController: createKeyboardWorkstationStandaloneScoreEditorController,
    keyboardWorkstation: Object.freeze({
      version: KEYBOARD_WORKSTATION_VERSION,
      bundled: true,
      intentVersion: EDITOR_KEYBOARD_INTENT_VERSION,
      canonicalAuthority: false,
      historyAuthority: false,
      rendererAuthority: false,
      cursorAuthority: false,
      mutationRouting: 'existing-controller-session-authorities',
      focusPolicy: 'editable-targets-ignored',
      viewportConflictPolicy: 'default-bindings-avoid-existing-viewport-gestures',
      mobileRequirement: 'progressive-enhancement-only',
      defaultBindingCount: DEFAULT_EDITOR_KEYBOARD_BINDINGS_V1.length
    })
  });
};
