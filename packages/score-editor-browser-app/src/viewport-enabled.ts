import type { RecoveryEnabledControllerOptions } from './recovery-enabled.js';
import {
  createRendererHitEnabledStandaloneBrowserAppRuntime,
  createRendererHitEnabledStandaloneScoreEditorController,
  rendererHitEnabledBrowserAppProfile,
  type RendererHitEnabledStandaloneScoreEditorController
} from './renderer-hit-enabled.js';
import {
  createViewportPresentationLayer,
  resolveViewportKeyboardAction,
  VIEWPORT_PAN_STEP,
  VIEWPORT_PRESENTATION_VERSION,
  VIEWPORT_ZOOM_STEP,
  type ViewportKeyboardAction,
  type ViewportPresentationSnapshot
} from './viewport-presentation.js';

export const VIEWPORT_ENABLED_BROWSER_APP_VERSION = VIEWPORT_PRESENTATION_VERSION;
export { VIEWPORT_ZOOM_STEP, VIEWPORT_PAN_STEP, resolveViewportKeyboardAction };
export type { ViewportKeyboardAction, ViewportPresentationSnapshot };

export const viewportEnabledBrowserAppProfile = Object.freeze({
  ...rendererHitEnabledBrowserAppProfile,
  viewportNavigationBundled: true,
  viewportCanonicalAuthority: false,
  coordinateAuthoring: false,
  viewportInputModes: Object.freeze(['touch', 'pointer', 'keyboard'] as const),
  responsiveViewportProfiles: Object.freeze(['iphone', 'ipad', 'desktop'] as const)
});

export interface ViewportEnabledStandaloneScoreEditorController extends Omit<RendererHitEnabledStandaloneScoreEditorController, 'profile' | 'mount' | 'unmount'> {
  readonly profile: typeof viewportEnabledBrowserAppProfile;
  readonly mount: (root: HTMLElement) => void;
  readonly unmount: () => void;
  readonly getViewportState: () => Readonly<ViewportPresentationSnapshot>;
  readonly setViewport: (viewport: Readonly<{ zoom: number; scrollX: number; scrollY: number }>) => Readonly<ViewportPresentationSnapshot>;
  readonly zoomIn: () => Readonly<ViewportPresentationSnapshot>;
  readonly zoomOut: () => Readonly<ViewportPresentationSnapshot>;
  readonly resetZoom: () => Readonly<ViewportPresentationSnapshot>;
  readonly panBy: (deltaX: number, deltaY: number) => Readonly<ViewportPresentationSnapshot>;
  readonly goToPage: (pageIndex: number) => Readonly<ViewportPresentationSnapshot>;
  readonly nextPage: () => Readonly<ViewportPresentationSnapshot>;
  readonly previousPage: () => Readonly<ViewportPresentationSnapshot>;
}

export const createViewportEnabledStandaloneScoreEditorController = (
  options: RecoveryEnabledControllerOptions = {}
): Readonly<ViewportEnabledStandaloneScoreEditorController> => {
  const base = createRendererHitEnabledStandaloneScoreEditorController(options);
  const viewport = createViewportPresentationLayer();
  base.subscribe(() => { viewport.refresh(); });

  const controller: ViewportEnabledStandaloneScoreEditorController = {
    ...base,
    profile: viewportEnabledBrowserAppProfile,
    mount: (root) => {
      base.mount(root);
      viewport.mount(root);
    },
    unmount: () => {
      viewport.unmount();
      base.unmount();
    },
    getViewportState: viewport.getState,
    setViewport: viewport.setViewport,
    zoomIn: viewport.zoomIn,
    zoomOut: viewport.zoomOut,
    resetZoom: viewport.resetZoom,
    panBy: viewport.panBy,
    goToPage: viewport.goToPage,
    nextPage: viewport.nextPage,
    previousPage: viewport.previousPage
  };
  return Object.freeze(controller);
};

export const createViewportEnabledStandaloneBrowserAppRuntime = () => {
  const base = createRendererHitEnabledStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: viewportEnabledBrowserAppProfile,
    createController: createViewportEnabledStandaloneScoreEditorController,
    viewport: Object.freeze({
      version: VIEWPORT_ENABLED_BROWSER_APP_VERSION,
      presentationOnly: true,
      canonicalAuthority: false,
      coordinateAuthoring: false,
      zoomRange: Object.freeze([0.25, 4] as const),
      zoomStep: VIEWPORT_ZOOM_STEP,
      inputModes: viewportEnabledBrowserAppProfile.viewportInputModes,
      responsiveProfiles: viewportEnabledBrowserAppProfile.responsiveViewportProfiles
    })
  });
};
