# ST Score Editor Core — Architecture

Status: **SSE-00–10, APP-00–10O, APP-11A–I and Stage 07 are COMPLETE / MERGED. The standalone physical device/browser release matrix remains open and is required before release.**

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

APP-09/09B add responsive/accessibility/recovery hardening and host-controlled exact-current-revision renderer rerender. The renderer remains a presentation consumer; physical iPhone evidence is partial and does not close the full release gate.

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

- Triplet removal/unretiming;
- arbitrary tuplet ratios/cardinalities beyond the bounded 3:2 profile;
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

## Next architecture step

**APP-11J — Triplet Removal / Unretiming Admission Foundation.**

This must begin read-only. Before any removal mutation is exposed, it must prove deterministic straight timing, exact affected boundaries and local rest-space requirements while preserving identities and rejecting overlap, semantic loss, unsupported coupling, imported-measure ambiguity and topology invention.

## Automated validation contract

Before feature merge, exact-head validation includes:

- Node 18 / 20 / 22 repository contract + build/test;
- retained APP-10/11 mobile WebKit authoring regressions;
- dedicated APP-11I straight-note Triplet retiming -> Undo regression;
- exact ST Score Rendering Layer checkout/build;
- APP-09B renderer regression;
- APP-09B controlled-layout rerender regression.

Automated WebKit is regression evidence only and does not constitute a physical-device PASS.

## Release state

```text
manualDeviceValidationRequired = true
standaloneReleaseGatePassed = false
```

Required physical targets remain real iPhone Safari, Android Chrome, Windows Edge, Windows Chrome and Windows Firefox, with iPad Safari secondary.
