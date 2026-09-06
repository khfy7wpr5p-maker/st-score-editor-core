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
- **APP-10E — COMPLETE / MERGED:** standalone browser authoring workspace with Voice 1–5, pitch C–B, flat/natural/sharp entry alter, octave, 1 through 1/16 duration, note entry and unified undo/redo.
- **APP-10F — COMPLETE / MERGED:** PR #110 / `bc0c094af4a6e7b937882a3b09cfe6fd199f439a`; exact selected-note pitch edit, selected pitched-event duration edit, note-event Delete→rest and exact chord-tone Delete use existing V4 intents and unified history.
- **APP-10G — COMPLETE / MERGED:** PR #111 / `47076403a2a41a322f7ee28c7595d55555fc05c7`; explicit semantic Staff switching is same-part/same-frame only, creates no history and cannot create a missing Voice.
- **APP-10H — COMPLETE / MERGED:** PR #113 / `8eccb176ec9b21e50b0a98ce207deb160a16f220`; bounded append-only measure-frame growth for NEW synthetic scores under proven effective meter, aligned across content-bearing staves, with deterministic `frame:N` identity and imported MusicXML automatic growth fail-closed.
- **APP-10I — COMPLETE / MERGED:** PR #115 / `65e58c5a13760121c24a603e071aa72ec13f31d4`; presentation-only previous/next semantic measure navigation with exact Staff preservation, active Voice context preservation, no implicit Voice materialization and no history mutation.
- **APP-10J — COMPLETE / MERGED:** PR #117 / `578203792d43548c5b174ab7bd29da4819b22275`; exact `+Tone` chord construction through existing `ADD_CHORD_TONE`, unified history, APP-10F exact tone deletion and imported MusicXML chord round-trip.
- **APP-10K — COMPLETE / MERGED:** PR #119 / `9fb9acc93d8121edff2ed97dee26d1213d035966`; bounded exact Staccato/Accent/Tenuto toggles through existing V4 articulation authoring with exact semantic targeting, imported placement preservation, ambiguous same-kind fail-closed behavior and MusicXML round-trip coverage.
- **APP-10L — COMPLETE / MERGED:** PR #121 / `aeb08ecd71cad9a0b09b3ab44493d9fde5f19178`; bounded exact Trill/Turn/Mordent local ornament toggles through existing V4 ornament authoring with imported placement/accidental-mark preservation, same-kind ambiguity fail-closed, and spanning/grace ornament authority excluded.
- **APP-10M — COMPLETE / MERGED:** PR #123 / `25940b118b37edec874f7df3865bdd3cecf9c720`; exact selected-note Flat/Natural/Sharp authoring through existing V4 keypad execution with atomic canonical alter + notation accidental semantics, exact chord-tone isolation and imported MusicXML round-trip.
- **APP-10N — COMPLETE / MERGED:** PR #125 / `f3feae65ebb38a70ae09796c6d51f7cc6197a4fa`; bounded exact Strong Accent/Staccatissimo/Spiccato toggles through the existing V4 articulation authoring path. Exact pitched event/note-parent semantics are required, new specs use auto placement/null direction, a single existing same-kind spec is removed exactly, multiple same-kind specs fail closed, grace-event target authority remains excluded, and imported Strong Accent plus Guitar/Piano WebKit isolation are covered.
- **APP-10O — COMPLETE / MERGED:** PR #127 / `75822e2a75db165692fa1fdba4c6c9a774682577`; bounded exact Inverted Turn/Inverted Mordent/Shake toggles through the existing V4 ornament authoring path. Exact pitched event/note-parent semantics are required, new specs use auto placement with empty accidental marks, a single existing same-kind spec is removed exactly, multiple same-kind specs fail closed, spanning/grace authority remains excluded, and imported Inverted Turn plus Guitar/Piano WebKit isolation are covered.
- **APP-11A — COMPLETE / MERGED:** PR #129 / `402783e3b61f80ed651d6df641c497ad8dd226f1`; introduces the read-only V3/V4 rhythm-timing admission foundation for exact event-duration proposals. It classifies shrink/grow/no-op, exact next-event space, synthetic meter bounds, overlap, dots/beams/tuplets/ties coupling, existing invalid timing and unproven imported trailing growth.
- **APP-11B — COMPLETE / MERGED:** PR #131 / `0d8c5263e2dea591352e88d163474b5452f8b1b7`; routes BasicAuthoringV4 duration mutation and keypad Duration/Rest/Dot timing changes through shared safe rhythm authority. Contraction deterministically creates or extends explicit residual rest space; growth consumes only adjacent admitted rest space; pitched occupancy, insufficient rest space, coupled beam/tuplet/tie timing and unproven imported trailing growth remain fail-closed. One accepted edit creates one `EditorSessionV4` history revision. Dedicated APP-11B WebKit plus retained APP-10E–O and APP-09B renderer regressions passed before merge.
- **Stage 07 semantic → renderer presentation locator — COMPLETE / MERGED:** PR #108 / `9429116bd5c92d4db4c4edbb21b307c6c74c2391`; exact current-revision `SemanticAddressV3 -> ScoreNoteRef/ScoreMeasureRef` lookup is read-only and complements the existing renderer-hit path.
- **Manual standalone release matrix — DEFERRED FOR CURRENT DEVELOPMENT / REQUIRED BEFORE RELEASE.**
- **SesliTab V4 product cutover — DEFERRED / NOT AUTHORIZED** until the standalone release matrix passes.

