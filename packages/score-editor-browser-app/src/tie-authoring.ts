import {
  type NoteAddressV3,
  type SemanticAddressV3
} from '../../addressing-v3/src/index.js';
import {
  createNotePairSemanticSelectionV4,
  toEditorKeypadNotePairTargetV4
} from '../../editor-semantic-selection-v4/src/index.js';
import {
  extendedLocalOrnamentTogglesBrowserAppProfile,
  createExtendedLocalOrnamentTogglesStandaloneBrowserAppRuntime,
  createExtendedLocalOrnamentTogglesStandaloneScoreEditorController,
  type ExtendedLocalOrnamentTogglesStandaloneScoreEditorController
} from './extended-local-ornament-toggles.js';
import type { ReleaseHardeningControllerOptions } from './release-hardened.js';

export const TIE_AUTHORING_VERSION = '1.0.0' as const;

export const tieAuthoringBrowserAppProfile = Object.freeze({
  ...extendedLocalOrnamentTogglesBrowserAppProfile,
  tieAuthoringBundled: true,
  tieAuthoringCanonicalAuthority: false,
  tieAuthoringSelection: 'explicit-revision-bound-exact-note-pair' as const,
  tieAuthoringSelectionModel: 'editor-semantic-selection-v4' as const,
  tieAuthoringCaptureHistoryMutationAuthority: false,
  tieAuthoringMutation: 'existing-editor-keypad-tie.edit' as const,
  tieAuthoringHistory: 'EditorSessionV4' as const,
  tieAuthoringRendererCoordinateAuthority: false,
  tieAuthoringNetworkAuthority: false
});

export interface TieAuthoringState {
  readonly version: typeof TIE_AUTHORING_VERSION;
  readonly pendingStartNoteId: string | null;
  readonly pendingStartRevisionId: string | null;
  readonly selectedNoteId: string | null;
  readonly canCaptureTieStart: boolean;
  readonly canApplyTie: boolean;
}

export type TieAuthoringErrorCode =
  | 'NO_DOCUMENT'
  | 'NOTE_SELECTION_REQUIRED'
  | 'TIE_START_REQUIRED'
  | 'ID_UNAVAILABLE';

export class TieAuthoringError extends Error {
  readonly code: TieAuthoringErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, code: TieAuthoringErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'TieAuthoringError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const freshRevisionId = (): string => {
  const cryptoValue = globalThis.crypto as Crypto | undefined;
  if (cryptoValue === undefined || typeof cryptoValue.randomUUID !== 'function') {
    throw new TieAuthoringError('Browser randomUUID support is required for tie revisions.', 'ID_UNAVAILABLE');
  }
  return `rev:${cryptoValue.randomUUID()}`;
};

const exactNoteSelection = (selection: SemanticAddressV3 | null): NoteAddressV3 | null =>
  selection?.kind === 'note' ? Object.freeze({ ...selection }) : null;

export interface TieAuthoringStandaloneScoreEditorController extends Omit<ExtendedLocalOrnamentTogglesStandaloneScoreEditorController, 'profile' | 'mount' | 'unmount'> {
  readonly profile: typeof tieAuthoringBrowserAppProfile;
  readonly getTieAuthoringState: () => Readonly<TieAuthoringState>;
  readonly captureTieStart: () => Readonly<TieAuthoringState>;
  readonly cancelTieAuthoring: () => Readonly<TieAuthoringState>;
  readonly toggleTieToSelectedNote: () => Readonly<TieAuthoringState>;
  readonly mount: (root: HTMLElement) => void;
  readonly unmount: () => void;
}

