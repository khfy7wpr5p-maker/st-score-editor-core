import type { ScoreEvent } from '../../score-model/src/index.js';
import {
  addressEntityV3,
  resolveSemanticAddressV3,
  type EventAddressV3
} from '../../addressing-v3/src/index.js';
import type { OrnamentSpec, SimpleOrnamentKind, SimpleOrnamentSpec } from '../../notation-structure-v2/src/index.js';
import {
  articulationTogglesBrowserAppProfile,
  createArticulationTogglesStandaloneBrowserAppRuntime,
  createArticulationTogglesStandaloneScoreEditorController,
  type ArticulationTogglesStandaloneScoreEditorController
} from './articulation-toggles.js';
import type { ReleaseHardeningControllerOptions } from './release-hardened.js';

export const LOCAL_ORNAMENT_TOGGLES_VERSION = '1.0.0' as const;
export const BOUNDED_LOCAL_ORNAMENT_KINDS = Object.freeze(['trill-mark', 'turn', 'mordent'] as const);
export type BoundedLocalOrnamentKind = typeof BOUNDED_LOCAL_ORNAMENT_KINDS[number];

export const localOrnamentTogglesBrowserAppProfile = Object.freeze({
  ...articulationTogglesBrowserAppProfile,
  localOrnamentTogglesBundled: true,
  localOrnamentTogglesCanonicalAuthority: false,
  localOrnamentToggleKinds: BOUNDED_LOCAL_ORNAMENT_KINDS,
  localOrnamentToggleTarget: 'exact-selected-pitched-event-or-note-parent-event' as const,
  localOrnamentNewSpec: 'auto-placement-empty-accidental-marks' as const,
  localOrnamentExistingKindRemoval: 'single-exact-existing-spec-only' as const,
  localOrnamentAmbiguousKindFailClosed: true,
  localOrnamentSpanningRelationAuthority: false,
  localOrnamentGraceTargetAuthority: false,
  localOrnamentToggleHistory: 'EditorSessionV4' as const,
  localOrnamentRendererCoordinateAuthority: false,
  localOrnamentNetworkAuthority: false
});

export interface LocalOrnamentTogglesState {
  readonly version: typeof LOCAL_ORNAMENT_TOGGLES_VERSION;
  readonly canToggleLocalOrnament: boolean;
  readonly selectedEventKind: ScoreEvent['kind'] | null;
  readonly activeKinds: readonly BoundedLocalOrnamentKind[];
  readonly ambiguousKinds: readonly BoundedLocalOrnamentKind[];
}

export type LocalOrnamentTogglesErrorCode =
  | 'NO_DOCUMENT'
  | 'PITCHED_EVENT_SELECTION_REQUIRED'
  | 'UNSUPPORTED_LOCAL_ORNAMENT_KIND'
  | 'LOCAL_ORNAMENT_KIND_AMBIGUOUS'
  | 'ID_UNAVAILABLE';

