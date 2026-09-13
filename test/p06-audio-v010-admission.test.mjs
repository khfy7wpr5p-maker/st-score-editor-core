import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const admission = fs.readFileSync("docs/p06-audio-v010-admission.md", "utf8");
const adapter = fs.readFileSync("packages/score-editor-sdk-v1/audio-v010.ts", "utf8");

test("P06-F v0.1.0 admission pins the official release identity", () => {
  assert.match(admission, /v0\.1\.0/);
  assert.match(admission, /d11a2dd9141169ddfec5901f3cadc4cce0d7b345/);
  assert.match(admission, /@st\/score-audio-contracts@0\.1\.0/);
  assert.match(admission, /@st\/score-audio-web@0\.1\.0/);
});

test("audio adapter remains noncanonical and fail-closed", () => {
  assert.match(adapter, /AUDIO_STALE_REVISION/);
  assert.match(adapter, /AUDIO_RUNTIME_UNAVAILABLE/);
  assert.match(adapter, /AUDIO_INSTRUMENT_NOT_QUALIFIED/);
  assert.doesNotMatch(adapter, /AudioContext/);
  assert.doesNotMatch(adapter, /sample assets/i);
});
