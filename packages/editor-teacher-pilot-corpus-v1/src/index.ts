export const EDITOR_TEACHER_PILOT_CORPUS_V1_VERSION = '1.0.0' as const;
export const EDITOR_TEACHER_PILOT_CORPUS_V1_MAX_CASES = 5000 as const;
export const EDITOR_TEACHER_PILOT_CORPUS_V1_MAX_CAPABILITIES_PER_CASE = 64 as const;

export type TeacherPilotCorpusOutcomeV1 = 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_RUN';
export type TeacherPilotEvidenceLevelV1 = 'AUTOMATED' | 'TEACHER_PILOT' | 'PHYSICAL_DEVICE';
export type TeacherPilotObserverV1 = 'AUTOMATION' | 'TEACHER' | 'DEVICE_TESTER' | 'NONE';
export type TeacherPilotSourceKindV1 =
  | 'SYNTHETIC_FIXTURE'
  | 'REPOSITORY_FIXTURE'
  | 'USER_PROVIDED_LOCAL';
export type TeacherPilotRightsStatusV1 =
  | 'REPOSITORY_OWNED'
  | 'PUBLIC_DOMAIN'
  | 'USER_AUTHORIZED_PRIVATE'
  | 'UNKNOWN';

export interface TeacherPilotCorpusProvenanceV1 {
  readonly sourceKind: TeacherPilotSourceKindV1;
  readonly sourceRef: string;
  readonly rightsStatus: TeacherPilotRightsStatusV1;
  readonly containsPersonalData: boolean;
  readonly externalTrainingAuthorized: false;
}

export interface TeacherPilotDeviceEvidenceV1 {
  readonly hardware: string;
  readonly platform: string;
  readonly osVersion: string;
  readonly browser: string;
  readonly browserVersion: string;
}

export interface TeacherPilotVerificationEvidenceV1 {
  readonly level: TeacherPilotEvidenceLevelV1;
  readonly outcome: TeacherPilotCorpusOutcomeV1;
  readonly observer: TeacherPilotObserverV1;
  readonly evidenceRef: string | null;
  readonly device: TeacherPilotDeviceEvidenceV1 | null;
}

export interface TeacherPilotCorpusCaseV1 {
  readonly id: string;
  readonly title: string;
  readonly capabilities: readonly string[];
  readonly provenance: TeacherPilotCorpusProvenanceV1;
  readonly verification: TeacherPilotVerificationEvidenceV1;
}

export interface TeacherPilotCorpusV1 {
  readonly version: typeof EDITOR_TEACHER_PILOT_CORPUS_V1_VERSION;
  readonly kind: 'TEACHER_PILOT_CORPUS';
  readonly cases: readonly TeacherPilotCorpusCaseV1[];
  readonly caseCount: number;
  readonly externalTrainingAuthority: false;
  readonly productionReleaseAuthority: false;
}

export interface TeacherPilotOutcomeCountsV1 {
  readonly PASS: number;
  readonly FAIL: number;
  readonly BLOCKED: number;
  readonly NOT_RUN: number;
}

export interface TeacherPilotCapabilitySummaryV1 {
  readonly capability: string;
  readonly total: number;
  readonly outcomes: TeacherPilotOutcomeCountsV1;
}

export interface TeacherPilotCorpusMetricsV1 {
  readonly version: typeof EDITOR_TEACHER_PILOT_CORPUS_V1_VERSION;
  readonly kind: 'TEACHER_PILOT_CORPUS_METRICS';
  readonly totalCases: number;
  readonly outcomes: TeacherPilotOutcomeCountsV1;
  readonly automatedCases: number;
  readonly teacherPilotCases: number;
  readonly physicalDeviceCases: number;
  readonly teacherPilotPasses: number;
  readonly physicalDevicePasses: number;
  readonly humanTeacherEvidenceAvailable: boolean;
  readonly physicalDeviceEvidenceAvailable: boolean;
  readonly capabilitySummaries: readonly TeacherPilotCapabilitySummaryV1[];
  readonly externalTrainingAuthority: false;
  readonly productionReleaseAuthority: false;
}

