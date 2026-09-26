# ST Score Editor Core — Architecture

Status: **SSE-00–10, APP-00–10O, APP-11A–I, P09-A/B/C/D, P10-0/P10-1/P10-2/P10-2B/P10-3A/P10-3B and Stage 07 are merged/qualified for their recorded scope. APP-11J remains read-only admission. P10-2B remains read-only 4:3 admission and does not authorize generalized mutation. The standalone physical device/browser release matrix remains open.**

## Canonical architecture

```text
Browser / product controls
        |
        v
exact SemanticAddressV3 target or explicit semantic range
        |
        +--> read-only admission when a timing transformation is required
        |
        v
bounded canonical authoring primitive
        |
        v
ScoreDocumentV3 + NotationDocumentV4
        |
        v
EditorSessionV4
  one accepted user edit = one unified history revision
        |
        +--> MusicXML exchange/projection
        +--> RendererRequestV4 presentation
        +--> local playback plan
        +--> export / print handoff
```

The canonical pair is always:

```text
ScoreDocumentV3/3.0.0 + NotationDocumentV4/4.0.0
```

`EditorSessionV4` is the sole history authority. `SemanticAddressV3` is exact revision-bound canonical identity.

MusicXML is exchange/projection data. Renderer DOM/SVG identifiers, coordinates, geometry, viewport state, file handles, recovery state, palette state, semantic-range capture state, playback state, export/print state and release-hardening state are noncanonical.

No browser, renderer, playback or persistence layer may dual-write canonical score state.

## Product substrate — APP-00–09B

APP-00–08 provide standalone document lifecycle, unified V4 history, browser shell, bounded local `.musicxml/.xml` workflow, browser-local recovery, guarded renderer interaction, revision-bound local playback and noncanonical export/print.

APP-09/09B add responsive/accessibility/recovery hardening and host-controlled exact-current-revision renderer rerender. The renderer remains a presentation consumer. The P08/P09 professional/keyboard/renderer physical iPhone Safari device gate is PASS on the P09-qualified baseline; the wider APP-09 G1–G10 multi-platform release matrix remains open.

## P09 — Fast Entry / Keyboard Workstation

P09-A/B/C/D is merged and qualified through PR #191, merge commit `9dfa253a55982a66b01b5eaa2f8df614b1e58e9b`. The exact qualified P09-D head is `636c17dc27b657d273cf2e4f630a2e7c11ffa8f6`.

P09 adds versioned keyboard intents, a focus-safe browser adapter, semantic measure navigation and delegation to the existing note-entry/keypad/session authorities. It does not create a hidden canonical cursor, second note-entry engine, second rhythm engine or second history authority. Touch authoring remains independent.

Physical iPhone/Safari evidence on the qualified head covers renderer startup, rendered-note hit-test to semantic selection, an accepted edit, exact one-step Undo/Redo, orientation changes, Safari background/foreground lifecycle and continued touch selection. This is scoped P08/P09 device evidence and is not a full APP-09 release authorization.

## Standalone authoring — APP-10A–O

APP-10 establishes the bounded standalone authoring workspace:

- Guitar and Piano new-score presets;
- Voice 1–5 semantic targeting and bounded synthetic Voice materialization;
- exact note entry and selected-note pitch/duration/delete;
- presentation-only semantic Staff and measure navigation;
- bounded synthetic end-of-score measure growth;
- exact chord-tone add/remove;
- bounded articulation and local-ornament groups;
- exact explicit Flat/Natural/Sharp authoring.

All accepted score/notation mutations pass through unified V4 history. Staff/measure navigation and palette state create no history. Renderer geometry never chooses an authoring target.

## APP-11 rhythm, semantic range and relation architecture

### APP-11A — Rhythm Timing Admission

`editor-rhythm-timing-v4` is read-only evidence. It validates exact event-duration proposals, classifies shrink/grow/no-op, checks existing occupancy, exact next-event boundaries, synthetic measure bounds and timing coupling. Imported trailing growth without proven measure semantics fails closed.

