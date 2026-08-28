# ST Score Editor Core

Security-first shared semantic score-editing core for ScoreMosaic and MusicXML-to-Guitar-TAB-Engine.

## Current status

The architecture is implemented through **Stage E8-B — Guitar Workspace MusicXML + Source-map Projection**.

E8 now has two bounded foundations:

- **E8-A** freezes Guitar Workspace output as derivative-only and revision-bound.
- **E8-B** generates engine-safe MusicXML and the `sourceEventId` → canonical semantic source map during the same deterministic traversal.

The external Guitar TAB Engine is still **not invoked or ingested** by this repository. No guitar result can mutate the canonical score.

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

The next safe E8 gate is a **validated read-only `CanonicalTabResult 2.0.0` ingestion/model boundary**. It must remain derivative-only.

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

E8-B emits a narrow MusicXML source-fact profile with:

- exactly one part (`P1`);
- one or two staves;
- exact canonical pitch/onset/duration;
- deterministic voice/staff streams with `backup` / `forward`;
- chord markers;
- rests;
- tie start/stop facts.

At the exact moment each MusicXML `<note>` is emitted, its external `sourceEventId` is paired with the current revision-bound canonical `note` or `event` address. No later pitch/coordinate/DOM heuristic is permitted.

Engine-unsupported presentation notation such as key/clef/barline, dots/beams, slurs and tuplet display markers is intentionally not emitted by this engine-specific projection. Canonical state remains unchanged and the full E5 notation serializer remains separate.

Guitar output may eventually be displayed, reviewed or used as advisory evidence. It cannot write backwards into `ScoreDocument`; any canonical change must still enter through semantic selection plus existing typed transactions.

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
8. Stale selections, intents, render requests, notation snapshots and Guitar Workspace source maps fail closed.
9. Undo/redo clears selection and restores score+notation together.
10. AI/OMR and Guitar TAB engine output remain evidence/advice/derivative state only.
11. No production/public-write/live-AI-edit authority is granted by repository merges.
12. ScoreMosaic and Guitar TAB authority ownership may not be changed implicitly by adapter work.

## Installed dependencies

Runtime:
- `saxes@6.0.0` — ISC — bounded XML parser only
- `xmlchars@2.2.0` — MIT — exact support pin

Build-only:
- `typescript@6.0.3` — Apache-2.0 — exact pin
- `esbuild@0.28.2` — MIT — browser bundling only

E8-A/E8-B add **no dependency**. No UI framework, renderer package, persistence SDK, network service or AI/model dependency is installed through E8-B.

See `DEPENDENCIES.md`, `ARCHITECTURE.md`, `SAFETY.md`, `ROADMAP.md`, `DEVELOPMENT_GOVERNANCE.md`, `docs/guitar-workspace-authority-contract.md`, `docs/guitar-workspace-projection-contract.md`, and `contracts/`.
