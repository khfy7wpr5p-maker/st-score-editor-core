import type { ScoreEvent } from '../../score-model/src/index.js';
import {
  addressEntityV3,
  resolveSemanticAddressV3,
  type EventAddressV3
} from '../../addressing-v3/src/index.js';
import type { ArticulationKind, ArticulationSpec } from '../../notation-structure-v2/src/index.js';
import {
  chordToneAuthoringBrowserAppProfile,
  createChordToneAuthoringStandaloneBrowserAppRuntime,
  createChordToneAuthoringStandaloneScoreEditorController,
  type ChordToneAuthoringStandaloneScoreEditorController
} from './chord-tone-authoring.js';
import type { ReleaseHardeningControllerOptions } from './release-hardened.js';

export const ARTICULATION_TOGGLES_VERSION = '1.0.0' as const;
export const BOUNDED_ARTICULATION_KINDS = Object.freeze(['staccato', 'accent', 'tenuto'] as const);
export type BoundedArticulationKind = typeof BOUNDED_ARTICULATION_KINDS[number];

export const articulationTogglesBrowserAppProfile = Object.freeze({
  ...chordToneAuthoringBrowserAppProfile,
  articulationTogglesBundled: true,
  articulationTogglesCanonicalAuthority: false,
  articulationToggleKinds: BOUNDED_ARTICULATION_KINDS,
  articulationToggleTarget: 'exact-selected-pitched-event-or-note-parent-event' as const,
  articulationNewSpec: 'auto-placement-null-direction' as const,
  articulationExistingKindRemoval: 'single-exact-existing-spec-only' as const,
  articulationAmbiguousKindFailClosed: true,
  articulationToggleHistory: 'EditorSessionV4' as const,
  articulationRendererCoordinateAuthority: false,
  articulationNetworkAuthority: false
});

export interface ArticulationTogglesState {
  readonly version: typeof ARTICULATION_TOGGLES_VERSION;
  readonly canToggleArticulation: boolean;
  readonly selectedEventKind: ScoreEvent['kind'] | null;
  readonly activeKinds: readonly BoundedArticulationKind[];
  readonly ambiguousKinds: readonly BoundedArticulationKind[];
}

export type ArticulationTogglesErrorCode =
  | 'NO_DOCUMENT'
  | 'PITCHED_EVENT_SELECTION_REQUIRED'
  | 'UNSUPPORTED_ARTICULATION_KIND'
  | 'ARTICULATION_KIND_AMBIGUOUS'
  | 'ID_UNAVAILABLE';

