import { createScoreDocumentV3, type ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import {
  addressEntityV3,
  type EventAddressV3
} from '../../addressing-v3/src/index.js';
import {
  createNotationDocumentV4,
  type NotationDocumentV4
} from '../../notation-structure-v4/src/index.js';
import {
  analyzeTripletToStraightThreeUnretimingV4,
  type TupletUnretimingAdmissionV4
} from '../../editor-tuplet-unretiming-admission-v4/src/index.js';
import {
  applyTupletUnretimingMechanicsV4,
  freezeEventAddressTargetsV4,
  isExactRecordV4,
  isFreshRevisionIdV4,
  TupletAuthoringErrorBaseV4
} from '../../editor-tuplet-unretiming-mechanics-v4/src/index.js';

export const TUPLET_UNRETIMING_AUTHORING_V4_VERSION = '1.0.0' as const;

export interface UnretimingTripletToStraightThreeIntentV4 {
  readonly version: typeof TUPLET_UNRETIMING_AUTHORING_V4_VERSION;
  readonly type: 'UNRETIMING_TRIPLET_TO_STRAIGHT_THREE';
  readonly targets: readonly EventAddressV3[];
}

export interface TupletUnretimingAuthoringV4Options {
  readonly nextRevisionId: string;
}

export interface TupletUnretimingAuthoringV4Result {
  readonly version: typeof TUPLET_UNRETIMING_AUTHORING_V4_VERSION;
  readonly score: Readonly<ScoreDocumentV3>;
  readonly notation: Readonly<NotationDocumentV4>;
  readonly selection: EventAddressV3;
  readonly admission: Readonly<TupletUnretimingAdmissionV4>;
}

export type TupletUnretimingAuthoringV4ErrorCode =
  | 'INVALID_INTENT'
  | 'INVALID_REVISION_ID'
  | 'TIMING_NOT_ADMITTED'
  | 'TARGET_PATH_INVALID'
  | 'RESULT_INVALID';

export class TupletUnretimingAuthoringV4Error
  extends TupletAuthoringErrorBaseV4<TupletUnretimingAuthoringV4ErrorCode> {
  constructor(
    message: string,
    code: TupletUnretimingAuthoringV4ErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super('TupletUnretimingAuthoringV4Error', message, code, details);
  }
}

const parseIntent = (raw: unknown): Readonly<UnretimingTripletToStraightThreeIntentV4> => {
  if (
    !isExactRecordV4(raw, ['version', 'type', 'targets']) ||
    raw.version !== TUPLET_UNRETIMING_AUTHORING_V4_VERSION ||
    raw.type !== 'UNRETIMING_TRIPLET_TO_STRAIGHT_THREE' ||
    !Array.isArray(raw.targets) ||
    raw.targets.length !== 3
  ) {
    throw new TupletUnretimingAuthoringV4Error(
      'Triplet unretiming intent is invalid.',
      'INVALID_INTENT'
    );
  }
  return Object.freeze({
    version: TUPLET_UNRETIMING_AUTHORING_V4_VERSION,
    type: 'UNRETIMING_TRIPLET_TO_STRAIGHT_THREE',
    targets: freezeEventAddressTargetsV4(raw.targets)
  });
};

const assertRevision = (score: ScoreDocumentV3, nextRevisionId: string): void => {
  if (!isFreshRevisionIdV4(score, nextRevisionId)) {
    throw new TupletUnretimingAuthoringV4Error(
      'A fresh stable next revision id is required.',
      'INVALID_REVISION_ID'
    );
  }
};

const mechanicsError = (
  message: string,
  code: 'TARGET_PATH_INVALID' | 'RESULT_INVALID',
  details: Record<string, unknown> = {}
): TupletUnretimingAuthoringV4Error =>
  new TupletUnretimingAuthoringV4Error(message, code, details);

const mutate = (
  score: ScoreDocumentV3,
  notation: NotationDocumentV4,
  admission: TupletUnretimingAdmissionV4,
  nextRevisionId: string
): Readonly<{ score: Readonly<ScoreDocumentV3>; notation: Readonly<NotationDocumentV4> }> =>
  applyTupletUnretimingMechanicsV4(
    score,
    notation,
    admission,
    nextRevisionId,
    {
      expectedTargetCount: 3,
      label: 'Triplet unretiming',
      error: mechanicsError
    }
  );

export const executeTripletToStraightThreeUnretimingV4 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  rawIntent: unknown,
  options: TupletUnretimingAuthoringV4Options
): Readonly<TupletUnretimingAuthoringV4Result> => {
  const score = createScoreDocumentV3(scoreInput);
  const notation = createNotationDocumentV4(score, notationInput);
  const intent = parseIntent(rawIntent);
  assertRevision(score, options.nextRevisionId);

  const admission = analyzeTripletToStraightThreeUnretimingV4(
    score,
    notation,
    intent.targets
  );
  if (!admission.admitted) {
    throw new TupletUnretimingAuthoringV4Error(
      'Triplet to straight-three unretiming was not admitted.',
      'TIMING_NOT_ADMITTED',
      { reason: admission.reason, couplingReasons: admission.couplingReasons }
    );
  }

  const mutated = mutate(score, notation, admission, options.nextRevisionId);
  const selection = addressEntityV3(mutated.score, admission.targetEventIds[0]);
  if (selection.kind !== 'event') {
    throw new TupletUnretimingAuthoringV4Error(
      'Triplet unretiming result selection changed kind.',
      'RESULT_INVALID'
    );
  }

  return Object.freeze({
    version: TUPLET_UNRETIMING_AUTHORING_V4_VERSION,
    score: mutated.score,
    notation: mutated.notation,
    selection,
    admission
  });
};
