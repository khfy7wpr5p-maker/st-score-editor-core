import { createScoreDocumentV3, type ScoreDocumentV3 } from '../../score-model-v3/src/index.js';
import { createNotationDocumentV4, type NotationDocumentV4 } from '../../notation-structure-v4/src/index.js';

export const EDITOR_HISTORY_V4_VERSION = '4.0.0' as const;
export interface EditorSnapshotV4 { readonly score: Readonly<ScoreDocumentV3>; readonly notation: Readonly<NotationDocumentV4> }
export interface EditorHistoryStateV4 { readonly version: typeof EDITOR_HISTORY_V4_VERSION; readonly past: readonly EditorSnapshotV4[]; readonly present: EditorSnapshotV4; readonly future: readonly EditorSnapshotV4[] }
export class EditorHistoryV4Error extends Error {
  readonly code: 'INVALID_PAIR' | 'NON_DIRECT_CHILD' | 'NO_HISTORY';
  constructor(message: string, code: 'INVALID_PAIR' | 'NON_DIRECT_CHILD' | 'NO_HISTORY') { super(message); this.name = 'EditorHistoryV4Error'; this.code = code; }
}
const pair = (scoreInput: ScoreDocumentV3, notationInput: NotationDocumentV4): EditorSnapshotV4 => {
  const score = createScoreDocumentV3(scoreInput);
  const notation = createNotationDocumentV4(score, notationInput);
  return Object.freeze({ score, notation });
};
export const createEditorHistoryV4 = (score: ScoreDocumentV3, notation: NotationDocumentV4): Readonly<EditorHistoryStateV4> =>
  Object.freeze({ version: EDITOR_HISTORY_V4_VERSION, past: Object.freeze([]), present: pair(score, notation), future: Object.freeze([]) });
export const commitEditorHistoryV4 = (history: EditorHistoryStateV4, nextScore: ScoreDocumentV3, nextNotation: NotationDocumentV4): Readonly<EditorHistoryStateV4> => {
  const next = pair(nextScore, nextNotation);
  if (next.score.revision.parentId !== history.present.score.revision.id) throw new EditorHistoryV4Error('V4 history accepts only direct-child revisions.', 'NON_DIRECT_CHILD');
  return Object.freeze({ version: EDITOR_HISTORY_V4_VERSION, past: Object.freeze([...history.past, history.present]), present: next, future: Object.freeze([]) });
};
export const navigateEditorHistoryV4 = (history: EditorHistoryStateV4, direction: 'UNDO' | 'REDO'): Readonly<EditorHistoryStateV4> => {
  if (direction === 'UNDO') {
    const previous = history.past.at(-1);
    if (!previous) throw new EditorHistoryV4Error('No v4 undo snapshot exists.', 'NO_HISTORY');
    return Object.freeze({ version: EDITOR_HISTORY_V4_VERSION, past: Object.freeze(history.past.slice(0, -1)), present: previous, future: Object.freeze([history.present, ...history.future]) });
  }
  const next = history.future[0];
  if (!next) throw new EditorHistoryV4Error('No v4 redo snapshot exists.', 'NO_HISTORY');
  return Object.freeze({ version: EDITOR_HISTORY_V4_VERSION, past: Object.freeze([...history.past, history.present]), present: next, future: Object.freeze(history.future.slice(1)) });
};
