import {
  addressEntityV3,
  type EventAddressV3,
  type SemanticAddressV3
} from '../../addressing-v3/src/index.js';
import {
  createEventRangeSemanticSelectionV4,
  toEditorKeypadTripletTargetV4
} from '../../editor-semantic-selection-v4/src/index.js';
import {
  slurAuthoringBrowserAppProfile,
  createSlurAuthoringStandaloneBrowserAppRuntime,
  createSlurAuthoringStandaloneScoreEditorController,
  type SlurAuthoringStandaloneScoreEditorController
} from './slur-authoring.js';
import type { ReleaseHardeningControllerOptions } from './release-hardened.js';

export const TRIPLET_AUTHORING_VERSION = '1.0.0' as const;

export const tripletAuthoringBrowserAppProfile = Object.freeze({
  ...slurAuthoringBrowserAppProfile,
  tripletAuthoringBundled: true,
  tripletAuthoringCanonicalAuthority: false,
  tripletAuthoringSelection: 'three-explicit-revision-bound-contiguous-events' as const,
  tripletAuthoringSelectionModel: 'editor-semantic-selection-v4' as const,
  tripletAuthoringCaptureHistoryMutationAuthority: false,
  tripletAuthoringMutation: 'existing-editor-keypad-tuplet.triplet' as const,
  tripletAuthoringRetimingAuthority: false,
  tripletAuthoringCreationPolicy: 'existing-canonical-3-in-the-time-of-2-only' as const,
  tripletAuthoringRemovalAuthority: false,
  tripletAuthoringHistory: 'EditorSessionV4' as const,
  tripletAuthoringRendererCoordinateAuthority: false,
  tripletAuthoringNetworkAuthority: false
});

export interface TripletAuthoringState {
  readonly version: typeof TRIPLET_AUTHORING_VERSION;
  readonly capturedEventIds: readonly string[];
  readonly capturedRevisionId: string | null;
  readonly selectedEventId: string | null;
  readonly canCaptureEvent: boolean;
  readonly canApplyTriplet: boolean;
}

export type TripletAuthoringErrorCode =
  | 'NO_DOCUMENT'
  | 'EVENT_SELECTION_REQUIRED'
  | 'TRIPLET_RANGE_INCOMPLETE'
  | 'TRIPLET_RANGE_COMPLETE'
  | 'ID_UNAVAILABLE';

export class TripletAuthoringError extends Error {
  readonly code: TripletAuthoringErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, code: TripletAuthoringErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'TripletAuthoringError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const freshRevisionId = (): string => {
  const cryptoValue = globalThis.crypto as Crypto | undefined;
  if (cryptoValue === undefined || typeof cryptoValue.randomUUID !== 'function') {
    throw new TripletAuthoringError('Browser randomUUID support is required for triplet revisions.', 'ID_UNAVAILABLE');
  }
  return `rev:${cryptoValue.randomUUID()}`;
};

const exactEventSelection = (
  score: Parameters<typeof addressEntityV3>[0],
  selection: SemanticAddressV3 | null
): EventAddressV3 | null => {
  if (selection?.kind === 'event') return Object.freeze({ ...selection });
  if (selection?.kind !== 'note') return null;
  const parent = addressEntityV3(score, selection.eventId);
  return parent.kind === 'event' ? Object.freeze({ ...parent }) : null;
};

export interface TripletAuthoringStandaloneScoreEditorController extends Omit<SlurAuthoringStandaloneScoreEditorController, 'profile' | 'mount' | 'unmount'> {
  readonly profile: typeof tripletAuthoringBrowserAppProfile;
  readonly getTripletAuthoringState: () => Readonly<TripletAuthoringState>;
  readonly captureTripletEvent: () => Readonly<TripletAuthoringState>;
  readonly clearTripletAuthoring: () => Readonly<TripletAuthoringState>;
  readonly applyTripletToCapturedEvents: () => Readonly<TripletAuthoringState>;
  readonly mount: (root: HTMLElement) => void;
  readonly unmount: () => void;
}

