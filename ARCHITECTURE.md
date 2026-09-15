# ST Score Editor Core — Architecture

Status date: **2026-09-15**  
Current source-of-truth main: **`0adabbdc426f8481196ee41cce5c9b2bbff2768e`**  
Current professional browser milestone: **P08-E4 COMPLETE / MERGED via PR #187**.

## Product purpose

ST Score Editor Core is an independent, renderer-agnostic semantic notation-editing platform intended to grow into a professional score editor that can be used standalone, embedded into another product through a public SDK, or licensed as a reusable component.

The long-term product direction is a high-quality desktop/mobile notation workstation in the Sibelius-class problem space: fast note entry, reliable semantic editing, exact Undo/Redo, score-structure authoring, professional range operations, MusicXML interchange, renderer independence, optional audio audition, and safe host integration.

The editor is **not architecturally dependent on SesliTab**. SesliTab integration/cutover is a separate product decision and must not be inferred from Editor Core readiness.

## Canonical authority

```text
pointer / touch / keyboard / host intent
        |
        v
semantic selection or explicit authoring intent
        |
        +--> read-only admission when transformation safety must be proven
        |
        v
bounded canonical mutation primitive
        |
        v
ScoreDocumentV3 + NotationDocumentV4
        |
        v
EditorSessionV4 / EditorHistoryV4
        |
        +--> MusicXML exchange / projection
        +--> RendererRequestV4 presentation
        +--> optional audio audition request
        +--> export / print / host projection
```

The canonical pair remains:

```text
ScoreDocumentV3/3.0.0 + NotationDocumentV4/4.0.0
```

`EditorSessionV4` / `EditorHistoryV4` is the sole canonical history authority. `SemanticAddressV3` is exact revision-bound canonical identity.

MusicXML, renderer DOM/SVG, screen coordinates, hit geometry, viewport state, browser controls, transient range capture, file handles, recovery UI, audio state, export/print state and rollout state are noncanonical.

No renderer, browser shell, audio engine, SDK host or persistence layer may dual-write canonical score state.

## Merged capability layers

### 1. Canonical semantic editor core

The repository contains the established SSE / APP semantic model stack, including bounded score/notation structure, MusicXML exchange, semantic addressing, unified history, Voice-aware authoring, note/chord editing, articulation/ornament/accidental authoring, relation authoring and bounded rhythm transformation.

The APP-11 rhythm/relation program keeps transformation authority explicit: potentially destructive timing changes use analysis/admission first, exact rational timing, bounded rest balancing and one accepted user action = one history revision.

### 2. Renderer boundary

Renderer output is presentation evidence only.

```text
renderer hit / opaque render evidence
        -> current-revision semantic resolver
        -> SemanticAddressV3
        -> editor action
```

The renderer never owns canonical pitch, duration, relation endpoints, range endpoints, score structure, history or audio state. APP-09B and retained WebKit regression gates protect this boundary.

### 3. Public SDK / host boundary

The P06 public SDK work established versioned/capability-driven host integration over the existing editor rather than a second editor implementation. Host lifecycle, rollout and audio capability remain capability-local and cannot manufacture canonical authority.

Historical stacked validation PRs from P06 are not active merge surfaces. Current development must start from `main`, not from an old stacked branch.

### 4. Audio boundary

Audio audition is optional and noncanonical.

```text
current SemanticAddressV3 NOTE
        -> exact canonical current-revision pitch
        -> bounded AuditionRequest
        -> external ST Score Audio Engine
```

Audio failure must not block canonical selection/editing. REST/non-note targets remain silent. Stale revision evidence fails closed. Audition creates no editor history.

The **default** Score Editor path has qualified Grand Piano integration from the prior P06/P07 production work. Classical Guitar remains suspended. The open Violin integration PR #176 is not part of current `main` and must not be silently merged or treated as current production capability.

The separate P08-E4 professional artifact intentionally has `audioEngineBundled=false` and `audioHostIntegrated=false`; audio composition for that artifact requires separate design and qualification.

## P08 — Professional notation workstation

P08 adds the professional interaction layer without replacing the existing semantic engines.

### P08-A — Professional semantic selection

- cross-measure `EVENT_SPAN`;
- exact discontiguous `EVENT_SET`;
- revision-bound semantic identity;
- noncanonical/history-free selection state;
- renderer geometry never becomes selection authority.

### P08-B — Professional range transforms

- octave transpose over admitted professional selections;
- exact discontiguous event-set transpose;
- rhythm-preserving Clear/Delete-to-REST;
- selected pitched events become rests without changing event onset/duration;
- accepted operation = one unified history revision.

### P08-C — Score structure authoring

- staff-local key signature;
- staff-local clef;
- propagation-safe frame-global time signature;
- frame-owned barline/repeat authoring;
- no implicit timing reflow or topology invention.

### P08-D — Unified professional workstation controller

P08-D is orchestration, not new mutation authority. It delegates to the proven semantic engines and preserves `EditorHistoryV4` as the only history authority.

### P08-E1–E3 — Browser professional surfaces

