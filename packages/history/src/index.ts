import type { ScoreDocument } from '../../score-model/src/index.js';

export const HISTORY_STATE_VERSION = '1.0.0' as const;

export interface HistoryState {
  readonly contractVersion: typeof HISTORY_STATE_VERSION;
  readonly documentId: string;
  readonly past: readonly ScoreDocument[];
  readonly present: ScoreDocument;
  readonly future: readonly ScoreDocument[];
}

export type HistoryErrorCode = 'HISTORY_BOUNDARY' | 'HISTORY_DOCUMENT_MISMATCH' | 'HISTORY_LINEAGE_MISMATCH';

export class HistoryError extends Error {
  readonly code: HistoryErrorCode;
  constructor(message: string, code: HistoryErrorCode) {
    super(message);
    this.name = 'HistoryError';
    this.code = code;
    Object.freeze(this);
  }
}

const freezeHistory = (state: HistoryState): Readonly<HistoryState> => Object.freeze({
  ...state,
  past: Object.freeze([...state.past]),
  future: Object.freeze([...state.future])
});

export const createHistory = (document: ScoreDocument): Readonly<HistoryState> => freezeHistory({
  contractVersion: HISTORY_STATE_VERSION,
  documentId: document.id,
  past: [],
  present: document,
  future: []
});

export const commitHistory = (history: HistoryState, next: ScoreDocument): Readonly<HistoryState> => {
  if (next.id !== history.documentId) throw new HistoryError('Cannot commit another document into history.', 'HISTORY_DOCUMENT_MISMATCH');
  if (next.revision.parentId !== history.present.revision.id) throw new HistoryError('Next revision is not a direct child of history present.', 'HISTORY_LINEAGE_MISMATCH');
  return freezeHistory({
    contractVersion: HISTORY_STATE_VERSION,
    documentId: history.documentId,
    past: [...history.past, history.present],
    present: next,
    future: []
  });
};

export const undoHistory = (history: HistoryState): Readonly<HistoryState> => {
  const previous = history.past[history.past.length - 1];
  if (previous === undefined) throw new HistoryError('No earlier revision is available.', 'HISTORY_BOUNDARY');
  return freezeHistory({
    contractVersion: HISTORY_STATE_VERSION,
    documentId: history.documentId,
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future]
  });
};

export const redoHistory = (history: HistoryState): Readonly<HistoryState> => {
  const next = history.future[0];
  if (next === undefined) throw new HistoryError('No later revision is available.', 'HISTORY_BOUNDARY');
  if (next.revision.parentId !== history.present.revision.id) throw new HistoryError('Redo revision lineage no longer matches present.', 'HISTORY_LINEAGE_MISMATCH');
  return freezeHistory({
    contractVersion: HISTORY_STATE_VERSION,
    documentId: history.documentId,
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1)
  });
};
