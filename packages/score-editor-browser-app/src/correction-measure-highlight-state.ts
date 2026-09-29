export const SUSPICIOUS_MEASURE_HIGHLIGHT_STATE_VERSION = '1.0.0' as const;

export interface SuspiciousMeasureRenderIdentityV1 {
  readonly documentId: string;
  readonly revisionId: string;
  readonly renderEpoch: string;
  readonly sourceId?: string;
}

export interface SuspiciousMeasureTargetV1 {
  readonly partId: string;
  readonly measureIndex: number;
}

export interface SuspiciousMeasureFindingEvidenceV1 extends SuspiciousMeasureRenderIdentityV1 {
  readonly findingId: string;
  readonly measureTargets: readonly SuspiciousMeasureTargetV1[];
}

export interface SuspiciousMeasureHighlightStateV1 extends SuspiciousMeasureRenderIdentityV1 {
  readonly version: typeof SUSPICIOUS_MEASURE_HIGHLIGHT_STATE_VERSION;
  readonly targets: readonly Readonly<SuspiciousMeasureTargetV1>[];
  readonly acceptedFindingCount: number;
  readonly rejectedFindingCount: number;
  readonly canonicalMutationAuthority: false;
  readonly visibleErrorText: false;
  readonly noteLevelColoring: false;
}

const MAX_ID_LENGTH = 256;

const boundedId = (value: unknown, field: string): string => {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_ID_LENGTH ||
    value !== value.trim()
  ) {
    throw new TypeError(`${field} must be a non-empty bounded identifier.`);
  }
  return value;
};

const parseIdentity = (input: unknown, label: string): Readonly<SuspiciousMeasureRenderIdentityV1> => {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError(`${label} must be an object.`);
  }
  const value = input as Record<string, unknown>;
  const documentId = boundedId(value.documentId, `${label}.documentId`);
  const revisionId = boundedId(value.revisionId, `${label}.revisionId`);
  const renderEpoch = boundedId(value.renderEpoch, `${label}.renderEpoch`);
  const sourceId = value.sourceId;
  if (sourceId === undefined) {
    return Object.freeze({ documentId, revisionId, renderEpoch });
  }
  return Object.freeze({
    documentId,
    revisionId,
    renderEpoch,
    sourceId: boundedId(sourceId, `${label}.sourceId`)
  });
};

const parseMeasureTarget = (input: unknown): Readonly<SuspiciousMeasureTargetV1> => {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Suspicious measure locator must be an object.');
  }
  const value = input as Record<string, unknown>;
  const keys = Object.keys(value).sort();
  if (JSON.stringify(keys) !== JSON.stringify(['measureIndex', 'partId'])) {
    throw new TypeError('Suspicious measure locator field set is invalid.');
  }
  const partId = boundedId(value.partId, 'measure locator partId');
  const measureIndex = value.measureIndex;
  if (!Number.isSafeInteger(measureIndex) || (measureIndex as number) < 0) {
    throw new TypeError('Suspicious measure locator measureIndex must be a non-negative safe integer.');
  }
  return Object.freeze({ partId, measureIndex: measureIndex as number });
};

const sameSourceId = (left?: string, right?: string): boolean =>
  left === undefined ? right === undefined : left === right;

const identityMatches = (
  current: Readonly<SuspiciousMeasureRenderIdentityV1>,
  finding: Readonly<SuspiciousMeasureRenderIdentityV1>
): boolean =>
  current.documentId === finding.documentId &&
  current.revisionId === finding.revisionId &&
  current.renderEpoch === finding.renderEpoch &&
  sameSourceId(current.sourceId, finding.sourceId);

const targetKey = (target: Readonly<SuspiciousMeasureTargetV1>): string =>
  `${target.partId}\u0000${target.measureIndex}`;

export const createSuspiciousMeasureHighlightStateV1 = (input: Readonly<{
  current: SuspiciousMeasureRenderIdentityV1;
  findings: readonly SuspiciousMeasureFindingEvidenceV1[];
}>): Readonly<SuspiciousMeasureHighlightStateV1> => {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Suspicious measure highlight input must be an object.');
  }
  const current = parseIdentity(input.current, 'current');
  if (!Array.isArray(input.findings)) {
    throw new TypeError('Suspicious measure findings must be an array.');
  }

  const acceptedTargets = new Map<string, Readonly<SuspiciousMeasureTargetV1>>();
  let acceptedFindingCount = 0;
  let rejectedFindingCount = 0;

  for (const rawFinding of input.findings) {
    if (rawFinding === null || typeof rawFinding !== 'object' || Array.isArray(rawFinding)) {
      throw new TypeError('Suspicious measure finding must be an object.');
    }
    const findingValue = rawFinding as unknown as Record<string, unknown>;
    boundedId(findingValue.findingId, 'findingId');
    const findingIdentity = parseIdentity(findingValue, 'finding');
    const rawTargets = findingValue.measureTargets;
    if (!Array.isArray(rawTargets)) {
      throw new TypeError('Suspicious measure finding measureTargets must be an array.');
    }

    if (!identityMatches(current, findingIdentity) || rawTargets.length !== 1) {
      rejectedFindingCount += 1;
      continue;
    }

    const target = parseMeasureTarget(rawTargets[0]);
    acceptedTargets.set(targetKey(target), target);
    acceptedFindingCount += 1;
  }

  const targets = Object.freeze(
    [...acceptedTargets.values()].sort((left, right) =>
      left.partId === right.partId
        ? left.measureIndex - right.measureIndex
        : left.partId.localeCompare(right.partId)
    )
  );

  const base = {
    version: SUSPICIOUS_MEASURE_HIGHLIGHT_STATE_VERSION,
    documentId: current.documentId,
    revisionId: current.revisionId,
    renderEpoch: current.renderEpoch,
    targets,
    acceptedFindingCount,
    rejectedFindingCount,
    canonicalMutationAuthority: false as const,
    visibleErrorText: false as const,
    noteLevelColoring: false as const
  };

  return current.sourceId === undefined
    ? Object.freeze(base)
    : Object.freeze({ ...base, sourceId: current.sourceId });
};
