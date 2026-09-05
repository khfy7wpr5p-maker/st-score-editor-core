import type { ScoreEvent } from '../../score-model/src/index.js';
import {
  addressEntityV3,
  resolveSemanticAddressV3,
  type EventAddressV3
} from '../../addressing-v3/src/index.js';
import type { ArticulationKind, ArticulationSpec } from '../../notation-structure-v2/src/index.js';
import {
  explicitAccidentalsBrowserAppProfile,
  createExplicitAccidentalsStandaloneBrowserAppRuntime,
  createExplicitAccidentalsStandaloneScoreEditorController,
  type ExplicitAccidentalsStandaloneScoreEditorController
} from './explicit-accidentals.js';
import type { ReleaseHardeningControllerOptions } from './release-hardened.js';

export const EXTENDED_ARTICULATION_TOGGLES_VERSION = '1.0.0' as const;
export const BOUNDED_EXTENDED_ARTICULATION_KINDS = Object.freeze(['strong-accent', 'staccatissimo', 'spiccato'] as const);
export type BoundedExtendedArticulationKind = typeof BOUNDED_EXTENDED_ARTICULATION_KINDS[number];

export const extendedArticulationTogglesBrowserAppProfile = Object.freeze({
  ...explicitAccidentalsBrowserAppProfile,
  extendedArticulationTogglesBundled: true,
  extendedArticulationTogglesCanonicalAuthority: false,
  extendedArticulationToggleKinds: BOUNDED_EXTENDED_ARTICULATION_KINDS,
  extendedArticulationToggleTarget: 'exact-selected-pitched-event-or-note-parent-event' as const,
  extendedArticulationNewSpec: 'auto-placement-null-direction' as const,
  extendedArticulationExistingKindRemoval: 'single-exact-existing-spec-only' as const,
  extendedArticulationAmbiguousKindFailClosed: true,
  extendedArticulationGraceTargetAuthority: false,
  extendedArticulationToggleHistory: 'EditorSessionV4' as const,
  extendedArticulationRendererCoordinateAuthority: false,
  extendedArticulationNetworkAuthority: false
});

export interface ExtendedArticulationTogglesState {
  readonly version: typeof EXTENDED_ARTICULATION_TOGGLES_VERSION;
  readonly canToggleExtendedArticulation: boolean;
  readonly selectedEventKind: ScoreEvent['kind'] | null;
  readonly activeKinds: readonly BoundedExtendedArticulationKind[];
  readonly ambiguousKinds: readonly BoundedExtendedArticulationKind[];
}

export type ExtendedArticulationTogglesErrorCode =
  | 'NO_DOCUMENT'
  | 'PITCHED_EVENT_SELECTION_REQUIRED'
  | 'UNSUPPORTED_EXTENDED_ARTICULATION_KIND'
  | 'EXTENDED_ARTICULATION_KIND_AMBIGUOUS'
  | 'ID_UNAVAILABLE';

