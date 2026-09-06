# ST Score Editor App — Productization Program

Status: **ACTIVE / APP-00–10O COMPLETE / MERGED / STAGE 07 COMPLETE / MERGED / MANUAL RELEASE MATRIX DEFERRED BUT REQUIRED**

Date: 2026-09-05

## Product decision

ST Score Editor must pass its standalone release gate before any SesliTab V4 product cutover. Canonical editing remains `ScoreDocumentV3 + NotationDocumentV4` owned by `EditorSessionV4`. UI/file/recovery/renderer/viewport/playback/export/print/release-hardening/authoring-palette/Staff/Voice/measure-navigation/chord-tone/articulation/ornament/explicit-accidental control state is noncanonical. Local product operation requires no backend.

Device/browser validation is intentionally deferred during the current authoring-workspace development phase. Deferral is not release approval: `standaloneReleaseGatePassed` and `seslitabCutoverAuthorized` remain false.

## Completed stages

### APP-00–08 — Standalone product substrate
Status: **COMPLETE / MERGED**

Document/runtime, unified V4 authoring, standalone browser bundle, bounded local MusicXML workflow, guarded local recovery, renderer/viewport interaction, local playback and bounded export/print are merged. `.mxl`, direct PDF bytes and unsupported projections remain gated.

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

APP-10A/B create/select Guitar/Piano new scores. APP-10C/D add exact Voice 1–5 insertion/materialization. APP-10E exposes note entry. APP-10F adds exact selected-note edit/delete. APP-10G adds presentation-only Staff context. APP-10H adds bounded synthetic measure growth. APP-10I adds presentation-only semantic measure navigation. APP-10J exposes exact `+Tone`. Actual mutations remain in unified `EditorSessionV4` history; renderer geometry has no authoring authority.

### APP-10K — Bounded exact articulation toggles
Status: **COMPLETE / MERGED**

PR #119 / `9fb9acc93d8121edff2ed97dee26d1213d035966`. Admitted browser kinds are Staccato, Accent and Tenuto. Exact pitched event or exact note-parent event is required. New specs use auto placement/null direction; one same-kind spec is removed exactly; ambiguity fails closed. Imported MusicXML round-trip is covered.

### APP-10L — Bounded exact local ornament toggles
Status: **COMPLETE / MERGED**

PR #121 / `aeb08ecd71cad9a0b09b3ab44493d9fde5f19178`. Admitted kinds are Trill, Turn and Mordent. New specs use auto placement/no accidental marks; exact imported semantics are preserved on removal; ambiguity fails closed. Spanning tremolo/wavy-line and grace-event ornament authority are excluded.

### APP-10M — Bounded exact explicit accidentals
Status: **COMPLETE / MERGED**

PR #123 / `25940b118b37edec874f7df3865bdd3cecf9c720`. Exact Flat/Natural/Sharp actions require exact `note` selection and reuse existing V4 keypad execution. Canonical `pitch.alter` and `NoteNotation.accidental` update atomically in one history revision while step/octave and sibling chord tones remain isolated. No advanced keypad target or dot/rest/tuplet/tie/slur surface is exposed.

### APP-10N — Bounded extended articulation toggles
Status: **COMPLETE / MERGED**

PR #125 / `f3feae65ebb38a70ae09796c6d51f7cc6197a4fa`.

APP-10N exposes a second bounded single-event articulation group without changing APP-10K or introducing a parallel notation mutation engine.

- admitted browser kinds are exactly `strong-accent`, `staccatissimo` and `spiccato`;
- the current selection must resolve exactly to a pitched normal event or exact note-parent event;
- rest/non-event targets fail closed;
- new specs use `placement:'auto'` and `direction:null`;
- one existing same-kind articulation is removed using the exact existing `ArticulationSpec`, preserving imported placement and Strong Accent direction semantics rather than rewriting them;
- multiple same-kind specs are ambiguous and fail closed;
- unsupported extended articulation kinds fail closed at the browser boundary;
- accepted operations reuse `commitArticulation -> EditorSessionV4`, one canonical history revision per toggle;
- grace-event articulation target authority is explicitly excluded from the APP-10N browser surface;
- APP-10K Staccato/Accent/Tenuto remains unchanged;
- imported MusicXML Strong Accent add survives lossless export/re-import; exact imported-style Strong Accent removal covers placement/direction semantics;
- renderer DOM/SVG/coordinates/nearest geometry never determine target or placement.

