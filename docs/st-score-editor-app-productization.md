# ST Score Editor App — Productization Program

Status: **ACTIVE / APP-00–10E COMPLETE / MERGED / STAGE 07 COMPLETE / MERGED / MANUAL RELEASE MATRIX DEFERRED BUT REQUIRED**

Date: 2026-09-04

## Product decision

ST Score Editor must pass its standalone release gate before any SesliTab V4 product cutover. Canonical editing remains `ScoreDocumentV3 + NotationDocumentV4` owned by `EditorSessionV4`. UI/file/recovery/renderer/viewport/playback/export/print/release-hardening/authoring-palette state is noncanonical. Local product operation requires no backend.

Device/browser validation is intentionally deferred during the current authoring-workspace development phase. Deferral is not release approval: `standaloneReleaseGatePassed` and `seslitabCutoverAuthorized` remain false.

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

The release-hardening wrapper remains presentation/recovery only. It provides dynamic viewport/safe-area behavior, coarse-pointer targets, accessibility semantics, lifecycle recovery flushes and the 512 KiB standalone bundle limit without canonical/history/network authority.

### APP-09B — Physical renderer interaction hardening
Status: **BLOCKER RESOLVED / RELEASE MATRIX STILL OPEN**

The iPhone Safari blank/stale-selection sequence was isolated through physical diagnostics. The permanent interaction policy uses OSMD `autoResize:false`; resize/orientation/`visualViewport` changes request a host-controlled render of the exact current revision so live SVG and renderer ownership indexing are rebuilt together.

Physical iPhone Safari evidence confirms semantic note selection and portrait → landscape → portrait selection after the permanent fix. This is partial release evidence only; it does not authorize standalone release.

## APP-10 — Standalone authoring-workspace expansion

### APP-10A — Guitar/Piano new-score presets
Status: **COMPLETE / MERGED**

PR #103. Adds admitted `GUITAR_TREBLE` and `PIANO_GRAND_STAFF` starts. Piano grand staff is one Piano part with G/F standard staves and has renderer/export/re-import coverage.

### APP-10B — New-score browser selector
Status: **COMPLETE / MERGED**

PR #104. Exposes compact Guitar/Piano selection beside New. Selection state remains presentation-only and does not replace canonical score authority.

### APP-10C — Revision-bound position note entry and Voice 1–5
Status: **COMPLETE / MERGED**

PR #105. Adds exact insertion-position contracts, active Voice ordinals 1–5 and explicit-rest-only note entry. Stale positions and missing canonical Voices fail closed. Voice 1–5 MusicXML export/re-import is covered.

### APP-10D — Safe missing-Voice materialization
Status: **COMPLETE / MERGED**

PR #106. Missing Voice 1–5 may be created only in synthetic/new scores when exact full-measure coverage is proven. Imported MusicXML does not receive automatically invented Voices.

### APP-10E — Browser authoring workspace
Status: **COMPLETE / MERGED**

PR #107 / `2a018e709935336d8fadef91daa8990fffd69afd`.

The standalone browser authoring surface now exposes Voice 1–5, pitch C–B, flat/natural/sharp, octave, whole through 1/16 duration and bounded note entry. Voice materialization and note entry use one `EditorSessionV4` history; undo/redo remains unified. WebKit regression covers Guitar Voice-5 entry and Piano lower-staff isolation.

## Stage 07 — Exact semantic-to-render presentation locators
Status: **COMPLETE / MERGED**

PR #108 / `9429116bd5c92d4db4c4edbb21b307c6c74c2391`.

Adds exact current-revision `SemanticAddressV3 -> ScoreNoteRef` and `SemanticAddressV3 -> ScoreMeasureRef` presentation lookup while preserving the existing `ScoreNoteRef -> opaque token -> SemanticAddressV3` hit-selection path. Reverse lookup is read-only, stale presentation remains fail-closed, and renderer coordinates/DOM/SVG/nearest-note/pitch/radius guessing remain forbidden.

## Manual standalone release matrix
Status: **DEFERRED FOR CURRENT DEVELOPMENT / REQUIRED BEFORE RELEASE**

Current practical targets are:

- real iPhone Safari — partial physical evidence recorded, including selection and orientation G4 PASS;
- Android Chrome — required / pending;
- Windows 10/11 Edge — required / pending;
- Windows Chrome — required / pending;
- Windows Firefox — required / pending;
- real iPad Safari — deferred secondary validation.

Required scenarios remain defined in `docs/app-09-standalone-release-gate.md`. The full gate is not complete.

Current release flags intentionally remain:

```text
manualDeviceValidationRequired = true
standaloneReleaseGatePassed = false
seslitabCutoverAuthorized = false
```

## Current development action

Continue standalone authoring-workspace expansion after APP-10E and Stage 07. Fresh repository gaps should determine the next package, prioritizing explicit active-staff editing, note add/delete/replace behavior and multi-Voice authoring ergonomics while preserving the canonical/noncanonical boundary.

The device/browser matrix must be resumed before any standalone release closeout. A separate evidence-backed closeout is required before `standaloneReleaseGatePassed` can become true, and SesliTab product integration/cutover remains a later separate program.

## Explicitly deferred / gated

- standalone release until the manual release matrix passes;
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
