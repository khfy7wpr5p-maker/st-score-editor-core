import type { ScoreEvent } from '../../score-model/src/index.js';
import {
  addressEntityV3,
  resolveSemanticAddressV3,
  type EventAddressV3
} from '../../addressing-v3/src/index.js';
import {
  createMeasureNavigationStandaloneBrowserAppRuntime,
  createMeasureNavigationStandaloneScoreEditorController,
  measureNavigationBrowserAppProfile,
  type MeasureNavigationStandaloneScoreEditorController
} from './measure-navigation.js';
import type { ReleaseHardeningControllerOptions } from './release-hardened.js';

export const CHORD_TONE_AUTHORING_VERSION = '1.0.0' as const;

export const chordToneAuthoringBrowserAppProfile = Object.freeze({
  ...measureNavigationBrowserAppProfile,
  chordToneAuthoringBundled: true,
  chordToneAuthoringCanonicalAuthority: false,
  chordToneAdd: 'exact-pitched-event-palette-pitch-one-tone-per-action' as const,
  chordToneSelectionAfterAdd: 'new-exact-note' as const,
  chordToneHistory: 'EditorSessionV4' as const,
  chordToneRendererCoordinateAuthority: false,
  chordToneNetworkAuthority: false
});

export interface ChordToneAuthoringState {
  readonly version: typeof CHORD_TONE_AUTHORING_VERSION;
  readonly canAddChordTone: boolean;
  readonly selectedEventKind: ScoreEvent['kind'] | null;
  readonly selectedToneCount: number | null;
}

export type ChordToneAuthoringErrorCode =
  | 'NO_DOCUMENT'
  | 'PITCHED_EVENT_SELECTION_REQUIRED'
  | 'ID_UNAVAILABLE';

export class ChordToneAuthoringError extends Error {
  readonly code: ChordToneAuthoringErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: ChordToneAuthoringErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ChordToneAuthoringError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

interface ChordToneContext {
  readonly eventAddress: EventAddressV3;
  readonly event: ScoreEvent;
}

const freshId = (prefix: string): string => {
  const cryptoValue = globalThis.crypto as Crypto | undefined;
  if (cryptoValue === undefined || typeof cryptoValue.randomUUID !== 'function') {
    throw new ChordToneAuthoringError('Browser randomUUID support is required for chord-tone authoring identities.', 'ID_UNAVAILABLE');
  }
  return `${prefix}:${cryptoValue.randomUUID()}`;
};

export interface ChordToneAuthoringStandaloneScoreEditorController extends Omit<MeasureNavigationStandaloneScoreEditorController, 'profile' | 'mount' | 'unmount'> {
  readonly profile: typeof chordToneAuthoringBrowserAppProfile;
  readonly getChordToneAuthoringState: () => Readonly<ChordToneAuthoringState>;
  readonly addPalettePitchAsChordTone: () => Readonly<ChordToneAuthoringState>;
  readonly mount: (root: HTMLElement) => void;
  readonly unmount: () => void;
}

export const createChordToneAuthoringStandaloneScoreEditorController = (
  options: ReleaseHardeningControllerOptions = {}
): Readonly<ChordToneAuthoringStandaloneScoreEditorController> => {
  const base = createMeasureNavigationStandaloneScoreEditorController(options);
  let root: HTMLElement | null = null;

  const context = (): Readonly<ChordToneContext> | null => {
    const documentValue = base.getDocument();
    if (documentValue === null) return null;
    const score = documentValue.session.history.present.score;
    const selection = documentValue.session.selection;
    if (selection === null || (selection.kind !== 'event' && selection.kind !== 'note')) return null;
    const eventAddress = selection.kind === 'event' ? selection : addressEntityV3(score, selection.eventId);
    if (eventAddress.kind !== 'event') return null;
    const resolved = resolveSemanticAddressV3(score, eventAddress);
    if (resolved.kind !== 'event') return null;
    return Object.freeze({ eventAddress, event: resolved.value });
  };

  const state = (): Readonly<ChordToneAuthoringState> => {
    const current = context();
    const pitched = current !== null && current.event.kind !== 'rest';
    const toneCount = !pitched ? null : current.event.kind === 'note' ? 1 : current.event.notes.length;
    return Object.freeze({
      version: CHORD_TONE_AUTHORING_VERSION,
      canAddChordTone: pitched,
      selectedEventKind: current?.event.kind ?? null,
      selectedToneCount: toneCount
    });
  };

  const requirePitched = (): Readonly<ChordToneContext> => {
    const documentValue = base.getDocument();
    if (documentValue === null) throw new ChordToneAuthoringError('Create or open a score first.', 'NO_DOCUMENT');
    const current = context();
    if (current === null || current.event.kind === 'rest') {
      throw new ChordToneAuthoringError('Select a pitched note or chord event before adding a chord tone.', 'PITCHED_EVENT_SELECTION_REQUIRED');
    }
    return current;
  };

  const decorate = (): void => {
    if (root === null) return;
    const palette = root.querySelector<HTMLElement>('[data-st-authoring-palette]');
    if (palette === null) return;
    palette.querySelector('[data-st-chord-tone-authoring]')?.remove();
    const owner = palette.ownerDocument;
    const current = state();
    const group = owner.createElement('div');
    group.className = 'stse-authoring-group';
    group.setAttribute('data-st-chord-tone-authoring', CHORD_TONE_AUTHORING_VERSION);
    group.setAttribute('aria-label', 'Chord');
    const button = owner.createElement('button');
    button.type = 'button';
    button.textContent = '+Tone';
    button.setAttribute('aria-label', 'Add palette pitch as chord tone to selected pitched event');
    button.disabled = !current.canAddChordTone;
    button.addEventListener('click', () => { controller.addPalettePitchAsChordTone(); });
    group.append(button);
    palette.append(group);
  };

  base.subscribe(() => { decorate(); });

  const controller: ChordToneAuthoringStandaloneScoreEditorController = {
    ...base,
    profile: chordToneAuthoringBrowserAppProfile,
    getChordToneAuthoringState: state,
    addPalettePitchAsChordTone: () => {
      const current = requirePitched();
      const result = base.commitBasic({
        version: '1.0.0',
        type: 'ADD_CHORD_TONE',
        target: current.eventAddress,
        noteId: freshId('note'),
        pitch: base.getAuthoringState().pitch
      }, { nextRevisionId: freshId('rev') });
      if (result.error !== null) throw Object.assign(new Error(result.error.message), { code: result.error.code });
      decorate();
      return state();
    },
    mount: (nextRoot) => { root = nextRoot; base.mount(nextRoot); decorate(); },
    unmount: () => { root = null; base.unmount(); }
  };

  return Object.freeze(controller);
};

export const createChordToneAuthoringStandaloneBrowserAppRuntime = () => {
  const base = createMeasureNavigationStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: chordToneAuthoringBrowserAppProfile,
    createController: createChordToneAuthoringStandaloneScoreEditorController,
    chordToneAuthoring: Object.freeze({
      version: CHORD_TONE_AUTHORING_VERSION,
      bundled: true,
      canonicalAuthority: false,
      add: 'exact-pitched-event-palette-pitch-one-tone-per-action',
      selectionAfterAdd: 'new-exact-note',
      history: 'EditorSessionV4',
      rendererCoordinateAuthority: false,
      networkAuthority: false
    })
  });
};
