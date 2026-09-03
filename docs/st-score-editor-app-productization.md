# ST Score Editor App — Productization Program

Status: **ACTIVE / APP-00–08 COMPLETE / MERGED / APP-09 AUTOMATED HARDENING COMPLETE / MERGED / MANUAL RELEASE MATRIX PENDING**

Date: 2026-09-03

## Product decision

ST Score Editor must pass its standalone release gate before any SesliTab V4 product cutover. Canonical editing remains `ScoreDocumentV3 + NotationDocumentV4` owned by `EditorSessionV4`. UI/file/recovery/renderer/viewport/playback/export/print/release-hardening state is noncanonical. Local product operation requires no backend.

## Completed stages

### APP-00 — Standalone product contract
Status: **COMPLETE / MERGED**

### APP-01 — Document runtime
Status: **COMPLETE / MERGED**

### APP-02 — Unified V4 authoring session
Status: **COMPLETE / MERGED**

### APP-03 — Standalone browser bundle and shell
Status: **COMPLETE / MERGED**

### APP-04 — Local file workflow
Status: **COMPLETE / MERGED**

Bounded `.musicxml/.xml` open/save/download, lossless-export-first save ordering and document-bound file handles. `.mxl` remains unsupported.

### APP-05 — Local recovery/autosave
Status: **COMPLETE / MERGED**

Validated, bounded browser-local recovery with explicit guarded apply; recovery remains noncanonical and never auto-restores.

### APP-06 — Renderer interaction and viewport
Status: **COMPLETE / MERGED**

Current guarded renderer request, revision-bound semantic hit mapping and presentation-only viewport navigation. Renderer DOM/SVG/coordinates/geometry remain non-authoritative.

### APP-07 — Local playback transport
Status: **COMPLETE / MERGED**

PR #85 / `0608e231b536299086cd3a516c5f221ca41b01e8`. Revision-bound local playback, Web Audio transport, semantic cursor and playback-only tempo remain noncanonical. Grace playback timing remains explicitly deferred/partial.

### APP-08 — Export/print/PDF workflow
Status: **COMPLETE / MERGED**

PR #87 / `1d1c821be4c6192bdf562fcd2d9fde6f90f178fa`. Export reuses admitted lossless MusicXML without marking saved; print/PDF requires exact current renderer revision and uses browser print dialog / Save as PDF. No direct PDF byte generator or publication authority is claimed.

## APP-09 — Product hardening and standalone release gate

### APP-09A — Automated browser/release hardening
Status: **COMPLETE / MERGED**

PR #89 / `2731490575550e38e65e9f4af576b25255b0d9d9`.

Implemented bounded behavior:

- release-hardening wrapper is layered above APP-08 and has no canonical/history/network authority;
- standalone bootstrap retains `viewport-fit=cover` and adds dynamic `100dvh` sizing with `100vh` fallback;
- shell applies safe-area insets for mobile/notched browser layouts;
- coarse-pointer toolbar/keypad actions have 44 CSS px minimum targets;
- keyboard focus uses `:focus-visible` and reduced-motion preferences disable nonessential transition/animation behavior;
- toolbar, score viewport, keypad, inspector and status receive bounded ARIA role/label/live-region presentation semantics;
- `resize`, `orientationchange`, `pageshow` and `visualViewport.resize` are coalesced into presentation-only reapplication of the already-current viewport zoom/scroll state;
- these lifecycle events do not create canonical revisions/history entries and cannot author by coordinates;
- `pagehide` and hidden-document transitions request best-effort `flushRecovery()` through the existing local recovery layer;
- concurrent recovery flushes are coalesced and both asynchronous rejection and synchronous storage failure remain nonfatal;
- standalone application bundle build fails above 512 KiB (`524288` bytes);
- target browser contracts are iOS Safari, iPad Safari, desktop Safari, Chromium and Firefox;
- exact-head PR #89 repository validation and full build/test pass on Node 18, 20 and 22;
- no schema change, new runtime dependency, MusicXML authority change, renderer-coordinate authority, E8-D invocation or SesliTab integration was introduced.

### APP-09B — Manual device/browser release matrix
Status: **PENDING / REQUIRED**

Automated Node CI cannot prove real browser/device behavior. The following targets must be exercised and recorded before release approval:

- real iPhone Safari;
- real iPad Safari;
- desktop Safari;
- Chromium-family desktop browser;
- Firefox desktop browser.

Required scenarios are defined in `docs/app-09-standalone-release-gate.md` and include open/edit/select, orientation/viewport stability, playback, recovery, export/print, keyboard/focus/accessibility, and regression safety.

Current release flags intentionally remain:

```text
manualDeviceValidationRequired = true
standaloneReleaseGatePassed = false
seslitabCutoverAuthorized = false
```

## Next action

Complete and record the APP-09B manual device/browser matrix. Only after all required release checks pass may `standaloneReleaseGatePassed` be changed to `true` in a separately evidenced closeout, after which a separate SesliTab product integration/cutover program may begin.

## Explicitly deferred / gated

- standalone release until APP-09B passes;
- SesliTab V4 product cutover until standalone release gate passes;
- server revision authority;
- cloud sync/collaboration;
- account system;
- public-write/publication activation;
- direct PDF-byte generation;
- V4-native cross-staff MusicXML round trip;
- `.mxl` container support;
- renderer-coordinate authoring or DOM/SVG/geometry authority;
- grace playback timing beyond APP-07's explicit deferred/partial boundary;
- unsupported advanced notation scopes already gated by SSE-10.
