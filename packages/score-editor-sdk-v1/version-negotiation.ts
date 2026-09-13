import {
  SCORE_EDITOR_SDK_V1_VERSION,
  createScoreEditorSdkV1,
  type ScoreEditorSdkV1
} from './src/index.js';

export const SCORE_EDITOR_SDK_NEGOTIATION_VERSION = '1.0.0' as const;
export const SUPPORTED_SCORE_EDITOR_SDK_VERSIONS_V1 = Object.freeze([
  SCORE_EDITOR_SDK_V1_VERSION
] as const);

export interface ScoreEditorSdkVersionRequestV1 {
  readonly version: typeof SCORE_EDITOR_SDK_NEGOTIATION_VERSION;
  readonly acceptedVersions: readonly string[];
}

export interface NegotiatedScoreEditorSdkV1 {
  readonly negotiationVersion: typeof SCORE_EDITOR_SDK_NEGOTIATION_VERSION;
  readonly selectedVersion: typeof SCORE_EDITOR_SDK_V1_VERSION;
  readonly sdk: Readonly<ScoreEditorSdkV1>;
}

export interface ScoreEditorSdkNegotiationErrorV1 {
  readonly version: typeof SCORE_EDITOR_SDK_NEGOTIATION_VERSION;
  readonly code: 'INVALID_VERSION_REQUEST' | 'INCOMPATIBLE_SDK_VERSION';
  readonly message: string;
  readonly acceptedVersions: readonly string[];
  readonly supportedVersions: readonly string[];
}

export type ScoreEditorSdkNegotiationResultV1 =
  | Readonly<{ readonly ok: true; readonly value: Readonly<NegotiatedScoreEditorSdkV1> }>
  | Readonly<{ readonly ok: false; readonly error: Readonly<ScoreEditorSdkNegotiationErrorV1> }>;

const fail = (
  code: ScoreEditorSdkNegotiationErrorV1['code'],
  message: string,
  acceptedVersions: readonly string[]
): Readonly<ScoreEditorSdkNegotiationResultV1> => Object.freeze({
  ok: false as const,
  error: Object.freeze({
    version: SCORE_EDITOR_SDK_NEGOTIATION_VERSION,
    code,
    message,
    acceptedVersions: Object.freeze([...acceptedVersions]),
    supportedVersions: SUPPORTED_SCORE_EDITOR_SDK_VERSIONS_V1
  })
});

const cleanAcceptedVersions = (input: unknown): readonly string[] | null => {
  if (!Array.isArray(input) || input.length === 0 || input.length > 16) return null;
  const accepted: string[] = [];
  for (const item of input) {
    if (typeof item !== 'string' || item.length === 0 || item.length > 32 || item !== item.trim()) return null;
    if (!accepted.includes(item)) accepted.push(item);
  }
  return Object.freeze(accepted);
};

export const negotiateScoreEditorSdkV1 = (
  request: ScoreEditorSdkVersionRequestV1
): Readonly<ScoreEditorSdkNegotiationResultV1> => {
  const accepted = cleanAcceptedVersions(request?.acceptedVersions);
  if (request?.version !== SCORE_EDITOR_SDK_NEGOTIATION_VERSION || accepted === null) {
    return fail(
      'INVALID_VERSION_REQUEST',
      'SDK version negotiation request is invalid.',
      Array.isArray(request?.acceptedVersions)
        ? request.acceptedVersions.filter((value): value is string => typeof value === 'string')
        : []
    );
  }
  if (!accepted.includes(SCORE_EDITOR_SDK_V1_VERSION)) {
    return fail(
      'INCOMPATIBLE_SDK_VERSION',
      'No requested SDK contract version is supported by this build.',
      accepted
    );
  }
  return Object.freeze({
    ok: true as const,
    value: Object.freeze({
      negotiationVersion: SCORE_EDITOR_SDK_NEGOTIATION_VERSION,
      selectedVersion: SCORE_EDITOR_SDK_V1_VERSION,
      sdk: createScoreEditorSdkV1()
    })
  });
};
