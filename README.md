# ST Score Editor Core

Security-first, renderer-independent semantic score-editing core for the standalone ST Score Editor App.

## Current reality

- **SSE-00–10 — COMPLETE / MERGED:** canonical V3/V4 score+notation, bounded MusicXML, topology and cross-staff runtime.
- **APP-00–10O — COMPLETE / MERGED:** standalone document/runtime, unified V4 history, browser shell, local files/recovery, guarded renderer interaction, playback, export/print, Guitar/Piano starts, Voice 1–5, semantic Staff/measure navigation, note/chord authoring, articulations, ornaments and explicit accidentals.
- **APP-11A–I — COMPLETE / MERGED:** safe duration/rest balancing, semantic multi-target selection, Tie, Slur, bounded Triplet metadata authoring, straight-three Triplet retiming admission, atomic retiming mutation and final session/browser product surface are merged.
- **P09-A/B/C/D — COMPLETE / MERGED / QUALIFIED:** PR #191 merged at `9dfa253a55982a66b01b5eaa2f8df614b1e58e9b`; exact qualified P09-D head `636c17dc27b657d273cf2e4f630a2e7c11ffa8f6`.
- **APP-11J / P10-2 / P10-2B — MERGED / QUALIFIED FOR RECORDED SCOPE:** APP-11J remains read-only 3:2 admission; P10-2 owns the bounded 3:2 Triplet removal/unretiming mutation; P10-2B adds merged read-only generalized 4:3 admission. Generalized 4:3 mutation remains unauthorized.
- **P10-3A/B — MERGED / QUALIFIED OPTIONAL WORKSTATION CAPABILITIES:** key-aware professional range transpose and bounded same-measure `EVENT_SPAN` Copy → Replace are merged. PR #202 exact head `534ba3526d0d12976b24c4c853c073aa9d74c1b6` passed Sonar Quality Gate, Node 18/20/22 and retained P10-3B/P10-3A/P10-2/P10-1/P08-E4/APP-09B WebKit gates.
- **Stage 07 — COMPLETE / MERGED:** exact current-revision semantic-to-render presentation locators are read-only.
- **Standalone release gate — OPEN:** iPhone Safari P08/P09 device gate PASS is recorded for the tested professional/keyboard/renderer scope, but the full APP-09 G1–G10 multi-platform release matrix is still incomplete.
- **SesliTab product cutover — NOT AUTHORIZED:** SesliTab is not an architectural dependency of ST Score Editor and is outside the current development scope.

## P10-2 — Bounded Triplet Removal / Unretiming

P10-2 adds a separate inverse path for exactly the APP-11J-admitted 3:2 profile. Three explicit current-revision Triplet events are restored to their supported straight written timing while preserving event/note identities. The exact adjacent neutral rest is either removed when fully consumed or shifted forward and shortened when larger than the required growth.

The mutation is atomic across `ScoreDocumentV3 + NotationDocumentV4`, and one accepted **Remove Triplet** action creates exactly one `EditorSessionV4` history revision. Undo restores the exact Triplet pair; Redo restores the exact straight pair. The browser surface is an optional P10-2 professional-workstation decorator and does not alter the retained default `STScoreEditorApp` budget or authorize production/SesliTab cutover.

Arbitrary tuplet ratios/cardinalities, renderer-derived range inference, selected cross-staff timing rewrite, and dot/beam/tie-aware unretiming remain outside this bounded authority.

## Canonical authority

One current editor session owns exactly one canonical pair:

```text
ScoreDocumentV3 + NotationDocumentV4
            |
            v
      EditorSessionV4
```

`EditorSessionV4` is the sole history authority. `SemanticAddressV3` is exact revision-bound canonical identity. Renderer DOM/SVG identifiers, coordinates, geometry, viewport state, browser controls, file handles, recovery state, playback state and export/print state are noncanonical.

MusicXML is exchange/projection data, not the canonical editing model.

## APP-11 strong-editor rhythm and relation program

### APP-11A — Rhythm Timing Admission

Read-only timing analysis for exact current-revision events. It classifies contraction/growth/no-op, next-event occupancy, synthetic measure bounds and timing coupling. Imported trailing growth without proven measure semantics fails closed.

### APP-11B — Safe Duration + Rest Balancing

Duration/Rest/Dot timing-changing paths converge on a shared V4 rhythm mutation authority. Contraction materializes or extends explicit rest space; admitted growth consumes only exact adjacent neutral rest space. One accepted user edit creates one history revision.

### APP-11C — Semantic Selection V4

