import { createScoreDocumentV3, type ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import {
  addressEntityV3,
  SEMANTIC_ADDRESS_V3_VERSION,
  type EventAddressV3
} from '../../addressing-v3/src/index.js';
import {
  createNotationDocumentV4,
  type NotationDocumentV4
} from '../../notation-structure-v4/src/index.js';
import {
  analyzeGeneralizedTupletToStraightV4,
  FOUR_TO_THREE_TUPLET_PROFILE_V4,
  type GeneralizedTupletAdmissionV4
} from '../../editor-generalized-tuplet-admission-v4/src/index.js';
import {
  applyFreshFourToThreeTupletAdmissionV4,
  FourToThreeTupletUnretimingAuthoringV4Error,
  type FourToThreeTupletUnretimingAuthoringV4ErrorCode
} from './apply-admission.js';
import {
  assertFreshRevisionIdV4,
  freezeEventAddressTargetsV4,
  isExactRecordV4
} from '../../editor-tuplet-unretiming-mechanics-v4/src/index.js';

export { FourToThreeTupletUnretimingAuthoringV4Error };
export type { FourToThreeTupletUnretimingAuthoringV4ErrorCode };

export const FOUR_TO_THREE_TUPLET_UNRETIMING_AUTHORING_V4_VERSION = '1.0.0' as const;

export interface UnretimingFourToThreeToStraightFourIntentV4 {
  readonly version: typeof FOUR_TO_THREE_TUPLET_UNRETIMING_AUTHORING_V4_VERSION;
  readonly type: 'UNRETIMING_FOUR_TO_THREE_TO_STRAIGHT_FOUR';
  readonly targets: readonly EventAddressV3[];
}

export interface FourToThreeTupletUnretimingAuthoringV4Options {
  readonly nextRevisionId: string;
}

export interface FourToThreeTupletUnretimingAuthoringV4Result {
  readonly version: typeof FOUR_TO_THREE_TUPLET_UNRETIMING_AUTHORING_V4_VERSION;
  readonly score: Readonly<ScoreDocumentV3>;
  readonly notation: Readonly<NotationDocumentV4>;
  readonly selection: EventAddressV3;
  readonly admission: Readonly<GeneralizedTupletAdmissionV4>;
}

const EVENT_ADDRESS_KEYS = [
  'contractVersion',
  'kind',
  'documentId',
  'revisionId',
  'partId',
  'staffId',
  'frameId',
  'measureId',
  'voiceId',
  'eventId'
] as const;

const isEventAddressRecord = (value: unknown): value is EventAddressV3 =>
  isExactRecordV4(value, EVENT_ADDRESS_KEYS) &&
  value.contractVersion === SEMANTIC_ADDRESS_V3_VERSION &&
  value.kind === 'event' &&
  typeof value.documentId === 'string' &&
  typeof value.revisionId === 'string' &&
  typeof value.partId === 'string' &&
  typeof value.staffId === 'string' &&
  typeof value.frameId === 'string' &&
  typeof value.measureId === 'string' &&
  typeof value.voiceId === 'string' &&
  typeof value.eventId === 'string';

const parseIntent = (raw: unknown): Readonly<UnretimingFourToThreeToStraightFourIntentV4> => {
  if (
    !isExactRecordV4(raw, ['version', 'type', 'targets']) ||
    raw.version !== FOUR_TO_THREE_TUPLET_UNRETIMING_AUTHORING_V4_VERSION ||
    raw.type !== 'UNRETIMING_FOUR_TO_THREE_TO_STRAIGHT_FOUR' ||
    !Array.isArray(raw.targets) ||
    raw.targets.length !== 4 ||
    !raw.targets.every(isEventAddressRecord)
  ) {
    throw new FourToThreeTupletUnretimingAuthoringV4Error(
      'Exact 4:3 unretiming intent is invalid.',
      'INVALID_INTENT'
    );
  }

  return Object.freeze({
    version: FOUR_TO_THREE_TUPLET_UNRETIMING_AUTHORING_V4_VERSION,
    type: 'UNRETIMING_FOUR_TO_THREE_TO_STRAIGHT_FOUR',
    targets: freezeEventAddressTargetsV4(raw.targets)
  });
};


export const executeFourToThreeTupletToStraightFourUnretimingV4 = (
  scoreInput: ScoreDocumentV3,
  notationInput: NotationDocumentV4,
  rawIntent: unknown,
  options: FourToThreeTupletUnretimingAuthoringV4Options
): Readonly<FourToThreeTupletUnretimingAuthoringV4Result> => {
  const score = createScoreDocumentV3(scoreInput);
  const notation = createNotationDocumentV4(score, notationInput);
  const intent = parseIntent(rawIntent);
  assertFreshRevisionIdV4(
    score,
    options.nextRevisionId,
    () => new FourToThreeTupletUnretimingAuthoringV4Error(
      'A fresh stable next revision id is required.',
      'INVALID_REVISION_ID'
    )
  );

  const admission = analyzeGeneralizedTupletToStraightV4(
    score,
    notation,
    intent.targets,
    FOUR_TO_THREE_TUPLET_PROFILE_V4
  );
  if (!admission.admitted) {
    throw new FourToThreeTupletUnretimingAuthoringV4Error(
      'Exact 4:3 tuplet to straight-four unretiming was not admitted.',
      'TIMING_NOT_ADMITTED',
      {
        reason: admission.reason,
        couplingReasons: admission.couplingReasons
      }
    );
  }

  const mutated = applyFreshFourToThreeTupletAdmissionV4(
    score,
    notation,
    admission,
    options.nextRevisionId
  );

  const selection = addressEntityV3(mutated.score, admission.targetEventIds[0]!);
  if (selection.kind !== 'event') {
    throw new FourToThreeTupletUnretimingAuthoringV4Error(
      '4:3 unretiming result selection changed semantic kind.',
      'RESULT_INVALID'
    );
  }

  return Object.freeze({
    version: FOUR_TO_THREE_TUPLET_UNRETIMING_AUTHORING_V4_VERSION,
    score: mutated.score,
    notation: mutated.notation,
    selection,
    admission
  });
};