### APP-11B — Shared Rhythm Mutation Authority

Timing-changing Basic duration and keypad Duration/Rest/Dot paths converge on a single V4 rhythm-authoring authority.

```text
exact event + requested timing change
        -> APP-11A admission
        -> explicit rest-balance plan
        -> atomic score + notation mutation
        -> post-mutation occupancy validation
        -> EditorSessionV4 commit
```

Contraction creates or extends explicit residual rest space. Growth consumes only exact adjacent admitted neutral rest. No Voice/measure invention, renderer timing inference or unchecked imported trailing growth is allowed.

### APP-11C — Semantic Selection V4

Explicit multi-target authoring uses revision-bound semantic selection rather than visual inference:

- `SINGLE`
- `NOTE_PAIR`
- contiguous same-measure `EVENT_RANGE`

Selection is immutable, noncanonical and history-free. Duplicate, stale, reversed, mixed-scope and non-contiguous targets fail closed.

### APP-11D / APP-11E — Tie and Slur

Tie and Slur browser surfaces capture exact note-pair semantics and delegate to existing V4 relation primitives. Capture creates no history. Apply creates one unified history revision. Renderer position never determines endpoints.

### APP-11F — Metadata-only Triplet

APP-11F captures exactly three contiguous semantic events and applies Triplet metadata only when canonical timing is already exact 3:2 timing.

It deliberately has **no onset/duration retiming authority**.

### APP-11G — Triplet Retiming Admission

APP-11G is analysis-only and accepts exactly three explicit current-revision, consecutive, contiguous events in one exact measure/Voice with equal supported simple written-base duration.

For three straight eighths:

```text
input
onsets:    0, 1/8, 1/4
durations: 1/8, 1/8, 1/8

admitted 3:2 plan
onsets:    0, 1/12, 1/6
durations: 1/12, 1/12, 1/12
```

It reports the released timing interval but mutates nothing.

Fail-closed first-version coupling includes dots, beams, existing tuplets, ties and selected cross-staff events. Unsupported written bases, stale ranges and invalid existing timing also fail closed. Slur endpoints do not block because exact note identity is preserved.

### APP-11H — Atomic Triplet Retiming Authoring

APP-11H consumes APP-11G admission and atomically:

1. rewrites the three admitted event onsets and durations;
2. preserves event/note identities and Voice order;
3. adds Triplet start/middle/stop notation in the same revision candidate;
4. balances the released interval by extending an immediately adjacent neutral rest backward or creating deterministic `tuplet-rest:<hex>` residual rest;
5. leaves notation-coupled or cross-staff adjacent rests untouched;
6. validates final occupancy before returning.

Imported MusicXML contraction is allowed within these bounded local rules because no topology or trailing growth is invented.

APP-11H itself does not own history; its result must be committed by the session layer.

### APP-11I — Session + Browser Productization

APP-11I connects APP-11H to the product stack:

```text
Triplet capture state
        -> APP-11G admission state
        -> Triplet Retiming control
        -> APP-11H atomic mutation
        -> commitEditorHistoryV4
        -> one EditorSessionV4 revision
        -> rebound exact first-event selection
```

The browser deliberately keeps two distinct Triplet paths:

- **Triplet Apply** — APP-11F metadata-only path for already-canonical 3:2 timing.
- **Triplet Retiming** — APP-11G/H path for explicitly captured supported straight timing.

This separation prevents the metadata primitive from silently gaining timing authority.

APP-11I also handles nested browser rerenders without changing semantic capture authority: the outer retiming control is restored as presentation state when APP-11F recreates its group. This UI lifecycle behavior is noncanonical.

Successful retiming creates exactly one history revision. Exact Undo restores the prior canonical score+notation pair.

## APP-11J mainline reality

The read-only Triplet Removal / Unretiming admission foundation is already present on current main. Foundation commit `674187b920434d6d7d72330baba44c2692a64596` is an ancestor of the P10 baseline main commit `9dfa253a55982a66b01b5eaa2f8df614b1e58e9b`, and `editor-tuplet-unretiming-admission-v4` plus its regression tests are in the repository.

