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
  readonly targets: readonly Readonly<SuspiciousMeasureTargetV1>[];
}

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 256 && value === value.trim();

export const createSuspiciousMeasureHighlightStateV1 = (input: Readonly<{
  current: SuspiciousMeasureRenderIdentityV1;
  findings: readonly SuspiciousMeasureFindingEvidenceV1[];
}>): Readonly<SuspiciousMeasureHighlightStateV1> => {
  const current = input.current;
  if (
    !id(current.documentId) || !id(current.revisionId) || !id(current.renderEpoch) ||
    (current.sourceId !== undefined && !id(current.sourceId)) || !Array.isArray(input.findings)
  ) throw new TypeError('invalid highlight evidence');

  const unique = new Map<string, SuspiciousMeasureTargetV1>();
  for (const finding of input.findings) {
    if (
      finding === null || typeof finding !== 'object' ||
      finding.documentId !== current.documentId ||
      finding.revisionId !== current.revisionId ||
      finding.renderEpoch !== current.renderEpoch ||
      finding.sourceId !== current.sourceId ||
      !Array.isArray(finding.measureTargets) ||
      finding.measureTargets.length !== 1
    ) continue;
    const value = finding.measureTargets[0];
    if (
      value === null || typeof value !== 'object' || !id(value.partId) ||
      !Number.isSafeInteger(value.measureIndex) || value.measureIndex < 0
    ) continue;
    unique.set(`${value.partId}\u0000${value.measureIndex}`, {
      partId: value.partId,
      measureIndex: value.measureIndex
    });
  }

  const targets = [...unique.values()].sort((a, b) =>
    a.partId === b.partId ? a.measureIndex - b.measureIndex : a.partId.localeCompare(b.partId)
  );
  return Object.freeze({
    documentId: current.documentId,
    revisionId: current.revisionId,
    renderEpoch: current.renderEpoch,
    ...(current.sourceId === undefined ? {} : { sourceId: current.sourceId }),
    targets: Object.freeze(targets)
  });
};
