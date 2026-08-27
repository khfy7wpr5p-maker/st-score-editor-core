import type { ScoreDocument } from '../../score-model/src/index.js';
import type { EditorUiState } from '../../editor-ui-contract/src/index.js';

export const EDITOR_SHELL_VERSION = '1.0.0' as const;

export interface ShellPartItem {
  readonly partId: string;
  readonly name: string | null;
  readonly staffCount: number;
}

export interface EditorToolbarModel {
  readonly activeTool: EditorUiState['activeTool'];
  readonly groups: readonly (readonly string[])[];
}

export interface EditorShellModel {
  readonly version: typeof EDITOR_SHELL_VERSION;
  readonly documentId: string;
  readonly revisionId: string;
  readonly toolbar: EditorToolbarModel;
  readonly parts: readonly ShellPartItem[];
  readonly scoreViewport: {
    readonly zoom: number;
    readonly scrollX: number;
    readonly scrollY: number;
  };
  readonly inspector: {
    readonly open: boolean;
    readonly draftCount: number;
  };
  readonly status: EditorUiState['status'];
}

const TOOL_GROUPS = Object.freeze([
  Object.freeze(['select','note','rest']),
  Object.freeze(['accidental','dot','tie','slur','beam','tuplet']),
  Object.freeze(['clef','time-signature','key-signature','barline'])
] as const);

export const createEditorShellModel = (
  score: ScoreDocument,
  ui: Readonly<EditorUiState>
): Readonly<EditorShellModel> => Object.freeze({
  version: EDITOR_SHELL_VERSION,
  documentId: score.id,
  revisionId: score.revision.id,
  toolbar: Object.freeze({ activeTool: ui.activeTool, groups: TOOL_GROUPS }),
  parts: Object.freeze(score.parts.map((part) => Object.freeze({
    partId: part.id,
    name: part.name,
    staffCount: part.staves.length
  }))),
  scoreViewport: Object.freeze({ ...ui.viewport }),
  inspector: Object.freeze({ open: ui.inspectorOpen, draftCount: ui.inspectorDrafts.length }),
  status: ui.status
});