export type TeacherPilotCorpusV1ErrorCode =
  | 'INVALID_CORPUS'
  | 'TOO_MANY_CASES'
  | 'DUPLICATE_CASE_ID'
  | 'INVALID_CASE'
  | 'INVALID_PROVENANCE'
  | 'EXTERNAL_TRAINING_AUTHORITY_INVALID'
  | 'INVALID_EVIDENCE'
  | 'PHYSICAL_DEVICE_EVIDENCE_REQUIRED'
  | 'TEACHER_EVIDENCE_REQUIRED';

export class TeacherPilotCorpusV1Error extends Error {
  readonly code: TeacherPilotCorpusV1ErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: TeacherPilotCorpusV1ErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'TeacherPilotCorpusV1Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

type MutableRecord = Record<string, unknown>;

const OUTCOMES = new Set<string>(['PASS', 'FAIL', 'BLOCKED', 'NOT_RUN']);
const EVIDENCE_LEVELS = new Set<string>(['AUTOMATED', 'TEACHER_PILOT', 'PHYSICAL_DEVICE']);
const OBSERVERS = new Set<string>(['AUTOMATION', 'TEACHER', 'DEVICE_TESTER', 'NONE']);
const SOURCE_KINDS = new Set<string>(['SYNTHETIC_FIXTURE', 'REPOSITORY_FIXTURE', 'USER_PROVIDED_LOCAL']);
const RIGHTS_STATUSES = new Set<string>(['REPOSITORY_OWNED', 'PUBLIC_DOMAIN', 'USER_AUTHORIZED_PRIVATE', 'UNKNOWN']);

const deepFreeze = <T>(value: T): Readonly<T> => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    if (Array.isArray(value)) {
      for (const item of value) deepFreeze(item);
    } else {
      for (const item of Object.values(value as MutableRecord)) deepFreeze(item);
    }
  }
  return value as Readonly<T>;
};

const isRecord = (value: unknown): value is MutableRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const requireNonEmpty = (value: unknown, field: string, caseId: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TeacherPilotCorpusV1Error(
      `Teacher pilot corpus ${field} must be a non-empty string.`,
      'INVALID_CASE',
      { caseId, field }
    );
  }
  return value.trim();
};

const requireEnum = <T extends string>(
  value: unknown,
  allowed: ReadonlySet<string>,
  field: string,
  caseId: string,
  code: TeacherPilotCorpusV1ErrorCode
): T => {
  if (typeof value !== 'string' || !allowed.has(value)) {
    throw new TeacherPilotCorpusV1Error(
      `Teacher pilot corpus ${field} is unsupported.`,
      code,
      { caseId, field, value }
    );
  }
  return value as T;
};

const requireBoolean = (
  value: unknown,
  field: string,
  caseId: string,
  code: TeacherPilotCorpusV1ErrorCode
): boolean => {
  if (typeof value !== 'boolean') {
    throw new TeacherPilotCorpusV1Error(
      `Teacher pilot corpus ${field} must be boolean.`,
      code,
      { caseId, field }
    );
  }
  return value;
};

const cloneDevice = (deviceInput: unknown, caseId: string): TeacherPilotDeviceEvidenceV1 => {
  if (!isRecord(deviceInput)) {
    throw new TeacherPilotCorpusV1Error(
      'Physical-device evidence requires a device descriptor object.',
      'PHYSICAL_DEVICE_EVIDENCE_REQUIRED',
      { caseId }
    );
  }
  return deepFreeze({
    hardware: requireNonEmpty(deviceInput.hardware, 'device.hardware', caseId),
    platform: requireNonEmpty(deviceInput.platform, 'device.platform', caseId),
    osVersion: requireNonEmpty(deviceInput.osVersion, 'device.osVersion', caseId),
    browser: requireNonEmpty(deviceInput.browser, 'device.browser', caseId),
    browserVersion: requireNonEmpty(deviceInput.browserVersion, 'device.browserVersion', caseId)
  }) as TeacherPilotDeviceEvidenceV1;
};