## Current product architecture phase

The project is now in **strong-editor semantic selection and relation authoring**, built on the completed APP-11A/B timing authority:

```text
Guitar/Piano New score
        -> exact semantic Staff + Voice 1–5 context
        -> previous/next semantic measure navigation
        -> bounded note entry / selected-note edit / +Tone chord construction
        -> exact articulation / local ornament / explicit accidental authoring
        -> bounded synthetic end-of-score measure append
        -> shared APP-11 Rhythm & Timing Authority
             -> exact EventAddressV3 admission
             -> contraction/growth/no-op classification
             -> overlap / synthetic meter / imported-tail guards
             -> beam/tuplet/tie timing-coupling veto
             -> explicit residual-rest creation/resize
             -> adjacent explicit-rest consumption on safe growth
        -> EditorSessionV4 canonical commit
        -> unified undo/redo
        -> MusicXML projection/export
        -> renderer presentation
```

All canonical score/notation edits converge on `ScoreDocumentV3 + NotationDocumentV4` through `EditorSessionV4`. Staff/measure navigation, palette/notation-control state, file/recovery, renderer presentation, viewport, playback, export/print and release-hardening state remain noncanonical.

Renderer interaction remains identity/presentation-only and neither direction grants DOM/SVG/coordinate/geometry authority.

## Release matrix status

The release manifest deliberately remains:

- `manualDeviceValidationRequired: true`
- `standaloneReleaseGatePassed: false`
- `seslitabCutoverAuthorized: false`

Current practical release targets remain real iPhone Safari, Android Chrome, Windows Edge, Windows Chrome and Windows Firefox, with iPad Safari secondary. Existing iPhone evidence is partial only.

## Next development action

**APP-11C — Selection Model V2 / explicit semantic range and endpoint construction.**

Repository reality already contains relation-capable keypad primitives with explicit advanced targets:

- `NOTE_PAIR` for tie/slur endpoints;
- exact three-event `EVENT_RANGE` for triplet/tuplet operations.

The next layer must therefore avoid inventing a second relation engine. APP-11C should build a reusable, revision-bound semantic selection model that can safely derive those existing target contracts from explicit user selection.

Minimum APP-11C boundaries:

- single selection remains exact `SemanticAddressV3` compatible;
- multi-selection/ranges are non-renderer-authoritative and contain exact revision-bound semantic addresses only;
- ordered event ranges must be same canonical scope where the downstream primitive requires it;
- note-pair targets must preserve exact note identity, including chord-tone identity;
- stale addresses, mixed incompatible scopes, duplicates, non-contiguous ranges where contiguity is required and ambiguous ordering fail closed;
- selection state itself creates no score/notation/history mutation;
- converting a proven selection into `NOTE_PAIR` or `EVENT_RANGE` is deterministic and read-only;
- accepted relation authoring later still commits through existing `EditorSessionV4` / keypad authority, not through the selection layer.

After APP-11C is proven, the first professional relation UI should expose **Tie**, then **Slur**, then **Triplet/Tuplet**, reusing the existing relation primitives rather than duplicating notation logic.

Do not open release or SesliTab gates as part of feature development.

## Still fail-closed / gated

- arbitrary imported trailing MusicXML duration growth without pickup/non-controlling evidence;
- independent retiming of beam/tuplet/tie-coupled events;
- arbitrary rest redistribution beyond the admitted APP-11B adjacent residual-rest contract;
- multi-target tie/slur/tuplet browser UI until APP-11C explicit semantic selection/range construction is proven;
- spanning tremolo/wavy-line and broader grace relation workflows until separately admitted;
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