- browser bridge over the existing standalone controller;
- responsive professional range toolbar;
- semantic score-structure inspector;
- desktop/mobile presentation while keeping semantic target authority;
- minimum 44 CSS px touch targets;
- stale/incomplete selection fails closed.

### P08-E4 — Independently qualified professional browser artifact

Merged in PR #187 at main commit `0adabbdc426f8481196ee41cce5c9b2bbff2768e`.

```text
packages/score-editor-browser-professional-app-v1/src/global-entry.ts
        -> STScoreEditorProfessionalApp
        -> P08-E2 range toolbar
        -> P08-E3 structure inspector
        -> dist/browser/st-score-editor-professional.js
```

Qualified boundary:

- measured artifact: **599,398 bytes**;
- deterministic ceiling: **615,000 bytes**;
- budget revision: **`P08-E4-QUALIFIED-1`**;
- default `STScoreEditorApp` budget remains unchanged at **542,720 bytes / `P06-AUDIO-V010-1`**;
- Node 18 / 20 / 22 exact-head CI passed;
- dedicated professional WebKit regression passed;
- retained APP-10/11, APP-09B renderer/rerender and P05 paste/render/undo regressions passed.

Automated WebKit is browser evidence only. **Physical iPhone/Safari qualification remains open in Issue #188.**

## Current architecture split

The repository now deliberately has two browser artifacts:

```text
STScoreEditorApp
  = existing default standalone/product surface

STScoreEditorProfessionalApp
  = optional professional range + structure surface
```

The professional artifact is not automatically production-exposed and does not replace the default app. A production exposure decision must occur only after the physical qualification gate and explicit authorization.

## Next autonomous architecture track — P09 Fast Entry / Keyboard Workstation

The next high-leverage editor-quality gap is **fast note entry and keyboard-command workflow**, not another parallel editor engine.

### P09-A — inventory and contract first

Start with a read-only inventory of existing capabilities before adding code. At minimum inspect:

- `editor-keypad-*` contracts and execution paths;
- browser keyboard handlers / focus rules;
- APP-10 note insertion and selected-note editing;
- duration/rest/dot paths that already route through shared rhythm authority;
- semantic Staff/measure/Voice navigation;
- existing Undo/Redo and selection lifecycle;
- mobile vs desktop interaction differences;
- public SDK exposure boundaries.

Deliver a gap matrix: **existing / reusable / missing / must-not-duplicate**.

Do not create a second note-entry engine if existing keypad/basic-authoring primitives already provide the mutation authority.

### P09-B and later — only after inventory proves the gap

A later bounded command layer may be added only if P09-A shows it is needed. The intended direction is:

```text
keyboard / MIDI-like command intent
        -> focus-safe command router
        -> exact semantic current target / insertion cursor
        -> existing canonical authoring primitive
        -> EditorSessionV4 one action / one history revision
```

Required invariants:

- no DOM/SVG/renderer-coordinate authoring authority;
- no hidden second score/cursor state that can diverge from the canonical document;
- text-input fields must not be hijacked by notation shortcuts;
- stale semantic target must fail closed;
- keyboard repeat must not create unintended duplicate mutations;
- every accepted mutation remains exactly Undoable through unified history;
- mobile UI must remain usable even if desktop keyboard commands are added;
- no silent expansion of professional/default bundle byte budgets;
- no production/SesliTab cutover as part of P09.

## Parallel human/device gate

Issue #188 remains the physical iPhone/Safari qualification gate for P08-E4. This may run in parallel with P09-A inventory.

No developer may mark this gate PASS from Playwright/WebKit, screenshots alone, or inferred behavior. Only explicit physical-device evidence is valid.

## Fail-closed / gated boundaries

Current development must continue to fail closed for unsupported or unproven cases, including:

- renderer-coordinate or DOM/SVG authoring;
- stale revision reuse;
- unsupported imported timing/topology invention;
- arbitrary unproven tuplet/rhythm transforms;
- unsupported cross-staff projection semantics;
- `.mxl` container support until separately admitted;
- cloud/server canonical revision authority;
- unqualified audio instruments;
- automatic re-enabling of Classical Guitar;
- silent merge of open historical/experimental PRs;
- production exposure of `STScoreEditorProfessionalApp` before physical qualification + explicit authorization;
- SesliTab cutover without explicit authorization.

## Validation contract

Every new implementation PR must be tested on its exact HEAD before merge. At minimum preserve:

- Node 18 / 20 / 22 repository contract + build/test;
- retained APP-10/11 WebKit authoring regressions;
- exact renderer checkout/build;
- APP-09B renderer regression;
- APP-09B controlled-layout rerender regression;
- P05 paste/render/undo regression;
- P08-E4 professional WebKit regression whenever the professional artifact or shared browser layers are touched.

Automated WebKit remains regression evidence, not physical-device evidence.

## Release / product state

```text
professionalArtifactMerged = true
professionalArtifactAutomatedWebKitPassed = true
professionalArtifactPhysicalIPhonePassed = false
professionalArtifactProductionExposureAuthorized = false
standaloneReleaseGatePassed = false
seslitabCutoverAuthorized = false
```
