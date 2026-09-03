import {
  createExportPrintEnabledStandaloneBrowserAppRuntime,
  createExportPrintEnabledStandaloneScoreEditorController,
  exportPrintEnabledBrowserAppProfile,
  type ExportPrintEnabledStandaloneScoreEditorController
} from './export-print-enabled.js';
import type { PlaybackEnabledControllerOptions } from './playback-enabled.js';

export const RELEASE_HARDENED_BROWSER_APP_VERSION = '1.0.0' as const;
export const STANDALONE_APP_BUNDLE_MAX_BYTES = 524_288 as const;

export const releaseHardenedBrowserAppProfile = Object.freeze({
  ...exportPrintEnabledBrowserAppProfile,
  releaseHardeningBundled: true,
  hardeningCanonicalAuthority: false,
  hardeningHistoryMutationAuthority: false,
  hardeningNetworkAuthority: false,
  dynamicViewportUnits: true,
  safeAreaInsets: true,
  coarsePointerTargetMinCssPx: 44,
  focusVisibleStyling: true,
  reducedMotionStyling: true,
  resizeOrientationReapplyPresentation: true,
  resizeOrientationControlledRendererRerender: true,
  pageHideRecoveryFlush: true,
  accessibilityStatusLiveRegion: true,
  browserContractTargets: Object.freeze(['ios-safari', 'ipad-safari', 'desktop-safari', 'chromium', 'firefox'] as const),
  standaloneBundleMaxBytes: STANDALONE_APP_BUNDLE_MAX_BYTES,
  manualDeviceValidationRequired: true,
  standaloneReleaseGatePassed: false,
  seslitabCutoverAuthorized: false
});

export const RELEASE_HARDENING_STYLE = `
.stse-app[data-st-score-editor-release-hardened="true"]{height:100dvh;max-height:100dvh;min-height:320px;padding-top:env(safe-area-inset-top,0px);padding-right:env(safe-area-inset-right,0px);padding-bottom:env(safe-area-inset-bottom,0px);padding-left:env(safe-area-inset-left,0px)}
@supports not (height:100dvh){.stse-app[data-st-score-editor-release-hardened="true"]{height:100vh;max-height:100vh}}
.stse-app[data-st-score-editor-release-hardened="true"] button{touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.stse-app[data-st-score-editor-release-hardened="true"] button:focus-visible,.stse-app[data-st-score-editor-release-hardened="true"] [tabindex]:focus-visible{outline:3px solid currentColor;outline-offset:2px}
@media(pointer:coarse){.stse-app[data-st-score-editor-release-hardened="true"] .stse-toolbar button,.stse-app[data-st-score-editor-release-hardened="true"] .stse-keypad button{min-width:44px;min-height:44px}}
@media(prefers-reduced-motion:reduce){.stse-app[data-st-score-editor-release-hardened="true"],.stse-app[data-st-score-editor-release-hardened="true"] *{scroll-behavior:auto!important;animation:none!important;transition:none!important}}
`;

export interface ReleaseHardeningEventTargetV1 {
  readonly addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
  readonly removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
}

export interface ReleaseHardeningLifecycleHostV1 {
  readonly windowTarget?: ReleaseHardeningEventTargetV1 | null;
  readonly visualViewportTarget?: ReleaseHardeningEventTargetV1 | null;
  readonly documentTarget?: ReleaseHardeningEventTargetV1 | null;
  readonly isDocumentHidden?: () => boolean;
  readonly schedule?: (callback: () => void) => void;
}

export interface ReleaseHardeningLifecycleCallbacksV1 {
  readonly reapplyPresentation: () => void;
  readonly flushRecovery: () => void | Promise<unknown>;
}

export interface ReleaseHardeningLifecycleV1 {
  readonly dispose: () => void;
}

const defaultSchedule = (callback: () => void): void => {
  if (typeof globalThis.queueMicrotask === 'function') globalThis.queueMicrotask(callback);
  else Promise.resolve().then(callback).catch(() => undefined);
};

