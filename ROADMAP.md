# Roadmap

## Current source of truth

Repository reality only; planned capability is not production capability.

## Completed baseline

- **E0–E7-H — COMPLETE**
- **E8-A/B/C — IMPLEMENTED**
- **E8-D — HUMAN-GATED / NOT AUTHORIZED**
- **SEC-KP-00–10 — COMPLETE**
- **SEC-NE-00–09 + XML ROUNDTRIP — COMPLETE / MERGED** within documented bounded profiles.
- **SSE-00–10 — COMPLETE / MERGED** including bounded V3 topology and V4 cross-staff runtime.

## ST-SCORE-EDITOR-APP / PRODUCTIZATION

- **APP-00–08 — COMPLETE / MERGED:** standalone authority, V4 authoring, browser shell, local file/recovery, guarded renderer/viewport, local playback and bounded export/print.
- **APP-09 automated hardening — COMPLETE / MERGED:** PR #89 / `2731490575550e38e65e9f4af576b25255b0d9d9`.
  - iOS/iPad-oriented `100dvh`, `viewport-fit=cover` and safe-area support;
  - 44 CSS px coarse-pointer targets;
  - keyboard `focus-visible`, reduced-motion and ARIA status/landmark hardening;
  - resize/orientation/`visualViewport` presentation reapply without canonical mutation;
  - best-effort recovery flush on `pagehide`/hidden transitions;
  - standalone app bundle hard limit: 512 KiB;
  - automated Node 18/20/22 validation + full build/test green;
  - no canonical/history/network/server/publication authority.
- **APP-09 manual standalone release matrix — PENDING / REQUIRED:** real iPhone Safari, iPad Safari, desktop Safari, Chromium and Firefox execution evidence.
- **SesliTab V4 product cutover — DEFERRED / NOT AUTHORIZED** until the manual APP-09 release matrix passes.

## Product safety result through APP-09 automated hardening

All score edits still converge on `ScoreDocumentV3 + NotationDocumentV4` through `EditorSessionV4`. File APIs, recovery, renderer presentation, viewport state, playback, export/print and release-hardening state cannot directly mutate canonical score state. APP-09 lifecycle events may reapply presentation or request recovery flush only.

The automated release manifest deliberately records:

- `manualDeviceValidationRequired: true`
- `standaloneReleaseGatePassed: false`
- `seslitabCutoverAuthorized: false`

This prevents a green Node CI run from being mistaken for real-device release approval.

## Next action

Run and record the manual matrix in `docs/app-09-standalone-release-gate.md` before any standalone release approval or SesliTab V4 cutover.

## Still fail-closed / gated

- APP-09 real-device/browser matrix;
- standalone release until that matrix passes;
- SesliTab V4 cutover until standalone release gate passes;
- `.mxl` container support;
- direct PDF byte generation;
- grace playback timing beyond APP-07's explicit deferred/partial behavior;
- split-chord/grace/rest/percussion cross-staff placement;
- linked TAB as cross-staff target;
- relations between independent source voices/staffs;
- V4-native cross-staff MusicXML round trip;
- polymeter/non-controlling topology;
- part groups/brackets/braces;
- arbitrary instrument transposition and percussion maps;
- renderer-coordinate authoring, DOM/SVG authority and host dual-write;
- E8-D direct external-engine invocation;
- cloud sync/collaboration/server revision authority;
- public-write/production activation.
