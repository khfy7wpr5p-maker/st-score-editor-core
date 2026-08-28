# ST Score Editor Core

Security-first shared semantic score-editing core for ScoreMosaic and MusicXML-to-Guitar-TAB-Engine.

## Current status

The architecture is implemented through **Stage E8-C — Read-only Guitar Result Evidence**.

E8 now has three bounded foundations:

- **E8-A** freezes Guitar Workspace output as derivative-only and revision-bound.
- **E8-B** generates engine-safe MusicXML and the `sourceEventId` → canonical semantic source map during the same deterministic traversal.
- **E8-C** accepts only bounded `CanonicalTabResult 2.0.0` JSON, re-derives the current E8-B projection, cross-validates source facts against the current canonical revision, and exposes only immutable derivative guitar evidence.

The external Guitar TAB Engine is still **not invoked by this repository**. E8-C validates result artifacts supplied by a host/test boundary; it does not create network/service authority and cannot mutate the canonical score.

Completed layers:

- E0 — Architecture & Safety Foundation
- E1 — Canonical ScoreDocument Model
- E2 — Safe MusicXML Import & Semantic Round Trip
- E3 — Stable Semantic Addressing & Selection
- E4 — Atomic Score Edit Transactions & Score History
- E5 — Canonical Notation Structure / MusicXML Export
- E6 — Presentation-only OSMD / alphaTab Host Adapters
- E7-A — UI Authority Contract
- E7-B — Framework-neutral Editor Shell
- E7-C — Secure Renderer Selection & Canonical Inspector
- E7-D — Typed Basic Score Editing Intents
- E7-E1 — Atomic Notation Transactions
- E7-E2 — Typed Notation Palette / Inspector Intents
- E7-F — Unified Score+Notation History, Accessibility and Session Safety
- E7-G — Browser Host Runtime for ScoreMosaic
- E7-H — Browser-safe Runtime Bundle
- E8-A — Guitar Workspace Authority + Source-map Contract
- E8-B — Deterministic Guitar MusicXML + Source-map Projection
- E8-C — Read-only CanonicalTabResult Evidence

The next safe E8 step is a **host-side invocation boundary design**. Direct external-engine invocation remains human-gated and unauthorized inside core.

## Secure editor flow

```text
Canonical score + notation revision
        ↓
RenderRequest + opaque hit manifest
        ↓
Host renderer (presentation only)
        ↓
opaque hit token
        ↓
SemanticAddress + SelectionSnapshot
        ↓
read-only canonical inspector
        ↓
validated editor intent
        ├─ score intent → E4 transaction
        └─ notation intent → E7-E1 transaction
        ↓
accepted unified revision
        ↓
score + notation history
        ↓
new RenderRequest
```

Undo/redo restore score and notation together. Revision navigation clears selection rather than silently re-targeting it.

## Guitar Workspace boundary

The reviewed Guitar TAB Engine reference is `khfy7wpr5p-maker/musicxml-to-guitar-tab-engine` at main SHA `93abe9735a4ed70ad8362ac24ec39869ea34607f`. Its reviewed canonical result is `CanonicalTabResult` schema `2.0.0`; its polyphonic source identities use:

```text
<partId>:measure:<measureIndex>:note:<sourceOrder>
```

E8-B emits a narrow MusicXML source-fact profile with exactly one part (`P1`), one/two staves, exact canonical pitch/onset/duration, deterministic voice/staff cursor operations, chord markers, rests and tie start/stop facts. At emission time each external source id is paired with a current canonical semantic address.

E8-C does **not** trust `sourceEventId` alone. `CanonicalTabResult 2.0.0` does not carry ST `documentId`, ST `revisionId`, or a projection hash, so the result adapter re-derives the current projection and verifies:

- exact result/document/source/policy contract identities;
- exact measure/event source facts;
- pitch, timing, voice/staff, tie and chord-source facts;
- exact simultaneous-group coverage/order;
- exact arrangement-decision coverage/order;
- note-disposition ordering and decision consistency;
- selected string/fret → target-MIDI round-trip;
- exact required selected-shape coverage and finger/barre invariants.

Input is a bounded JSON string rather than an arbitrary JavaScript object. This keeps accessors/proxies outside the result-ingestion boundary.

A reported teacher review state (`NOT_REVIEWED`, `APPROVED`, `REJECTED`) is preserved as evidence only; it does not grant canonical mutation authority.

## Renderer and browser boundary

Renderer packages are not installed into this core repository. Product hosts supply the exact admitted versions:

- `opensheetmusicdisplay@2.1.1` — BSD-3-Clause — classical score host target
- `@coderline/alphatab@1.8.4` — MPL-2.0 — guitar/TAB host target

Renderers cannot mutate canonical state or authorize edits from DOM/SVG ids or coordinates.

E7-H produces the deterministic browser artifact:

- `dist/browser/st-score-editor-core.runtime.js`
- global: `STScoreEditorCoreRuntime`
- format: IIFE, target: ES2022
- no external browser imports
- no remote fetch requirement

The browser runtime remains non-authoritative and introduces no network, persistence, server-revision, approval or publication capability.

## Non-negotiable rules

1. Source bytes and source identity are immutable.
2. MusicXML is an exchange/projection format, not direct editor state.
3. Renderer/browser/DOM/SVG/coordinate state is never musical authority.
4. Edits require current semantic identity and typed bounded commands.
5. Transactions are atomic and validated before acceptance.
6. Score and notation revisions remain aligned in editor history.
7. Notation metadata may not be silently discarded when a score edit removes its target.
8. Stale selections, intents, render requests, notation snapshots and Guitar Workspace evidence fail closed.
9. Undo/redo clears selection and restores score+notation together.
10. AI/OMR and Guitar TAB engine output remain evidence/advice/derivative state only.
11. No production/public-write/live-AI/direct-engine-invocation authority is granted by repository merges.
12. ScoreMosaic and Guitar TAB authority ownership may not be changed implicitly by adapter work.

## Installed dependencies

Runtime:
- `saxes@6.0.0` — ISC — bounded XML parser only
- `xmlchars@2.2.0` — MIT — exact support pin

Build-only:
- `typescript@6.0.3` — Apache-2.0 — exact pin
- `esbuild@0.28.2` — MIT — browser bundling only

E8-A/E8-B/E8-C add **no dependency**. No UI framework, renderer package, persistence SDK, network service or AI/model dependency is installed through E8-C.

See `DEPENDENCIES.md`, `ARCHITECTURE.md`, `SAFETY.md`, `ROADMAP.md`, `DEVELOPMENT_GOVERNANCE.md`, `docs/guitar-workspace-authority-contract.md`, `docs/guitar-workspace-projection-contract.md`, `docs/guitar-workspace-result-evidence-contract.md`, and `contracts/`.