const cloneEvidence = (verificationInput: unknown, caseId: string): TeacherPilotVerificationEvidenceV1 => {
  if (!isRecord(verificationInput)) {
    throw new TeacherPilotCorpusV1Error('Corpus verification evidence must be an object.', 'INVALID_EVIDENCE', { caseId });
  }
  const level = requireEnum<TeacherPilotEvidenceLevelV1>(
    verificationInput.level, EVIDENCE_LEVELS, 'verification.level', caseId, 'INVALID_EVIDENCE'
  );
  const outcome = requireEnum<TeacherPilotCorpusOutcomeV1>(
    verificationInput.outcome, OUTCOMES, 'verification.outcome', caseId, 'INVALID_EVIDENCE'
  );
  const observer = requireEnum<TeacherPilotObserverV1>(
    verificationInput.observer, OBSERVERS, 'verification.observer', caseId, 'INVALID_EVIDENCE'
  );
  const evidenceRef = verificationInput.evidenceRef;
  const device = verificationInput.device;

  if (outcome === 'NOT_RUN') {
    if (observer !== 'NONE' || evidenceRef !== null || device !== null) {
      throw new TeacherPilotCorpusV1Error(
        'NOT_RUN evidence may not carry an observer, evidence reference, or device result.',
        'INVALID_EVIDENCE',
        { caseId, level }
      );
    }
    return deepFreeze({ level, outcome, observer, evidenceRef: null, device: null }) as TeacherPilotVerificationEvidenceV1;
  }

  const normalizedEvidenceRef = requireNonEmpty(evidenceRef, 'verification.evidenceRef', caseId);
  if (level === 'AUTOMATED') {
    if (observer !== 'AUTOMATION' || device !== null) {
      throw new TeacherPilotCorpusV1Error(
        'Automated evidence must be observed by AUTOMATION and cannot claim a physical device.',
        'INVALID_EVIDENCE',
        { caseId }
      );
    }
    return deepFreeze({ level, outcome, observer, evidenceRef: normalizedEvidenceRef, device: null }) as TeacherPilotVerificationEvidenceV1;
  }
  if (level === 'TEACHER_PILOT') {
    if (observer !== 'TEACHER' || device !== null) {
      throw new TeacherPilotCorpusV1Error(
        'Teacher-pilot evidence requires a TEACHER observer and cannot claim a physical-device result.',
        'TEACHER_EVIDENCE_REQUIRED',
        { caseId }
      );
    }
    return deepFreeze({ level, outcome, observer, evidenceRef: normalizedEvidenceRef, device: null }) as TeacherPilotVerificationEvidenceV1;
  }
  if (observer !== 'DEVICE_TESTER' || device === null) {
    throw new TeacherPilotCorpusV1Error(
      'Physical-device evidence requires DEVICE_TESTER observation and an explicit device descriptor.',
      'PHYSICAL_DEVICE_EVIDENCE_REQUIRED',
      { caseId }
    );
  }
  return deepFreeze({
    level,
    outcome,
    observer,
    evidenceRef: normalizedEvidenceRef,
    device: cloneDevice(device, caseId)
  }) as TeacherPilotVerificationEvidenceV1;
};

const cloneProvenance = (provenanceInput: unknown, caseId: string): TeacherPilotCorpusProvenanceV1 => {
  if (!isRecord(provenanceInput)) {
    throw new TeacherPilotCorpusV1Error('Corpus provenance must be an object.', 'INVALID_PROVENANCE', { caseId });
  }
  const sourceKind = requireEnum<TeacherPilotSourceKindV1>(
    provenanceInput.sourceKind, SOURCE_KINDS, 'provenance.sourceKind', caseId, 'INVALID_PROVENANCE'
  );
  const sourceRef = requireNonEmpty(provenanceInput.sourceRef, 'provenance.sourceRef', caseId);
  const rightsStatus = requireEnum<TeacherPilotRightsStatusV1>(
    provenanceInput.rightsStatus, RIGHTS_STATUSES, 'provenance.rightsStatus', caseId, 'INVALID_PROVENANCE'
  );
  const containsPersonalData = requireBoolean(
    provenanceInput.containsPersonalData, 'provenance.containsPersonalData', caseId, 'INVALID_PROVENANCE'
  );
  if (provenanceInput.externalTrainingAuthorized !== false) {
    throw new TeacherPilotCorpusV1Error(
      'Corpus metadata cannot grant external training authority.',
      'EXTERNAL_TRAINING_AUTHORITY_INVALID',
      { caseId }
    );
  }
  return deepFreeze({
    sourceKind,
    sourceRef,
    rightsStatus,
    containsPersonalData,
    externalTrainingAuthorized: false as const
  }) as TeacherPilotCorpusProvenanceV1;
};

