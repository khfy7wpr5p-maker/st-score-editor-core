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

const validId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 256 && value === value.trim();

const validIdentity = (value: SuspiciousMeasureRenderIdentityV1): boolean =>
  validId(value.documentId) &&
  validId(value.revisionId) &&
  validId(value.renderEpoch) &&
  (value.sourceId === undefined || validId(value.sourceId));

const target = (value: unknown): SuspiciousMeasureTargetV1 => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('measure locator invalid');
  }
  const raw = value as Record<string, unknown>;
  if (
    !validId(raw.partId) ||
    !Number.isSafeInteger(raw.measureIndex) ||
    (raw.measureIndex as number) < 0 ||
    Object.keys(raw).some((key) => key !== 'partId' && key !== 'measureIndex')
  ) throw new TypeError('measure locator invalid');
  return { partId: raw.partId, measureIndex: raw.measureIndex as number };
};

export const createSuspiciousMeasureHighlightStateV1 = (input: Readonly<{
  current: SuspiciousMeasureRenderIdentityV1;
  findings: readonly SuspiciousMeasureFindingEvidenceV1[];
}>): Readonly<SuspiciousMeasureHighlightStateV1> => {
  if (!validIdentity(input.current) || !Array.isArray(input.findings)) {
    throw new TypeError('invalid highlight evidence');
  }

  const unique = new Map<string, SuspiciousMeasureTargetV1>();
  let acceptedFindingCount = 0;
  let rejectedFindingCount = 0;
  for (const finding of input.findings) {
    if (
      finding === null ||
      typeof finding !== 'object' ||
      !Array.isArray(finding.measureTargets)
    ) throw new TypeError('invalid highlight evidence');

    const current = input.current;
    if (
      finding.documentId !== current.documentId ||
      finding.revisionId !== current.revisionId ||
      finding.renderEpoch !== current.renderEpoch ||
      finding.sourceId !== current.sourceId ||
      finding.measureTargets.length !== 1
    ) {
      rejectedFindingCount += 1;
      continue;
    }

    const resolved = target(finding.measureTargets[0]);
    unique.set(`${resolved.partId}\u0000${resolved.measureIndex}`, resolved);
    acceptedFindingCount += 1;
  }

  const targets = [...unique.values()].sort((a, b) =>
    a.partId === b.partId ? a.measureIndex - b.measureIndex : a.partId.localeCompare(b.partId)
  );
  return Object.freeze({
    version: SUSPICIOUS_MEASURE_HIGHLIGHT_STATE_VERSION,
    documentId: input.current.documentId,
    revisionId: input.current.revisionId,
    renderEpoch: input.current.renderEpoch,
    ...(input.current.sourceId === undefined ? {} : { sourceId: input.current.sourceId }),
    targets: Object.freeze(targets),
    acceptedFindingCount,
    rejectedFindingCount,
    canonicalMutationAuthority: false,
    visibleErrorText: false,
    noteLevelColoring: false
  });
};
