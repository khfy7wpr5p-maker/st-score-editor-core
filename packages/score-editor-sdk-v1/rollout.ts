import {
  SCORE_EDITOR_SDK_V1_VERSION,
  type ScoreEditorSdkCapabilityIdV1,
  type ScoreEditorSdkV1
} from './src/index.js';

export const SCORE_EDITOR_SDK_ROLLOUT_V1_VERSION = '1.0.0' as const;

export const SCORE_EDITOR_SDK_OPTIONAL_FEATURE_IDS_V1 = Object.freeze([
  'renderer',
  'files',
  'recovery',
  'playback',
  'teacherWorkflow',
  'audioAudition'
] as const);

export type ScoreEditorSdkOptionalFeatureIdV1 = typeof SCORE_EDITOR_SDK_OPTIONAL_FEATURE_IDS_V1[number];

type AssertOptionalCapability<T extends ScoreEditorSdkCapabilityIdV1> = T;
type _OptionalCapabilityCheck = AssertOptionalCapability<ScoreEditorSdkOptionalFeatureIdV1>;

export interface ScoreEditorSdkFeatureFlagsV1 {
  readonly renderer: boolean;
  readonly files: boolean;
  readonly recovery: boolean;
  readonly playback: boolean;
  readonly teacherWorkflow: boolean;
  readonly audioAudition: boolean;
}

export const DEFAULT_SCORE_EDITOR_SDK_FEATURE_FLAGS_V1: Readonly<ScoreEditorSdkFeatureFlagsV1> = Object.freeze({
  renderer: false,
  files: false,
  recovery: false,
  playback: false,
  teacherWorkflow: false,
  audioAudition: false
});

export type ScoreEditorSdkFeatureStateReasonV1 =
  | 'ENABLED'
  | 'FLAG_DISABLED'
  | 'CAPABILITY_UNAVAILABLE';

export interface ScoreEditorSdkFeatureStateV1 {
  readonly version: typeof SCORE_EDITOR_SDK_ROLLOUT_V1_VERSION;
  readonly sdkVersion: typeof SCORE_EDITOR_SDK_V1_VERSION;
  readonly feature: ScoreEditorSdkOptionalFeatureIdV1;
  readonly requested: boolean;
  readonly capabilityAvailable: boolean;
  readonly enabled: boolean;
  readonly reason: ScoreEditorSdkFeatureStateReasonV1;
}

export interface ScoreEditorSdkRolloutSnapshotV1 {
  readonly version: typeof SCORE_EDITOR_SDK_ROLLOUT_V1_VERSION;
  readonly sdkVersion: typeof SCORE_EDITOR_SDK_V1_VERSION;
  readonly flags: Readonly<ScoreEditorSdkFeatureFlagsV1>;
  readonly features: readonly Readonly<ScoreEditorSdkFeatureStateV1>[];
}

export type ScoreEditorSdkRolloutErrorCodeV1 = 'INVALID_FEATURE_FLAGS';

export class ScoreEditorSdkRolloutV1Error extends Error {
  readonly code: ScoreEditorSdkRolloutErrorCodeV1;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ScoreEditorSdkRolloutV1Error';
    this.code = 'INVALID_FEATURE_FLAGS';
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

export interface ScoreEditorSdkCapabilityProbeV1 {
  readonly supports: (capability: ScoreEditorSdkCapabilityIdV1) => boolean;
}

export interface ScoreEditorSdkRolloutGateV1 {
  readonly version: typeof SCORE_EDITOR_SDK_ROLLOUT_V1_VERSION;
  readonly sdkVersion: typeof SCORE_EDITOR_SDK_V1_VERSION;
  readonly flags: Readonly<ScoreEditorSdkFeatureFlagsV1>;
  readonly getState: (feature: ScoreEditorSdkOptionalFeatureIdV1) => Readonly<ScoreEditorSdkFeatureStateV1>;
  readonly isEnabled: (feature: ScoreEditorSdkOptionalFeatureIdV1) => boolean;
  readonly snapshot: () => Readonly<ScoreEditorSdkRolloutSnapshotV1>;
}

const featureIdSet = new Set<string>(SCORE_EDITOR_SDK_OPTIONAL_FEATURE_IDS_V1);

const normalizeFeatureFlags = (input: unknown): Readonly<ScoreEditorSdkFeatureFlagsV1> => {
  if (input === undefined) return DEFAULT_SCORE_EDITOR_SDK_FEATURE_FLAGS_V1;
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new ScoreEditorSdkRolloutV1Error('Feature flags must be an object.');
  }