APP-11J remains analysis-only: canonical unretiming mutation authority is false, history authority is false and renderer-coordinate authority is false. Historical PR #142 remaining open is stale stacked PR metadata and must not be interpreted as evidence that the analyzer is absent from main.

P10-2 consumes that read-only evidence without changing APP-11J's authority. The separate `editor-tuplet-unretiming-authoring-v4` package owns the bounded inverse mutation, `editor-session-tuplet-unretiming-v4` routes it through the unified history, and the browser exposure is an optional professional-workstation decorator rather than a default-app cutover.

## P10-2 bounded Triplet removal / unretiming

For one fresh APP-11J-admitted three-event 3:2 Triplet:

- proposed event onsets/durations are copied from fresh admission evidence;
- event/note identities and part/staff/frame/measure/Voice topology are preserved;
- owned Triplet notation is removed atomically with timing;
- `REMOVE_ADJACENT_REST` deletes exactly the admitted neutral rest;
- `SHRINK_ADJACENT_REST_FORWARD` preserves the rest id and applies only the admitted onset/duration;
- one accepted action creates one `EditorSessionV4` history revision;
- Undo restores the exact Triplet pair and Redo restores the exact straight pair;
- browser capture is explicit current-revision semantic evidence;
- renderer/DOM coordinates remain non-authoritative;
- the P10-2 workstation is optional and preserves the qualified P10-1/default artifact boundaries.

## P10-2B — Read-only generalized 4:3 tuplet admission

P10-2B adds a separate `editor-generalized-tuplet-admission-v4` analyzer rather than widening APP-11J or the P10-2 mutation package.

The admitted profile is intentionally narrow:

- exactly four explicit current-revision event targets;
- one part/staff/frame/measure/Voice and exact consecutive order;
- equal contiguous current durations;
- exact `4:3` tuplet metadata with start / middle / middle / stop boundaries;
- exact rational restoration to a supported straight written base;
- adjacent neutral-rest capacity proved without topology invention;
- dots, beams, ties, selected cross-staff targets, malformed/nested tuplets, unsupported written bases and arithmetic overflow fail closed;
- slurs do not block because event/note identity is preserved.

The analyzer is **read-only**. Canonical mutation authority is false, history mutation authority is false and renderer-coordinate authority is false. Imported MusicXML 4:3 material is admitted only when the canonical V3/V4 pair already satisfies the exact profile; regression evidence preserves imported event/note identities.

**Generalized tuplet mutation is not authorized.** P10-2 remains the only bounded inverse mutation surface and remains limited to its existing 3:2 profile. P10-2B itself is merged and qualified as read-only analysis. The later PR #202 exact head `534ba3526d0d12976b24c4c853c073aa9d74c1b6` established the current mainline Sonar Quality Gate PASS with zero new issues, zero security hotspots and 0.0% PR duplication.

## P10-3B — Professional range replacement architecture

P10-3B preserves the canonical authority chain:

```text
current-revision Professional EVENT_SPAN
        -> TeacherCopySnapshotV4 source snapshot
        -> ProfessionalRangeReplaceAdmissionV1
        -> deterministic fresh replacement identity plan
        -> atomic ScoreDocumentV3 + NotationDocumentV4 candidate
        -> EditorHistoryV4 one accepted Replace / one history revision
        -> fresh replacement EVENT_SPAN presentation selection
```

Only contiguous `EVENT_SPAN` replacement is admitted. Source and destination are one exact measure and one part/staff/Voice scope, are disjoint, and must have exactly equal rational time extent. Event count may differ. No stretch/compress, later-event shift, structural time deletion, cross-measure replacement or topology invention is authorized.

Replace is not Teacher Paste; Teacher Paste semantics are unchanged. Delete remains Clear-to-REST. Replacement events and notes use fresh deterministic destination identities, while the source remains unchanged and removed destination identities are not reused.

