import type { SemanticAddress } from '../../addressing/src/index.js';

export const EDITOR_UI_CONTRACT_VERSION = '1.0.0' as const;

export type EditorTool =
  | 'select'
  | 'note'
  | 'rest'
  | 'accidental'
  | 'dot'
  | 'tie'
  | 'slur'
  | 'beam'
  | 'tuplet'
  | 'clef'
  | 'time-signature'
  | 'key-signature'
  | 'barline';

export interface ViewportState {
  readonly zoom: number;
  readonly scrollX: number;
  readonly scrollY: number;
}

export interface InspectorDraft {
  readonly field: string;
  readonly value: string;
}

export interface EditorStatus {
  readonly level: 'idle' | 'info' | 'success' | 'warning' | 'error';
  readonly code: string | null;
  readonly message: string;
}

export interface EditorSelectionView {
  readonly documentId: string;
  readonly revisionId: string;
  readonly primary: SemanticAddress | null;
}

export interface EditorUiState {
  readonly contractVersion: typeof EDITOR_UI_CONTRACT_VERSION;
  readonly activeTool: EditorTool;
  readonly viewport: ViewportState;
  readonly focusedRegion: 'toolbar' | 'parts' | 'score' | 'inspector' | 'status' | null;
  readonly hoveredRenderToken: string | null;
  readonly inspectorOpen: boolean;
  readonly inspectorDrafts: readonly InspectorDraft[];
  readonly selection: EditorSelectionView | null;
  readonly status: EditorStatus;
}

export type EditorUiEvent =
  | { readonly type: 'SET_TOOL'; readonly tool: EditorTool }
  | { readonly type: 'SET_VIEWPORT'; readonly viewport: ViewportState }
  | { readonly type: 'SET_FOCUS'; readonly region: EditorUiState['focusedRegion'] }
  | { readonly type: 'SET_HOVER_TOKEN'; readonly token: string | null }
  | { readonly type: 'SET_INSPECTOR_OPEN'; readonly open: boolean }
  | { readonly type: 'SET_INSPECTOR_DRAFT'; readonly draft: InspectorDraft }
  | { readonly type: 'CLEAR_INSPECTOR_DRAFTS' }
  | { readonly type: 'SET_SELECTION_VIEW'; readonly selection: EditorSelectionView | null }
  | { readonly type: 'SET_STATUS'; readonly status: EditorStatus };

const freeze = <T extends object>(value: T): Readonly<T> => Object.freeze(value);

const freezeViewport = (viewport: ViewportState): Readonly<ViewportState> => {
  if (!Number.isFinite(viewport.zoom) || viewport.zoom < 0.25 || viewport.zoom > 4) {
    throw new RangeError('zoom must be finite and within 0.25..4');
  }
  if (!Number.isFinite(viewport.scrollX) || !Number.isFinite(viewport.scrollY)) {
    throw new RangeError('scroll offsets must be finite');
  }
  return freeze({ ...viewport });
};

const freezeStatus = (status: EditorStatus): Readonly<EditorStatus> => freeze({ ...status });

export const createEditorUiState = (): Readonly<EditorUiState> => freeze({
  contractVersion: EDITOR_UI_CONTRACT_VERSION,
  activeTool: 'select',
  viewport: freezeViewport({ zoom: 1, scrollX: 0, scrollY: 0 }),
  focusedRegion: null,
  hoveredRenderToken: null,
  inspectorOpen: true,
  inspectorDrafts: freeze([] as InspectorDraft[]),
  selection: null,
  status: freezeStatus({ level: 'idle', code: null, message: '' })
});

export const reduceEditorUiState = (
  state: Readonly<EditorUiState>,
  event: EditorUiEvent
): Readonly<EditorUiState> => {
  switch (event.type) {
    case 'SET_TOOL': return freeze({ ...state, activeTool: event.tool });
    case 'SET_VIEWPORT': return freeze({ ...state, viewport: freezeViewport(event.viewport) });
    case 'SET_FOCUS': return freeze({ ...state, focusedRegion: event.region });
    case 'SET_HOVER_TOKEN': return freeze({ ...state, hoveredRenderToken: event.token });
    case 'SET_INSPECTOR_OPEN': return freeze({ ...state, inspectorOpen: event.open });
    case 'SET_INSPECTOR_DRAFT': {
      const next = state.inspectorDrafts.filter((item) => item.field !== event.draft.field);
      return freeze({ ...state, inspectorDrafts: freeze([...next, freeze({ ...event.draft })]) });
    }
    case 'CLEAR_INSPECTOR_DRAFTS': return freeze({ ...state, inspectorDrafts: freeze([] as InspectorDraft[]) });
    case 'SET_SELECTION_VIEW': return freeze({ ...state, selection: event.selection === null ? null : freeze({ ...event.selection }) });
    case 'SET_STATUS': return freeze({ ...state, status: freezeStatus(event.status) });
  }
};
