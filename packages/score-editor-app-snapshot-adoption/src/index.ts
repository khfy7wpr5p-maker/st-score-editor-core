import { createScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import { createNotationDocumentV4 } from '../../notation-structure-v4/src/index.js';
import { createEditorSessionV4 } from '../../editor-session-controller-v4/src/index.js';
import {
  SCORE_EDITOR_APP_DOCUMENT_VERSION,
  type AppDocumentOrigin,
  type ScoreEditorAppDocument
} from '../../score-editor-app-document/src/index.js';

export const SCORE_EDITOR_APP_SNAPSHOT_ADOPTION_VERSION = '1.0.0' as const;

export type ScoreEditorAppSnapshotAdoptionErrorCode =
  | 'SNAPSHOT_DOCUMENT_INVALID'
  | 'SNAPSHOT_METADATA_INVALID';

export class ScoreEditorAppSnapshotAdoptionError extends Error {
  readonly code: ScoreEditorAppSnapshotAdoptionErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(message: string, code: ScoreEditorAppSnapshotAdoptionErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ScoreEditorAppSnapshotAdoptionError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const title = (value: unknown): string => {
  if (typeof value !== 'string' || value.length === 0 || value.length > 256 || value !== value.trim()) {
    throw new ScoreEditorAppSnapshotAdoptionError('Snapshot title is invalid.', 'SNAPSHOT_METADATA_INVALID');
  }
  return value;
};

const origin = (value: unknown): AppDocumentOrigin => {
  if (value !== 'NEW' && value !== 'MUSICXML') {
    throw new ScoreEditorAppSnapshotAdoptionError('Snapshot origin is invalid.', 'SNAPSHOT_METADATA_INVALID');
  }
  return value;
};

export const adoptScoreEditorAppDocumentSnapshot = (
  input: ScoreEditorAppDocument
): Readonly<ScoreEditorAppDocument> => {
  if (input.version !== SCORE_EDITOR_APP_DOCUMENT_VERSION) {
    throw new ScoreEditorAppSnapshotAdoptionError('Snapshot app document version is invalid.', 'SNAPSHOT_METADATA_INVALID');
  }
  let score;
  let notation;
  try {
    score = createScoreDocumentV3(input.session.history.present.score);
    notation = createNotationDocumentV4(score, input.session.history.present.notation);
  } catch (error) {
    throw new ScoreEditorAppSnapshotAdoptionError('Snapshot canonical score/notation validation failed.', 'SNAPSHOT_DOCUMENT_INVALID', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
  const savedRevisionId = input.savedRevisionId;
  if (savedRevisionId !== null && (typeof savedRevisionId !== 'string' || savedRevisionId.length === 0)) {
    throw new ScoreEditorAppSnapshotAdoptionError('Snapshot saved revision id is invalid.', 'SNAPSHOT_METADATA_INVALID');
  }
  const session = createEditorSessionV4(score, notation);
  return Object.freeze({
    version: SCORE_EDITOR_APP_DOCUMENT_VERSION,
    title: title(input.title),
    origin: origin(input.origin),
    session,
    savedRevisionId,
    dirty: savedRevisionId === null || savedRevisionId !== score.revision.id
  });
};
