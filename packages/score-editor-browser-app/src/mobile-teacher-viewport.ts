import type { TeacherWorkflowControllerOptions } from './teacher-workflow.js';
import {
  createMobileTeacherToolbarStandaloneBrowserAppRuntime,
  createMobileTeacherToolbarStandaloneScoreEditorController,
  mobileTeacherToolbarBrowserAppProfile,
  type MobileTeacherToolbarStandaloneScoreEditorController
} from './mobile-teacher-toolbar.js';
import {
  VIEWPORT_PRESENTATION_VERSION,
  VIEWPORT_ZOOM_STEP
} from './viewport-presentation.js';

export const MOBILE_TEACHER_VIEWPORT_VERSION = '1.0.0' as const;

export const mobileTeacherViewportBrowserAppProfile = Object.freeze({
  ...mobileTeacherToolbarBrowserAppProfile,
  mobileTeacherViewportBundled: true,
  mobileTeacherViewportCanonicalAuthority: false,
  mobileTeacherViewportSingleCanonicalController: true,
  mobileTeacherViewportReusesExistingViewport: true,
  mobileTeacherViewportPresentationLayer: 'existing-viewport-enabled-v1' as const,
  mobileTeacherViewportCoordinateAuthoring: false,
  mobileTeacherViewportRendererCoordinateAuthority: false,
  mobileTeacherViewportDomAuthoringAuthority: false,
  mobileTeacherViewportNetworkAuthority: false
});

export interface MobileTeacherViewportStandaloneScoreEditorController extends Omit<MobileTeacherToolbarStandaloneScoreEditorController, 'profile'> {
  readonly profile: typeof mobileTeacherViewportBrowserAppProfile;
}

export const createMobileTeacherViewportStandaloneScoreEditorController = (
  options: TeacherWorkflowControllerOptions = {}
): Readonly<MobileTeacherViewportStandaloneScoreEditorController> => {
  const base = createMobileTeacherToolbarStandaloneScoreEditorController(options);
  return Object.freeze({
    ...base,
    profile: mobileTeacherViewportBrowserAppProfile
  });
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
      reusesExistingViewport: true,
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
