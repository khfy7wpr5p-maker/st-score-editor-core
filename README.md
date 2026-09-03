# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for the standalone ST Score Editor App and later ST score products.

## Current reality

- **SSE-00–10 — COMPLETE / MERGED:** canonical V3/V4 score+notation, bounded MusicXML, topology and cross-staff runtime.
- **ST-SCORE-EDITOR-APP / PRODUCTIZATION — ACTIVE:** standalone editor app is the primary product target.
- **APP-00–08 — COMPLETE / MERGED:** document/runtime, unified V4 authoring, browser shell, local files/recovery, guarded renderer interaction, viewport, local playback and bounded export/print.
- **APP-09 automated hardening — COMPLETE / MERGED:** PR #89 / `2731490575550e38e65e9f4af576b25255b0d9d9` adds mobile/browser/accessibility/performance release guards.
- **APP-09 standalone release gate — PENDING MANUAL DEVICE/BROWSER MATRIX:** automated CI does not prove real iPhone/iPad/Safari or desktop browser behavior.
- **SesliTab V4 product cutover — DEFERRED / NOT AUTHORIZED:** no cutover until the APP-09 manual release matrix passes.

## Standalone product authority

```text
ST Score Editor App
        |
        +--> local file workflow (noncanonical)
        +--> IndexedDB recovery cache (noncanonical)
        +--> viewport + responsive hardening (presentation-only)
        +--> local playback transport (noncanonical)
        +--> export/print state (noncanonical)
        |
        v
ScoreEditorAppDocument
        |
        v
EditorSessionV4
        |
        +--> ScoreDocumentV3
        +--> NotationDocumentV4
        |
        +--> revision-bound playback plan --> local Web Audio output
        +--> admitted lossless MusicXML --> explicit export handoff
        |
        v
RendererRequestV4
        |
        +--> admitted projection --> renderer host (presentation-only)
        +--> opaque hit token --> SemanticAddressV3 selection
        +--> exact current rendered revision --> browser print dialog / Save as PDF
```

The app consumes Core; it never becomes a second score authority. File handles, recovery records, viewport state, renderer DOM/SVG/geometry, playback state, export/print state and APP-09 hardening state remain noncanonical.

## APP-09 automated hardening result

PR #89 adds release-oriented browser hardening without widening score authority:

- iOS/iPad-oriented dynamic viewport support through `100dvh`, `viewport-fit=cover` and safe-area insets, with `100vh` fallback;
- 44 CSS px minimum coarse-pointer targets for toolbar/keypad actions;
- `:focus-visible` keyboard focus treatment and `prefers-reduced-motion` behavior;
- toolbar/viewport/inspector/status semantic ARIA decoration and polite live status reporting;
- window resize, orientation change, `pageshow` and `visualViewport.resize` coalesce into presentation-only viewport-state reapply;
- `pagehide` and hidden-document transitions trigger best-effort local recovery flush, including fail-safe handling of storage errors;
- standalone app browser bundle is build-gated at 512 KiB (`524288` bytes);
- declared browser validation targets are iOS Safari, iPad Safari, desktop Safari, Chromium and Firefox;
- hardening has no canonical/history/network/server/publication authority and creates no score revision.

Automated Node 18/20/22 repository validation and full build/test passed on the exact PR head. This is not a substitute for real-device/browser verification. `standaloneReleaseGatePassed` and `seslitabCutoverAuthorized` therefore remain `false`.

## Canonical pair

```text
ScoreDocumentV3/3.0.0 + NotationDocumentV4/4.0.0
```

`SemanticAddressV3` remains canonical source identity. MusicXML remains exchange/projection data. Renderer, print and responsive-browser state never move canonical events.

## Remaining release gate

The outstanding APP-09 work is the manual device/browser matrix documented in `docs/app-09-standalone-release-gate.md`. Required targets are real iPhone Safari, iPad Safari, desktop Safari, Chromium and Firefox, covering open/edit/select, viewport/orientation, playback, recovery, export/print, keyboard/focus and regression safety.

Until that matrix passes, standalone release approval and SesliTab V4 cutover remain gated. `.mxl`, V4-native cross-staff MusicXML, unsupported advanced cross-staff scopes, cloud/server authority, public-write/production activation and E8-D direct external-engine invocation also remain gated.

Full productization sequence: `docs/st-score-editor-app-productization.md`.
