import { createEditorUiState, reduceEditorUiState } from '../../editor-ui-contract/src/index.js';

export const VIEWPORT_PRESENTATION_VERSION = '1.0.0' as const;
export const VIEWPORT_ZOOM_STEP = 0.25 as const;
export const VIEWPORT_PAN_STEP = 48 as const;

export interface ViewportPresentationSnapshot {
  readonly version: typeof VIEWPORT_PRESENTATION_VERSION;
  readonly zoom: number;
  readonly scrollX: number;
  readonly scrollY: number;
  readonly pageIndex: number;
  readonly pageCount: number;
  readonly mounted: boolean;
}

export type ViewportKeyboardAction =
  | 'ZOOM_IN' | 'ZOOM_OUT' | 'ZOOM_RESET'
  | 'PAN_LEFT' | 'PAN_RIGHT' | 'PAN_UP' | 'PAN_DOWN'
  | 'PAGE_PREVIOUS' | 'PAGE_NEXT' | 'PAGE_FIRST' | 'PAGE_LAST';

export const VIEWPORT_PRESENTATION_STYLE = `
.stse-viewport[data-st-score-editor-presentation-only="true"]{touch-action:pan-x pan-y;overscroll-behavior:contain;scroll-behavior:auto;outline-offset:2px}
.stse-viewport[data-st-score-editor-presentation-only="true"]>*{zoom:var(--stse-viewport-zoom,1)}
@media(max-width:480px){.stse-viewport[data-st-score-editor-presentation-only="true"]{scroll-padding:8px}}
@media(min-width:481px) and (max-width:1024px){.stse-viewport[data-st-score-editor-presentation-only="true"]{scroll-padding:12px}}
@media(min-width:1025px){.stse-viewport[data-st-score-editor-presentation-only="true"]{scroll-padding:16px}}
`;

export const resolveViewportKeyboardAction = (
  input: Readonly<{ key: string; ctrlKey?: boolean; metaKey?: boolean }>
): ViewportKeyboardAction | null => {
  const modifier = input.ctrlKey === true || input.metaKey === true;
  if (modifier && (input.key === '+' || input.key === '=')) return 'ZOOM_IN';
  if (modifier && input.key === '-') return 'ZOOM_OUT';
  if (modifier && input.key === '0') return 'ZOOM_RESET';
  if (input.key === 'ArrowLeft') return 'PAN_LEFT';
  if (input.key === 'ArrowRight') return 'PAN_RIGHT';
  if (input.key === 'ArrowUp') return 'PAN_UP';
  if (input.key === 'ArrowDown') return 'PAN_DOWN';
  if (input.key === 'PageUp') return 'PAGE_PREVIOUS';
  if (input.key === 'PageDown') return 'PAGE_NEXT';
  if (input.key === 'Home') return 'PAGE_FIRST';
  if (input.key === 'End') return 'PAGE_LAST';
  return null;
};

const finite = (value: number, field: string): number => {
  if (!Number.isFinite(value)) throw new RangeError(`${field} must be finite`);
  return value;
};

export interface ViewportPresentationLayer {
  readonly version: typeof VIEWPORT_PRESENTATION_VERSION;
  readonly canonicalAuthority: false;
  readonly coordinateAuthoring: false;
  readonly getState: () => Readonly<ViewportPresentationSnapshot>;
  readonly mount: (root: HTMLElement) => Readonly<ViewportPresentationSnapshot>;
  readonly unmount: () => Readonly<ViewportPresentationSnapshot>;
  readonly refresh: () => Readonly<ViewportPresentationSnapshot>;
  readonly setViewport: (viewport: Readonly<{ zoom: number; scrollX: number; scrollY: number }>) => Readonly<ViewportPresentationSnapshot>;
  readonly zoomIn: () => Readonly<ViewportPresentationSnapshot>;
  readonly zoomOut: () => Readonly<ViewportPresentationSnapshot>;
  readonly resetZoom: () => Readonly<ViewportPresentationSnapshot>;
  readonly panBy: (deltaX: number, deltaY: number) => Readonly<ViewportPresentationSnapshot>;
  readonly goToPage: (pageIndex: number) => Readonly<ViewportPresentationSnapshot>;
  readonly nextPage: () => Readonly<ViewportPresentationSnapshot>;
  readonly previousPage: () => Readonly<ViewportPresentationSnapshot>;
}