export class ExtendedArticulationTogglesError extends Error {
  readonly code: ExtendedArticulationTogglesErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: ExtendedArticulationTogglesErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ExtendedArticulationTogglesError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

interface ExtendedArticulationContext {
  readonly eventAddress: EventAddressV3;
  readonly event: ScoreEvent;
  readonly articulations: readonly ArticulationSpec[];
}

const freshRevisionId = (): string => {
  const cryptoValue = globalThis.crypto as Crypto | undefined;
  if (cryptoValue === undefined || typeof cryptoValue.randomUUID !== 'function') {
    throw new ExtendedArticulationTogglesError('Browser randomUUID support is required for extended articulation revisions.', 'ID_UNAVAILABLE');
  }
  return `rev:${cryptoValue.randomUUID()}`;
};

const boundedKind = (value: string): BoundedExtendedArticulationKind => {
  if (!(BOUNDED_EXTENDED_ARTICULATION_KINDS as readonly string[]).includes(value)) {
    throw new ExtendedArticulationTogglesError('Extended articulation kind is outside the bounded browser profile.', 'UNSUPPORTED_EXTENDED_ARTICULATION_KIND', { kind: value });
  }
  return value as BoundedExtendedArticulationKind;
};

const defaultSpec = (kind: BoundedExtendedArticulationKind): Readonly<ArticulationSpec> => Object.freeze({
  kind: kind as ArticulationKind,
  placement: 'auto',
  direction: null
});

export interface ExtendedArticulationTogglesStandaloneScoreEditorController extends Omit<ExplicitAccidentalsStandaloneScoreEditorController, 'profile' | 'mount' | 'unmount'> {
  readonly profile: typeof extendedArticulationTogglesBrowserAppProfile;
  readonly getExtendedArticulationTogglesState: () => Readonly<ExtendedArticulationTogglesState>;
  readonly toggleSelectedExtendedArticulation: (kind: string) => Readonly<ExtendedArticulationTogglesState>;
  readonly mount: (root: HTMLElement) => void;
  readonly unmount: () => void;
}

export const createExtendedArticulationTogglesStandaloneScoreEditorController = (
  options: ReleaseHardeningControllerOptions = {}
): Readonly<ExtendedArticulationTogglesStandaloneScoreEditorController> => {
  const base = createExplicitAccidentalsStandaloneScoreEditorController(options);
  let root: HTMLElement | null = null;

  const context = (): Readonly<ExtendedArticulationContext> | null => {
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

  const state = (): Readonly<ExtendedArticulationTogglesState> => {
    const current = context();
    const pitched = current !== null && current.event.kind !== 'rest';
    const activeKinds: BoundedExtendedArticulationKind[] = [];
    const ambiguousKinds: BoundedExtendedArticulationKind[] = [];
    if (pitched && current !== null) {
      for (const kind of BOUNDED_EXTENDED_ARTICULATION_KINDS) {
        const matches = current.articulations.filter(item => item.kind === kind);
        if (matches.length === 1) activeKinds.push(kind);
        else if (matches.length > 1) ambiguousKinds.push(kind);
      }
    }
    return Object.freeze({
      version: EXTENDED_ARTICULATION_TOGGLES_VERSION,
      canToggleExtendedArticulation: pitched,
      selectedEventKind: current?.event.kind ?? null,
      activeKinds: Object.freeze(activeKinds),
      ambiguousKinds: Object.freeze(ambiguousKinds)
    });
  };

  const requirePitched = (): Readonly<ExtendedArticulationContext> => {
    const documentValue = base.getDocument();
    if (documentValue === null) throw new ExtendedArticulationTogglesError('Create or open a score first.', 'NO_DOCUMENT');
    const current = context();
    if (current === null || current.event.kind === 'rest') {
      throw new ExtendedArticulationTogglesError('Select a pitched note or chord event before toggling an extended articulation.', 'PITCHED_EVENT_SELECTION_REQUIRED');
    }
    return current;
  };

  const decorate = (): void => {
    if (root === null) return;
    const palette = root.querySelector<HTMLElement>('[data-st-authoring-palette]');
    if (palette === null) return;
    palette.querySelector('[data-st-extended-articulation-toggles]')?.remove();
    const owner = palette.ownerDocument;
    const current = state();
    const group = owner.createElement('div');
    group.className = 'stse-authoring-group';
    group.setAttribute('data-st-extended-articulation-toggles', EXTENDED_ARTICULATION_TOGGLES_VERSION);
    group.setAttribute('aria-label', 'Extended articulations');

    const descriptors: readonly Readonly<{ kind: BoundedExtendedArticulationKind; label: string; ariaLabel: string }>[] = Object.freeze([
      Object.freeze({ kind: 'strong-accent', label: 'SAcc', ariaLabel: 'Toggle strong accent on selected pitched event' }),
      Object.freeze({ kind: 'staccatissimo', label: 'Staccis', ariaLabel: 'Toggle staccatissimo on selected pitched event' }),
      Object.freeze({ kind: 'spiccato', label: 'Spic', ariaLabel: 'Toggle spiccato on selected pitched event' })
    ]);
    for (const descriptor of descriptors) {
      const button = owner.createElement('button');
      button.type = 'button';
      button.textContent = descriptor.label;
      button.setAttribute('aria-label', descriptor.ariaLabel);
      button.setAttribute('aria-pressed', current.activeKinds.includes(descriptor.kind) ? 'true' : 'false');
      button.disabled = !current.canToggleExtendedArticulation || current.ambiguousKinds.includes(descriptor.kind);
      button.addEventListener('click', () => { controller.toggleSelectedExtendedArticulation(descriptor.kind); });
      group.append(button);
    }
    palette.append(group);
  };

  base.subscribe(() => { decorate(); });

  const controller: ExtendedArticulationTogglesStandaloneScoreEditorController = {
    ...base,
    profile: extendedArticulationTogglesBrowserAppProfile,
    getExtendedArticulationTogglesState: state,
    toggleSelectedExtendedArticulation: (rawKind) => {
      const kind = boundedKind(rawKind);
      const current = requirePitched();
      const matches = current.articulations.filter(item => item.kind === kind);
      if (matches.length > 1) {
        throw new ExtendedArticulationTogglesError('Multiple exact extended articulation specs of this kind are present; browser toggle will not guess which one to remove.', 'EXTENDED_ARTICULATION_KIND_AMBIGUOUS', { kind, count: matches.length });
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

export const createExtendedArticulationTogglesStandaloneBrowserAppRuntime = () => {
  const base = createExplicitAccidentalsStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: extendedArticulationTogglesBrowserAppProfile,
    createController: createExtendedArticulationTogglesStandaloneScoreEditorController,
    extendedArticulationToggles: Object.freeze({
      version: EXTENDED_ARTICULATION_TOGGLES_VERSION,
      bundled: true,
      canonicalAuthority: false,
      kinds: BOUNDED_EXTENDED_ARTICULATION_KINDS,
      target: 'exact-selected-pitched-event-or-note-parent-event',
      newSpec: 'auto-placement-null-direction',
      existingKindRemoval: 'single-exact-existing-spec-only',
      ambiguousKindFailClosed: true,
      graceTargetAuthority: false,
      history: 'EditorSessionV4',
      rendererCoordinateAuthority: false,
      networkAuthority: false
    })
  });
};
