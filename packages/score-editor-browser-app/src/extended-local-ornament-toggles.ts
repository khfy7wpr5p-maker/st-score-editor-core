import type { ScoreEvent } from '../../score-model/src/index.js';
import {
  addressEntityV3,
  resolveSemanticAddressV3,
  type EventAddressV3
} from '../../addressing-v3/src/index.js';
import type { OrnamentSpec, SimpleOrnamentKind, SimpleOrnamentSpec } from '../../notation-structure-v2/src/index.js';
import {
  extendedArticulationTogglesBrowserAppProfile,
  createExtendedArticulationTogglesStandaloneBrowserAppRuntime,
  createExtendedArticulationTogglesStandaloneScoreEditorController,
  type ExtendedArticulationTogglesStandaloneScoreEditorController
} from './extended-articulation-toggles.js';
import type { ReleaseHardeningControllerOptions } from './release-hardened.js';

export const EXTENDED_LOCAL_ORNAMENT_TOGGLES_VERSION = '1.0.0' as const;
export const BOUNDED_EXTENDED_LOCAL_ORNAMENT_KINDS = Object.freeze(['inverted-turn', 'inverted-mordent', 'shake'] as const);
export type BoundedExtendedLocalOrnamentKind = typeof BOUNDED_EXTENDED_LOCAL_ORNAMENT_KINDS[number];

export const extendedLocalOrnamentTogglesBrowserAppProfile = Object.freeze({
  ...extendedArticulationTogglesBrowserAppProfile,
  extendedLocalOrnamentTogglesBundled: true,
  extendedLocalOrnamentTogglesCanonicalAuthority: false,
  extendedLocalOrnamentToggleKinds: BOUNDED_EXTENDED_LOCAL_ORNAMENT_KINDS,
  extendedLocalOrnamentToggleTarget: 'exact-selected-pitched-event-or-note-parent-event' as const,
  extendedLocalOrnamentNewSpec: 'auto-placement-empty-accidental-marks' as const,
  extendedLocalOrnamentExistingKindRemoval: 'single-exact-existing-spec-only' as const,
  extendedLocalOrnamentAmbiguousKindFailClosed: true,
  extendedLocalOrnamentSpanningRelationAuthority: false,
  extendedLocalOrnamentGraceTargetAuthority: false,
  extendedLocalOrnamentToggleHistory: 'EditorSessionV4' as const,
  extendedLocalOrnamentRendererCoordinateAuthority: false,
  extendedLocalOrnamentNetworkAuthority: false
});

export interface ExtendedLocalOrnamentTogglesState {
  readonly version: typeof EXTENDED_LOCAL_ORNAMENT_TOGGLES_VERSION;
  readonly canToggleExtendedLocalOrnament: boolean;
  readonly selectedEventKind: ScoreEvent['kind'] | null;
  readonly activeKinds: readonly BoundedExtendedLocalOrnamentKind[];
  readonly ambiguousKinds: readonly BoundedExtendedLocalOrnamentKind[];
}

export type ExtendedLocalOrnamentTogglesErrorCode =
  | 'NO_DOCUMENT'
  | 'PITCHED_EVENT_SELECTION_REQUIRED'
  | 'UNSUPPORTED_EXTENDED_LOCAL_ORNAMENT_KIND'
  | 'EXTENDED_LOCAL_ORNAMENT_KIND_AMBIGUOUS'
  | 'ID_UNAVAILABLE';

