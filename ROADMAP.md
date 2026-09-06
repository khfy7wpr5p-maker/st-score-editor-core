# Roadmap

## Current source of truth

Repository reality only. Planned capability is not production capability.

## Completed baseline

- **E0–E7-H — COMPLETE**
- **E8-A/B/C — IMPLEMENTED**
- **E8-D — HUMAN-GATED / NOT AUTHORIZED**
- **SEC-KP-00–10 — COMPLETE**
- **SEC-NE-00–09 + XML ROUNDTRIP — COMPLETE / MERGED** within documented bounded profiles.
- **SSE-00–10 — COMPLETE / MERGED** including bounded V3 topology and V4 cross-staff runtime.
- **Stage 07 semantic -> renderer presentation locators — COMPLETE / MERGED.**

## ST Score Editor App productization

### APP-00–10O

**COMPLETE / MERGED.**

Standalone document/runtime, `EditorSessionV4` history, browser shell, local MusicXML files/recovery, guarded renderer interaction, playback, export/print, Guitar/Piano starts, Voice 1–5, semantic Staff and measure navigation, note/chord authoring, articulation/ornament groups and exact explicit accidentals are merged.

### APP-11A — Rhythm Timing Admission

**COMPLETE / MERGED — PR #129.**

Read-only exact-event timing analysis for contraction/growth/no-op, next-event occupancy, synthetic measure bounds, existing invalid timing and dots/beams/tuplets/ties coupling. Imported trailing growth without proven measure evidence fails closed.

### APP-11B — Safe Duration + Explicit Rest Balancing

**COMPLETE / MERGED — PR #131.**

Basic duration and keypad Duration/Rest/Dot timing changes converge on shared V4 rhythm authority. Contraction creates or extends explicit residual rest; growth consumes only exact adjacent admitted neutral rest. One accepted edit creates one `EditorSessionV4` history revision.

### APP-11C — Semantic Selection V4

**COMPLETE / MERGED — PR #133.**

Revision-bound `SINGLE`, `NOTE_PAIR` and contiguous same-measure `EVENT_RANGE`. Selection remains noncanonical/history-free. Duplicate, stale, reversed, mixed-scope and non-contiguous targets fail closed.

### APP-11D — Tie

**COMPLETE / MERGED — PR #134.**

Explicit semantic note-pair capture exposes bounded Tie authoring through the existing V4 relation primitive. Capture is history-free; Apply creates one history revision.

### APP-11E — Slur

**COMPLETE / MERGED — PR #135.**

Explicit semantic note-pair capture exposes bounded Slur authoring through the existing V4 primitive. Tie remains unchanged beneath this layer.

### APP-11F — Metadata-only Triplet

**COMPLETE / MERGED — PR #136.**

Three explicit contiguous events may receive 3:2 Triplet metadata only when their canonical timing is already exact Triplet timing. APP-11F never retimes onsets or durations.

### APP-11G — Triplet Retiming Admission Foundation

**COMPLETE / MERGED — PR #138 / merge `91d6e162392149399daae476efe13936a1686ddf`.**

Analysis-only admission for exactly three current-revision, consecutive, contiguous events with equal supported simple written-base duration.

Example:

```text
straight eighths
onsets:    0, 1/8, 1/4
durations: 1/8, 1/8, 1/8

candidate 3:2 timing
onsets:    0, 1/12, 1/6
durations: 1/12, 1/12, 1/12
```

APP-11G exposes the released interval for later explicit-rest balancing. Dots, beams, existing tuplets, ties, selected cross-staff events, unsupported written bases, stale ranges and invalid timing fail closed. Imported MusicXML contraction is admissible because no trailing growth/topology invention is required.

### APP-11H — Atomic Triplet Retiming Authoring

**COMPLETE / MERGED — PR #139 / merge `bd210bac620489a108c42dd565e85084b64294fd`.**

Consumes APP-11G evidence and atomically:

- rewrites the three admitted event onsets/durations;
- preserves event/note identities and Voice ordering;
- adds Triplet start/middle/stop notation in the same next revision;
- extends an immediately adjacent neutral rest backward or creates deterministic `tuplet-rest:<hex>` residual rest space;
- leaves notation-coupled/cross-staff adjacent rests untouched;
- validates final occupancy before returning.

