import {
  resolveSemanticAddressV3,
  type NoteAddressV3
} from '../../addressing-v3/src/index.js';
import type { Pitch } from '../../score-model/src/index.js';
import {
  localOrnamentTogglesBrowserAppProfile,
  createLocalOrnamentTogglesStandaloneBrowserAppRuntime,
  createLocalOrnamentTogglesStandaloneScoreEditorController,
  type LocalOrnamentTogglesStandaloneScoreEditorController
} from './local-ornament-toggles.js';
import type { ReleaseHardeningControllerOptions } from './release-hardened.js';

export const EXPLICIT_ACCIDENTALS_VERSION = '1.0.0' as const;
export const BOUNDED_EXPLICIT_ACCIDENTALS = Object.freeze(['flat', 'natural', 'sharp'] as const);
export type BoundedExplicitAccidental = typeof BOUNDED_EXPLICIT_ACCIDENTALS[number];

export const explicitAccidentalsBrowserAppProfile = Object.freeze({
  ...localOrnamentTogglesBrowserAppProfile,
  explicitAccidentalsBundled: true,
  explicitAccidentalsCanonicalAuthority: false,
  explicitAccidentalKinds: BOUNDED_EXPLICIT_ACCIDENTALS,
  explicitAccidentalTarget: 'exact-selected-note-only' as const,
  explicitAccidentalMutation: 'canonical-pitch-alter-plus-note-notation-accidental-atomic' as const,
  explicitAccidentalStepOctaveMutationAuthority: false,
  explicitAccidentalAdvancedKeypadTargetAuthority: false,
  explicitAccidentalHistory: 'EditorSessionV4' as const,
  explicitAccidentalRendererCoordinateAuthority: false,
  explicitAccidentalNetworkAuthority: false
});

export interface ExplicitAccidentalsState {
  readonly version: typeof EXPLICIT_ACCIDENTALS_VERSION;
  readonly canSetExplicitAccidental: boolean;
  readonly selectedPitch: Readonly<Pitch> | null;
  readonly explicitAccidental: BoundedExplicitAccidental | null;
}

export type ExplicitAccidentalsErrorCode =
  | 'NO_DOCUMENT'
  | 'EXACT_NOTE_SELECTION_REQUIRED'
  | 'UNSUPPORTED_EXPLICIT_ACCIDENTAL_KIND'
  | 'ID_UNAVAILABLE';

