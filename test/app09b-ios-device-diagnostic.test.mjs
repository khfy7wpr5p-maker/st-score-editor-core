import assert from 'node:assert/strict';
import test from 'node:test';

import {
  APP09B_IOS_DEVICE_DIAGNOSTIC_VERSION,
  createIosDeviceDiagnosticHtml,
  iosDeviceDiagnosticSource,
} from '../scripts/assemble-app09b-ios-device-diagnostic.mjs';

test('APP-09B iOS diagnostic listens to pointer, touch and click in capture phase', () => {
  assert.equal(APP09B_IOS_DEVICE_DIAGNOSTIC_VERSION, '1.0.0');
  assert.match(iosDeviceDiagnosticSource, /addEventListener\('pointerup', handleInteraction, true\)/);
  assert.match(iosDeviceDiagnosticSource, /addEventListener\('touchend', handleInteraction, true\)/);
  assert.match(iosDeviceDiagnosticSource, /addEventListener\('click', handleInteraction, true\)/);
  assert.match(iosDeviceDiagnosticSource, /changedTouches\?\.\[0\]/);
  assert.match(iosDeviceDiagnosticSource, /hitTestNoteDetailed/);
  assert.match(iosDeviceDiagnosticSource, /selectRenderedScoreNoteRef/);
  assert.match(iosDeviceDiagnosticSource, /clearHighlights/);
  assert.match(iosDeviceDiagnosticSource, /st-score-highlight/);
});

test('APP-09B iOS diagnostic reports the physical event/hit/selection stage without opening release gates', () => {
  assert.match(iosDeviceDiagnosticSource, /MISS /);
  assert.match(iosDeviceDiagnosticSource, /STALE hit/);
  assert.match(iosDeviceDiagnosticSource, /hit rejected/);
  assert.match(iosDeviceDiagnosticSource, /selection rejected/);
  assert.match(iosDeviceDiagnosticSource, /SELECTED via /);
  assert.doesNotMatch(iosDeviceDiagnosticSource, /standaloneReleaseGatePassed\s*=\s*true/);
  assert.doesNotMatch(iosDeviceDiagnosticSource, /seslitabCutoverAuthorized\s*=\s*true/);
});

test('APP-09B iOS diagnostic HTML adds one self-hosted diagnostic script after the stable preview bootstrap', () => {
  const base = '<body><script src="./st-score-editor-app09b-bootstrap.js"></script></body>';
  const next = createIosDeviceDiagnosticHtml(base);
  assert.equal(
    next,
    '<body><script src="./st-score-editor-app09b-bootstrap.js"></script>\n<script src="./st-score-editor-app09b-ios-device-diagnostic.js"></script></body>',
  );
  assert.throws(
    () => createIosDeviceDiagnosticHtml('<body></body>'),
    /expected one bootstrap marker/,
  );
});
