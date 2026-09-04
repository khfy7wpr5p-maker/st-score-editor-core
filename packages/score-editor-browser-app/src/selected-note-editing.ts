import type { ScoreEvent } from '../../score-model/src/index.js';
import {
  addressEntityV3,
  resolveSemanticAddressV3,
  type EventAddressV3,
  type NoteAddressV3
} from '../../addressing-v3/src/index.js';
import {
  authoringWorkspaceBrowserAppProfile,
  createAuthoringWorkspaceStandaloneBrowserAppRuntime,
  createAuthoringWorkspaceStandaloneScoreEditorController,
  type AuthoringWorkspaceStandaloneScoreEditorController
} from './authoring-workspace.js';
import type { ReleaseHardeningControllerOptions } from './release-hardened.js';

export const SELECTED_NOTE_EDITING_VERSION = '1.0.0' as const;

export const selectedNoteEditingBrowserAppProfile = Object.freeze({
  ...authoringWorkspaceBrowserAppProfile,
  selectedNoteEditingBundled: true,
  selectedNoteEditingCanonicalAuthority: false,
  selectedPitchEdit: 'exact-note-selection-only' as const,
  selectedDurationEdit: 'exact-pitched-event-only' as const,
  selectedDelete: 'single-note-to-rest-or-exact-chord-tone' as const,
  selectedEditingHistory: 'EditorSessionV4' as const,
  selectedEditingRendererCoordinateAuthority: false,
  selectedEditingNetworkAuthority: false
});

export type SelectedNoteEditingErrorCode =
  | 'NO_DOCUMENT'
  | 'NOTE_SELECTION_REQUIRED'
  | 'PITCHED_EVENT_SELECTION_REQUIRED'
  | 'ID_UNAVAILABLE';

