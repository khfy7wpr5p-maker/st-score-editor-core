# ST Score Editor App — Productization Program

Status: **ACTIVE / APP-00–10M COMPLETE / MERGED / STAGE 07 COMPLETE / MERGED / MANUAL RELEASE MATRIX DEFERRED BUT REQUIRED**

Date: 2026-09-05

## Product decision

ST Score Editor must pass its standalone release gate before any SesliTab V4 product cutover. Canonical editing remains `ScoreDocumentV3 + NotationDocumentV4` owned by `EditorSessionV4`. UI/file/recovery/renderer/viewport/playback/export/print/release-hardening/authoring-palette/Staff/Voice/measure-navigation/chord-tone/articulation/ornament/explicit-accidental control state is noncanonical. Local product operation requires no backend.

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

PR #89 / `2731490575550e38e65e9f4af576b25255b0d9d9`. Dynamic viewport/safe-area behavior, coarse-pointer targets, accessibility semantics, lifecycle recovery flushes and the 512 KiB standalone bundle limit remain presentation/recovery only.

### APP-09B — Physical renderer interaction hardening
Status: **BLOCKER RESOLVED / RELEASE MATRIX STILL OPEN**

The permanent iPhone interaction policy uses OSMD `autoResize:false` plus host-controlled exact-current-revision rerender on resize/orientation/`visualViewport` changes. Physical iPhone Safari evidence confirms semantic note selection and portrait → landscape → portrait selection. This remains partial release evidence only.

## APP-10 — Standalone authoring-workspace expansion

### APP-10A–J — Core browser score-authoring sequence
Status: **COMPLETE / MERGED**

APP-10A/B create and select admitted Guitar/Piano new-score presets. APP-10C/D add exact Voice 1–5 insertion/materialization. APP-10E exposes browser note entry. APP-10F adds exact selected-note edit/delete. APP-10G adds presentation-only Staff context. APP-10H adds bounded synthetic measure growth. APP-10I adds presentation-only semantic measure navigation. APP-10J exposes exact `+Tone` chord construction. All actual mutations remain in unified `EditorSessionV4` history; renderer geometry has no authoring authority.

### APP-10K — Bounded exact articulation toggles
Status: **COMPLETE / MERGED**

PR #119 / `9fb9acc93d8121edff2ed97dee26d1213d035966`.

Admitted browser kinds are Staccato, Accent and Tenuto. Exact pitched event or exact note-parent event is required. New specs use auto placement/null direction; a single existing same-kind spec is removed exactly; multiple same-kind specs fail closed. Imported MusicXML articulation add + lossless export/re-import is covered.

### APP-10L — Bounded exact local ornament toggles
Status: **COMPLETE / MERGED**

PR #121 / `aeb08ecd71cad9a0b09b3ab44493d9fde5f19178`.

Admitted kinds are Trill, Turn and Mordent. Exact pitched event or note-parent event is required. New specs use auto placement and no accidental marks; a single existing same-kind ornament is removed exactly while preserving imported placement/accidental-mark semantics; multiple same-kind ornaments fail closed. Spanning tremolo/wavy-line and grace-event ornament authority are excluded. Imported MusicXML round-trip is covered.

### APP-10M — Bounded exact explicit accidentals
Status: **COMPLETE / MERGED**

PR #123 / `25940b118b37edec874f7df3865bdd3cecf9c720`.

APP-10M exposes a deliberately narrow, single-note subset of the already-admitted keypad execution contract instead of adding another pitch-editing model.

- admitted browser actions are exactly Flat, Natural and Sharp;
- the current semantic selection must be exact kind `note`; event/rest/measure/document selections fail closed instead of being converted to note targets;
- actions reuse existing `commitKeypad` with `accidental.flat`, `accidental.natural` and `accidental.sharp`;
- each accepted action atomically updates the exact note's canonical `pitch.alter` (-1/0/+1) and `NoteNotation.accidental` (flat/natural/sharp) in one V4 revision;
- the action does not change note step or octave;
- on a chord, only the exact selected tone changes; sibling chord tones retain their pitch and note notation;
- each accepted action creates exactly one `EditorSessionV4` history revision and exact note selection is rebound to the new revision;
- APP-10M exposes no advanced keypad `EVENT_RANGE`/`NOTE_PAIR` target authority;
- dot/rest/tuplet/tie/slur keypad actions are not exposed by this browser package;
- imported MusicXML explicit accidental editing is admitted after exact note selection and covered by lossless export/re-import, including explicit Natural;
- renderer DOM/SVG/coordinates/nearest geometry never determine note or accidental target.

Core/browser regression covers Flat/Natural/Sharp atomic score+notation updates, undo/redo, step/octave preservation, exact chord-tone isolation, imported MusicXML round-trip, unsupported-kind rejection and non-note fail-closed behavior. Exact-head WebKit covers Guitar exact-tone accidental editing, APP-10H/10I multi-measure accidental isolation and Piano Staff 2 / Voice 5 accidental isolation while APP-10E–L and APP-09B regressions remain green.

## Stage 07 — Exact semantic-to-render presentation locators
Status: **COMPLETE / MERGED**

PR #108 / `9429116bd5c92d4db4c4edbb21b307c6c74c2391`.

Adds exact current-revision `SemanticAddressV3 -> ScoreNoteRef` and `SemanticAddressV3 -> ScoreMeasureRef` presentation lookup while preserving the existing renderer-hit selection path. Reverse lookup is read-only and renderer coordinate/DOM/SVG guessing remains forbidden.

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

APP-10M closes the exact explicit accidental browser gap. Do not declare APP-10N yet. Perform a fresh repository audit for the next bounded user-facing authoring gap. Augmentation dots require a timing-space admission contract because the existing primitive changes event duration without retiming neighboring events. Tuplet/tie/slur, spanning ornaments and grace workflows remain separate multi-target/structured programs.

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
