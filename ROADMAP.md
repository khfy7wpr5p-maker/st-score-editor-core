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
- **P09-A/B/C/D Fast Entry / Keyboard Workstation — COMPLETE / MERGED / QUALIFIED — PR #191 / merge `9dfa253a55982a66b01b5eaa2f8df614b1e58e9b`; qualified head `636c17dc27b657d273cf2e4f630a2e7c11ffa8f6`.**

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

### APP-11J — Triplet Removal / Unretiming Admission Foundation

**ANALYSIS FOUNDATION PRESENT ON MAIN / CANONICAL MUTATION NOT EXPOSED.**

The read-only admission package and tests are already present on current main. Foundation commit `674187b920434d6d7d72330baba44c2692a64596` is an ancestor of the P10 baseline merge `9dfa253a55982a66b01b5eaa2f8df614b1e58e9b`.

APP-11J proves bounded exact 3:2 Triplet -> supported straight-three timing and adjacent neutral-rest requirements without mutating score/notation or owning history/renderer authority. Historical PR #142 remains open as stacked metadata; that PR state is not the source of truth for code presence.

### P10-2 — Bounded Triplet Removal / Unretiming Productization

**BOUNDED IMPLEMENTATION PRESENT / OPTIONAL WORKSTATION / RELEASE GATES UNCHANGED.**

P10-2 consumes fresh APP-11J evidence in a separate atomic mutation rather than adding mutation authority to APP-11J. The selected three event identities are preserved, Triplet-owned metadata is removed, and the exact admitted adjacent-rest action is applied: remove the rest when exactly consumed, or preserve its identity while shifting/shrinking it forward when larger.

The mutation is routed through `EditorSessionV4`: one accepted Remove Triplet action creates one history revision; Undo restores the exact Triplet pair and Redo restores the exact straight pair. The browser command is composed only into an optional P10-2 professional workstation, preserving the qualified default standalone bundle and P10-1 artifact boundaries.

Dedicated mobile WebKit covers straight -> Triplet -> Remove Triplet -> exact Undo/Redo, remount/re-capture and one-click/one-history behavior. This automated evidence is not a physical-device release PASS.

### P10-2B — Generalized Tuplet Admission Foundation

**READ-ONLY 4:3 ADMISSION IMPLEMENTED / QUALIFICATION PENDING / GENERALIZED MUTATION NOT AUTHORIZED.**

P10-2B introduces a separate read-only analyzer for exactly four current-revision events carrying one exact 4:3 tuplet range. It preserves canonical event/note identity, uses exact rational timing, proves adjacent neutral-rest capacity, and fails closed for unsupported timing/notation coupling.

The implementation does not mutate `ScoreDocumentV3 + NotationDocumentV4`, does not own `EditorSessionV4` history, does not use renderer geometry as timing authority and does not widen APP-11J/P10-2 mutation semantics. Imported MusicXML 4:3 identity is covered by regression evidence.

**Generalized tuplet mutation is not authorized.** Broader ratios/cardinalities, generalized browser authoring and release/public-write/SesliTab cutover remain separate future decisions. Sonar live issue-detail triage remains pending; no Quality Gate PASS is claimed.

### P10-3A — Professional key-aware pitch transpose

**IMPLEMENTED ON OPTIONAL WORKSTATION COMPOSITION / EXACT-HEAD QUALIFICATION PENDING / RELEASE GATES UNCHANGED.**

P10-3A extends the P08 semantic professional range model with deterministic key-aware pitch editing:

- semitone transpose: `±1..±12`;
- diatonic transpose: `±1..±7`;
- `EVENT_SPAN` and discontiguous `EVENT_SET`;
- NOTE and all CHORD tones; selected REST events remain unchanged;
- staff-local effective key-signature inheritance;
- atomic canonical pitch + accidental-display metadata;
- one accepted action = one `EditorHistoryV4` revision with exact Undo/Redo;
- tie relation closure: fail-closed;
- grace relation closure: fail-closed;
- renderer-coordinate authority: false;
- DOM authoring authority: false.

A bundle-budget ruling keeps the qualified P10-1 and P10-2 artifacts unchanged. P10-3A ships as a separate optional composition and artifact rather than widening those qualified bundles. The four visible range actions are `−½`, `+½`, `−Step` and `+Step`.

Dedicated mobile WebKit proves key-aware semitone/diatonic behavior, accidental metadata, semantic-range enablement, 44px touch targets and exact Undo on the optional P10-3A artifact. This automated evidence is not a physical-device release PASS.

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

## P10-0 — Architecture Reality Refresh

P10-0 is complete. It aligned architecture, roadmap, productization and release-gate sources with the post-P09 mainline reality without changing runtime or release authority. This historical checkpoint remains part of the repository contract.

## Next development action

**P10-3A closeout — exact-head qualification, Sonar required check and whole-branch review.**

P10-3A keeps the qualified P10-1/P10-2 artifacts unchanged while adding a separate optional key-aware pitch-transpose composition. Before merge, record fresh exact-head Node 18/20/22, all retained WebKit gates, the dedicated P10-3A WebKit gate, required SonarCloud Code Analysis and final review. Physical iPhone/Safari validation remains separate before any release/cutover claim.

After this bounded tranche, broader Advanced Rhythm & Relations work remains separately scoped; generalized tuplet mutation, arbitrary ratios/cardinalities, beam authoring and other relation semantics are not implied by this implementation.

## Still fail-closed / gated

- P10-2 physical iPhone/Safari validation before any release/cutover claim;
- generalized tuplet mutation and arbitrary ratios/cardinalities beyond the bounded 3:2 mutation path and read-only 4:3 admission;
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
```

The P08/P09 professional/keyboard/renderer physical iPhone Safari device gate is PASS on the P09-qualified baseline, but full APP-09 G1–G10 release evidence remains incomplete. Android Chrome and Windows Edge/Chrome/Firefox remain pending physical release targets; iPad Safari remains secondary. Automated WebKit regression alone is not physical-device evidence.
