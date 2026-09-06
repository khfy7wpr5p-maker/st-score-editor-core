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
- **APP-11C — COMPLETE / MERGED:** PR #133 / `9cce12b82457fed345ff98c06e54e4e15f99adda`; adds revision-bound semantic `SINGLE`, `NOTE_PAIR` and contiguous same-measure `EVENT_RANGE` construction. Duplicate, stale, mixed-scope, reversed and non-contiguous selections fail closed. Selection itself remains noncanonical/history-free and only adapts proven semantic targets into the existing advanced keypad contracts.
- **APP-11D — COMPLETE / MERGED:** PR #134 / `d53edd07f286b7a5a78b3d3404d8c17a340b9cfa`; exposes bounded exact Tie authoring as `Tie Start -> exact second note/chord tone -> Tie Apply`. Capture is presentation-only; Apply reuses `tie.edit`, preserving same-pitch/consecutive-event authority in the existing primitive, commits exactly one `EditorSessionV4` revision and is covered by dedicated mobile WebKit regression.
- **APP-11E — COMPLETE / MERGED:** PR #135 / `36896d24cf48968a6aca4b5603e11db85304a863`; exposes bounded Slur authoring over the same semantic note-pair model. Different pitch and non-consecutive forward endpoints are admitted by the existing `slur.edit` primitive; capture is history-free, exact pair creation/removal and Undo are covered, and Tie remains bundled beneath the Slur runtime layer.
- **APP-11F — COMPLETE / MERGED:** PR #136 / `af1a4b49707a300697c1021892116739e20dccb1`; exposes bounded three-explicit-event Triplet authoring over APP-11C `EVENT_RANGE` and the existing `tuplet.triplet` primitive. Capture is explicit, ordered, contiguous and history-free. V1 does not retime onsets/durations and does not remove existing tuplet metadata: it only adds 3:2 metadata when the three events already have exact equal contiguous canonical triplet timing. Production MusicXML import and dedicated mobile WebKit regression cover the canonical `1/12 + 1/12 + 1/12` case; ordinary straight eighths fail closed rather than being silently retimed.
- **Stage 07 semantic → renderer presentation locator — COMPLETE / MERGED:** PR #108 / `9429116bd5c92d4db4c4edbb21b307c6c74c2391`; exact current-revision `SemanticAddressV3 -> ScoreNoteRef/ScoreMeasureRef` lookup is read-only and complements the existing renderer-hit path.
- **Manual standalone release matrix — DEFERRED FOR CURRENT DEVELOPMENT / REQUIRED BEFORE RELEASE.**
- **SesliTab V4 product cutover — DEFERRED / NOT AUTHORIZED** until the standalone release matrix passes.

## Current product architecture phase

The project is now in **strong-editor semantic selection, relation authoring and timing-space expansion**, built on the completed APP-11A/B timing authority:

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
        -> APP-11C semantic Selection V2
             -> exact SINGLE
             -> exact NOTE_PAIR
             -> exact contiguous EVENT_RANGE
        -> professional relation UI
             -> APP-11D Tie
             -> APP-11E Slur
             -> APP-11F bounded create-only Triplet metadata
        -> EditorSessionV4 canonical commit
        -> unified undo/redo
        -> MusicXML projection/export
        -> renderer presentation
```

All canonical score/notation edits converge on `ScoreDocumentV3 + NotationDocumentV4` through `EditorSessionV4`. Staff/measure navigation, semantic range capture, palette/notation-control state, file/recovery, renderer presentation, viewport, playback, export/print and release-hardening state remain noncanonical.

Renderer interaction remains identity/presentation-only and neither direction grants DOM/SVG/coordinate/geometry authority.

## Release matrix status

The release manifest deliberately remains:

- `manualDeviceValidationRequired: true`
- `standaloneReleaseGatePassed: false`
- `seslitabCutoverAuthorized: false`

Current practical release targets remain real iPhone Safari, Android Chrome, Windows Edge, Windows Chrome and Windows Firefox, with iPad Safari secondary. Existing iPhone evidence is partial only.

## Next development action

**APP-11G — Tuplet Retiming Admission Foundation.**

APP-11F proves the complete semantic/UI path for an explicit three-event range, but repository reality still deliberately refuses to retime ordinary events. The current advanced primitive calculates a written base from already-existing canonical triplet timing and throws `TUPLET_TIMING_INCONSISTENT` when straight timing would require onset mutation. There is no admitted browser/editor authority to silently move later events or reflow a Voice.

APP-11G should therefore be an enabling timing-space program, not another palette shortcut. Its first responsibility is to define when an exact three-event straight range can be transformed into 3-in-the-time-of-2 timing without violating canonical occupancy.

Minimum APP-11G boundaries to prove before mutation:

- input remains exactly three explicit, current-revision, contiguous events in one exact measure/Voice;
- determine the intended written base and candidate compressed durations deterministically;
- analyze every affected onset boundary, not only the three selected durations;
- preserve event identities and Voice ordering;
- reject dotted/beam/tuplet/tie-coupled or otherwise timing-dependent ranges until their transformations are separately admitted;
- never move unrelated following events implicitly unless an explicit reflow contract is designed and proven;
- prefer transformations inside an exact explicit-rest timing window when that permits local occupancy preservation;
- reject measure overflow, overlap, hidden-gap invention, imported pickup/non-controlling ambiguity and cross-Voice/cross-Staff timing dependencies;
- keep admission read-only first; mutation must be a later explicit atomic `EditorSessionV4` operation after the contract is proven;
- MusicXML remains projection/exchange, renderer geometry remains non-authoritative.

Only after APP-11G can prove a deterministic local timing transformation should Triplet authoring gain automatic retiming/removal behavior. Grace-note, beam and broader measure-topology authoring remain subsequent strong-editor programs rather than being mixed into tuplets.

Do not open release or SesliTab gates as part of feature development.

## Still fail-closed / gated

- automatic straight-note → triplet retiming/onset reflow; APP-11F is metadata-only on already-proven canonical 3:2 timing;
- removal of existing tuplet metadata when timing restoration/onset mutation would be required;
- arbitrary imported trailing MusicXML duration growth without pickup/non-controlling evidence;
- independent retiming of beam/tuplet/tie-coupled events;
- arbitrary rest redistribution beyond the admitted APP-11B adjacent residual-rest contract;
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
