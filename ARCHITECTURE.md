# ST Score Editor Core — Architecture

Status: **SEC-NE and SSE-00–10 are merged. ST-SCORE-EDITOR-APP APP-00–08 are COMPLETE / MERGED. APP-09 automated hardening is COMPLETE / MERGED; the manual standalone device/browser release matrix remains PENDING.**

## Product architecture

```text
Standalone HTML / Browser Shell
        |
        +--> browser-local file workflow (noncanonical)
        +--> recovery/autosave cache (noncanonical)
        +--> viewport + APP-09 responsive hardening (presentation-only)
        +--> playback transport state (noncanonical)
        +--> export/print state (noncanonical)
        |
        v
STScoreEditorApp controller
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
        +--> PlaybackPlanV1 --> local Web Audio
        +--> admitted lossless MusicXML --> explicit export handoff
        |
        v
RendererRequestV4
        |
        +--> admitted MusicXML projection --> attached renderer host
        +--> opaque manifest token --> SemanticAddressV3 selection
        +--> exact current presentation --> browser print / Save as PDF
```

A backend/service provider is not required for local editing, playback, export/print or APP-09 responsive hardening. SesliTab V4 integration remains unauthorized until the APP-09 manual device/browser release matrix passes.

## Canonical authority

One product session owns exactly one current pair:

```text
ScoreDocumentV3/3.0.0 + NotationDocumentV4/4.0.0
```

`SemanticAddressV3` is revision-bound canonical source identity. MusicXML is exchange/projection data. Browser file handles, recovery state, shell state, viewport state, renderer DOM/SVG/geometry, playback state, export/print state and release-hardening state are noncanonical.

Host/UI/playback/export/print/hardening layers cannot dual-write canonical score state. Canonical edits continue only through `EditorSessionV4` validation and unified V4 history.

## APP-01–08 product substrate

APP-01 owns document lifecycle. APP-02 composes admitted V4 authoring in one history. APP-03 provides the standalone browser bundle/shell. APP-04 provides bounded `.musicxml/.xml` local file workflow. APP-05 provides bounded browser-local recovery. APP-06 provides guarded renderer interaction and presentation-only viewport navigation. APP-07 provides revision-bound local playback. APP-08 provides noncanonical MusicXML export and exact-current-revision browser print/PDF handoff.

Cross-staff presentation preserves original source ownership. Non-empty cross-staff placements still remain `CROSS_STAFF_XML_PENDING` with `musicXml = null`.

## APP-09 automated hardening

APP-09 automated hardening is merged through PR #89 / `2731490575550e38e65e9f4af576b25255b0d9d9`.

### Responsive/mobile presentation boundary

The release-hardening wrapper sits above APP-08 and has no canonical or history mutation authority. It adds:

- `100dvh` dynamic viewport sizing with `100vh` fallback;
- safe-area inset padding for notched/mobile browser layouts;
- `viewport-fit=cover` standalone bootstrap;
- 44 CSS px coarse-pointer action targets;
- presentation-only reapply of existing zoom/scroll state after window resize, orientation change, `pageshow` and `visualViewport.resize`;
- no coordinate-based score mutation or renderer geometry authority.

The lifecycle reapply calls the existing viewport controller with the already-current presentation values. It does not synthesize score edits, alter `SemanticAddressV3`, or append V4 history.

### Recovery lifecycle boundary

`pagehide` and hidden-document transitions request a best-effort `flushRecovery()` through the existing browser-local recovery layer. Concurrent flushes are coalesced; async rejection and synchronous storage failure are swallowed at this lifecycle boundary because recovery failure must not become a canonical/editor crash path.

Recovery remains bounded, local and noncanonical. APP-09 does not turn recovery into persistence/server authority.

### Accessibility boundary

APP-09 adds presentation semantics only:

- toolbar landmark/label;
- score viewport region/label;
- keypad grouping;
- inspector label;
- polite atomic status live region;
- visible keyboard focus;
- reduced-motion styling.

These attributes may improve interaction/readout but cannot select or edit score content outside existing semantic controller paths.

### Automated performance/release gate

The standalone app browser build has a hard 512 KiB (`524288` bytes) bundle budget. The build fails if the emitted application bundle exceeds this limit. Existing forbidden capability-token, self-contained bundle and integrity-manifest checks remain in force.

The browser contract targets recorded by APP-09 are:

```text
ios-safari
ipad-safari
desktop-safari
chromium
firefox
```

Automated Node 18/20/22 validation and full build/test passed on the exact PR #89 head. These checks validate repository contracts and generated artifacts; they do not constitute physical-device/browser execution.

## Standalone release gate status

`manualDeviceValidationRequired = true`

`standaloneReleaseGatePassed = false`

`seslitabCutoverAuthorized = false`

Therefore APP-09 automated implementation is merged, but APP-09 as a product release gate is not complete. Real-device/browser validation must satisfy `docs/app-09-standalone-release-gate.md` before standalone release approval or SesliTab V4 cutover.

## Remaining gates

Manual APP-09 device/browser validation, SesliTab V4 cutover, `.mxl`, V4-native cross-staff MusicXML, unsupported advanced cross-staff scopes, cloud/server revision authority, public-write/production activation and E8-D direct external-engine invocation remain gated.