export const attachReleaseHardeningLifecycleV1 = (
  host: ReleaseHardeningLifecycleHostV1,
  callbacks: ReleaseHardeningLifecycleCallbacksV1
): Readonly<ReleaseHardeningLifecycleV1> => {
  let disposed = false;
  let presentationScheduled = false;
  let recoveryFlushInFlight = false;
  const schedule = host.schedule ?? defaultSchedule;

  const requestPresentationReapply = (): void => {
    if (disposed || presentationScheduled) return;
    presentationScheduled = true;
    schedule(() => {
      presentationScheduled = false;
      if (!disposed) callbacks.reapplyPresentation();
    });
  };

  const requestRecoveryFlush = (): void => {
    if (disposed || recoveryFlushInFlight) return;
    recoveryFlushInFlight = true;
    try {
      void Promise.resolve(callbacks.flushRecovery())
        .catch(() => undefined)
        .finally(() => { recoveryFlushInFlight = false; });
    } catch {
      recoveryFlushInFlight = false;
    }
  };

  const onLayout = (): void => { requestPresentationReapply(); };
  const onPageHide = (): void => { requestRecoveryFlush(); };
  const onVisibility = (): void => { if (host.isDocumentHidden?.() === true) requestRecoveryFlush(); };

  host.windowTarget?.addEventListener('resize', onLayout);
  host.windowTarget?.addEventListener('orientationchange', onLayout);
  host.windowTarget?.addEventListener('pageshow', onLayout);
  host.windowTarget?.addEventListener('pagehide', onPageHide);
  host.visualViewportTarget?.addEventListener('resize', onLayout);
  host.documentTarget?.addEventListener('visibilitychange', onVisibility);

  return Object.freeze({
    dispose: () => {
      if (disposed) return;
      disposed = true;
      host.windowTarget?.removeEventListener('resize', onLayout);
      host.windowTarget?.removeEventListener('orientationchange', onLayout);
      host.windowTarget?.removeEventListener('pageshow', onLayout);
      host.windowTarget?.removeEventListener('pagehide', onPageHide);
      host.visualViewportTarget?.removeEventListener('resize', onLayout);
      host.documentTarget?.removeEventListener('visibilitychange', onVisibility);
    }
  });
};

export interface ReleaseHardeningControllerOptions extends PlaybackEnabledControllerOptions {
  readonly hardeningHost?: ReleaseHardeningLifecycleHostV1;
}

export interface ReleaseHardenedStandaloneScoreEditorController extends Omit<ExportPrintEnabledStandaloneScoreEditorController, 'profile' | 'mount' | 'unmount'> {
  readonly profile: typeof releaseHardenedBrowserAppProfile;
  readonly mount: (root: HTMLElement) => void;
  readonly unmount: () => void;
}

const browserHostFromRoot = (root: HTMLElement): ReleaseHardeningLifecycleHostV1 => {
  const documentValue = root.ownerDocument;
  const windowValue = documentValue.defaultView;
  const visualViewport = windowValue?.visualViewport ?? null;
  return Object.freeze({
    windowTarget: windowValue,
    visualViewportTarget: visualViewport,
    documentTarget: documentValue,
    isDocumentHidden: () => documentValue.visibilityState === 'hidden',
    schedule: (callback: () => void) => {
      if (windowValue !== null && typeof windowValue.requestAnimationFrame === 'function') {
        windowValue.requestAnimationFrame(() => { callback(); });
      } else {
        defaultSchedule(callback);
      }
    }
  });
};

