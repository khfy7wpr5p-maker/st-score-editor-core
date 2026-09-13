import { createScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import { createNotationDocumentV4 } from '../../notation-structure-v4/src/index.js';
import { resolveSemanticAddressV3, type SemanticAddressV3 } from '../../addressing-v3/src/index.js';
import {
  EDITOR_HISTORY_V4_VERSION,
  type EditorHistoryStateV4,
  type EditorSnapshotV4
} from '../../editor-history-v4/src/index.js';
import {
  createEditorSessionV4WithRendererProfile,
  type EditorSessionStateV4
} from '../../editor-session-controller-v4/src/index.js';
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

const pair = (input: EditorSnapshotV4): Readonly<EditorSnapshotV4> => {
  const score = createScoreDocumentV3(input.score);
  const notation = createNotationDocumentV4(score, input.notation);
  return Object.freeze({ score, notation });
};

const history = (input: EditorHistoryStateV4): Readonly<EditorHistoryStateV4> => {
  if (input.version !== EDITOR_HISTORY_V4_VERSION) {
    throw new ScoreEditorAppSnapshotAdoptionError('Snapshot history version is invalid.', 'SNAPSHOT_DOCUMENT_INVALID');
  }
  const past = Object.freeze(input.past.map(pair));
  const present = pair(input.present);
  const future = Object.freeze(input.future.map(pair));
  const timeline = [...past, present, ...future];
  const documentId = present.score.id;
  const revisionIds = new Set<string>();
  let previous: Readonly<EditorSnapshotV4> | null = null;
  for (const current of timeline) {
    if (current.score.id !== documentId) {
      throw new ScoreEditorAppSnapshotAdoptionError('Snapshot history crosses canonical document identity.', 'SNAPSHOT_DOCUMENT_INVALID');
    }
    const revisionId = current.score.revision.id;
    if (revisionIds.has(revisionId)) {
      throw new ScoreEditorAppSnapshotAdoptionError('Snapshot history reuses a canonical revision identity.', 'SNAPSHOT_DOCUMENT_INVALID');
    }
    revisionIds.add(revisionId);
    if (previous !== null && current.score.revision.parentId !== previous.score.revision.id) {
      throw new ScoreEditorAppSnapshotAdoptionError('Snapshot history is not a direct-child revision chain.', 'SNAPSHOT_DOCUMENT_INVALID');
    }
    previous = current;
  }
  return Object.freeze({
    version: EDITOR_HISTORY_V4_VERSION,
    past,
    present,
    future
  });
};

const selection = (
  score: EditorSnapshotV4['score'],
  value: SemanticAddressV3 | null
): SemanticAddressV3 | null => {
  if (value === null) return null;
  resolveSemanticAddressV3(score, value);
  return Object.freeze({ ...value }) as SemanticAddressV3;
};

export const adoptScoreEditorAppDocumentSnapshot = (
  input: ScoreEditorAppDocument
): Readonly<ScoreEditorAppDocument> => {
  if (input.version !== SCORE_EDITOR_APP_DOCUMENT_VERSION) {
    throw new ScoreEditorAppSnapshotAdoptionError('Snapshot app document version is invalid.', 'SNAPSHOT_METADATA_INVALID');
  }
  let validatedHistory: Readonly<EditorHistoryStateV4>;
  let session: Readonly<EditorSessionStateV4>;
  try {
    validatedHistory = history(input.session.history);
    const present = validatedHistory.present;
    const baseSession = createEditorSessionV4WithRendererProfile(
      present.score,
      present.notation,
      input.session.renderRequest.renderer
    );
    const validatedSelection = selection(present.score, input.session.selection);
    if (
      typeof input.session.status?.code !== 'string' || input.session.status.code.length === 0 ||
      typeof input.session.status?.message !== 'string' || input.session.status.message.length === 0
    ) {
      throw new ScoreEditorAppSnapshotAdoptionError('Snapshot session status is invalid.', 'SNAPSHOT_DOCUMENT_INVALID');
    }
    session = Object.freeze({
      ...baseSession,
      history: validatedHistory,
      selection: validatedSelection,
      status: Object.freeze({
        code: input.session.status.code,
        message: input.session.status.message
      })
    });
  } catch (error) {
    if (error instanceof ScoreEditorAppSnapshotAdoptionError) throw error;
    throw new ScoreEditorAppSnapshotAdoptionError('Snapshot canonical score/notation/history validation failed.', 'SNAPSHOT_DOCUMENT_INVALID', {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
  const savedRevisionId = input.savedRevisionId;
  if (savedRevisionId !== null && (typeof savedRevisionId !== 'string' || savedRevisionId.length === 0)) {
    throw new ScoreEditorAppSnapshotAdoptionError('Snapshot saved revision id is invalid.', 'SNAPSHOT_METADATA_INVALID');
  }
  const score = validatedHistory.present.score;
  return Object.freeze({
    version: SCORE_EDITOR_APP_DOCUMENT_VERSION,
    title: title(input.title),
    origin: origin(input.origin),
    session,
    savedRevisionId,
    dirty: savedRevisionId === null || savedRevisionId !== score.revision.id
  });
};