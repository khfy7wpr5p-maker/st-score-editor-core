import { addressEntityV3, type EventAddressV3 } from '../../addressing-v3/src/index.js';
import { analyzeStraightThreeToTripletRetimingV4 } from '../../editor-tuplet-retiming-admission-v4/src/index.js';
import {
  tripletAuthoringBrowserAppProfile,
  createTripletAuthoringStandaloneBrowserAppRuntime,
  createTripletAuthoringStandaloneScoreEditorController,
  type TripletAuthoringStandaloneScoreEditorController
} from './triplet-authoring.js';
import type { ReleaseHardeningControllerOptions } from './release-hardened.js';

export const TRIPLET_RETIMING_BROWSER_VERSION = '1.0.0' as const;

export const tripletRetimingBrowserAppProfile = Object.freeze({
  ...tripletAuthoringBrowserAppProfile,
  tripletRetimingAuthoringBundled: true,
  tripletRetimingCanonicalAuthority: false,
  tripletRetimingSelection: 'three-explicit-revision-bound-contiguous-straight-events' as const,
  tripletRetimingAdmission: 'editor-tuplet-retiming-admission-v4' as const,
  tripletRetimingMutation: 'editor-tuplet-retiming-authoring-v4' as const,
  tripletRetimingRestBalance: 'explicit-residual-rest-or-adjacent-neutral-rest-extension' as const,
  tripletRetimingHistory: 'EditorSessionV4' as const,
  tripletRetimingRendererCoordinateAuthority: false,
  tripletRetimingNetworkAuthority: false
});

export interface TripletRetimingBrowserState {
  readonly version: typeof TRIPLET_RETIMING_BROWSER_VERSION;
  readonly canApplyRetimedTriplet: boolean;
  readonly admissionReason: string | null;
}

export type TripletRetimingBrowserErrorCode =
  | 'NO_DOCUMENT'
  | 'TRIPLET_RANGE_INCOMPLETE'
  | 'ID_UNAVAILABLE';

export class TripletRetimingBrowserError extends Error {
  readonly code: TripletRetimingBrowserErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, code: TripletRetimingBrowserErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'TripletRetimingBrowserError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const freshRevisionId = (): string => {
  const cryptoValue = globalThis.crypto as Crypto | undefined;
  if (cryptoValue === undefined || typeof cryptoValue.randomUUID !== 'function') {
    throw new TripletRetimingBrowserError(
      'Browser randomUUID support is required for triplet retiming revisions.',
      'ID_UNAVAILABLE'
    );
  }
  return `rev:${cryptoValue.randomUUID()}`;
};

const capturedTargets = (
  base: TripletAuthoringStandaloneScoreEditorController
): readonly EventAddressV3[] => {
  const documentValue = base.getDocument();
  if (documentValue === null) {
    throw new TripletRetimingBrowserError('Create or open a score first.', 'NO_DOCUMENT');
  }
  const captured = base.getTripletAuthoringState().capturedEventIds;
  if (captured.length !== 3) {
    throw new TripletRetimingBrowserError(
      'Capture exactly three contiguous events before applying triplet retiming.',
      'TRIPLET_RANGE_INCOMPLETE',
      { cardinality: captured.length }
    );
  }
  return Object.freeze(captured.map(eventId => {
    const target = addressEntityV3(documentValue.session.history.present.score, eventId);
    if (target.kind !== 'event') {
      throw new TripletRetimingBrowserError(
        'Captured triplet event no longer resolves exactly.',
        'TRIPLET_RANGE_INCOMPLETE',
        { eventId }
      );
    }
    return target;
  }));
};

export interface TripletRetimingStandaloneScoreEditorController extends Omit<TripletAuthoringStandaloneScoreEditorController, 'profile' | 'mount' | 'unmount'> {
  readonly profile: typeof tripletRetimingBrowserAppProfile;
  readonly getTripletRetimingState: () => Readonly<TripletRetimingBrowserState>;
  readonly applyRetimedTripletToCapturedEvents: () => Readonly<TripletRetimingBrowserState>;
  readonly mount: (root: HTMLElement) => void;
  readonly unmount: () => void;
}