Core regression covers all three admitted kinds, unified undo/redo, imported MusicXML Strong Accent round-trip, exact imported-style removal, ambiguity/unsupported/non-pitched fail-closed behavior. Exact-head WebKit covers Guitar chord-event authoring, APP-10H/10I multi-measure isolation and Piano Staff 2 / Voice 5 isolation while APP-10E–M and APP-09B remain green.

### APP-10O — Bounded extended local ornament toggles
Status: **COMPLETE / MERGED**

PR #127 / `75822e2a75db165692fa1fdba4c6c9a774682577`.

APP-10O exposes a second bounded single-event simple-ornament group without changing APP-10L or introducing a parallel ornament mutation engine.

- admitted browser kinds are exactly `inverted-turn`, `inverted-mordent` and `shake`;
- the current selection must resolve exactly to a pitched normal event or exact note-parent event;
- rest/non-event targets fail closed;
- new specs use `placement:'auto'` and `accidentalMarks:[]`;
- one existing same-kind ornament is removed using the exact existing `OrnamentSpec`, preserving imported placement and accidental-mark semantics rather than rewriting them;
- multiple same-kind specs are ambiguous and fail closed;
- unsupported extended local ornament kinds fail closed at the browser boundary;
- accepted operations reuse `commitOrnament -> EditorSessionV4`, one canonical history revision per toggle;
- spanning tremolo/wavy-line relation authority is explicitly excluded;
- grace-event ornament target authority is explicitly excluded from APP-10O;
- APP-10L Trill/Turn/Mordent remains unchanged;
- imported MusicXML Inverted Turn add survives lossless export/re-import; exact imported-style removal covers placement/accidental-mark semantics;
- renderer DOM/SVG/coordinates/nearest geometry never determine target or placement.

Core regression covers all three admitted kinds, unified undo/redo, imported MusicXML Inverted Turn round-trip, exact imported-style removal, ambiguity/unsupported/non-pitched fail-closed behavior. Exact-head WebKit covers Guitar chord-event authoring, APP-10H/10I multi-measure isolation and Piano Staff 2 / Voice 5 isolation while APP-10E–N and APP-09B remain green.

## Stage 07 — Exact semantic-to-render presentation locators
Status: **COMPLETE / MERGED**

PR #108 / `9429116bd5c92d4db4c4edbb21b307c6c74c2391`. Exact current-revision `SemanticAddressV3 -> ScoreNoteRef/ScoreMeasureRef` lookup remains read-only and complements renderer-hit selection. Renderer coordinate/DOM/SVG guessing remains forbidden.

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

APP-10O closes a second bounded single-event local-ornament browser gap. Do not declare APP-10P yet. Perform a fresh repository audit for the next highest-value bounded user-facing authoring gap. Augmentation dots still require timing-space admission because the current primitive changes event duration without retiming neighbors. Tuplet/tie/slur, spanning ornaments and grace workflows remain separate structured/multi-target programs.

The device/browser matrix must be resumed before any standalone release closeout. A separate evidence-backed closeout is required before `standaloneReleaseGatePassed` can become true; SesliTab product integration/cutover remains later and separate.

## Explicitly deferred / gated

- standalone release until the manual release matrix passes;
- SesliTab V4 product cutover until standalone release gate passes;
- server revision authority and cloud collaboration;
- public-write/publication activation;
- direct PDF-byte generation;
- V4-native cross-staff MusicXML round trip;
- `.mxl` container support;
- renderer-coordinate authoring or DOM/SVG/geometry authority;
- grace playback timing beyond APP-07's deferred/partial boundary;
- unsupported advanced notation scopes already gated by SSE-10.