export class SelectedNoteEditingError extends Error {
  readonly code: SelectedNoteEditingErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: SelectedNoteEditingErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'SelectedNoteEditingError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

interface EditableSelection {
  readonly eventAddress: EventAddressV3;
  readonly noteAddress: NoteAddressV3 | null;
  readonly event: ScoreEvent;
}

export interface SelectedNoteEditingState {
  readonly version: typeof SELECTED_NOTE_EDITING_VERSION;
  readonly canApplyPitch: boolean;
  readonly canApplyDuration: boolean;
  readonly canDelete: boolean;
  readonly selectedEventKind: ScoreEvent['kind'] | null;
  readonly deleteScope: 'NOTE_EVENT' | 'CHORD_TONE' | 'PITCHED_EVENT' | null;
}

const freshRevisionId = (): string => {
  const cryptoValue = globalThis.crypto as Crypto | undefined;
  if (cryptoValue === undefined || typeof cryptoValue.randomUUID !== 'function') {
    throw new SelectedNoteEditingError('Browser randomUUID support is required for selected-note editing.', 'ID_UNAVAILABLE');
  }
  return `rev:${cryptoValue.randomUUID()}`;
};

const throwSnapshotError = (snapshot: ReturnType<AuthoringWorkspaceStandaloneScoreEditorController['commitBasic']>): void => {
  if (snapshot.error !== null) throw Object.assign(new Error(snapshot.error.message), { code: snapshot.error.code });
};

export interface SelectedNoteEditingStandaloneScoreEditorController extends Omit<AuthoringWorkspaceStandaloneScoreEditorController, 'profile' | 'mount' | 'unmount'> {
  readonly profile: typeof selectedNoteEditingBrowserAppProfile;
  readonly getSelectedNoteEditingState: () => Readonly<SelectedNoteEditingState>;
  readonly applyPalettePitchToSelection: () => Readonly<SelectedNoteEditingState>;
  readonly applyPaletteDurationToSelection: () => Readonly<SelectedNoteEditingState>;
  readonly deleteSelectedPitchedContent: () => Readonly<SelectedNoteEditingState>;
  readonly mount: (root: HTMLElement) => void;
  readonly unmount: () => void;
}

export const createSelectedNoteEditingStandaloneScoreEditorController = (
  options: ReleaseHardeningControllerOptions = {}
): Readonly<SelectedNoteEditingStandaloneScoreEditorController> => {
  const base = createAuthoringWorkspaceStandaloneScoreEditorController(options);
  let root: HTMLElement | null = null;

  const editableSelection = (): Readonly<EditableSelection> | null => {
    const document = base.getDocument();
    if (document === null) return null;
    const score = document.session.history.present.score;
    const selection = document.session.selection;
    if (selection === null || (selection.kind !== 'event' && selection.kind !== 'note')) return null;

    let eventAddress: EventAddressV3;
    let noteAddress: NoteAddressV3 | null = null;
    if (selection.kind === 'note') {
      noteAddress = selection;
      const address = addressEntityV3(score, selection.eventId);
      if (address.kind !== 'event') return null;
      eventAddress = address;
    } else {
      eventAddress = selection;
    }

    const resolved = resolveSemanticAddressV3(score, eventAddress);
    if (resolved.kind !== 'event') return null;
    if (selection.kind === 'event' && resolved.value.kind === 'note') {
      const address = addressEntityV3(score, resolved.value.note.id);
      noteAddress = address.kind === 'note' ? address : null;
    }
    return Object.freeze({ eventAddress, noteAddress, event: resolved.value });
  };

  const state = (): Readonly<SelectedNoteEditingState> => {
    const context = editableSelection();
    const pitched = context !== null && context.event.kind !== 'rest';
    const chordTone = pitched && context?.event.kind === 'chord' && context.noteAddress !== null;
    return Object.freeze({
      version: SELECTED_NOTE_EDITING_VERSION,
      canApplyPitch: pitched && context?.noteAddress !== null,
      canApplyDuration: pitched,
      canDelete: pitched,
      selectedEventKind: context?.event.kind ?? null,
      deleteScope: !pitched ? null : chordTone ? 'CHORD_TONE' : context?.event.kind === 'note' ? 'NOTE_EVENT' : 'PITCHED_EVENT'
    });
  };

  const requireDocument = () => {
    const document = base.getDocument();
    if (document === null) throw new SelectedNoteEditingError('Create or open a score first.', 'NO_DOCUMENT');
    return document;
  };

  const requirePitched = (): Readonly<EditableSelection> => {
    requireDocument();
    const context = editableSelection();
    if (context === null || context.event.kind === 'rest') {
      throw new SelectedNoteEditingError('Select a pitched note or chord event first.', 'PITCHED_EVENT_SELECTION_REQUIRED');
    }
    return context;
  };

  const requireExactNote = (): Readonly<EditableSelection & { readonly noteAddress: NoteAddressV3 }> => {
    const context = requirePitched();
    if (context.noteAddress === null) {
      throw new SelectedNoteEditingError('Select one exact note or chord tone first.', 'NOTE_SELECTION_REQUIRED');
    }
    return context as Readonly<EditableSelection & { readonly noteAddress: NoteAddressV3 }>;
  };

  const decorate = (): void => {
    if (root === null) return;
    const palette = root.querySelector<HTMLElement>('[data-st-authoring-palette]');
    if (palette === null || palette.querySelector('[data-st-selected-note-editing]') !== null) return;
    const owner = palette.ownerDocument;
    const group = owner.createElement('div');
    group.className = 'stse-authoring-group';
    group.setAttribute('data-st-selected-note-editing', SELECTED_NOTE_EDITING_VERSION);
    group.setAttribute('aria-label', 'Selected note editing');
    const current = state();

    const button = (label: string, ariaLabel: string, disabled: boolean, action: () => void): HTMLButtonElement => {
      const element = owner.createElement('button');
      element.type = 'button';
      element.textContent = label;
      element.setAttribute('aria-label', ariaLabel);
      element.disabled = disabled;
      element.addEventListener('click', action);
      return element;
    };

    group.append(
      button('Pitch', 'Apply palette pitch to selected note', !current.canApplyPitch, () => { controller.applyPalettePitchToSelection(); }),
      button('Dur', 'Apply palette duration to selected pitched event', !current.canApplyDuration, () => { controller.applyPaletteDurationToSelection(); }),
      button('Del', 'Delete selected pitched content', !current.canDelete, () => { controller.deleteSelectedPitchedContent(); })
    );
    palette.append(group);
  };

  base.subscribe(() => { decorate(); });

  const controller: SelectedNoteEditingStandaloneScoreEditorController = {
    ...base,
    profile: selectedNoteEditingBrowserAppProfile,
    getSelectedNoteEditingState: state,
    applyPalettePitchToSelection: () => {
      const context = requireExactNote();
      const pitch = base.getAuthoringState().pitch;
      const result = base.commitBasic({
        version: '1.0.0',
        type: 'SET_NOTE_PITCH',
        target: context.noteAddress,
        pitch
      }, { nextRevisionId: freshRevisionId() });
      throwSnapshotError(result);
      decorate();
      return state();
    },
    applyPaletteDurationToSelection: () => {
      const context = requirePitched();
      const duration = base.getAuthoringState().duration;
      const result = base.commitBasic({
        version: '1.0.0',
        type: 'SET_EVENT_DURATION',
        target: context.eventAddress,
        duration
      }, { nextRevisionId: freshRevisionId() });
      throwSnapshotError(result);
      decorate();
      return state();
    },
    deleteSelectedPitchedContent: () => {
      const context = requirePitched();
      const intent = context.event.kind === 'chord' && context.noteAddress !== null
        ? Object.freeze({ version: '1.0.0' as const, type: 'REMOVE_CHORD_TONE' as const, target: context.noteAddress })
        : Object.freeze({ version: '1.0.0' as const, type: 'REPLACE_PITCHED_EVENT_WITH_REST' as const, target: context.eventAddress });
      const result = base.commitBasic(intent, { nextRevisionId: freshRevisionId() });
      throwSnapshotError(result);
      decorate();
      return state();
    },
    mount: (nextRoot) => { root = nextRoot; base.mount(nextRoot); decorate(); },
    unmount: () => { root = null; base.unmount(); }
  };

  return Object.freeze(controller);
};

export const createSelectedNoteEditingStandaloneBrowserAppRuntime = () => {
  const base = createAuthoringWorkspaceStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: selectedNoteEditingBrowserAppProfile,
    createController: createSelectedNoteEditingStandaloneScoreEditorController,
    selectedNoteEditing: Object.freeze({
      version: SELECTED_NOTE_EDITING_VERSION,
      bundled: true,
      canonicalAuthority: false,
      pitchEdit: 'exact-note-selection-only',
      durationEdit: 'exact-pitched-event-only',
      delete: 'single-note-to-rest-or-exact-chord-tone',
      history: 'EditorSessionV4',
      rendererCoordinateAuthority: false,
      networkAuthority: false
    })
  });
};
