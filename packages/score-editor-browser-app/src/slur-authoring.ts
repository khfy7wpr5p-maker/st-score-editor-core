import {
  type NoteAddressV3,
  type SemanticAddressV3
} from '../../addressing-v3/src/index.js';
import {
  createNotePairSemanticSelectionV4,
  toEditorKeypadNotePairTargetV4
} from '../../editor-semantic-selection-v4/src/index.js';
import {
  tieAuthoringBrowserAppProfile,
  createTieAuthoringStandaloneBrowserAppRuntime,
  createTieAuthoringStandaloneScoreEditorController,
  type TieAuthoringStandaloneScoreEditorController
} from './tie-authoring.js';
import type { ReleaseHardeningControllerOptions } from './release-hardened.js';

export const SLUR_AUTHORING_VERSION = '1.0.0' as const;

export const slurAuthoringBrowserAppProfile = Object.freeze({
  ...tieAuthoringBrowserAppProfile,
  slurAuthoringBundled: true,
  slurAuthoringCanonicalAuthority: false,
  slurAuthoringSelection: 'explicit-revision-bound-forward-exact-note-pair' as const,
  slurAuthoringSelectionModel: 'editor-semantic-selection-v4' as const,
  slurAuthoringCaptureHistoryMutationAuthority: false,
  slurAuthoringMutation: 'existing-editor-keypad-slur.edit' as const,
  slurAuthoringSamePitchRequired: false,
  slurAuthoringConsecutiveEventsRequired: false,
  slurAuthoringHistory: 'EditorSessionV4' as const,
  slurAuthoringRendererCoordinateAuthority: false,
  slurAuthoringNetworkAuthority: false
});

export interface SlurAuthoringState {
  readonly version: typeof SLUR_AUTHORING_VERSION;
  readonly pendingStartNoteId: string | null;
  readonly pendingStartRevisionId: string | null;
  readonly selectedNoteId: string | null;
  readonly canCaptureSlurStart: boolean;
  readonly canApplySlur: boolean;
}

export type SlurAuthoringErrorCode =
  | 'NO_DOCUMENT'
  | 'NOTE_SELECTION_REQUIRED'
  | 'SLUR_START_REQUIRED'
  | 'ID_UNAVAILABLE';

export class SlurAuthoringError extends Error {
  readonly code: SlurAuthoringErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, code: SlurAuthoringErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'SlurAuthoringError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const freshRevisionId = (): string => {
  const cryptoValue = globalThis.crypto as Crypto | undefined;
  if (cryptoValue === undefined || typeof cryptoValue.randomUUID !== 'function') {
    throw new SlurAuthoringError('Browser randomUUID support is required for slur revisions.', 'ID_UNAVAILABLE');
  }
  return `rev:${cryptoValue.randomUUID()}`;
};

const exactNoteSelection = (selection: SemanticAddressV3 | null): NoteAddressV3 | null =>
  selection?.kind === 'note' ? Object.freeze({ ...selection }) : null;

export interface SlurAuthoringStandaloneScoreEditorController extends Omit<TieAuthoringStandaloneScoreEditorController, 'profile' | 'mount' | 'unmount'> {
  readonly profile: typeof slurAuthoringBrowserAppProfile;
  readonly getSlurAuthoringState: () => Readonly<SlurAuthoringState>;
  readonly captureSlurStart: () => Readonly<SlurAuthoringState>;
  readonly cancelSlurAuthoring: () => Readonly<SlurAuthoringState>;
  readonly toggleSlurToSelectedNote: () => Readonly<SlurAuthoringState>;
  readonly mount: (root: HTMLElement) => void;
  readonly unmount: () => void;
}