The package does not independently own history; session integration remains the history authority.

### APP-11I — Session + Browser Triplet Retiming

**COMPLETE / MERGED — PR #140 / merge `6b0e2cac572dfcfa570bfab2bb8eb47a9d7f68fc`.**

APP-11H is productized through `EditorSessionV4` and the standalone browser runtime.

Two Triplet paths deliberately coexist:

1. **Triplet Apply** — APP-11F metadata-only path for events already in exact canonical 3:2 timing.
2. **Triplet Retiming** — APP-11G/H path for three explicitly captured supported straight events.

A successful retiming user action creates exactly one unified history revision. Exact Undo restores the pre-retiming `ScoreDocumentV3 + NotationDocumentV4` snapshot. Event/note identities remain stable and explicit-rest occupancy remains exact.

Dedicated mobile WebKit proves straight eighths -> canonical `1/12 + 1/12 + 1/12` Triplet -> exact Undo. The same exact head also passed retained APP-10E–O, APP-11B/D/E/F, exact renderer build, APP-09B renderer and controlled-layout regressions.

## Current architecture phase

```text
exact semantic target/range
        -> read-only admission when timing may change
        -> bounded canonical mutation
        -> exact explicit-rest balance where required
        -> EditorSessionV4 one user action / one history revision
        -> MusicXML projection
        -> renderer presentation
```

`ScoreDocumentV3 + NotationDocumentV4` remains canonical. Staff/measure navigation, multi-target capture, palette state, file/recovery state, renderer/viewport state, playback and export/print state remain noncanonical. Renderer coordinates never become authoring authority.

## Next development action

**APP-11J — Triplet Removal / Unretiming Admission Foundation.**

Start read-only. Before any removal mutation is exposed, APP-11J must prove when an exact canonical 3:2 Triplet can safely return to a supported straight written rhythm while preserving event identities and avoiding overlap, hidden-gap invention, unsupported rest redistribution, topology invention or imported-measure ambiguity.

Minimum first-step boundaries:

- exactly three explicit current-revision events in one exact measure/Voice;
- existing consistent 3:2 Triplet metadata/timing must be proven;
- target straight written base must be deterministic and supported;
- all resulting onset/end boundaries must be calculated exactly;
- required rest consumption/release must be explicit and locally bounded;
- dots, beams, ties, cross-staff timing dependencies and unsupported relation semantics fail closed until separately admitted;
- no unrelated following event may move implicitly;
- analysis creates no history/mutation;
- renderer geometry and MusicXML layout remain non-authoritative.

Mutation/removal may be a later bounded stage only after this admission contract is proven.

## Still fail-closed / gated

- Triplet removal/unretiming until APP-11J or later explicitly admits it;
- arbitrary tuplet ratios/cardinalities outside the bounded 3:2 profile;
- automatic renderer-derived Triplet range inference;
- arbitrary imported trailing MusicXML growth without pickup/non-controlling evidence;
- independent retiming of dot/beam/tuplet/tie-coupled events outside admitted atomic programs;
- selected cross-staff Triplet retiming;
- arbitrary rest redistribution beyond admitted local contracts;
- spanning tremolo/wavy-line and broader grace workflows until separately admitted;
- imported automatic Voice/measure invention;
- `.mxl` container support;
- direct PDF bytes;
- V4-native cross-staff MusicXML round trip;
- polymeter/non-controlling topology;
- part groups/brackets/braces;
- arbitrary instrument transposition/percussion maps;
- renderer-coordinate authoring, DOM/SVG authority and host dual-write;
- cloud collaboration/server revision authority;
- public-write/production activation.

## Release state

The release manifest deliberately remains:

```text
manualDeviceValidationRequired = true
standaloneReleaseGatePassed = false
seslitabCutoverAuthorized = false
```

Required physical release targets remain real iPhone Safari, Android Chrome, Windows Edge, Windows Chrome and Windows Firefox. iPad Safari remains secondary. Automated WebKit regression is not physical-device evidence.

SesliTab is outside this core-development track and is not an architectural dependency.