export const createTripletRetimingStandaloneScoreEditorController = (
  options: ReleaseHardeningControllerOptions = {}
): Readonly<TripletRetimingStandaloneScoreEditorController> => {
  const base = createTripletAuthoringStandaloneScoreEditorController(options);
  let root: HTMLElement | null = null;
  let tripletGroupObserver: MutationObserver | null = null;

  const state = (): Readonly<TripletRetimingBrowserState> => {
    const documentValue = base.getDocument();
    if (documentValue === null || base.getTripletAuthoringState().capturedEventIds.length !== 3) {
      return Object.freeze({
        version: TRIPLET_RETIMING_BROWSER_VERSION,
        canApplyRetimedTriplet: false,
        admissionReason: null
      });
    }
    try {
      const targets = capturedTargets(base);
      const admission = analyzeStraightThreeToTripletRetimingV4(
        documentValue.session.history.present.score,
        documentValue.session.history.present.notation,
        targets
      );
      return Object.freeze({
        version: TRIPLET_RETIMING_BROWSER_VERSION,
        canApplyRetimedTriplet: admission.admitted,
        admissionReason: admission.reason
      });
    } catch (error) {
      const reason = error !== null && typeof error === 'object' && 'code' in error
        ? String((error as { code: unknown }).code)
        : 'RETIMING_ADMISSION_FAILED';
      return Object.freeze({
        version: TRIPLET_RETIMING_BROWSER_VERSION,
        canApplyRetimedTriplet: false,
        admissionReason: reason
      });
    }
  };

  const decorate = (): void => {
    if (root === null) return;
    const group = root.querySelector<HTMLElement>('[data-st-triplet-authoring]');
    if (group === null) return;
    const current = state();
    let button = group.querySelector<HTMLButtonElement>('[data-st-triplet-retiming]');
    if (button === null) {
      button = group.ownerDocument.createElement('button');
      button.type = 'button';
      button.textContent = 'Triplet Retiming';
      button.setAttribute('data-st-triplet-retiming', TRIPLET_RETIMING_BROWSER_VERSION);
      button.setAttribute('aria-label', 'Convert three captured straight events to triplet timing');
      button.addEventListener('click', () => { controller.applyRetimedTripletToCapturedEvents(); });
      group.append(button);
    }
    button.disabled = !current.canApplyRetimedTriplet;
    button.title = current.canApplyRetimedTriplet
      ? 'Atomically retime the three explicit straight events to canonical 3:2 timing.'
      : current.admissionReason === null
        ? 'Capture exactly three contiguous straight events first.'
        : `Retiming not admitted: ${current.admissionReason}`;
  };

  const observeTripletGroupLifecycle = (nextRoot: HTMLElement): void => {
    tripletGroupObserver?.disconnect();
    const Observer = nextRoot.ownerDocument.defaultView?.MutationObserver;
    if (Observer === undefined) return;
    tripletGroupObserver = new Observer(() => {
      const group = nextRoot.querySelector<HTMLElement>('[data-st-triplet-authoring]');
      if (group !== null && group.querySelector('[data-st-triplet-retiming]') === null) decorate();
    });
    tripletGroupObserver.observe(nextRoot, { childList: true, subtree: true });
  };

  base.subscribe(() => { decorate(); });

  const controller: TripletRetimingStandaloneScoreEditorController = {
    ...base,
    profile: tripletRetimingBrowserAppProfile,
    getTripletRetimingState: state,
    captureTripletEvent: () => {
      const result = base.captureTripletEvent();
      decorate();
      return result;
    },
    clearTripletAuthoring: () => {
      const result = base.clearTripletAuthoring();
      decorate();
      return result;
    },
    applyTripletToCapturedEvents: () => {
      const result = base.applyTripletToCapturedEvents();
      decorate();
      return result;
    },
    applyRetimedTripletToCapturedEvents: () => {
      const documentValue = base.getDocument();
      if (documentValue === null) {
        throw new TripletRetimingBrowserError('Create or open a score first.', 'NO_DOCUMENT');
      }
      const targets = capturedTargets(base);
      const intent = Object.freeze({
        version: '1.0.0' as const,
        type: 'RETIMING_STRAIGHT_THREE_TO_TRIPLET' as const,
        targets
      });
      const result = base.commitTupletRetiming(
        intent,
        Object.freeze({ nextRevisionId: freshRevisionId() })
      );
      if (result.error !== null) {
        decorate();
        throw Object.assign(new Error(result.error.message), { code: result.error.code });
      }
      base.clearTripletAuthoring();
      decorate();
      return state();
    },
    mount: (nextRoot) => {
      root = nextRoot;
      base.mount(nextRoot);
      observeTripletGroupLifecycle(nextRoot);
      decorate();
    },
    unmount: () => {
      tripletGroupObserver?.disconnect();
      tripletGroupObserver = null;
      root = null;
      base.unmount();
    }
  };

  return Object.freeze(controller);
};

export const createTripletRetimingStandaloneBrowserAppRuntime = () => {
  const base = createTripletAuthoringStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: tripletRetimingBrowserAppProfile,
    createController: createTripletRetimingStandaloneScoreEditorController,
    tripletRetimingAuthoring: Object.freeze({
      version: TRIPLET_RETIMING_BROWSER_VERSION,
      bundled: true,
      canonicalAuthority: false,
      selection: 'three-explicit-revision-bound-contiguous-straight-events',
      admission: 'editor-tuplet-retiming-admission-v4',
      mutation: 'editor-tuplet-retiming-authoring-v4',
      restBalance: 'explicit-residual-rest-or-adjacent-neutral-rest-extension',
      history: 'EditorSessionV4',
      rendererCoordinateAuthority: false,
      networkAuthority: false
    })
  });
};