export const createTieAuthoringStandaloneScoreEditorController = (
  options: ReleaseHardeningControllerOptions = {}
): Readonly<TieAuthoringStandaloneScoreEditorController> => {
  const base = createExtendedLocalOrnamentTogglesStandaloneScoreEditorController(options);
  let root: HTMLElement | null = null;
  let pendingStart: NoteAddressV3 | null = null;

  const normalizePending = (): void => {
    if (pendingStart === null) return;
    const documentValue = base.getDocument();
    const revisionId = documentValue?.session.history.present.score.revision.id ?? null;
    if (revisionId !== pendingStart.revisionId || documentValue?.session.history.present.score.id !== pendingStart.documentId) {
      pendingStart = null;
    }
  };

  const selectedNote = (): NoteAddressV3 | null => {
    normalizePending();
    const documentValue = base.getDocument();
    return exactNoteSelection(documentValue?.session.selection ?? null);
  };

  const state = (): Readonly<TieAuthoringState> => {
    normalizePending();
    const documentValue = base.getDocument();
    const selected = exactNoteSelection(documentValue?.session.selection ?? null);
    let canApplyTie = false;
    if (documentValue !== null && pendingStart !== null && selected !== null && selected.noteId !== pendingStart.noteId) {
      try {
        createNotePairSemanticSelectionV4(documentValue.session.history.present.score, pendingStart, selected);
        canApplyTie = true;
      } catch {
        canApplyTie = false;
      }
    }
    return Object.freeze({
      version: TIE_AUTHORING_VERSION,
      pendingStartNoteId: pendingStart?.noteId ?? null,
      pendingStartRevisionId: pendingStart?.revisionId ?? null,
      selectedNoteId: selected?.noteId ?? null,
      canCaptureTieStart: selected !== null,
      canApplyTie
    });
  };

  const requireSelectedNote = (): NoteAddressV3 => {
    const documentValue = base.getDocument();
    if (documentValue === null) throw new TieAuthoringError('Create or open a score first.', 'NO_DOCUMENT');
    const selected = selectedNote();
    if (selected === null) throw new TieAuthoringError('Select an exact note or chord tone for tie authoring.', 'NOTE_SELECTION_REQUIRED');
    return selected;
  };

  const decorate = (): void => {
    if (root === null) return;
    const palette = root.querySelector<HTMLElement>('[data-st-authoring-palette]');
    if (palette === null) return;
    palette.querySelector('[data-st-tie-authoring]')?.remove();
    const owner = palette.ownerDocument;
    const current = state();
    const group = owner.createElement('div');
    group.className = 'stse-authoring-group';
    group.setAttribute('data-st-tie-authoring', TIE_AUTHORING_VERSION);
    group.setAttribute('aria-label', 'Tie authoring');

    const startButton = owner.createElement('button');
    startButton.type = 'button';
    startButton.textContent = 'Tie Start';
    startButton.setAttribute('aria-label', 'Capture selected note as tie start');
    startButton.setAttribute('aria-pressed', current.pendingStartNoteId !== null && current.pendingStartNoteId === current.selectedNoteId ? 'true' : 'false');
    startButton.disabled = !current.canCaptureTieStart;
    startButton.addEventListener('click', () => { controller.captureTieStart(); });

    const applyButton = owner.createElement('button');
    applyButton.type = 'button';
    applyButton.textContent = 'Tie Apply';
    applyButton.setAttribute('aria-label', 'Toggle tie from captured start to selected note');
    applyButton.disabled = !current.canApplyTie;
    applyButton.title = current.pendingStartNoteId === null
      ? 'Capture a tie start note first.'
      : 'Uses the existing exact NOTE_PAIR tie primitive.';
    applyButton.addEventListener('click', () => { controller.toggleTieToSelectedNote(); });

    const cancelButton = owner.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = 'Tie Cancel';
    cancelButton.setAttribute('aria-label', 'Cancel pending tie start');
    cancelButton.disabled = current.pendingStartNoteId === null;
    cancelButton.addEventListener('click', () => { controller.cancelTieAuthoring(); });

    group.append(startButton, applyButton, cancelButton);
    palette.append(group);
  };

  base.subscribe(() => {
    normalizePending();
    decorate();
  });

  const controller: TieAuthoringStandaloneScoreEditorController = {
    ...base,
    profile: tieAuthoringBrowserAppProfile,
    getTieAuthoringState: state,
    captureTieStart: () => {
      const selected = requireSelectedNote();
      pendingStart = Object.freeze({ ...selected });
      decorate();
      return state();
    },
    cancelTieAuthoring: () => {
      pendingStart = null;
      decorate();
      return state();
    },
    toggleTieToSelectedNote: () => {
      normalizePending();
      const documentValue = base.getDocument();
      if (documentValue === null) throw new TieAuthoringError('Create or open a score first.', 'NO_DOCUMENT');
      if (pendingStart === null) throw new TieAuthoringError('Capture a tie start note first.', 'TIE_START_REQUIRED');
      const stop = requireSelectedNote();
      const selection = createNotePairSemanticSelectionV4(documentValue.session.history.present.score, pendingStart, stop);
      const target = toEditorKeypadNotePairTargetV4(selection);

      const selectedStop = stop;
      const selectStartResult = base.select(selection.start);
      if (selectStartResult.error !== null) {
        throw Object.assign(new Error(selectStartResult.error.message), { code: selectStartResult.error.code });
      }

      const result = base.commitKeypad(
        Object.freeze({ version: '1.0.0' as const, actionId: 'tie.edit' as const }),
        target,
        Object.freeze({ nextRevisionId: freshRevisionId() })
      );
      if (result.error !== null) {
        const restoreResult = base.select(selectedStop);
        pendingStart = null;
        decorate();
        if (restoreResult.error !== null) {
          throw Object.assign(new Error(result.error.message), {
            code: result.error.code,
            restoreSelectionError: restoreResult.error.code
          });
        }
        throw Object.assign(new Error(result.error.message), { code: result.error.code });
      }

      pendingStart = null;
      decorate();
      return state();
    },
    mount: (nextRoot) => {
      root = nextRoot;
      base.mount(nextRoot);
      decorate();
    },
    unmount: () => {
      pendingStart = null;
      root = null;
      base.unmount();
    }
  };

  return Object.freeze(controller);
};

export const createTieAuthoringStandaloneBrowserAppRuntime = () => {
  const base = createExtendedLocalOrnamentTogglesStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: tieAuthoringBrowserAppProfile,
    createController: createTieAuthoringStandaloneScoreEditorController,
    tieAuthoring: Object.freeze({
      version: TIE_AUTHORING_VERSION,
      bundled: true,
      canonicalAuthority: false,
      selection: 'explicit-revision-bound-exact-note-pair',
      selectionModel: 'editor-semantic-selection-v4',
      captureHistoryMutationAuthority: false,
      mutation: 'existing-editor-keypad-tie.edit',
      history: 'EditorSessionV4',
      rendererCoordinateAuthority: false,
      networkAuthority: false
    })
  });
};