export const createReleaseHardenedStandaloneScoreEditorController = (
  options: ReleaseHardeningControllerOptions = {}
): Readonly<ReleaseHardenedStandaloneScoreEditorController> => {
  const base = createExportPrintEnabledStandaloneScoreEditorController(options);
  let root: HTMLElement | null = null;
  let lifecycle: Readonly<ReleaseHardeningLifecycleV1> | null = null;
  let rendererRerenderInFlight = false;
  let rendererRerenderPending = false;
  let rendererRerenderGeneration = 0;

  const decorate = (): void => {
    if (root === null) return;
    const app = root.querySelector<HTMLElement>('[data-st-score-editor-app]');
    if (app === null) return;
    app.setAttribute('data-st-score-editor-release-hardened', 'true');
    app.setAttribute('aria-label', 'ST Score Editor');
    if (app.querySelector('[data-st-score-editor-release-hardening-style]') === null) {
      const style = app.ownerDocument.createElement('style');
      style.setAttribute('data-st-score-editor-release-hardening-style', RELEASE_HARDENED_BROWSER_APP_VERSION);
      style.textContent = RELEASE_HARDENING_STYLE;
      app.append(style);
    }
    const toolbar = app.querySelector<HTMLElement>('.stse-toolbar');
    toolbar?.setAttribute('role', 'toolbar');
    toolbar?.setAttribute('aria-label', 'Score editor actions');
    const viewport = app.querySelector<HTMLElement>('[data-st-score-editor-viewport]');
    viewport?.setAttribute('role', 'region');
    viewport?.setAttribute('aria-label', 'Score viewport');
    const keypad = app.querySelector<HTMLElement>('.stse-keypad');
    keypad?.setAttribute('role', 'group');
    const inspector = app.querySelector<HTMLElement>('.stse-side');
    inspector?.setAttribute('aria-label', 'Score inspector');
    const status = app.querySelector<HTMLElement>('.stse-status');
    status?.setAttribute('role', 'status');
    status?.setAttribute('aria-live', 'polite');
    status?.setAttribute('aria-atomic', 'true');
  };

  const requestControlledRendererRerender = (): void => {
    if (root === null || base.getSnapshot().revisionId === null || !base.getRendererState().attached) return;
    if (rendererRerenderInFlight) {
      rendererRerenderPending = true;
      return;
    }
    rendererRerenderInFlight = true;
    const generation = rendererRerenderGeneration;
    const run = async (): Promise<void> => {
      try {
        do {
          rendererRerenderPending = false;
          if (
            root === null || generation !== rendererRerenderGeneration ||
            base.getSnapshot().revisionId === null || !base.getRendererState().attached
          ) break;
          try {
            await base.renderCurrent();
          } catch {
            // Layout rerender is presentation-only. Renderer lifecycle already rejects stale/failed output fail-closed.
          }
        } while (rendererRerenderPending);
      } finally {
        rendererRerenderInFlight = false;
        if (rendererRerenderPending && root !== null && generation === rendererRerenderGeneration) {
          requestControlledRendererRerender();
        }
      }
    };
    void run();
  };

  const reapplyPresentation = (): void => {
    const viewport = base.getViewportState();
    base.setViewport({ zoom: viewport.zoom, scrollX: viewport.scrollX, scrollY: viewport.scrollY });
    decorate();
    requestControlledRendererRerender();
  };

  base.subscribe(() => { decorate(); });

  const controller: ReleaseHardenedStandaloneScoreEditorController = {
    ...base,
    profile: releaseHardenedBrowserAppProfile,
    mount: (nextRoot) => {
      if (root === nextRoot) {
        decorate();
        reapplyPresentation();
        return;
      }
      lifecycle?.dispose();
      rendererRerenderGeneration += 1;
      rendererRerenderPending = false;
      base.mount(nextRoot);
      root = nextRoot;
      decorate();
      lifecycle = attachReleaseHardeningLifecycleV1(options.hardeningHost ?? browserHostFromRoot(nextRoot), {
        reapplyPresentation,
        flushRecovery: base.flushRecovery
      });
      reapplyPresentation();
    },
    unmount: () => {
      lifecycle?.dispose();
      lifecycle = null;
      rendererRerenderGeneration += 1;
      rendererRerenderPending = false;
      root = null;
      base.unmount();
    }
  };
  return Object.freeze(controller);
};

export const createReleaseHardenedStandaloneBrowserAppRuntime = () => {
  const base = createExportPrintEnabledStandaloneBrowserAppRuntime();
  return Object.freeze({
    ...base,
    profile: releaseHardenedBrowserAppProfile,
    createController: createReleaseHardenedStandaloneScoreEditorController,
    releaseHardening: Object.freeze({
      version: RELEASE_HARDENED_BROWSER_APP_VERSION,
      bundled: true,
      canonicalAuthority: false,
      historyMutationAuthority: false,
      networkAuthority: false,
      dynamicViewportUnits: true,
      safeAreaInsets: true,
      coarsePointerTargetMinCssPx: 44,
      focusVisibleStyling: true,
      reducedMotionStyling: true,
      resizeOrientationReapplyPresentation: true,
      resizeOrientationControlledRendererRerender: true,
      pageHideRecoveryFlush: true,
      accessibilityStatusLiveRegion: true,
      browserContractTargets: releaseHardenedBrowserAppProfile.browserContractTargets,
      standaloneBundleMaxBytes: STANDALONE_APP_BUNDLE_MAX_BYTES,
      manualDeviceValidationRequired: true,
      standaloneReleaseGatePassed: false,
      seslitabCutoverAuthorized: false
    })
  });
};