  const record = input as Record<string, unknown>;
  const unknown = Object.keys(record).filter((key) => !featureIdSet.has(key));
  if (unknown.length > 0) {
    throw new ScoreEditorSdkRolloutV1Error('Feature flags contain unsupported keys.', { unknown: Object.freeze([...unknown]) });
  }

  const resolved: Record<ScoreEditorSdkOptionalFeatureIdV1, boolean> = {
    renderer: false,
    files: false,
    recovery: false,
    playback: false,
    teacherWorkflow: false,
    audioAudition: false
  };

  for (const feature of SCORE_EDITOR_SDK_OPTIONAL_FEATURE_IDS_V1) {
    const value = record[feature];
    if (value === undefined) continue;
    if (typeof value !== 'boolean') {
      throw new ScoreEditorSdkRolloutV1Error('Feature flag values must be boolean.', { feature, valueType: typeof value });
    }
    resolved[feature] = value;
  }

  return Object.freeze({ ...resolved });
};

const stateFor = (
  probe: ScoreEditorSdkCapabilityProbeV1,
  flags: Readonly<ScoreEditorSdkFeatureFlagsV1>,
  feature: ScoreEditorSdkOptionalFeatureIdV1
): Readonly<ScoreEditorSdkFeatureStateV1> => {
  const requested = flags[feature];
  const capabilityAvailable = probe.supports(feature);
  const enabled = requested && capabilityAvailable;
  const reason: ScoreEditorSdkFeatureStateReasonV1 = enabled
    ? 'ENABLED'
    : requested
      ? 'CAPABILITY_UNAVAILABLE'
      : 'FLAG_DISABLED';

  return Object.freeze({
    version: SCORE_EDITOR_SDK_ROLLOUT_V1_VERSION,
    sdkVersion: SCORE_EDITOR_SDK_V1_VERSION,
    feature,
    requested,
    capabilityAvailable,
    enabled,
    reason
  });
};

export const createScoreEditorSdkRolloutGateV1 = (
  sdk: Pick<Readonly<ScoreEditorSdkV1>, 'supports'> | ScoreEditorSdkCapabilityProbeV1,
  featureFlags: unknown = undefined
): Readonly<ScoreEditorSdkRolloutGateV1> => {
  if (sdk === null || typeof sdk !== 'object' || typeof sdk.supports !== 'function') {
    throw new ScoreEditorSdkRolloutV1Error('Rollout gate requires a capability probe with supports().');
  }

  const flags = normalizeFeatureFlags(featureFlags);
  const getState = (feature: ScoreEditorSdkOptionalFeatureIdV1): Readonly<ScoreEditorSdkFeatureStateV1> => {
    if (!featureIdSet.has(feature)) {
      throw new ScoreEditorSdkRolloutV1Error('Unknown optional feature id.', { feature });
    }
    return stateFor(sdk, flags, feature);
  };

  const snapshot = (): Readonly<ScoreEditorSdkRolloutSnapshotV1> => Object.freeze({
    version: SCORE_EDITOR_SDK_ROLLOUT_V1_VERSION,
    sdkVersion: SCORE_EDITOR_SDK_V1_VERSION,
    flags,
    features: Object.freeze(SCORE_EDITOR_SDK_OPTIONAL_FEATURE_IDS_V1.map((feature) => getState(feature)))
  });

  return Object.freeze({
    version: SCORE_EDITOR_SDK_ROLLOUT_V1_VERSION,
    sdkVersion: SCORE_EDITOR_SDK_V1_VERSION,
    flags,
    getState,
    isEnabled: (feature: ScoreEditorSdkOptionalFeatureIdV1): boolean => getState(feature).enabled,
    snapshot
  });
};
