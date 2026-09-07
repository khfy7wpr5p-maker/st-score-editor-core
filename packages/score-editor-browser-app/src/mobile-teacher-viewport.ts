import type { TeacherWorkflowControllerOptions } from './teacher-workflow.js';
import {
  createMobileTeacherToolbarStandaloneBrowserAppRuntime,
  createMobileTeacherToolbarStandaloneScoreEditorController,
  mobileTeacherToolbarBrowserAppProfile,
  type MobileTeacherToolbarStandaloneScoreEditorController
} from './mobile-teacher-toolbar.js';
import {
  createViewportPresentationLayer,
  VIEWPORT_PRESENTATION_VERSION,
  VIEWPORT_ZOOM_STEP,
  type ViewportPresentationSnapshot
} from './viewport-presentation.js';

export const MOBILE_TEACHER_VIEWPORT_VERSION = '1.0.0' as const;

export const mobileTeacherViewportBrowserAppProfile = Object.freeze({
  ...mobileTeacherToolbarBrowserAppProfile,
  mobileTeacherViewportBundled: true,
  mobileTeacherViewportCanonicalAuthority: false,
  mobileTeacherViewportSingleCanonicalController: true,
  mobileTeacherViewportPresentationLayer: 'viewport-presentation-v1' as const,
  mobileTeacherViewportCoordinateAuthoring: false,
  mobileTeacherViewportRendererCoordinateAuthority: false,
  mobileTeacherViewportDomAuthoringAuthority: false,
  mobileTeacherViewportNetworkAuthority: false
});

export interface MobileTeacherViewportStandaloneScoreEditorController extends Omit<MobileTeacherToolbarStandaloneScoreEditorController, 'profile' | 'mount' | 'unmount'> {
  readonly profile: typeof mobileTeacherViewportBrowserAppProfile;
  readonly getViewportState: () => Readonly<ViewportPresentationSnapshot>;
  readonly setViewport: (viewport: Readonly<{ zoom: number; scrollX: number; scrollY: number }>) => Readonly<ViewportPresentationSnapshot>;
  readonly zoomIn: () => Readonly<ViewportPresentationSnapshot>;
  readonly zoomOut: () => Readonly<ViewportPresentationSnapshot>;
  readonly resetZoom: () => Readonly<ViewportPresentationSnapshot>;
  readonly panBy: (deltaX: number, deltaY: number) => Readonly<ViewportPresentationSnapshot>;
  readonly goToPage: (pageIndex: number) => Readonly<ViewportPresentationSnapshot>;
  readonly nextPage: () => Readonly<ViewportPresentationSnapshot>;
  readonly previousPage: () => Readonly<ViewportPresentationSnapshot>;
  readonly mount: (root: HTMLElement) => void;
  readonly unmount: () => void;
}

export const createMobileTeacherViewportStandaloneScoreEditorController = (
  options: TeacherWorkflowControllerOptions = {}
): Readonly<MobileTeacherViewportStandaloneScoreEditorController> => {
  const base = createMobileTeacherToolbarStandaloneScoreEditorController(options);
  const viewport = createViewportPresentationLayer();
  base.subscribe(() => { viewport.refresh(); });

  const controller: MobileTeacherViewportStandaloneScoreEditorController = {
    ...base,
    profile: mobileTeacherViewportBrowserAppProfile,
    getViewportState: viewport.getState,
    setViewport: viewport.setViewport,
    zoomIn: viewport.zoomIn,
    zoomOut: viewport.zoomOut,
    resetZoom: viewport.resetZoom,
    panBy: viewport.panBy,
    goToPage: viewport.goToPage,
    nextPage: viewport.nextPage,
    previousPage: viewport.previousPage,
    mount: (root) => {
      base.mount(root);
      viewport.mount(root);
    },
    unmount: () => {
      viewport.unmount();
      base.unmount();
    }
  };

  return Object.freeze(controller);
};

export const createMobileTeacherViewportStandaloneBrowserAppRuntime = () => {
  const base = createMobileTeacherToolbarStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: mobileTeacherViewportBrowserAppProfile,
    createController: createMobileTeacherViewportStandaloneScoreEditorController,
    mobileTeacherViewport: Object.freeze({
      version: MOBILE_TEACHER_VIEWPORT_VERSION,
      bundled: true,
      singleCanonicalController: true,
      canonicalAuthority: false,
      presentationLayerVersion: VIEWPORT_PRESENTATION_VERSION,
      presentationOnly: true,
      coordinateAuthoring: false,
      zoomRange: Object.freeze([0.25, 4] as const),
      zoomStep: VIEWPORT_ZOOM_STEP,
      semanticTeacherWorkflow: true,
      rendererCoordinateAuthority: false,
      domAuthoringAuthority: false,
      networkAuthority: false
    })
  });
};
