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
  analyzeGeneralizedTupletToStraightV4,
  FOUR_TO_THREE_TUPLET_PROFILE_V4,
  type GeneralizedTupletAdmissionV4
} from '../../editor-generalized-tuplet-admission-v4/src/index.js';
import {
  applyFreshFourToThreeTupletAdmissionV4,
  FourToThreeTupletUnretimingAuthoringV4Error,
  type FourToThreeTupletUnretimingAuthoringV4ErrorCode
} from './apply-admission.js';

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

type RecordValue = Record<string, unknown>;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

const isRecord = (value: unknown): value is RecordValue =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const exact = (value: unknown, keys: readonly string[]): value is RecordValue =>
  isRecord(value) &&
  JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());

const parseIntent = (raw: unknown): Readonly<UnretimingFourToThreeToStraightFourIntentV4> => {
  if (
    !exact(raw, ['version', 'type', 'targets']) ||
    raw.version !== FOUR_TO_THREE_TUPLET_UNRETIMING_AUTHORING_V4_VERSION ||
    raw.type !== 'UNRETIMING_FOUR_TO_THREE_TO_STRAIGHT_FOUR' ||
    !Array.isArray(raw.targets) ||
    raw.targets.length !== 4 ||
    !raw.targets.every(isRecord)
  ) {
    throw new FourToThreeTupletUnretimingAuthoringV4Error(
      'Exact 4:3 unretiming intent is invalid.',
      'INVALID_INTENT'
    );
  }

  return Object.freeze({
    version: FOUR_TO_THREE_TUPLET_UNRETIMING_AUTHORING_V4_VERSION,
    type: 'UNRETIMING_FOUR_TO_THREE_TO_STRAIGHT_FOUR',
    targets: Object.freeze(
      raw.targets.map(target => Object.freeze({ ...(target as unknown as EventAddressV3) }))
    )
  });
};

const assertRevision = (score: ScoreDocumentV3, nextRevisionId: string): void => {
  if (
    !ID.test(nextRevisionId) ||
    nextRevisionId === score.revision.id ||
    nextRevisionId === score.revision.parentId
  ) {
    throw new FourToThreeTupletUnretimingAuthoringV4Error(
      'A fresh stable next revision id is required.',
      'INVALID_REVISION_ID'
    );
  }
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
  assertRevision(score, options.nextRevisionId);

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
