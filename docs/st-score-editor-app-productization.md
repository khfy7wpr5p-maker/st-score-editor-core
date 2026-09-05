# ST Score Editor App — Productization Program

Status: **ACTIVE / APP-00–10K COMPLETE / MERGED / STAGE 07 COMPLETE / MERGED / MANUAL RELEASE MATRIX DEFERRED BUT REQUIRED**

Date: 2026-09-05

## Product decision

ST Score Editor must pass its standalone release gate before any SesliTab V4 product cutover. Canonical editing remains `ScoreDocumentV3 + NotationDocumentV4` owned by `EditorSessionV4`. UI/file/recovery/renderer/viewport/playback/export/print/release-hardening/authoring-palette/Staff/Voice/measure-navigation/chord-tone/articulation-control state is noncanonical. Local product operation requires no backend.

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

The standalone browser authoring surface exposes Voice 1–5, pitch C–B, flat/natural/sharp, octave, whole through 1/16 duration and bounded note entry. Voice materialization and note entry use one `EditorSessionV4` history; undo/redo remains unified.

### APP-10F — Exact selected-note editing
Status: **COMPLETE / MERGED**

PR #110 / `bc0c094af4a6e7b937882a3b09cfe6fd199f439a`.

Adds browser controls for exact selected-note pitch edit, exact selected pitched-event duration edit, and bounded Delete. A single-note event becomes an explicit rest; an exact selected chord tone removes only that tone. Existing `editor-basic-authoring-v4` intents remain the mutation authority and all accepted edits stay in unified `EditorSessionV4` history. No coordinate/DOM/SVG target inference is admitted.

### APP-10G — Explicit semantic active Staff
Status: **COMPLETE / MERGED**

PR #111 / `47076403a2a41a322f7ee28c7595d55555fc05c7`.

Adds Staff S1/S2/... controls for standard staves in the current part. Staff switching is exact same-part/same-frame semantic selection only, creates no history and cannot materialize a missing Voice. The active Voice ordinal is preserved; if that Voice is absent on the target Staff, selection lands on the exact measure until the user explicitly activates/materializes the Voice through the existing admitted path.

New synthetic scores receive a presentation-only exact initial authoring anchor on the first standard staff / first frame / Voice 1 event. This enables blank-score authoring without granting renderer-rest hit or coordinate authority.

### APP-10H — Bounded synthetic measure-frame growth
Status: **COMPLETE / MERGED**

PR #113 / `8eccb176ec9b21e50b0a98ce207deb160a16f220`.

APP-10H adds one compact browser `Add measure` action backed by the current `editor-topology-authoring-v4 -> EditorSessionV4` path rather than a parallel structural editor. Admission is deliberately bounded:

- browser exposure is NEW/synthetic-score only;
- exactly one measure frame is appended at the document end per action;
- effective meter must be proven before append;
- all content-bearing standard/percussion staves receive exactly one new `StaffMeasureV3` aligned to the same global frame;
- each new measure starts with Voice 1 plus an explicit full-measure rest;
- Voice 2–5 remain explicit APP-10D materialization;
- tablature-linked staves retain the existing no-owned-measure contract;
- imported MusicXML automatic measure growth fails closed;
- custom/non-lossless frame identity fails closed; the admitted synthetic path preserves deterministic `frame:1`, `frame:2`, ... identity so existing lossless MusicXML projection/export remains available;
- append is exactly one canonical V4 history revision; moving selection to the new exact rest after append is presentation-only and creates no additional revision;
- renderer DOM/SVG/coordinates/geometry have no measure/timing authority.

Core tests cover Guitar/Piano frame alignment, explicit full-measure rests, undo/redo, stale-target and missing-meter rejection, imported-score rejection, deterministic frame identity, and Piano two-measure MusicXML export/re-import. Exact-head WebKit covers Guitar measure growth followed by APP-10F pitch/duration/delete, Piano Add measure → Staff 2 → Voice 5 → note → Staff 1 isolation, APP-10E/F/G, and the APP-09B renderer/orientation chain.