export const createTripletAuthoringStandaloneScoreEditorController = (
  options: ReleaseHardeningControllerOptions = {}
): Readonly<TripletAuthoringStandaloneScoreEditorController> => {
  const base = createSlurAuthoringStandaloneScoreEditorController(options);
  let root: HTMLElement | null = null;
  let captured: EventAddressV3[] = [];

  const normalizeCaptured = (): void => {
    if (captured.length === 0) return;
    const documentValue = base.getDocument();
    const score = documentValue?.session.history.present.score ?? null;
    if (score === null || captured.some(item => item.documentId !== score.id || item.revisionId !== score.revision.id)) {
      captured = [];
    }
  };

  const selectedEvent = (): EventAddressV3 | null => {
    normalizeCaptured();
    const documentValue = base.getDocument();
    if (documentValue === null) return null;
    return exactEventSelection(documentValue.session.history.present.score, documentValue.session.selection ?? null);
  };

  const state = (): Readonly<TripletAuthoringState> => {
    normalizeCaptured();
    const documentValue = base.getDocument();
    const score = documentValue?.session.history.present.score ?? null;
    const selected = score === null ? null : exactEventSelection(score, documentValue?.session.selection ?? null);
    const duplicate = selected !== null && captured.some(item => item.eventId === selected.eventId);
    let canCaptureEvent = selected !== null && !duplicate && captured.length < 3;
    if (canCaptureEvent && score !== null && selected !== null && captured.length > 0) {
      try {
        createEventRangeSemanticSelectionV4(score, [...captured, selected]);
      } catch {
        canCaptureEvent = false;
      }
    }
    let canApplyTriplet = false;
    if (score !== null && captured.length === 3) {
      try {
        const selection = createEventRangeSemanticSelectionV4(score, captured);
        toEditorKeypadTripletTargetV4(selection);
        canApplyTriplet = true;
      } catch {
        canApplyTriplet = false;
      }
    }
    return Object.freeze({
      version: TRIPLET_AUTHORING_VERSION,
      capturedEventIds: Object.freeze(captured.map(item => item.eventId)),
      capturedRevisionId: captured[0]?.revisionId ?? null,
      selectedEventId: selected?.eventId ?? null,
      canCaptureEvent,
      canApplyTriplet
    });
  };

  const requireSelectedEvent = (): EventAddressV3 => {
    const documentValue = base.getDocument();
    if (documentValue === null) throw new TripletAuthoringError('Create or open a score first.', 'NO_DOCUMENT');
    const selected = selectedEvent();
    if (selected === null) throw new TripletAuthoringError('Select an exact event or pitched note parent event for triplet authoring.', 'EVENT_SELECTION_REQUIRED');
    return selected;
  };

  const decorate = (): void => {
    if (root === null) return;
    const palette = root.querySelector<HTMLElement>('[data-st-authoring-palette]');
    if (palette === null) return;
    palette.querySelector('[data-st-triplet-authoring]')?.remove();
    const owner = palette.ownerDocument;
    const current = state();
    const group = owner.createElement('div');
    group.className = 'stse-authoring-group';
    group.setAttribute('data-st-triplet-authoring', TRIPLET_AUTHORING_VERSION);
    group.setAttribute('aria-label', 'Triplet authoring');

    const captureButton = owner.createElement('button');
    captureButton.type = 'button';
    captureButton.textContent = `Triplet ${current.capturedEventIds.length + 1}/3`;
    captureButton.setAttribute('aria-label', 'Capture selected event as next triplet member');
    captureButton.disabled = !current.canCaptureEvent;
    captureButton.addEventListener('click', () => { controller.captureTripletEvent(); });

    const applyButton = owner.createElement('button');
    applyButton.type = 'button';
    applyButton.textContent = 'Triplet Apply';
    applyButton.setAttribute('aria-label', 'Apply triplet metadata to three captured events');
    applyButton.disabled = !current.canApplyTriplet;
    applyButton.title = current.capturedEventIds.length === 3
      ? 'Requires existing exact canonical 3-in-the-time-of-2 timing; no retiming is performed.'
      : 'Capture exactly three contiguous events first.';
    applyButton.addEventListener('click', () => { controller.applyTripletToCapturedEvents(); });

    const clearButton = owner.createElement('button');
    clearButton.type = 'button';
    clearButton.textContent = 'Triplet Clear';
    clearButton.setAttribute('aria-label', 'Clear captured triplet events');
    clearButton.disabled = current.capturedEventIds.length === 0;
    clearButton.addEventListener('click', () => { controller.clearTripletAuthoring(); });

    group.append(captureButton, applyButton, clearButton);
    palette.append(group);
  };

  base.subscribe(() => {
    normalizeCaptured();
    decorate();
  });

  const controller: TripletAuthoringStandaloneScoreEditorController = {
    ...base,
    profile: tripletAuthoringBrowserAppProfile,
    getTripletAuthoringState: state,
    captureTripletEvent: () => {
      const documentValue = base.getDocument();
      if (documentValue === null) throw new TripletAuthoringError('Create or open a score first.', 'NO_DOCUMENT');
      if (captured.length >= 3) throw new TripletAuthoringError('Triplet range already contains three explicit events.', 'TRIPLET_RANGE_COMPLETE');
      const selected = requireSelectedEvent();
      if (captured.some(item => item.eventId === selected.eventId)) {
        throw new TripletAuthoringError('Triplet range cannot contain the same explicit event twice.', 'EVENT_SELECTION_REQUIRED');
      }
      const next = [...captured, selected];
      if (next.length >= 2) createEventRangeSemanticSelectionV4(documentValue.session.history.present.score, next);
      captured = next.map(item => Object.freeze({ ...item }));
      decorate();
      return state();
    },
    clearTripletAuthoring: () => {
      captured = [];
      decorate();
      return state();
    },
    applyTripletToCapturedEvents: () => {
      normalizeCaptured();
      const documentValue = base.getDocument();
      if (documentValue === null) throw new TripletAuthoringError('Create or open a score first.', 'NO_DOCUMENT');
      if (captured.length !== 3) throw new TripletAuthoringError('Capture exactly three events before applying a triplet.', 'TRIPLET_RANGE_INCOMPLETE');
      const selection = createEventRangeSemanticSelectionV4(documentValue.session.history.present.score, captured);
      const target = toEditorKeypadTripletTargetV4(selection);
      const restoreSelection = documentValue.session.selection === null ? null : Object.freeze({ ...documentValue.session.selection }) as SemanticAddressV3;
      const first = selection.targets[0]!;
      const selectResult = base.select(first);
      if (selectResult.error !== null) throw Object.assign(new Error(selectResult.error.message), { code: selectResult.error.code });
      const result = base.commitKeypad(
        Object.freeze({ version: '1.0.0' as const, actionId: 'tuplet.triplet' as const }),
        target,
        Object.freeze({ nextRevisionId: freshRevisionId() })
      );
      if (result.error !== null) {
        if (restoreSelection !== null) base.select(restoreSelection);
        captured = [];
        decorate();
        throw Object.assign(new Error(result.error.message), { code: result.error.code });
      }
      captured = [];
      decorate();
      return state();
    },
    mount: (nextRoot) => {
      root = nextRoot;
      base.mount(nextRoot);
      decorate();
    },
    unmount: () => {
      captured = [];
      root = null;
      base.unmount();
    }
  };

  return Object.freeze(controller);
};

export const createTripletAuthoringStandaloneBrowserAppRuntime = () => {
  const base = createSlurAuthoringStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: tripletAuthoringBrowserAppProfile,
    createController: createTripletAuthoringStandaloneScoreEditorController,
    tripletAuthoring: Object.freeze({
      version: TRIPLET_AUTHORING_VERSION,
      bundled: true,
      canonicalAuthority: false,
      selection: 'three-explicit-revision-bound-contiguous-events',
      selectionModel: 'editor-semantic-selection-v4',
      captureHistoryMutationAuthority: false,
      mutation: 'existing-editor-keypad-tuplet.triplet',
      retimingAuthority: false,
      creationPolicy: 'existing-canonical-3-in-the-time-of-2-only',
      removalAuthority: false,
      history: 'EditorSessionV4',
      rendererCoordinateAuthority: false,
      networkAuthority: false
    })
  });
};
