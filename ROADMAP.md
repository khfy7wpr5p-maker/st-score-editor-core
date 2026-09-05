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
- **APP-10F — COMPLETE / MERGED:** PR #110 / `bc0c094af4a6e7b937882a3b09cfe6fd199f439a`; exact selected-note pitch edit, selected pitched-event duration edit, note-event Delete→rest and exact chord-tone Delete use existing V4 intents and unified history.
- **APP-10G — COMPLETE / MERGED:** PR #111 / `47076403a2a41a322f7ee28c7595d55555fc05c7`; explicit semantic Staff switching is same-part/same-frame only, creates no history and cannot create a missing Voice.
- **APP-10H — COMPLETE / MERGED:** PR #113 / `8eccb176ec9b21e50b0a98ce207deb160a16f220`; bounded append-only measure-frame growth for NEW synthetic scores under proven effective meter, aligned across content-bearing staves, with deterministic `frame:N` identity and imported MusicXML automatic growth fail-closed.
- **APP-10I — COMPLETE / MERGED:** PR #115 / `65e58c5a13760121c24a603e071aa72ec13f31d4`; presentation-only previous/next semantic measure navigation with exact Staff preservation, active Voice context preservation, no implicit Voice materialization and no history mutation.
- **APP-10J — COMPLETE / MERGED:** PR #117 / `578203792d43548c5b174ab7bd29da4819b22275`; exact `+Tone` chord construction through existing `ADD_CHORD_TONE`, unified history, APP-10F exact tone deletion and imported MusicXML chord round-trip.
- **APP-10K — COMPLETE / MERGED:** PR #119 / `9fb9acc93d8121edff2ed97dee26d1213d035966`; bounded exact Staccato/Accent/Tenuto toggles through existing V4 articulation authoring with exact semantic targeting, imported placement preservation, ambiguous same-kind fail-closed behavior and MusicXML round-trip coverage.
- **APP-10L — COMPLETE / MERGED:** PR #121 / `aeb08ecd71cad9a0b09b3ab44493d9fde5f19178`; bounded exact Trill/Turn/Mordent local ornament toggles through existing V4 ornament authoring. Exact selected pitched event/note-parent event is required. New specs use auto placement with empty accidental-mark list; a single existing same-kind ornament is removed exactly, while multiple same-kind ornaments fail closed as ambiguous. Imported MusicXML ornament add + lossless export/re-import, exact removal of placed/accidental-mark ornament semantics, undo/redo, Guitar chord-event/multi-measure and Piano Staff-2 Voice-5 isolation are covered. Spanning tremolo/wavy-line and grace-event ornament authority are explicitly excluded.
- **Stage 07 semantic → renderer presentation locator — COMPLETE / MERGED:** PR #108 / `9429116bd5c92d4db4c4edbb21b307c6c74c2391`; exact current-revision `SemanticAddressV3 -> ScoreNoteRef/ScoreMeasureRef` lookup is read-only and complements the existing renderer-hit path.
- **Manual standalone release matrix — DEFERRED FOR CURRENT DEVELOPMENT / REQUIRED BEFORE RELEASE.**
- **SesliTab V4 product cutover — DEFERRED / NOT AUTHORIZED** until the standalone release matrix passes.

## Current product architecture phase

The project is in **standalone authoring-workspace expansion**:

```text
Guitar/Piano New score
        -> exact semantic Staff + Voice 1–5 context
        -> previous/next semantic measure navigation
        -> bounded note entry / selected-note edit / +Tone chord construction
        -> exact Staccato / Accent / Tenuto articulation toggles
        -> exact Trill / Turn / Mordent local ornament toggles
        -> bounded synthetic end-of-score measure append
        -> EditorSessionV4 canonical commit for actual edits
        -> unified undo/redo
        -> MusicXML projection/export
        -> renderer presentation
```

All canonical score/notation edits still converge on `ScoreDocumentV3 + NotationDocumentV4` through `EditorSessionV4`. Staff/measure navigation, palette/articulation/ornament-control state, file/recovery, renderer presentation, viewport, playback, export/print and release-hardening state remain noncanonical.

Renderer interaction remains identity/presentation-only:

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

Current practical release targets remain real iPhone Safari, Android Chrome, Windows Edge, Windows Chrome and Windows Firefox, with iPad Safari secondary. Existing iPhone evidence is partial only.

## Next development action

APP-10L closes the first bounded local ornament exposure gap. Do a fresh repository audit before naming APP-10M. Prioritize already-admitted semantic primitives with exact target contracts. Multi-target tremolo/wavy-line, tie/slur and grace workflows must remain separate until endpoint/target selection contracts are explicit.

Do not open release or SesliTab gates as part of feature development.

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
