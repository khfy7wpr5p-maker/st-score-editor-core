import type { ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import type { NotationDocumentV4 } from '../../notation-structure-v4/src/index.js';
import type { GeneralizedTupletAdmissionV4 } from '../../editor-generalized-tuplet-admission-v4/src/index.js';
import { applyTupletUnretimingMechanicsV4 } from '../../editor-tuplet-unretiming-mechanics-v4/src/index.js';

export type FourToThreeTupletUnretimingAuthoringV4ErrorCode =
  | 'INVALID_INTENT'
  | 'INVALID_REVISION_ID'
  | 'TIMING_NOT_ADMITTED'
  | 'TARGET_PATH_INVALID'
  | 'RESULT_INVALID';

export class FourToThreeTupletUnretimingAuthoringV4Error extends Error {
  readonly code: FourToThreeTupletUnretimingAuthoringV4ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: FourToThreeTupletUnretimingAuthoringV4ErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'FourToThreeTupletUnretimingAuthoringV4Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const mechanicsError = (
  message: string,
  code: 'TARGET_PATH_INVALID' | 'RESULT_INVALID',
  details: Record<string, unknown> = {}
): FourToThreeTupletUnretimingAuthoringV4Error =>
  new FourToThreeTupletUnretimingAuthoringV4Error(message, code, details);

export const applyFreshFourToThreeTupletAdmissionV4 = (
  score: ScoreDocumentV3,
  notation: NotationDocumentV4,
  admission: GeneralizedTupletAdmissionV4,
  nextRevisionId: string
): Readonly<{ score: Readonly<ScoreDocumentV3>; notation: Readonly<NotationDocumentV4> }> => {
  if (
    !admission.admitted ||
    admission.documentId !== score.id ||
    admission.revisionId !== score.revision.id ||
    admission.profile.actualNotes !== 4 ||
    admission.profile.normalNotes !== 3 ||
    admission.profile.targetCardinality !== 4
  ) {
    throw new FourToThreeTupletUnretimingAuthoringV4Error(
      'Admitted 4:3 unretiming plan is incomplete or stale.',
      'RESULT_INVALID'
    );
  }

  return applyTupletUnretimingMechanicsV4(
    score,
    notation,
    admission,
    nextRevisionId,
    {
      expectedTargetCount: 4,
      label: '4:3 unretiming',
      error: mechanicsError
    }
  );
};