Local accidental/dot/articulation/simple-ornament/single-note-tremolo metadata can be cloned to fresh identities. Beam, tuplet, tie, slur, grace-group, cross-staff, spanning tremolo and wavy-line coupling fails closed; relation remapping is outside this tranche. Renderer DOM/SVG geometry and coordinates remain non-authoritative.

The browser layer is an optional P10-3B composition over P10-3A. Clipboard state is noncanonical (`EMPTY | CURRENT | STALE`), exact-revision-bound and never stored in history. PR #198 merged P10-3B at `26c7b803659d6064cfd7890fbd13d256f553235d`; PR #202 subsequently qualified the retained P10-3B gate together with Sonar and the retained professional WebKit chain. Automated mobile WebKit validates this composition but does not constitute physical-device release evidence.

## Triplet retiming invariants

For the admitted APP-11G/H/I profile:

- exactly three explicit event targets;
- current revision only;
- one exact measure/Voice;
- consecutive and contiguous current events;
- equal supported simple written-base duration;
- event/note IDs preserved;
- no unrelated event is moved implicitly;
- all changed onset/end values use exact rational arithmetic;
- released time is represented explicitly by admitted rest balancing;
- Triplet metadata and timing change belong to one atomic score+notation result;
- one accepted browser user action creates one history revision;
- Undo restores exact prior pair;
- renderer geometry contributes no timing or range evidence.

## Still fail-closed

The following remain outside current production authority:

- generalized tuplet mutation and arbitrary ratios/cardinalities beyond the existing bounded 3:2 mutation path and read-only 4:3 admission;
- automatic range inference from renderer layout;
- independent retiming of dots/beams/existing tuplets/ties outside admitted atomic programs;
- selected cross-staff Triplet retiming;
- arbitrary imported trailing growth without pickup/non-controlling evidence;
- automatic imported Voice/measure invention;
- arbitrary rest redistribution outside admitted local contracts;
- `.mxl` container support;
- direct PDF-byte generation;
- V4-native cross-staff MusicXML round trip;
- polymeter/non-controlling topology;
- cloud/server revision authority;
- public-write/production activation.

## P10-0 — Architecture Reality Refresh

P10-0 is complete. It aligned architecture, roadmap, productization and release-gate sources with the post-P09 mainline reality without changing runtime or release authority. This historical checkpoint remains part of the repository contract.

## Next architecture step

**P10-4A — Score Structure & Instrument Management inventory/design.**

P10-3B is merged and the mainline retained quality chain is green on PR #202. The next architecture gate is read-only inventory and a written deterministic topology contract for staff/part add-remove-reorder and instrument assignment before any structural mutation is implemented. Generalized 4:3 tuplet mutation, beams/grace timing programs, physical release validation and wider P10-3 range operations remain separate explicitly scoped workstreams.

## Automated validation contract

Before feature merge, exact-head validation includes:

- Node 18 / 20 / 22 repository contract + build/test;
- retained APP-10/11 mobile WebKit authoring regressions;
- dedicated APP-11I straight-note Triplet retiming -> Undo regression;
- dedicated P10-2 straight -> Triplet -> Remove Triplet -> Undo/Redo + remount duplicate-listener WebKit regression;
- retained P10-3A professional pitch-transpose WebKit regression;
- retained P10-3B professional range-replace WebKit regression;
- exact ST Score Rendering Layer checkout/build;
- APP-09B renderer regression;
- APP-09B controlled-layout rerender regression.

Automated WebKit remains regression evidence only and cannot itself constitute a physical-device PASS. The separate P08/P09 physical iPhone/Safari PASS was established by human device evidence on the qualified P09 baseline.

## Release state

```text
manualDeviceValidationRequired = true
standaloneReleaseGatePassed = false
```

The P08/P09 iPhone Safari device gate is PASS for its tested scope, but the full APP-09 G1–G10 release matrix is incomplete. Android Chrome, Windows Edge, Windows Chrome and Windows Firefox remain pending physical release targets, with iPad Safari secondary.