export const createSlurAuthoringStandaloneScoreEditorController = (
  options: ReleaseHardeningControllerOptions = {}
): Readonly<SlurAuthoringStandaloneScoreEditorController> => {
  const base = createTieAuthoringStandaloneScoreEditorController(options);
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

  const state = (): Readonly<SlurAuthoringState> => {
    normalizePending();
    const documentValue = base.getDocument();
    const selected = exactNoteSelection(documentValue?.session.selection ?? null);
    let canApplySlur = false;
    if (documentValue !== null && pendingStart !== null && selected !== null && selected.noteId !== pendingStart.noteId) {
      try {
        createNotePairSemanticSelectionV4(documentValue.session.history.present.score, pendingStart, selected);
        canApplySlur = true;
      } catch {
        canApplySlur = false;
      }
    }
    return Object.freeze({
      version: SLUR_AUTHORING_VERSION,
      pendingStartNoteId: pendingStart?.noteId ?? null,
      pendingStartRevisionId: pendingStart?.revisionId ?? null,
      selectedNoteId: selected?.noteId ?? null,
      canCaptureSlurStart: selected !== null,
      canApplySlur
    });
  };

  const requireSelectedNote = (): NoteAddressV3 => {
    const documentValue = base.getDocument();
    if (documentValue === null) throw new SlurAuthoringError('Create or open a score first.', 'NO_DOCUMENT');
    const selected = selectedNote();
    if (selected === null) throw new SlurAuthoringError('Select an exact note or chord tone for slur authoring.', 'NOTE_SELECTION_REQUIRED');
    return selected;
  };

  const decorate = (): void => {
    if (root === null) return;
    const palette = root.querySelector<HTMLElement>('[data-st-authoring-palette]');
    if (palette === null) return;
    palette.querySelector('[data-st-slur-authoring]')?.remove();
    const owner = palette.ownerDocument;
    const current = state();
    const group = owner.createElement('div');
    group.className = 'stse-authoring-group';
    group.setAttribute('data-st-slur-authoring', SLUR_AUTHORING_VERSION);
    group.setAttribute('aria-label', 'Slur authoring');

    const startButton = owner.createElement('button');
    startButton.type = 'button';
    startButton.textContent = 'Slur Start';
    startButton.setAttribute('aria-label', 'Capture selected note as slur start');
    startButton.setAttribute('aria-pressed', current.pendingStartNoteId !== null && current.pendingStartNoteId === current.selectedNoteId ? 'true' : 'false');
    startButton.disabled = !current.canCaptureSlurStart;
    startButton.addEventListener('click', () => { controller.captureSlurStart(); });

    const applyButton = owner.createElement('button');
    applyButton.type = 'button';
    applyButton.textContent = 'Slur Apply';
    applyButton.setAttribute('aria-label', 'Toggle slur from captured start to selected note');
    applyButton.disabled = !current.canApplySlur;
    applyButton.title = current.pendingStartNoteId === null
      ? 'Capture a slur start note first.'
      : 'Uses the existing exact NOTE_PAIR slur primitive.';
    applyButton.addEventListener('click', () => { controller.toggleSlurToSelectedNote(); });

    const cancelButton = owner.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = 'Slur Cancel';
    cancelButton.setAttribute('aria-label', 'Cancel pending slur start');
    cancelButton.disabled = current.pendingStartNoteId === null;
    cancelButton.addEventListener('click', () => { controller.cancelSlurAuthoring(); });

    group.append(startButton, applyButton, cancelButton);
    palette.append(group);
  };

  base.subscribe(() => {
    normalizePending();
    decorate();
  });

  const controller: SlurAuthoringStandaloneScoreEditorController = {
    ...base,
    profile: slurAuthoringBrowserAppProfile,
    getSlurAuthoringState: state,
    captureSlurStart: () => {
      const selected = requireSelectedNote();
      pendingStart = Object.freeze({ ...selected });
      decorate();
      return state();
    },
    cancelSlurAuthoring: () => {
      pendingStart = null;
      decorate();
      return state();
    },
    toggleSlurToSelectedNote: () => {
      normalizePending();
      const documentValue = base.getDocument();
      if (documentValue === null) throw new SlurAuthoringError('Create or open a score first.', 'NO_DOCUMENT');
      if (pendingStart === null) throw new SlurAuthoringError('Capture a slur start note first.', 'SLUR_START_REQUIRED');
      const stop = requireSelectedNote();
      const selection = createNotePairSemanticSelectionV4(documentValue.session.history.present.score, pendingStart, stop);
      const target = toEditorKeypadNotePairTargetV4(selection);

      const selectedStop = stop;
      const selectStartResult = base.select(selection.start);
      if (selectStartResult.error !== null) {
        throw Object.assign(new Error(selectStartResult.error.message), { code: selectStartResult.error.code });
      }

      const result = base.commitKeypad(
        Object.freeze({ version: '1.0.0' as const, actionId: 'slur.edit' as const }),
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

export const createSlurAuthoringStandaloneBrowserAppRuntime = () => {
  const base = createTieAuthoringStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: slurAuthoringBrowserAppProfile,
    createController: createSlurAuthoringStandaloneScoreEditorController,
    slurAuthoring: Object.freeze({
      version: SLUR_AUTHORING_VERSION,
      bundled: true,
      canonicalAuthority: false,
      selection: 'explicit-revision-bound-forward-exact-note-pair',
      selectionModel: 'editor-semantic-selection-v4',
      captureHistoryMutationAuthority: false,
      mutation: 'existing-editor-keypad-slur.edit',
      samePitchRequired: false,
      consecutiveEventsRequired: false,
      history: 'EditorSessionV4',
      rendererCoordinateAuthority: false,
      networkAuthority: false
    })
  });
};
