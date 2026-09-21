import { addressEntityV3, type EventAddressV3 } from '../../addressing-v3/src/index.js';
import { analyzeTripletToStraightThreeUnretimingV4 } from '../../editor-tuplet-unretiming-admission-v4/src/index.js';
import { commitScoreEditorAppTripletToStraightThreeV4 } from '../../score-editor-app-tuplet-unretiming/src/index.js';
import {
  tripletRetimingBrowserAppProfile,
  type TripletRetimingStandaloneScoreEditorController
} from './triplet-retiming-authoring.js';
import type { ScoreEditorBrowserAppSnapshot } from './index.js';

export const TRIPLET_UNRETIMING_BROWSER_VERSION = '1.0.0' as const;

export const tripletUnretimingBrowserAppProfile = Object.freeze({
  ...tripletRetimingBrowserAppProfile,
  tripletUnretimingAuthoringBundled: true,
  tripletUnretimingCanonicalAuthority: false,
  tripletUnretimingSelection: 'three-explicit-current-revision-triplet-events' as const,
  tripletUnretimingAdmission: 'editor-tuplet-unretiming-admission-v4' as const,
  tripletUnretimingMutation: 'editor-tuplet-unretiming-authoring-v4' as const,
  tripletUnretimingHistory: 'EditorSessionV4' as const,
  tripletUnretimingRendererCoordinateAuthority: false,
  tripletUnretimingDomAuthoringAuthority: false,
  tripletUnretimingProductionDefault: false,
  tripletUnretimingSeslitabCutoverAuthorized: false
});

export interface TripletUnretimingBrowserState {
  readonly version: typeof TRIPLET_UNRETIMING_BROWSER_VERSION;
  readonly canRemoveTriplet: boolean;
  readonly admissionReason: string | null;
}

export interface TripletUnretimingAttachmentOptionsV1 {
  readonly revisionIdFactory?: () => string;
}

export type TripletUnretimingBrowserErrorCode =
  | 'NO_DOCUMENT'
  | 'TRIPLET_RANGE_INCOMPLETE'
  | 'ID_UNAVAILABLE';

export class TripletUnretimingBrowserError extends Error {
  readonly code: TripletUnretimingBrowserErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: TripletUnretimingBrowserErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'TripletUnretimingBrowserError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const browserRevisionId = (): string => {
  const cryptoValue = globalThis.crypto as Crypto | undefined;
  if (cryptoValue === undefined || typeof cryptoValue.randomUUID !== 'function') {
    throw new TripletUnretimingBrowserError(
      'Browser randomUUID support is required for Triplet unretiming revisions.',
      'ID_UNAVAILABLE'
    );
  }
  return `rev:${cryptoValue.randomUUID()}`;
};

const currentTargets = (
  base: TripletRetimingStandaloneScoreEditorController
): readonly EventAddressV3[] => {
  const documentValue = base.getDocument();
  if (documentValue === null) {
    throw new TripletUnretimingBrowserError(
      'Create or open a score first.',
      'NO_DOCUMENT'
    );
  }
  const captured = base.getTripletAuthoringState().capturedEventIds;
  if (captured.length !== 3) {
    throw new TripletUnretimingBrowserError(
      'Capture exactly three current Triplet events before removal.',
      'TRIPLET_RANGE_INCOMPLETE',
      { cardinality: captured.length }
    );
  }
  const score = documentValue.session.history.present.score;
  return Object.freeze(captured.map(eventId => {
    const target = addressEntityV3(score, eventId);
    if (target.kind !== 'event') {
      throw new TripletUnretimingBrowserError(
        'Captured Triplet event no longer resolves exactly.',
        'TRIPLET_RANGE_INCOMPLETE',
        { eventId }
      );
    }
    return target;
  }));
};

export interface TripletUnretimingStandaloneScoreEditorControllerV1
  extends Omit<TripletRetimingStandaloneScoreEditorController, 'profile'> {
  readonly profile: typeof tripletUnretimingBrowserAppProfile;
  readonly getTripletUnretimingState: () => Readonly<TripletUnretimingBrowserState>;
  readonly removeTripletFromCapturedEvents: () => Readonly<ScoreEditorBrowserAppSnapshot>;
}

export const attachTripletUnretimingToBrowserControllerV1 = (
  base: TripletRetimingStandaloneScoreEditorController,
  options: TripletUnretimingAttachmentOptionsV1 = {}
): Readonly<TripletUnretimingStandaloneScoreEditorControllerV1> => {
  const revisionIdFactory = options.revisionIdFactory ?? browserRevisionId;

  const state = (): Readonly<TripletUnretimingBrowserState> => {
    const documentValue = base.getDocument();
    if (documentValue === null || base.getTripletAuthoringState().capturedEventIds.length !== 3) {
      return Object.freeze({
        version: TRIPLET_UNRETIMING_BROWSER_VERSION,
        canRemoveTriplet: false,
        admissionReason: null
      });
    }
    try {
      const admission = analyzeTripletToStraightThreeUnretimingV4(
        documentValue.session.history.present.score,
        documentValue.session.history.present.notation,
        currentTargets(base)
      );
      return Object.freeze({
        version: TRIPLET_UNRETIMING_BROWSER_VERSION,
        canRemoveTriplet: admission.admitted,
        admissionReason: admission.reason
      });
    } catch (error) {
      const record = error !== null && typeof error === 'object'
        ? error as { readonly code?: unknown; readonly name?: unknown }
        : null;
      return Object.freeze({
        version: TRIPLET_UNRETIMING_BROWSER_VERSION,
        canRemoveTriplet: false,
        admissionReason: typeof record?.code === 'string'
          ? record.code
          : typeof record?.name === 'string'
            ? record.name
            : 'TRIPLET_UNRETIMING_ADMISSION_FAILED'
      });
    }
  };

  const controller: TripletUnretimingStandaloneScoreEditorControllerV1 = {
    ...base,
    profile: tripletUnretimingBrowserAppProfile,
    getTripletUnretimingState: state,
    removeTripletFromCapturedEvents: () => {
      const documentValue = base.getDocument();
      if (documentValue === null) {
        throw new TripletUnretimingBrowserError(
          'Create or open a score first.',
          'NO_DOCUMENT'
        );
      }
      const intent = Object.freeze({
        version: '1.0.0' as const,
        type: 'UNRETIMING_TRIPLET_TO_STRAIGHT_THREE' as const,
        targets: currentTargets(base)
      });
      const nextDocument = commitScoreEditorAppTripletToStraightThreeV4(
        documentValue,
        intent,
        Object.freeze({ nextRevisionId: revisionIdFactory() })
      );
      const snapshot = base.adoptValidatedSnapshot(nextDocument);
      base.clearTripletAuthoring();
      return snapshot;
    }
  };

  return Object.freeze(controller);
};