Exact `SINGLE`, `NOTE_PAIR` and contiguous `EVENT_RANGE` semantic selections are revision-bound and history-free. They adapt into existing advanced notation primitives without renderer inference.

### APP-11D / APP-11E — Tie and Slur

Explicit semantic note-pair capture exposes bounded Tie and Slur authoring through existing V4 relation primitives. Renderer geometry never chooses endpoints.

### APP-11F — Metadata-only Triplet

Three explicitly captured events that are **already in exact canonical 3:2 timing** may receive Triplet start/middle/stop metadata. APP-11F does not retime canonical events.

### APP-11G — Triplet Retiming Admission

Analysis-only admission for exactly three explicit, consecutive, contiguous events with equal supported simple written-base duration. Example:

```text
straight eighths
onsets:    0, 1/8, 1/4
durations: 1/8, 1/8, 1/8

3:2 triplet plan
onsets:    0, 1/12, 1/6
durations: 1/12, 1/12, 1/12
```

The analyzer exposes the released interval for deterministic explicit-rest balancing. Dots, beams, existing tuplets, ties, selected cross-staff events, unsupported written bases, stale ranges and invalid existing timing fail closed.

### APP-11H — Atomic Triplet Retiming Authoring

Consumes APP-11G evidence and atomically:

1. rewrites the three admitted event onsets/durations;
2. preserves event and note identities;
3. adds Triplet start/middle/stop notation in the same revision;
4. balances the released interval by extending an immediately adjacent neutral rest backward or creating a deterministic `tuplet-rest:<hex>` residual rest;
5. validates final occupancy before returning the result.

Imported MusicXML contraction is admitted within these bounded rules; no Voice or measure topology is invented.

### APP-11I — Session + Browser Triplet Retiming

APP-11H is productized through `EditorSessionV4` and the standalone browser stack.

The browser now deliberately has **two separate Triplet paths**:

- **Triplet Apply:** APP-11F metadata-only path for events already in canonical 3:2 timing.
- **Triplet Retiming:** APP-11G/11H path for three explicitly captured supported straight events.

A successful retiming operation creates exactly one `EditorSessionV4` history revision. Exact Undo restores the pre-retiming `ScoreDocumentV3 + NotationDocumentV4` snapshot.

Dedicated mobile WebKit coverage proves straight eighths -> canonical `1/12` triplet -> exact Undo while all retained APP-10/11 authoring and APP-09B renderer/layout regressions remain green.

## Fail-closed boundaries still in force

- imported trailing duration growth without proven pickup/non-controlling measure semantics;
- generalized tuplet mutation and arbitrary ratios/cardinalities beyond the bounded 3:2 mutation path and read-only 4:3 admission;
- automatic Triplet range inference from renderer layout;
- independent retiming of dots, beams, existing tuplets or tie-coupled events;
- selected cross-staff Triplet retiming;
- automatic Voice or measure invention for imported material;
- renderer-coordinate authoring;
- unsupported cross-staff MusicXML projection;
- `.mxl`, direct PDF-byte generation and cloud/server revision authority;
- relation-safe generalized tuplet mutation, broader beam/grace timing programs, and other topology-changing transforms without a separate explicit admission contract.

## Automated quality gate

Feature PRs require exact-head validation before merge:

- Node 18 / 20 / 22 repository contract + build/test;
- retained mobile WebKit authoring regressions;
- APP-11I straight-note Triplet retiming regression;
- exact ST Score Rendering Layer checkout/build;
- APP-09B renderer regression;
- APP-09B controlled-layout rerender regression.

Automated WebKit is regression evidence only and cannot by itself establish a physical-device PASS. The separate iPhone Safari P08/P09 device gate PASS comes from human physical-device evidence.

## Release state

```text
manualDeviceValidationRequired = true
standaloneReleaseGatePassed = false
seslitabCutoverAuthorized = false
```

The iPhone Safari P08/P09 device gate PASS closes only that scoped professional/keyboard/renderer check. Android Chrome, Windows Edge, Windows Chrome and Windows Firefox remain pending; real iPad Safari remains secondary. The full release matrix remains open.

## Next bounded development action

**P10-4A — Score Structure & Instrument Management inventory/design gate.**

P10-3B is merged and retained quality gates are green on PR #202. The next bounded engineering step is read-only inventory plus written architecture for deterministic staff/part structure and instrument-management authority before any production-code mutation is authorized.

Parallel release work remains separate: full APP-09 G1–G10 physical-device coverage is still open, and generalized 4:3 tuplet mutation remains a separately gated future design.