export class LocalOrnamentTogglesError extends Error {
  readonly code: LocalOrnamentTogglesErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: LocalOrnamentTogglesErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'LocalOrnamentTogglesError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

interface LocalOrnamentContext {
  readonly eventAddress: EventAddressV3;
  readonly event: ScoreEvent;
  readonly ornaments: readonly OrnamentSpec[];
}

const freshRevisionId = (): string => {
  const cryptoValue = globalThis.crypto as Crypto | undefined;
  if (cryptoValue === undefined || typeof cryptoValue.randomUUID !== 'function') {
    throw new LocalOrnamentTogglesError('Browser randomUUID support is required for local ornament revisions.', 'ID_UNAVAILABLE');
  }
  return `rev:${cryptoValue.randomUUID()}`;
};

const boundedKind = (value: string): BoundedLocalOrnamentKind => {
  if (!(BOUNDED_LOCAL_ORNAMENT_KINDS as readonly string[]).includes(value)) {
    throw new LocalOrnamentTogglesError('Local ornament kind is outside the bounded browser profile.', 'UNSUPPORTED_LOCAL_ORNAMENT_KIND', { kind: value });
  }
  return value as BoundedLocalOrnamentKind;
};

const defaultSpec = (kind: BoundedLocalOrnamentKind): Readonly<SimpleOrnamentSpec> => Object.freeze({
  kind: kind as SimpleOrnamentKind,
  placement: 'auto',
  accidentalMarks: Object.freeze([])
});

export interface LocalOrnamentTogglesStandaloneScoreEditorController extends Omit<ArticulationTogglesStandaloneScoreEditorController, 'profile' | 'mount' | 'unmount'> {
  readonly profile: typeof localOrnamentTogglesBrowserAppProfile;
  readonly getLocalOrnamentTogglesState: () => Readonly<LocalOrnamentTogglesState>;
  readonly toggleSelectedLocalOrnament: (kind: string) => Readonly<LocalOrnamentTogglesState>;
  readonly mount: (root: HTMLElement) => void;
  readonly unmount: () => void;
}

export const createLocalOrnamentTogglesStandaloneScoreEditorController = (
  options: ReleaseHardeningControllerOptions = {}
): Readonly<LocalOrnamentTogglesStandaloneScoreEditorController> => {
  const base = createArticulationTogglesStandaloneScoreEditorController(options);
  let root: HTMLElement | null = null;

  const context = (): Readonly<LocalOrnamentContext> | null => {
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
      ornaments: Object.freeze([...(notation?.ornaments ?? [])])
    });
  };

  const state = (): Readonly<LocalOrnamentTogglesState> => {
    const current = context();
    const pitched = current !== null && current.event.kind !== 'rest';
    const activeKinds: BoundedLocalOrnamentKind[] = [];
    const ambiguousKinds: BoundedLocalOrnamentKind[] = [];
    if (pitched && current !== null) {
      for (const kind of BOUNDED_LOCAL_ORNAMENT_KINDS) {
        const matches = current.ornaments.filter(item => item.kind === kind);
        if (matches.length === 1) activeKinds.push(kind);
        else if (matches.length > 1) ambiguousKinds.push(kind);
      }
    }
    return Object.freeze({
      version: LOCAL_ORNAMENT_TOGGLES_VERSION,
      canToggleLocalOrnament: pitched,
      selectedEventKind: current?.event.kind ?? null,
      activeKinds: Object.freeze(activeKinds),
      ambiguousKinds: Object.freeze(ambiguousKinds)
    });
  };

  const requirePitched = (): Readonly<LocalOrnamentContext> => {
    const documentValue = base.getDocument();
    if (documentValue === null) throw new LocalOrnamentTogglesError('Create or open a score first.', 'NO_DOCUMENT');
    const current = context();
    if (current === null || current.event.kind === 'rest') {
      throw new LocalOrnamentTogglesError('Select a pitched note or chord event before toggling a local ornament.', 'PITCHED_EVENT_SELECTION_REQUIRED');
    }
    return current;
  };

  const decorate = (): void => {
    if (root === null) return;
    const palette = root.querySelector<HTMLElement>('[data-st-authoring-palette]');
    if (palette === null) return;
    palette.querySelector('[data-st-local-ornament-toggles]')?.remove();
    const owner = palette.ownerDocument;
    const current = state();
    const group = owner.createElement('div');
    group.className = 'stse-authoring-group';
    group.setAttribute('data-st-local-ornament-toggles', LOCAL_ORNAMENT_TOGGLES_VERSION);
    group.setAttribute('aria-label', 'Local ornaments');

    const descriptors: readonly Readonly<{ kind: BoundedLocalOrnamentKind; label: string; ariaLabel: string }>[] = Object.freeze([
      Object.freeze({ kind: 'trill-mark', label: 'Trill', ariaLabel: 'Toggle trill on selected pitched event' }),
      Object.freeze({ kind: 'turn', label: 'Turn', ariaLabel: 'Toggle turn on selected pitched event' }),
      Object.freeze({ kind: 'mordent', label: 'Mord', ariaLabel: 'Toggle mordent on selected pitched event' })
    ]);
    for (const descriptor of descriptors) {
      const button = owner.createElement('button');
      button.type = 'button';
      button.textContent = descriptor.label;
      button.setAttribute('aria-label', descriptor.ariaLabel);
      button.setAttribute('aria-pressed', current.activeKinds.includes(descriptor.kind) ? 'true' : 'false');
      button.disabled = !current.canToggleLocalOrnament || current.ambiguousKinds.includes(descriptor.kind);
      button.addEventListener('click', () => { controller.toggleSelectedLocalOrnament(descriptor.kind); });
      group.append(button);
    }
    palette.append(group);
  };

  base.subscribe(() => { decorate(); });

  const controller: LocalOrnamentTogglesStandaloneScoreEditorController = {
    ...base,
    profile: localOrnamentTogglesBrowserAppProfile,
    getLocalOrnamentTogglesState: state,
    toggleSelectedLocalOrnament: (rawKind) => {
      const kind = boundedKind(rawKind);
      const current = requirePitched();
      const matches = current.ornaments.filter(item => item.kind === kind);
      if (matches.length > 1) {
        throw new LocalOrnamentTogglesError('Multiple exact local ornament specs of this kind are present; browser toggle will not guess which one to remove.', 'LOCAL_ORNAMENT_KIND_AMBIGUOUS', { kind, count: matches.length });
      }
      const intent = matches.length === 1
        ? Object.freeze({ version: '1.0.0' as const, type: 'REMOVE_LOCAL_ORNAMENT' as const, target: current.eventAddress, value: matches[0] as SimpleOrnamentSpec })
        : Object.freeze({ version: '1.0.0' as const, type: 'TOGGLE_LOCAL_ORNAMENT' as const, target: current.eventAddress, value: defaultSpec(kind) });
      const result = base.commitOrnament(intent, { nextRevisionId: freshRevisionId() });
      if (result.error !== null) throw Object.assign(new Error(result.error.message), { code: result.error.code });
      decorate();
      return state();
    },
    mount: (nextRoot) => { root = nextRoot; base.mount(nextRoot); decorate(); },
    unmount: () => { root = null; base.unmount(); }
  };

  return Object.freeze(controller);
};

export const createLocalOrnamentTogglesStandaloneBrowserAppRuntime = () => {
  const base = createArticulationTogglesStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: localOrnamentTogglesBrowserAppProfile,
    createController: createLocalOrnamentTogglesStandaloneScoreEditorController,
    localOrnamentToggles: Object.freeze({
      version: LOCAL_ORNAMENT_TOGGLES_VERSION,
      bundled: true,
      canonicalAuthority: false,
      kinds: BOUNDED_LOCAL_ORNAMENT_KINDS,
      target: 'exact-selected-pitched-event-or-note-parent-event',
      newSpec: 'auto-placement-empty-accidental-marks',
      existingKindRemoval: 'single-exact-existing-spec-only',
      ambiguousKindFailClosed: true,
      spanningRelationAuthority: false,
      graceTargetAuthority: false,
      history: 'EditorSessionV4',
      rendererCoordinateAuthority: false,
      networkAuthority: false
    })
  });
};