export class ExtendedLocalOrnamentTogglesError extends Error {
  readonly code: ExtendedLocalOrnamentTogglesErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: ExtendedLocalOrnamentTogglesErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ExtendedLocalOrnamentTogglesError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

interface ExtendedLocalOrnamentContext {
  readonly eventAddress: EventAddressV3;
  readonly event: ScoreEvent;
  readonly ornaments: readonly OrnamentSpec[];
}

const freshRevisionId = (): string => {
  const cryptoValue = globalThis.crypto as Crypto | undefined;
  if (cryptoValue === undefined || typeof cryptoValue.randomUUID !== 'function') {
    throw new ExtendedLocalOrnamentTogglesError('Browser randomUUID support is required for extended local ornament revisions.', 'ID_UNAVAILABLE');
  }
  return `rev:${cryptoValue.randomUUID()}`;
};

const boundedKind = (value: string): BoundedExtendedLocalOrnamentKind => {
  if (!(BOUNDED_EXTENDED_LOCAL_ORNAMENT_KINDS as readonly string[]).includes(value)) {
    throw new ExtendedLocalOrnamentTogglesError('Extended local ornament kind is outside the bounded browser profile.', 'UNSUPPORTED_EXTENDED_LOCAL_ORNAMENT_KIND', { kind: value });
  }
  return value as BoundedExtendedLocalOrnamentKind;
};

const defaultSpec = (kind: BoundedExtendedLocalOrnamentKind): Readonly<SimpleOrnamentSpec> => Object.freeze({
  kind: kind as SimpleOrnamentKind,
  placement: 'auto',
  accidentalMarks: Object.freeze([])
});

export interface ExtendedLocalOrnamentTogglesStandaloneScoreEditorController extends Omit<ExtendedArticulationTogglesStandaloneScoreEditorController, 'profile' | 'mount' | 'unmount'> {
  readonly profile: typeof extendedLocalOrnamentTogglesBrowserAppProfile;
  readonly getExtendedLocalOrnamentTogglesState: () => Readonly<ExtendedLocalOrnamentTogglesState>;
  readonly toggleSelectedExtendedLocalOrnament: (kind: string) => Readonly<ExtendedLocalOrnamentTogglesState>;
  readonly mount: (root: HTMLElement) => void;
  readonly unmount: () => void;
}

export const createExtendedLocalOrnamentTogglesStandaloneScoreEditorController = (
  options: ReleaseHardeningControllerOptions = {}
): Readonly<ExtendedLocalOrnamentTogglesStandaloneScoreEditorController> => {
  const base = createExtendedArticulationTogglesStandaloneScoreEditorController(options);
  let root: HTMLElement | null = null;

  const context = (): Readonly<ExtendedLocalOrnamentContext> | null => {
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
    return Object.freeze({ eventAddress, event: resolved.value, ornaments: Object.freeze([...(notation?.ornaments ?? [])]) });
  };

  const state = (): Readonly<ExtendedLocalOrnamentTogglesState> => {
    const current = context();
    const pitched = current !== null && current.event.kind !== 'rest';
    const activeKinds: BoundedExtendedLocalOrnamentKind[] = [];
    const ambiguousKinds: BoundedExtendedLocalOrnamentKind[] = [];
    if (pitched && current !== null) {
      for (const kind of BOUNDED_EXTENDED_LOCAL_ORNAMENT_KINDS) {
        const matches = current.ornaments.filter(item => item.kind === kind);
        if (matches.length === 1) activeKinds.push(kind);
        else if (matches.length > 1) ambiguousKinds.push(kind);
      }
    }
    return Object.freeze({
      version: EXTENDED_LOCAL_ORNAMENT_TOGGLES_VERSION,
      canToggleExtendedLocalOrnament: pitched,
      selectedEventKind: current?.event.kind ?? null,
      activeKinds: Object.freeze(activeKinds),
      ambiguousKinds: Object.freeze(ambiguousKinds)
    });
  };

  const requirePitched = (): Readonly<ExtendedLocalOrnamentContext> => {
    const documentValue = base.getDocument();
    if (documentValue === null) throw new ExtendedLocalOrnamentTogglesError('Create or open a score first.', 'NO_DOCUMENT');
    const current = context();
    if (current === null || current.event.kind === 'rest') {
      throw new ExtendedLocalOrnamentTogglesError('Select a pitched note or chord event before toggling an extended local ornament.', 'PITCHED_EVENT_SELECTION_REQUIRED');
    }
    return current;
  };

  const decorate = (): void => {
    if (root === null) return;
    const palette = root.querySelector<HTMLElement>('[data-st-authoring-palette]');
    if (palette === null) return;
    palette.querySelector('[data-st-extended-local-ornament-toggles]')?.remove();
    const owner = palette.ownerDocument;
    const current = state();
    const group = owner.createElement('div');
    group.className = 'stse-authoring-group';
    group.setAttribute('data-st-extended-local-ornament-toggles', EXTENDED_LOCAL_ORNAMENT_TOGGLES_VERSION);
    group.setAttribute('aria-label', 'Extended local ornaments');

    const descriptors: readonly Readonly<{ kind: BoundedExtendedLocalOrnamentKind; label: string; ariaLabel: string }>[] = Object.freeze([
      Object.freeze({ kind: 'inverted-turn', label: 'InvTurn', ariaLabel: 'Toggle inverted turn on selected pitched event' }),
      Object.freeze({ kind: 'inverted-mordent', label: 'InvMord', ariaLabel: 'Toggle inverted mordent on selected pitched event' }),
      Object.freeze({ kind: 'shake', label: 'Shake', ariaLabel: 'Toggle shake on selected pitched event' })
    ]);
    for (const descriptor of descriptors) {
      const button = owner.createElement('button');
      button.type = 'button';
      button.textContent = descriptor.label;
      button.setAttribute('aria-label', descriptor.ariaLabel);
      button.setAttribute('aria-pressed', current.activeKinds.includes(descriptor.kind) ? 'true' : 'false');
      button.disabled = !current.canToggleExtendedLocalOrnament || current.ambiguousKinds.includes(descriptor.kind);
      button.addEventListener('click', () => { controller.toggleSelectedExtendedLocalOrnament(descriptor.kind); });
      group.append(button);
    }
    palette.append(group);
  };

  base.subscribe(() => { decorate(); });

  const controller: ExtendedLocalOrnamentTogglesStandaloneScoreEditorController = {
    ...base,
    profile: extendedLocalOrnamentTogglesBrowserAppProfile,
    getExtendedLocalOrnamentTogglesState: state,
    toggleSelectedExtendedLocalOrnament: (rawKind) => {
      const kind = boundedKind(rawKind);
      const current = requirePitched();
      const matches = current.ornaments.filter(item => item.kind === kind);
      if (matches.length > 1) {
        throw new ExtendedLocalOrnamentTogglesError('Multiple exact extended local ornament specs of this kind are present; browser toggle will not guess which one to remove.', 'EXTENDED_LOCAL_ORNAMENT_KIND_AMBIGUOUS', { kind, count: matches.length });
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

export const createExtendedLocalOrnamentTogglesStandaloneBrowserAppRuntime = () => {
  const base = createExtendedArticulationTogglesStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: extendedLocalOrnamentTogglesBrowserAppProfile,
    createController: createExtendedLocalOrnamentTogglesStandaloneScoreEditorController,
    extendedLocalOrnamentToggles: Object.freeze({
      version: EXTENDED_LOCAL_ORNAMENT_TOGGLES_VERSION,
      bundled: true,
      canonicalAuthority: false,
      kinds: BOUNDED_EXTENDED_LOCAL_ORNAMENT_KINDS,
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