export class ExplicitAccidentalsError extends Error {
  readonly code: ExplicitAccidentalsErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: ExplicitAccidentalsErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ExplicitAccidentalsError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

interface ExplicitAccidentalContext {
  readonly noteAddress: NoteAddressV3;
  readonly pitch: Readonly<Pitch>;
  readonly explicitAccidental: BoundedExplicitAccidental | null;
}

const freshRevisionId = (): string => {
  const cryptoValue = globalThis.crypto as Crypto | undefined;
  if (cryptoValue === undefined || typeof cryptoValue.randomUUID !== 'function') {
    throw new ExplicitAccidentalsError('Browser randomUUID support is required for explicit accidental revisions.', 'ID_UNAVAILABLE');
  }
  return `rev:${cryptoValue.randomUUID()}`;
};

const boundedKind = (value: string): BoundedExplicitAccidental => {
  if (!(BOUNDED_EXPLICIT_ACCIDENTALS as readonly string[]).includes(value)) {
    throw new ExplicitAccidentalsError('Explicit accidental kind is outside the bounded browser profile.', 'UNSUPPORTED_EXPLICIT_ACCIDENTAL_KIND', { kind: value });
  }
  return value as BoundedExplicitAccidental;
};

const actionIdFor = (kind: BoundedExplicitAccidental): `accidental.${BoundedExplicitAccidental}` => `accidental.${kind}`;

export interface ExplicitAccidentalsStandaloneScoreEditorController extends Omit<LocalOrnamentTogglesStandaloneScoreEditorController, 'profile' | 'mount' | 'unmount'> {
  readonly profile: typeof explicitAccidentalsBrowserAppProfile;
  readonly getExplicitAccidentalsState: () => Readonly<ExplicitAccidentalsState>;
  readonly setSelectedExplicitAccidental: (kind: string) => Readonly<ExplicitAccidentalsState>;
  readonly mount: (root: HTMLElement) => void;
  readonly unmount: () => void;
}

export const createExplicitAccidentalsStandaloneScoreEditorController = (
  options: ReleaseHardeningControllerOptions = {}
): Readonly<ExplicitAccidentalsStandaloneScoreEditorController> => {
  const base = createLocalOrnamentTogglesStandaloneScoreEditorController(options);
  let root: HTMLElement | null = null;

  const context = (): Readonly<ExplicitAccidentalContext> | null => {
    const documentValue = base.getDocument();
    if (documentValue === null) return null;
    const pair = documentValue.session.history.present;
    const selection = documentValue.session.selection;
    if (selection === null || selection.kind !== 'note') return null;
    const resolved = resolveSemanticAddressV3(pair.score, selection);
    if (resolved.kind !== 'note') return null;
    const notation = pair.notation.notes.find(entry => entry.target.noteId === resolved.value.id)?.notation;
    const accidental = notation?.accidental;
    const explicitAccidental = accidental === 'flat' || accidental === 'natural' || accidental === 'sharp' ? accidental : null;
    return Object.freeze({
      noteAddress: selection,
      pitch: Object.freeze({ ...resolved.value.pitch }),
      explicitAccidental
    });
  };

  const state = (): Readonly<ExplicitAccidentalsState> => {
    const current = context();
    return Object.freeze({
      version: EXPLICIT_ACCIDENTALS_VERSION,
      canSetExplicitAccidental: current !== null,
      selectedPitch: current?.pitch ?? null,
      explicitAccidental: current?.explicitAccidental ?? null
    });
  };

  const requireExactNote = (): Readonly<ExplicitAccidentalContext> => {
    const documentValue = base.getDocument();
    if (documentValue === null) throw new ExplicitAccidentalsError('Create or open a score first.', 'NO_DOCUMENT');
    const current = context();
    if (current === null) {
      throw new ExplicitAccidentalsError('Select one exact note or chord tone before setting an explicit accidental.', 'EXACT_NOTE_SELECTION_REQUIRED');
    }
    return current;
  };

  const decorate = (): void => {
    if (root === null) return;
    const palette = root.querySelector<HTMLElement>('[data-st-authoring-palette]');
    if (palette === null) return;
    palette.querySelector('[data-st-explicit-accidentals]')?.remove();
    const owner = palette.ownerDocument;
    const current = state();
    const group = owner.createElement('div');
    group.className = 'stse-authoring-group';
    group.setAttribute('data-st-explicit-accidentals', EXPLICIT_ACCIDENTALS_VERSION);
    group.setAttribute('aria-label', 'Explicit accidentals');

    const descriptors: readonly Readonly<{ kind: BoundedExplicitAccidental; label: string; ariaLabel: string }>[] = Object.freeze([
      Object.freeze({ kind: 'flat', label: '♭', ariaLabel: 'Set explicit flat on selected note' }),
      Object.freeze({ kind: 'natural', label: '♮', ariaLabel: 'Set explicit natural on selected note' }),
      Object.freeze({ kind: 'sharp', label: '♯', ariaLabel: 'Set explicit sharp on selected note' })
    ]);
    for (const descriptor of descriptors) {
      const button = owner.createElement('button');
      button.type = 'button';
      button.textContent = descriptor.label;
      button.setAttribute('aria-label', descriptor.ariaLabel);
      button.setAttribute('aria-pressed', current.explicitAccidental === descriptor.kind ? 'true' : 'false');
      button.disabled = !current.canSetExplicitAccidental;
      button.addEventListener('click', () => { controller.setSelectedExplicitAccidental(descriptor.kind); });
      group.append(button);
    }
    palette.append(group);
  };

  base.subscribe(() => { decorate(); });

  const controller: ExplicitAccidentalsStandaloneScoreEditorController = {
    ...base,
    profile: explicitAccidentalsBrowserAppProfile,
    getExplicitAccidentalsState: state,
    setSelectedExplicitAccidental: (rawKind) => {
      const kind = boundedKind(rawKind);
      const before = requireExactNote();
      const result = base.commitKeypad(
        Object.freeze({ version: '1.0.0' as const, actionId: actionIdFor(kind) }),
        null,
        { nextRevisionId: freshRevisionId() }
      );
      if (result.error !== null) throw Object.assign(new Error(result.error.message), { code: result.error.code });
      const after = state();
      if (after.selectedPitch === null || after.selectedPitch.step !== before.pitch.step || after.selectedPitch.octave !== before.pitch.octave) {
        throw new ExplicitAccidentalsError('Explicit accidental action changed note step or octave unexpectedly.', 'EXACT_NOTE_SELECTION_REQUIRED');
      }
      decorate();
      return after;
    },
    mount: (nextRoot) => { root = nextRoot; base.mount(nextRoot); decorate(); },
    unmount: () => { root = null; base.unmount(); }
  };

  return Object.freeze(controller);
};

export const createExplicitAccidentalsStandaloneBrowserAppRuntime = () => {
  const base = createLocalOrnamentTogglesStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: explicitAccidentalsBrowserAppProfile,
    createController: createExplicitAccidentalsStandaloneScoreEditorController,
    explicitAccidentals: Object.freeze({
      version: EXPLICIT_ACCIDENTALS_VERSION,
      bundled: true,
      canonicalAuthority: false,
      kinds: BOUNDED_EXPLICIT_ACCIDENTALS,
      target: 'exact-selected-note-only',
      mutation: 'canonical-pitch-alter-plus-note-notation-accidental-atomic',
      stepOctaveMutationAuthority: false,
      advancedKeypadTargetAuthority: false,
      history: 'EditorSessionV4',
      rendererCoordinateAuthority: false,
      networkAuthority: false
    })
  });
};