export const createViewportPresentationLayer = (): Readonly<ViewportPresentationLayer> => {
  let uiState = createEditorUiState();
  let root: HTMLElement | null = null;
  let pageIndex = 0;
  let pointer: { id: number; x: number; y: number } | null = null;

  const viewportElement = (): HTMLElement | null =>
    root?.querySelector<HTMLElement>('[data-st-score-editor-viewport]') ?? null;

  const pageMetrics = (): Readonly<{ count: number; height: number }> => {
    const viewport = viewportElement();
    const height = Math.max(1, viewport?.clientHeight ?? 1);
    const count = Math.max(1, Math.ceil(Math.max(height, viewport?.scrollHeight ?? height) / height));
    return Object.freeze({ count, height });
  };

  const snapshot = (): Readonly<ViewportPresentationSnapshot> => {
    const metrics = pageMetrics();
    return Object.freeze({
      version: VIEWPORT_PRESENTATION_VERSION,
      zoom: uiState.viewport.zoom,
      scrollX: uiState.viewport.scrollX,
      scrollY: uiState.viewport.scrollY,
      pageIndex: Math.min(pageIndex, metrics.count - 1),
      pageCount: metrics.count,
      mounted: root !== null
    });
  };

  const applyPresentation = (): Readonly<ViewportPresentationSnapshot> => {
    const viewport = viewportElement();
    if (viewport !== null) {
      viewport.tabIndex = 0;
      viewport.setAttribute('data-st-score-editor-presentation-only', 'true');
      viewport.setAttribute('data-st-score-editor-zoom', String(uiState.viewport.zoom));
      viewport.style.setProperty('--stse-viewport-zoom', String(uiState.viewport.zoom));
      viewport.scrollLeft = uiState.viewport.scrollX;
      viewport.scrollTop = uiState.viewport.scrollY;
      const app = root?.querySelector<HTMLElement>('[data-st-score-editor-app]') ?? null;
      if (app !== null && app.querySelector('[data-st-score-editor-viewport-style]') === null) {
        const style = app.ownerDocument.createElement('style');
        style.setAttribute('data-st-score-editor-viewport-style', VIEWPORT_PRESENTATION_VERSION);
        style.textContent = VIEWPORT_PRESENTATION_STYLE;
        app.append(style);
      }
    }
    return snapshot();
  };

  const setViewport = (
    value: Readonly<{ zoom: number; scrollX: number; scrollY: number }>
  ): Readonly<ViewportPresentationSnapshot> => {
    uiState = reduceEditorUiState(uiState, { type: 'SET_VIEWPORT', viewport: value });
    const metrics = pageMetrics();
    pageIndex = Math.max(0, Math.min(metrics.count - 1, Math.floor(uiState.viewport.scrollY / metrics.height)));
    return applyPresentation();
  };

  const panBy = (deltaX: number, deltaY: number): Readonly<ViewportPresentationSnapshot> => setViewport({
    zoom: uiState.viewport.zoom,
    scrollX: Math.max(0, uiState.viewport.scrollX + finite(deltaX, 'deltaX')),
    scrollY: Math.max(0, uiState.viewport.scrollY + finite(deltaY, 'deltaY'))
  });

  const zoomBy = (delta: number): Readonly<ViewportPresentationSnapshot> => setViewport({
    zoom: Math.max(0.25, Math.min(4, Math.round((uiState.viewport.zoom + delta) * 100) / 100)),
    scrollX: uiState.viewport.scrollX,
    scrollY: uiState.viewport.scrollY
  });

  const goToPage = (requested: number): Readonly<ViewportPresentationSnapshot> => {
    finite(requested, 'pageIndex');
    const metrics = pageMetrics();
    pageIndex = Math.max(0, Math.min(metrics.count - 1, Math.trunc(requested)));
    return setViewport({
      zoom: uiState.viewport.zoom,
      scrollX: uiState.viewport.scrollX,
      scrollY: pageIndex * metrics.height
    });
  };

  const keyboard = (event: KeyboardEvent): void => {
    const viewport = viewportElement();
    if (viewport === null || !(event.target instanceof Element) || !viewport.contains(event.target)) return;
    const action = resolveViewportKeyboardAction(event);
    if (action === null) return;
    event.preventDefault();
    if (action === 'ZOOM_IN') zoomBy(VIEWPORT_ZOOM_STEP);
    else if (action === 'ZOOM_OUT') zoomBy(-VIEWPORT_ZOOM_STEP);
    else if (action === 'ZOOM_RESET') setViewport({ zoom: 1, scrollX: uiState.viewport.scrollX, scrollY: uiState.viewport.scrollY });
    else if (action === 'PAN_LEFT') panBy(-VIEWPORT_PAN_STEP, 0);
    else if (action === 'PAN_RIGHT') panBy(VIEWPORT_PAN_STEP, 0);
    else if (action === 'PAN_UP') panBy(0, -VIEWPORT_PAN_STEP);
    else if (action === 'PAN_DOWN') panBy(0, VIEWPORT_PAN_STEP);
    else if (action === 'PAGE_PREVIOUS') goToPage(pageIndex - 1);
    else if (action === 'PAGE_NEXT') goToPage(pageIndex + 1);
    else if (action === 'PAGE_FIRST') goToPage(0);
    else if (action === 'PAGE_LAST') goToPage(pageMetrics().count - 1);
  };

  const pointerDown = (event: PointerEvent): void => {
    const viewport = viewportElement();
    if (viewport === null || event.pointerType === 'touch' || !(event.target instanceof Element) || !viewport.contains(event.target)) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    viewport.setPointerCapture?.(event.pointerId);
  };

  const pointerMove = (event: PointerEvent): void => {
    if (pointer === null || pointer.id !== event.pointerId) return;
    const next = { id: pointer.id, x: event.clientX, y: event.clientY };
    panBy(pointer.x - next.x, pointer.y - next.y);
    pointer = next;
    event.preventDefault();
  };

  const pointerUp = (event: PointerEvent): void => {
    if (pointer?.id === event.pointerId) pointer = null;
  };

  const nativeScroll = (event: Event): void => {
    const viewport = viewportElement();
    if (viewport === null || event.target !== viewport) return;
    uiState = reduceEditorUiState(uiState, {
      type: 'SET_VIEWPORT',
      viewport: {
        zoom: uiState.viewport.zoom,
        scrollX: viewport.scrollLeft,
        scrollY: viewport.scrollTop
      }
    });
    const metrics = pageMetrics();
    pageIndex = Math.max(0, Math.min(metrics.count - 1, Math.floor(uiState.viewport.scrollY / metrics.height)));
  };

  const mount = (nextRoot: HTMLElement): Readonly<ViewportPresentationSnapshot> => {
    if (root === nextRoot) return applyPresentation();
    if (root !== null) {
      root.removeEventListener('keydown', keyboard);
      root.removeEventListener('pointerdown', pointerDown);
      root.removeEventListener('pointermove', pointerMove);
      root.removeEventListener('pointerup', pointerUp);
      root.removeEventListener('pointercancel', pointerUp);
      root.removeEventListener('scroll', nativeScroll, true);
    }
    root = nextRoot;
    root.addEventListener('keydown', keyboard);
    root.addEventListener('pointerdown', pointerDown);
    root.addEventListener('pointermove', pointerMove);
    root.addEventListener('pointerup', pointerUp);
    root.addEventListener('pointercancel', pointerUp);
    root.addEventListener('scroll', nativeScroll, true);
    return applyPresentation();
  };

  const unmount = (): Readonly<ViewportPresentationSnapshot> => {
    if (root !== null) {
      root.removeEventListener('keydown', keyboard);
      root.removeEventListener('pointerdown', pointerDown);
      root.removeEventListener('pointermove', pointerMove);
      root.removeEventListener('pointerup', pointerUp);
      root.removeEventListener('pointercancel', pointerUp);
      root.removeEventListener('scroll', nativeScroll, true);
    }
    root = null;
    pointer = null;
    return snapshot();
  };

  return Object.freeze({
    version: VIEWPORT_PRESENTATION_VERSION,
    canonicalAuthority: false,
    coordinateAuthoring: false,
    getState: snapshot,
    mount,
    unmount,
    refresh: applyPresentation,
    setViewport,
    zoomIn: () => zoomBy(VIEWPORT_ZOOM_STEP),
    zoomOut: () => zoomBy(-VIEWPORT_ZOOM_STEP),
    resetZoom: () => setViewport({ zoom: 1, scrollX: uiState.viewport.scrollX, scrollY: uiState.viewport.scrollY }),
    panBy,
    goToPage,
    nextPage: () => goToPage(pageIndex + 1),
    previousPage: () => goToPage(pageIndex - 1)
  });
};