### APP-10I — Presentation-only semantic measure navigation
Status: **COMPLETE / MERGED**

PR #115 / `65e58c5a13760121c24a603e071aa72ec13f31d4`.

APP-10I exposes compact previous / active measure / next controls without creating a second score authority. It reuses exact current-revision semantic selection:

- only the immediately previous or next global `measureFrame` is targeted;
- part and Staff identity are preserved exactly;
- active Voice 1–5 remains presentation context and is preserved;
- when that Voice exists in the target measure, the current onset is carried to the containing canonical event when one exists;
- when that Voice is absent, selection falls back to the exact target measure; navigation itself never materializes the missing Voice;
- explicit Voice materialization remains the existing APP-10D path and requires a separate user action;
- semantic measure navigation creates no canonical history revision;
- imported MusicXML navigation is admitted after exact frame-bearing semantic selection even though imported automatic measure growth remains fail-closed;
- missing frame context and unavailable adjacent frames fail closed;
- renderer DOM/SVG/coordinates/nearest geometry have no target authority.

### APP-10J — Bounded exact chord-tone authoring
Status: **COMPLETE / MERGED**

PR #117 / `578203792d43548c5b174ab7bd29da4819b22275`.

APP-10J exposes the existing `ADD_CHORD_TONE` V4 semantic primitive through one compact browser `+Tone` action; it does not add a second mutation path.

- exact selected pitched event or note is required;
- each action adds exactly one fresh palette-pitch tone;
- a single-note event becomes a chord or an existing chord gains one tone;
- the newly created exact tone becomes selection;
- accepted mutations use `commitBasic -> EditorSessionV4` as one history revision;
- APP-10F exact chord-tone Delete remains the removal path;
- imported MusicXML chord-tone add + lossless export/re-import is covered;
- renderer geometry never determines the target.

### APP-10K — Bounded exact articulation toggles
Status: **COMPLETE / MERGED**

PR #119 / `9fb9acc93d8121edff2ed97dee26d1213d035966`.

APP-10K exposes the existing V4 articulation authoring primitive through three compact browser toggles without adding any new notation mutation authority.

- admitted kinds are exactly `staccato`, `accent` and `tenuto`;
- the current selection must resolve to an exact pitched normal event or an exact note whose parent event resolves semantically;
- rest/non-event targets fail closed;
- new browser-authored specs use `placement:'auto'` and `direction:null`;
- when exactly one same-kind articulation already exists, the browser removes that exact spec, preserving imported placement/direction semantics instead of rewriting them;
- when multiple same-kind specs exist, the browser marks the kind ambiguous and refuses to guess which spec to remove;
- unsupported articulation kinds fail closed at the browser boundary;
- accepted add/remove operations use existing `commitArticulation -> EditorSessionV4` and therefore create one canonical history revision per toggle;
- control pressed/disabled state is derived from current semantic notation but remains presentation-only;
- imported MusicXML articulation add is admitted and covered by lossless export/re-import;
- renderer DOM/SVG/coordinates/nearest geometry never determine target or articulation placement.

Core regression covers all three bounded kinds, undo/redo, imported MusicXML round-trip, exact removal of a placed imported-style articulation, ambiguous same-kind rejection, unsupported-kind rejection and non-pitched selection rejection. Exact-head WebKit covers Guitar chord-event articulation, APP-10H/10I multi-measure articulation isolation and Piano Staff 2 / Voice 5 articulation isolation. APP-10E/F/G/H/I/J plus APP-09B renderer/orientation regressions remain green in the same gate.

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

APP-10K closes the first bounded browser articulation gap while preserving existing V4 notation authority. Do not declare APP-10L yet. Perform a fresh repository audit to identify the highest-value remaining bounded browser authoring gap. Reuse existing semantic primitives; multi-target ornament/tie/slur/grace workflows require explicit target-selection contracts and must not be inferred from presentation geometry.

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
