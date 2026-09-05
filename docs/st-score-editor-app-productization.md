# ST Score Editor App — Productization Program

Status: **ACTIVE / APP-00–10L COMPLETE / MERGED / STAGE 07 COMPLETE / MERGED / MANUAL RELEASE MATRIX DEFERRED BUT REQUIRED**

Date: 2026-09-05

## Product decision

ST Score Editor must pass its standalone release gate before any SesliTab V4 product cutover. Canonical editing remains `ScoreDocumentV3 + NotationDocumentV4` owned by `EditorSessionV4`. UI/file/recovery/renderer/viewport/playback/export/print/release-hardening/authoring-palette/Staff/Voice/measure-navigation/chord-tone/articulation/ornament-control state is noncanonical. Local product operation requires no backend.

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

APP-10H adds one compact browser `Add measure` action backed by the current `editor-topology-authoring-v4 -> EditorSessionV4` path rather than a parallel structural editor. Admission is deliberately bounded: NEW/synthetic-score only, exactly one end frame per action, proven effective meter, all content-bearing staves aligned to the same global frame, Voice 1 explicit full-measure rest, no automatic Voice 2–5, linked TAB no owned measure, imported MusicXML automatic growth fail-closed, deterministic `frame:N` identity and one unified history revision.

### APP-10I — Presentation-only semantic measure navigation
Status: **COMPLETE / MERGED**

PR #115 / `65e58c5a13760121c24a603e071aa72ec13f31d4`.

APP-10I exposes compact previous / active measure / next controls without creating a second score authority. Navigation is adjacent-frame, same-part/same-staff semantic only, preserves active Voice context, carries the onset to a containing event where possible, falls back to the exact measure if that Voice is absent, never materializes a Voice and creates no canonical history revision. Imported MusicXML navigation is admitted after exact frame-bearing semantic selection.

### APP-10J — Bounded exact chord-tone authoring
Status: **COMPLETE / MERGED**

PR #117 / `578203792d43548c5b174ab7bd29da4819b22275`.

APP-10J exposes the existing `ADD_CHORD_TONE` V4 semantic primitive through one compact browser `+Tone` action. Exact selected pitched event/note is required, each action adds exactly one fresh palette-pitch tone, the new tone becomes exact selection, accepted mutations use `commitBasic -> EditorSessionV4`, APP-10F exact chord-tone Delete remains the removal path, imported MusicXML chord-tone add + lossless export/re-import is covered, and renderer geometry never determines the target.

### APP-10K — Bounded exact articulation toggles
Status: **COMPLETE / MERGED**

PR #119 / `9fb9acc93d8121edff2ed97dee26d1213d035966`.

APP-10K exposes the existing V4 articulation authoring primitive through three compact browser toggles without adding any new notation mutation authority.

- admitted kinds are exactly `staccato`, `accent` and `tenuto`;
- exact selected pitched normal event or exact note-parent event is required;
- new specs use `placement:'auto'` and `direction:null`;
- a single existing same-kind articulation is removed exactly, preserving imported placement/direction semantics;
- multiple same-kind specs are ambiguous and fail closed;
- accepted operations use existing `commitArticulation -> EditorSessionV4`;
- imported MusicXML articulation add + lossless export/re-import is covered;
- renderer DOM/SVG/coordinates/nearest geometry never determine target or placement.

### APP-10L — Bounded exact local ornament toggles
Status: **COMPLETE / MERGED**

PR #121 / `aeb08ecd71cad9a0b09b3ab44493d9fde5f19178`.

APP-10L exposes a deliberately bounded single-event subset of the existing V4 ornament authoring primitive through three compact browser toggles; it does not introduce a second ornament mutation model.

- admitted kinds are exactly `trill-mark`, `turn` and `mordent`;
- the current selection must resolve to an exact pitched normal event or an exact note whose parent event resolves semantically;
- rest/non-event targets fail closed;
- new browser-authored local ornaments use `placement:'auto'` and `accidentalMarks:[]`;
- when exactly one same-kind local ornament already exists, the browser removes that exact `OrnamentSpec`, preserving imported placement and accidental-mark semantics rather than normalizing them;
- when multiple same-kind local ornaments exist, the browser marks the kind ambiguous and refuses to guess;
- unsupported local ornament kinds fail closed at the browser boundary;
- accepted operations use existing `commitOrnament -> EditorSessionV4` and create one canonical history revision per toggle;
- spanning tremolo/wavy-line relation authority is explicitly excluded from APP-10L;
- grace-event ornament target authority is explicitly excluded from APP-10L;
- imported MusicXML local ornament authoring is admitted and covered by lossless export/re-import;
- exact imported-style removal coverage preserves explicit placement and accidental-mark semantics;
- renderer DOM/SVG/coordinates/nearest geometry never determine target or ornament placement.

Core regression covers Trill/Turn/Mordent add/remove, unified undo/redo, imported MusicXML round-trip, exact imported placed/accidental-mark ornament removal, ambiguous same-kind rejection, unsupported-kind rejection and non-pitched selection rejection. Exact-head WebKit covers Guitar chord-event ornament authoring, APP-10H/10I multi-measure ornament isolation and Piano Staff 2 / Voice 5 ornament isolation. APP-10E/F/G/H/I/J/K plus APP-09B renderer/orientation regressions remain green in the same gate.

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

APP-10L closes the first bounded local ornament browser gap while preserving existing V4 notation authority. Do not declare APP-10M yet. Perform a fresh repository audit to identify the highest-value remaining bounded browser authoring gap. Multi-target tremolo/wavy-line, tie/slur and grace workflows require explicit endpoint/target-selection contracts and must not be inferred from presentation geometry.

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