const cloneCase = (input: TeacherPilotCorpusCaseV1): TeacherPilotCorpusCaseV1 => {
  if (!isRecord(input)) {
    throw new TeacherPilotCorpusV1Error('Teacher corpus case must be an object.', 'INVALID_CASE');
  }
  const id = requireNonEmpty(input.id, 'id', 'unknown');
  const title = requireNonEmpty(input.title, 'title', id);
  if (!Array.isArray(input.capabilities)
    || input.capabilities.length === 0
    || input.capabilities.length > EDITOR_TEACHER_PILOT_CORPUS_V1_MAX_CAPABILITIES_PER_CASE) {
    throw new TeacherPilotCorpusV1Error(
      'Each teacher corpus case requires a bounded non-empty capability list.',
      'INVALID_CASE',
      { caseId: id, capabilityCount: Array.isArray(input.capabilities) ? input.capabilities.length : null }
    );
  }
  const capabilities = input.capabilities.map(capability => requireNonEmpty(capability, 'capability', id));
  if (new Set(capabilities).size !== capabilities.length) {
    throw new TeacherPilotCorpusV1Error(
      'Teacher corpus case capabilities must be unique.',
      'INVALID_CASE',
      { caseId: id }
    );
  }
  return deepFreeze({
    id,
    title,
    capabilities: [...capabilities],
    provenance: cloneProvenance(input.provenance, id),
    verification: cloneEvidence(input.verification, id)
  }) as TeacherPilotCorpusCaseV1;
};

export const createTeacherPilotCorpusV1 = (
  casesInput: readonly TeacherPilotCorpusCaseV1[]
): Readonly<TeacherPilotCorpusV1> => {
  if (!Array.isArray(casesInput)) {
    throw new TeacherPilotCorpusV1Error('Teacher pilot corpus cases must be an array.', 'INVALID_CORPUS');
  }
  if (casesInput.length > EDITOR_TEACHER_PILOT_CORPUS_V1_MAX_CASES) {
    throw new TeacherPilotCorpusV1Error(
      'Teacher pilot corpus exceeds the bounded case limit.',
      'TOO_MANY_CASES',
      { count: casesInput.length, maximum: EDITOR_TEACHER_PILOT_CORPUS_V1_MAX_CASES }
    );
  }
  const cases = casesInput.map(cloneCase);
  const seen = new Set<string>();
  for (const entry of cases) {
    if (seen.has(entry.id)) {
      throw new TeacherPilotCorpusV1Error(
        'Teacher pilot corpus case IDs must be unique.',
        'DUPLICATE_CASE_ID',
        { caseId: entry.id }
      );
    }
    seen.add(entry.id);
  }
  return deepFreeze({
    version: EDITOR_TEACHER_PILOT_CORPUS_V1_VERSION,
    kind: 'TEACHER_PILOT_CORPUS' as const,
    cases,
    caseCount: cases.length,
    externalTrainingAuthority: false as const,
    productionReleaseAuthority: false as const
  }) as Readonly<TeacherPilotCorpusV1>;
};

const emptyOutcomes = (): TeacherPilotOutcomeCountsV1 => ({ PASS: 0, FAIL: 0, BLOCKED: 0, NOT_RUN: 0 });

