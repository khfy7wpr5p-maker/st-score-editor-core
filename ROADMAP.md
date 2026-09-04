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
- **APP-09 automated hardening — COMPLETE / MERGED:** responsive/mobile/accessibility/recovery lifecycle hardening and 512 KiB standalone bundle limit.
- **APP-09B renderer/mobile interaction blocker — RESOLVED / MERGED:** host-controlled rerender with OSMD `autoResize:false`; physical iPhone Safari selection and portrait → landscape → portrait interaction evidence obtained. This does not close the full release matrix.
- **APP-10A — COMPLETE / MERGED:** bounded `GUITAR_TREBLE` and `PIANO_GRAND_STAFF` new-score presets; Piano grand staff uses one Piano part with G/F staves and admitted MusicXML render/export/re-import.
- **APP-10B — COMPLETE / MERGED:** compact Guitar/Piano New-score selector; selector state is presentation-only and the legacy programmatic default remains compatible.
- **APP-10C — COMPLETE / MERGED:** revision-bound insertion positions, bounded active Voice 1–5 targeting and explicit-rest-only position note entry; Voice 1–5 MusicXML round trip is covered.
- **APP-10D — COMPLETE / MERGED:** missing Voice 1–5 materialization only for synthetic/new scores with proven exact full-measure coverage; imported MusicXML automatic Voice creation remains fail-closed.
- **APP-10E — COMPLETE / MERGED:** standalone browser authoring workspace with Voice 1–5, pitch C–B, flat/natural/sharp, octave, 1 through 1/16 duration, note entry and unified undo/redo.
- **APP-10F — COMPLETE / MERGED:** PR #110 / `bc0c094af4a6e7b937882a3b09cfe6fd199f439a`; exact selected-note pitch edit, selected pitched-event duration edit, note-event Delete→rest and exact chord-tone Delete use existing V4 intents and unified history. APP-10F WebKit covers enter → pitch → duration → delete → undo plus chord-tone deletion.
- **APP-10G — COMPLETE / MERGED:** PR #111 / `47076403a2a41a322f7ee28c7595d55555fc05c7`; explicit semantic Staff S1/S2/... switching is same-part/same-frame only, creates no history and cannot create a missing Voice. New synthetic scores receive a presentation-only exact initial authoring anchor. WebKit covers Piano S1→S2→Voice 5→note entry→S1 while preserving Staff isolation.
- **APP-10H — COMPLETE / MERGED:** PR #113 / `8eccb176ec9b21e50b0a98ce207deb160a16f220`; bounded append-only measure-frame growth for NEW synthetic scores. Proven effective meter is required; every content-bearing staff receives one aligned new measure with Voice 1 + explicit full-measure rest; linked TAB remains measure-less; imported MusicXML automatic growth fails closed. Deterministic `frame:N` identity preserves the admitted lossless MusicXML projection, and APP-10H WebKit covers Guitar/Piano growth plus APP-10F edit/delete after growth.
- **Stage 07 semantic → renderer presentation locator — COMPLETE / MERGED:** PR #108 / `9429116bd5c92d4db4c4edbb21b307c6c74c2391`; exact current-revision `SemanticAddressV3 -> ScoreNoteRef/ScoreMeasureRef` lookup is read-only and complements the existing `ScoreNoteRef -> opaque token -> SemanticAddressV3` hit path.
- **Manual standalone release matrix — DEFERRED FOR CURRENT DEVELOPMENT / REQUIRED BEFORE RELEASE:** physical/browser validation remains release-blocking.
- **SesliTab V4 product cutover — DEFERRED / NOT AUTHORIZED** until the standalone release matrix passes.

## Current product architecture phase

The project is in **standalone authoring-workspace expansion**. The working product path is:

```text
Guitar/Piano New score
        -> exact semantic Staff + Voice 1–5 context
        -> bounded note-entry / selected-note editing palette
        -> bounded synthetic end-of-score measure append
        -> EditorSessionV4 canonical commit
        -> unified undo/redo
        -> MusicXML projection/export
        -> renderer presentation
```

All score edits still converge on `ScoreDocumentV3 + NotationDocumentV4` through `EditorSessionV4`. File APIs, recovery, renderer presentation, viewport state, playback, export/print, authoring palette/Staff/Voice/measure-navigation state and release-hardening state cannot directly mutate canonical score state.

Renderer interaction remains bidirectional only at the presentation/identity layer:

```text
renderer ScoreNoteRef -> opaque current-revision token -> SemanticAddressV3 selection
SemanticAddressV3 -> exact current-revision ScoreNoteRef / ScoreMeasureRef -> presentation locator
```

Neither direction grants DOM/SVG/coordinate/geometry authority.

## Release matrix status

The release manifest deliberately remains:

- `manualDeviceValidationRequired: true`
- `standaloneReleaseGatePassed: false`
- `seslitabCutoverAuthorized: false`

Current practical release targets are:

- real iPhone Safari — partial physical evidence exists, including selection and orientation G4 PASS;
- Android Chrome — required, pending;
- Windows 10/11 Edge — required, pending;
- Windows Chrome — required, pending;
- Windows Firefox — required, pending;
- real iPad Safari — deferred secondary validation.

Device validation is intentionally deferred while standalone authoring development continues. It must be resumed and completed before any standalone release approval or SesliTab cutover.

## Next development action

Fresh repository audit after APP-10H found no browser product surface for moving authoring context to the previous/next semantic measure frame, even though exact `SemanticAddressV3` selection already exists in the substrate. The next recommended bounded package is **APP-10I — presentation-only semantic measure navigation / active measure-frame context**. This is a planning recommendation, not COMPLETE: navigation must create no canonical history, preserve exact Staff/Voice semantics where available, never implicitly materialize a missing Voice, fail closed on stale/invalid targets, and never infer measure identity from renderer coordinates/DOM/SVG.

If fresh APP-10I preflight finds an existing equivalent surface, do not duplicate it; return to remaining real authoring gaps. Do not open release or SesliTab gates as part of feature development.

## Still fail-closed / gated

- remaining real-device/browser release matrix;
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
