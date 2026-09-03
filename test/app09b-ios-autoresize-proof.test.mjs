import test from 'node:test';
import assert from 'node:assert/strict';

import { applyDeviceTestAutoResizePolicy } from '../scripts/assemble-app09b-preview-stable.mjs';

const bootstrap = `before\n            autoResize: true,\nafter\n`;

test('APP-09B iOS proof mode changes only the exact renderer autoResize option', () => {
  assert.equal(applyDeviceTestAutoResizePolicy(bootstrap, false), bootstrap);
  const patched = applyDeviceTestAutoResizePolicy(bootstrap, true);
  assert.match(patched, /autoResize: false/);
  assert.doesNotMatch(patched, /autoResize: true/);
  assert.match(patched, /^before/m);
  assert.match(patched, /after/);
});

test('APP-09B iOS proof mode fails closed when the exact option is missing or duplicated', () => {
  assert.throws(
    () => applyDeviceTestAutoResizePolicy('autoResize: false', true),
    /expected one autoResize:true render option, observed 0/
  );
  assert.throws(
    () => applyDeviceTestAutoResizePolicy(`${bootstrap}${bootstrap}`, true),
    /observed 2/
  );
});