const incrementOutcome = (
  counts: TeacherPilotOutcomeCountsV1,
  outcome: TeacherPilotCorpusOutcomeV1
): TeacherPilotOutcomeCountsV1 => {
  if (outcome === 'PASS') return { ...counts, PASS: counts.PASS + 1 };
  if (outcome === 'FAIL') return { ...counts, FAIL: counts.FAIL + 1 };
  if (outcome === 'BLOCKED') return { ...counts, BLOCKED: counts.BLOCKED + 1 };
  return { ...counts, NOT_RUN: counts.NOT_RUN + 1 };
};

export const summarizeTeacherPilotCorpusV1 = (
  corpusInput: TeacherPilotCorpusV1
): Readonly<TeacherPilotCorpusMetricsV1> => {
  if (
    corpusInput.version !== EDITOR_TEACHER_PILOT_CORPUS_V1_VERSION
    || corpusInput.kind !== 'TEACHER_PILOT_CORPUS'
    || corpusInput.externalTrainingAuthority !== false
    || corpusInput.productionReleaseAuthority !== false
    || corpusInput.caseCount !== corpusInput.cases.length
  ) {
    throw new TeacherPilotCorpusV1Error('Teacher pilot corpus envelope is stale or tampered.', 'INVALID_CORPUS');
  }
  const corpus = createTeacherPilotCorpusV1(corpusInput.cases);
  let outcomes = emptyOutcomes();
  let automatedCases = 0;
  let teacherPilotCases = 0;
  let physicalDeviceCases = 0;
  let teacherPilotPasses = 0;
  let physicalDevicePasses = 0;
  let teacherPilotObservedCases = 0;
  let physicalDeviceObservedCases = 0;
  const byCapability = new Map<string, { total: number; outcomes: TeacherPilotOutcomeCountsV1 }>();

  for (const entry of corpus.cases) {
    outcomes = incrementOutcome(outcomes, entry.verification.outcome);
    if (entry.verification.level === 'AUTOMATED') automatedCases += 1;
    if (entry.verification.level === 'TEACHER_PILOT') {
      teacherPilotCases += 1;
      if (entry.verification.outcome !== 'NOT_RUN') teacherPilotObservedCases += 1;
      if (entry.verification.outcome === 'PASS') teacherPilotPasses += 1;
    }
    if (entry.verification.level === 'PHYSICAL_DEVICE') {
      physicalDeviceCases += 1;
      if (entry.verification.outcome !== 'NOT_RUN') physicalDeviceObservedCases += 1;
      if (entry.verification.outcome === 'PASS') physicalDevicePasses += 1;
    }
    for (const capability of entry.capabilities) {
      const current = byCapability.get(capability) ?? { total: 0, outcomes: emptyOutcomes() };
      byCapability.set(capability, {
        total: current.total + 1,
        outcomes: incrementOutcome(current.outcomes, entry.verification.outcome)
      });
    }
  }

  const capabilitySummaries = [...byCapability.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([capability, value]) => deepFreeze({
      capability,
      total: value.total,
      outcomes: deepFreeze({ ...value.outcomes }) as TeacherPilotOutcomeCountsV1
    }) as TeacherPilotCapabilitySummaryV1);

  return deepFreeze({
    version: EDITOR_TEACHER_PILOT_CORPUS_V1_VERSION,
    kind: 'TEACHER_PILOT_CORPUS_METRICS' as const,
    totalCases: corpus.caseCount,
    outcomes: deepFreeze({ ...outcomes }) as TeacherPilotOutcomeCountsV1,
    automatedCases,
    teacherPilotCases,
    physicalDeviceCases,
    teacherPilotPasses,
    physicalDevicePasses,
    humanTeacherEvidenceAvailable: teacherPilotObservedCases > 0,
    physicalDeviceEvidenceAvailable: physicalDeviceObservedCases > 0,
    capabilitySummaries,
    externalTrainingAuthority: false as const,
    productionReleaseAuthority: false as const
  }) as Readonly<TeacherPilotCorpusMetricsV1>;
};