export class ArticulationTogglesError extends Error {
  readonly code: ArticulationTogglesErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: ArticulationTogglesErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ArticulationTogglesError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

interface ArticulationContext {
  readonly eventAddress: EventAddressV3;
  readonly event: ScoreEvent;
  readonly articulations: readonly ArticulationSpec[];
}

const freshRevisionId = (): string => {
  const cryptoValue = globalThis.crypto as Crypto | undefined;
  if (cryptoValue === undefined || typeof cryptoValue.randomUUID !== 'function') {
    throw new ArticulationTogglesError('Browser randomUUID support is required for articulation revisions.', 'ID_UNAVAILABLE');
  }
  return `rev:${cryptoValue.randomUUID()}`;
};

const boundedKind = (value: string): BoundedArticulationKind => {
  if (!(BOUNDED_ARTICULATION_KINDS as readonly string[]).includes(value)) {
    throw new ArticulationTogglesError('Articulation kind is outside the bounded browser profile.', 'UNSUPPORTED_ARTICULATION_KIND', { kind: value });
  }
  return value as BoundedArticulationKind;
};

const defaultSpec = (kind: BoundedArticulationKind): Readonly<ArticulationSpec> => Object.freeze({
  kind: kind as ArticulationKind,
  placement: 'auto',
  direction: null
});

export interface ArticulationTogglesStandaloneScoreEditorController extends Omit<ChordToneAuthoringStandaloneScoreEditorController, 'profile' | 'mount' | 'unmount'> {
  readonly profile: typeof articulationTogglesBrowserAppProfile;
  readonly getArticulationTogglesState: () => Readonly<ArticulationTogglesState>;
  readonly toggleSelectedArticulation: (kind: string) => Readonly<ArticulationTogglesState>;
  readonly mount: (root: HTMLElement) => void;
  readonly unmount: () => void;
}

export const createArticulationTogglesStandaloneScoreEditorController = (
  options: ReleaseHardeningControllerOptions = {}
): Readonly<ArticulationTogglesStandaloneScoreEditorController> => {
  const base = createChordToneAuthoringStandaloneScoreEditorController(options);
  let root: HTMLElement | null = null;

  const context = (): Readonly<ArticulationContext> | null => {
    const documentValue = base.getDocument();
    if (documentValue === null) return null;
    const pair = documentValue.session.history.present;
    const selection = documentValue.session.selection;
    if (selection === null || (selection.kind !== 'event' && selection.kind !== 'note')) return null;
    const eventAddress = selection.kind === 'event' ? selection : addressEntityV3(pair.score, selection.eventId);
    if (eventAddress.kind !== 'event') return null;
    const resolved = resolveSemanticAddressV3(pair.score, eventAddress);
    if (resolved.kind !== 'event') return null;
    const notation = pair.notation.events.find(entry => entry.target.eventId === resolved.value.id)?.notation;
    return Object.freeze({
      eventAddress,
      event: resolved.value,
      articulations: Object.freeze([...(notation?.articulations ?? [])])
    });
  };

  const state = (): Readonly<ArticulationTogglesState> => {
    const current = context();
    const pitched = current !== null && current.event.kind !== 'rest';
    const activeKinds: BoundedArticulationKind[] = [];
    const ambiguousKinds: BoundedArticulationKind[] = [];
    if (pitched && current !== null) {
      for (const kind of BOUNDED_ARTICULATION_KINDS) {
        const matches = current.articulations.filter(item => item.kind === kind);
        if (matches.length === 1) activeKinds.push(kind);
        else if (matches.length > 1) ambiguousKinds.push(kind);
      }
    }
    return Object.freeze({
      version: ARTICULATION_TOGGLES_VERSION,
      canToggleArticulation: pitched,
      selectedEventKind: current?.event.kind ?? null,
      activeKinds: Object.freeze(activeKinds),
      ambiguousKinds: Object.freeze(ambiguousKinds)
    });
  };

  const requirePitched = (): Readonly<ArticulationContext> => {
    const documentValue = base.getDocument();
    if (documentValue === null) throw new ArticulationTogglesError('Create or open a score first.', 'NO_DOCUMENT');
    const current = context();
    if (current === null || current.event.kind === 'rest') {
      throw new ArticulationTogglesError('Select a pitched note or chord event before toggling an articulation.', 'PITCHED_EVENT_SELECTION_REQUIRED');
    }
    return current;
  };

  const decorate = (): void => {
    if (root === null) return;
    const palette = root.querySelector<HTMLElement>('[data-st-authoring-palette]');
    if (palette === null) return;
    palette.querySelector('[data-st-articulation-toggles]')?.remove();
    const owner = palette.ownerDocument;
    const current = state();
    const group = owner.createElement('div');
    group.className = 'stse-authoring-group';
    group.setAttribute('data-st-articulation-toggles', ARTICULATION_TOGGLES_VERSION);
    group.setAttribute('aria-label', 'Articulations');

    const descriptors: readonly Readonly<{ kind: BoundedArticulationKind; label: string; ariaLabel: string }>[] = Object.freeze([
      Object.freeze({ kind: 'staccato', label: 'Stac', ariaLabel: 'Toggle staccato on selected pitched event' }),
      Object.freeze({ kind: 'accent', label: 'Acc', ariaLabel: 'Toggle accent on selected pitched event' }),
      Object.freeze({ kind: 'tenuto', label: 'Ten', ariaLabel: 'Toggle tenuto on selected pitched event' })
    ]);
    for (const descriptor of descriptors) {
      const button = owner.createElement('button');
      button.type = 'button';
      button.textContent = descriptor.label;
      button.setAttribute('aria-label', descriptor.ariaLabel);
      button.setAttribute('aria-pressed', current.activeKinds.includes(descriptor.kind) ? 'true' : 'false');
      button.disabled = !current.canToggleArticulation || current.ambiguousKinds.includes(descriptor.kind);
      button.addEventListener('click', () => { controller.toggleSelectedArticulation(descriptor.kind); });
      group.append(button);
    }
    palette.append(group);
  };

  base.subscribe(() => { decorate(); });

  const controller: ArticulationTogglesStandaloneScoreEditorController = {
    ...base,
    profile: articulationTogglesBrowserAppProfile,
    getArticulationTogglesState: state,
    toggleSelectedArticulation: (rawKind) => {
      const kind = boundedKind(rawKind);
      const current = requirePitched();
      const matches = current.articulations.filter(item => item.kind === kind);
      if (matches.length > 1) {
        throw new ArticulationTogglesError('Multiple exact articulation specs of this kind are present; browser toggle will not guess which one to remove.', 'ARTICULATION_KIND_AMBIGUOUS', { kind, count: matches.length });
      }
      const intent = matches.length === 1
        ? Object.freeze({ version: '1.0.0' as const, type: 'REMOVE_ARTICULATION' as const, target: current.eventAddress, value: matches[0]! })
        : Object.freeze({ version: '1.0.0' as const, type: 'TOGGLE_ARTICULATION' as const, target: current.eventAddress, value: defaultSpec(kind) });
      const result = base.commitArticulation(intent, { nextRevisionId: freshRevisionId() });
      if (result.error !== null) throw Object.assign(new Error(result.error.message), { code: result.error.code });
      decorate();
      return state();
    },
    mount: (nextRoot) => { root = nextRoot; base.mount(nextRoot); decorate(); },
    unmount: () => { root = null; base.unmount(); }
  };

  return Object.freeze(controller);
};

export const createArticulationTogglesStandaloneBrowserAppRuntime = () => {
  const base = createChordToneAuthoringStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: articulationTogglesBrowserAppProfile,
    createController: createArticulationTogglesStandaloneScoreEditorController,
    articulationToggles: Object.freeze({
      version: ARTICULATION_TOGGLES_VERSION,
      bundled: true,
      canonicalAuthority: false,
      kinds: BOUNDED_ARTICULATION_KINDS,
      target: 'exact-selected-pitched-event-or-note-parent-event',
      newSpec: 'auto-placement-null-direction',
      existingKindRemoval: 'single-exact-existing-spec-only',
      ambiguousKindFailClosed: true,
      history: 'EditorSessionV4',
      rendererCoordinateAuthority: false,
      networkAuthority: false
    })
  });
};
