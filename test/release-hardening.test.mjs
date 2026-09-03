import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RELEASE_HARDENING_STYLE,
  STANDALONE_APP_BUNDLE_MAX_BYTES,
  attachReleaseHardeningLifecycleV1,
  releaseHardenedBrowserAppProfile
} from '../dist/packages/score-editor-browser-app/src/release-hardened.js';

const eventTarget = () => {
  const listeners = new Map();
  const addEventListener = (type, listener) => {
    const values = listeners.get(type) ?? new Set();
    values.add(listener);
    listeners.set(type, values);
  };
  const removeEventListener = (type, listener) => { listeners.get(type)?.delete(listener); };
  const emit = (type) => {
    for (const listener of [...(listeners.get(type) ?? [])]) {
      if (typeof listener === 'function') listener({ type });
      else listener.handleEvent({ type });
    }
  };
  const count = (type) => listeners.get(type)?.size ?? 0;
  return { addEventListener, removeEventListener, emit, count };
};

test('APP-09 hardening profile remains presentation/recovery only and does not authorize release cutover', () => {
  assert.equal(releaseHardenedBrowserAppProfile.releaseHardeningBundled, true);
  assert.equal(releaseHardenedBrowserAppProfile.hardeningCanonicalAuthority, false);
  assert.equal(releaseHardenedBrowserAppProfile.hardeningHistoryMutationAuthority, false);
  assert.equal(releaseHardenedBrowserAppProfile.hardeningNetworkAuthority, false);
  assert.equal(releaseHardenedBrowserAppProfile.resizeOrientationReapplyPresentation, true);
  assert.equal(releaseHardenedBrowserAppProfile.pageHideRecoveryFlush, true);
  assert.equal(releaseHardenedBrowserAppProfile.manualDeviceValidationRequired, true);
  assert.equal(releaseHardenedBrowserAppProfile.standaloneReleaseGatePassed, false);
  assert.equal(releaseHardenedBrowserAppProfile.seslitabCutoverAuthorized, false);
  assert.equal(releaseHardenedBrowserAppProfile.standaloneBundleMaxBytes, STANDALONE_APP_BUNDLE_MAX_BYTES);
  assert.deepEqual([...releaseHardenedBrowserAppProfile.browserContractTargets], ['ios-safari', 'ipad-safari', 'desktop-safari', 'chromium', 'firefox']);
});

test('APP-09 hardening CSS covers dynamic viewport, safe area, touch targets, focus and reduced motion', () => {
  assert.match(RELEASE_HARDENING_STYLE, /100dvh/);
  assert.match(RELEASE_HARDENING_STYLE, /safe-area-inset-top/);
  assert.match(RELEASE_HARDENING_STYLE, /pointer:coarse/);
  assert.match(RELEASE_HARDENING_STYLE, /min-width:44px/);
  assert.match(RELEASE_HARDENING_STYLE, /min-height:44px/);
  assert.match(RELEASE_HARDENING_STYLE, /focus-visible/);
  assert.match(RELEASE_HARDENING_STYLE, /prefers-reduced-motion:reduce/);
});

test('APP-09 resize/orientation/visual viewport events coalesce to one presentation reapply', () => {
  const windowTarget = eventTarget();
  const visualViewportTarget = eventTarget();
  const documentTarget = eventTarget();
  const scheduled = [];
  let reapplies = 0;
  const lifecycle = attachReleaseHardeningLifecycleV1(
    { windowTarget, visualViewportTarget, documentTarget, isDocumentHidden: () => false, schedule: callback => { scheduled.push(callback); } },
    { reapplyPresentation: () => { reapplies += 1; }, flushRecovery: () => undefined }
  );

  windowTarget.emit('resize');
  windowTarget.emit('orientationchange');
  visualViewportTarget.emit('resize');
  windowTarget.emit('pageshow');
  assert.equal(scheduled.length, 1);
  assert.equal(reapplies, 0);
  scheduled.shift()();
  assert.equal(reapplies, 1);

  lifecycle.dispose();
  assert.equal(windowTarget.count('resize'), 0);
  assert.equal(windowTarget.count('orientationchange'), 0);
  assert.equal(windowTarget.count('pagehide'), 0);
  assert.equal(visualViewportTarget.count('resize'), 0);
  assert.equal(documentTarget.count('visibilitychange'), 0);
});

test('APP-09 pagehide and hidden visibility trigger best-effort recovery flush without presentation mutation', async () => {
  const windowTarget = eventTarget();
  const documentTarget = eventTarget();
  let hidden = false;
  let reapplies = 0;
  let flushes = 0;
  let resolveFlush;
  const firstFlush = new Promise(resolve => { resolveFlush = resolve; });
  const lifecycle = attachReleaseHardeningLifecycleV1(
    { windowTarget, documentTarget, isDocumentHidden: () => hidden, schedule: callback => { callback(); } },
    {
      reapplyPresentation: () => { reapplies += 1; },
      flushRecovery: () => { flushes += 1; return firstFlush; }
    }
  );

  windowTarget.emit('pagehide');
  hidden = true;
  documentTarget.emit('visibilitychange');
  assert.equal(flushes, 1);
  assert.equal(reapplies, 0);
  resolveFlush();
  await firstFlush;
  await Promise.resolve();

  documentTarget.emit('visibilitychange');
  assert.equal(flushes, 2);
  lifecycle.dispose();
});
